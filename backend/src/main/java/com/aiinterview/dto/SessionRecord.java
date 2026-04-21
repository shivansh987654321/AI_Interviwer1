package com.aiinterview.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class SessionRecord {

    private String id;
    private String difficulty;
    private Instant startTime;
    private List<DSAQuestion> questions;
    private int currentQuestionIndex;
    private DSAQuestion question;
    private List<Object> scores;
    private String status;
    private int duration;
    private Instant createdAt;
    private String userId;
    private Instant completedAt;

    public static int getDurationForDifficulty(String difficulty) {
        return switch (difficulty) {
            case "easy" -> 900;
            case "hard" -> 2700;
            default -> 1800;
        };
    }

    public List<Object> getScoresSafe() {
        if (scores == null) scores = new ArrayList<>();
        return scores;
    }
}
