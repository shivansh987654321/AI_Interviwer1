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
public class EvaluationResult {

    private int score;

    // Accepted | Wrong Answer | Compilation Error | Time Limit Exceeded | Runtime Error
    private String verdict;

    private String feedback;

    private List<String> improvements;
}
