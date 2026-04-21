package com.aiinterview.config;

import com.corundumstudio.socketio.SocketIOServer;
import com.corundumstudio.socketio.Transport;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SocketIOConfig {

    @Value("${socketio.port:5002}")
    private int socketPort;

    @Value("${socketio.hostname:0.0.0.0}")
    private String hostname;

    @Value("${cors.allowed-origins:http://localhost:3000}")
    private String allowedOriginsRaw;

    /**
     * netty-socketio server bean.
     * Runs on SOCKET_PORT (default 5002) — separate from Spring Boot's REST port (5001).
     * The frontend must set NEXT_PUBLIC_SOCKET_URL=http://localhost:5002
     */
    @Bean
    public SocketIOServer socketIOServer() {
        com.corundumstudio.socketio.Configuration config =
                new com.corundumstudio.socketio.Configuration();

        config.setHostname(hostname);
        config.setPort(socketPort);

        // Allow the same origins as REST CORS
        config.setOrigin(allowedOriginsRaw);

        // Support both polling (initial handshake) and WebSocket (upgrade)
        // — same as Node.js: transports: ['polling', 'websocket']
        config.setTransports(Transport.POLLING, Transport.WEBSOCKET);

        // Increase ping/pong timeouts for slow AI calls
        config.setPingTimeout(60_000);
        config.setPingInterval(25_000);

        return new SocketIOServer(config);
    }
}
