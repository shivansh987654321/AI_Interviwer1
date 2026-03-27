import { Difficulty, DSAQuestion } from '../types/interview.types';
import aiService from './ai.service';

class QuestionService {
  async generateQuestions(difficulty: Difficulty, count: number = 3): Promise<DSAQuestion[]> {
    const questions = await Promise.all(
      Array.from({ length: count }, () => aiService.generateDSAQuestion(difficulty))
    );

    const seen = new Set<string>();
    const deduped: DSAQuestion[] = [];

    for (const q of questions) {
      const key = q.title.toLowerCase().trim();
      if (seen.has(key)) {
        try {
          const replacement = await aiService.generateDSAQuestion(difficulty);
          deduped.push(replacement);
          seen.add(replacement.title.toLowerCase().trim());
        } catch {
          deduped.push(q);
        }
      } else {
        seen.add(key);
        deduped.push(q);
      }
    }

    return deduped;
  }

  async generateQuestion(difficulty: Difficulty): Promise<DSAQuestion> {
    return aiService.generateDSAQuestion(difficulty);
  }
}

export default new QuestionService();
