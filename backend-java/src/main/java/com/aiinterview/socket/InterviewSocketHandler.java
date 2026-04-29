package com.aiinterview.socket;

import com.aiinterview.model.Interview;
import com.aiinterview.repository.InterviewRepository;
import com.aiinterview.service.AiService;
import com.corundumstudio.socketio.AckRequest;
import com.corundumstudio.socketio.SocketIOClient;
import com.corundumstudio.socketio.SocketIOServer;
import com.corundumstudio.socketio.listener.ConnectListener;
import com.corundumstudio.socketio.listener.DataListener;
import com.corundumstudio.socketio.listener.DisconnectListener;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;

// Mirrors interview.socket.ts — all Socket.io events for the real-time verbal interview
@Component
public class InterviewSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(InterviewSocketHandler.class);

    private final SocketIOServer server;
    private final AiService aiService;
    private final ObjectMapper mapper = new ObjectMapper();

    @Autowired(required = false)
    private InterviewRepository interviewRepository;

    // In-memory session state for verbal interviews
    private final Map<String, SessionState> activeSessions = new ConcurrentHashMap<>();
    private final Map<String, ScheduledFuture<?>> sessionTimers = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(4);
    private final ExecutorService asyncExecutor = Executors.newCachedThreadPool();

    // Maps socketId → sessionId (so we know which session a socket belongs to)
    private final Map<String, String> socketToSession = new ConcurrentHashMap<>();

    private static final long VERBAL_DURATION_MS = 10 * 60 * 1000L; // 10 minutes

    public InterviewSocketHandler(SocketIOServer server, AiService aiService) {
        this.server = server;
        this.aiService = aiService;
    }

    // Called from AiInterviewApplication.main() to start the netty-socketio server
    public void start() {
        registerListeners();
        server.start();
        log.info("✅ Socket.io server started on port {}", server.getConfiguration().getPort());
    }

    private void registerListeners() {
        server.addConnectListener(onConnect());
        server.addDisconnectListener(onDisconnect());
        server.addEventListener("start_voice_interview", Object.class, onStartInterview());
        server.addEventListener("user_speak", Object.class, onUserSpeak());
        server.addEventListener("cheat_event", Object.class, onCheatEvent());
        server.addEventListener("submit_code_result", Object.class, onSubmitCodeResult());
        server.addEventListener("end_interview", Object.class, onEndInterview());
    }

    // ─── CONNECT ──────────────────────────────────────────────────────────────
    private ConnectListener onConnect() {
        return client -> log.info("🔌 Client connected: {}", client.getSessionId());
    }

    // ─── DISCONNECT ───────────────────────────────────────────────────────────
    private DisconnectListener onDisconnect() {
        return client -> {
            String socketId = client.getSessionId().toString();
            log.info("🔌 Client disconnected: {}", socketId);

            String sessionId = socketToSession.remove(socketId);
            if (sessionId != null) {
                // Schedule cleanup of the session after 30 minutes (in case user reconnects)
                String finalSessionId = sessionId;
                scheduler.schedule(() -> {
                    activeSessions.remove(finalSessionId);
                    ScheduledFuture<?> timer = sessionTimers.remove(finalSessionId);
                    if (timer != null) {
                        timer.cancel(false);
                        log.info("🧹 Cleaned up abandoned session: {}", finalSessionId);
                    }
                }, 30, TimeUnit.MINUTES);
            }
        };
    }

    // ─── START VOICE INTERVIEW ────────────────────────────────────────────────
    @SuppressWarnings("unchecked")
    private DataListener<Object> onStartInterview() {
        return (client, data, ack) -> {
            Map<String, Object> payload = toMap(data);
            String sessionId = str(payload.get("sessionId"));
            String resumeContext = str(payload.get("resumeContext"));
            if (sessionId == null || sessionId.isEmpty()) return;

            client.joinRoom(sessionId);
            socketToSession.put(client.getSessionId().toString(), sessionId);
            String socketUserId = str(payload.get("userId"));

            if (!activeSessions.containsKey(sessionId)) {
                log.info("✨ New Session: {}", sessionId);
                SessionState state = new SessionState();
                state.resumeContext = resumeContext;
                state.verbalStartTime = System.currentTimeMillis();
                state.userId = socketUserId;
                activeSessions.put(sessionId, state);

                // Verbal countdown timer — auto-end at 10 minutes
                ScheduledFuture<?> timer = scheduler.schedule(() -> {
                    SessionState s = activeSessions.get(sessionId);
                    if (s != null && !s.phase.equals("coding")) {
                        s.phase = "coding";
                        client.sendEvent("verbal_time_up", Map.of("message", "Verbal round time is up."));
                        scheduler.schedule(() ->
                                server.getRoomOperations(sessionId).sendEvent("start_coding_phase", Map.of()),
                                3, TimeUnit.SECONDS);
                    }
                    sessionTimers.remove(sessionId);
                }, VERBAL_DURATION_MS, TimeUnit.MILLISECONDS);
                sessionTimers.put(sessionId, timer);

                client.sendEvent("verbal_timer_start", Map.of("durationMs", VERBAL_DURATION_MS));

                // Generate initial AI greeting asynchronously
                asyncExecutor.submit(() -> {
                    try {
                        SessionState s = activeSessions.get(sessionId);
                        if (s == null) return;
                        Map<String, Object> aiResponse = aiService.generateVerbalResponse(
                                List.of(), "START_INTERVIEW", s.resumeContext,
                                VERBAL_DURATION_MS / 1000.0, s.tabSwitchCount);
                        s.history.add(Map.of("role", "assistant", "content", str(aiResponse.get("text"))));
                        if (aiResponse.get("difficulty_level") != null) s.difficultyLevel = str(aiResponse.get("difficulty_level"));
                        client.sendEvent("ai_speak", Map.of("text", str(aiResponse.get("text")), "difficulty_level", s.difficultyLevel));
                    } catch (Exception e) {
                        log.error("AI Init Error: {}", e.getMessage());
                        client.sendEvent("ai_speak", Map.of("text",
                                "Hello, I am Alex. Welcome to your technical interview. Tell me about yourself.",
                                "difficulty_level", "warmup"));
                    }
                });
            } else {
                log.info("🔄 Resumed Session: {}", sessionId);
                SessionState s = activeSessions.get(sessionId);
                long elapsed = s.verbalStartTime > 0 ? System.currentTimeMillis() - s.verbalStartTime : 0;
                long remaining = Math.max(0, VERBAL_DURATION_MS - elapsed);
                client.sendEvent("verbal_timer_start", Map.of("durationMs", VERBAL_DURATION_MS, "remainingMs", remaining));
            }
        };
    }

    // ─── USER SPEAK ───────────────────────────────────────────────────────────
    private DataListener<Object> onUserSpeak() {
        return (client, data, ack) -> {
            Map<String, Object> payload = toMap(data);
            String text = str(payload.get("text"));
            String sessionId = str(payload.get("sessionId"));
            if (sessionId == null || text == null || text.isEmpty()) return;

            // Security: ensure this socket owns the session it's speaking in
            String ownSession = socketToSession.get(client.getSessionId().toString());
            if (!sessionId.equals(ownSession)) {
                log.warn("⚠️ Socket {} tried to speak in session it doesn't own", client.getSessionId());
                return;
            }

            SessionState state = activeSessions.get(sessionId);
            if (state == null || state.phase.equals("coding")) return;

            state.history.add(new HashMap<>(Map.of("role", "user", "content", text)));

            long elapsed = state.verbalStartTime > 0 ? System.currentTimeMillis() - state.verbalStartTime : 0;
            double remainingSeconds = Math.max(0, (VERBAL_DURATION_MS - elapsed) / 1000.0);

            asyncExecutor.submit(() -> {
                try {
                    Map<String, Object> aiResponse = aiService.generateVerbalResponse(
                            state.history, text, state.resumeContext, remainingSeconds, state.tabSwitchCount);

                    // Re-read state — phase may have changed during the async AI call
                    SessionState freshState = activeSessions.get(sessionId);
                    if (freshState == null || freshState.phase.equals("coding")) return;

                    String aiText = str(aiResponse.get("text"));
                    String action = str(aiResponse.get("action"), "CONTINUE");
                    String dl = str(aiResponse.get("difficulty_level"), "easy");

                    freshState.history.add(new HashMap<>(Map.of("role", "assistant", "content", aiText)));
                    freshState.difficultyLevel = dl;

                    client.sendEvent("ai_speak", Map.of(
                            "text", aiText,
                            "difficulty_level", dl,
                            "time_remaining_seconds", (int) Math.round(remainingSeconds)
                    ));

                    if ("START_CODING".equals(action)) {
                        freshState.phase = "coding";
                        scheduler.schedule(() ->
                                server.getRoomOperations(sessionId).sendEvent("start_coding_phase", Map.of()),
                                4, TimeUnit.SECONDS);
                    }

                    if ("TERMINATE".equals(action)) {
                        client.sendEvent("interview_terminated", Map.of(
                                "reason", "tab_switch_violation",
                                "message", aiText
                        ));
                        persistTerminated(sessionId, freshState, str(payload.get("userId")));
                        activeSessions.remove(sessionId);
                    }
                } catch (Exception e) {
                    log.error("AI Response Error: {}", e.getMessage());
                }
            });
        };
    }

    // ─── CHEAT EVENT ──────────────────────────────────────────────────────────
    private DataListener<Object> onCheatEvent() {
        return (client, data, ack) -> {
            Map<String, Object> payload = toMap(data);
            String sessionId = str(payload.get("sessionId"));
            String type = str(payload.get("type"));
            String detail = str(payload.get("detail"), "");
            if (sessionId == null) return;

            if (!sessionId.equals(socketToSession.get(client.getSessionId().toString()))) return;

            SessionState state = activeSessions.get(sessionId);
            if (state == null) return;

            String flag = "[" + Instant.now() + "] " + type + ": " + detail;
            state.cheatingFlags.add(flag);

            if ("tab_switch".equals(type)) {
                state.tabSwitchCount++;
                log.info("🚨 Tab switch #{} in session {}", state.tabSwitchCount, sessionId);
            }
            if ("face_absent".equals(type)) {
                state.faceAbsenceCount++;
            }

            if (state.tabSwitchCount == 2) {
                client.sendEvent("ai_speak", Map.of(
                        "text", "I noticed you switched tabs. Please keep the interview window focused.",
                        "difficulty_level", state.difficultyLevel
                ));
            }
            if (state.faceAbsenceCount >= 5) {
                client.sendEvent("ai_speak", Map.of(
                        "text", "Please make sure your camera is visible and your face is in frame.",
                        "difficulty_level", state.difficultyLevel
                ));
                state.faceAbsenceCount = 0;
            }
        };
    }

    // ─── SUBMIT CODE RESULT ───────────────────────────────────────────────────
    private DataListener<Object> onSubmitCodeResult() {
        return (client, data, ack) -> {
            Map<String, Object> payload = toMap(data);
            String sessionId = str(payload.get("sessionId"));
            if (sessionId == null) return;
            if (!sessionId.equals(socketToSession.get(client.getSessionId().toString()))) return;

            SessionState state = activeSessions.get(sessionId);
            if (state != null) {
                state.codingResult = toMap(payload.get("result"));
            }
        };
    }

    // ─── END INTERVIEW ────────────────────────────────────────────────────────
    private DataListener<Object> onEndInterview() {
        return (client, data, ack) -> {
            Map<String, Object> payload = toMap(data);
            String sessionId = str(payload.get("sessionId"));
            String userId = str(payload.get("userId"));
            if (sessionId == null) {
                client.sendEvent("error", Map.of("message", "Unauthorized."));
                return;
            }
            if (!sessionId.equals(socketToSession.get(client.getSessionId().toString()))) {
                client.sendEvent("error", Map.of("message", "Unauthorized."));
                return;
            }

            log.info("🏁 Ending Interview for: {}", sessionId);
            SessionState state = activeSessions.get(sessionId);
            if (state == null) {
                client.sendEvent("error", Map.of("message", "Session data not found."));
                return;
            }

            // Clear the verbal countdown timer
            ScheduledFuture<?> timer = sessionTimers.remove(sessionId);
            if (timer != null) timer.cancel(false);

            asyncExecutor.submit(() -> {
                try {
                    client.sendEvent("feedback_processing", Map.of("message", "Analyzing performance..."));

                    Map<String, Object> report = aiService.generateFinalFeedback(state.history, state.codingResult);
                    int score = report.get("score") instanceof Number n ? n.intValue() : 0;
                    log.info("📊 Report Generated. Score: {}/100", score);

                    // Emit results immediately — don't block on DB save
                    Map<String, Object> resultPayload = new LinkedHashMap<>(report);
                    resultPayload.put("success", true);
                    resultPayload.put("sessionId", sessionId);
                    resultPayload.put("cheatingFlags", state.cheatingFlags.size());
                    client.sendEvent("interview_results", resultPayload);

                    activeSessions.remove(sessionId);

                    // Persist to MongoDB asynchronously
                    String resolvedUserId = userId != null && !userId.isEmpty() ? userId
                            : (state.userId != null ? state.userId : "GUEST_USER");
                    persistInterview(sessionId, resolvedUserId, score, report, state);
                } catch (Exception e) {
                    log.error("Report Generation Error: {}", e.getMessage());
                    client.sendEvent("error", Map.of("message", "Failed to generate report."));
                }
            });
        };
    }

    // ─── HELPERS ──────────────────────────────────────────────────────────────
    private void persistInterview(String sessionId, String userId, int score,
                                   Map<String, Object> report, SessionState state) {
        if (interviewRepository == null) return;
        try {
            Interview interview = new Interview();
            interview.setUserId(userId);
            interview.setSessionId(sessionId);
            interview.setScore(score);
            interview.setFeedback(str(report.get("feedback_summary"), "No summary."));
            interview.setVerdict(score >= 70 ? "Passed" : "Needs Improvement");
            interview.setDate(Instant.now());
            interview.setCheatingFlags(state.cheatingFlags);
            interview.setTabSwitches(state.tabSwitchCount);

            @SuppressWarnings("unchecked")
            List<String> improvements = report.get("areas_for_improvement") instanceof List<?> l
                    ? (List<String>) l : List.of();
            interview.setImprovements(improvements);

            List<Map<String, String>> verbatim = state.history.stream()
                    .map(m -> Map.of("role", str(m.get("role"), ""), "content", str(m.get("content"), "")))
                    .toList();
            interview.setVerbatim(verbatim);

            interviewRepository.save(interview);
            log.info("✅ Saved to DB: {}", interview.getId());
        } catch (Exception e) {
            log.error("❌ DB Save Failed: {}", e.getMessage());
        }
    }

    private void persistTerminated(String sessionId, SessionState state, String userId) {
        if (interviewRepository == null) return;
        try {
            String resolvedUserId = userId != null && !userId.isEmpty() ? userId
                    : (state.userId != null ? state.userId : "GUEST_USER");
            Interview interview = new Interview();
            interview.setUserId(resolvedUserId);
            interview.setSessionId(sessionId);
            interview.setScore(0);
            interview.setFeedback("Interview terminated due to integrity violation.");
            interview.setVerdict("Terminated");
            interview.setDate(Instant.now());
            interview.setCheatingFlags(state.cheatingFlags);
            interview.setTabSwitches(state.tabSwitchCount);
            interviewRepository.save(interview);
        } catch (Exception e) {
            log.error("❌ DB Save Failed on TERMINATE: {}", e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> toMap(Object obj) {
        if (obj instanceof Map<?, ?> m) return (Map<String, Object>) m;
        if (obj == null) return new HashMap<>();
        try {
            return mapper.convertValue(obj, Map.class);
        } catch (Exception e) {
            return new HashMap<>();
        }
    }

    private String str(Object v) {
        return v instanceof String s ? s : null;
    }

    private String str(Object v, String fallback) {
        return v instanceof String s ? s : fallback;
    }

    // ─── SESSION STATE ────────────────────────────────────────────────────────
    private static class SessionState {
        List<Map<String, Object>> history = new ArrayList<>();
        String phase = "intro";      // intro | verbal | coding
        Map<String, Object> codingResult;
        String resumeContext;
        long verbalStartTime = 0;
        String difficultyLevel = "warmup";
        List<String> cheatingFlags = new ArrayList<>();
        int tabSwitchCount = 0;
        int faceAbsenceCount = 0;
        String userId;
    }
}
