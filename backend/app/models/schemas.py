from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime


class UserCreate(BaseModel):
    username: str


class UserResponse(BaseModel):
    id: int
    username: str
    created_at: datetime

    class Config:
        orm_mode = True


class QuestionResponse(BaseModel):
    id: int
    num: int
    question_text: str
    options: Dict[str, str]
    correct_answer: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None

    class Config:
        orm_mode = True


class QuestionListResponse(BaseModel):
    questions: List[QuestionResponse]
    total: int
    page: int
    page_size: int


class AnswerSubmit(BaseModel):
    question_id: int
    user_answer: str


class AnswerResponse(BaseModel):
    id: int
    question_id: int
    user_answer: str
    is_correct: bool
    correct_answer: str
    answered_at: datetime

    class Config:
        orm_mode = True


class StatisticsResponse(BaseModel):
    total_questions: int
    answered_questions: int
    correct_count: int
    wrong_count: int
    accuracy_rate: float
    wrong_questions_count: int


class AIExplainRequest(BaseModel):
    question_id: int
    user_answer: str


class AIAskRequest(BaseModel):
    question_id: int
    session_id: str
    question: str


class AILectureRequest(BaseModel):
    wrong_question_ids: List[int]


class AIQuizRequest(BaseModel):
    knowledge_points: List[str]
    question_ids: List[int]


class AIResponse(BaseModel):
    content: str
    session_id: Optional[str] = None


class WrongQuestionResponse(BaseModel):
    id: int
    question_id: int
    question: QuestionResponse
    wrong_count: int
    last_wrong_at: Optional[datetime]
    mastered: bool

    class Config:
        orm_mode = True
