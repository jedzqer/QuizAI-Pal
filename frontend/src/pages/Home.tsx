import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { answersApi } from '../services/api';
import type { Statistics } from '../types';

function Home() {
  const [stats, setStats] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStatistics();
  }, []);

  const loadStatistics = async () => {
    try {
      const response = await answersApi.getStatistics();
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <div>正在加载数据...</div>
      </div>
    );
  }

  return (
    <div>
      <header style={{ marginBottom: '48px' }}>
        <h1>AI刷题助手</h1>
        <p className="subtitle">智能学习，高效备考</p>
      </header>
      
      {/* Statistics */}
      {stats && (
        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.total_questions}</div>
            <div className="stat-label">题库总数</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.answered_questions}</div>
            <div className="stat-label">已答题数</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.accuracy_rate}%</div>
            <div className="stat-label">正确率</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.wrong_questions_count}</div>
            <div className="stat-label">待巩固</div>
          </div>
        </section>
      )}

      {/* Progress Bar */}
      {stats && (
        <div className="card">
          <div className="card-title">学习进度</div>
          <div className="progress-container">
            <div className="progress-header">
              <span className="progress-label">完成度</span>
              <span className="progress-value">
                {stats.answered_questions} / {stats.total_questions} 题
              </span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${(stats.answered_questions / stats.total_questions) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="card" style={{ marginTop: '24px' }}>
        <div className="card-title">快捷入口</div>
        <div className="quick-actions">
          <Link to="/quiz" className="quick-action-card">
            <span className="quick-action-icon">✦</span>
            <div className="quick-action-title">开始刷题</div>
          </Link>
          <Link to="/wrong" className="quick-action-card">
            <span className="quick-action-icon">✦</span>
            <div className="quick-action-title">错题本</div>
          </Link>
          <Link to="/lecture" className="quick-action-card">
            <span className="quick-action-icon">✦</span>
            <div className="quick-action-title">AI讲解</div>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Home;
