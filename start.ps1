# 低压电工辅助学习系统启动脚本
# 用于同时启动前端和后端，并显示日志

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "   低压电工辅助学习系统启动脚本" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# 检查 .env 文件是否存在
if (-not (Test-Path ".env")) {
    Write-Host "[错误] 未找到 .env 配置文件，请先创建 .env 文件" -ForegroundColor Red
    exit 1
}

# 读取配置
$envContent = Get-Content ".env" -Raw
$backendPort = if ($envContent -match "BACKEND_PORT=(\d+)") { $Matches[1] } else { "8000" }
$frontendPort = if ($envContent -match "FRONTEND_PORT=(\d+)") { $Matches[1] } else { "5173" }

Write-Host "[配置] 后端端口: $backendPort" -ForegroundColor Yellow
Write-Host "[配置] 前端端口: $frontendPort" -ForegroundColor Yellow
Write-Host ""

# 检查后端依赖
Write-Host "[检查] 后端依赖..." -ForegroundColor Green
if (-not (Test-Path "backend/venv")) {
    Write-Host "[安装] 创建 Python 虚拟环境..." -ForegroundColor Yellow
    python -m venv backend/venv
}

Write-Host "[安装] 安装后端依赖..." -ForegroundColor Yellow
& backend/venv/Scripts/pip install -q -r backend/requirements.txt

# 检查前端依赖
Write-Host "[检查] 前端依赖..." -ForegroundColor Green
if (-not (Test-Path "frontend/node_modules")) {
    Write-Host "[安装] 安装前端依赖..." -ForegroundColor Yellow
    Set-Location frontend
    npm install
    Set-Location ..
}

Write-Host ""
Write-Host "[启动] 正在启动服务..." -ForegroundColor Green
Write-Host ""

# 启动后端
$backendJob = Start-Job -ScriptBlock {
    param($workdir)
    Set-Location $workdir
    & backend/venv/Scripts/python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
} -ArgumentList (Get-Location).Path

# 启动前端
$frontendJob = Start-Job -ScriptBlock {
    param($workdir)
    Set-Location "$workdir/frontend"
    npm run dev -- --port 5173
} -ArgumentList (Get-Location).Path

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "   服务已启动!" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "   前端地址: http://localhost:$frontendPort" -ForegroundColor Green
Write-Host "   后端地址: http://localhost:$backendPort" -ForegroundColor Green
Write-Host "   API文档:  http://localhost:$backendPort/docs" -ForegroundColor Green
Write-Host ""
Write-Host "   按 Ctrl+C 停止所有服务" -ForegroundColor Yellow
Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# 实时显示日志
try {
    while ($true) {
        # 显示后端日志
        $backendOutput = Receive-Job -Job $backendJob
        if ($backendOutput) {
            Write-Host "[后端] " -ForegroundColor Blue -NoNewline
            Write-Host $backendOutput
        }
        
        # 显示前端日志
        $frontendOutput = Receive-Job -Job $frontendJob
        if ($frontendOutput) {
            Write-Host "[前端] " -ForegroundColor Magenta -NoNewline
            Write-Host $frontendOutput
        }
        
        # 检查作业状态
        if ($backendJob.State -eq "Failed") {
            Write-Host "[错误] 后端启动失败" -ForegroundColor Red
            break
        }
        if ($frontendJob.State -eq "Failed") {
            Write-Host "[错误] 前端启动失败" -ForegroundColor Red
            break
        }
        
        Start-Sleep -Milliseconds 100
    }
}
finally {
    # 清理作业
    Write-Host ""
    Write-Host "[停止] 正在停止服务..." -ForegroundColor Yellow
    Stop-Job -Job $backendJob -ErrorAction SilentlyContinue
    Stop-Job -Job $frontendJob -ErrorAction SilentlyContinue
    Remove-Job -Job $backendJob -Force -ErrorAction SilentlyContinue
    Remove-Job -Job $frontendJob -Force -ErrorAction SilentlyContinue
    Write-Host "[完成] 所有服务已停止" -ForegroundColor Green
}
