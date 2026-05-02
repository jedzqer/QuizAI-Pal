from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.database import engine, Base
from app.routes import questions, answers, ai


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create database tables
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="AI刷题辅助学习系统",
    description="基于AI的辅助学习软件，支持刷题、错题记录、AI解析和智能讲解功能",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(questions.router)
app.include_router(answers.router)
app.include_router(ai.router)


@app.get("/")
def root():
    return {"message": "AI刷题辅助学习系统 API"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}
