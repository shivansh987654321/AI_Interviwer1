package com.aiinterview.controller;

import com.aiinterview.model.Interview;
import com.aiinterview.repository.InterviewRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

// Mirrors user.routes.ts — user stats endpoint
@RestController
@RequestMapping("/api/user")
public class UserController {

    private static final Logger log = LoggerFactory.getLogger(UserController.class);

    @Autowired(required = false)
    private InterviewRepository interviewRepository;

    // GET /api/user/:userId/stats
    @GetMapping("/{userId}/stats")
    public ResponseEntity<?> getStats(@PathVariable String userId) {
        if (userId == null || userId.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "userId required"));
        }

        if (interviewRepository == null) {
            return ResponseEntity.ok(emptyStats());
        }

        try {
            List<Interview> interviews = interviewRepository.findByUserIdOrderByDateDesc(userId);
            int total = interviews.size();

            if (total == 0) {
                return ResponseEntity.ok(emptyStats());
            }

            int avgScore = (int) Math.round(interviews.stream().mapToInt(Interview::getScore).average().orElse(0));
            int bestScore = interviews.stream().mapToInt(Interview::getScore).max().orElse(0);

            // Unique interview days (newest first)
            List<String> uniqueDates = interviews.stream()
                    .map(i -> {
                        java.time.LocalDate d = i.getDate().atZone(java.time.ZoneId.systemDefault()).toLocalDate();
                        return d.toString();
                    })
                    .distinct()
                    .sorted(Comparator.reverseOrder())
                    .collect(Collectors.toList());

            String today = Instant.now().atZone(java.time.ZoneId.systemDefault()).toLocalDate().toString();
            String yesterday = Instant.now().minus(1, ChronoUnit.DAYS)
                    .atZone(java.time.ZoneId.systemDefault()).toLocalDate().toString();

            // Current streak
            int currentStreak = 0;
            if (!uniqueDates.isEmpty() && (uniqueDates.get(0).equals(today) || uniqueDates.get(0).equals(yesterday))) {
                currentStreak = 1;
                for (int i = 1; i < uniqueDates.size(); i++) {
                    java.time.LocalDate prev = java.time.LocalDate.parse(uniqueDates.get(i - 1));
                    java.time.LocalDate curr = java.time.LocalDate.parse(uniqueDates.get(i));
                    if (ChronoUnit.DAYS.between(curr, prev) == 1) {
                        currentStreak++;
                    } else {
                        break;
                    }
                }
            }

            // Longest streak
            List<String> ascDates = new ArrayList<>(uniqueDates);
            Collections.reverse(ascDates);
            int longestStreak = ascDates.isEmpty() ? 0 : 1;
            int tempStreak = 1;
            for (int i = 1; i < ascDates.size(); i++) {
                java.time.LocalDate prev = java.time.LocalDate.parse(ascDates.get(i - 1));
                java.time.LocalDate curr = java.time.LocalDate.parse(ascDates.get(i));
                if (ChronoUnit.DAYS.between(prev, curr) == 1) {
                    tempStreak++;
                    longestStreak = Math.max(longestStreak, tempStreak);
                } else {
                    tempStreak = 1;
                }
            }

            // Recent interviews (last 5)
            List<Map<String, Object>> recentInterviews = interviews.stream().limit(5).map(i -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("sessionId", i.getSessionId());
                m.put("date", i.getDate().toString());
                m.put("score", i.getScore());
                m.put("verdict", i.getVerdict());
                m.put("domain", i.getDifficulty() != null ? i.getDifficulty() : "dsa");
                m.put("feedback", i.getFeedback() != null
                        ? i.getFeedback().substring(0, Math.min(i.getFeedback().length(), 120)) : "");
                return m;
            }).collect(Collectors.toList());

            // Build score over time from the actual interviews list reversed (oldest first)
            List<Interview> chronological = new ArrayList<>(interviews);
            Collections.reverse(chronological);
            List<Map<String, Object>> scoreOverTimeList = chronological.stream().map(i -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("date", i.getDate().toString());
                m.put("score", i.getScore());
                m.put("domain", i.getDifficulty() != null ? i.getDifficulty() : "dsa");
                return m;
            }).collect(Collectors.toList());

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("total", total);
            response.put("avgScore", avgScore);
            response.put("bestScore", bestScore);
            response.put("currentStreak", currentStreak);
            response.put("longestStreak", longestStreak);
            response.put("domainBreakdown", Map.of());
            response.put("avgBreakdown", null);
            response.put("recentInterviews", recentInterviews);
            response.put("scoreOverTime", scoreOverTimeList);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("[USER STATS] Error: {}", e.getMessage());
            return ResponseEntity.status(500).body(Map.of("error", "Failed to fetch stats"));
        }
    }

    private Map<String, Object> emptyStats() {
        return Map.of(
                "total", 0, "avgScore", 0, "bestScore", 0,
                "currentStreak", 0, "longestStreak", 0,
                "domainBreakdown", Map.of(), "avgBreakdown", null,
                "recentInterviews", List.of(), "scoreOverTime", List.of()
        );
    }
}
