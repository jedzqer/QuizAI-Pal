import { useState, useEffect, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { questionsApi, aiApi } from '../services/api';
import type { StreamCallbacks } from '../services/api';
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
  const userScrolledUpRef = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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
  const [lectureMode, setLectureMode] = useState<'question' | 'comprehensive'>('comprehensive');
  const [showScrollBtn, setShowScrollBtn] = useState(false);

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

  // Track user scroll position to avoid force-scrolling when user scrolls up
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const atBottom = scrollHeight - scrollTop - clientHeight <= 80;
      userScrolledUpRef.current = !atBottom;
      setShowScrollBtn(!atBottom && isStreaming);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [lectureStarted, isStreaming]);

  // Hide scroll button when streaming stops
  useEffect(() => {
    if (!isStreaming) setShowScrollBtn(false);
  }, [isStreaming]);

  // Auto-scroll only when user hasn't scrolled up
  useEffect(() => {
    if (userScrolledUpRef.current) return;
    const el = dialogEndRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth' });
  }, [dialogMessages, currentAiContent]);

  const handleExitLecture = () => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
    setLectureLoading(false);
    setLectureStarted(false);
    setDialogMessages([]);
    setCurrentAiContent('');
    setSessionId(null);
    streamedContentRef.current = '';
    localStorage.removeItem(LECTURE_STORAGE_KEY);
  };

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

    const callbacks: StreamCallbacks = {
      onChunk: (content: string) => {
        streamedContentRef.current += content;
        setCurrentAiContent(streamedContentRef.current);
      },
      onComplete: (newSessionId: string) => {
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
      onError: (error: Error) => {
        console.error('Failed to start lecture:', error);
        // Save any partial content that was streamed before the error
        const partial = streamedContentRef.current;
        if (partial) {
          setDialogMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'ai',
            content: partial,
            timestamp: new Date()
          }]);
        }
        setIsStreaming(false);
        setLectureLoading(false);
        setCurrentAiContent('');
      },
      signal: controller.signal,
    };

    if (lectureMode === 'comprehensive') {
      await aiApi.startComprehensiveLecture(selectedIds, '', callbacks);
    } else {
      await aiApi.startLecture(selectedIds, callbacks);
    }
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
        streamedContentRef.current += content;
        setCurrentAiContent(streamedContentRef.current);
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
        const partial = streamedContentRef.current;
        if (partial) {
          setDialogMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'ai',
            content: partial,
            timestamp: new Date()
          }]);
        }
        setIsStreaming(false);
        setLectureLoading(false);
        setCurrentAiContent('');
      },
      signal: controller.signal,
    });
  };

  const handleGenerateQuiz = async () => {
    if (dialogMessages.length === 0) {
      alert('请先等待讲解内容生成完成');
      return;
    }
    if (selectedIds.length === 0) {
      alert('没有选中的错题，无法生成测试题');
      return;
    }

    const questionIds = wrongQuestions
      .filter(wq => selectedIds.includes(wq.id))
      .map(wq => wq.question_id);

    if (questionIds.length === 0) {
      alert('未找到对应的题目数据，请返回重新选择错题');
      return;
    }

    setLoading(true);
    try {
      const lectureContent = dialogMessages
        .filter(m => m.role === 'ai')
        .map(m => m.content)
        .join('\n');

      const response = await aiApi.generateQuiz(lectureContent, questionIds);
      setQuizQuestions(response.data.questions);
    } catch (error) {
      console.error('Failed to generate quiz:', error);
      alert('生成测试题失败，请稍后重试');
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

          {/* Lecture Mode Toggle */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '20px',
            padding: '4px',
            backgroundColor: 'var(--color-parchment)',
            borderRadius: '8px',
          }}>
            <button
              className="btn btn-sm"
              onClick={() => setLectureMode('comprehensive')}
              style={{
                flex: 1,
                backgroundColor: lectureMode === 'comprehensive' ? 'var(--color-burgundy)' : 'transparent',
                color: lectureMode === 'comprehensive' ? '#fff' : 'var(--color-burgundy)',
                border: 'none',
                transition: 'all 0.2s',
              }}
            >
              综合讲解
            </button>
            <button
              className="btn btn-sm"
              onClick={() => setLectureMode('question')}
              style={{
                flex: 1,
                backgroundColor: lectureMode === 'question' ? 'var(--color-burgundy)' : 'transparent',
                color: lectureMode === 'question' ? '#fff' : 'var(--color-burgundy)',
                border: 'none',
                transition: 'all 0.2s',
              }}
            >
              逐题讲解
            </button>
          </div>
          {lectureMode === 'comprehensive' && (
            <p style={{
              fontSize: '0.9em',
              color: 'var(--color-text-secondary)',
              marginBottom: '16px',
              fontFamily: 'var(--font-body)',
            }}>
              综合讲解：AI将提炼错题中的知识点，像老师上课一样进行系统性讲解，不限于具体题目。
            </p>
          )}
          {lectureMode === 'question' && (
            <p style={{
              fontSize: '0.9em',
              color: 'var(--color-text-secondary)',
              marginBottom: '16px',
              fontFamily: 'var(--font-body)',
            }}>
              逐题讲解：AI将针对每道错题逐一分析错误原因、讲解知识点。
            </p>
          )}

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
                  {wq.question.question_text.trim().substring(0, 60)}...
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="icon">◆</span>
              <span>讲解内容</span>
              {isStreaming && <span className="conversation-streaming">正在输出...</span>}
            </div>
            <button
              className="btn btn-sm"
              onClick={handleExitLecture}
              title="退出讲解，返回选题"
            >
              退出讲解
            </button>
          </div>
          
          <div className="dialog-cards" ref={scrollContainerRef}>
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

          {showScrollBtn && (
            <button
              className="btn btn-sm scroll-to-bottom-btn"
              onClick={() => {
                userScrolledUpRef.current = false;
                dialogEndRef.current?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              ↓ 回到底部
            </button>
          )}

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
