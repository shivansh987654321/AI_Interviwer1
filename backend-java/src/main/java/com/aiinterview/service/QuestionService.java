package com.aiinterview.service;

import com.aiinterview.dto.DSAQuestion;
import com.aiinterview.dto.QuestionMeta;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;

// Mirrors question.service.ts — picks questions from the bank and delegates generation to AiService
@Service
public class QuestionService {

    private static final Logger log = LoggerFactory.getLogger(QuestionService.class);

    @Autowired
    private AiService aiService;

    // ─── EASY ─────────────────────────────────────────────────────────────────────
    private static final List<QuestionMeta> EASY_QUESTIONS = List.of(
            new QuestionMeta("Contains Duplicate", "Arrays & Hashing", "https://leetcode.com/problems/contains-duplicate/"),
            new QuestionMeta("Valid Anagram", "Arrays & Hashing", "https://leetcode.com/problems/valid-anagram/"),
            new QuestionMeta("Two Sum", "Arrays & Hashing", "https://leetcode.com/problems/two-sum/"),
            new QuestionMeta("Majority Element", "Arrays & Hashing", "https://leetcode.com/problems/majority-element/"),
            new QuestionMeta("Valid Palindrome", "Two Pointers", "https://leetcode.com/problems/valid-palindrome/"),
            new QuestionMeta("Best Time to Buy and Sell Stock", "Sliding Window", "https://leetcode.com/problems/best-time-to-buy-and-sell-stock/"),
            new QuestionMeta("Merge Sorted Array", "Two Pointers", "https://leetcode.com/problems/merge-sorted-array/"),
            new QuestionMeta("Valid Parentheses", "Stack", "https://leetcode.com/problems/valid-parentheses/"),
            new QuestionMeta("Binary Search", "Binary Search", "https://leetcode.com/problems/binary-search/"),
            new QuestionMeta("Reverse Linked List", "Linked List", "https://leetcode.com/problems/reverse-linked-list/"),
            new QuestionMeta("Linked List Cycle", "Linked List", "https://leetcode.com/problems/linked-list-cycle/"),
            new QuestionMeta("Merge Two Sorted Lists", "Linked List", "https://leetcode.com/problems/merge-two-sorted-lists/"),
            new QuestionMeta("Invert Binary Tree", "Trees", "https://leetcode.com/problems/invert-binary-tree/"),
            new QuestionMeta("Maximum Depth of Binary Tree", "Trees", "https://leetcode.com/problems/maximum-depth-of-binary-tree/"),
            new QuestionMeta("Balanced Binary Tree", "Trees", "https://leetcode.com/problems/balanced-binary-tree/"),
            new QuestionMeta("Climbing Stairs", "1-D Dynamic Programming", "https://leetcode.com/problems/climbing-stairs/"),
            new QuestionMeta("House Robber", "1-D Dynamic Programming", "https://leetcode.com/problems/house-robber/"),
            new QuestionMeta("Missing Number", "Bit Manipulation", "https://leetcode.com/problems/missing-number/"),
            new QuestionMeta("Single Number", "Bit Manipulation", "https://leetcode.com/problems/single-number/"),
            new QuestionMeta("Palindrome Number", "Math & Geometry", "https://leetcode.com/problems/palindrome-number/"),
            new QuestionMeta("Roman to Integer", "Math & Geometry", "https://leetcode.com/problems/roman-to-integer/"),
            new QuestionMeta("Fizz Buzz", "Math & Geometry", "https://leetcode.com/problems/fizz-buzz/")
    );

    // ─── MEDIUM ───────────────────────────────────────────────────────────────────
    private static final List<QuestionMeta> MEDIUM_QUESTIONS = List.of(
            new QuestionMeta("Group Anagrams", "Arrays & Hashing", "https://leetcode.com/problems/group-anagrams/"),
            new QuestionMeta("Top K Frequent Elements", "Arrays & Hashing", "https://leetcode.com/problems/top-k-frequent-elements/"),
            new QuestionMeta("Product of Array Except Self", "Arrays & Hashing", "https://leetcode.com/problems/product-of-array-except-self/"),
            new QuestionMeta("Longest Consecutive Sequence", "Arrays & Hashing", "https://leetcode.com/problems/longest-consecutive-sequence/"),
            new QuestionMeta("3Sum", "Two Pointers", "https://leetcode.com/problems/3sum/"),
            new QuestionMeta("Container With Most Water", "Two Pointers", "https://leetcode.com/problems/container-with-most-water/"),
            new QuestionMeta("Longest Substring Without Repeating Characters", "Sliding Window", "https://leetcode.com/problems/longest-substring-without-repeating-characters/"),
            new QuestionMeta("Min Stack", "Stack", "https://leetcode.com/problems/min-stack/"),
            new QuestionMeta("Daily Temperatures", "Stack", "https://leetcode.com/problems/daily-temperatures/"),
            new QuestionMeta("Binary Search in Rotated Sorted Array", "Binary Search", "https://leetcode.com/problems/search-in-rotated-sorted-array/"),
            new QuestionMeta("Koko Eating Bananas", "Binary Search", "https://leetcode.com/problems/koko-eating-bananas/"),
            new QuestionMeta("Add Two Numbers", "Linked List", "https://leetcode.com/problems/add-two-numbers/"),
            new QuestionMeta("LRU Cache", "Linked List", "https://leetcode.com/problems/lru-cache/"),
            new QuestionMeta("Binary Tree Level Order Traversal", "Trees", "https://leetcode.com/problems/binary-tree-level-order-traversal/"),
            new QuestionMeta("Validate Binary Search Tree", "Trees", "https://leetcode.com/problems/validate-binary-search-tree/"),
            new QuestionMeta("Lowest Common Ancestor of a BST", "Trees", "https://leetcode.com/problems/lowest-common-ancestor-of-a-binary-search-tree/"),
            new QuestionMeta("K Closest Points to Origin", "Heap / Priority Queue", "https://leetcode.com/problems/k-closest-points-to-origin/"),
            new QuestionMeta("Kth Largest Element in an Array", "Heap / Priority Queue", "https://leetcode.com/problems/kth-largest-element-in-an-array/"),
            new QuestionMeta("Number of Islands", "Graphs", "https://leetcode.com/problems/number-of-islands/"),
            new QuestionMeta("Clone Graph", "Graphs", "https://leetcode.com/problems/clone-graph/"),
            new QuestionMeta("Course Schedule", "Graphs", "https://leetcode.com/problems/course-schedule/"),
            new QuestionMeta("House Robber II", "1-D Dynamic Programming", "https://leetcode.com/problems/house-robber-ii/"),
            new QuestionMeta("Longest Palindromic Substring", "1-D Dynamic Programming", "https://leetcode.com/problems/longest-palindromic-substring/"),
            new QuestionMeta("Coin Change", "1-D Dynamic Programming", "https://leetcode.com/problems/coin-change/")
    );

    // ─── HARD ─────────────────────────────────────────────────────────────────────
    private static final List<QuestionMeta> HARD_QUESTIONS = List.of(
            new QuestionMeta("Trapping Rain Water", "Two Pointers", "https://leetcode.com/problems/trapping-rain-water/"),
            new QuestionMeta("Sliding Window Maximum", "Sliding Window", "https://leetcode.com/problems/sliding-window-maximum/"),
            new QuestionMeta("Largest Rectangle in Histogram", "Stack", "https://leetcode.com/problems/largest-rectangle-in-histogram/"),
            new QuestionMeta("Find Minimum in Rotated Sorted Array II", "Binary Search", "https://leetcode.com/problems/find-minimum-in-rotated-sorted-array-ii/"),
            new QuestionMeta("Reverse Nodes in k-Group", "Linked List", "https://leetcode.com/problems/reverse-nodes-in-k-group/"),
            new QuestionMeta("Binary Tree Maximum Path Sum", "Trees", "https://leetcode.com/problems/binary-tree-maximum-path-sum/"),
            new QuestionMeta("Serialize and Deserialize Binary Tree", "Trees", "https://leetcode.com/problems/serialize-and-deserialize-binary-tree/"),
            new QuestionMeta("Find Median from Data Stream", "Heap / Priority Queue", "https://leetcode.com/problems/find-median-from-data-stream/"),
            new QuestionMeta("Alien Dictionary", "Graphs", "https://leetcode.com/problems/alien-dictionary/"),
            new QuestionMeta("Word Ladder", "Graphs", "https://leetcode.com/problems/word-ladder/"),
            new QuestionMeta("Longest Increasing Subsequence", "1-D Dynamic Programming", "https://leetcode.com/problems/longest-increasing-subsequence/"),
            new QuestionMeta("Word Break II", "1-D Dynamic Programming", "https://leetcode.com/problems/word-break-ii/"),
            new QuestionMeta("Edit Distance", "2-D Dynamic Programming", "https://leetcode.com/problems/edit-distance/"),
            new QuestionMeta("Burst Balloons", "2-D Dynamic Programming", "https://leetcode.com/problems/burst-balloons/"),
            new QuestionMeta("N-Queens", "Backtracking", "https://leetcode.com/problems/n-queens/"),
            new QuestionMeta("Minimum Window Substring", "Sliding Window", "https://leetcode.com/problems/minimum-window-substring/")
    );

    private List<QuestionMeta> getPool(String difficulty) {
        return switch (difficulty.toLowerCase()) {
            case "easy"   -> EASY_QUESTIONS;
            case "hard"   -> HARD_QUESTIONS;
            default       -> MEDIUM_QUESTIONS;
        };
    }

    private List<QuestionMeta> pickRandom(String difficulty, int count) {
        List<QuestionMeta> pool = new ArrayList<>(getPool(difficulty));
        Collections.shuffle(pool);
        return pool.subList(0, Math.min(count, pool.size()));
    }

    // Generate `count` unique questions for the given difficulty level
    public List<DSAQuestion> generateQuestions(String difficulty, int count) {
        List<QuestionMeta> picked = pickRandom(difficulty, count * 2); // pick extras in case any fail
        Set<String> seen = new HashSet<>();
        List<DSAQuestion> results = new ArrayList<>();

        for (QuestionMeta meta : picked) {
            if (results.size() >= count) break;
            String key = meta.getTitle().toLowerCase().trim();
            if (seen.contains(key)) continue;
            seen.add(key);

            try {
                DSAQuestion q = aiService.generateDSAQuestion(difficulty, meta);
                results.add(q);
            } catch (Exception e) {
                log.warn("Failed to generate question '{}': {}", meta.getTitle(), e.getMessage());
            }
        }

        // Fill remaining slots if bank ran short
        while (results.size() < count) {
            try {
                results.add(aiService.generateDSAQuestion(difficulty, null));
            } catch (Exception e) {
                break;
            }
        }

        return results;
    }
}
