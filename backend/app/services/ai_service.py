import os
import json
from openai import OpenAI
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

# Load .env from project root
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '..', '.env'))

# AI角色配置 - 可通过环境变量自定义
DEFAULT_ROLE = "你是一位专业的培训教师，擅长讲解各类考试题目"


class AIService:
    def __init__(self):
        api_key = os.getenv("OPENAI_API_KEY")
        api_base = os.getenv("OPENAI_API_BASE_URL", "https://api.openai.com/v1")
        self.model = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")
        self.role = os.getenv("AI_ROLE", DEFAULT_ROLE)
        
        self.client = OpenAI(
            api_key=api_key,
            base_url=api_base
        )
    
    def explain_answer(self, question: str, options: Dict[str, str], 
                      correct_answer: str, user_answer: str) -> str:
        """
        Generate explanation for a question answer.
        """
        options_text = "\n".join([f"{k}. {v}" for k, v in options.items()])
        
        prompt = f"""{self.role}。请解释以下题目的正确答案：

题目：{question}
选项：
{options_text}
正确答案：{correct_answer}
用户选择：{user_answer}

请从以下几个方面解释：
1. 正确答案的原因
2. 相关知识点
3. 常见错误分析
4. 记忆技巧

请用专业但易懂的语言回答。"""
        
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}]
        )
        
        return response.choices[0].message.content
    
    def answer_followup(self, conversation_history: List[Dict[str, str]], 
                       user_question: str) -> str:
        """
        Answer follow-up questions about a question.
        """
        messages = conversation_history.copy()
        messages.append({"role": "user", "content": user_question})
        
        system_message = {
            "role": "system", 
            "content": f"{self.role}。请基于上下文回答用户的问题，用专业但易懂的语言回答。"
        }
        
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[system_message] + messages
        )
        
        return response.choices[0].message.content
    
    def generate_lecture(self, wrong_questions: List[Dict[str, Any]]) -> str:
        """
        Generate a lecture based on wrong questions.
        """
        questions_text = "\n".join([
            f"题目{i+1}: {q['question_text']}\n选项: {json.dumps(q['options'], ensure_ascii=False)}\n正确答案: {q['correct_answer']}"
            for i, q in enumerate(wrong_questions)
        ])
        
        prompt = f"""{self.role}。用户在以下题目上多次出错，请讲解相关知识点：

错题列表：
{questions_text}

请：
1. 分析错误原因
2. 讲解核心知识点
3. 提供记忆方法
4. 总结重点内容

请用专业但易懂的语言讲解。"""
        
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}]
        )
        
        return response.choices[0].message.content
    
    def select_quiz_questions(self, knowledge_points: List[str], 
                            available_questions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Select quiz questions based on knowledge points.
        """
        questions_text = "\n".join([
            f"ID:{q['id']} 题目: {q['question_text']}"
            for q in available_questions
        ])
        
        knowledge_text = "、".join(knowledge_points)
        
        prompt = f"""基于刚才讲解的知识点，从题库中选择3道相关题目测试用户掌握程度：

知识点：{knowledge_text}
可用题目：
{questions_text}

请返回JSON格式，包含选择的题目ID和选择理由：
{{"selected_ids": [1, 2, 3], "reasons": ["理由1", "理由2", "理由3"]}}

只返回JSON，不要其他内容。"""
        
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        
        result = json.loads(response.choices[0].message.content)
        return result


ai_service = AIService()
