package com.aiinterview.config;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

// Conditionally connect to MongoDB — gracefully skips if MONGODB_URI is not set.
// Matches the Node.js backend's behaviour: file-based sessions work without a DB.
@Configuration
@EnableMongoRepositories(basePackages = "com.aiinterview.repository")
public class MongoConfig {

    private static final Logger log = LoggerFactory.getLogger(MongoConfig.class);

    @Value("${spring.data.mongodb.uri:}")
    private String mongoUri;

    @Bean
    public MongoClient mongoClient() {
        if (mongoUri == null || mongoUri.isEmpty()) {
            log.warn("⚠️  MONGODB_URI is not set. Database features will be unavailable. File-based session storage will be used.");
            // Return a client pointed at localhost (will fail silently if not running)
            return MongoClients.create("mongodb://localhost:27017");
        }
        log.info("🗄️  Connecting to MongoDB...");
        return MongoClients.create(mongoUri);
    }

    @Bean
    public MongoTemplate mongoTemplate() {
        return new MongoTemplate(mongoClient(), "ai-interview");
    }
}
