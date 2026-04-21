package com.aiinterview.service;

import com.aiinterview.dto.DSAQuestion;
import com.aiinterview.dto.EvaluationResult;
import com.aiinterview.dto.VerbalMessage;
import lombok.extern.slf4j.Slf4j;

import java.util.Base64;
import java.util.List;
import java.util.Map;

/**
 * MockAIService — activated when MOCK_AI=true in .env
 * Returns instant, static responses so you can develop and test
 * WITHOUT spending any API credits.
 *
 * Java port of Node.js mock.ai.service.ts
 */
@Slf4j
public class MockAIService extends AIService {

    private static final int MIN_CODE_LENGTH = 10;

    public MockAIService() {
        super(null); // ObjectMapper not needed — no real HTTP calls
    }

    // ----------------------------------------------------------------
    // TTS — returns a valid 1-second silent MP3 buffer
    // ----------------------------------------------------------------
    @Override
    public byte[] textToSpeech(String text, String voice) {
        // Valid minimal MP3: ID3 tag + silent frame (same as Node.js mock)
        String silentMp3B64 =
            "SUQzAwAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICA" +
            "gICAgICAgICAgICAgICAgICA//////////////////////////////////////////////////////////////////8A" +
            "AAAATGF2YzU4LjU0AAAAAAAAAAAAAAAAJAAAAAAAAAAAAnHCMt8AAAAAAAAAAAAAAAAAAA==";
        try {
            return Base64.getDecoder().decode(silentMp3B64.replaceAll("\\s", ""));
        } catch (Exception e) {
            return new byte[0];
        }
    }

    // ----------------------------------------------------------------
    // STT — returns a canned transcription
    // ----------------------------------------------------------------
    @Override
    public String speechToText(byte[] audioBytes, String mimeType) {
        return "[MOCK] I think the time complexity of a hash map lookup is O(1) on average.";
    }

    // ----------------------------------------------------------------
    // DSA QUESTION — returns a specific question per difficulty level
    // ----------------------------------------------------------------
    @Override
    public DSAQuestion generateDSAQuestion(String level) {
        return switch (level) {
            case "easy" -> DSAQuestion.builder()
                .title("Two Sum [MOCK]")
                .description("Given an array of integers `nums` and an integer `target`, return the indices of the two numbers that add up to `target`.")
                .difficulty("easy")
                .constraints(List.of("2 <= nums.length <= 10^4", "-10^9 <= nums[i] <= 10^9", "Only one valid answer exists."))
                .testCases(List.of(
                    new DSAQuestion.TestCase("nums = [2,7,11,15], target = 9", "[0,1]"),
                    new DSAQuestion.TestCase("nums = [3,2,4], target = 6", "[1,2]")))
                .functionSignature("function twoSum(nums, target) {")
                .build();

            case "hard" -> DSAQuestion.builder()
                .title("Trapping Rain Water [MOCK]")
                .description("Given `n` non-negative integers representing an elevation map where the width of each bar is 1, compute how much water it can trap after raining.")
                .difficulty("hard")
                .constraints(List.of("n == height.length", "1 <= n <= 2 * 10^4", "0 <= height[i] <= 10^5"))
                .testCases(List.of(
                    new DSAQuestion.TestCase("height = [0,1,0,2,1,0,1,3,2,1,2,1]", "6"),
                    new DSAQuestion.TestCase("height = [4,2,0,3,2,5]", "9")))
                .functionSignature("function trap(height) {")
                .build();

            default -> DSAQuestion.builder() // medium
                .title("Longest Substring Without Repeating Characters [MOCK]")
                .description("Given a string `s`, find the length of the longest substring without repeating characters.")
                .difficulty("medium")
                .constraints(List.of("0 <= s.length <= 5 * 10^4", "s consists of English letters, digits, symbols and spaces."))
                .testCases(List.of(
                    new DSAQuestion.TestCase("s = \"abcabcbb\"", "3"),
                    new DSAQuestion.TestCase("s = \"bbbbb\"", "1")))
                .functionSignature("function lengthOfLongestSubstring(s) {")
                .build();
        };
    }

    // ----------------------------------------------------------------
    // CODE EVALUATION — accepts any non-trivial submission
    // ----------------------------------------------------------------
    @Override
    public EvaluationResult evaluateCode(DSAQuestion question, String code, String language) {
        boolean hasCode = code != null && code.trim().length() > MIN_CODE_LENGTH;
        return EvaluationResult.builder()
            .score(hasCode ? 85 : 20)
            .verdict(hasCode ? "Accepted" : "Wrong Answer")
            .feedback(hasCode
                ? "[MOCK] Good attempt in " + language + "! Your solution looks correct and handles the main test cases."
                : "[MOCK] The submission appears empty or very short. Please write a real solution.")
            .improvements(hasCode
                ? List.of("Consider edge cases with empty arrays", "Add comments to explain your approach")
                : List.of("Write a complete solution before submitting"))
            .build();
    }

    // ----------------------------------------------------------------
    // VERBAL INTERVIEW — staged responses based on turn count
    // ----------------------------------------------------------------
    @Override
    public VerbalResponse generateVerbalResponse(
            List<VerbalMessage> history,
            String userMessage,
            String resumeContext,
            Double timeRemainingSeconds,
            Integer tabSwitchCount) {

        int turn = history == null ? 0 : (int) history.stream()
                .filter(h -> "user".equals(h.getRole())).count();

        if (turn == 0) {
            return new VerbalResponse(
                "[MOCK] Hello! I'm your AI interviewer. Can you explain what a hash map is and when you would use one?",
                "CONTINUE", "warmup"
            );
        }
        if (turn <= 2) {
            return new VerbalResponse(
                "[MOCK] Great answer! One follow-up: what is the time complexity of a lookup in a hash map?",
                "CONTINUE", "easy"
            );
        }
        return new VerbalResponse(
            "[MOCK] Excellent! You've demonstrated solid understanding of data structures. Let's move on to the coding challenge.",
            "START_CODING", "medium"
        );
    }

    // ----------------------------------------------------------------
    // FINAL REPORT — fixed mock scores
    // ----------------------------------------------------------------
    @Override
    public FinalFeedback generateFinalFeedback(
            List<VerbalMessage> chatHistory,
            Map<String, Object> codingResult) {
        return new FinalFeedback(
            78,
            new FinalFeedback.Breakdown(25, 30, 23),
            "[MOCK] The candidate demonstrated solid understanding of core data structures and communicated clearly throughout the interview.",
            List.of("Clear communication", "Good problem-solving approach", "Correct time complexity analysis"),
            List.of("Practice more edge cases", "Improve code readability with comments")
        );
    }
}
