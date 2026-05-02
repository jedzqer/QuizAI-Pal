import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Quiz from './pages/Quiz';
import WrongQuestions from './pages/WrongQuestions';
import Lecture from './pages/Lecture';
import QuestionBank from './pages/QuestionBank';
import './App.css';

function Navbar() {
  const location = useLocation();
  
  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/">QuizAI Pal</Link>
      </div>
      <ul className="navbar-menu">
        <li>
          <Link to="/" style={isActive('/') ? { color: 'var(--color-gold)', borderColor: 'var(--color-gold)' } : {}}>
            首页
          </Link>
        </li>
        <li>
          <Link to="/quiz" style={isActive('/quiz') ? { color: 'var(--color-gold)', borderColor: 'var(--color-gold)' } : {}}>
            刷题
          </Link>
        </li>
        <li>
          <Link to="/wrong" style={isActive('/wrong') ? { color: 'var(--color-gold)', borderColor: 'var(--color-gold)' } : {}}>
            错题本
          </Link>
        </li>
        <li>
          <Link to="/lecture" style={isActive('/lecture') ? { color: 'var(--color-gold)', borderColor: 'var(--color-gold)' } : {}}>
            AI讲解
          </Link>
        </li>
        <li>
          <Link to="/bank" style={isActive('/bank') ? { color: 'var(--color-gold)', borderColor: 'var(--color-gold)' } : {}}>
            题库
          </Link>
        </li>
      </ul>
    </nav>
  );
}

function App() {
  return (
    <Router>
      <div className="app">
        <Navbar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/quiz" element={<Quiz />} />
            <Route path="/quiz/:questionId" element={<Quiz />} />
            <Route path="/wrong" element={<WrongQuestions />} />
            <Route path="/lecture" element={<Lecture />} />
            <Route path="/bank" element={<QuestionBank />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
