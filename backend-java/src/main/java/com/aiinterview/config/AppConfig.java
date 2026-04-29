package com.aiinterview.config;

import com.corundumstudio.socketio.Configuration;
import com.corundumstudio.socketio.SocketIOServer;
import okhttp3.OkHttpClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;

import java.util.concurrent.TimeUnit;

@org.springframework.context.annotation.Configuration
public class AppConfig {

    @Value("${socketio.port:5002}")
    private int socketioPort;

    @Value("${frontend.url:http://localhost:3000}")
    private String frontendUrl;

    // OkHttpClient — used by AiService to call OpenAI / Groq / ElevenLabs
    @Bean
    public OkHttpClient okHttpClient() {
        return new OkHttpClient.Builder()
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(60, TimeUnit.SECONDS)
                .writeTimeout(30, TimeUnit.SECONDS)
                .build();
    }

    // SocketIOServer — replaces the socket.io npm package
    // Runs on a separate port (default 5002) so it doesn't conflict with Tomcat (5001)
    @Bean
    public SocketIOServer socketIOServer() {
        Configuration config = new Configuration();
        config.setPort(socketioPort);
        config.setHostname("0.0.0.0");

        // Allow all origins for Socket.io (CORS handled at HTTP level by WebConfig)
        config.setOrigin("*");

        // Allow both polling and websocket transports (same as the Node.js config)
        config.setPingTimeout(60000);
        config.setPingInterval(25000);

        return new SocketIOServer(config);
    }
}
