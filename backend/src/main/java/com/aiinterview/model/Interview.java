package com.aiinterview.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "interviews")
@CompoundIndex(name = "userId_date_idx", def = "{'userId': 1, 'date': -1}")
public class Interview {

    @Id
    private String id;

    @Indexed
    private String userId;

    @Indexed(unique = true)
    private String sessionId;

    private Instant date;

    private int score;

    private String feedback;

    // Transcript: [{role, content}, ...]
    private List<Map<String, String>> verbatim;

    private List<String> improvements;

    @Builder.Default
    private String verdict = "Pending";

    // "easy" | "medium" | "hard"
    private String difficulty;

    @Builder.Default
    private int questionsAttempted = 0;

    private List<String> cheatingFlags;

    @Builder.Default
    private int tabSwitches = 0;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
