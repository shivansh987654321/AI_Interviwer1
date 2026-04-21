package com.aiinterview.service;

import com.aiinterview.dto.DSAQuestion;
import com.aiinterview.dto.SessionRecord;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.stream.Collectors;

/**
 * File-backed session store — mirrors the Node.js sessions.json approach.
 * Writes sessions to sessions.json next to the jar, with TTL-based cleanup.
 * All methods are synchronized to be thread-safe.
 */
@Slf4j
@Service
public class SessionService {

    @Value("${session.ttl-hours:24}")
    private int ttlHours;

    private final ObjectMapper mapper;

    // In-memory write-through cache — avoids repeated disk reads
    private final Map<String, SessionRecord> cache = new ConcurrentHashMap<>();
    private boolean cacheLoaded = false;

    private static final Path SESSION_FILE = Paths.get("sessions.json");

    public SessionService(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    // ================================================================
    // READ ALL SESSIONS (loads file on first call, then uses cache)
    // ================================================================
    public synchronized Map<String, SessionRecord> getAllSessions() {
        if (!cacheLoaded) {
            loadFromFile();
            cacheLoaded = true;
        }
        purgeStale();
        return Collections.unmodifiableMap(cache);
    }

    public synchronized Optional<SessionRecord> getSession(String id) {
        getAllSessions(); // ensure loaded
        return Optional.ofNullable(cache.get(id));
    }

    // ================================================================
    // SAVE / UPDATE
    // ================================================================
    public synchronized void saveSession(SessionRecord session) {
        getAllSessions(); // ensure loaded
        cache.put(session.getId(), session);
        persistToFile();
    }

    // ================================================================
    // GENERATE QUESTIONS — parallel generation + deduplication by title
    // Mirrors Node.js QuestionService: generates all in parallel then
    // re-generates any duplicate title until we have `count` unique questions.
    // ================================================================
    public List<DSAQuestion> generateQuestions(AIService aiService, String difficulty, int count) {
        ExecutorService pool = Executors.newFixedThreadPool(count);
        try {
            // Generate all in parallel
            List<CompletableFuture<DSAQuestion>> futures = new ArrayList<>();
            for (int i = 0; i < count; i++) {
                futures.add(CompletableFuture.supplyAsync(
                        () -> aiService.generateDSAQuestion(difficulty), pool));
            }
            List<DSAQuestion> raw = futures.stream()
                    .map(f -> { try { return f.get(); } catch (Exception e) { return aiService.generateDSAQuestion(difficulty); } })
                    .collect(java.util.stream.Collectors.toList());

            // Deduplicate by title (same logic as Node.js version)
            Set<String> seen = new LinkedHashSet<>();
            List<DSAQuestion> deduped = new ArrayList<>();
            for (DSAQuestion q : raw) {
                String key = q.getTitle().toLowerCase().trim();
                if (seen.contains(key)) {
                    try {
                        DSAQuestion replacement = aiService.generateDSAQuestion(difficulty);
                        deduped.add(replacement);
                        seen.add(replacement.getTitle().toLowerCase().trim());
                    } catch (Exception e) {
                        deduped.add(q);
                    }
                } else {
                    seen.add(key);
                    deduped.add(q);
                }
            }
            return deduped;
        } finally {
            pool.shutdown();
        }
    }

    // ================================================================
    // FILE I/O
    // ================================================================
    private void loadFromFile() {
        try {
            File file = SESSION_FILE.toFile();
            if (!file.exists()) {
                Files.writeString(SESSION_FILE, "{}");
                return;
            }
            String raw = Files.readString(SESSION_FILE).trim();
            if (raw.isBlank() || raw.equals("{}")) return;

            Map<String, SessionRecord> loaded = mapper.readValue(raw, new TypeReference<>() {});
            cache.putAll(loaded);
            log.info("[Sessions] Loaded {} sessions from disk", cache.size());
        } catch (Exception e) {
            log.error("[Sessions] Load failed: {}", e.getMessage());
        }
    }

    private void persistToFile() {
        try {
            Files.writeString(SESSION_FILE, mapper.writerWithDefaultPrettyPrinter().writeValueAsString(cache));
        } catch (Exception e) {
            log.error("[Sessions] Save failed: {}", e.getMessage());
        }
    }

    private void purgeStale() {
        long ttlMs = (long) ttlHours * 60 * 60 * 1000;
        long now = Instant.now().toEpochMilli();
        boolean purged = false;

        Iterator<Map.Entry<String, SessionRecord>> it = cache.entrySet().iterator();
        while (it.hasNext()) {
            SessionRecord s = it.next().getValue();
            Instant created = s.getCreatedAt() != null ? s.getCreatedAt() : s.getStartTime();
            if (created != null && now - created.toEpochMilli() > ttlMs) {
                it.remove();
                purged = true;
            }
        }
        if (purged) {
            persistToFile();
            log.info("[Sessions] Purged stale sessions");
        }
    }
}
