/**
 * MOCK AI SERVICE
 * ---------------
 * Activated when MOCK_AI=true in .env
 * Returns instant, static responses so you can develop and test
 * WITHOUT spending OpenAI API credits.
 *
 * Usage:
 *   MOCK_AI=true node dist/server.js
 *   — or —
 *   Add MOCK_AI=true to your backend/.env file while developing.
 */

import { DSAQuestion, EvaluationResult } from '../types/interview.types';

class MockAIService {
  // Minimum characters a submission must have to count as a real attempt
  private static readonly MIN_CODE_LENGTH = 10;
  // ----------------------------------------------------------------
  // PHASE 4: PROBLEM-SOLVING
  // ----------------------------------------------------------------
  async generateDSAQuestion(level: string): Promise<DSAQuestion> {
    const questions: Record<string, DSAQuestion> = {
      easy: {
        title: 'Two Sum [MOCK]',
        description:
          'Given an array of integers `nums` and an integer `target`, return the indices of the two numbers that add up to `target`.',
        difficulty: 'easy',
        constraints: ['2 <= nums.length <= 10^4', '-10^9 <= nums[i] <= 10^9', 'Only one valid answer exists.'],
        testCases: [
          { input: 'nums = [2,7,11,15], target = 9', output: '[0,1]' },
          { input: 'nums = [3,2,4], target = 6', output: '[1,2]' },
        ],
        functionSignature: 'function twoSum(nums, target) {',
      },
      medium: {
        title: 'Longest Substring Without Repeating Characters [MOCK]',
        description:
          'Given a string `s`, find the length of the longest substring without repeating characters.',
        difficulty: 'medium',
        constraints: ['0 <= s.length <= 5 * 10^4', 's consists of English letters, digits, symbols and spaces.'],
        testCases: [
          { input: 's = "abcabcbb"', output: '3' },
          { input: 's = "bbbbb"', output: '1' },
        ],
        functionSignature: 'function lengthOfLongestSubstring(s) {',
      },
      hard: {
        title: 'Trapping Rain Water [MOCK]',
        description:
          'Given `n` non-negative integers representing an elevation map where the width of each bar is 1, compute how much water it can trap after raining.',
        difficulty: 'hard',
        constraints: ['n == height.length', '1 <= n <= 2 * 10^4', '0 <= height[i] <= 10^5'],
        testCases: [
          { input: 'height = [0,1,0,2,1,0,1,3,2,1,2,1]', output: '6' },
          { input: 'height = [4,2,0,3,2,5]', output: '9' },
        ],
        functionSignature: 'function trap(height) {',
      },
    };
    return questions[level] ?? questions['medium'];
  }

  // ----------------------------------------------------------------
  // PHASE 5: CODE EVALUATION
  // ----------------------------------------------------------------
  async evaluateCode(_question: DSAQuestion, code: string, language: string): Promise<EvaluationResult> {
    // Treat any non-empty submission as "Accepted" in mock mode
    const hasCode = code.trim().length > MockAIService.MIN_CODE_LENGTH;
    return {
      score: hasCode ? 85 : 20,
      verdict: hasCode ? 'Accepted' : 'Wrong Answer',
      feedback: hasCode
        ? `[MOCK] Good attempt in ${language}! Your solution looks correct and handles the main test cases.`
        : '[MOCK] The submission appears to be empty or very short. Please write a real solution.',
      improvements: hasCode
        ? ['Consider edge cases with empty arrays', 'Add comments to explain your approach']
        : ['Write a complete solution before submitting'],
    };
  }

  // ----------------------------------------------------------------
  // PHASE 1-3: VERBAL CONVERSATION
  // ----------------------------------------------------------------
  async generateVerbalResponse(
    history: { role: string; content: string }[],
    _userMessage: string,
  ): Promise<{ text: string; action?: string }> {
    const turn = history.length;
    if (turn === 0) {
      return {
        text: "[MOCK] Hello! I'm your AI interviewer. Can you explain what a hash map is and when you would use one?",
        action: 'CONTINUE',
      };
    }
    if (turn <= 2) {
      return {
        text: '[MOCK] Great answer! One follow-up: what is the time complexity of a lookup in a hash map?',
        action: 'CONTINUE',
      };
    }
    return {
      text: "[MOCK] Excellent! You've demonstrated solid understanding of data structures. Let's move on to the coding challenge.",
      action: 'START_CODING',
    };
  }

  // ----------------------------------------------------------------
  // PHASE 6: FINAL EVALUATION (Report Card)
  // ----------------------------------------------------------------
  async generateFinalFeedback(
    _chatHistory: { role: string; content: string }[],
    _codingResult: any,
  ): Promise<any> {
    return {
      score: 78,
      breakdown: {
        communication: 25,
        technical: 30,
        problem_solving: 23,
      },
      feedback_summary:
        '[MOCK] The candidate demonstrated solid understanding of core data structures and communicated clearly throughout the interview.',
      key_strengths: ['Clear communication', 'Good problem-solving approach', 'Correct time complexity analysis'],
      areas_for_improvement: ['Practice more edge cases', 'Improve code readability with comments'],
    };
  }

  // ----------------------------------------------------------------
  // REPORT SERVICE: INTERVIEW FEEDBACK
  // ----------------------------------------------------------------
  async generateInterviewFeedback(
    _scores: { score: number; verdict: string; feedback?: string }[],
  ): Promise<{ strengths: string[]; weaknesses: string[]; recommendations: string[] }> {
    return {
      strengths: ['[MOCK] Good algorithmic thinking', '[MOCK] Clean code structure'],
      weaknesses: ['[MOCK] Edge case handling could be improved'],
      recommendations: ['[MOCK] Practice LeetCode medium problems', '[MOCK] Review dynamic programming patterns'],
    };
  }
}

export default new MockAIService();
