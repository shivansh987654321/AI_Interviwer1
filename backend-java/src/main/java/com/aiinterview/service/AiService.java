package com.aiinterview.service;

import com.aiinterview.dto.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import okhttp3.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.util.*;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;

// AiService — handles all external AI API calls.
// Mirrors ai.service.ts: OpenAI Chat, Groq Chat, OpenAI Whisper, ElevenLabs TTS, local code execution.
@Service
public class AiService {

    private static final Logger log = LoggerFactory.getLogger(AiService.class);

    @Value("${openai.api.key:}")
    private String openaiKey;

    @Value("${groq.api.key:}")
    private String groqKey;

    @Value("${elevenlabs.api.key:}")
    private String elevenLabsKey;

    @Value("${elevenlabs.voice.id:pNInz6obpgDQGcFmaJgB}")
    private String elevenLabsVoiceId;

    @Value("${mock.ai:false}")
    private boolean mockAi;

    private final OkHttpClient http;
    private final ObjectMapper mapper = new ObjectMapper();
    private final Semaphore aiSemaphore = new Semaphore(5); // max 5 concurrent AI calls

    private static final Map<String, String> CODE_EXT = Map.of(
            "javascript", "js",
            "python", "py",
            "java", "java",
            "cpp", "cpp"
    );

    public AiService(OkHttpClient http) {
        this.http = http;
    }

    // ================================================================
    // PROVIDER DETECTION
    // ================================================================
    private boolean isOpenAiAvailable() {
        return openaiKey != null && openaiKey.length() > 20 && !openaiKey.contains("your_");
    }

    private boolean isGroqAvailable() {
        return groqKey != null && groqKey.length() > 20;
    }

    private boolean isElevenLabsAvailable() {
        return elevenLabsKey != null && elevenLabsKey.length() > 20 && !elevenLabsKey.contains("your_");
    }

    private String getChatBaseUrl() {
        if (isOpenAiAvailable()) return "https://api.openai.com/v1";
        if (isGroqAvailable())   return "https://api.groq.com/openai/v1";
        return "https://api.openai.com/v1"; // will fail with clear error
    }

    private String getChatApiKey() {
        if (isOpenAiAvailable()) return openaiKey;
        if (isGroqAvailable())   return groqKey;
        return openaiKey;
    }

    private String getChatModel() {
        if (isOpenAiAvailable()) return "gpt-4o";
        return "llama-3.3-70b-versatile";
    }

    private String getSttModel() {
        if (isOpenAiAvailable()) return "whisper-1";
        return "whisper-large-v3";
    }

    private String getSttBaseUrl() {
        if (isOpenAiAvailable()) return "https://api.openai.com/v1";
        if (isGroqAvailable())   return "https://api.groq.com/openai/v1";
        return "https://api.openai.com/v1";
    }

    // ================================================================
    // CORE: CHAT COMPLETE (calls OpenAI or Groq with identical API shape)
    // ================================================================
    private Map<String, Object> chatComplete(List<Map<String, String>> messages, double temperature, int maxTokens) throws IOException {
        aiSemaphore.acquireUninterruptibly();
        try {
            ObjectNode body = mapper.createObjectNode();
            body.put("model", getChatModel());
            body.put("temperature", temperature);
            body.put("max_tokens", maxTokens);

            ObjectNode responseFormat = mapper.createObjectNode();
            responseFormat.put("type", "json_object");
            body.set("response_format", responseFormat);

            ArrayNode msgs = mapper.createArrayNode();
            for (Map<String, String> m : messages) {
                ObjectNode msg = mapper.createObjectNode();
                msg.put("role", m.get("role"));
                msg.put("content", m.get("content"));
                msgs.add(msg);
            }
            body.set("messages", msgs);

            Request request = new Request.Builder()
                    .url(getChatBaseUrl() + "/chat/completions")
                    .addHeader("Authorization", "Bearer " + getChatApiKey())
                    .addHeader("Content-Type", "application/json")
                    .post(RequestBody.create(mapper.writeValueAsString(body), MediaType.parse("application/json")))
                    .build();

            try (Response response = http.newCall(request).execute()) {
                String responseBody = response.body() != null ? response.body().string() : "{}";
                if (!response.isSuccessful()) {
                    throw new IOException("Chat API error " + response.code() + ": " + responseBody);
                }
                return mapper.readValue(responseBody, new TypeReference<Map<String, Object>>() {});
            }
        } finally {
            aiSemaphore.release();
        }
    }

    // Chat without json_object response format (for simple text responses)
    private Map<String, Object> chatCompleteText(List<Map<String, String>> messages, double temperature, int maxTokens) throws IOException {
        aiSemaphore.acquireUninterruptibly();
        try {
            ObjectNode body = mapper.createObjectNode();
            body.put("model", getChatModel());
            body.put("temperature", temperature);
            body.put("max_tokens", maxTokens);

            ArrayNode msgs = mapper.createArrayNode();
            for (Map<String, String> m : messages) {
                ObjectNode msg = mapper.createObjectNode();
                msg.put("role", m.get("role"));
                msg.put("content", m.get("content"));
                msgs.add(msg);
            }
            body.set("messages", msgs);

            Request request = new Request.Builder()
                    .url(getChatBaseUrl() + "/chat/completions")
                    .addHeader("Authorization", "Bearer " + getChatApiKey())
                    .addHeader("Content-Type", "application/json")
                    .post(RequestBody.create(mapper.writeValueAsString(body), MediaType.parse("application/json")))
                    .build();

            try (Response response = http.newCall(request).execute()) {
                String responseBody = response.body() != null ? response.body().string() : "{}";
                if (!response.isSuccessful()) {
                    throw new IOException("Chat API error " + response.code() + ": " + responseBody);
                }
                return mapper.readValue(responseBody, new TypeReference<Map<String, Object>>() {});
            }
        } finally {
            aiSemaphore.release();
        }
    }

    // Extract the text content from a chat completion response
    @SuppressWarnings("unchecked")
    private String extractContent(Map<String, Object> completion) {
        try {
            List<Map<String, Object>> choices = (List<Map<String, Object>>) completion.get("choices");
            if (choices == null || choices.isEmpty()) return "{}";
            Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
            if (message == null) return "{}";
            Object content = message.get("content");
            return content != null ? content.toString() : "{}";
        } catch (Exception e) {
            return "{}";
        }
    }

    // Clean AI response text and parse as JSON map (handles markdown code fences)
    private Map<String, Object> cleanAndParse(String text) {
        try {
            String clean = text.replace("```json", "").replace("```", "").trim();
            int firstBrace = clean.indexOf('{');
            if (firstBrace == -1) return null;
            int lastBrace = -1;
            int braceCount = 0;
            for (int i = firstBrace; i < clean.length(); i++) {
                if (clean.charAt(i) == '{') braceCount++;
                if (clean.charAt(i) == '}') {
                    braceCount--;
                    if (braceCount == 0) { lastBrace = i; break; }
                }
            }
            if (lastBrace == -1) return null;
            clean = clean.substring(firstBrace, lastBrace + 1);
            return mapper.readValue(clean, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            log.error("JSON parse failed. Fragment: {}", text.length() > 150 ? text.substring(0, 150) : text);
            return null;
        }
    }

    private String str(Object v, String fallback) {
        return v instanceof String ? (String) v : fallback;
    }

    @SuppressWarnings("unchecked")
    private List<String> strList(Object v) {
        if (v instanceof List<?> list) {
            List<String> result = new ArrayList<>();
            for (Object item : list) {
                if (item != null) result.add(item.toString());
            }
            return result;
        }
        return new ArrayList<>();
    }

    // ================================================================
    // TTS — ElevenLabs → OpenAI TTS → empty buffer (browser fallback)
    // ================================================================
    public byte[] textToSpeech(String text, String voice) {
        // 1. ElevenLabs (best quality)
        if (isElevenLabsAvailable()) {
            try {
                ObjectNode body = mapper.createObjectNode();
                body.put("text", text);
                body.put("model_id", "eleven_multilingual_v2");
                ObjectNode voiceSettings = mapper.createObjectNode();
                voiceSettings.put("stability", 0.45);
                voiceSettings.put("similarity_boost", 0.80);
                voiceSettings.put("style", 0.35);
                voiceSettings.put("use_speaker_boost", true);
                body.set("voice_settings", voiceSettings);

                Request request = new Request.Builder()
                        .url("https://api.elevenlabs.io/v1/text-to-speech/" + elevenLabsVoiceId)
                        .addHeader("xi-api-key", elevenLabsKey)
                        .addHeader("Content-Type", "application/json")
                        .post(RequestBody.create(mapper.writeValueAsString(body), MediaType.parse("application/json")))
                        .build();

                try (Response response = http.newCall(request).execute()) {
                    if (response.isSuccessful() && response.body() != null) {
                        return response.body().bytes();
                    }
                }
            } catch (Exception e) {
                log.error("ElevenLabs TTS error: {}", e.getMessage());
            }
        }

        // 2. OpenAI TTS fallback
        if (isOpenAiAvailable()) {
            try {
                List<String> validVoices = List.of("alloy", "echo", "fable", "onyx", "nova", "shimmer");
                String safeVoice = validVoices.contains(voice) ? voice : "alloy";

                ObjectNode body = mapper.createObjectNode();
                body.put("model", "tts-1");
                body.put("voice", safeVoice);
                body.put("input", text);
                body.put("response_format", "mp3");

                Request request = new Request.Builder()
                        .url("https://api.openai.com/v1/audio/speech")
                        .addHeader("Authorization", "Bearer " + openaiKey)
                        .addHeader("Content-Type", "application/json")
                        .post(RequestBody.create(mapper.writeValueAsString(body), MediaType.parse("application/json")))
                        .build();

                try (Response response = http.newCall(request).execute()) {
                    if (response.isSuccessful() && response.body() != null) {
                        return response.body().bytes();
                    }
                }
            } catch (Exception e) {
                log.error("OpenAI TTS error: {}", e.getMessage());
            }
        }

        // 3. Empty buffer — browser speechSynthesis will handle it
        log.warn("[TTS] All providers failed — returning empty buffer");
        return new byte[0];
    }

    // ================================================================
    // STT — OpenAI Whisper or Groq Whisper (both use multipart form)
    // ================================================================
    public String speechToText(byte[] audioBytes, String mimeType) {
        String id = UUID.randomUUID().toString();
        File tmpDir = new File(System.getProperty("java.io.tmpdir"), "stt_" + id);
        tmpDir.mkdirs();
        File tmpIn = new File(tmpDir, "audio.webm");
        File tmpOut = new File(tmpDir, "audio.mp3");

        try {
            Files.write(tmpIn.toPath(), audioBytes);

            // Convert webm → mp3 using ffmpeg (fixes corrupt duration headers that Whisper rejects)
            ProcessBuilder pb = new ProcessBuilder(
                    "ffmpeg", "-y", "-i", tmpIn.getAbsolutePath(),
                    "-ar", "16000", "-ac", "1", "-b:a", "64k",
                    tmpOut.getAbsolutePath()
            );
            pb.redirectErrorStream(true);
            Process proc = pb.start();
            boolean finished = proc.waitFor(15, TimeUnit.SECONDS);
            if (!finished) {
                proc.destroyForcibly();
            }

            File audioFile = tmpOut.exists() ? tmpOut : tmpIn;
            byte[] audioData = Files.readAllBytes(audioFile.toPath());
            String filename = tmpOut.exists() ? "audio.mp3" : "audio.webm";
            String fileMime = tmpOut.exists() ? "audio/mpeg" : mimeType;

            RequestBody fileBody = RequestBody.create(audioData, MediaType.parse(fileMime));
            MultipartBody requestBody = new MultipartBody.Builder()
                    .setType(MultipartBody.FORM)
                    .addFormDataPart("file", filename, fileBody)
                    .addFormDataPart("model", getSttModel())
                    .addFormDataPart("language", "en")
                    .addFormDataPart("response_format", "json")
                    .build();

            Request request = new Request.Builder()
                    .url(getSttBaseUrl() + "/audio/transcriptions")
                    .addHeader("Authorization", "Bearer " + getChatApiKey())
                    .post(requestBody)
                    .build();

            try (Response response = http.newCall(request).execute()) {
                String body = response.body() != null ? response.body().string() : "{}";
                if (response.isSuccessful()) {
                    Map<String, Object> result = mapper.readValue(body, new TypeReference<Map<String, Object>>() {});
                    String text = str(result.get("text"), "").trim();
                    return text;
                }
                log.warn("[STT] API returned {}: {}", response.code(), body);
                return "";
            }
        } catch (Exception e) {
            log.error("[STT] Error: {}", e.getMessage());
            return "";
        } finally {
            // Cleanup temp files
            tmpIn.delete();
            tmpOut.delete();
            tmpDir.delete();
        }
    }

    // ================================================================
    // LOCAL CODE EXECUTION — spawns language runtimes as child processes
    // Mirrors the executeCode() method in ai.service.ts
    // ================================================================
    public Map<String, Object> executeCode(String code, String language, String stdin) {
        String id = UUID.randomUUID().toString();
        String ext = CODE_EXT.getOrDefault(language, "js");
        int timeoutMs = 8000;

        File jobDir = new File(System.getProperty("java.io.tmpdir"), "job_" + id);
        jobDir.mkdirs();

        // Java filename must be "Main.java" to match the class name in our starter code
        String fileName = "java".equals(language) ? "Main.java" : "code_" + id + "." + ext;
        File codeFile = new File(jobDir, fileName);
        File stdinFile = new File(jobDir, "stdin.txt");

        try {
            Files.writeString(codeFile.toPath(), code);
            Files.writeString(stdinFile.toPath(), stdin != null ? stdin : "");

            String compileCmd = null;
            String[] runCmd;
            String compiledBin = null;

            switch (language) {
                case "python":
                    runCmd = new String[]{"sh", "-c", "python3 \"" + codeFile.getAbsolutePath() + "\" < \"" + stdinFile.getAbsolutePath() + "\""};
                    break;
                case "java":
                    compileCmd = "javac -cp \"" + jobDir.getAbsolutePath() + "\" \"" + codeFile.getAbsolutePath() + "\"";
                    runCmd = new String[]{"sh", "-c", "java -cp \"" + jobDir.getAbsolutePath() + "\" Main < \"" + stdinFile.getAbsolutePath() + "\""};
                    break;
                case "cpp":
                    compiledBin = new File(jobDir, "prog").getAbsolutePath();
                    compileCmd = "g++ -o \"" + compiledBin + "\" \"" + codeFile.getAbsolutePath() + "\"";
                    runCmd = new String[]{"sh", "-c", "\"" + compiledBin + "\" < \"" + stdinFile.getAbsolutePath() + "\""};
                    break;
                default: // javascript
                    runCmd = new String[]{"sh", "-c", "node \"" + codeFile.getAbsolutePath() + "\" < \"" + stdinFile.getAbsolutePath() + "\""};
            }

            // Compile step (Java / C++)
            if (compileCmd != null) {
                try {
                    Process compileProc = Runtime.getRuntime().exec(new String[]{"sh", "-c", compileCmd});
                    boolean done = compileProc.waitFor(timeoutMs, TimeUnit.MILLISECONDS);
                    if (!done) compileProc.destroyForcibly();
                    if (compileProc.exitValue() != 0) {
                        String stderr = new String(compileProc.getErrorStream().readAllBytes()).trim();
                        boolean notFound = stderr.contains("not found") || stderr.contains("No such file");
                        String compileError = notFound
                                ? (language.equals("java") ? "javac" : "g++") + " is not installed on this server. Please switch to JavaScript or Python."
                                : stderr;
                        cleanup(jobDir);
                        return Map.of("stdout", "", "stderr", "", "exitCode", 1, "compileError", compileError);
                    }
                } catch (Exception e) {
                    cleanup(jobDir);
                    return Map.of("stdout", "", "stderr", "", "exitCode", 1, "compileError", e.getMessage());
                }
            }

            // Run step
            Process runProc = Runtime.getRuntime().exec(runCmd);
            boolean done = runProc.waitFor(timeoutMs, TimeUnit.MILLISECONDS);
            if (!done) {
                runProc.destroyForcibly();
                cleanup(jobDir);
                return Map.of("stdout", "", "stderr", "Time Limit Exceeded", "exitCode", 124, "compileError", "");
            }

            String stdout = new String(runProc.getInputStream().readAllBytes()).trim();
            String stderr = new String(runProc.getErrorStream().readAllBytes()).trim();
            int exitCode = runProc.exitValue();
            cleanup(jobDir);
            return Map.of("stdout", stdout, "stderr", stderr, "exitCode", exitCode, "compileError", "");

        } catch (Exception e) {
            cleanup(jobDir);
            return Map.of("stdout", "", "stderr", e.getMessage(), "exitCode", 1, "compileError", "");
        }
    }

    private void cleanup(File dir) {
        if (dir.exists()) {
            for (File f : Objects.requireNonNull(dir.listFiles())) f.delete();
            dir.delete();
        }
    }

    // Run code against multiple test cases
    public List<TestCaseResult> runTestCases(String code, String language, List<DSATestCase> testCases) {
        List<DSATestCase> executable = testCases.stream()
                .filter(tc -> tc.getStdin() != null && tc.getExpectedOutput() != null)
                .toList();

        List<TestCaseResult> results = new ArrayList<>();
        for (DSATestCase tc : executable) {
            Map<String, Object> r = executeCode(code, language, tc.getStdin());
            String compileError = str(r.get("compileError"), "");
            String stdout = str(r.get("stdout"), "");
            String stderr = str(r.get("stderr"), "");
            int exitCode = r.get("exitCode") instanceof Integer ? (Integer) r.get("exitCode") : 1;
            String expected = tc.getExpectedOutput().trim();

            String actualOutput;
            String status;
            boolean passed;

            if (!compileError.isEmpty()) {
                actualOutput = compileError;
                status = "Compilation Error";
                passed = false;
            } else if (exitCode == 124 || stderr.contains("Time Limit")) {
                actualOutput = "Time Limit Exceeded";
                status = "Time Limit Exceeded";
                passed = false;
            } else if (exitCode != 0) {
                actualOutput = stderr.isEmpty() ? "Runtime Error" : stderr;
                status = "Runtime Error";
                passed = false;
            } else {
                actualOutput = stdout;
                passed = expected.equals(actualOutput.trim());
                status = passed ? "Accepted" : "Wrong Answer";
            }

            results.add(new TestCaseResult(tc.getInput(), expected, actualOutput, passed, status));
        }
        return results;
    }

    // ================================================================
    // DSA QUESTION GENERATION
    // ================================================================
    public DSAQuestion generateDSAQuestion(String difficulty, QuestionMeta meta) {
        if (mockAi) return buildFallbackQuestion(difficulty);

        String diffDesc = switch (difficulty) {
            case "easy"   -> "easy to medium level (arrays, strings, hashmaps, two-pointers — solvable in 15-20 min)";
            case "medium" -> "medium level (trees, sliding window, BFS/DFS, sorting — solvable in 25-30 min)";
            case "hard"   -> "medium-hard to hard level (DP, graphs, backtracking, advanced data structures — solvable in 40-50 min)";
            default       -> difficulty + "-level";
        };

        String problemSpec = meta != null
                ? "Generate the well-known LeetCode problem \"" + meta.getTitle() + "\" (topic: " + meta.getTopic() + ", URL: " + meta.getUrl() + ")."
                : "Generate a unique " + diffDesc + " DSA coding problem for a technical interview.";

        String prompt = problemSpec + """

REQUIREMENTS:
1. testCases: include both human-readable AND machine stdin/expectedOutput formats (3 cases, last one an edge case)
2. starterCode: boilerplate-only template for each language — DO NOT implement the solution
   - The I/O parsing code (reading stdin, printing stdout) must be COMPLETE and CORRECT
   - The solution function body must contain ONLY the comment "// write your solution here" — NO algorithm, NO logic, NO hints
3. stdin format must be consistent across testCases and starterCode

Return STRICT JSON only — no markdown:
{
  "title": "Problem title",
  "description": "Clear problem statement with Input/Output format and 1-2 worked examples",
  "difficulty": \"""" + difficulty + """
",
  "constraints": ["constraint 1", "constraint 2"],
  "functionSignature": "e.g. int[] twoSum(int[] nums, int target)",
  "testCases": [
    { "input": "nums = [2,7,11,15], target = 9", "output": "[0,1]", "stdin": "4\\n2 7 11 15\\n9", "expectedOutput": "0 1" }
  ],
  "starterCode": {
    "javascript": "...",
    "python": "...",
    "java": "...",
    "cpp": "..."
  }
}""";

        try {
            Map<String, String> userMsg = Map.of("role", "user", "content", prompt);
            Map<String, Object> completion = chatComplete(List.of(userMsg), 0.7, 4500);
            String rawText = extractContent(completion);
            Map<String, Object> question = cleanAndParse(rawText);
            if (question == null) throw new RuntimeException("Parsed JSON was null");

            return buildDSAQuestion(question, difficulty);
        } catch (Exception e) {
            log.error("Question generation error (using fallback): {}", e.getMessage());
            return buildFallbackQuestion(difficulty);
        }
    }

    @SuppressWarnings("unchecked")
    private DSAQuestion buildDSAQuestion(Map<String, Object> q, String difficulty) {
        DSAQuestion question = new DSAQuestion();
        question.setTitle(str(q.get("title"), "Unknown Problem"));
        question.setDescription(str(q.get("description"), "No description provided."));
        question.setDifficulty(str(q.get("difficulty"), difficulty));
        question.setConstraints(strList(q.get("constraints")));
        question.setFunctionSignature(str(q.get("functionSignature"), "function solution()"));

        // Parse test cases
        List<DSATestCase> testCases = new ArrayList<>();
        Object rawTc = q.get("testCases");
        if (rawTc instanceof List<?> tcList) {
            for (Object tcObj : tcList) {
                if (tcObj instanceof Map<?, ?> tc) {
                    DSATestCase testCase = new DSATestCase();
                    testCase.setInput(str(tc.get("input"), ""));
                    testCase.setOutput(str(tc.get("output"), ""));
                    testCase.setStdin(tc.get("stdin") != null ? str(tc.get("stdin"), null) : null);
                    testCase.setExpectedOutput(tc.get("expectedOutput") != null ? str(tc.get("expectedOutput"), null) : null);
                    testCases.add(testCase);
                }
            }
        }
        question.setTestCases(testCases);

        // Parse starter code
        Object rawSc = q.get("starterCode");
        if (rawSc instanceof Map<?, ?> sc) {
            StarterCode starterCode = new StarterCode();
            starterCode.setJavascript(str(sc.get("javascript"), getFallbackStarterJs()));
            starterCode.setPython(str(sc.get("python"), getFallbackStarterPy()));
            starterCode.setJava(str(sc.get("java"), getFallbackStarterJava()));
            starterCode.setCpp(str(sc.get("cpp"), getFallbackStarterCpp()));
            question.setStarterCode(starterCode);
        }

        return question;
    }

    // ================================================================
    // CODE EVALUATION
    // ================================================================
    public EvaluationResult evaluateCode(DSAQuestion question, String code, String language) {
        List<DSATestCase> executableCases = question.getTestCases().stream()
                .filter(tc -> tc.getStdin() != null)
                .toList();

        if (!executableCases.isEmpty()) {
            try {
                List<TestCaseResult> testCaseResults = runTestCases(code, language, question.getTestCases());
                long passed = testCaseResults.stream().filter(TestCaseResult::isPassed).count();
                int total = testCaseResults.size() > 0 ? testCaseResults.size() : 1;
                int score = (int) Math.round((double) passed / total * 100);

                boolean hasCompileErr = testCaseResults.stream().anyMatch(r -> "Compilation Error".equals(r.getStatus()));
                boolean hasTLE = testCaseResults.stream().anyMatch(r -> "Time Limit Exceeded".equals(r.getStatus()));
                boolean hasRTE = testCaseResults.stream().anyMatch(r -> r.getStatus() != null && r.getStatus().startsWith("Runtime"));

                String verdict = passed == total ? "Accepted"
                        : hasCompileErr ? "Compilation Error"
                        : hasTLE ? "Time Limit Exceeded"
                        : hasRTE ? "Runtime Error"
                        : "Wrong Answer";

                String feedback = getCodeFeedback(question, code, language, score, verdict, testCaseResults);

                EvaluationResult result = new EvaluationResult();
                result.setScore(score);
                result.setVerdict(verdict);
                result.setFeedback(feedback);
                result.setImprovements(new ArrayList<>());
                result.setTestCases(testCaseResults);
                return result;
            } catch (Exception e) {
                log.error("Code evaluation error, falling back to AI: {}", e.getMessage());
            }
        }

        return evaluateCodeWithAI(question, code, language);
    }

    private EvaluationResult evaluateCodeWithAI(DSAQuestion question, String code, String language) {
        String prompt = "You are a senior software engineer evaluating a candidate's code submission.\n\n" +
                "Problem: " + question.getTitle() + "\n" +
                "Description: " + question.getDescription() + "\n" +
                "Language: " + language + "\n" +
                "Code:\n```" + language + "\n" + code + "\n```\n\n" +
                "Return STRICT JSON only:\n" +
                "{\"score\": <0-100>, \"verdict\": \"<Accepted|Wrong Answer|Compilation Error|Time Limit Exceeded|Runtime Error>\", " +
                "\"feedback\": \"<one paragraph>\", \"improvements\": [\"suggestion 1\", \"suggestion 2\"]}\n\n" +
                "Scoring: 90-100 perfect, 70-89 correct but suboptimal, 50-69 partially correct, 0-49 wrong.";

        try {
            Map<String, Object> completion = chatComplete(
                    List.of(Map.of("role", "user", "content", prompt)), 0.2, 600);
            Map<String, Object> result = cleanAndParse(extractContent(completion));
            if (result == null) throw new RuntimeException("null result");

            EvaluationResult eval = new EvaluationResult();
            eval.setScore(result.get("score") instanceof Number n ? n.intValue() : 0);
            eval.setVerdict(str(result.get("verdict"), "Wrong Answer"));
            eval.setFeedback(str(result.get("feedback"), "Could not evaluate."));
            eval.setImprovements(strList(result.get("improvements")));
            return eval;
        } catch (Exception e) {
            log.error("AI code evaluation error: {}", e.getMessage());
            EvaluationResult fallback = new EvaluationResult();
            fallback.setScore(0);
            fallback.setVerdict("Wrong Answer");
            fallback.setFeedback("Could not evaluate. Please try again.");
            fallback.setImprovements(new ArrayList<>());
            return fallback;
        }
    }

    private String getCodeFeedback(DSAQuestion question, String code, String language,
                                    int score, String verdict, List<TestCaseResult> results) {
        List<TestCaseResult> failedCases = results.stream().filter(r -> !r.isPassed()).limit(2).toList();
        String failSummary = failedCases.isEmpty() ? "" :
                "Failed cases: " + failedCases.stream()
                        .map(r -> "input=\"" + r.getInput() + "\" expected=\"" + r.getExpectedOutput() + "\" got=\"" + r.getActualOutput() + "\"")
                        .reduce("", (a, b) -> a.isEmpty() ? b : a + "; " + b);

        String prompt = "Problem: " + question.getTitle() + "\n" +
                "Verdict: " + verdict + " (score " + score + "/100). " + failSummary + "\n" +
                "Language: " + language + "\n" +
                "Code (first 800 chars): " + code.substring(0, Math.min(code.length(), 800)) + "\n\n" +
                "Write 1-2 sentences of feedback for the candidate. Be specific and constructive. No markdown.";

        try {
            Map<String, Object> completion = chatCompleteText(
                    List.of(Map.of("role", "user", "content", prompt)), 0.3, 150);
            String text = extractContent(completion).trim();
            return text.isEmpty() ? (verdict.equals("Accepted") ? "Great solution!" : "Review your logic against the failing test cases.") : text;
        } catch (Exception e) {
            return verdict.equals("Accepted") ? "All test cases passed!" : "Check your solution against the failing test cases.";
        }
    }

    // ================================================================
    // VERBAL INTERVIEW RESPONSE
    // ================================================================
    public Map<String, Object> generateVerbalResponse(
            List<Map<String, Object>> history,
            String userMessage,
            String resumeContext,
            double timeRemainingSeconds,
            int tabSwitchCount) {

        if (mockAi) {
            return Map.of("text", "Hello! I'm Alex. Could you tell me about yourself?",
                    "action", "CONTINUE", "difficulty_level", "warmup");
        }

        long turnCount = history.stream().filter(m -> "user".equals(m.get("role"))).count();
        String timeWarning = timeRemainingSeconds < 120
                ? "\nSYSTEM: Only " + (int) Math.ceil(timeRemainingSeconds / 60) + " minute(s) remaining. Transition to coding soon."
                : "";
        String resumeSection = resumeContext != null && !resumeContext.isEmpty()
                ? "\nCANDIDATE RESUME:\n" + resumeContext.substring(0, Math.min(resumeContext.length(), 1200)) + "\n"
                : "";
        String tabWarning = tabSwitchCount >= 3
                ? "\nSYSTEM: TAB_SWITCH_COUNT = " + tabSwitchCount + ". TERMINATE the interview immediately."
                : "";

        String systemPrompt = """
You are Alex, a highly realistic technical interviewer from a top tech company. Behave exactly like a real human interviewer — professional, slightly strict. No emojis, no casual tone, no chatbot behavior.

INTERVIEW FLOW (STRICT — never expose phase names):
1. OPENING: Greet briefly, ask candidate to introduce themselves.
2. INTRO EVAL: Evaluate clarity, confidence, structure. Ask 1-2 follow-ups based only on what they said.
3. TRANSITION: Move naturally. "Alright, let's talk about your projects." Never announce phase changes.
4. RESUME/PROJECT DEEP DIVE: Ask strictly from their projects, skills, tech stack. Shallow answers — go deeper.
5. CORE TECHNICAL: Gradually shift to OS, DBMS, Computer Networks. Start medium, go hard.
6. PRESSURE: If silent too long — prompt once: "Are you there?" then move forward.
7. CODING TRANSITION: After sufficient questioning say naturally: "Alright, let's move to a coding problem."

ANTI-CHEATING: If TAB_SWITCH_COUNT >= 3, say EXACTLY: "The interview has been terminated due to multiple tab switches." Set action to TERMINATE.

RULES:
- Keep ALL responses to 2-3 sentences MAX
- Ask ONE question at a time, never two
- Sound human, not like an assistant""";

        String historyJson;
        try {
            List<Map<String, Object>> recentHistory = history.size() > 12 ? history.subList(history.size() - 12, history.size()) : history;
            historyJson = mapper.writeValueAsString(recentHistory);
        } catch (Exception e) {
            historyJson = "[]";
        }

        String userPrompt = resumeSection + tabWarning + timeWarning + "\n\n" +
                "Conversation so far (" + turnCount + " candidate turns):\n" + historyJson + "\n\n" +
                "Candidate just said: \"" + userMessage + "\"\n\n" +
                "Turn 0-2: warmup | Turn 3-5: easy | Turn 6-8: medium | Turn 9+: hard\n" +
                "Current turn: " + turnCount + "\n\n" +
                "Return STRICT JSON only:\n{\"text\":\"your 2-3 sentence response\",\"action\":\"CONTINUE\",\"difficulty_level\":\"warmup\"}";

        try {
            List<Map<String, String>> messages = List.of(
                    Map.of("role", "system", "content", systemPrompt),
                    Map.of("role", "user", "content", userPrompt)
            );
            Map<String, Object> completion = chatComplete(messages, 0.5, 500);
            Map<String, Object> result = cleanAndParse(extractContent(completion));
            if (result == null) return Map.of("text", "Could you repeat that?", "action", "CONTINUE", "difficulty_level", "easy");

            String dl = str(result.get("difficulty_level"), "easy");
            if (!List.of("warmup", "easy", "medium", "hard").contains(dl)) dl = "easy";
            return Map.of(
                    "text", str(result.get("text"), "I didn't catch that."),
                    "action", str(result.get("action"), "CONTINUE"),
                    "difficulty_level", dl
            );
        } catch (Exception e) {
            log.error("Verbal response error: {}", e.getMessage());
            return Map.of("text", "Could you please repeat that?", "action", "CONTINUE", "difficulty_level", "easy");
        }
    }

    // ================================================================
    // FINAL FEEDBACK REPORT
    // ================================================================
    public Map<String, Object> generateFinalFeedback(
            List<Map<String, Object>> chatHistory,
            Map<String, Object> codingResult) {

        if (mockAi) {
            return Map.of(
                    "score", 75,
                    "breakdown", Map.of("communication", 22, "technical", 30, "problem_solving", 23),
                    "feedback_summary", "Good overall performance. Strong communication and technical knowledge.",
                    "key_strengths", List.of("Clear communication", "Good problem-solving approach"),
                    "areas_for_improvement", List.of("Practice more DP problems", "Work on edge cases")
            );
        }

        List<Map<String, Object>> trimmed = chatHistory.size() > 20
                ? chatHistory.subList(chatHistory.size() - 20, chatHistory.size())
                : chatHistory;

        String historyText = trimmed.stream()
                .map(m -> ("user".equals(m.get("role")) ? "Candidate: " : "Interviewer: ") + m.get("content"))
                .reduce("", (a, b) -> a + "\n" + b);

        String codingText = codingResult != null
                ? "Score: " + codingResult.get("score") + "/100, Verdict: " + codingResult.get("verdict") + ", Feedback: " + codingResult.get("feedback")
                : "Candidate did not reach the coding round or no submission was made.";

        String prompt = "You are evaluating a completed technical interview.\n\n" +
                "=== VERBAL INTERVIEW TRANSCRIPT ===\n" + historyText + "\n\n" +
                "=== CODING RESULT ===\n" + codingText + "\n\n" +
                "=== SCORING RUBRIC ===\n" +
                "communication (0-30): Clarity, structure, confidence\n" +
                "technical (0-40): Depth of CS knowledge — OS, DBMS, algorithms, data structures\n" +
                "problem_solving (0-30): Coding score + logical approach\n\n" +
                "Return STRICT JSON only:\n" +
                "{\"score\":<0-100>,\"breakdown\":{\"communication\":<0-30>,\"technical\":<0-40>,\"problem_solving\":<0-30>}," +
                "\"feedback_summary\":\"2-3 sentence summary\",\"key_strengths\":[\"s1\",\"s2\",\"s3\"],\"areas_for_improvement\":[\"a1\",\"a2\"]}";

        try {
            Map<String, Object> completion = chatComplete(
                    List.of(Map.of("role", "user", "content", prompt)), 0.2, 1200);
            Map<String, Object> result = cleanAndParse(extractContent(completion));
            if (result == null || result.get("breakdown") == null) throw new RuntimeException("Invalid report format");

            @SuppressWarnings("unchecked")
            Map<String, Object> bd = (Map<String, Object>) result.get("breakdown");
            return Map.of(
                    "score", result.get("score") instanceof Number n ? n.intValue() : 0,
                    "breakdown", Map.of(
                            "communication", bd.get("communication") instanceof Number n ? n.intValue() : 0,
                            "technical", bd.get("technical") instanceof Number n ? n.intValue() : 0,
                            "problem_solving", bd.get("problem_solving") instanceof Number n ? n.intValue() : 0
                    ),
                    "feedback_summary", str(result.get("feedback_summary"), "No summary available."),
                    "key_strengths", strList(result.get("key_strengths")),
                    "areas_for_improvement", strList(result.get("areas_for_improvement"))
            );
        } catch (Exception e) {
            log.error("Final feedback error: {}", e.getMessage());
            return Map.of(
                    "score", 0,
                    "breakdown", Map.of("communication", 0, "technical", 0, "problem_solving", 0),
                    "feedback_summary", "Could not generate report due to an error.",
                    "key_strengths", List.of(),
                    "areas_for_improvement", List.of("System Error — Please try again")
            );
        }
    }

    // ================================================================
    // FALLBACK QUESTION (used when AI generation fails)
    // ================================================================
    private DSAQuestion buildFallbackQuestion(String difficulty) {
        DSAQuestion q = new DSAQuestion();
        q.setTitle("Two Sum");
        q.setDescription("Given an array of integers and a target, return the indices of the two numbers that add up to target.\n\nInput:\n- Line 1: n (array size)\n- Line 2: n space-separated integers\n- Line 3: target\n\nOutput: two space-separated 0-based indices");
        q.setDifficulty(difficulty);
        q.setConstraints(List.of("2 <= n <= 10^4", "Exactly one valid answer"));
        q.setFunctionSignature("int[] twoSum(int[] nums, int target)");

        DSATestCase tc1 = new DSATestCase();
        tc1.setInput("nums=[2,7,11,15], target=9");
        tc1.setOutput("[0,1]");
        tc1.setStdin("4\n2 7 11 15\n9");
        tc1.setExpectedOutput("0 1");

        DSATestCase tc2 = new DSATestCase();
        tc2.setInput("nums=[3,2,4], target=6");
        tc2.setOutput("[1,2]");
        tc2.setStdin("3\n3 2 4\n6");
        tc2.setExpectedOutput("1 2");

        q.setTestCases(List.of(tc1, tc2));
        q.setStarterCode(new StarterCode(getFallbackStarterJs(), getFallbackStarterPy(), getFallbackStarterJava(), getFallbackStarterCpp()));
        return q;
    }

    private String getFallbackStarterJs() {
        return "const lines = require('fs').readFileSync('/dev/stdin', 'utf8').trim().split('\\n');\nconst n = parseInt(lines[0]);\nconst nums = lines[1].split(' ').map(Number);\nconst target = parseInt(lines[2]);\n\nfunction twoSum(nums, target) {\n  // write your solution here\n}\n\nconsole.log(twoSum(nums, target).join(' '));";
    }

    private String getFallbackStarterPy() {
        return "import sys\nlines = sys.stdin.read().strip().split('\\n')\nn = int(lines[0])\nnums = list(map(int, lines[1].split()))\ntarget = int(lines[2])\n\ndef twoSum(nums, target):\n    # write your solution here\n    pass\n\nprint(' '.join(map(str, twoSum(nums, target))))";
    }

    private String getFallbackStarterJava() {
        return "import java.util.*;\nclass Main {\n    static int[] twoSum(int[] nums, int target) {\n        // write your solution here\n        return new int[]{};\n    }\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        int[] nums = new int[n];\n        for (int i = 0; i < n; i++) nums[i] = sc.nextInt();\n        int target = sc.nextInt();\n        int[] res = twoSum(nums, target);\n        StringBuilder sb = new StringBuilder();\n        for (int i = 0; i < res.length; i++) { if (i > 0) sb.append(' '); sb.append(res[i]); }\n        System.out.println(sb);\n    }\n}";
    }

    private String getFallbackStarterCpp() {
        return "#include<bits/stdc++.h>\nusing namespace std;\nvector<int> twoSum(vector<int>& nums, int target) {\n    // write your solution here\n    return {};\n}\nint main(){\n    int n; cin >> n;\n    vector<int> nums(n);\n    for (int& x : nums) cin >> x;\n    int target; cin >> target;\n    vector<int> res = twoSum(nums, target);\n    for (int i = 0; i < (int)res.size(); i++) { if(i) cout << ' '; cout << res[i]; }\n    cout << endl;\n    return 0;\n}";
    }
}
