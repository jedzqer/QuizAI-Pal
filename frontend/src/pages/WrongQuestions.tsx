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
    return <div className="loading">加载中...</div>;
  }

  return (
    <div>
      <h1 style={{ marginBottom: '24px' }}>错题本</h1>
      
      {wrongQuestions.length === 0 ? (
        <div className="card">
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            暂无错题，继续加油！
          </div>
        </div>
      ) : (
        <>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <span>共 {wrongQuestions.length} 道错题</span>
                <button 
                  className="btn" 
                  style={{ marginLeft: '16px' }}
                  onClick={handleSelectAll}
                >
                  {selectedIds.length === wrongQuestions.length ? '取消全选' : '全选'}
                </button>
              </div>
              {selectedIds.length > 0 && (
                <Link 
                  to="/lecture" 
                  className="btn btn-primary"
                  state={{ wrongQuestionIds: selectedIds }}
                >
                  AI讲解选中题目 ({selectedIds.length})
                </Link>
              )}
            </div>
          </div>

          {wrongQuestions.map((wq) => (
            <div key={wq.id} className="wrong-question-item">
              <div className="checkbox-item">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(wq.id)}
                  onChange={() => handleSelect(wq.id)}
                />
              </div>
              <div className="wrong-question-info">
                <div style={{ marginBottom: '8px' }}>
                  <strong>题号 {wq.question.num}:</strong> {wq.question.question_text}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                  {Object.entries(wq.question.options).map(([key, value]) => (
                    <span key={key} style={{ marginRight: '16px' }}>
                      {key}. {value}
                    </span>
                  ))}
                </div>
                <div style={{ marginTop: '8px' }}>
                  <span className="wrong-count">错误次数: {wq.wrong_count}</span>
                  <span style={{ marginLeft: '16px', color: 'var(--text-secondary)' }}>
                    正确答案: {wq.question.correct_answer}
                  </span>
                </div>
              </div>
              <Link 
                to={`/quiz/${wq.question.id}`} 
                className="btn btn-primary"
              >
                重做
              </Link>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export default WrongQuestions;
