package com.aiinterview;

import io.github.cdimascio.dotenv.Dotenv;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.mongodb.config.EnableMongoAuditing;

@Slf4j
@SpringBootApplication
@EnableMongoAuditing
public class AiInterviewApplication {

    public static void main(String[] args) {
        // Load .env file into System properties BEFORE Spring starts
        // so that application.properties ${VAR} placeholders resolve correctly.
        loadDotEnv();

        SpringApplication app = new SpringApplication(AiInterviewApplication.class);
        app.run(args);

        printBanner();
    }

    private static void loadDotEnv() {
        try {
            Dotenv dotenv = Dotenv.configure()
                    .ignoreIfMissing()   // no crash if .env absent (CI / prod containers)
                    .systemProperties()  // push into System.setProperty so Spring reads them
                    .load();

            // Log which AI provider is active (no key values — just presence)
            System.out.println("------------------------------------------------");
            System.out.println("🚀 STARTING AI INTERVIEW SERVER (Java / Spring Boot)");
            System.out.println("🔑 OPENAI_API_KEY:    " + (present(dotenv, "OPENAI_API_KEY")    ? "✅ LOADED" : "❌ NOT SET"));
            System.out.println("🔑 GROQ_API_KEY:      " + (present(dotenv, "GROQ_API_KEY")      ? "✅ LOADED" : "❌ NOT SET"));
            System.out.println("🎙️ ELEVENLABS_API_KEY:" + (present(dotenv, "ELEVENLABS_API_KEY") ? "✅ LOADED" : "⚠️  NOT SET (TTS fallback active)"));
            System.out.println("🗄️ MONGODB_URI:       " + (present(dotenv, "MONGODB_URI")       ? "✅ CONFIGURED" : "⚠️  NOT SET (no history persistence)"));
            System.out.println("------------------------------------------------");

            if (!present(dotenv, "OPENAI_API_KEY") && !present(dotenv, "GROQ_API_KEY")) {
                System.err.println("❌ No AI key found! Set OPENAI_API_KEY or GROQ_API_KEY in backend/.env");
            }
        } catch (Exception e) {
            System.err.println("⚠️  .env load warning: " + e.getMessage());
        }
    }

    private static boolean present(Dotenv dotenv, String key) {
        try {
            String val = dotenv.get(key);
            return val != null && val.length() > 10 && !val.startsWith("your_");
        } catch (Exception e) {
            return false;
        }
    }

    private static void printBanner() {
        log.info("✅ REST API  → http://localhost:{}/api/interview",
                System.getProperty("PORT", "5001"));
        log.info("✅ Socket.IO → http://localhost:{}/  (Socket.IO port)",
                System.getProperty("SOCKET_PORT", "5002"));
        log.info("✅ Health    → http://localhost:{}/health",
                System.getProperty("PORT", "5001"));
    }
}
