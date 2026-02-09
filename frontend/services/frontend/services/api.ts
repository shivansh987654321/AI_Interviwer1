import axios from 'axios';

const API_URL = 'http://localhost:5001/api/interview';

export const startInterview = async (difficulty: string) => {
  try {
    const response = await axios.post(`${API_URL}/create`, { difficulty });
    return response.data;
  } catch (error) {
    console.error('Error starting interview:', error);
    throw error;
  }
};