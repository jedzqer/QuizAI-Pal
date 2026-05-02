from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
import json

from app.database import get_db
from app.models import Question, AnswerRecord, WrongQuestion, User
from app.models.schemas import (
    QuestionResponse, QuestionListResponse, AnswerSubmit, 
    AnswerResponse, StatisticsResponse, WrongQuestionResponse
)
from app.utils.question_parser import load_question_bank

router = APIRouter(prefix="/api/questions", tags=["questions"])

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


@router.get("", response_model=QuestionListResponse)
def get_questions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get question list with pagination and filters."""
    query = db.query(Question)
    
    if category:
        query = query.filter(Question.category == category)
    
    if search:
        query = query.filter(Question.question_text.contains(search))
    
    total = query.count()
    questions = query.offset((page - 1) * page_size).limit(page_size).all()
    
    # Parse JSON fields
    result = []
    for q in questions:
        options = json.loads(q.options) if q.options else {}
        tags = json.loads(q.tags) if q.tags else []
        result.append(QuestionResponse(
            id=q.id,
            num=q.num,
            question_text=q.question_text,
            options=options,
            correct_answer=q.correct_answer,
            category=q.category,
            tags=tags
        ))
    
    return QuestionListResponse(
        questions=result,
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/random", response_model=QuestionResponse)
def get_random_question(db: Session = Depends(get_db)):
    """Get a random question."""
    question = db.query(Question).order_by(func.random()).first()
    if not question:
        raise HTTPException(status_code=404, detail="No questions found")
    
    options = json.loads(question.options) if question.options else {}
    tags = json.loads(question.tags) if question.tags else []
    
    return QuestionResponse(
        id=question.id,
        num=question.num,
        question_text=question.question_text,
        options=options,
        correct_answer=question.correct_answer,
        category=question.category,
        tags=tags
    )


@router.get("/wrong", response_model=list[WrongQuestionResponse])
def get_wrong_questions(
    db: Session = Depends(get_db)
):
    """Get wrong questions list."""
    get_or_create_default_user(db)
    
    wrong_questions = db.query(WrongQuestion).filter(
        WrongQuestion.user_id == DEFAULT_USER_ID,
        WrongQuestion.mastered == False
    ).all()
    
    result = []
    for wq in wrong_questions:
        q = wq.question
        options = json.loads(q.options) if q.options else {}
        tags = json.loads(q.tags) if q.tags else []
        
        question_resp = QuestionResponse(
            id=q.id,
            num=q.num,
            question_text=q.question_text,
            options=options,
            correct_answer=q.correct_answer,
            category=q.category,
            tags=tags
        )
        
        result.append(WrongQuestionResponse(
            id=wq.id,
            question_id=wq.question_id,
            question=question_resp,
            wrong_count=wq.wrong_count,
            last_wrong_at=wq.last_wrong_at,
            mastered=wq.mastered
        ))
    
    return result


@router.get("/{question_id}", response_model=QuestionResponse)
def get_question(question_id: int, db: Session = Depends(get_db)):
    """Get a single question by ID."""
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    options = json.loads(question.options) if question.options else {}
    tags = json.loads(question.tags) if question.tags else []
    
    return QuestionResponse(
        id=question.id,
        num=question.num,
        question_text=question.question_text,
        options=options,
        correct_answer=question.correct_answer,
        category=question.category,
        tags=tags
    )


@router.post("/import")
def import_questions(file_path: str, db: Session = Depends(get_db)):
    """Import questions from JSON file."""
    try:
        parsed_questions = load_question_bank(file_path)
        
        for q_data in parsed_questions:
            question = Question(**q_data)
            db.add(question)
        
        db.commit()
        return {"message": f"Successfully imported {len(parsed_questions)} questions"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


# Import func for random ordering
from sqlalchemy import func
