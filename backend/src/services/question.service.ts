import { Difficulty, DSAQuestion } from '../types/interview.types';
import aiService from './ai.service';

class QuestionService {
  /**
   * Generate a brand new DSA question using the AI service
   * No caching, no hardcoded questions
   */
  async generateQuestion(difficulty: Difficulty): Promise<DSAQuestion> {
    return aiService.generateDSAQuestion(difficulty);
  }
}

export default new QuestionService();
