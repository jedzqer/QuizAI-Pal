import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { questionsApi } from '../services/api';
import type { WrongQuestion } from '../types';

function WrongQuestions() {
  const [wrongQuestions, setWrongQuestions] = useState<WrongQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  useEffect(() => {
    loadWrongQuestions();
  }, []);

  const loadWrongQuestions = async () => {
    setLoading(true);
    try {
      const response = await questionsApi.getWrongQuestions();
      setWrongQuestions(response.data);
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

  const handleSelectAll = () => {
    if (selectedIds.length === wrongQuestions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(wrongQuestions.map(wq => wq.id));
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <div>正在加载错题...</div>
      </div>
    );
  }

  return (
    <div>
      <header style={{ marginBottom: '40px' }}>
        <h1>错题本</h1>
        <p className="subtitle">回顾薄弱知识点，巩固学习成果</p>
      </header>
      
      {wrongQuestions.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '80px 32px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '24px' }}>✦</div>
          <h3 style={{ marginBottom: '12px' }}>暂无错题</h3>
          <p style={{ color: 'var(--color-muted)', fontStyle: 'italic' }}>
            继续保持，你的学习表现很好！
          </p>
        </div>
      ) : (
        <>
          {/* Control Bar */}
          <div className="card">
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{ 
                  fontFamily: 'var(--font-display)', 
                  fontWeight: '600' 
                }}>
                  共 {wrongQuestions.length} 道错题
                </span>
                <button 
                  className="btn btn-sm" 
                  onClick={handleSelectAll}
                >
                  {selectedIds.length === wrongQuestions.length ? '取消全选' : '全选'}
                </button>
              </div>
              {selectedIds.length > 0 && (
                <Link 
                  to="/lecture" 
                  className="btn btn-primary btn-sm"
                  state={{ wrongQuestionIds: selectedIds }}
                >
                  AI讲解选中题目 ({selectedIds.length})
                </Link>
              )}
            </div>
          </div>

          {/* Wrong Questions List */}
          {wrongQuestions.map((wq, index) => (
            <div 
              key={wq.id} 
              className="wrong-question-item"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <label className="custom-checkbox">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(wq.id)}
                  onChange={() => handleSelect(wq.id)}
                />
                <span className="checkbox-visual"></span>
              </label>
              <div className="wrong-question-info">
                <div className="wrong-question-text">
                  <strong style={{ color: 'var(--color-burgundy)' }}>
                    题号 {wq.question.num}
                  </strong>
                  {' · '}
                  {wq.question.question_text}
                </div>
                <div style={{ 
                  fontSize: '0.875rem', 
                  color: 'var(--color-muted)',
                  marginBottom: '8px'
                }}>
                  {Object.entries(wq.question.options).map(([key, value]) => (
                    <span key={key} style={{ marginRight: '16px' }}>
                      {key}. {value}
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                  <span className="wrong-count">
                    错误 {wq.wrong_count} 次
                  </span>
                  <span style={{ 
                    fontSize: '0.875rem', 
                    color: 'var(--color-emerald)',
                    fontWeight: '600'
                  }}>
                    正确答案: {wq.question.correct_answer}
                  </span>
                </div>
              </div>
              <div className="wrong-question-actions">
                <Link 
                  to={`/quiz/${wq.question.id}`} 
                  className="btn btn-primary btn-sm"
                >
                  重做此题
                </Link>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export default WrongQuestions;
