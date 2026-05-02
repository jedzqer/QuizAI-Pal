import axios from 'axios';

// API base URL - can be configured via environment variable
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8003';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// SSE stream helper function
export interface StreamCallbacks {
  onChunk?: (content: string) => void;
  onComplete?: (sessionId: string) => void;
  onError?: (error: Error) => void;
}

async function fetchStream(
  url: string,
  body: Record<string, unknown>,
  callbacks: StreamCallbacks
): Promise<void> {
  const { onChunk, onComplete, onError } = callbacks;
  
  try {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('ReadableStream not supported');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      
      // Process SSE events
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            
            if (data.done) {
              onComplete?.(data.session_id || '');
            } else if (data.content) {
              onChunk?.(data.content);
            }
            
            if (data.error) {
              throw new Error(data.error);
            }
          } catch (e) {
            if (e instanceof SyntaxError) {
              // Skip invalid JSON
              continue;
            }
            throw e;
          }
        }
      }
    }
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error(String(error)));
  }
}

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

  importQuestions: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/api/questions/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// Answers API
export const answersApi = {
  submitAnswer: (questionId: number, userAnswer: string) =>
    api.post('/api/answers/submit', { question_id: questionId, user_answer: userAnswer }),

  getStatistics: () => api.get('/api/answers/statistics'),

  getHistory: (limit = 50) => api.get('/api/answers/history', { params: { limit } }),

  markConfusing: (questionId: number) =>
    api.post('/api/answers/mark-confusing', { question_id: questionId }),
};

// AI API with streaming support
export const aiApi = {
  explainAnswer: (questionId: number, userAnswer: string, callbacks: StreamCallbacks) =>
    fetchStream('/api/ai/explain', { question_id: questionId, user_answer: userAnswer }, callbacks),

  askQuestion: (questionId: number, sessionId: string, question: string, callbacks: StreamCallbacks) =>
    fetchStream('/api/ai/ask', { question_id: questionId, session_id: sessionId, question }, callbacks),

  startLecture: (wrongQuestionIds: number[], callbacks: StreamCallbacks) =>
    fetchStream('/api/ai/lecture', { wrong_question_ids: wrongQuestionIds }, callbacks),

  generateQuiz: (knowledgePoints: string[], questionIds: number[]) =>
    api.post('/api/ai/quiz', { knowledge_points: knowledgePoints, question_ids: questionIds }),
};

export default api;
