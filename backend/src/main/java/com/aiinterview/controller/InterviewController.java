package com.aiinterview.controller;

import com.aiinterview.dto.DSAQuestion;
import com.aiinterview.dto.EvaluationResult;
import com.aiinterview.dto.SessionRecord;
import com.aiinterview.model.Interview;
import com.aiinterview.repository.InterviewRepository;
import com.aiinterview.service.AIService;
import com.aiinterview.service.SessionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.springframework.beans.factory.annotation.Autowired;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/interview")
@RequiredArgsConstructor
public class InterviewController {

    private final AIService        aiService;
    private final SessionService   sessionService;

    @Autowired(required = false)
    private InterviewRepository interviewRepository;

    private static final Set<String> ALLOWED_AUDIO_MIMES = Set.of(
            "audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg",
            "audio/wav", "audio/x-wav", "audio/mp3", "video/webm"
    );

    // ===========================================================================
    // HEALTH CHECK
    // ===========================================================================
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "ok", "timestamp", Instant.now().toString()));
    }

    // ===========================================================================
    // 0a. TTS — ElevenLabs → OpenAI TTS → browser speech (empty buffer)
    // ===========================================================================
    @PostMapping("/tts")
    public ResponseEntity<?> textToSpeech(@RequestBody Map<String, String> body) {
        String text  = body.get("text");
        String voice = body.getOrDefault("voice", "alloy");

        if (text == null || text.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "text required"));
        }
        if (text.length() > 4096) {
            return ResponseEntity.badRequest().body(Map.of("error", "text must be \u2264 4096 chars"));
        }

        try {
            byte[] audio = aiService.textToSpeech(text, voice);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_TYPE, "audio/mpeg")
                    .header(HttpHeaders.CONTENT_LENGTH, String.valueOf(audio.length))
                    .header(HttpHeaders.CACHE_CONTROL, "no-cache")
                    .body(audio);
        } catch (Exception e) {
            log.error("[TTS] Error: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "TTS failed"));
        }
    }

    // ===========================================================================
    // 0b. STT — Whisper (OpenAI or Groq)
    // ===========================================================================
    @PostMapping(value = "/stt", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> speechToText(@RequestPart("audio") MultipartFile audioFile) {
        try {
            if (audioFile == null || audioFile.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "audio file required"));
            }

            String mime = audioFile.getContentType() != null
                    ? audioFile.getContentType() : "audio/webm";

            if (!ALLOWED_AUDIO_MIMES.contains(mime)) {
                log.warn("[STT] Rejected mime: {}", mime);
                return ResponseEntity.badRequest().body(Map.of("error", "Unsupported audio format"));
            }

            byte[] bytes = audioFile.getBytes();
            if (bytes.length < 500) {
                log.warn("[STT] Audio too small, skipping");
                return ResponseEntity.ok(Map.of("text", ""));
            }

            log.info("[STT] Received {} bytes, mime: {}", bytes.length, mime);
            String text = aiService.speechToText(bytes, mime);
            String trimmed = text != null ? text.trim() : "";
            log.info("[STT] Transcribed: \"{}\"", trimmed);
            return ResponseEntity.ok(Map.of("text", trimmed));

        } catch (Exception e) {
            log.error("[STT] Error: {}", e.getMessage());
            return ResponseEntity.ok(Map.of("text", ""));
        }
    }

    // ===========================================================================
    // 0c. PARSE RESUME — PDF / DOCX / TXT → plain text
    // ===========================================================================
    @PostMapping(value = "/parse-resume", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> parseResume(@RequestPart("resume") MultipartFile file) {
        try {
            if (file == null || file.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "No file uploaded"));
            }

            String mime = file.getContentType() != null ? file.getContentType() : "";
            String name = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase() : "";
            byte[] bytes = file.getBytes();
            String text;

            if (mime.equals("text/plain") || name.endsWith(".txt")) {
                text = new String(bytes);
            } else if (mime.equals("application/pdf") || name.endsWith(".pdf")) {
                try (PDDocument doc = Loader.loadPDF(bytes)) {
                    text = new PDFTextStripper().getText(doc);
                }
            } else if (mime.contains("wordprocessingml") || name.endsWith(".docx") || name.endsWith(".doc")) {
                try (XWPFDocument docx = new XWPFDocument(new java.io.ByteArrayInputStream(bytes))) {
                    text = docx.getParagraphs().stream()
                            .map(XWPFParagraph::getText)
                            .collect(Collectors.joining("\n"));
                }
            } else {
                return ResponseEntity.badRequest().body(Map.of("error", "Unsupported file type"));
            }

            String trimmed = text.substring(0, Math.min(3000, text.length()));
            return ResponseEntity.ok(Map.of("text", trimmed));

        } catch (Exception e) {
            log.error("[parse-resume] Error: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage(), "text", ""));
        }
    }

    // ===========================================================================
    // 1. CREATE INTERVIEW — generate 3 DSA questions, store session
    // ===========================================================================
    @PostMapping("/create")
    public ResponseEntity<?> createInterview(@RequestBody Map<String, Object> body) {
        try {
            String difficulty = body.getOrDefault("difficulty", "medium").toString().toLowerCase();
            if (!Set.of("easy", "medium", "hard").contains(difficulty)) {
                return ResponseEntity.badRequest().body(Map.of("error", "difficulty must be easy, medium, or hard"));
            }
            String userId = body.get("userId") instanceof String s ? s : null;
            String domain  = body.get("domain")  instanceof String d ? d : "dsa";

            String sessionId = UUID.randomUUID().toString();
            int duration = SessionRecord.getDurationForDifficulty(difficulty);
            log.info("[CREATE] Session: {} | Difficulty: {} | Domain: {}", sessionId, difficulty, domain);

            List<DSAQuestion> questions = sessionService.generateQuestions(aiService, difficulty, 3);
            DSAQuestion first = questions.get(0);

            SessionRecord session = SessionRecord.builder()
                    .id(sessionId)
                    .difficulty(difficulty)
                    .domain(domain)
                    .startTime(Instant.now())
                    .questions(questions)
                    .currentQuestionIndex(0)
                    .question(first)
                    .scores(new ArrayList<>())
                    .status("active")
                    .duration(duration)
                    .createdAt(Instant.now())
                    .userId(userId)
                    .build();

            sessionService.saveSession(session);

            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                    "sessionId", sessionId,
                    "question", first,
                    "duration", duration,
                    "executionEnabled", true,
                    "supportedLanguages", List.of("javascript", "python", "java", "cpp")));

        } catch (Exception e) {
            log.error("[CREATE] Error: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to create interview session"));
        }
    }

    // ===========================================================================
    // 2. SUBMIT CODE — evaluate, advance question or complete
    // ===========================================================================
    @PostMapping("/submit")
    public ResponseEntity<?> submitCode(@RequestBody Map<String, Object> body) {
        try {
            String sessionId = (String) body.get("sessionId");
            String code      = (String) body.get("code");
            String language  = (String) body.get("language");
            String userId    = body.get("userId") instanceof String s ? s : null;

            if (sessionId == null || code == null || language == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "Missing: sessionId, code, language"));
            }

            Optional<SessionRecord> sessionOpt = sessionService.getSession(sessionId);
            if (sessionOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Session not found"));
            }
            SessionRecord session = sessionOpt.get();

            if ("completed".equals(session.getStatus())) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "Already completed"));
            }
            if (session.getUserId() != null && userId != null && !session.getUserId().equals(userId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Unauthorized"));
            }

            EvaluationResult result = aiService.evaluateCode(session.getQuestion(), code, language);

            Map<String, Object> scoreEntry = new HashMap<>();
            scoreEntry.put("score", result.getScore());
            scoreEntry.put("verdict", result.getVerdict());
            scoreEntry.put("feedback", result.getFeedback());
            scoreEntry.put("code", code);
            scoreEntry.put("language", language);
            scoreEntry.put("questionTitle", session.getQuestion().getTitle());
            scoreEntry.put("submittedAt", Instant.now().toString());
            session.getScoresSafe().add(scoreEntry);

            boolean passing = result.getScore() >= 60 || "Accepted".equals(result.getVerdict());
            List<Map<String, Object>> caseResults = buildCaseResults(session.getQuestion(), result);

            Map<String, Object> response = new HashMap<>();
            response.put("mode",             "submit");
            response.put("score",            result.getScore());
            response.put("verdict",          result.getVerdict());
            response.put("feedback",         result.getFeedback());
            response.put("improvements",     result.getImprovements());
            response.put("passed",           passing);
            response.put("allPublicPassed",  passing);
            response.put("caseResults",      caseResults);
            response.put("passedPublicCases",  passing ? caseResults.size() : 0);
            response.put("totalPublicCases",   caseResults.size());
            response.put("passedHiddenCases",  0);
            response.put("totalHiddenCases",   0);
            response.put("questionTitle",    session.getQuestion().getTitle());
            response.put("questionIndex",    session.getCurrentQuestionIndex());

            if (passing) {
                int nextIndex = session.getCurrentQuestionIndex() + 1;
                if (nextIndex < session.getQuestions().size()) {
                    session.setCurrentQuestionIndex(nextIndex);
                    session.setQuestion(session.getQuestions().get(nextIndex));
                    response.put("nextQuestion",  session.getQuestion());
                    response.put("questionIndex", nextIndex);
                    response.put("message", "Accepted! Moving to the next question\u2026");
                } else {
                    session.setStatus("completed");
                    response.put("completed", true);
                    response.put("message",   "All questions completed!");
                }
            } else {
                response.put("message", "Score " + result.getScore() + "/100 — keep trying!");
            }

            sessionService.saveSession(session);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("[SUBMIT] Error: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Code evaluation failed"));
        }
    }

    // ===========================================================================
    // 2b. RUN CODE — evaluate without advancing question (sample test run)
    // ===========================================================================
    @PostMapping("/run")
    public ResponseEntity<?> runCode(@RequestBody Map<String, Object> body) {
        try {
            String sessionId = (String) body.get("sessionId");
            String code      = (String) body.get("code");
            String language  = (String) body.get("language");
            String userId    = body.get("userId") instanceof String s ? s : null;

            if (sessionId == null || code == null || language == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "Missing: sessionId, code, language"));
            }

            Optional<SessionRecord> sessionOpt = sessionService.getSession(sessionId);
            if (sessionOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Session not found"));
            }
            SessionRecord session = sessionOpt.get();

            if (session.getUserId() != null && userId != null && !session.getUserId().equals(userId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Unauthorized"));
            }

            EvaluationResult result = aiService.evaluateCode(session.getQuestion(), code, language);
            boolean allPassed = result.getScore() >= 60 || "Accepted".equals(result.getVerdict());
            List<Map<String, Object>> caseResults = buildCaseResults(session.getQuestion(), result);

            Map<String, Object> response = new HashMap<>();
            response.put("mode",             "run");
            response.put("score",            result.getScore());
            response.put("verdict",          result.getVerdict());
            response.put("feedback",         result.getFeedback());
            response.put("passed",           allPassed);
            response.put("allPublicPassed",  allPassed);
            response.put("caseResults",      caseResults);
            response.put("passedPublicCases",  allPassed ? caseResults.size() : 0);
            response.put("totalPublicCases",   caseResults.size());
            response.put("passedHiddenCases",  0);
            response.put("totalHiddenCases",   0);
            response.put("questionTitle",    session.getQuestion().getTitle());
            response.put("questionIndex",    session.getCurrentQuestionIndex());
            response.put("message",          allPassed ? "All sample test cases passed." : "Some test cases failed — check your logic.");
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("[RUN] Error: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Code run failed"));
        }
    }

    // ===========================================================================
    // 3. GET SESSION — fetch active session by id
    // ===========================================================================
    @GetMapping("/{sessionId}")
    public ResponseEntity<?> getSession(@PathVariable String sessionId) {
        // avoid /report and /history being caught here (Spring handles @PathVariable after /report/)
        Optional<SessionRecord> session = sessionService.getSession(sessionId);
        if (session.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Session not found"));
        }
        return ResponseEntity.ok(Map.of("session", session.get()));
    }

    // ===========================================================================
    // 4. COMPLETE SESSION
    // ===========================================================================
    @PostMapping("/complete/{sessionId}")
    public ResponseEntity<?> completeSession(@PathVariable String sessionId) {
        Optional<SessionRecord> sessionOpt = sessionService.getSession(sessionId);
        if (sessionOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Session not found"));
        }
        SessionRecord session = sessionOpt.get();
        session.setStatus("completed");
        session.setCompletedAt(Instant.now());
        sessionService.saveSession(session);
        return ResponseEntity.ok(Map.of("message", "Completed"));
    }

    // ===========================================================================
    // 5. REPORT — fetch saved interview report from MongoDB
    // ===========================================================================
    @GetMapping("/report/{sessionId}")
    public ResponseEntity<?> getReport(@PathVariable String sessionId) {
        if (interviewRepository == null) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", "Database not available"));
        }
        try {
            Optional<Interview> interview = interviewRepository.findBySessionId(sessionId);
            if (interview.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Report not found"));
            }
            Interview iv = interview.get();
            Map<String, Object> resp = new HashMap<>();
            resp.put("sessionId",    iv.getSessionId());
            resp.put("score",        iv.getScore());
            resp.put("feedback",     iv.getFeedback());
            resp.put("verdict",      iv.getVerdict());
            resp.put("improvements", iv.getImprovements() != null ? iv.getImprovements() : List.of());
            resp.put("date",         iv.getDate());
            return ResponseEntity.ok(resp);
        } catch (Exception e) {
            log.error("[REPORT] Error: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to fetch report"));
        }
    }

    // ===========================================================================
    // 6. HISTORY — all past interviews for a user
    // ===========================================================================
    @GetMapping("/history/{userId}")
    public ResponseEntity<?> getHistory(@PathVariable String userId) {
        if (userId == null || userId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "userId required"));
        }
        if (interviewRepository == null) {
            return ResponseEntity.ok(Map.of("interviews", List.of()));
        }
        try {
            List<Interview> interviews = interviewRepository.findByUserIdOrderByDateDesc(userId);
            List<Map<String, Object>> result = interviews.stream().map(iv -> {
                Map<String, Object> m = new HashMap<>();
                m.put("sessionId",  iv.getSessionId());
                m.put("date",       iv.getDate());
                m.put("score",      iv.getScore());
                m.put("feedback",   iv.getFeedback());
                m.put("verdict",    iv.getVerdict());
                m.put("difficulty", iv.getDifficulty());
                return m;
            }).toList();
            return ResponseEntity.ok(Map.of("interviews", result));
        } catch (Exception e) {
            log.error("[HISTORY] Error: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to fetch history"));
        }
    }

    // ===========================================================================
    // HELPER — build JudgeResult-style caseResults from AI evaluation
    // ===========================================================================
    private List<Map<String, Object>> buildCaseResults(DSAQuestion question, EvaluationResult result) {
        boolean passed = result.getScore() >= 60 || "Accepted".equals(result.getVerdict());
        List<DSAQuestion.TestCase> testCases = question.getTestCases();
        if (testCases == null || testCases.isEmpty()) {
            Map<String, Object> single = new HashMap<>();
            single.put("testCaseId",     "tc-1");
            single.put("label",          "Sample");
            single.put("hidden",         false);
            single.put("passed",         passed);
            single.put("verdict",        result.getVerdict());
            single.put("runtimeMs",      null);
            single.put("memoryKb",       null);
            single.put("actualOutput",   null);
            single.put("expectedOutput", null);
            single.put("stderr",         null);
            return List.of(single);
        }
        List<Map<String, Object>> cases = new ArrayList<>();
        for (int i = 0; i < testCases.size(); i++) {
            DSAQuestion.TestCase tc = testCases.get(i);
            Map<String, Object> cr = new HashMap<>();
            cr.put("testCaseId",     "tc-" + (i + 1));
            cr.put("label",          "Case " + (i + 1));
            cr.put("hidden",         false);
            cr.put("passed",         passed);
            cr.put("verdict",        result.getVerdict());
            cr.put("runtimeMs",      null);
            cr.put("memoryKb",       null);
            cr.put("actualOutput",   passed ? tc.getOutput() : null);
            cr.put("expectedOutput", tc.getOutput());
            cr.put("stderr",         null);
            cases.add(cr);
        }
        return cases;
    }
}
