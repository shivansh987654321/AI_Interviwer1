package com.aiinterview.config;

import com.aiinterview.service.AIService;
import com.aiinterview.service.MockAIService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

@Slf4j
@Configuration
public class AIServiceConfig {

    @Value("${ai.mock:false}")
    private boolean mockMode;

    /**
     * Registers either the real AIService or MockAIService depending on MOCK_AI env var.
     * MockAIService extends AIService so all injection points work with no changes.
     */
    @Bean
    @Primary
    public AIService aiService(ObjectMapper objectMapper) {
        if (mockMode) {
            log.warn("🟡 MOCK_AI mode enabled — all AI calls return static responses (no API cost).");
            return new MockAIService();
        }
        log.info("🟢 Real AI mode enabled.");
        return new AIService(objectMapper);
    }
}
