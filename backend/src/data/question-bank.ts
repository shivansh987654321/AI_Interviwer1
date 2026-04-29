/**
 * Question bank sourced from NeetCode 150+ list.
 * Problems are organized by difficulty tier.
 * Each entry has: title, topic, and leetcode URL.
 * The AI service uses this list to select a specific named problem
 * and then generates its description, test cases, and starter code.
 */

export interface QuestionMeta {
  title: string;
  topic: string;
  url: string;
}

// ─── EASY ─────────────────────────────────────────────────────────────────────
export const EASY_QUESTIONS: QuestionMeta[] = [
  { title: 'Contains Duplicate', topic: 'Arrays & Hashing', url: 'https://leetcode.com/problems/contains-duplicate/' },
  { title: 'Valid Anagram', topic: 'Arrays & Hashing', url: 'https://leetcode.com/problems/valid-anagram/' },
  { title: 'Two Sum', topic: 'Arrays & Hashing', url: 'https://leetcode.com/problems/two-sum/' },
  { title: 'Majority Element', topic: 'Arrays & Hashing', url: 'https://leetcode.com/problems/majority-element/' },
  { title: 'Valid Palindrome', topic: 'Two Pointers', url: 'https://leetcode.com/problems/valid-palindrome/' },
  { title: 'Best Time to Buy and Sell Stock', topic: 'Sliding Window', url: 'https://leetcode.com/problems/best-time-to-buy-and-sell-stock/' },
  { title: 'Merge Sorted Array', topic: 'Two Pointers', url: 'https://leetcode.com/problems/merge-sorted-array/' },
  { title: 'Valid Parentheses', topic: 'Stack', url: 'https://leetcode.com/problems/valid-parentheses/' },
  { title: 'Binary Search', topic: 'Binary Search', url: 'https://leetcode.com/problems/binary-search/' },
  { title: 'Search Insert Position', topic: 'Binary Search', url: 'https://leetcode.com/problems/search-insert-position/' },
  { title: 'Reverse Linked List', topic: 'Linked List', url: 'https://leetcode.com/problems/reverse-linked-list/' },
  { title: 'Linked List Cycle', topic: 'Linked List', url: 'https://leetcode.com/problems/linked-list-cycle/' },
  { title: 'Merge Two Sorted Lists', topic: 'Linked List', url: 'https://leetcode.com/problems/merge-two-sorted-lists/' },
  { title: 'Palindrome Linked List', topic: 'Linked List', url: 'https://leetcode.com/problems/palindrome-linked-list/' },
  { title: 'Invert Binary Tree', topic: 'Trees', url: 'https://leetcode.com/problems/invert-binary-tree/' },
  { title: 'Maximum Depth of Binary Tree', topic: 'Trees', url: 'https://leetcode.com/problems/maximum-depth-of-binary-tree/' },
  { title: 'Diameter of Binary Tree', topic: 'Trees', url: 'https://leetcode.com/problems/diameter-of-binary-tree/' },
  { title: 'Balanced Binary Tree', topic: 'Trees', url: 'https://leetcode.com/problems/balanced-binary-tree/' },
  { title: 'Same Tree', topic: 'Trees', url: 'https://leetcode.com/problems/same-tree/' },
  { title: 'Subtree of Another Tree', topic: 'Trees', url: 'https://leetcode.com/problems/subtree-of-another-tree/' },
  { title: 'Symmetric Tree', topic: 'Trees', url: 'https://leetcode.com/problems/symmetric-tree/' },
  { title: 'Last Stone Weight', topic: 'Heap / Priority Queue', url: 'https://leetcode.com/problems/last-stone-weight/' },
  { title: 'Kth Largest Element in a Stream', topic: 'Heap / Priority Queue', url: 'https://leetcode.com/problems/kth-largest-element-in-a-stream/' },
  { title: 'Number of Islands', topic: 'Graphs', url: 'https://leetcode.com/problems/number-of-islands/' },
  { title: 'Flood Fill', topic: 'Graphs', url: 'https://leetcode.com/problems/flood-fill/' },
  { title: 'Climbing Stairs', topic: '1-D Dynamic Programming', url: 'https://leetcode.com/problems/climbing-stairs/' },
  { title: 'Min Cost Climbing Stairs', topic: '1-D Dynamic Programming', url: 'https://leetcode.com/problems/min-cost-climbing-stairs/' },
  { title: 'House Robber', topic: '1-D Dynamic Programming', url: 'https://leetcode.com/problems/house-robber/' },
  { title: 'Number of 1 Bits', topic: 'Bit Manipulation', url: 'https://leetcode.com/problems/number-of-1-bits/' },
  { title: 'Counting Bits', topic: 'Bit Manipulation', url: 'https://leetcode.com/problems/counting-bits/' },
  { title: 'Reverse Bits', topic: 'Bit Manipulation', url: 'https://leetcode.com/problems/reverse-bits/' },
  { title: 'Missing Number', topic: 'Bit Manipulation', url: 'https://leetcode.com/problems/missing-number/' },
  { title: 'Single Number', topic: 'Bit Manipulation', url: 'https://leetcode.com/problems/single-number/' },
  { title: 'Palindrome Number', topic: 'Math & Geometry', url: 'https://leetcode.com/problems/palindrome-number/' },
  { title: 'Plus One', topic: 'Math & Geometry', url: 'https://leetcode.com/problems/plus-one/' },
  { title: 'Power of Two', topic: 'Math & Geometry', url: 'https://leetcode.com/problems/power-of-two/' },
  { title: 'Roman to Integer', topic: 'Math & Geometry', url: 'https://leetcode.com/problems/roman-to-integer/' },
  { title: 'Fizz Buzz', topic: 'Math & Geometry', url: 'https://leetcode.com/problems/fizz-buzz/' },
];

// ─── MEDIUM ───────────────────────────────────────────────────────────────────
export const MEDIUM_QUESTIONS: QuestionMeta[] = [
  // Arrays & Hashing
  { title: 'Group Anagrams', topic: 'Arrays & Hashing', url: 'https://leetcode.com/problems/group-anagrams/' },
  { title: 'Top K Frequent Elements', topic: 'Arrays & Hashing', url: 'https://leetcode.com/problems/top-k-frequent-elements/' },
  { title: 'Encode and Decode Strings', topic: 'Arrays & Hashing', url: 'https://leetcode.com/problems/encode-and-decode-strings/' },
  { title: 'Product of Array Except Self', topic: 'Arrays & Hashing', url: 'https://leetcode.com/problems/product-of-array-except-self/' },
  { title: 'Longest Consecutive Sequence', topic: 'Arrays & Hashing', url: 'https://leetcode.com/problems/longest-consecutive-sequence/' },
  // Two Pointers
  { title: '3Sum', topic: 'Two Pointers', url: 'https://leetcode.com/problems/3sum/' },
  { title: 'Container With Most Water', topic: 'Two Pointers', url: 'https://leetcode.com/problems/container-with-most-water/' },
  { title: 'Two Sum II - Input Array Is Sorted', topic: 'Two Pointers', url: 'https://leetcode.com/problems/two-sum-ii-input-array-is-sorted/' },
  // Sliding Window
  { title: 'Longest Substring Without Repeating Characters', topic: 'Sliding Window', url: 'https://leetcode.com/problems/longest-substring-without-repeating-characters/' },
  { title: 'Longest Repeating Character Replacement', topic: 'Sliding Window', url: 'https://leetcode.com/problems/longest-repeating-character-replacement/' },
  { title: 'Permutation in String', topic: 'Sliding Window', url: 'https://leetcode.com/problems/permutation-in-string/' },
  // Stack
  { title: 'Min Stack', topic: 'Stack', url: 'https://leetcode.com/problems/min-stack/' },
  { title: 'Evaluate Reverse Polish Notation', topic: 'Stack', url: 'https://leetcode.com/problems/evaluate-reverse-polish-notation/' },
  { title: 'Generate Parentheses', topic: 'Stack', url: 'https://leetcode.com/problems/generate-parentheses/' },
  { title: 'Daily Temperatures', topic: 'Stack', url: 'https://leetcode.com/problems/daily-temperatures/' },
  { title: 'Car Fleet', topic: 'Stack', url: 'https://leetcode.com/problems/car-fleet/' },
  // Binary Search
  { title: 'Koko Eating Bananas', topic: 'Binary Search', url: 'https://leetcode.com/problems/koko-eating-bananas/' },
  { title: 'Find Minimum in Rotated Sorted Array', topic: 'Binary Search', url: 'https://leetcode.com/problems/find-minimum-in-rotated-sorted-array/' },
  { title: 'Search in Rotated Sorted Array', topic: 'Binary Search', url: 'https://leetcode.com/problems/search-in-rotated-sorted-array/' },
  // Linked List
  { title: 'Add Two Numbers', topic: 'Linked List', url: 'https://leetcode.com/problems/add-two-numbers/' },
  { title: 'Remove Nth Node From End of List', topic: 'Linked List', url: 'https://leetcode.com/problems/remove-nth-node-from-end-of-list/' },
  { title: 'Copy List with Random Pointer', topic: 'Linked List', url: 'https://leetcode.com/problems/copy-list-with-random-pointer/' },
  { title: 'LRU Cache', topic: 'Linked List', url: 'https://leetcode.com/problems/lru-cache/' },
  { title: 'Reorder List', topic: 'Linked List', url: 'https://leetcode.com/problems/reorder-list/' },
  { title: 'Find the Duplicate Number', topic: 'Arrays & Hashing', url: 'https://leetcode.com/problems/find-the-duplicate-number/' },
  // Trees
  { title: 'Level Order Traversal of Binary Tree', topic: 'Trees', url: 'https://leetcode.com/problems/binary-tree-level-order-traversal/' },
  { title: 'Binary Tree Right Side View', topic: 'Trees', url: 'https://leetcode.com/problems/binary-tree-right-side-view/' },
  { title: 'Count Good Nodes in Binary Tree', topic: 'Trees', url: 'https://leetcode.com/problems/count-good-nodes-in-binary-tree/' },
  { title: 'Validate Binary Search Tree', topic: 'Trees', url: 'https://leetcode.com/problems/validate-binary-search-tree/' },
  { title: 'Kth Smallest Element in a BST', topic: 'Trees', url: 'https://leetcode.com/problems/kth-smallest-element-in-a-bst/' },
  { title: 'Lowest Common Ancestor of a Binary Search Tree', topic: 'Trees', url: 'https://leetcode.com/problems/lowest-common-ancestor-of-a-binary-search-tree/' },
  // Tries
  { title: 'Implement Trie (Prefix Tree)', topic: 'Tries', url: 'https://leetcode.com/problems/implement-trie-prefix-tree/' },
  // Heap
  { title: 'K Closest Points to Origin', topic: 'Heap / Priority Queue', url: 'https://leetcode.com/problems/k-closest-points-to-origin/' },
  { title: 'Kth Largest Element in an Array', topic: 'Heap / Priority Queue', url: 'https://leetcode.com/problems/kth-largest-element-in-an-array/' },
  { title: 'Task Scheduler', topic: 'Heap / Priority Queue', url: 'https://leetcode.com/problems/task-scheduler/' },
  // Backtracking
  { title: 'Subsets', topic: 'Backtracking', url: 'https://leetcode.com/problems/subsets/' },
  { title: 'Combination Sum', topic: 'Backtracking', url: 'https://leetcode.com/problems/combination-sum/' },
  { title: 'Permutations', topic: 'Backtracking', url: 'https://leetcode.com/problems/permutations/' },
  { title: 'Subsets II', topic: 'Backtracking', url: 'https://leetcode.com/problems/subsets-ii/' },
  { title: 'Combination Sum II', topic: 'Backtracking', url: 'https://leetcode.com/problems/combination-sum-ii/' },
  { title: 'Word Search', topic: 'Backtracking', url: 'https://leetcode.com/problems/word-search/' },
  // Graphs
  { title: 'Max Area of Island', topic: 'Graphs', url: 'https://leetcode.com/problems/max-area-of-island/' },
  { title: 'Clone Graph', topic: 'Graphs', url: 'https://leetcode.com/problems/clone-graph/' },
  { title: 'Walls and Gates', topic: 'Graphs', url: 'https://leetcode.com/problems/walls-and-gates/' },
  { title: 'Rotting Oranges', topic: 'Graphs', url: 'https://leetcode.com/problems/rotting-oranges/' },
  { title: 'Pacific Atlantic Water Flow', topic: 'Graphs', url: 'https://leetcode.com/problems/pacific-atlantic-water-flow/' },
  { title: 'Surrounded Regions', topic: 'Graphs', url: 'https://leetcode.com/problems/surrounded-regions/' },
  { title: 'Course Schedule', topic: 'Graphs', url: 'https://leetcode.com/problems/course-schedule/' },
  { title: 'Course Schedule II', topic: 'Graphs', url: 'https://leetcode.com/problems/course-schedule-ii/' },
  { title: 'Number of Connected Components in an Undirected Graph', topic: 'Graphs', url: 'https://leetcode.com/problems/number-of-connected-components-in-an-undirected-graph/' },
  { title: 'Graph Valid Tree', topic: 'Graphs', url: 'https://leetcode.com/problems/graph-valid-tree/' },
  // Dynamic Programming
  { title: 'House Robber II', topic: '1-D Dynamic Programming', url: 'https://leetcode.com/problems/house-robber-ii/' },
  { title: 'Longest Palindromic Substring', topic: '1-D Dynamic Programming', url: 'https://leetcode.com/problems/longest-palindromic-substring/' },
  { title: 'Palindromic Substrings', topic: '1-D Dynamic Programming', url: 'https://leetcode.com/problems/palindromic-substrings/' },
  { title: 'Decode Ways', topic: '1-D Dynamic Programming', url: 'https://leetcode.com/problems/decode-ways/' },
  { title: 'Coin Change', topic: '1-D Dynamic Programming', url: 'https://leetcode.com/problems/coin-change/' },
  { title: 'Maximum Product Subarray', topic: '1-D Dynamic Programming', url: 'https://leetcode.com/problems/maximum-product-subarray/' },
  { title: 'Word Break', topic: '1-D Dynamic Programming', url: 'https://leetcode.com/problems/word-break/' },
  { title: 'Longest Increasing Subsequence', topic: '1-D Dynamic Programming', url: 'https://leetcode.com/problems/longest-increasing-subsequence/' },
  { title: 'Partition Equal Subset Sum', topic: '1-D Dynamic Programming', url: 'https://leetcode.com/problems/partition-equal-subset-sum/' },
  // 2D DP
  { title: 'Unique Paths', topic: '2-D Dynamic Programming', url: 'https://leetcode.com/problems/unique-paths/' },
  { title: 'Longest Common Subsequence', topic: '2-D Dynamic Programming', url: 'https://leetcode.com/problems/longest-common-subsequence/' },
  // Intervals
  { title: 'Insert Interval', topic: 'Intervals', url: 'https://leetcode.com/problems/insert-interval/' },
  { title: 'Merge Intervals', topic: 'Intervals', url: 'https://leetcode.com/problems/merge-intervals/' },
  { title: 'Non-overlapping Intervals', topic: 'Intervals', url: 'https://leetcode.com/problems/non-overlapping-intervals/' },
  { title: 'Meeting Rooms II', topic: 'Intervals', url: 'https://leetcode.com/problems/meeting-rooms-ii/' },
  // Greedy
  { title: 'Jump Game', topic: 'Greedy', url: 'https://leetcode.com/problems/jump-game/' },
  { title: 'Jump Game II', topic: 'Greedy', url: 'https://leetcode.com/problems/jump-game-ii/' },
  { title: 'Gas Station', topic: 'Greedy', url: 'https://leetcode.com/problems/gas-station/' },
  { title: 'Hand of Straights', topic: 'Greedy', url: 'https://leetcode.com/problems/hand-of-straights/' },
  // Math
  { title: 'Rotate Image', topic: 'Math & Geometry', url: 'https://leetcode.com/problems/rotate-image/' },
  { title: 'Spiral Matrix', topic: 'Math & Geometry', url: 'https://leetcode.com/problems/spiral-matrix/' },
  { title: 'Set Matrix Zeroes', topic: 'Math & Geometry', url: 'https://leetcode.com/problems/set-matrix-zeroes/' },
  // Bit Manipulation
  { title: 'Sum of Two Integers', topic: 'Bit Manipulation', url: 'https://leetcode.com/problems/sum-of-two-integers/' },
  { title: 'Reverse Integer', topic: 'Bit Manipulation', url: 'https://leetcode.com/problems/reverse-integer/' },
];

// ─── HARD ─────────────────────────────────────────────────────────────────────
export const HARD_QUESTIONS: QuestionMeta[] = [
  // Arrays & Hashing
  { title: 'Valid Sudoku', topic: 'Arrays & Hashing', url: 'https://leetcode.com/problems/valid-sudoku/' },
  // Sliding Window
  { title: 'Minimum Window Substring', topic: 'Sliding Window', url: 'https://leetcode.com/problems/minimum-window-substring/' },
  { title: 'Sliding Window Maximum', topic: 'Sliding Window', url: 'https://leetcode.com/problems/sliding-window-maximum/' },
  // Stack
  { title: 'Largest Rectangle in Histogram', topic: 'Stack', url: 'https://leetcode.com/problems/largest-rectangle-in-histogram/' },
  // Binary Search
  { title: 'Median of Two Sorted Arrays', topic: 'Binary Search', url: 'https://leetcode.com/problems/median-of-two-sorted-arrays/' },
  // Linked List
  { title: 'Merge K Sorted Lists', topic: 'Linked List', url: 'https://leetcode.com/problems/merge-k-sorted-lists/' },
  { title: 'Reverse Nodes in k-Group', topic: 'Linked List', url: 'https://leetcode.com/problems/reverse-nodes-in-k-group/' },
  // Trees
  { title: 'Binary Tree Maximum Path Sum', topic: 'Trees', url: 'https://leetcode.com/problems/binary-tree-maximum-path-sum/' },
  { title: 'Serialize and Deserialize Binary Tree', topic: 'Trees', url: 'https://leetcode.com/problems/serialize-and-deserialize-binary-tree/' },
  // Tries
  { title: 'Design Add and Search Words Data Structure', topic: 'Tries', url: 'https://leetcode.com/problems/design-add-and-search-words-data-structure/' },
  { title: 'Word Search II', topic: 'Tries', url: 'https://leetcode.com/problems/word-search-ii/' },
  // Heap
  { title: 'Find Median from Data Stream', topic: 'Heap / Priority Queue', url: 'https://leetcode.com/problems/find-median-from-data-stream/' },
  // Backtracking
  { title: 'N-Queens', topic: 'Backtracking', url: 'https://leetcode.com/problems/n-queens/' },
  { title: 'Sudoku Solver', topic: 'Backtracking', url: 'https://leetcode.com/problems/sudoku-solver/' },
  // Graphs
  { title: 'Alien Dictionary', topic: 'Graphs', url: 'https://leetcode.com/problems/alien-dictionary/' },
  { title: 'Word Ladder', topic: 'Graphs', url: 'https://leetcode.com/problems/word-ladder/' },
  { title: 'Reconstruct Itinerary', topic: 'Graphs', url: 'https://leetcode.com/problems/reconstruct-itinerary/' },
  { title: 'Min Cost to Connect All Points', topic: 'Graphs', url: 'https://leetcode.com/problems/min-cost-to-connect-all-points/' },
  { title: 'Network Delay Time', topic: 'Graphs', url: 'https://leetcode.com/problems/network-delay-time/' },
  { title: 'Swim in Rising Water', topic: 'Graphs', url: 'https://leetcode.com/problems/swim-in-rising-water/' },
  // Advanced Graphs
  { title: 'Cheapest Flights Within K Stops', topic: 'Advanced Graphs', url: 'https://leetcode.com/problems/cheapest-flights-within-k-stops/' },
  // Dynamic Programming
  { title: 'Maximum Subarray', topic: '1-D Dynamic Programming', url: 'https://leetcode.com/problems/maximum-subarray/' },
  // 2D DP
  { title: 'Best Time to Buy and Sell Stock with Cooldown', topic: '2-D Dynamic Programming', url: 'https://leetcode.com/problems/best-time-to-buy-and-sell-stock-with-cooldown/' },
  { title: 'Coin Change II', topic: '2-D Dynamic Programming', url: 'https://leetcode.com/problems/coin-change-ii/' },
  { title: 'Target Sum', topic: '2-D Dynamic Programming', url: 'https://leetcode.com/problems/target-sum/' },
  { title: 'Interleaving String', topic: '2-D Dynamic Programming', url: 'https://leetcode.com/problems/interleaving-string/' },
  { title: 'Edit Distance', topic: '2-D Dynamic Programming', url: 'https://leetcode.com/problems/edit-distance/' },
  { title: 'Burst Balloons', topic: '2-D Dynamic Programming', url: 'https://leetcode.com/problems/burst-balloons/' },
  { title: 'Regular Expression Matching', topic: '2-D Dynamic Programming', url: 'https://leetcode.com/problems/regular-expression-matching/' },
  // Greedy
  { title: 'Trapping Rain Water', topic: 'Greedy', url: 'https://leetcode.com/problems/trapping-rain-water/' },
  { title: 'Merge Triplets to Form Target Triplet', topic: 'Greedy', url: 'https://leetcode.com/problems/merge-triplets-to-form-target-triplet/' },
  { title: 'Partition Labels', topic: 'Greedy', url: 'https://leetcode.com/problems/partition-labels/' },
  { title: 'Valid Parenthesis String', topic: 'Greedy', url: 'https://leetcode.com/problems/valid-parenthesis-string/' },
  // Intervals
  { title: 'Minimum Interval to Include Each Query', topic: 'Intervals', url: 'https://leetcode.com/problems/minimum-interval-to-include-each-query/' },
  // Math
  { title: 'Happy Number', topic: 'Math & Geometry', url: 'https://leetcode.com/problems/happy-number/' },
  { title: 'Multiply Strings', topic: 'Math & Geometry', url: 'https://leetcode.com/problems/multiply-strings/' },
  { title: 'Largest Number', topic: 'Math & Geometry', url: 'https://leetcode.com/problems/largest-number/' },
  // Bit Manipulation
];

// ─── LOOKUP HELPERS ───────────────────────────────────────────────────────────
const ALL_BY_DIFFICULTY: Record<string, QuestionMeta[]> = {
  easy:   EASY_QUESTIONS,
  medium: MEDIUM_QUESTIONS,
  hard:   HARD_QUESTIONS,
};

// Tracks recently served question titles per difficulty — avoids consecutive repeats.
// Persists for the lifetime of the server process; resets on restart (fine for free-tier).
const recentlyShown: Record<string, string[]> = { easy: [], medium: [], hard: [] };
const MAX_RECENT = 15; // won't repeat the last 15 questions

/**
 * Pick `count` distinct random questions for a given difficulty.
 * Excludes recently shown questions so consecutive sessions always get fresh problems.
 */
export function pickRandomQuestions(difficulty: string, count: number = 2): QuestionMeta[] {
  const key   = difficulty.toLowerCase();
  const pool  = ALL_BY_DIFFICULTY[key] ?? MEDIUM_QUESTIONS;
  const recent = recentlyShown[key] ?? [];

  // Prefer questions not recently shown; fall back to full pool if pool is small
  const fresh = pool.filter(q => !recent.includes(q.title));
  const source = fresh.length >= count ? fresh : pool;

  // Fisher-Yates shuffle for uniform distribution
  const arr = [...source];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const picked = arr.slice(0, Math.min(count, arr.length));

  // Record what we just picked so they're excluded next time
  const rec = recentlyShown[key] ?? [];
  for (const q of picked) rec.push(q.title);
  recentlyShown[key] = rec.slice(-MAX_RECENT); // keep last MAX_RECENT only

  return picked;
}
