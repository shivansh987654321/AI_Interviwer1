package com.aiinterview.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

@RestController
public class HealthController {

    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of(
                "status", "ok",
                "server", "Java Spring Boot",
                "timestamp", Instant.now().toString()
        );
    }

    // Probes which language runtimes are installed on this server.
    // Frontend calls this once on load to disable unavailable language buttons.
    @GetMapping("/health/langs")
    public Map<String, Boolean> langs() {
        return Map.of(
                "javascript", probe("node --version"),
                "python",     probe("python3 --version"),
                "java",       probe("javac -version"),
                "cpp",        probe("g++ --version")
        );
    }

    private boolean probe(String command) {
        try {
            Process p = Runtime.getRuntime().exec(command.split(" "));
            p.waitFor();
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
