import { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { questionsApi, aiApi } from '../services/api';
import { WrongQuestion, Question } from '../types';

function Lecture() {
  const location = useLocation();
  const wrongQuestionIds = location.state?.wrongQuestionIds || [];
  
  const [wrongQuestions, setWrongQuestions] = useState<WrongQuestion[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>(wrongQuestionIds);
  const [lectureContent, setLectureContent] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [lectureLoading, setLectureLoading] = useState(false);
  const [followUpQuestion, setFollowUpQuestion] = useState('');

  useEffect(() => {
    loadWrongQuestions();
  }, []);

  const loadWrongQuestions = async () => {
    setLoading(true);
    try {
      const response = await questionsApi.getWrongQuestions();
      setWrongQuestions(response.data);
      if (wrongQuestionIds.length === 0) {
        setSelectedIds(response.data.map((wq: WrongQuestion) => wq.id));
      }
    } catch (error) {
      console.error('Failed to load wrong questions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const handleStartLecture = async () => {
    if (selectedIds.length === 0) return;
    
    setLectureLoading(true);
    setLectureContent(null);
    setQuizQuestions([]);
    
    try {
      const response = await aiApi.startLecture(selectedIds);
      setLectureContent(response.data.content);
      setSessionId(response.data.session_id || null);
    } catch (error) {
      console.error('Failed to start lecture:', error);
    } finally {
      setLectureLoading(false);
    }
  };

  const handleFollowUp = async () => {
    if (!sessionId || !followUpQuestion.trim()) return;
    
    setLectureLoading(true);
    try {
      // We need a question ID for the API, but for lecture we can use 0
      const response = await aiApi.askQuestion(0, sessionId, followUpQuestion);
      setLectureContent(prev => (prev || '') + '\n\n**追问：** ' + followUpQuestion + '\n\n**回答：** ' + response.data.content);
      setFollowUpQuestion('');
    } catch (error) {
      console.error('Failed to ask question:', error);
    } finally {
      setLectureLoading(false);
    }
  };

  const handleGenerateQuiz = async () => {
    if (!lectureContent || selectedIds.length === 0) return;
    
    setLoading(true);
    try {
      // Extract knowledge points from lecture content (simplified)
      const knowledgePoints = ['安全电压', '接地保护', '漏电保护'];
      
      const questionIds = wrongQuestions
        .filter(wq => selectedIds.includes(wq.id))
        .map(wq => wq.question_id);
      
      const response = await aiApi.generateQuiz(knowledgePoints, questionIds);
      setQuizQuestions(response.data.questions);
    } catch (error) {
      console.error('Failed to generate quiz:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && wrongQuestions.length === 0) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div>
      <h1 style={{ marginBottom: '24px' }}>AI智能讲解</h1>
      
      {/* Wrong Questions Selection */}
      {!lectureContent && (
        <div className="card">
          <div className="card-title">选择错题进行讲解</div>
          <div style={{ marginBottom: '16px' }}>
            <span>已选择 {selectedIds.length} 道题</span>
            <button 
              className="btn" 
              style={{ marginLeft: '16px' }}
              onClick={() => setSelectedIds(wrongQuestions.map(wq => wq.id))}
            >
              全选
            </button>
            <button 
              className="btn" 
              style={{ marginLeft: '8px' }}
              onClick={() => setSelectedIds([])}
            >
              清空
            </button>
          </div>
          
          {wrongQuestions.map((wq) => (
            <div key={wq.id} className="checkbox-item">
              <input
                type="checkbox"
                checked={selectedIds.includes(wq.id)}
                onChange={() => handleSelect(wq.id)}
              />
              <span>
                题号 {wq.question.num}: {wq.question.question_text.substring(0, 50)}...
              </span>
            </div>
          ))}
          
          <button 
            className="btn btn-primary btn-lg" 
            style={{ marginTop: '16px' }}
            onClick={handleStartLecture}
            disabled={selectedIds.length === 0 || lectureLoading}
          >
            {lectureLoading ? 'AI准备中...' : '开始讲解'}
          </button>
        </div>
      )}

      {/* Lecture Content */}
      {lectureContent && (
        <div className="card">
          <div className="card-title">讲解内容</div>
          <div className="lecture-content">{lectureContent}</div>
          
          <div className="ai-input-group" style={{ marginTop: '24px' }}>
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
              disabled={!followUpQuestion.trim() || lectureLoading}
            >
              {lectureLoading ? '思考中...' : '提问'}
            </button>
          </div>
          
          <button 
            className="btn btn-success" 
            style={{ marginTop: '16px' }}
            onClick={handleGenerateQuiz}
            disabled={loading}
          >
            {loading ? '生成中...' : '生成测试题'}
          </button>
        </div>
      )}

      {/* Quiz Questions */}
      {quizQuestions.length > 0 && (
        <div className="card quiz-section">
          <div className="card-title">测试题目</div>
          {quizQuestions.map((q, index) => (
            <div key={q.id} style={{ marginBottom: '24px', padding: '16px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
              <div style={{ marginBottom: '12px' }}>
                <strong>第 {index + 1} 题:</strong> {q.question_text}
              </div>
              <div style={{ color: 'var(--text-secondary)' }}>
                {Object.entries(q.options).map(([key, value]) => (
                  <div key={key} style={{ marginBottom: '4px' }}>
                    {key}. {value}
                  </div>
                ))}
              </div>
              <Link 
                to={`/quiz/${q.id}`} 
                className="btn btn-primary"
                style={{ marginTop: '12px' }}
              >
                去做题
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Lecture;
