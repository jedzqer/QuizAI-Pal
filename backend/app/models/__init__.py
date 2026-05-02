from sqlalchemy import Column, Integer, String, Text, Boolean, TIMESTAMP, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

    answer_records = relationship("AnswerRecord", back_populates="user")
    wrong_questions = relationship("WrongQuestion", back_populates="user")
    ai_conversations = relationship("AIConversation", back_populates="user")


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    num = Column(Integer, index=True)
    question_text = Column(Text)
    options = Column(Text)  # JSON string
    correct_answer = Column(String(1))
    category = Column(String(100))
    tags = Column(Text)  # JSON string

    answer_records = relationship("AnswerRecord", back_populates="question")
    wrong_questions = relationship("WrongQuestion", back_populates="question")


class AnswerRecord(Base):
    __tablename__ = "answer_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    question_id = Column(Integer, ForeignKey("questions.id"))
    user_answer = Column(String(1))
    is_correct = Column(Boolean)
    answered_at = Column(TIMESTAMP, server_default=func.now())

    user = relationship("User", back_populates="answer_records")
    question = relationship("Question", back_populates="answer_records")


class WrongQuestion(Base):
    __tablename__ = "wrong_questions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    question_id = Column(Integer, ForeignKey("questions.id"))
    wrong_count = Column(Integer, default=1)
    last_wrong_at = Column(TIMESTAMP)
    mastered = Column(Boolean, default=False)

    user = relationship("User", back_populates="wrong_questions")
    question = relationship("Question", back_populates="wrong_questions")


class AIConversation(Base):
    __tablename__ = "ai_conversations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    question_id = Column(Integer, nullable=True)
    session_id = Column(String(100))
    role = Column(String(20))
    content = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())

    user = relationship("User", back_populates="ai_conversations")
