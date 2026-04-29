package com.aiinterview.dto;

import java.util.ArrayList;
import java.util.List;

// Result returned after a candidate submits their code solution
public class EvaluationResult {
    private int score;
    private String verdict;   // Accepted | Wrong Answer | Compilation Error | Time Limit Exceeded | Runtime Error
    private String feedback;
    private List<String> improvements = new ArrayList<>();
    private List<TestCaseResult> testCases;

    public EvaluationResult() {}

    public int getScore() { return score; }
    public void setScore(int score) { this.score = score; }

    public String getVerdict() { return verdict; }
    public void setVerdict(String verdict) { this.verdict = verdict; }

    public String getFeedback() { return feedback; }
    public void setFeedback(String feedback) { this.feedback = feedback; }

    public List<String> getImprovements() { return improvements; }
    public void setImprovements(List<String> improvements) { this.improvements = improvements; }

    public List<TestCaseResult> getTestCases() { return testCases; }
    public void setTestCases(List<TestCaseResult> testCases) { this.testCases = testCases; }
}
