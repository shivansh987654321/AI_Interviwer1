package com.aiinterview.dto;

// A single test case for a DSA problem.
// "input" and "output" are human-readable display values.
// "stdin" and "expectedOutput" are the actual values used for code execution.
public class DSATestCase {
    private String input;
    private String output;
    private String stdin;
    private String expectedOutput;

    public DSATestCase() {}

    public String getInput() { return input; }
    public void setInput(String input) { this.input = input; }

    public String getOutput() { return output; }
    public void setOutput(String output) { this.output = output; }

    public String getStdin() { return stdin; }
    public void setStdin(String stdin) { this.stdin = stdin; }

    public String getExpectedOutput() { return expectedOutput; }
    public void setExpectedOutput(String expectedOutput) { this.expectedOutput = expectedOutput; }
}
