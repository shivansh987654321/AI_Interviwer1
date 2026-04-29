package com.aiinterview.dto;

import java.util.ArrayList;
import java.util.List;

// Represents a DSA interview question — mirrors the TypeScript DSAQuestion interface
public class DSAQuestion {
    private String title;
    private String description;
    private String difficulty;
    private List<String> constraints = new ArrayList<>();
    private List<DSATestCase> testCases = new ArrayList<>();
    private String functionSignature;
    private StarterCode starterCode;

    public DSAQuestion() {}

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getDifficulty() { return difficulty; }
    public void setDifficulty(String difficulty) { this.difficulty = difficulty; }

    public List<String> getConstraints() { return constraints; }
    public void setConstraints(List<String> constraints) { this.constraints = constraints; }

    public List<DSATestCase> getTestCases() { return testCases; }
    public void setTestCases(List<DSATestCase> testCases) { this.testCases = testCases; }

    public String getFunctionSignature() { return functionSignature; }
    public void setFunctionSignature(String functionSignature) { this.functionSignature = functionSignature; }

    public StarterCode getStarterCode() { return starterCode; }
    public void setStarterCode(StarterCode starterCode) { this.starterCode = starterCode; }
}
