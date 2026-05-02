# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

QuizAI-Pal is an AI-powered quiz study system (Chinese-language UI). Users import question banks as JSON, take quizzes, and get AI-generated explanations and lectures on wrong answers. Single-user mode with no authentication (hardcoded user ID 1).

## Development Commands

**Quick start (Windows):**
```powershell
.\start.ps1          # PowerShell - installs deps, starts both servers
start.bat            # CMD equivalent
```

**Frontend (from `frontend/`):**
```bash
npm run dev          # Vite dev server on :5173
npm run build        # tsc -b && vite build
npm run lint         # ESLint
```

**Backend (from `backend/`):**
```bash
# Activate venv first: venv\Scripts\activate (Windows) or source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8003 --reload
```

**No automated tests exist** in either frontend or backend.

## Architecture

**Stack:** React 19 + TypeScript + Vite frontend, FastAPI + SQLAlchemy + SQLite backend, OpenAI-compatible API for AI features.

**Two servers in dev:** Frontend Vite on :5173, backend Uvicorn on :8003. Frontend reads `VITE_API_BASE_URL` from root `.env` (Vite `envDir` is project root, not `frontend/`).

**Communication patterns:**
- REST (Axios): CRUD operations for questions, answers, statistics
- SSE streaming (fetch + ReadableStream): AI explain/ask/lecture endpoints return `text/event-stream` with JSON chunks `{content, done, session_id}`

**Backend structure (`backend/app/`):**
- `main.py` — FastAPI app, CORS (`*`), lifespan creates DB tables on startup
- `database.py` — SQLAlchemy engine/session (SQLite)
- `models/__init__.py` — ORM models: User, Question, AnswerRecord, WrongQuestion, AIConversation
- `models/schemas.py` — Pydantic v1 request/response schemas
- `routes/` — `questions.py` (CRUD + JSON import), `answers.py` (submit + stats), `ai.py` (SSE streaming AI)
- `services/ai_service.py` — OpenAI SDK client, prompt construction
- `utils/question_parser.py` — parses imported question JSON (extracts inline "A. B. C." options)

**Frontend structure (`frontend/src/`):**
- `App.tsx` — React Router routes: `/` (Home), `/quiz`, `/quiz/:questionId`, `/wrong`, `/lecture`, `/bank`
- `pages/` — Home (dashboard), Quiz (sequential quiz + AI dialog), WrongQuestions, Lecture (streaming + follow-up), QuestionBank (JSON upload)
- `services/api.ts` — Axios instance + `fetchStream()` SSE helper
- `types/index.ts` — TypeScript interfaces
- `App.css` — single monolithic stylesheet (~1200 lines)
- All state via React hooks; `localStorage` for quiz position only

**Database:** SQLite at `backend/learning_assistant.db`. Tables auto-created on startup. `options` and `tags` columns on `questions` table are JSON text, manually serialized/parsed in routes.

**AI conversation flow:** Session IDs (UUIDs) group conversation history. The `stream_response()` helper in `ai.py` wraps the generator and saves full conversation to DB after streaming completes.

## Environment Variables

Copy `.env.example` to `.env`. Key variables:
- `OPENAI_API_KEY` (required), `OPENAI_API_BASE_URL`, `OPENAI_MODEL` — AI provider config
- `AI_ROLE` — custom AI persona prompt
- `BACKEND_HOST` / `BACKEND_PORT` (default: 0.0.0.0:8003)
- `FRONTEND_PORT` (default: 5173), `VITE_API_BASE_URL` (default: http://localhost:8003)
- `DATABASE_URL` (default: sqlite:///./learning_assistant.db)

## Question Bank JSON Format

```json
[
  {
    "num": 1,
    "question": "题目内容 A.选项1 B.选项2 C.选项3",
    "answer": "A"
  }
]
```

Options are embedded inline in the question text and parsed by `question_parser.py`.
