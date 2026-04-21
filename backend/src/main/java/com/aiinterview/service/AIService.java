package com.aiinterview.service;

import com.aiinterview.dto.DSAQuestion;
import com.aiinterview.dto.EvaluationResult;
import com.aiinterview.dto.VerbalMessage;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.util.StringUtils;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Slf4j
public class AIService {

    // ================================================================
    // CONFIG
    // ================================================================
    @Value("${ai.openai.key:}") private String openaiKey;
    @Value("${ai.openai.base-url}") private String openaiBaseUrl;
    @Value("${ai.groq.key:}")   private String groqKey;
    @Value("${ai.groq.base-url}") private String groqBaseUrl;
    @Value("${ai.elevenlabs.key:}")  private String elevenLabsKey;
    @Value("${ai.elevenlabs.voice-id}") private String elevenLabsVoiceId;
    @Value("${ai.mock:false}")  private boolean mockMode;

    private final ObjectMapper mapper;

    public AIService(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    // ================================================================
    // PROVIDER DETECTION
    // ================================================================
    private boolean hasOpenAI() {
        return StringUtils.hasText(openaiKey) && openaiKey.length() > 20 && !openaiKey.contains("your_");
    }

    private boolean hasGroq() {
        return StringUtils.hasText(groqKey) && groqKey.length() > 20;
    }

    private boolean hasElevenLabs() {
        return StringUtils.hasText(elevenLabsKey) && elevenLabsKey.length() > 20 && !elevenLabsKey.contains("your_");
    }

    private String chatBaseUrl() {
        return hasOpenAI() ? openaiBaseUrl : groqBaseUrl;
    }

    private String chatApiKey() {
        return hasOpenAI() ? openaiKey : groqKey;
    }

    private String chatModel() {
        return hasOpenAI() ? "gpt-4o" : "llama-3.3-70b-versatile";
    }

    private String sttModel() {
        return hasOpenAI() ? "whisper-1" : "whisper-large-v3";
    }

    // ================================================================
    // INTERNAL: BUILD WebClient FOR A BASE URL + API KEY
    // ================================================================
    private WebClient webClient(String baseUrl, String apiKey) {
        return WebClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    // ================================================================
    // INTERNAL: CHAT COMPLETION
    // Returns the raw content string from choices[0].message.content
    // ================================================================
    private String chatCompletion(List<Map<String, String>> messages, double temperature,
                                  int maxTokens, boolean jsonMode) {
        Map<String, Object> body = new HashMap<>();
        body.put("model", chatModel());
        body.put("messages", messages);
        body.put("temperature", temperature);
        body.put("max_tokens", maxTokens);
        if (jsonMode) {
            body.put("response_format", Map.of("type", "json_object"));
        }

        try {
            Map<?, ?> response = webClient(chatBaseUrl(), chatApiKey())
                    .post()
                    .uri("/chat/completions")
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (response == null) return "{}";
            List<?> choices = (List<?>) response.get("choices");
            if (choices == null || choices.isEmpty()) return "{}";
            Map<?, ?> message = (Map<?, ?>) ((Map<?, ?>) choices.get(0)).get("message");
            String content = message != null ? (String) message.get("content") : null;
            if (content == null) {
                log.warn("Chat API returned null content. Full response: {}", response);
                return "{}";
            }
            return content;
        } catch (WebClientResponseException e) {
            log.error("Chat API error {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            return "{}";
        } catch (Exception e) {
            log.error("Chat completion failed: {}", e.getMessage());
            return "{}";
        }
    }

    // ================================================================
    // INTERNAL: CLEAN & PARSE JSON FROM LLM OUTPUT
    // LLMs sometimes wrap JSON in ```json ... ``` or add extra text.
    // ================================================================
    @SuppressWarnings("unchecked")
    private Map<String, Object> cleanAndParse(String raw) {
        if (raw == null || raw.isBlank()) {
            log.warn("cleanAndParse called with null/blank input");
            return null;
        }
        try {
            String clean = raw.replaceAll("```json", "").replaceAll("```", "").trim();

            // Find first { and matching }
            int firstBrace = clean.indexOf('{');
            if (firstBrace == -1) return null;

            int braceCount = 0;
            int lastBrace = -1;
            for (int i = firstBrace; i < clean.length(); i++) {
                if (clean.charAt(i) == '{') braceCount++;
                else if (clean.charAt(i) == '}') {
                    braceCount--;
                    if (braceCount == 0) { lastBrace = i; break; }
                }
            }
            if (lastBrace == -1) return null;

            clean = clean.substring(firstBrace, lastBrace + 1);
            return mapper.readValue(clean, new TypeReference<>() {});
        } catch (Exception e) {
            String fragment = raw != null ? raw.substring(0, Math.min(150, raw.length())) : "<null>";
            log.error("JSON parse failed. Fragment: {}", fragment);
            return null;
        }
    }

    private String str(Map<String, Object> m, String key, String fallback) {
        Object v = m == null ? null : m.get(key);
        return (v instanceof String s) ? s : fallback;
    }

    @SuppressWarnings("unchecked")
    private List<String> strList(Map<String, Object> m, String key) {
        Object v = m == null ? null : m.get(key);
        if (v instanceof List<?> list) {
            List<String> result = new ArrayList<>();
            for (Object item : list) {
                if (item instanceof String s) result.add(s);
            }
            return result;
        }
        return new ArrayList<>();
    }

    // ================================================================
    // TTS — ElevenLabs → OpenAI TTS → empty byte[] (browser fallback)
    // ================================================================
    public byte[] textToSpeech(String text, String voice) {
        if (mockMode) return new byte[0];

        // 1. ElevenLabs (best quality)
        if (hasElevenLabs()) {
            try {
                Map<String, Object> voiceSettings = new HashMap<>();
                voiceSettings.put("stability", 0.45);
                voiceSettings.put("similarity_boost", 0.80);
                voiceSettings.put("style", 0.35);
                voiceSettings.put("use_speaker_boost", true);

                Map<String, Object> body = new HashMap<>();
                body.put("text", text);
                body.put("model_id", "eleven_multilingual_v2");
                body.put("voice_settings", voiceSettings);

                byte[] audio = WebClient.builder()
                        .baseUrl("https://api.elevenlabs.io/v1")
                        .defaultHeader("xi-api-key", elevenLabsKey)
                        .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                        .build()
                        .post()
                        .uri("/text-to-speech/" + elevenLabsVoiceId)
                        .bodyValue(body)
                        .retrieve()
                        .bodyToMono(byte[].class)
                        .block();

                if (audio != null && audio.length > 0) return audio;
            } catch (Exception e) {
                log.error("ElevenLabs TTS failed, falling back to OpenAI: {}", e.getMessage());
            }
        }

        // 2. OpenAI TTS
        if (hasOpenAI()) {
            try {
                List<String> validVoices = List.of("alloy", "echo", "fable", "onyx", "nova", "shimmer");
                String safeVoice = validVoices.contains(voice) ? voice : "alloy";

                Map<String, Object> body = new HashMap<>();
                body.put("model", "tts-1");
                body.put("input", text);
                body.put("voice", safeVoice);
                body.put("response_format", "mp3");

                byte[] audio = webClient(openaiBaseUrl, openaiKey)
                        .post()
                        .uri("/audio/speech")
                        .bodyValue(body)
                        .retrieve()
                        .bodyToMono(byte[].class)
                        .block();

                if (audio != null && audio.length > 0) return audio;
            } catch (Exception e) {
                log.error("OpenAI TTS failed: {}", e.getMessage());
            }
        }

        // 3. Empty buffer — browser speechSynthesis handles it
        log.warn("All TTS providers failed — returning empty buffer (browser fallback)");
        return new byte[0];
    }

    // ================================================================
    // STT — convert WebM → MP3 via ffmpeg, then send to Whisper
    // ffmpeg is required on system PATH (same requirement as Node version)
    // ================================================================
    public String speechToText(byte[] audioBytes, String mimeType) {
        if (mockMode) return "";

        Path tempIn = null;
        Path tempOut = null;
        try {
            tempIn  = Files.createTempFile("stt_in_",  ".webm");
            tempOut = Files.createTempFile("stt_out_", ".mp3");

            Files.write(tempIn, audioBytes);

            // Convert WebM → MP3 to fix corrupt duration headers (Groq rejects raw WebM)
            ProcessBuilder pb = new ProcessBuilder(
                    "ffmpeg", "-y", "-i", tempIn.toString(),
                    "-acodec", "libmp3lame", "-q:a", "2",
                    tempOut.toString()
            );
            pb.redirectErrorStream(true);
            Process process = pb.start();
            boolean finished = process.waitFor(30, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                log.warn("ffmpeg timed out");
                return "";
            }

            byte[] mp3Bytes = Files.readAllBytes(tempOut);
            if (mp3Bytes.length < 100) return "";

            // Build multipart/form-data request for Whisper
            ByteArrayResource audioResource = new ByteArrayResource(mp3Bytes) {
                @Override public String getFilename() { return "audio.mp3"; }
            };

            MultiValueMap<String, Object> formData = new LinkedMultiValueMap<>();
            formData.add("file", audioResource);
            formData.add("model", sttModel());
            formData.add("language", "en");
            formData.add("response_format", "json");

            Map<?, ?> response = WebClient.builder()
                    .baseUrl(chatBaseUrl())
                    .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + chatApiKey())
                    .build()
                    .post()
                    .uri("/audio/transcriptions")
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .bodyValue(formData)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (response == null) return "";
            String text = (String) response.get("text");
            return text != null ? text.trim() : "";

        } catch (Exception e) {
            log.error("STT failed: {}", e.getMessage());
            return "";
        } finally {
            silentDelete(tempIn);
            silentDelete(tempOut);
        }
    }

    private void silentDelete(Path p) {
        if (p != null) { try { Files.deleteIfExists(p); } catch (IOException ignored) {} }
    }

    // ================================================================
    // DSA QUESTION GENERATION
    // ================================================================
    public DSAQuestion generateDSAQuestion(String level) {
        if (mockMode) return fallbackQuestion(level);

        String prompt = """
            Generate a unique %s-level Data Structures and Algorithms coding interview question.
            Return STRICT JSON only — no extra text, no markdown:
            {
              "title": "Short descriptive title",
              "description": "Clear problem statement with examples",
              "difficulty": "%s",
              "constraints": ["Constraint 1", "Constraint 2"],
              "testCases": [
                {"input": "example input 1", "output": "example output 1"},
                {"input": "example input 2", "output": "example output 2"}
              ],
              "functionSignature": "function solve(args) {"
            }
            """.formatted(level, level);

        try {
            String raw = chatCompletion(
                    List.of(Map.of("role", "user", "content", prompt)),
                    0.6, 1000, true
            );
            Map<String, Object> q = cleanAndParse(raw);
            if (q == null) throw new RuntimeException("Null parse");

            List<DSAQuestion.TestCase> testCases = new ArrayList<>();
            Object tcRaw = q.get("testCases");
            if (tcRaw instanceof List<?> list) {
                for (Object item : list) {
                    if (item instanceof Map<?, ?> m) {
                        testCases.add(new DSAQuestion.TestCase(
                                (String) m.get("input"), (String) m.get("output")));
                    }
                }
            }

            return DSAQuestion.builder()
                    .title(str(q, "title", "Unknown Problem"))
                    .description(str(q, "description", "No description provided."))
                    .difficulty(str(q, "difficulty", level))
                    .constraints(strList(q, "constraints"))
                    .testCases(testCases)
                    .functionSignature(str(q, "functionSignature", "function solution() {"))
                    .build();

        } catch (Exception e) {
            log.error("Question generation failed (using fallback): {}", e.getMessage());
            return fallbackQuestion(level);
        }
    }

    private DSAQuestion fallbackQuestion(String level) {
        return DSAQuestion.builder()
                .title("Two Sum")
                .description("Given an array of integers nums and a target integer target, return indices of the two numbers that add up to target.")
                .difficulty(level)
                .constraints(List.of("2 <= nums.length <= 10^4", "-10^9 <= nums[i] <= 10^9"))
                .testCases(List.of(
                        new DSAQuestion.TestCase("nums = [2,7,11,15], target = 9", "[0,1]"),
                        new DSAQuestion.TestCase("nums = [3,2,4], target = 6", "[1,2]")))
                .functionSignature("function twoSum(nums, target) {")
                .isFallback(true)
                .build();
    }

    // ================================================================
    // CODE EVALUATION
    // ================================================================
    public EvaluationResult evaluateCode(DSAQuestion question, String code, String language) {
        if (mockMode) {
            return EvaluationResult.builder()
                    .score(85).verdict("Accepted")
                    .feedback("Mock mode: code looks good!")
                    .improvements(List.of("Consider edge cases")).build();
        }

        String prompt = """
            You are a senior software engineer evaluating a candidate's code submission.

            Problem Title: %s
            Problem Description: %s
            Language: %s
            Submitted Code:
            ```%s
            %s
            ```

            Evaluate strictly and return STRICT JSON only:
            {
              "score": <number 0-100>,
              "verdict": "<Accepted|Wrong Answer|Compilation Error|Time Limit Exceeded|Runtime Error>",
              "feedback": "<one paragraph explanation>",
              "improvements": ["suggestion 1", "suggestion 2"]
            }

            Scoring: 90-100 perfect/optimal, 70-89 correct not optimal, 50-69 partial, 0-49 wrong.
            """.formatted(question.getTitle(), question.getDescription(), language, language, code);

        try {
            String raw = chatCompletion(
                    List.of(Map.of("role", "user", "content", prompt)),
                    0.2, 800, true
            );
            Map<String, Object> r = cleanAndParse(raw);
            if (r == null) throw new RuntimeException("Null parse");

            Object scoreVal = r.get("score");
            int score = scoreVal instanceof Number n ? n.intValue() : 0;

            return EvaluationResult.builder()
                    .score(score)
                    .verdict(str(r, "verdict", "Wrong Answer"))
                    .feedback(str(r, "feedback", "Could not evaluate."))
                    .improvements(strList(r, "improvements"))
                    .build();
        } catch (Exception e) {
            log.error("Code evaluation failed: {}", e.getMessage());
            return EvaluationResult.builder()
                    .score(0).verdict("Wrong Answer")
                    .feedback("Could not evaluate the submission. Please try again.")
                    .improvements(List.of("Ensure your solution handles all edge cases."))
                    .build();
        }
    }

    // ================================================================
    // VERBAL INTERVIEW — realistic FAANG interviewer
    // ================================================================
    public VerbalResponse generateVerbalResponse(
            List<VerbalMessage> history,
            String userMessage,
            String resumeContext,
            Double timeRemainingSeconds,
            Integer tabSwitchCount) {

        if (mockMode) {
            return new VerbalResponse(
                    "Tell me more about your experience.", "CONTINUE", "warmup");
        }

        int turnCount = (int) history.stream().filter(h -> "user".equals(h.getRole())).count();

        String timeWarning = (timeRemainingSeconds != null && timeRemainingSeconds < 120)
                ? "\nSYSTEM: Only " + (int) Math.ceil(timeRemainingSeconds / 60) + " minute(s) remaining. Transition to coding soon."
                : "";

        String resumeSection = (resumeContext != null && !resumeContext.isBlank())
                ? "\nCANDIDATE RESUME:\n" + resumeContext.substring(0, Math.min(1200, resumeContext.length())) + "\n"
                : "";

        String tabWarning = (tabSwitchCount != null && tabSwitchCount >= 3)
                ? "\nSYSTEM: TAB_SWITCH_COUNT = " + tabSwitchCount + ". TERMINATE the interview immediately."
                : "";

        String systemPrompt = """
            You are Alex, a highly realistic technical interviewer from a top tech company. Behave exactly like a real human interviewer — professional, slightly strict. No emojis, no casual tone, no chatbot behavior.

            INTERVIEW FLOW (STRICT — never expose phase names):
            1. OPENING: Greet briefly, ask candidate to introduce themselves.
            2. INTRO EVAL: Evaluate clarity, confidence, structure. Probe deeper critically if weak.
            3. TRANSITION: Move naturally. "Alright, let's talk about your projects." Never announce phase changes.
            4. RESUME/PROJECT DEEP DIVE: Ask strictly from their projects, skills, tech stack.
            5. CORE TECHNICAL: Gradually shift to OS, DBMS, Computer Networks. Start medium, go hard.
            6. PRESSURE: If silent too long — prompt once: "Are you there?" then move forward.
            7. CODING TRANSITION: Say naturally: "Alright, let's move to a coding problem."

            ANTI-CHEATING: If TAB_SWITCH_COUNT >= 3, say EXACTLY: "The interview has been terminated due to multiple tab switches. This behavior is considered a violation of interview integrity." Set action to TERMINATE.

            RULES:
            - Keep ALL responses to 2-3 sentences MAX
            - Ask ONE question at a time, never two
            - Sound human, not like an assistant
            """;

        String historyJson;
        try {
            List<VerbalMessage> recent = history.size() > 12
                    ? history.subList(history.size() - 12, history.size())
                    : history;
            historyJson = mapper.writeValueAsString(recent);
        } catch (Exception e) {
            historyJson = "[]";
        }

        String userPrompt = resumeSection + tabWarning + timeWarning + """

            Conversation so far (%d candidate turns):
            %s

            Candidate just said: "%s"

            Internal difficulty tracking (never expose this):
            Turn 0-2: warmup | Turn 3-5: easy | Turn 6-8: medium | Turn 9+: hard
            Current turn: %d

            Return STRICT JSON only — no markdown, no extra text:
            {"text":"your 2-3 sentence response","action":"CONTINUE","difficulty_level":"warmup"}

            action values: "CONTINUE" | "START_CODING" | "TERMINATE"
            """.formatted(turnCount, historyJson, userMessage, turnCount);

        try {
            String raw = chatCompletion(
                    List.of(
                            Map.of("role", "system", "content", systemPrompt),
                            Map.of("role", "user", "content", userPrompt)
                    ),
                    0.5, 500, true
            );
            Map<String, Object> r = cleanAndParse(raw);
            if (r == null) return new VerbalResponse("I didn't catch that. Could you repeat?", "CONTINUE", "easy");

            String dl = str(r, "difficulty_level", "easy");
            if (!List.of("warmup", "easy", "medium", "hard").contains(dl)) dl = "easy";

            return new VerbalResponse(
                    str(r, "text", "I didn't catch that."),
                    str(r, "action", "CONTINUE"),
                    dl
            );
        } catch (Exception e) {
            log.error("Verbal response failed: {}", e.getMessage());
            return new VerbalResponse("Could you please repeat that?", "CONTINUE", "easy");
        }
    }

    // ================================================================
    // FINAL REPORT
    // ================================================================
    public FinalFeedback generateFinalFeedback(
            List<VerbalMessage> chatHistory,
            Map<String, Object> codingResult) {

        if (mockMode) {
            return new FinalFeedback(72,
                    new FinalFeedback.Breakdown(20, 28, 24),
                    "Good overall performance with room for improvement.",
                    List.of("Clear communication", "Solid fundamentals"),
                    List.of("Optimize time complexity", "Practice more DSA"));
        }

        String historyJson, codingJson;
        try {
            historyJson = mapper.writeValueAsString(chatHistory);
            codingJson  = mapper.writeValueAsString(codingResult);
        } catch (Exception e) {
            historyJson = "[]"; codingJson = "{}";
        }

        String prompt = """
            Analyze this complete interview session and generate a detailed report card.

            Chat History: %s
            Coding Results: %s

            Return STRICT JSON only:
            {
              "score": <number 0-100>,
              "breakdown": {
                "communication": <number 0-30>,
                "technical": <number 0-40>,
                "problem_solving": <number 0-30>
              },
              "feedback_summary": "1-2 sentence overview of performance",
              "key_strengths": ["strength 1", "strength 2", "strength 3"],
              "areas_for_improvement": ["area 1", "area 2"]
            }
            """.formatted(historyJson, codingJson);

        try {
            String raw = chatCompletion(
                    List.of(Map.of("role", "user", "content", prompt)),
                    0.2, 800, false
            );
            Map<String, Object> r = cleanAndParse(raw);
            if (r == null || !r.containsKey("breakdown")) throw new RuntimeException("Invalid format");

            @SuppressWarnings("unchecked")
            Map<String, Object> bd = (Map<String, Object>) r.get("breakdown");

            Object scoreVal = r.get("score");
            int score = scoreVal instanceof Number n ? n.intValue() : 0;

            return new FinalFeedback(
                    score,
                    new FinalFeedback.Breakdown(
                            bd.get("communication")  instanceof Number n ? n.intValue() : 0,
                            bd.get("technical")       instanceof Number n ? n.intValue() : 0,
                            bd.get("problem_solving") instanceof Number n ? n.intValue() : 0
                    ),
                    str(r, "feedback_summary", "No summary available."),
                    strList(r, "key_strengths"),
                    strList(r, "areas_for_improvement")
            );
        } catch (Exception e) {
            log.error("Final feedback generation failed: {}", e.getMessage());
            return new FinalFeedback(0,
                    new FinalFeedback.Breakdown(0, 0, 0),
                    "Could not generate report due to an error.",
                    List.of(), List.of("System Error — Please try again"));
        }
    }

    // ================================================================
    // NESTED RESPONSE TYPES (used only inside this service / socket handler)
    // ================================================================
    public record VerbalResponse(String text, String action, String difficultyLevel) {}

    public record FinalFeedback(
            int score,
            Breakdown breakdown,
            String feedbackSummary,
            List<String> keyStrengths,
            List<String> areasForImprovement
    ) {
        public record Breakdown(int communication, int technical, int problemSolving) {}
    }
}
