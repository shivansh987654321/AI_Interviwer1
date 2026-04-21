package com.aiinterview.socket;

import com.aiinterview.dto.SessionState;
import com.aiinterview.dto.VerbalMessage;
import com.aiinterview.model.Interview;
import com.aiinterview.repository.InterviewRepository;
import com.aiinterview.service.AIService;
import com.corundumstudio.socketio.AckRequest;
import com.corundumstudio.socketio.SocketIOClient;
import com.corundumstudio.socketio.SocketIOServer;
import com.corundumstudio.socketio.listener.ConnectListener;
import com.corundumstudio.socketio.listener.DisconnectListener;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;

@Slf4j
@Component
@RequiredArgsConstructor
public class InterviewSocketHandler {

    private final SocketIOServer       server;
    private final AIService            aiService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private InterviewRepository  interviewRepository;

    private static final long VERBAL_DURATION_MS = 10 * 60 * 1000L; // 10 minutes

    // sessionId → in-memory session state
    private final Map<String, SessionState> activeSessions = new ConcurrentHashMap<>();

    // sessionId → verbal-timeout future
    private final Map<String, ScheduledFuture<?>> sessionTimers = new ConcurrentHashMap<>();

    // socketId → sessionId (so we can guard ownership)
    private final Map<String, String> socketToSession = new ConcurrentHashMap<>();

    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(4);

    // ================================================================
    // LIFECYCLE
    // ================================================================
    @PostConstruct
    public void init() {
        server.addConnectListener(onConnect());
        server.addDisconnectListener(onDisconnect());

        server.addEventListener("start_voice_interview", Map.class, this::onStartVoiceInterview);
        server.addEventListener("user_speak",            Map.class, this::onUserSpeak);
        server.addEventListener("cheat_event",           Map.class, this::onCheatEvent);
        server.addEventListener("submit_code_result",    Map.class, this::onSubmitCodeResult);
        server.addEventListener("end_interview",         Map.class, this::onEndInterview);

        server.start();
        log.info("✅ Socket.IO server started on port {}", server.getConfiguration().getPort());
    }

    @PreDestroy
    public void destroy() {
        scheduler.shutdownNow();
        server.stop();
        log.info("Socket.IO server stopped");
    }

    // ================================================================
    // CONNECT / DISCONNECT
    // ================================================================
    private ConnectListener onConnect() {
        return client -> log.info("🔌 Client connected: {}", client.getSessionId());
    }

    private DisconnectListener onDisconnect() {
        return client -> {
            String socketId = client.getSessionId().toString();
            log.info("🔌 Client disconnected: {}", socketId);

            String sessionId = socketToSession.remove(socketId);
            if (sessionId == null) return;

            // If no other clients in the room, schedule cleanup after 30 min
            Collection<SocketIOClient> room = server.getRoomOperations(sessionId).getClients();
            if (room.isEmpty()) {
                ScheduledFuture<?> timer = sessionTimers.get(sessionId);
                if (timer != null) {
                    timer.cancel(false);
                    sessionTimers.remove(sessionId);
                    log.info("🧹 Cleared timer for abandoned session: {}", sessionId);
                }
                String sid = sessionId;
                scheduler.schedule(() -> {
                    Collection<SocketIOClient> stillEmpty =
                            server.getRoomOperations(sid).getClients();
                    if (stillEmpty.isEmpty()) {
                        activeSessions.remove(sid);
                        log.info("🧹 Cleaned up abandoned session: {}", sid);
                    }
                }, 30, TimeUnit.MINUTES);
            }
        };
    }

    // ================================================================
    // 1. START / JOIN SESSION
    // ================================================================
    @SuppressWarnings("unchecked")
    private void onStartVoiceInterview(SocketIOClient client, Map data, AckRequest ack) {
        if (data == null) return;
        String sessionId    = (String) data.get("sessionId");
        String resumeCtx    = (String) data.get("resumeContext");
        if (sessionId == null) return;

        String socketId = client.getSessionId().toString();
        String socketUserId = extractUserId(client);

        client.joinRoom(sessionId);
        socketToSession.put(socketId, sessionId);

        if (!activeSessions.containsKey(sessionId)) {
            log.info("✨ New Session: {}", sessionId);

            SessionState state = SessionState.builder()
                    .history(new ArrayList<>())
                    .phase("intro")
                    .resumeContext(resumeCtx)
                    .verbalStartTime(System.currentTimeMillis())
                    .verbalDurationMs(VERBAL_DURATION_MS)
                    .difficultyLevel("warmup")
                    .cheatingFlags(new ArrayList<>())
                    .tabSwitchCount(0)
                    .faceAbsenceCount(0)
                    .userId(socketUserId)
                    .build();

            activeSessions.put(sessionId, state);

            // Verbal countdown timer — auto-transition to coding at 10 min
            ScheduledFuture<?> timer = scheduler.schedule(() -> {
                SessionState s = activeSessions.get(sessionId);
                if (s != null && !"coding".equals(s.getPhase())) {
                    log.info("⏰ Verbal time up for session {}", sessionId);
                    s.setPhase("coding");
                    client.sendEvent("verbal_time_up", Map.of("message", "Verbal round time is up."));
                    scheduler.schedule(() ->
                            server.getRoomOperations(sessionId).sendEvent("start_coding_phase", ""),
                            3, TimeUnit.SECONDS);
                }
                sessionTimers.remove(sessionId);
            }, VERBAL_DURATION_MS, TimeUnit.MILLISECONDS);

            sessionTimers.put(sessionId, timer);
            client.sendEvent("verbal_timer_start", Map.of("durationMs", VERBAL_DURATION_MS));

            // Opening AI greeting
            CompletableFuture.runAsync(() -> {
                try {
                    SessionState s = activeSessions.get(sessionId);
                    if (s == null) return;
                    AIService.VerbalResponse resp = aiService.generateVerbalResponse(
                            List.of(), "START_INTERVIEW",
                            s.getResumeContext(),
                            (double) (VERBAL_DURATION_MS / 1000),
                            s.getTabSwitchCount()
                    );
                    s.getHistorySafe().add(new VerbalMessage("assistant", resp.text()));
                    if (resp.difficultyLevel() != null) s.setDifficultyLevel(resp.difficultyLevel());
                    client.sendEvent("ai_speak", Map.of(
                            "text", resp.text(),
                            "difficulty_level", resp.difficultyLevel()
                    ));
                } catch (Exception e) {
                    log.error("AI init error: {}", e.getMessage());
                    client.sendEvent("ai_speak", Map.of(
                            "text", "Hello, I am Alex. Welcome to your technical interview. Let us begin — tell me about yourself."
                    ));
                }
            });

        } else {
            log.info("🔄 Resumed Session: {}", sessionId);
            SessionState s = activeSessions.get(sessionId);
            long elapsed   = s.getVerbalStartTime() != null
                    ? System.currentTimeMillis() - s.getVerbalStartTime() : 0;
            long remaining = Math.max(0, s.getVerbalDurationMs() - elapsed);
            Map<String, Object> timerData = new HashMap<>();
            timerData.put("durationMs",  VERBAL_DURATION_MS);
            timerData.put("remainingMs", remaining);
            client.sendEvent("verbal_timer_start", timerData);
        }
    }

    // ================================================================
    // 2. VERBAL CONVERSATION
    // ================================================================
    @SuppressWarnings("unchecked")
    private void onUserSpeak(SocketIOClient client, Map data, AckRequest ack) {
        if (data == null) return;
        String text      = (String) data.get("text");
        String sessionId = (String) data.get("sessionId");
        if (sessionId == null || text == null || text.isBlank()) return;

        if (!isOwnSession(client, sessionId)) {
            log.warn("⚠️ Socket {} tried to speak in session {} it doesn't own",
                    client.getSessionId(), sessionId);
            return;
        }

        SessionState state = activeSessions.get(sessionId);
        if (state == null || "coding".equals(state.getPhase())) return;

        state.getHistorySafe().add(new VerbalMessage("user", text));

        long elapsed = state.getVerbalStartTime() != null
                ? System.currentTimeMillis() - state.getVerbalStartTime() : 0;
        double remainingSeconds = Math.max(0, (state.getVerbalDurationMs() - elapsed) / 1000.0);

        CompletableFuture.runAsync(() -> {
            try {
                AIService.VerbalResponse resp = aiService.generateVerbalResponse(
                        state.getHistorySafe(), text,
                        state.getResumeContext(),
                        remainingSeconds,
                        state.getTabSwitchCount()
                );
                state.getHistorySafe().add(new VerbalMessage("assistant", resp.text()));
                if (resp.difficultyLevel() != null) state.setDifficultyLevel(resp.difficultyLevel());

                Map<String, Object> event = new HashMap<>();
                event.put("text", resp.text());
                event.put("difficulty_level", resp.difficultyLevel());
                event.put("time_remaining_seconds", (int) Math.round(remainingSeconds));
                client.sendEvent("ai_speak", event);

                if ("START_CODING".equals(resp.action())) {
                    state.setPhase("coding");
                    scheduler.schedule(() ->
                            server.getRoomOperations(sessionId).sendEvent("start_coding_phase", ""),
                            4, TimeUnit.SECONDS);
                }

                if ("TERMINATE".equals(resp.action())) {
                    client.sendEvent("interview_terminated", Map.of(
                            "reason", "tab_switch_violation",
                            "message", resp.text()
                    ));
                }
            } catch (Exception e) {
                log.error("AI response error: {}", e.getMessage());
            }
        });
    }

    // ================================================================
    // 3. ANTI-CHEAT EVENTS
    // ================================================================
    @SuppressWarnings("unchecked")
    private void onCheatEvent(SocketIOClient client, Map data, AckRequest ack) {
        if (data == null) return;
        String sessionId = (String) data.get("sessionId");
        String type      = (String) data.get("type");
        String detail    = (String) data.getOrDefault("detail", "");
        if (sessionId == null || !isOwnSession(client, sessionId)) return;

        SessionState state = activeSessions.get(sessionId);
        if (state == null) return;

        String flag = "[" + Instant.now() + "] " + type + ": " + detail;
        state.getCheatingFlagsSafe().add(flag);

        if ("tab_switch".equals(type)) {
            state.setTabSwitchCount(state.getTabSwitchCount() + 1);
            log.info("🚨 Tab switch #{} in session {}", state.getTabSwitchCount(), sessionId);
        }
        if ("face_absent".equals(type)) {
            state.setFaceAbsenceCount(state.getFaceAbsenceCount() + 1);
        }

        if (state.getTabSwitchCount() == 2) {
            client.sendEvent("ai_speak", Map.of(
                    "text", "I noticed you switched tabs. Please keep the interview window focused.",
                    "difficulty_level", state.getDifficultyLevel()
            ));
        }
        if (state.getFaceAbsenceCount() >= 5) {
            client.sendEvent("ai_speak", Map.of(
                    "text", "Please make sure your camera is visible and your face is in frame.",
                    "difficulty_level", state.getDifficultyLevel()
            ));
            state.setFaceAbsenceCount(0);
        }
    }

    // ================================================================
    // 4. SAVE CODING RESULT
    // ================================================================
    @SuppressWarnings("unchecked")
    private void onSubmitCodeResult(SocketIOClient client, Map data, AckRequest ack) {
        if (data == null) return;
        String sessionId = (String) data.get("sessionId");
        if (sessionId == null || !isOwnSession(client, sessionId)) return;

        SessionState state = activeSessions.get(sessionId);
        if (state == null) return;

        Object result = data.get("result");
        if (result instanceof Map<?, ?> m) {
            @SuppressWarnings("unchecked")
            Map<String, Object> r = (Map<String, Object>) m;
            state.setCodingResult(r);
        }
    }

    // ================================================================
    // 5. END INTERVIEW — generate report, save to MongoDB
    // ================================================================
    @SuppressWarnings("unchecked")
    private void onEndInterview(SocketIOClient client, Map data, AckRequest ack) {
        if (data == null) return;
        String sessionId = (String) data.get("sessionId");
        String userId    = (String) data.get("userId");
        if (sessionId == null || !isOwnSession(client, sessionId)) {
            client.sendEvent("error", Map.of("message", "Unauthorized."));
            return;
        }

        log.info("🏁 Ending interview for: {}", sessionId);
        SessionState state = activeSessions.get(sessionId);
        if (state == null) {
            client.sendEvent("error", Map.of("message", "Session data not found."));
            return;
        }

        if (state.getUserId() != null && userId != null && !state.getUserId().equals(userId)) {
            log.warn("⚠️ userId mismatch on end_interview for session {}", sessionId);
            client.sendEvent("error", Map.of("message", "Unauthorized."));
            return;
        }

        // Cancel verbal timer
        ScheduledFuture<?> timer = sessionTimers.remove(sessionId);
        if (timer != null) timer.cancel(false);

        client.sendEvent("feedback_processing", Map.of("message", "Analyzing performance..."));

        CompletableFuture.runAsync(() -> {
            try {
                AIService.FinalFeedback report = aiService.generateFinalFeedback(
                        state.getHistorySafe(), state.getCodingResult()
                );
                log.info("📊 Report generated. Score: {}/100", report.score());

                // Send results immediately — don't block on DB
                Map<String, Object> resultEvent = new HashMap<>();
                resultEvent.put("success",       true);
                resultEvent.put("sessionId",      sessionId);
                resultEvent.put("score",          report.score());
                resultEvent.put("breakdown",      Map.of(
                        "communication",   report.breakdown().communication(),
                        "technical",       report.breakdown().technical(),
                        "problem_solving", report.breakdown().problemSolving()
                ));
                resultEvent.put("feedback_summary",       report.feedbackSummary());
                resultEvent.put("key_strengths",          report.keyStrengths());
                resultEvent.put("areas_for_improvement",  report.areasForImprovement());
                resultEvent.put("cheatingFlags",          state.getCheatingFlagsSafe().size());
                client.sendEvent("interview_results", resultEvent);

                activeSessions.remove(sessionId);

                // Persist to MongoDB asynchronously
                String resolvedUserId = userId != null ? userId
                        : state.getUserId() != null ? state.getUserId() : "GUEST_USER";
                try {
                    List<Map<String, String>> verbatim = state.getHistorySafe().stream()
                            .map(m -> Map.of("role", m.getRole(), "content", m.getContent()))
                            .toList();

                    Interview interview = Interview.builder()
                            .userId(resolvedUserId)
                            .sessionId(sessionId)
                            .score(report.score())
                            .feedback(report.feedbackSummary())
                            .verbatim(verbatim)
                            .improvements(report.areasForImprovement())
                            .verdict(report.score() >= 70 ? "Passed" : "Needs Improvement")
                            .cheatingFlags(state.getCheatingFlagsSafe())
                            .tabSwitches(state.getTabSwitchCount())
                            .date(Instant.now())
                            .build();

                    if (interviewRepository != null) {
                        interviewRepository.save(interview);
                        log.info("✅ Saved to MongoDB for session {}", sessionId);
                    } else {
                        log.warn("⚠️ MongoDB not available — skipping DB save for session {}", sessionId);
                    }
                } catch (Exception dbErr) {
                    log.error("❌ DB save failed (results already sent): {}", dbErr.getMessage());
                }

            } catch (Exception e) {
                log.error("Report generation error: {}", e.getMessage());
                client.sendEvent("error", Map.of("message", "Failed to generate report."));
            }
        });
    }

    // ================================================================
    // GUARD: verify socket owns the session it's trying to act on
    // ================================================================
    private boolean isOwnSession(SocketIOClient client, String sessionId) {
        String owned = socketToSession.get(client.getSessionId().toString());
        return sessionId.equals(owned);
    }

    private String extractUserId(SocketIOClient client) {
        try {
            Object auth = client.getHandshakeData().getAuthToken();
            if (auth instanceof Map<?, ?> m && m.get("userId") instanceof String s) return s;
        } catch (Exception ignored) {}
        return null;
    }
}
