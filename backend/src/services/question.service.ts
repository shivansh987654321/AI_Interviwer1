import { Difficulty, DSAQuestion } from '../types/interview.types';
import aiService from './ai.service';
import { pickRandomQuestions, QuestionMeta } from '../data/question-bank';

class QuestionService {
  async generateQuestions(difficulty: Difficulty, count: number = 2): Promise<DSAQuestion[]> {
    const picked = pickRandomQuestions(difficulty, count * 2); // pick extras in case of dupes
    const seen = new Set<string>();
    const results: DSAQuestion[] = [];

    for (const meta of picked) {
      if (results.length >= count) break;
      const key = meta.title.toLowerCase().trim();
      if (seen.has(key)) continue;
      seen.add(key);

      try {
        const q = await aiService.generateDSAQuestion(difficulty, meta);
        results.push(q);
      } catch {
        // If a specific problem fails, skip it
      }
    }

    // Fill remaining slots with AI-generated questions if bank ran short
    while (results.length < count) {
      try {
        const q = await aiService.generateDSAQuestion(difficulty);
        results.push(q);
      } catch {
        break;
      }
    }

    return results;
  }

  async generateQuestion(difficulty: Difficulty): Promise<DSAQuestion> {
    const [meta] = pickRandomQuestions(difficulty, 1);
    return aiService.generateDSAQuestion(difficulty, meta);
  }
}

export default new QuestionService();
