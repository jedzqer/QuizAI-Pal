import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { questionsApi, answersApi, aiApi } from '../services/api';
import type { Question, AnswerResponse, AIResponse } from '../types';

function Quiz() {
  const { questionId } = useParams();
  const navigate = useNavigate();
  
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answerResult, setAnswerResult] = useState<AnswerResponse | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<AIResponse | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [followUpQuestion, setFollowUpQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [currentNum, setCurrentNum] = useState(1);

  useEffect(() => {
    if (questionId) {
      loadQuestion(parseInt(questionId));
    } else {
      loadQuestionByNum(currentNum);
    }
  }, [questionId]);

  const loadQuestion = async (id: number) => {
    setLoading(true);
    setSelectedAnswer(null);
    setAnswerResult(null);
    setShowExplanation(false);
    setAiExplanation(null);
    setSessionId(null);
    
    try {
      const response = await questionsApi.getQuestion(id);
      setCurrentQuestion(response.data);
    } catch (error) {
      console.error('Failed to load question:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadQuestionByNum = async (num: number) => {
    setLoading(true);
    setSelectedAnswer(null);
    setAnswerResult(null);
    setShowExplanation(false);
    setAiExplanation(null);
    setSessionId(null);
    
    try {
      const response = await questionsApi.getQuestions(num, 1);
      if (response.data.questions.length > 0) {
        setCurrentQuestion(response.data.questions[0]);
      }
    } catch (error) {
      console.error('Failed to load question:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = async () => {
    if (!currentQuestion || !selectedAnswer) return;
    
    setLoading(true);
    try {
      const response = await answersApi.submitAnswer(currentQuestion.id, selectedAnswer);
      setAnswerResult(response.data);
    } catch (error) {
      console.error('Failed to submit answer:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExplain = async () => {
    if (!currentQuestion || !selectedAnswer) return;
    
    setAiLoading(true);
    setShowExplanation(true);
    
    try {
      const response = await aiApi.explainAnswer(currentQuestion.id, selectedAnswer);
      setAiExplanation(response.data);
      setSessionId(response.data.session_id || null);
    } catch (error) {
      console.error('Failed to get explanation:', error);
    } finally {
      setAiLoading(false);
    }
  };

  const handleFollowUp = async () => {
    if (!currentQuestion || !sessionId || !followUpQuestion.trim()) return;
    
    setAiLoading(true);
    try {
      const response = await aiApi.askQuestion(currentQuestion.id, sessionId, followUpQuestion);
      setAiExplanation(prev => ({
        content: (prev?.content || '') + '\n\n**追问：** ' + followUpQuestion + '\n\n**回答：** ' + response.data.content,
        session_id: sessionId
      }));
      setFollowUpQuestion('');
    } catch (error) {
      console.error('Failed to ask question:', error);
    } finally {
      setAiLoading(false);
    }
  };

  const handleNext = () => {
    const nextNum = currentNum + 1;
    setCurrentNum(nextNum);
    navigate(`/quiz`);
    loadQuestionByNum(nextNum);
  };

  const handlePrev = () => {
    if (currentNum > 1) {
      const prevNum = currentNum - 1;
      setCurrentNum(prevNum);
      navigate(`/quiz`);
      loadQuestionByNum(prevNum);
    }
  };

  if (loading && !currentQuestion) {
    return <div className="loading">加载中...</div>;
  }

  if (!currentQuestion) {
    return <div className="loading">没有题目</div>;
  }

  return (
    <div className="question-container">
      {/* Progress */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span>题目 {currentNum}</span>
          <span>题号: {currentQuestion.num}</span>
        </div>
      </div>

      {/* Question */}
      <div className="card">
        <div className="question-text">{currentQuestion.question_text}</div>
        
        <div className="options-list">
          {Object.entries(currentQuestion.options).map(([key, value]) => (
            <button
              key={key}
              className={`option-btn ${
                selectedAnswer === key ? 'selected' : ''
              } ${
                answerResult && key === answerResult.correct_answer ? 'correct' : ''
              } ${
                answerResult && selectedAnswer === key && !answerResult.is_correct ? 'wrong' : ''
              }`}
              onClick={() => !answerResult && setSelectedAnswer(key)}
              disabled={!!answerResult}
            >
              <strong>{key}.</strong> {value}
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
          {!answerResult && (
            <button 
              className="btn btn-primary btn-lg" 
              onClick={handleAnswer}
              disabled={!selectedAnswer || loading}
            >
              {loading ? '提交中...' : '提交答案'}
            </button>
          )}
          
          {answerResult && !showExplanation && (
            <button 
              className="btn btn-primary" 
              onClick={handleExplain}
            >
              AI解析
            </button>
          )}
        </div>

        {/* Answer Result */}
        {answerResult && (
          <div style={{ 
            marginTop: '16px', 
            padding: '16px', 
            backgroundColor: answerResult.is_correct ? '#f6ffed' : '#fff2f0',
            borderRadius: '8px'
          }}>
            {answerResult.is_correct ? (
              <div style={{ color: 'var(--success-color)', fontWeight: 'bold' }}>
                ✓ 回答正确！
              </div>
            ) : (
              <div style={{ color: 'var(--error-color)' }}>
                ✗ 回答错误！正确答案是：{answerResult.correct_answer}
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI Explanation */}
      {showExplanation && (
        <div className="card ai-section">
          <div className="card-title">AI解析</div>
          {aiLoading && !aiExplanation ? (
            <div className="loading">AI思考中...</div>
          ) : (
            <>
              <div className="ai-content">{aiExplanation?.content}</div>
              
              <div className="ai-input-group">
                <input
                  type="text"
                  className="ai-input"
                  placeholder="继续提问..."
                  value={followUpQuestion}
                  onChange={(e) => setFollowUpQuestion(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleFollowUp()}
                />
                <button 
                  className="btn btn-primary"
                  onClick={handleFollowUp}
                  disabled={!followUpQuestion.trim() || aiLoading}
                >
                  {aiLoading ? '思考中...' : '提问'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="nav-buttons">
        <button 
          className="btn" 
          onClick={handlePrev}
          disabled={currentNum <= 1}
        >
          上一题
        </button>
        <button 
          className="btn btn-primary" 
          onClick={handleNext}
        >
          下一题
        </button>
      </div>
    </div>
  );
}

export default Quiz;
