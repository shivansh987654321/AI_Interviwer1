package com.aiinterview.dto;

// Metadata for a question from the question bank (title, topic, LeetCode URL)
public class QuestionMeta {
    private final String title;
    private final String topic;
    private final String url;

    public QuestionMeta(String title, String topic, String url) {
        this.title = title;
        this.topic = topic;
        this.url = url;
    }

    public String getTitle() { return title; }
    public String getTopic() { return topic; }
    public String getUrl() { return url; }
}
