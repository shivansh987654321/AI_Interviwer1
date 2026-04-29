package com.aiinterview;

import com.aiinterview.socket.InterviewSocketHandler;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.ApplicationContext;

@SpringBootApplication
public class AiInterviewApplication {

    public static void main(String[] args) {
        ApplicationContext ctx = SpringApplication.run(AiInterviewApplication.class, args);

        // Start the Socket.io server (runs on its own port, separate from Tomcat)
        InterviewSocketHandler socketHandler = ctx.getBean(InterviewSocketHandler.class);
        socketHandler.start();
    }
}
