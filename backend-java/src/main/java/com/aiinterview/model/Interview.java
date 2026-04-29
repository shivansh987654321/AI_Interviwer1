package com.aiinterview.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

// MongoDB document — mirrors the Mongoose Interview schema
@Document(collection = "interviews")
@CompoundIndex(def = "{'userId': 1, 'date': -1}")
public class Interview {

    @Id
    private String id;

    @Indexed
    private String userId;

    @Indexed(unique = true)
    private String sessionId;

    private Instant date = Instant.now();
    private int score;
    private String feedback;
    private List<Map<String, String>> verbatim = new ArrayList<>();
    private List<String> improvements = new ArrayList<>();
    private String verdict = "Pending";
    private String difficulty;
    private int questionsAttempted;
    private List<String> cheatingFlags = new ArrayList<>();
    private int tabSwitches;

    public Interview() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }

    public Instant getDate() { return date; }
    public void setDate(Instant date) { this.date = date; }

    public int getScore() { return score; }
    public void setScore(int score) { this.score = score; }

    public String getFeedback() { return feedback; }
    public void setFeedback(String feedback) { this.feedback = feedback; }

    public List<Map<String, String>> getVerbatim() { return verbatim; }
    public void setVerbatim(List<Map<String, String>> verbatim) { this.verbatim = verbatim; }

    public List<String> getImprovements() { return improvements; }
    public void setImprovements(List<String> improvements) { this.improvements = improvements; }

    public String getVerdict() { return verdict; }
    public void setVerdict(String verdict) { this.verdict = verdict; }

    public String getDifficulty() { return difficulty; }
    public void setDifficulty(String difficulty) { this.difficulty = difficulty; }

    public int getQuestionsAttempted() { return questionsAttempted; }
    public void setQuestionsAttempted(int questionsAttempted) { this.questionsAttempted = questionsAttempted; }

    public List<String> getCheatingFlags() { return cheatingFlags; }
    public void setCheatingFlags(List<String> cheatingFlags) { this.cheatingFlags = cheatingFlags; }

    public int getTabSwitches() { return tabSwitches; }
    public void setTabSwitches(int tabSwitches) { this.tabSwitches = tabSwitches; }
}
