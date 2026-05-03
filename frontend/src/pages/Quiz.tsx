import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { questionsApi, answersApi, aiApi } from '../services/api';
import type { Question, AnswerResponse } from '../types';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  gravity: number;
}

function ConfettiParticles({ trigger, isCorrect }: { trigger: number; isCorrect: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);

  const colors = isCorrect
    ? ['#10B981', '#34D399', '#6EE7B7', '#F59E0B', '#FBBF24', '#FDE68A']
    : ['#EF4444', '#F87171', '#FCA5A5'];

  const createParticles = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const particles: Particle[] = [];
    const count = isCorrect ? 60 : 30;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: canvas.height * 0.3,
        vx: (Math.random() - 0.5) * 12,
        vy: -Math.random() * 10 - 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 6 + 3,
        life: 1,
        gravity: 0.15 + Math.random() * 0.1,
      });
    }
    particlesRef.current = particles;
  }, [isCorrect]);

  useEffect(() => {
    if (trigger === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const parent = canvas.parentElement!;
    canvas.width = parent.offsetWidth;
    canvas.height = parent.offsetHeight;

    createParticles();
    let animId: number;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particlesRef.current = particlesRef.current.filter(p => {
        p.x += p.vx;
        p.vy += p.gravity;
        p.y += p.vy;
        p.life -= 0.015;
        if (p.life <= 0) return false;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size * 0.6);
        return true;
      });
      ctx.globalAlpha = 1;
      if (particlesRef.current.length > 0) {
        animId = requestAnimationFrame(animate);
      }
    };
    animate();
    return () => cancelAnimationFrame(animId);
  }, [trigger, createParticles]);

  return <canvas ref={canvasRef} className="confetti-canvas" />;
}

interface DialogMessage {
  id: string;
  role: 'ai' | 'user';
  content: string;
  timestamp: Date;
}

function Quiz() {
  const { questionId } = useParams();
  const navigate = useNavigate();
  const dialogEndRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const streamedContentRef = useRef<string>('');
  
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answerResult, setAnswerResult] = useState<AnswerResponse | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [dialogMessages, setDialogMessages] = useState<DialogMessage[]>([]);
  const [currentAiContent, setCurrentAiContent] = useState<string>('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [followUpQuestion, setFollowUpQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isMarkedConfusing, setIsMarkedConfusing] = useState(false);
  const [markLoading, setMarkLoading] = useState(false);
  const [currentNum, setCurrentNum] = useState(() => {
    const saved = localStorage.getItem('quiz_current_num');
    return saved ? parseInt(saved) : 1;
  });

  useEffect(() => {
    if (questionId) {
      loadQuestion(parseInt(questionId));
    } else {
      loadQuestionByNum(currentNum);
    }
  }, [questionId]);

  useEffect(() => {
    localStorage.setItem('quiz_current_num', currentNum.toString());
  }, [currentNum]);

  useEffect(() => {
    const el = dialogEndRef.current;
    if (!el) return;
    const container = el.closest('.dialog-cards');
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    if (scrollHeight - scrollTop - clientHeight < 150) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }, [dialogMessages, currentAiContent]);

  // Scroll to navigation buttons after answering
  useEffect(() => {
    if (answerResult) {
      setTimeout(() => {
        navRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 200);
    }
  }, [answerResult]);

  // Trigger answer feedback animation
  useEffect(() => {
    if (!answerResult) return;
    // Clear previous timeouts
    animTimeoutRef.current.forEach(t => clearTimeout(t));
    animTimeoutRef.current = [];

    const isCorrect = answerResult.is_correct;
    const shake = isCorrect ? 'shake-success' : 'shake-error';
    const resultAnim = isCorrect ? 'pop-scale' : 'fade-slide-in';
    const flash = isCorrect ? 'flash-success' : 'flash-error';

    setShakeClass(shake);
    setResultAnimClass(resultAnim);
    setFlashType(flash);
    if (isCorrect) {
      setParticleTrigger(prev => prev + 1);
    }

    const t1 = setTimeout(() => setShakeClass(''), 600);
    const t2 = setTimeout(() => setFlashType(null), 500);
    animTimeoutRef.current = [t1, t2];

    return () => {
      animTimeoutRef.current.forEach(t => clearTimeout(t));
    };
  }, [answerResult]);

  const loadQuestion = async (id: number) => {
    setLoading(true);
    setSelectedAnswer(null);
    setAnswerResult(null);
    setShowExplanation(false);
    setDialogMessages([]);
    setCurrentAiContent('');
    setSessionId(null);
    setIsMarkedConfusing(false);
    setMarkLoading(false);
    
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
    setDialogMessages([]);
    setCurrentAiContent('');
    setSessionId(null);
    setIsMarkedConfusing(false);
    setMarkLoading(false);
    
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

  const handleOptionClick = async (key: string) => {
    if (!currentQuestion || answerResult || loading) return;
    
    setSelectedAnswer(key);
    setLoading(true);
    try {
      const response = await answersApi.submitAnswer(currentQuestion.id, key);
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
    setIsStreaming(true);
    setShowExplanation(true);
    setCurrentAiContent('');
    streamedContentRef.current = '';

    await aiApi.explainAnswer(currentQuestion.id, selectedAnswer, {
      onChunk: (content) => {
        streamedContentRef.current += content;
        setCurrentAiContent(streamedContentRef.current);
      },
      onComplete: (newSessionId) => {
        setSessionId(newSessionId);
        setIsStreaming(false);
        setAiLoading(false);
        setDialogMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'ai',
          content: streamedContentRef.current,
          timestamp: new Date()
        }]);
        setCurrentAiContent('');
      },
      onError: (error) => {
        console.error('Failed to get explanation:', error);
        setIsStreaming(false);
        setAiLoading(false);
      }
    });
  };

  const handleMarkConfusing = async () => {
    if (!currentQuestion || markLoading) return;

    setMarkLoading(true);
    try {
      await answersApi.markConfusing(currentQuestion.id);
      setIsMarkedConfusing(true);
    } catch (error) {
      console.error('Failed to mark question as confusing:', error);
    } finally {
      setMarkLoading(false);
    }
  };

  // Auto-mark as confusing when answer is wrong
  useEffect(() => {
    if (answerResult && !answerResult.is_correct) {
      handleMarkConfusing();
    }
  }, [answerResult]);

  const handleFollowUp = async () => {
    if (!currentQuestion || !sessionId || !followUpQuestion.trim()) return;
    
    const question = followUpQuestion;
    setFollowUpQuestion('');
    
    // Add user message to dialog
    setDialogMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user',
      content: question,
      timestamp: new Date()
    }]);
    
    setAiLoading(true);
    setIsStreaming(true);
    setCurrentAiContent('');
    streamedContentRef.current = '';

    await aiApi.askQuestion(currentQuestion.id, sessionId, question, {
      onChunk: (content) => {
        streamedContentRef.current += content;
        setCurrentAiContent(streamedContentRef.current);
      },
      onComplete: () => {
        setIsStreaming(false);
        setAiLoading(false);
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
        setAiLoading(false);
      }
    });
  };

  const [shakeClass, setShakeClass] = useState<string>('');
  const [resultAnimClass, setResultAnimClass] = useState<string>('');
  const [flashType, setFlashType] = useState<'flash-success' | 'flash-error' | null>(null);
  const [particleTrigger, setParticleTrigger] = useState(0);
  const animTimeoutRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [slidePhase, setSlidePhase] = useState<'out-left' | 'out-right' | 'in-left' | 'in-right' | null>(null);

  const handleNext = () => {
    const nextNum = currentNum + 1;
    setSlidePhase('out-left');
    setTimeout(() => {
      setCurrentNum(nextNum);
      navigate(`/quiz`);
      loadQuestionByNum(nextNum);
      setSlidePhase('in-right');
      setTimeout(() => setSlidePhase(null), 180);
    }, 150);
  };

  const handlePrev = () => {
    if (currentNum > 1) {
      const prevNum = currentNum - 1;
      setSlidePhase('out-right');
      setTimeout(() => {
        setCurrentNum(prevNum);
        navigate(`/quiz`);
        loadQuestionByNum(prevNum);
        setSlidePhase('in-left');
        setTimeout(() => setSlidePhase(null), 180);
      }, 150);
    }
  };

  if (loading && !currentQuestion) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <div>正在加载题目...</div>
      </div>
    );
  }

  if (!currentQuestion) {
    return <div className="loading">暂无题目</div>;
  }

  return (
    <div className={`question-container ${slidePhase || ''} ${shakeClass}`}>
      {flashType && <div className={`answer-flash-overlay ${flashType}`} />}
      <ConfettiParticles trigger={particleTrigger} isCorrect={true} />
      {/* Question Header */}
      <div className="question-header">
        <span className="question-counter">题目 {currentNum}</span>
        <span className="question-num">编号 {currentQuestion.num}</span>
      </div>

      {/* Question Card */}
      <div className="card">
        <div className="question-text">{currentQuestion.question_text}</div>
        
        <div className="options-list">
          {Object.entries(currentQuestion.options).map(([key, value]) => (
            <button
              key={key}
              className={`option-btn ${
                answerResult && key === answerResult.correct_answer ? 'correct' : ''
              } ${
                answerResult && selectedAnswer === key && !answerResult.is_correct ? 'wrong' : ''
              } ${selectedAnswer === key && !answerResult ? 'selected' : ''}`}
              onClick={() => handleOptionClick(key)}
              disabled={!!answerResult || loading}
            >
              <span className="option-key">{key}.</span>
              <span>{value}</span>
            </button>
          ))}
        </div>

        {/* Answer Result */}
        {answerResult && (
          <div className={`answer-result ${answerResult.is_correct ? 'correct' : 'wrong'} ${resultAnimClass}`}>
            <div className="answer-result-text">
              {answerResult.is_correct ? (
                '✓ 回答正确！'
              ) : (
                `✗ 回答错误！正确答案是：${answerResult.correct_answer}`
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {answerResult && !showExplanation && (
          <div className="action-buttons">
            <button 
              className="btn btn-primary" 
              onClick={handleExplain}
            >
              请求AI解析
            </button>
            <button
              className="btn"
              onClick={handleMarkConfusing}
              disabled={isMarkedConfusing || markLoading}
            >
              {isMarkedConfusing ? '已加入错题本' : (markLoading ? '加入中...' : '标记为不懂')}
            </button>
          </div>
        )}
      </div>

      {/* AI Conversation Section */}
      {showExplanation && (
        <div className="conversation-section">
          <div className="conversation-header">
            <span className="icon">◆</span>
            <span>AI 解析与对话</span>
            {isStreaming && <span className="conversation-streaming">正在输出...</span>}
          </div>
          
          <div className="dialog-cards">
            {/* Historical Messages */}
            {dialogMessages.map((msg) => (
              <div key={msg.id} className={`dialog-card dialog-card-${msg.role}`}>
                <div className="dialog-card-header">
                  <span className="dialog-role">
                    {msg.role === 'ai' ? 'AI 助手' : '你的追问'}
                  </span>
                  <span className="dialog-timestamp">
                    {msg.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="dialog-card-body">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            ))}
            
            {/* Current Streaming AI Response */}
            {isStreaming && currentAiContent && (
              <div className="dialog-card dialog-card-ai">
                <div className="dialog-card-header">
                  <span className="dialog-role">AI 助手</span>
                  <span className="dialog-timestamp">正在生成...</span>
                </div>
                <div className="dialog-card-body">
                  <ReactMarkdown>{currentAiContent}</ReactMarkdown>
                  <span className="streaming-cursor"></span>
                </div>
              </div>
            )}
            
            {/* AI Thinking State */}
            {aiLoading && !currentAiContent && (
              <div className="dialog-card dialog-card-ai">
                <div className="dialog-card-header">
                  <span className="dialog-role">AI 助手</span>
                </div>
                <div className="ai-thinking">
                  正在思考中
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
                disabled={!followUpQuestion.trim() || aiLoading || isStreaming}
              >
                {aiLoading ? '思考中...' : '发送追问'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="nav-buttons" ref={navRef}>
        <button 
          className="btn" 
          onClick={handlePrev}
          disabled={currentNum <= 1}
        >
          ← 上一题
        </button>
        <button 
          className="btn btn-primary" 
          onClick={handleNext}
        >
          下一题 →
        </button>
      </div>
    </div>
  );
}

export default Quiz;
