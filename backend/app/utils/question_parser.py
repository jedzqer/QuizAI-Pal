import json
import re
from typing import List, Dict, Any


def parse_question_text(question_text: str) -> tuple[str, Dict[str, str]]:
    """
    Parse question text to extract the question and options.
    
    Format: "question text A.option1 B.option2 C.option3"
    Returns: (question_text, {"A": "option1", "B": "option2", "C": "option3"})
    """
    # Pattern to match options like A. B. C. etc.
    pattern = r'\s+([A-Z])\.(.*?)(?=\s+[A-Z]\.|$)'
    matches = re.findall(pattern, question_text)
    
    if not matches:
        return question_text, {}
    
    # Find where options start
    first_option_pattern = r'\s+[A-Z]\.'
    first_match = re.search(first_option_pattern, question_text)
    
    if first_match:
        q_text = question_text[:first_match.start()].strip()
    else:
        q_text = question_text
    
    options = {}
    for letter, content in matches:
        options[letter] = content.strip()
    
    return q_text, options


def parse_question_bank(json_content: str) -> List[Dict[str, Any]]:
    """
    Parse the raw question bank JSON into structured data.
    
    Input format: [{"num": 1, "question": "...", "answer": "C"}, ...]
    Output format: [{"num": 1, "question_text": "...", "options": {...}, "correct_answer": "C", "category": None, "tags": []}, ...]
    """
    raw_questions = json.loads(json_content)
    parsed_questions = []
    
    for raw in raw_questions:
        question_text, options = parse_question_text(raw["question"])
        
        parsed = {
            "num": raw["num"],
            "question_text": question_text,
            "options": json.dumps(options, ensure_ascii=False),
            "correct_answer": raw["answer"],
            "category": None,
            "tags": json.dumps([], ensure_ascii=False)
        }
        parsed_questions.append(parsed)
    
    return parsed_questions
