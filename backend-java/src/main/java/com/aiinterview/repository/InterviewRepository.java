package com.aiinterview.repository;

import com.aiinterview.model.Interview;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

// Spring Data MongoDB — replaces Mongoose model queries
@Repository
public interface InterviewRepository extends MongoRepository<Interview, String> {

    Optional<Interview> findBySessionId(String sessionId);

    // For history endpoint: sorted by date descending
    List<Interview> findByUserIdOrderByDateDesc(String userId);
}
