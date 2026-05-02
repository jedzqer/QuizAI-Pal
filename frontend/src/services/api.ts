import axios from 'axios';

// API base URL - can be configured via environment variable
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Questions API
export const questionsApi = {
  getQuestions: (page = 1, pageSize = 20, category?: string, search?: string) => {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (category) params.append('category', category);
    if (search) params.append('search', search);
    return api.get(`/api/questions?${params}`);
  },

  getQuestion: (id: number) => api.get(`/api/questions/${id}`),

  getRandomQuestion: () => api.get('/api/questions/random'),

  getWrongQuestions: () => api.get('/api/questions/wrong'),

  importQuestions: (filePath: string) => api.post('/api/questions/import', null, { params: { file_path: filePath } }),
};

// Answers API
export const answersApi = {
  submitAnswer: (questionId: number, userAnswer: string) =>
    api.post('/api/answers/submit', { question_id: questionId, user_answer: userAnswer }),

  getStatistics: () => api.get('/api/answers/statistics'),

  getHistory: (limit = 50) => api.get('/api/answers/history', { params: { limit } }),
};

// AI API
export const aiApi = {
  explainAnswer: (questionId: number, userAnswer: string) =>
    api.post('/api/ai/explain', { question_id: questionId, user_answer: userAnswer }),

  askQuestion: (questionId: number, sessionId: string, question: string) =>
    api.post('/api/ai/ask', { question_id: questionId, session_id: sessionId, question }),

  startLecture: (wrongQuestionIds: number[]) =>
    api.post('/api/ai/lecture', { wrong_question_ids: wrongQuestionIds }),

  generateQuiz: (knowledgePoints: string[], questionIds: number[]) =>
    api.post('/api/ai/quiz', { knowledge_points: knowledgePoints, question_ids: questionIds }),
};

export default api;
