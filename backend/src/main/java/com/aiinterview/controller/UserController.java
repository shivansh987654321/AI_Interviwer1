package com.aiinterview.controller;

import com.aiinterview.dto.SessionRecord;
import com.aiinterview.model.Interview;
import com.aiinterview.repository.InterviewRepository;
import com.aiinterview.service.SessionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
public class UserController {

    private final SessionService sessionService;

    @Autowired(required = false)
    private InterviewRepository interviewRepository;

    // ===========================================================================
    // GET /api/user/{userId}/stats
    // Returns aggregate stats for the dashboard:
    //  total, avgScore, bestScore, streak, domainBreakdown,
    //  avgBreakdown, recentInterviews, scoreOverTime
    // ===========================================================================
    @GetMapping("/{userId}/stats")
    public ResponseEntity<?> getUserStats(@PathVariable String userId) {
        if (userId == null || userId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "userId required"));
        }
        try {
            List<InterviewSummary> all = collectSummaries(userId);

            if (all.isEmpty()) {
                return ResponseEntity.ok(emptyStats());
            }

            // Core metrics
            int total     = all.size();
            double avg    = all.stream().mapToInt(s -> s.score).average().orElse(0);
            int avgScore  = (int) Math.round(avg);
            int bestScore = all.stream().mapToInt(s -> s.score).max().orElse(0);

            // Streaks — count consecutive days ending today
            int currentStreak = computeStreak(all, false);
            int longestStreak = computeStreak(all, true);

            // Domain breakdown
            Map<String, List<InterviewSummary>> byDomain = all.stream()
                    .collect(Collectors.groupingBy(s -> s.domain != null ? s.domain : "dsa"));

            Map<String, Map<String, Object>> domainBreakdown = new LinkedHashMap<>();
            byDomain.forEach((domain, items) -> {
                int dAvg = (int) Math.round(items.stream().mapToInt(s -> s.score).average().orElse(0));
                domainBreakdown.put(domain, Map.of("count", items.size(), "avgScore", dAvg));
            });

            // Average skill breakdown (from score entries if available)
            Map<String, Object> avgBreakdown = computeAvgBreakdown(all);

            // Recent 5
            List<Map<String, Object>> recent = all.stream()
                    .sorted(Comparator.comparing((InterviewSummary s) -> s.date).reversed())
                    .limit(5)
                    .map(s -> {
                        Map<String, Object> m = new LinkedHashMap<>();
                        m.put("sessionId", s.sessionId);
                        m.put("date",      s.date);
                        m.put("score",     s.score);
                        m.put("verdict",   s.verdict);
                        m.put("domain",    s.domain != null ? s.domain : "dsa");
                        m.put("feedback",  s.feedback != null ? s.feedback : "");
                        return m;
                    })
                    .collect(Collectors.toList());

            // Score over time (all, oldest-first)
            List<Map<String, Object>> scoreOverTime = all.stream()
                    .sorted(Comparator.comparing(s -> s.date))
                    .map(s -> {
                        Map<String, Object> m = new LinkedHashMap<>();
                        m.put("date",   s.date);
                        m.put("score",  s.score);
                        m.put("domain", s.domain != null ? s.domain : "dsa");
                        return m;
                    })
                    .collect(Collectors.toList());

            Map<String, Object> stats = new LinkedHashMap<>();
            stats.put("total",           total);
            stats.put("avgScore",        avgScore);
            stats.put("bestScore",       bestScore);
            stats.put("currentStreak",   currentStreak);
            stats.put("longestStreak",   longestStreak);
            stats.put("domainBreakdown", domainBreakdown);
            stats.put("avgBreakdown",    avgBreakdown);
            stats.put("recentInterviews", recent);
            stats.put("scoreOverTime",   scoreOverTime);
            return ResponseEntity.ok(stats);

        } catch (Exception e) {
            log.error("[STATS] Error for user {}: {}", userId, e.getMessage());
            return ResponseEntity.ok(emptyStats());
        }
    }

    // ================================================================
    // HELPERS
    // ================================================================

    private List<InterviewSummary> collectSummaries(String userId) {
        List<InterviewSummary> summaries = new ArrayList<>();

        // 1. From MongoDB (persisted completed interviews)
        if (interviewRepository != null) {
            try {
                List<Interview> interviews = interviewRepository.findByUserIdOrderByDateDesc(userId);
                for (Interview iv : interviews) {
                    summaries.add(new InterviewSummary(
                            iv.getSessionId(),
                            iv.getScore(),
                            iv.getVerdict(),
                            iv.getFeedback(),
                            iv.getDifficulty(),
                            null,
                            iv.getDate() != null ? iv.getDate().toString() : Instant.now().toString()
                    ));
                }
                return summaries;
            } catch (Exception e) {
                log.warn("[STATS] MongoDB unavailable, falling back to session file: {}", e.getMessage());
            }
        }

        // 2. Fallback: from in-memory / file-backed session store
        sessionService.getAllSessions().values().stream()
                .filter(s -> userId.equals(s.getUserId()) && "completed".equals(s.getStatus()))
                .forEach(s -> {
                    List<Object> scores = s.getScoresSafe();
                    if (!scores.isEmpty()) {
                        // Use the last score entry
                        Object last = scores.get(scores.size() - 1);
                        if (last instanceof Map<?, ?> m) {
                            int score   = m.get("score")   instanceof Number n ? n.intValue() : 0;
                            String verdict  = m.get("verdict")  instanceof String v ? v : "Unknown";
                            String feedback = m.get("feedback") instanceof String f ? f : "";
                            summaries.add(new InterviewSummary(
                                    s.getId(), score, verdict, feedback,
                                    s.getDifficulty(), s.getDomain(),
                                    s.getCompletedAt() != null ? s.getCompletedAt().toString()
                                            : s.getCreatedAt() != null ? s.getCreatedAt().toString()
                                            : Instant.now().toString()
                            ));
                        }
                    }
                });

        return summaries;
    }

    private Map<String, Object> emptyStats() {
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("total", 0);
        s.put("avgScore", 0);
        s.put("bestScore", 0);
        s.put("currentStreak", 0);
        s.put("longestStreak", 0);
        s.put("domainBreakdown", Map.of());
        s.put("avgBreakdown", null);
        s.put("recentInterviews", List.of());
        s.put("scoreOverTime", List.of());
        return s;
    }

    private int computeStreak(List<InterviewSummary> all, boolean longest) {
        Set<LocalDate> interviewDays = all.stream()
                .map(s -> {
                    try {
                        return Instant.parse(s.date).atZone(ZoneId.systemDefault()).toLocalDate();
                    } catch (Exception e) {
                        return LocalDate.now();
                    }
                })
                .collect(Collectors.toSet());

        if (longest) {
            // Find longest consecutive streak
            List<LocalDate> sorted = new ArrayList<>(interviewDays);
            Collections.sort(sorted);
            int max = 0, cur = 0;
            LocalDate prev = null;
            for (LocalDate d : sorted) {
                if (prev != null && d.equals(prev.plusDays(1))) {
                    cur++;
                } else {
                    cur = 1;
                }
                if (cur > max) max = cur;
                prev = d;
            }
            return max;
        } else {
            // Current streak ending today or yesterday
            int streak = 0;
            LocalDate check = LocalDate.now();
            while (interviewDays.contains(check)) {
                streak++;
                check = check.minusDays(1);
            }
            return streak;
        }
    }

    private Map<String, Object> computeAvgBreakdown(List<InterviewSummary> all) {
        // Rough approximation: communication 30%, technical 40%, problem-solving 30%
        if (all.isEmpty()) return null;
        double avg = all.stream().mapToInt(s -> s.score).average().orElse(0);
        return Map.of(
                "communication",       (int) Math.round(avg * 0.30),
                "technical_knowledge", (int) Math.round(avg * 0.40),
                "problem_solving",     (int) Math.round(avg * 0.30)
        );
    }

    private record InterviewSummary(
            String sessionId, int score, String verdict, String feedback,
            String difficulty, String domain, String date
    ) {}
}
