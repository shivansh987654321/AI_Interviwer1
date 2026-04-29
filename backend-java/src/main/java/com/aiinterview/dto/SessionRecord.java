package com.aiinterview.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

// In-memory and file-persisted interview session — mirrors the TypeScript SessionRecord interface
@JsonIgnoreProperties(ignoreUnknown = true)
public class SessionRecord {
    private String id;
    private String difficulty;
    private Instant startTime;
    private List<DSAQuestion> questions = new ArrayList<>();
    private int currentQuestionIndex;
    private DSAQuestion question;
    private List<Object> scores = new ArrayList<>();
    private String status;     // "active" | "completed"
    private int duration;      // seconds
    private Instant createdAt;
    private String userId;
    private Instant completedAt;

    public SessionRecord() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getDifficulty() { return difficulty; }
    public void setDifficulty(String difficulty) { this.difficulty = difficulty; }

    public Instant getStartTime() { return startTime; }
    public void setStartTime(Instant startTime) { this.startTime = startTime; }

    public List<DSAQuestion> getQuestions() { return questions; }
    public void setQuestions(List<DSAQuestion> questions) { this.questions = questions; }

    public int getCurrentQuestionIndex() { return currentQuestionIndex; }
    public void setCurrentQuestionIndex(int currentQuestionIndex) { this.currentQuestionIndex = currentQuestionIndex; }

    public DSAQuestion getQuestion() { return question; }
    public void setQuestion(DSAQuestion question) { this.question = question; }

    public List<Object> getScores() { return scores; }
    public void setScores(List<Object> scores) { this.scores = scores; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public int getDuration() { return duration; }
    public void setDuration(int duration) { this.duration = duration; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public Instant getCompletedAt() { return completedAt; }
    public void setCompletedAt(Instant completedAt) { this.completedAt = completedAt; }
}
