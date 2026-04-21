package com.aiinterview.controller;

import com.aiinterview.dto.DSAQuestion;
import com.aiinterview.dto.EvaluationResult;
import com.aiinterview.service.AIService;
import com.aiinterview.service.SessionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("InterviewController Integration Tests")
class InterviewControllerTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;

    @MockBean AIService aiService;
    @MockBean SessionService sessionService;

    // ─── shared helpers ───────────────────────────────────────────────
    private static DSAQuestion sampleQuestion() {
        return DSAQuestion.builder()
                .title("Two Sum")
                .description("Return indices of two numbers that add to target.")
                .difficulty("medium")
                .constraints(List.of("2 <= n <= 10^4"))
                .testCases(List.of(new DSAQuestion.TestCase("[2,7,11,15], 9", "[0,1]")))
                .functionSignature("function twoSum(nums, target) {")
                .build();
    }

    private static EvaluationResult acceptedResult() {
        return EvaluationResult.builder()
                .score(85).verdict("Accepted")
                .feedback("Good solution.").improvements(List.of("Use HashMap")).build();
    }

    private static EvaluationResult failedResult() {
        return EvaluationResult.builder()
                .score(40).verdict("Wrong Answer")
                .feedback("Logic is incorrect.").improvements(List.of("Reconsider approach")).build();
    }

    // ─────────────────────────────────────────────────────────────────
    // HEALTH
    // ─────────────────────────────────────────────────────────────────
    @Nested @DisplayName("GET /api/interview/health")
    class Health {

        @Test @DisplayName("returns ok status")
        void ok() throws Exception {
            mvc.perform(get("/api/interview/health"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("ok"))
                    .andExpect(jsonPath("$.timestamp").exists());
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // CREATE
    // ─────────────────────────────────────────────────────────────────
    @Nested @DisplayName("POST /api/interview/create")
    class Create {

        @Test @DisplayName("creates session with valid body")
        void happyPath() throws Exception {
            DSAQuestion q = sampleQuestion();
            when(sessionService.generateQuestions(any(), eq("medium"), eq(3)))
                    .thenReturn(List.of(q, q, q));

            String body = mapper.writeValueAsString(Map.of(
                    "difficulty", "medium", "userId", "u1", "domain", "dsa"));

            mvc.perform(post("/api/interview/create")
                            .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.sessionId").isNotEmpty())
                    .andExpect(jsonPath("$.question.title").value("Two Sum"))
                    .andExpect(jsonPath("$.duration").isNumber())
                    .andExpect(jsonPath("$.executionEnabled").value(true))
                    .andExpect(jsonPath("$.supportedLanguages").isArray());
        }

        @Test @DisplayName("rejects invalid difficulty")
        void invalidDifficulty() throws Exception {
            String body = mapper.writeValueAsString(Map.of("difficulty", "extreme"));
            mvc.perform(post("/api/interview/create")
                            .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").exists());
        }

        @Test @DisplayName("defaults difficulty to medium when missing")
        void defaultsDifficulty() throws Exception {
            DSAQuestion q = sampleQuestion();
            when(sessionService.generateQuestions(any(), eq("medium"), eq(3)))
                    .thenReturn(List.of(q, q, q));

            mvc.perform(post("/api/interview/create")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{}"))
                    .andExpect(status().isCreated());
        }

        @Test @DisplayName("duration is 900 for easy")
        void easyDuration() throws Exception {
            DSAQuestion q = sampleQuestion();
            when(sessionService.generateQuestions(any(), eq("easy"), eq(3)))
                    .thenReturn(List.of(q, q, q));

            String body = mapper.writeValueAsString(Map.of("difficulty", "easy"));
            mvc.perform(post("/api/interview/create")
                            .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.duration").value(900));
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // SUBMIT
    // ─────────────────────────────────────────────────────────────────
    @Nested @DisplayName("POST /api/interview/submit")
    class Submit {

        @Test @DisplayName("returns 400 when required fields missing")
        void missingFields() throws Exception {
            String body = mapper.writeValueAsString(Map.of("code", "let x = 1;"));
            mvc.perform(post("/api/interview/submit")
                            .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").exists());
        }

        @Test @DisplayName("returns 404 when session not found")
        void sessionNotFound() throws Exception {
            when(sessionService.getSession(anyString())).thenReturn(java.util.Optional.empty());
            String body = mapper.writeValueAsString(Map.of(
                    "sessionId", "bad-id", "code", "x", "language", "javascript"));
            mvc.perform(post("/api/interview/submit")
                            .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isNotFound());
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // RUN
    // ─────────────────────────────────────────────────────────────────
    @Nested @DisplayName("POST /api/interview/run")
    class Run {

        @Test @DisplayName("returns 400 when required fields missing")
        void missingFields() throws Exception {
            String body = mapper.writeValueAsString(Map.of("code", "let x = 1;"));
            mvc.perform(post("/api/interview/run")
                            .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest());
        }

        @Test @DisplayName("returns 404 when session not found")
        void sessionNotFound() throws Exception {
            when(sessionService.getSession(anyString())).thenReturn(java.util.Optional.empty());
            String body = mapper.writeValueAsString(Map.of(
                    "sessionId", "bad-id", "code", "x", "language", "javascript"));
            mvc.perform(post("/api/interview/run")
                            .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isNotFound());
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // GET SESSION
    // ─────────────────────────────────────────────────────────────────
    @Nested @DisplayName("GET /api/interview/{sessionId}")
    class GetSession {

        @Test @DisplayName("returns 404 for unknown session")
        void notFound() throws Exception {
            when(sessionService.getSession("unknown")).thenReturn(java.util.Optional.empty());
            mvc.perform(get("/api/interview/unknown"))
                    .andExpect(status().isNotFound());
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // PARSE RESUME
    // ─────────────────────────────────────────────────────────────────
    @Nested @DisplayName("POST /api/interview/parse-resume")
    class ParseResume {

        @Test @DisplayName("returns 400 when no file uploaded")
        void noFile() throws Exception {
            mvc.perform(multipart("/api/interview/parse-resume"))
                    .andExpect(status().isBadRequest());
        }

        @Test @DisplayName("parses plain text file successfully")
        void parseTxt() throws Exception {
            byte[] content = "Java developer with 5 years experience.".getBytes();
            MockMultipartFile resumeFile = new MockMultipartFile(
                    "resume", "resume.txt", "text/plain", content);
            mvc.perform(multipart("/api/interview/parse-resume").file(resumeFile))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.text").value(containsString("Java developer")));
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // TTS
    // ─────────────────────────────────────────────────────────────────
    @Nested @DisplayName("POST /api/interview/tts")
    class Tts {

        @Test @DisplayName("returns 400 for empty text")
        void emptyText() throws Exception {
            String body = mapper.writeValueAsString(Map.of("text", ""));
            mvc.perform(post("/api/interview/tts")
                            .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest());
        }

        @Test @DisplayName("returns 400 when text missing")
        void missingText() throws Exception {
            mvc.perform(post("/api/interview/tts")
                            .contentType(MediaType.APPLICATION_JSON).content("{}"))
                    .andExpect(status().isBadRequest());
        }

        @Test @DisplayName("returns audio bytes for valid text")
        void validText() throws Exception {
            when(aiService.textToSpeech(anyString(), anyString())).thenReturn(new byte[]{1, 2, 3});
            String body = mapper.writeValueAsString(Map.of("text", "Hello world", "voice", "alloy"));
            mvc.perform(post("/api/interview/tts")
                            .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isOk())
                    .andExpect(header().string("Content-Type", "audio/mpeg"));
        }

        @Test @DisplayName("rejects text longer than 4096 chars")
        void tooLong() throws Exception {
            String longText = "a".repeat(4097);
            String body = mapper.writeValueAsString(Map.of("text", longText));
            mvc.perform(post("/api/interview/tts")
                            .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest());
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // COMPLETE SESSION
    // ─────────────────────────────────────────────────────────────────
    @Nested @DisplayName("POST /api/interview/complete/{sessionId}")
    class Complete {

        @Test @DisplayName("returns 404 for unknown session")
        void notFound() throws Exception {
            when(sessionService.getSession("xyz")).thenReturn(java.util.Optional.empty());
            mvc.perform(post("/api/interview/complete/xyz"))
                    .andExpect(status().isNotFound());
        }
    }
}
