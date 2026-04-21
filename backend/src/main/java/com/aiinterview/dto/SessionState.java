package com.aiinterview.dto;

import lombok.Builder;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * In-memory state for one active Socket.IO interview session.
 * Lives in the ConcurrentHashMap inside InterviewSocketHandler.
 */
@Data
@Builder
public class SessionState {

    private List<VerbalMessage> history;

    // "intro" | "verbal" | "coding"
    private String phase;

    private Map<String, Object> codingResult;

    private String resumeContext;

    private Long verbalStartTime;        // System.currentTimeMillis()

    private long verbalDurationMs;

    // "warmup" | "easy" | "medium" | "hard"
    private String difficultyLevel;

    private List<String> cheatingFlags;

    private int tabSwitchCount;

    private int faceAbsenceCount;

    private String userId;

    public List<VerbalMessage> getHistorySafe() {
        if (history == null) history = new ArrayList<>();
        return history;
    }

    public List<String> getCheatingFlagsSafe() {
        if (cheatingFlags == null) cheatingFlags = new ArrayList<>();
        return cheatingFlags;
    }
}
