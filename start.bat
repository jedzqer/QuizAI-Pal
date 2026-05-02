@echo off
chcp 65001 >nul
echo =====================================
echo    AI 辅助学习系统启动脚本
echo =====================================
echo.

REM 检查 .env 文件
if not exist ".env" (
    echo [错误] 未找到 .env 配置文件，请先创建 .env 文件
    pause
    exit /b 1
)

REM 读取端口配置
set BACKEND_PORT=8003
set FRONTEND_PORT=5173
for /f "tokens=1,* delims==" %%a in ('findstr /i "BACKEND_PORT=" .env') do set BACKEND_PORT=%%b
for /f "tokens=1,* delims==" %%a in ('findstr /i "FRONTEND_PORT=" .env') do set FRONTEND_PORT=%%b

REM 安装后端依赖
echo [检查] 后端依赖...
if not exist "backend\venv" (
    echo [安装] 创建 Python 虚拟环境...
    python -m venv backend\venv
)
echo [安装] 安装后端依赖...
call backend\venv\Scripts\pip install -q -r backend\requirements.txt

REM 安装前端依赖
echo [检查] 前端依赖...
if not exist "frontend\node_modules" (
    echo [安装] 安装前端依赖...
    cd frontend
    call npm install
    cd ..
)

echo.
echo [启动] 正在启动服务...
echo.

REM 启动后端（新窗口）
start "后端服务" cmd /k "cd backend && ..\backend\venv\Scripts\python -m uvicorn app.main:app --host 0.0.0.0 --port %BACKEND_PORT% --reload"

REM 启动前端（新窗口）
start "前端服务" cmd /k "cd frontend && npm run dev -- --port %FRONTEND_PORT%"

echo =====================================
echo    服务已启动!
echo =====================================
echo.
echo    前端地址: http://localhost:%FRONTEND_PORT%
echo    后端地址: http://localhost:%BACKEND_PORT%
echo    API文档:  http://localhost:%BACKEND_PORT%/docs
echo.
echo    关闭对应的命令行窗口可停止服务
echo =====================================
echo.
pause
