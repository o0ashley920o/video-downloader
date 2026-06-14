import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { io } from 'socket.io-client';
import Header from './components/Header.jsx';
import Downloader from './pages/Downloader.jsx';
import History from './pages/History.jsx';

export const socket = io('/', { autoConnect: true });

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('darkMode', darkMode);
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  return (
    <BrowserRouter>
      <div className={`app ${darkMode ? 'dark' : ''}`}>
        <Header darkMode={darkMode} onToggleDark={() => setDarkMode(!darkMode)} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Downloader />} />
            <Route path="/history" element={<History />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
