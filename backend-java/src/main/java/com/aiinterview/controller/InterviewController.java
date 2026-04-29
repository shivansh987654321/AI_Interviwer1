package com.aiinterview.controller;

import com.aiinterview.dto.*;
import com.aiinterview.model.Interview;
import com.aiinterview.repository.InterviewRepository;
import com.aiinterview.service.AiService;
import com.aiinterview.service.QuestionService;
import com.aiinterview.service.SessionService;
import jakarta.servlet.http.HttpServletRequest;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.*;

// Mirrors interview.routes.ts — all REST endpoints under /api/interview
@RestController
@RequestMapping("/api/interview")
public class InterviewController {

    private static final Logger log = LoggerFactory.getLogger(InterviewController.class);

    @Autowired
    private AiService aiService;

    @Autowired
    private QuestionService questionService;

    @Autowired
    private SessionService sessionService;

    @Autowired(required = false)
    private InterviewRepository interviewRepository;

    private static final int QUESTION_COUNT = 2;

    private int getDuration(String difficulty) {
        return switch (difficulty.toLowerCase()) {
            case "easy"   -> 2700;  // 45 min
            case "medium" -> 3600;  // 60 min
            case "hard"   -> 7200;  // 120 min
            default       -> 3600;
        };
    }

    // =========================================================================
    // HEALTH CHECK
    // =========================================================================
    @GetMapping({"/health", "/../../health"})
    public ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(Map.of(
                "status", "ok",
                "server", "Java Spring Boot",
                "timestamp", Instant.now().toString()
        ));
    }

    // =========================================================================
    // TTS — ElevenLabs → OpenAI TTS → browser fallback
    // POST /api/interview/tts
    // =========================================================================
    @PostMapping("/tts")
    public ResponseEntity<?> textToSpeech(@RequestBody Map<String, String> body) {
        String text = body.get("text");
        String voice = body.getOrDefault("voice", "alloy");

        if (text == null || text.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "text required"));
        }
        if (text.length() > 4096) {
            return ResponseEntity.badRequest().body(Map.of("error", "text must be <= 4096 chars"));
        }

        try {
            byte[] audio = aiService.textToSpeech(text, voice);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType("audio/mpeg"));
            headers.setContentLength(audio.length);
            headers.setCacheControl("no-cache");
            return new ResponseEntity<>(audio, headers, HttpStatus.OK);
        } catch (Exception e) {
            log.error("[TTS] Error: {}", e.getMessage());
            return ResponseEntity.status(500).body(Map.of("error", "TTS failed"));
        }
    }

    // =========================================================================
    // PARSE RESUME — extract text from PDF / DOCX / TXT
    // POST /api/interview/parse-resume
    // =========================================================================
    @PostMapping("/parse-resume")
    public ResponseEntity<?> parseResume(@RequestParam("resume") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No file uploaded"));
        }

        String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase() : "";
        String mimeType = file.getContentType() != null ? file.getContentType() : "";

        try {
            byte[] bytes = file.getBytes();
            String text;

            if (mimeType.equals("text/plain") || originalName.endsWith(".txt")) {
                text = new String(bytes);
            } else if (mimeType.equals("application/pdf") || originalName.endsWith(".pdf")) {
                try (PDDocument doc = Loader.loadPDF(bytes)) {
                    text = new PDFTextStripper().getText(doc);
                }
            } else if (mimeType.contains("wordprocessingml") || originalName.endsWith(".docx")) {
                try (XWPFDocument doc = new XWPFDocument(new java.io.ByteArrayInputStream(bytes))) {
                    StringBuilder sb = new StringBuilder();
                    for (XWPFParagraph p : doc.getParagraphs()) {
                        sb.append(p.getText()).append("\n");
                    }
                    text = sb.toString();
                }
            } else {
                return ResponseEntity.badRequest().body(Map.of("error", "Only PDF, DOCX, and TXT files are allowed."));
            }

            String truncated = text.length() > 3000 ? text.substring(0, 3000) : text;
            return ResponseEntity.ok(Map.of("text", truncated));
        } catch (Exception e) {
            log.error("[parse-resume] Error: {}", e.getMessage());
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage(), "text", ""));
        }
    }

    // =========================================================================
    // STT — Speech to Text (OpenAI Whisper / Groq Whisper)
    // POST /api/interview/stt
    // =========================================================================
    @PostMapping("/stt")
    public ResponseEntity<?> speechToText(@RequestParam("audio") MultipartFile audioFile) {
        if (audioFile == null || audioFile.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "audio file required"));
        }

        Set<String> allowedMimes = Set.of(
                "audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg",
                "audio/wav", "audio/x-wav", "audio/mp3", "video/webm"
        );
        String mime = audioFile.getContentType() != null ? audioFile.getContentType() : "audio/webm";
        if (!allowedMimes.contains(mime)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Unsupported audio format"));
        }

        try {
            byte[] bytes = audioFile.getBytes();
            if (bytes.length < 500) {
                return ResponseEntity.ok(Map.of("text", ""));
            }
            log.info("[STT] Received {} bytes, mime: {}", bytes.length, mime);
            String text = aiService.speechToText(bytes, mime);
            log.info("[STT] Transcribed: \"{}\"", text);
            return ResponseEntity.ok(Map.of("text", text));
        } catch (Exception e) {
            log.error("[STT] Error: {}", e.getMessage());
            return ResponseEntity.ok(Map.of("text", ""));
        }
    }

    // =========================================================================
    // CREATE INTERVIEW SESSION
    // POST /api/interview/create
    // =========================================================================
    @PostMapping("/create")
    public ResponseEntity<?> createInterview(@RequestBody Map<String, Object> body) {
        Object diffRaw = body.get("difficulty");
        if (diffRaw == null || !(diffRaw instanceof String)) {
            return ResponseEntity.badRequest().body(Map.of("error", "difficulty is required and must be easy, medium, or hard"));
        }
        String difficulty = ((String) diffRaw).toLowerCase().trim();
        if (!Set.of("easy", "medium", "hard").contains(difficulty)) {
            return ResponseEntity.badRequest().body(Map.of("error", "difficulty must be easy, medium, or hard"));
        }

        String userId = body.get("userId") instanceof String s ? s : null;
        String sessionId = UUID.randomUUID().toString();
        int duration = getDuration(difficulty);

        log.info("[CREATE] Session: {} | Difficulty: {}", sessionId, difficulty);
        try {
            List<DSAQuestion> questions = questionService.generateQuestions(difficulty, QUESTION_COUNT);
            DSAQuestion firstQuestion = questions.get(0);

            SessionRecord session = new SessionRecord();
            session.setId(sessionId);
            session.setDifficulty(difficulty);
            session.setStartTime(Instant.now());
            session.setQuestions(questions);
            session.setCurrentQuestionIndex(0);
            session.setQuestion(firstQuestion);
            session.setScores(new ArrayList<>());
            session.setStatus("active");
            session.setDuration(duration);
            session.setCreatedAt(Instant.now());
            session.setUserId(userId);

            sessionService.saveSession(session);

            return ResponseEntity.status(201).body(Map.of(
                    "sessionId", sessionId,
                    "question", firstQuestion,
                    "duration", duration
            ));
        } catch (Exception e) {
            log.error("[CREATE] Error: {}", e.getMessage());
            return ResponseEntity.status(500).body(Map.of("error", "Failed to create interview session"));
        }
    }

    // =========================================================================
    // RUN CODE — runs against visible test cases only (no submission)
    // POST /api/interview/run
    // =========================================================================
    @PostMapping("/run")
    public ResponseEntity<?> runCode(@RequestBody Map<String, Object> body) {
        String sessionId = (String) body.get("sessionId");
        String code = (String) body.get("code");
        String language = (String) body.get("language");

        if (sessionId == null || code == null || language == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Missing: sessionId, code, language"));
        }
        if (code.length() > 100_000) {
            return ResponseEntity.badRequest().body(Map.of("error", "Code too large."));
        }

        SessionRecord session = sessionService.getSession(sessionId);
        if (session == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Session not found"));
        }

        DSAQuestion question = session.getQuestion();
        List<DSATestCase> visibleCases = question.getTestCases().stream().limit(2).toList();
        List<DSATestCase> executableCases = visibleCases.stream()
                .filter(tc -> tc.getStdin() != null)
                .toList();

        if (executableCases.isEmpty()) {
            return ResponseEntity.ok(Map.of(
                    "results", List.of(),
                    "message", "No executable test cases available."
            ));
        }

        try {
            List<TestCaseResult> results = aiService.runTestCases(code, language, executableCases);
            return ResponseEntity.ok(Map.of("results", results));
        } catch (Exception e) {
            log.error("[RUN] Error: {}", e.getMessage());
            return ResponseEntity.status(500).body(Map.of("error", "Code execution failed"));
        }
    }

    // =========================================================================
    // SUBMIT CODE — evaluate and move to next question if passing
    // POST /api/interview/submit
    // =========================================================================
    @PostMapping("/submit")
    public ResponseEntity<?> submitCode(@RequestBody Map<String, Object> body) {
        String sessionId = (String) body.get("sessionId");
        String code = (String) body.get("code");
        String language = (String) body.get("language");
        String userId = body.get("userId") instanceof String s ? s : null;

        if (sessionId == null || code == null || language == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Missing: sessionId, code, language"));
        }
        if (code.length() > 100_000) {
            return ResponseEntity.badRequest().body(Map.of("error", "Code too large. Maximum 100 KB allowed."));
        }

        SessionRecord session = sessionService.getSession(sessionId);
        if (session == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Session not found"));
        }
        if ("completed".equals(session.getStatus())) {
            return ResponseEntity.status(409).body(Map.of("error", "Already completed"));
        }
        if (session.getUserId() != null && userId != null && !session.getUserId().equals(userId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Unauthorized"));
        }

        try {
            EvaluationResult result = aiService.evaluateCode(session.getQuestion(), code, language);

            Map<String, Object> scoreEntry = new LinkedHashMap<>();
            scoreEntry.put("score", result.getScore());
            scoreEntry.put("verdict", result.getVerdict());
            scoreEntry.put("feedback", result.getFeedback());
            scoreEntry.put("code", code);
            scoreEntry.put("language", language);
            scoreEntry.put("questionTitle", session.getQuestion().getTitle());
            scoreEntry.put("submittedAt", Instant.now().toString());
            session.getScores().add(scoreEntry);

            Map<String, Object> responseData = new LinkedHashMap<>();
            responseData.put("score", result.getScore());
            responseData.put("verdict", result.getVerdict());
            responseData.put("feedback", result.getFeedback());
            responseData.put("improvements", result.getImprovements());
            responseData.put("testCases", result.getTestCases() != null ? result.getTestCases() : List.of());

            boolean passing = result.getScore() >= 60 || "Accepted".equals(result.getVerdict());

            if (passing) {
                int nextIndex = session.getCurrentQuestionIndex() + 1;
                if (nextIndex < session.getQuestions().size()) {
                    session.setCurrentQuestionIndex(nextIndex);
                    session.setQuestion(session.getQuestions().get(nextIndex));
                    responseData.put("nextQuestion", session.getQuestion());
                    responseData.put("questionIndex", nextIndex);

                    long passedCount = result.getTestCases() != null
                            ? result.getTestCases().stream().filter(TestCaseResult::isPassed).count() : 0;
                    long totalCount = result.getTestCases() != null ? result.getTestCases().size() : 0;
                    responseData.put("message", "✅ " + (totalCount > 0 ? passedCount + "/" + totalCount + " test cases passed! " : "Correct! ") + "Moving to next question…");
                } else {
                    session.setStatus("completed");
                    responseData.put("completed", true);
                    responseData.put("message", "🎉 All questions completed!");
                }
            } else {
                long passedCount = result.getTestCases() != null
                        ? result.getTestCases().stream().filter(TestCaseResult::isPassed).count() : 0;
                long totalCount = result.getTestCases() != null ? result.getTestCases().size() : 0;
                responseData.put("message", totalCount > 0
                        ? passedCount + "/" + totalCount + " test cases passed — fix the failing cases and resubmit."
                        : "Score " + result.getScore() + "/100 — keep trying!");
            }

            sessionService.saveSession(session);
            return ResponseEntity.ok(responseData);
        } catch (Exception e) {
            log.error("[SUBMIT] Error: {}", e.getMessage());
            return ResponseEntity.status(500).body(Map.of("error", "Code evaluation failed"));
        }
    }

    // =========================================================================
    // REPORT — get stored report from MongoDB
    // GET /api/interview/report/:sessionId   (must be before /:sessionId)
    // =========================================================================
    @GetMapping("/report/{sessionId}")
    public ResponseEntity<?> getReport(@PathVariable String sessionId) {
        if (interviewRepository == null) {
            return ResponseEntity.status(503).body(Map.of("error", "Database not configured"));
        }
        try {
            Optional<Interview> opt = interviewRepository.findBySessionId(sessionId);
            if (opt.isEmpty()) {
                return ResponseEntity.status(404).body(Map.of("error", "Report not found"));
            }
            Interview interview = opt.get();
            return ResponseEntity.ok(Map.of(
                    "sessionId", interview.getSessionId(),
                    "score", interview.getScore(),
                    "feedback", interview.getFeedback(),
                    "verdict", interview.getVerdict(),
                    "improvements", interview.getImprovements(),
                    "date", interview.getDate().toString()
            ));
        } catch (Exception e) {
            log.error("[REPORT] Error: {}", e.getMessage());
            return ResponseEntity.status(500).body(Map.of("error", "Failed to fetch report"));
        }
    }

    // =========================================================================
    // HISTORY — get past interviews for a user
    // GET /api/interview/history/:userId   (must be before /:sessionId)
    // =========================================================================
    @GetMapping("/history/{userId}")
    public ResponseEntity<?> getHistory(@PathVariable String userId) {
        if (userId == null || userId.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "userId required"));
        }
        if (interviewRepository == null) {
            return ResponseEntity.ok(Map.of("interviews", List.of()));
        }
        try {
            List<Interview> interviews = interviewRepository.findByUserIdOrderByDateDesc(userId);
            List<Map<String, Object>> result = interviews.stream().map(i -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("sessionId", i.getSessionId());
                m.put("date", i.getDate().toString());
                m.put("score", i.getScore());
                m.put("feedback", i.getFeedback());
                m.put("verdict", i.getVerdict());
                m.put("difficulty", i.getDifficulty());
                return m;
            }).toList();
            return ResponseEntity.ok(Map.of("interviews", result));
        } catch (Exception e) {
            log.error("[HISTORY] Error: {}", e.getMessage());
            return ResponseEntity.status(500).body(Map.of("error", "Failed to fetch history"));
        }
    }

    // =========================================================================
    // GET SESSION — returns session data
    // GET /api/interview/:sessionId   (must be last — catch-all)
    // =========================================================================
    @GetMapping("/{sessionId}")
    public ResponseEntity<?> getSession(@PathVariable String sessionId) {
        SessionRecord session = sessionService.getSession(sessionId);
        if (session == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Session not found"));
        }
        return ResponseEntity.ok(Map.of("session", session));
    }

    // =========================================================================
    // COMPLETE SESSION
    // POST /api/interview/complete/:sessionId
    // =========================================================================
    @PostMapping("/complete/{sessionId}")
    public ResponseEntity<?> completeSession(@PathVariable String sessionId) {
        SessionRecord session = sessionService.getSession(sessionId);
        if (session == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Session not found"));
        }
        session.setStatus("completed");
        session.setCompletedAt(Instant.now());
        sessionService.saveSession(session);
        return ResponseEntity.ok(Map.of("message", "Completed"));
    }
}
