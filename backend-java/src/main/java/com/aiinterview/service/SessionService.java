package com.aiinterview.service;

import com.aiinterview.dto.SessionRecord;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.locks.ReentrantLock;

// File-based session store — replaces sessions.json logic in interview.routes.ts
// Thread-safe: uses a ReentrantLock so concurrent HTTP requests don't corrupt sessions.json
@Service
public class SessionService {

    private static final Logger log = LoggerFactory.getLogger(SessionService.class);

    @Value("${session.ttl.hours:24}")
    private long sessionTtlHours;

    private final ObjectMapper mapper;
    private final ReentrantLock writeLock = new ReentrantLock();

    public SessionService() {
        this.mapper = new ObjectMapper();
        this.mapper.registerModule(new JavaTimeModule());
    }

    private File getSessionFile() {
        String env = System.getenv("NODE_ENV");
        if ("production".equals(env)) {
            return new File(System.getProperty("java.io.tmpdir"), "sessions.json");
        }
        // In development, put sessions.json in the project working directory
        return new File("sessions.json");
    }

    // Read all sessions from file (auto-purges expired ones)
    public Map<String, SessionRecord> getSessions() {
        File file = getSessionFile();
        try {
            if (!file.exists()) {
                return new HashMap<>();
            }
            String raw = Files.readString(file.toPath()).trim();
            if (raw.isEmpty() || raw.equals("{}")) {
                return new HashMap<>();
            }
            Map<String, SessionRecord> sessions = mapper.readValue(raw,
                    new TypeReference<Map<String, SessionRecord>>() {});

            // Auto-cleanup expired sessions (same TTL logic as TypeScript)
            long ttlMs = sessionTtlHours * 60 * 60 * 1000;
            long now = Instant.now().toEpochMilli();
            boolean purged = false;
            for (var entry : new HashMap<>(sessions).entrySet()) {
                SessionRecord s = entry.getValue();
                Instant created = s.getCreatedAt() != null ? s.getCreatedAt() : s.getStartTime();
                if (created != null && now - created.toEpochMilli() > ttlMs) {
                    sessions.remove(entry.getKey());
                    purged = true;
                }
            }
            if (purged) {
                writeToFile(sessions);
                log.info("[Sessions] Purged stale sessions");
            }
            return sessions;
        } catch (IOException e) {
            log.error("[Sessions] Read failed: {}", e.getMessage());
            return new HashMap<>();
        }
    }

    // Save one session atomically (write to .tmp then rename — safe on macOS/Linux)
    public void saveSession(SessionRecord session) {
        writeLock.lock();
        try {
            Map<String, SessionRecord> sessions = getSessions();
            sessions.put(session.getId(), session);
            writeToFile(sessions);
        } finally {
            writeLock.unlock();
        }
    }

    // Get a single session by ID
    public SessionRecord getSession(String sessionId) {
        return getSessions().get(sessionId);
    }

    private void writeToFile(Map<String, SessionRecord> sessions) {
        File sessionFile = getSessionFile();
        File tmpFile = new File(sessionFile.getParent(), "sessions.json.tmp");
        try {
            mapper.writerWithDefaultPrettyPrinter().writeValue(tmpFile, sessions);
            Files.move(tmpFile.toPath(), sessionFile.toPath(), StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            log.error("[Sessions] Write failed: {}", e.getMessage());
        }
    }
}
