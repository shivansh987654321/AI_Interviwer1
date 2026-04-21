package com.aiinterview.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class DSAQuestion {
    private String title;
    private String description;
    private String difficulty;
    private List<String> constraints;
    private List<TestCase> testCases;
    private String functionSignature;
    private boolean isFallback;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class TestCase {
        private String input;
        private String output;
    }
}
