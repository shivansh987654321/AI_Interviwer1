package com.aiinterview.filter;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Rate limiting filter — mirrors express-rate-limit from Node.js version:
 *   Global:  200 requests per 15 minutes per IP on /api/*
 *   AI paths: 20 requests per minute per IP on TTS / STT / CREATE
 */
@Component
@Order(1)
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Set<String> AI_PATHS = Set.of(
            "/api/interview/tts",
            "/api/interview/stt",
            "/api/interview/create"
    );

    // Per-IP bucket caches
    private final Map<String, Bucket> globalBuckets = new ConcurrentHashMap<>();
    private final Map<String, Bucket> aiBuckets     = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {

        String path = request.getRequestURI();
        String ip   = resolveIp(request);

        // Only rate-limit /api/* paths
        if (path.startsWith("/api/")) {
            Bucket globalBucket = globalBuckets.computeIfAbsent(ip, k ->
                    Bucket.builder()
                            .addLimit(Bandwidth.classic(200, Refill.greedy(200, Duration.ofMinutes(15))))
                            .build()
            );
            if (!globalBucket.tryConsume(1)) {
                sendRateLimitResponse(response, "Too many requests, please try again later.");
                return;
            }
        }

        if (AI_PATHS.contains(path)) {
            Bucket aiBucket = aiBuckets.computeIfAbsent(ip, k ->
                    Bucket.builder()
                            .addLimit(Bandwidth.classic(20, Refill.greedy(20, Duration.ofMinutes(1))))
                            .build()
            );
            if (!aiBucket.tryConsume(1)) {
                sendRateLimitResponse(response, "AI endpoint rate limit exceeded. Please slow down.");
                return;
            }
        }

        chain.doFilter(request, response);
    }

    private String resolveIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private void sendRateLimitResponse(HttpServletResponse response, String message) throws IOException {
        response.setStatus(429);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write("{\"error\":\"" + message + "\"}");
    }
}
