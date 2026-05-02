export interface Question {
  id: number;
  num: number;
  question_text: string;
  options: Record<string, string>;
  correct_answer?: string;
  category?: string;
  tags?: string[];
}

export interface WrongQuestion {
  id: number;
  question_id: number;
  question: Question;
  wrong_count: number;
  last_wrong_at?: string;
  mastered: boolean;
}

export interface AnswerResponse {
  id: number;
  question_id: number;
  user_answer: string;
  is_correct: boolean;
  correct_answer: string;
  answered_at: string;
}

export interface Statistics {
  total_questions: number;
  answered_questions: number;
  correct_count: number;
  wrong_count: number;
  accuracy_rate: number;
  wrong_questions_count: number;
}

export interface AIResponse {
  content: string;
  session_id?: string;
}

export interface AnswerHistory {
  id: number;
  question_id: number;
  question_text: string;
  user_answer: string;
  correct_answer: string;
  is_correct: boolean;
  answered_at: string;
}
