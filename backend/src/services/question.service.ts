import { Difficulty } from '../types/interview.types';
import geminiService, { DSAQuestion } from './gemini.service';

class QuestionService {
  /**
   * Generate a brand new DSA question using Gemini
   * No caching, no hardcoded questions
   */
  async generateQuestion(difficulty: Difficulty): Promise<DSAQuestion> {
    return geminiService.generateDSAQuestion(difficulty);
  }
}

export default new QuestionService();
