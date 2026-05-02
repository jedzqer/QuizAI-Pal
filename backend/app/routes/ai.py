from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import json
import uuid

from app.database import get_db
from app.models import Question, WrongQuestion, AIConversation, User
from app.models.schemas import AIExplainRequest, AIAskRequest, AILectureRequest, AIQuizRequest
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


def stream_response(generator, session_id: str, db: Session, 
                    user_id: int, question_id: int, user_content: str):
    """Create SSE stream response and save to database after completion."""
    full_content = []
    
    def event_stream():
        for chunk in generator:
            full_content.append(chunk)
            data = json.dumps({"content": chunk, "done": False}, ensure_ascii=False)
            yield f"data: {data}\n\n"
        
        # Stream completed, save to database
        complete_content = "".join(full_content)

        try:
            # Save user message
            user_msg = AIConversation(
                user_id=user_id,
                question_id=question_id,
                session_id=session_id,
                role="user",
                content=user_content
            )
            db.add(user_msg)

            # Save assistant response
            assistant_msg = AIConversation(
                user_id=user_id,
                question_id=question_id,
                session_id=session_id,
                role="assistant",
                content=complete_content
            )
            db.add(assistant_msg)

            db.commit()
        except Exception as e:
            db.rollback()
            print(f"Failed to save conversation: {e}")

        # Always send done event so client can finalize
        data = json.dumps({"content": "", "done": True, "session_id": session_id}, ensure_ascii=False)
        yield f"data: {data}\n\n"
    
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.post("/explain")
def explain_answer(request: AIExplainRequest, db: Session = Depends(get_db)):
    """Get AI explanation for a question answer with streaming."""
    get_or_create_default_user(db)
    
    # Get the question
    question = db.query(Question).filter(Question.id == request.question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    options = json.loads(question.options) if question.options else {}
    
    # Create session
    session_id = str(uuid.uuid4())
    
    # Generate explanation stream
    generator = ai_service.explain_answer(
        question.question_text,
        options,
        question.correct_answer,
        request.user_answer
    )
    
    return stream_response(
        generator, session_id, db,
        DEFAULT_USER_ID, request.question_id,
        f"请解释题目：{question.question_text}"
    )


@router.post("/ask")
def ask_question(request: AIAskRequest, db: Session = Depends(get_db)):
    """Ask a follow-up question about a question with streaming."""
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
    
    # Generate answer stream
    generator = ai_service.answer_followup(history, request.question)
    
    return stream_response(
        generator, request.session_id, db,
        DEFAULT_USER_ID, request.question_id,
        request.question
    )


@router.post("/lecture")
def start_lecture(request: AILectureRequest, db: Session = Depends(get_db)):
    """Start an AI lecture based on wrong questions with streaming."""
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
    
    # Create session
    session_id = str(uuid.uuid4())
    
    # Generate lecture stream
    generator = ai_service.generate_lecture(questions_data)
    
    return stream_response(
        generator, session_id, db,
        DEFAULT_USER_ID, 0,
        f"请讲解以下错题：{len(questions_data)}道题"
    )


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
