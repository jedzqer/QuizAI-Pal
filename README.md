# AI刷题辅助学习系统

基于AI的辅助学习软件，支持刷题、错题记录、AI解析和智能讲解功能。适用于各类考试题库。

## 快速开始

### 1. 配置环境变量

编辑根目录 `.env` 文件，配置以下参数：

```env
# AI API 配置（必填）
OPENAI_API_KEY=your_api_key          # 你的API Key
OPENAI_API_BASE_URL=https://api.openai.com/v1  # API地址（支持自定义）
OPENAI_MODEL=gpt-3.5-turbo           # 模型名称

# AI角色配置（可选）
AI_ROLE=你是一位专业的培训教师，擅长讲解各类考试题目

# 后端配置
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000

# 前端配置
FRONTEND_PORT=5173
```

### 2. 启动系统

#### Windows PowerShell（推荐）
```powershell
.\start.ps1
```

#### Windows 命令行
```cmd
start.bat
```

### 3. 访问系统

- 前端地址: http://localhost:5173
- 后端地址: http://localhost:8000
- API文档: http://localhost:8000/docs

## 功能特性

- 📝 **刷题模式**: 顺序刷题，即时反馈
- ❌ **错题管理**: 自动记录错题，支持重做
- 🎓 **AI讲解**: 智能分析错题，针对性讲解
- 📊 **学习统计**: 答题总数、正确率统计

## 项目结构

```
learning-assistant/
├── .env                    # 环境配置文件
├── start.ps1              # PowerShell启动脚本
├── start.bat              # CMD启动脚本
├── backend/               # 后端代码
│   ├── app/
│   │   ├── main.py       # FastAPI应用
│   │   ├── database.py   # 数据库配置
│   │   ├── models/       # 数据模型
│   │   ├── routes/       # API路由
│   │   └── services/     # 业务逻辑
│   └── requirements.txt  # Python依赖
└── frontend/              # 前端代码
    ├── src/
    │   ├── pages/        # 页面组件
    │   ├── services/     # API服务
    │   └── types/        # TypeScript类型
    └── package.json      # Node依赖
```

## 题库导入

将题库文件放在 `backend/data/` 目录下，格式如下：

```json
[
  {
    "num": 1,
    "question": "题目内容 A.选项1 B.选项2 C.选项3",
    "answer": "A"
  }
]
```

通过API导入：
```bash
curl -X POST "http://localhost:8000/api/questions/import?file_path=backend/data/题库.json"
```

## 自定义API配置

支持任何 OpenAI 兼容的 API 服务：

```env
# OpenAI
OPENAI_API_BASE_URL=https://api.openai.com/v1

# Azure OpenAI
OPENAI_API_BASE_URL=https://your-resource.openai.azure.com/

# 本地模型（如 Ollama）
OPENAI_API_BASE_URL=http://localhost:11434/v1

# 其他兼容服务
OPENAI_API_BASE_URL=https://your-api-endpoint/v1
```

## 自定义AI角色

通过 `AI_ROLE` 环境变量自定义AI的角色和行为：

```env
# 通用教师
AI_ROLE=你是一位专业的培训教师，擅长讲解各类考试题目

# 特定领域
AI_ROLE=你是一位低压电工培训专家
AI_ROLE=你是一位医学考试辅导教师
AI_ROLE=你是一位编程面试辅导老师
```

## 停止服务

- **PowerShell**: 按 `Ctrl+C`
- **CMD**: 关闭对应的命令行窗口
