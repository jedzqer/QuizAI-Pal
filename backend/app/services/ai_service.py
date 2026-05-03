import os
import json
from openai import OpenAI
from typing import List, Dict, Any, Optional, Generator
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

    @staticmethod
    def _iter_stream_content(stream) -> Generator[str, None, None]:
        """Yield text content from streaming chunks, skipping empty frames."""
        for chunk in stream:
            choices = getattr(chunk, "choices", None) or []
            if not choices:
                continue

            delta = getattr(choices[0], "delta", None)
            content = getattr(delta, "content", None)
            if content:
                yield content
    
    def explain_answer(self, question: str, options: Dict[str, str], 
                      correct_answer: str, user_answer: str) -> Generator[str, None, None]:
        """
        Generate explanation for a question answer with streaming.
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
        
        stream = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            stream=True
        )
        
        yield from self._iter_stream_content(stream)
    
    def answer_followup(self, conversation_history: List[Dict[str, str]], 
                       user_question: str) -> Generator[str, None, None]:
        """
        Answer follow-up questions about a question with streaming.
        """
        messages = conversation_history.copy()
        messages.append({"role": "user", "content": user_question})
        
        system_message = {
            "role": "system", 
            "content": f"{self.role}。请基于上下文回答用户的问题，用专业但易懂的语言回答。"
        }
        
        stream = self.client.chat.completions.create(
            model=self.model,
            messages=[system_message] + messages,
            stream=True
        )
        
        yield from self._iter_stream_content(stream)
    
    def generate_lecture(self, wrong_questions: List[Dict[str, Any]]) -> Generator[str, None, None]:
        """
        Generate a lecture based on wrong questions with streaming.
        """
        questions_text = "\n".join([
            f"题目{i+1}: {q['question_text']}\n选项: {json.dumps(q['options'], ensure_ascii=False)}\n正确答案: {q['correct_answer']}"
            + (f"\n用户选择: {q['user_answer']}" if q.get('user_answer') else "")
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
        
        stream = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            stream=True
        )
        
        yield from self._iter_stream_content(stream)
    
    def generate_comprehensive_lecture(self, wrong_questions: List[Dict[str, Any]],
                                       topic: str = "") -> Generator[str, None, None]:
        """
        Generate a comprehensive lecture covering complete knowledge points,
        not limited to individual questions. Like a traditional classroom lecture.
        """
        # Build a summary of the wrong questions for context
        questions_text = "\n".join([
            f"题目{i+1}: {q['question_text']}\n正确答案: {q['correct_answer']}"
            + (f"\n用户选择: {q['user_answer']}" if q.get('user_answer') else "")
            for i, q in enumerate(wrong_questions)
        ])

        topic_hint = f"主题/类别：{topic}\n" if topic else ""

        prompt = f"""{self.role}。用户在以下题目上多次出错，现在请进行一次综合讲解。

{topic_hint}错题列表：
{questions_text}

请进行一次完整的综合讲解，像传统课堂教学一样：

1. **知识体系梳理**：从这些错题中提炼出核心知识体系，构建完整的知识框架
2. **重点知识深入讲解**：对每个关键知识点进行详细讲解，不要局限于具体题目，而是讲透背后的原理和概念
3. **知识点之间的关联**：说明各个知识点之间的联系和区别
4. **常见易错点总结**：基于错题分析，总结常见的错误类型和易混淆的概念
5. **学习建议**：给出系统性的学习和记忆建议

要求：
- 像老师上课一样，讲授完整的知识体系，不要逐题分析
- 使用专业但易懂的语言
- 适当使用标题、列表等格式让内容更清晰
- 重点放在"教会"用户，而不是"告诉"用户答案"""

        stream = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            stream=True
        )

        yield from self._iter_stream_content(stream)

    def select_quiz_questions(self, lecture_content: str,
                            available_questions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Select quiz questions based on lecture content.
        """
        questions_text = "\n".join([
            f"ID:{q['id']} 题目: {q['question_text']}"
            for q in available_questions
        ])

        # Truncate lecture content to avoid exceeding token limits
        max_content_len = 3000
        if len(lecture_content) > max_content_len:
            lecture_content = lecture_content[:max_content_len] + "..."

        prompt = f"""基于刚才的AI讲解内容，从题库中选择3道最相关的题目来测试用户掌握程度：

AI讲解内容：
{lecture_content}

可选题目：
{questions_text}

请分析讲解内容中涉及的知识点，从可选题目中选出3道最相关的题目。
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
