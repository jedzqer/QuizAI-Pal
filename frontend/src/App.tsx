import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Quiz from './pages/Quiz';
import WrongQuestions from './pages/WrongQuestions';
import Lecture from './pages/Lecture';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app">
        <nav className="navbar">
          <div className="navbar-brand">
            <Link to="/">AI刷题助手</Link>
          </div>
          <ul className="navbar-menu">
            <li><Link to="/">首页</Link></li>
            <li><Link to="/quiz">刷题</Link></li>
            <li><Link to="/wrong">错题本</Link></li>
            <li><Link to="/lecture">AI讲解</Link></li>
          </ul>
        </nav>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/quiz" element={<Quiz />} />
            <Route path="/quiz/:questionId" element={<Quiz />} />
            <Route path="/wrong" element={<WrongQuestions />} />
            <Route path="/lecture" element={<Lecture />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
