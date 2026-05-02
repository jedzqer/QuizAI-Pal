from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import json
import uuid

from app.database import get_db
from app.models import Question, WrongQuestion, AIConversation, User
from app.models.schemas import AIExplainRequest, AIAskRequest, AILectureRequest, AIQuizRequest, AIResponse
from app.services.ai_service import ai_service

router = APIRouter(prefix="/api/ai", tags=["ai"])

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


@router.post("/explain", response_model=AIResponse)
def explain_answer(request: AIExplainRequest, db: Session = Depends(get_db)):
    """Get AI explanation for a question answer."""
    get_or_create_default_user(db)
    
    # Get the question
    question = db.query(Question).filter(Question.id == request.question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    options = json.loads(question.options) if question.options else {}
    
    # Generate explanation
    explanation = ai_service.explain_answer(
        question.question_text,
        options,
        question.correct_answer,
        request.user_answer
    )
    
    # Create session and save conversation
    session_id = str(uuid.uuid4())
    
    # Save user message
    user_msg = AIConversation(
        user_id=DEFAULT_USER_ID,
        question_id=request.question_id,
        session_id=session_id,
        role="user",
        content=f"请解释题目：{question.question_text}"
    )
    db.add(user_msg)
    
    # Save assistant response
    assistant_msg = AIConversation(
        user_id=DEFAULT_USER_ID,
        question_id=request.question_id,
        session_id=session_id,
        role="assistant",
        content=explanation
    )
    db.add(assistant_msg)
    
    db.commit()
    
    return AIResponse(content=explanation, session_id=session_id)


@router.post("/ask", response_model=AIResponse)
def ask_question(request: AIAskRequest, db: Session = Depends(get_db)):
    """Ask a follow-up question about a question."""
    get_or_create_default_user(db)
    
    # Get conversation history
    conversations = db.query(AIConversation).filter(
        AIConversation.user_id == DEFAULT_USER_ID,
        AIConversation.session_id == request.session_id
    ).order_by(AIConversation.created_at).all()
    
    # Build conversation history
    history = []
    for conv in conversations:
        history.append({"role": conv.role, "content": conv.content})
    
    # Generate answer
    answer = ai_service.answer_followup(history, request.question)
    
    # Save user message
    user_msg = AIConversation(
        user_id=DEFAULT_USER_ID,
        question_id=request.question_id,
        session_id=request.session_id,
        role="user",
        content=request.question
    )
    db.add(user_msg)
    
    # Save assistant response
    assistant_msg = AIConversation(
        user_id=DEFAULT_USER_ID,
        question_id=request.question_id,
        session_id=request.session_id,
        role="assistant",
        content=answer
    )
    db.add(assistant_msg)
    
    db.commit()
    
    return AIResponse(content=answer, session_id=request.session_id)


@router.post("/lecture", response_model=AIResponse)
def start_lecture(request: AILectureRequest, db: Session = Depends(get_db)):
    """Start an AI lecture based on wrong questions."""
    get_or_create_default_user(db)
    
    # Get wrong questions
    wrong_questions = db.query(WrongQuestion).filter(
        WrongQuestion.user_id == DEFAULT_USER_ID,
        WrongQuestion.id.in_(request.wrong_question_ids)
    ).all()
    
    if not wrong_questions:
        raise HTTPException(status_code=404, detail="No wrong questions found")
    
    # Prepare question data
    questions_data = []
    for wq in wrong_questions:
        q = wq.question
        options = json.loads(q.options) if q.options else {}
        questions_data.append({
            "question_text": q.question_text,
            "options": options,
            "correct_answer": q.correct_answer
        })
    
    # Generate lecture
    lecture = ai_service.generate_lecture(questions_data)
    
    # Save conversation
    session_id = str(uuid.uuid4())
    
    user_msg = AIConversation(
        user_id=DEFAULT_USER_ID,
        session_id=session_id,
        role="user",
        content=f"请讲解以下错题：{len(questions_data)}道题"
    )
    db.add(user_msg)
    
    assistant_msg = AIConversation(
        user_id=DEFAULT_USER_ID,
        session_id=session_id,
        role="assistant",
        content=lecture
    )
    db.add(assistant_msg)
    
    db.commit()
    
    return AIResponse(content=lecture, session_id=session_id)


@router.post("/quiz")
def generate_quiz(request: AIQuizRequest, db: Session = Depends(get_db)):
    """Generate quiz questions based on knowledge points."""
    get_or_create_default_user(db)
    
    # Get available questions
    questions = db.query(Question).filter(
        Question.id.in_(request.question_ids)
    ).all()
    
    if not questions:
        raise HTTPException(status_code=404, detail="No questions found")
    
    # Prepare question data
    questions_data = []
    for q in questions:
        options = json.loads(q.options) if q.options else {}
        questions_data.append({
            "id": q.id,
            "question_text": q.question_text,
            "options": options
        })
    
    # Select quiz questions
    result = ai_service.select_quiz_questions(request.knowledge_points, questions_data)
    
    # Get selected questions
    selected_ids = result.get("selected_ids", [])
    selected_questions = db.query(Question).filter(
        Question.id.in_(selected_ids)
    ).all()
    
    # Format response
    quiz_data = []
    for q in selected_questions:
        options = json.loads(q.options) if q.options else {}
        quiz_data.append({
            "id": q.id,
            "num": q.num,
            "question_text": q.question_text,
            "options": options
        })
    
    return {
        "questions": quiz_data,
        "reasons": result.get("reasons", [])
    }
