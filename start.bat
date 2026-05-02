@echo off
chcp 65001 >nul
echo =====================================
echo    AI Helper Learning System
echo =====================================
echo.

REM Check .env file
if not exist ".env" (
    echo [Error] .env config file not found, please create .env first
    pause
    exit /b 1
)

REM Read port config
set BACKEND_PORT=8003
set FRONTEND_PORT=5173
for /f "tokens=1,* delims==" %%a in ('findstr /i "BACKEND_PORT=" .env') do set BACKEND_PORT=%%b
for /f "tokens=1,* delims==" %%a in ('findstr /i "FRONTEND_PORT=" .env') do set FRONTEND_PORT=%%b

REM Install backend dependencies
echo [Check] Backend dependencies...
if not exist "backend\venv" (
    echo [Install] Creating Python virtual environment...
    python -m venv backend\venv
)
echo [Install] Installing backend dependencies...
call backend\venv\Scripts\pip install -q -r backend\requirements.txt

REM Install frontend dependencies
echo [Check] Frontend dependencies...
if not exist "frontend\node_modules" (
    echo [Install] Installing frontend dependencies...
    cd frontend
    call npm install
    cd ..
)

echo.
echo [Start] Starting services...
echo.

REM Start backend (new window)
start "Backend" cmd /k "cd backend && ..\backend\venv\Scripts\python -m uvicorn app.main:app --host 0.0.0.0 --port %BACKEND_PORT% --reload"

REM Start frontend (new window)
start "Frontend" cmd /k "cd frontend && npm run dev -- --port %FRONTEND_PORT%"

echo =====================================
echo    Services started!
echo =====================================
echo.
echo    Frontend: http://localhost:%FRONTEND_PORT%
echo    Backend:  http://localhost:%BACKEND_PORT%
echo    API Docs: http://localhost:%BACKEND_PORT%/docs
echo.
echo    Close the command windows to stop services
echo =====================================
echo.
pause
