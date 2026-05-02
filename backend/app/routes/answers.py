from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime

from app.database import get_db
from app.models import Question, AnswerRecord, WrongQuestion, User
from app.models.schemas import AnswerSubmit, AnswerResponse, StatisticsResponse

router = APIRouter(prefix="/api/answers", tags=["answers"])

# Default user ID for single-user mode
DEFAULT_USER_ID = 1


def get_or_create_default_user(db: Session):
    """Get or create default user for single-user mode."""
    user = db.query(User).filter(User.id == DEFAULT_USER_ID).first()
    if not user:
        user = User(id=DEFAULT_USER_ID, username="default_user")
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


@router.post("/submit", response_model=AnswerResponse)
def submit_answer(answer: AnswerSubmit, db: Session = Depends(get_db)):
    """Submit an answer and get feedback."""
    get_or_create_default_user(db)
    
    # Get the question
    question = db.query(Question).filter(Question.id == answer.question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    # Check if answer is correct
    is_correct = answer.user_answer.upper() == question.correct_answer.upper()
    
    # Create answer record
    record = AnswerRecord(
        user_id=DEFAULT_USER_ID,
        question_id=answer.question_id,
        user_answer=answer.user_answer.upper(),
        is_correct=is_correct
    )
    db.add(record)
    
    # Update wrong questions if incorrect
    if not is_correct:
        wrong_question = db.query(WrongQuestion).filter(
            WrongQuestion.user_id == DEFAULT_USER_ID,
            WrongQuestion.question_id == answer.question_id
        ).first()
        
        if wrong_question:
            wrong_question.wrong_count += 1
            wrong_question.last_wrong_at = datetime.now()
            wrong_question.mastered = False
        else:
            wrong_question = WrongQuestion(
                user_id=DEFAULT_USER_ID,
                question_id=answer.question_id,
                wrong_count=1,
                last_wrong_at=datetime.now()
            )
            db.add(wrong_question)
    else:
        # If correct, check if this was a wrong question and mark as mastered
        wrong_question = db.query(WrongQuestion).filter(
            WrongQuestion.user_id == DEFAULT_USER_ID,
            WrongQuestion.question_id == answer.question_id
        ).first()
        
        if wrong_question:
            wrong_question.mastered = True
    
    db.commit()
    db.refresh(record)
    
    return AnswerResponse(
        id=record.id,
        question_id=record.question_id,
        user_answer=record.user_answer,
        is_correct=record.is_correct,
        correct_answer=question.correct_answer,
        answered_at=record.answered_at
    )


@router.get("/statistics", response_model=StatisticsResponse)
def get_statistics(db: Session = Depends(get_db)):
    """Get learning statistics."""
    get_or_create_default_user(db)
    
    # Total questions in bank
    total_questions = db.query(Question).count()
    
    # Answered questions
    answered_questions = db.query(AnswerRecord).filter(
        AnswerRecord.user_id == DEFAULT_USER_ID
    ).count()
    
    # Correct count
    correct_count = db.query(AnswerRecord).filter(
        AnswerRecord.user_id == DEFAULT_USER_ID,
        AnswerRecord.is_correct == True
    ).count()
    
    # Wrong count
    wrong_count = answered_questions - correct_count
    
    # Accuracy rate
    accuracy_rate = (correct_count / answered_questions * 100) if answered_questions > 0 else 0
    
    # Wrong questions count (unmastered)
    wrong_questions_count = db.query(WrongQuestion).filter(
        WrongQuestion.user_id == DEFAULT_USER_ID,
        WrongQuestion.mastered == False
    ).count()
    
    return StatisticsResponse(
        total_questions=total_questions,
        answered_questions=answered_questions,
        correct_count=correct_count,
        wrong_count=wrong_count,
        accuracy_rate=round(accuracy_rate, 2),
        wrong_questions_count=wrong_questions_count
    )


@router.get("/history")
def get_answer_history(
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Get answer history."""
    get_or_create_default_user(db)
    
    records = db.query(AnswerRecord).filter(
        AnswerRecord.user_id == DEFAULT_USER_ID
    ).order_by(AnswerRecord.answered_at.desc()).limit(limit).all()
    
    result = []
    for record in records:
        question = record.question
        result.append({
            "id": record.id,
            "question_id": record.question_id,
            "question_text": question.question_text,
            "user_answer": record.user_answer,
            "correct_answer": question.correct_answer,
            "is_correct": record.is_correct,
            "answered_at": record.answered_at
        })
    
    return result
