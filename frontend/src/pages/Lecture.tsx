import { useState, useEffect, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { questionsApi, aiApi } from '../services/api';
import type { WrongQuestion, Question } from '../types';

const LECTURE_STORAGE_KEY = 'lecture_state';

interface LectureState {
  dialogMessages: Array<{ id: string; role: 'ai' | 'user'; content: string; timestamp: string }>;
  sessionId: string | null;
  selectedIds: number[];
  lectureStarted: boolean;
}

function saveLectureState(state: LectureState) {
  try {
    localStorage.setItem(LECTURE_STORAGE_KEY, JSON.stringify(state));
  } catch (_) { /* ignore quota errors */ }
}

function loadLectureState(): LectureState | null {
  try {
    const raw = localStorage.getItem(LECTURE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

interface DialogMessage {
  id: string;
  role: 'ai' | 'user';
  content: string;
  timestamp: Date;
}

function Lecture() {
  const location = useLocation();
  const wrongQuestionIds = location.state?.wrongQuestionIds || [];
  const dialogEndRef = useRef<HTMLDivElement>(null);
  const streamedContentRef = useRef<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  const saved = loadLectureState();

  const [wrongQuestions, setWrongQuestions] = useState<WrongQuestion[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>(
    wrongQuestionIds.length > 0 ? wrongQuestionIds : (saved?.selectedIds || [])
  );
  const [dialogMessages, setDialogMessages] = useState<DialogMessage[]>(
    saved?.dialogMessages.map(m => ({ ...m, timestamp: new Date(m.timestamp) })) || []
  );
  const [currentAiContent, setCurrentAiContent] = useState<string>('');
  const [sessionId, setSessionId] = useState<string | null>(saved?.sessionId || null);
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [lectureLoading, setLectureLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [followUpQuestion, setFollowUpQuestion] = useState('');
  const [lectureStarted, setLectureStarted] = useState(saved?.lectureStarted || false);

  // Persist lecture state on change
  useEffect(() => {
    if (lectureStarted) {
      saveLectureState({
        dialogMessages: dialogMessages.map(m => ({ ...m, timestamp: m.timestamp.toISOString() })),
        sessionId,
        selectedIds,
        lectureStarted,
      });
    }
  }, [dialogMessages, sessionId, selectedIds, lectureStarted]);

  // Abort stream on unmount, save partial content
  useEffect(() => {
    return () => {
      const partial = streamedContentRef.current;
      if (partial) {
        const state = loadLectureState();
        if (state) {
          state.dialogMessages.push({
            id: Date.now().toString(),
            role: 'ai',
            content: partial,
            timestamp: new Date().toISOString(),
          });
          saveLectureState(state);
        }
      }
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    loadWrongQuestions();
  }, []);

  useEffect(() => {
    const el = dialogEndRef.current;
    if (!el) return;
    const container = el.closest('.dialog-cards');
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    // Only auto-scroll if user is near the bottom (within 150px)
    if (scrollHeight - scrollTop - clientHeight < 150) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }, [dialogMessages, currentAiContent]);

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

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLectureLoading(true);
    setIsStreaming(true);
    setLectureStarted(true);
    setCurrentAiContent('');
    setDialogMessages([]);
    setQuizQuestions([]);

    streamedContentRef.current = '';

    await aiApi.startLecture(selectedIds, {
      onChunk: (content) => {
        setCurrentAiContent(prev => {
          streamedContentRef.current = prev + content;
          return prev + content;
        });
      },
      onComplete: (newSessionId) => {
        setSessionId(newSessionId);
        setIsStreaming(false);
        setLectureLoading(false);
        setDialogMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'ai',
          content: streamedContentRef.current,
          timestamp: new Date()
        }]);
        setCurrentAiContent('');
      },
      onError: (error) => {
        console.error('Failed to start lecture:', error);
        setIsStreaming(false);
        setLectureLoading(false);
      },
      signal: controller.signal,
    });
  };

  const handleFollowUp = async () => {
    if (!sessionId || !followUpQuestion.trim()) return;

    const question = followUpQuestion;
    setFollowUpQuestion('');

    setDialogMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user',
      content: question,
      timestamp: new Date()
    }]);

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLectureLoading(true);
    setIsStreaming(true);
    setCurrentAiContent('');
    streamedContentRef.current = '';

    await aiApi.askQuestion(0, sessionId, question, {
      onChunk: (content) => {
        setCurrentAiContent(prev => {
          streamedContentRef.current = prev + content;
          return prev + content;
        });
      },
      onComplete: () => {
        setIsStreaming(false);
        setLectureLoading(false);
        setDialogMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'ai',
          content: streamedContentRef.current,
          timestamp: new Date()
        }]);
        setCurrentAiContent('');
      },
      onError: (error) => {
        console.error('Failed to ask question:', error);
        setIsStreaming(false);
        setLectureLoading(false);
      },
      signal: controller.signal,
    });
  };

  const handleGenerateQuiz = async () => {
    if (dialogMessages.length === 0 || selectedIds.length === 0) return;
    
    setLoading(true);
    try {
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
    return (
      <div className="loading">
        <div className="spinner"></div>
        <div>正在加载...</div>
      </div>
    );
  }

  return (
    <div>
      <header style={{ marginBottom: '40px' }}>
        <h1>AI智能讲解</h1>
        <p className="subtitle">针对错题的深度解析与知识巩固</p>
      </header>
      
      {/* Wrong Questions Selection */}
      {!lectureStarted && (
        <div className="card">
          <div className="card-title">选择错题进行讲解</div>
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '20px',
            paddingBottom: '16px',
            borderBottom: '1px solid var(--color-parchment)'
          }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: '600' }}>
              已选择 {selectedIds.length} 道题
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="btn btn-sm" 
                onClick={() => setSelectedIds(wrongQuestions.map(wq => wq.id))}
              >
                全选
              </button>
              <button 
                className="btn btn-sm" 
                onClick={() => setSelectedIds([])}
              >
                清空
              </button>
            </div>
          </div>
          
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {wrongQuestions.map((wq) => (
              <div key={wq.id} className="checkbox-item">
                <label className="custom-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(wq.id)}
                    onChange={() => handleSelect(wq.id)}
                  />
                  <span className="checkbox-visual"></span>
                </label>
                <span style={{ fontFamily: 'var(--font-body)' }}>
                  <strong style={{ color: 'var(--color-burgundy)' }}>
                    题号 {wq.question.num}
                  </strong>
                  {' · '}
                  {wq.question.question_text.substring(0, 60)}...
                </span>
              </div>
            ))}
          </div>
          
          <button 
            className="btn btn-primary btn-lg" 
            style={{ marginTop: '24px', width: '100%' }}
            onClick={handleStartLecture}
            disabled={selectedIds.length === 0 || lectureLoading}
          >
            {lectureLoading ? 'AI准备中...' : '开始讲解'}
          </button>
        </div>
      )}

      {/* Lecture Conversation */}
      {lectureStarted && (
        <div className="conversation-section">
          <div className="conversation-header">
            <span className="icon">◆</span>
            <span>讲解内容</span>
            {isStreaming && <span className="conversation-streaming">正在输出...</span>}
          </div>
          
          <div className="dialog-cards">
            {dialogMessages.map((msg) => (
              <div key={msg.id} className={`dialog-card dialog-card-${msg.role}`}>
                <div className="dialog-card-header">
                  <span className="dialog-role">
                    {msg.role === 'ai' ? 'AI 讲师' : '你的追问'}
                  </span>
                  <span className="dialog-timestamp">
                    {msg.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="dialog-card-body lecture-content">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            ))}
            
            {isStreaming && currentAiContent && (
              <div className="dialog-card dialog-card-ai">
                <div className="dialog-card-header">
                  <span className="dialog-role">AI 讲师</span>
                  <span className="dialog-timestamp">正在生成...</span>
                </div>
                <div className="dialog-card-body lecture-content">
                  <ReactMarkdown>{currentAiContent}</ReactMarkdown>
                  <span className="streaming-cursor"></span>
                </div>
              </div>
            )}
            
            {lectureLoading && !currentAiContent && (
              <div className="dialog-card dialog-card-ai">
                <div className="dialog-card-header">
                  <span className="dialog-role">AI 讲师</span>
                </div>
                <div className="ai-thinking">
                  正在准备讲解内容
                  <span className="ai-thinking-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </span>
                </div>
              </div>
            )}
            
            <div ref={dialogEndRef} />
          </div>
          
          {/* Follow-up Input */}
          <div className="follow-up-section">
            <div className="follow-up-input-group">
              <input
                type="text"
                className="follow-up-input"
                placeholder="输入你的追问..."
                value={followUpQuestion}
                onChange={(e) => setFollowUpQuestion(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleFollowUp()}
                disabled={isStreaming}
              />
              <button 
                className="btn btn-primary"
                onClick={handleFollowUp}
                disabled={!followUpQuestion.trim() || lectureLoading || isStreaming}
              >
                {lectureLoading ? '思考中...' : '发送追问'}
              </button>
            </div>
          </div>
          
          {/* Generate Quiz Button */}
          <div style={{ marginTop: '24px' }}>
            <button 
              className="btn btn-success" 
              onClick={handleGenerateQuiz}
              disabled={loading || isStreaming}
              style={{ width: '100%' }}
            >
              {loading ? '生成测试题中...' : '基于讲解内容生成测试题'}
            </button>
          </div>
        </div>
      )}

      {/* Quiz Questions */}
      {quizQuestions.length > 0 && (
        <div className="card" style={{ marginTop: '24px' }}>
          <div className="card-title">测试题目</div>
          <div className="question-list">
            {quizQuestions.map((q, index) => (
              <div key={q.id} className="question-item">
                <span className="question-item-num">{index + 1}</span>
                <span className="question-item-text">
                  {q.question_text.substring(0, 80)}...
                </span>
                <Link 
                  to={`/quiz/${q.id}`} 
                  className="btn btn-primary btn-sm"
                >
                  做题
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Lecture;
