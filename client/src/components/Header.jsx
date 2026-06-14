import { NavLink } from 'react-router-dom';
import '../styles/Header.css';

export default function Header({ darkMode, onToggleDark }) {
  return (
    <header className="header">
      <div className="header-inner">
        <div className="logo">
          <span className="logo-icon">📥</span>
          <h1>Video Downloader</h1>
        </div>
        <nav className="nav">
          <NavLink to="/" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Download
          </NavLink>
          <NavLink to="/history" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            History
          </NavLink>
        </nav>
        <button className="theme-toggle" onClick={onToggleDark} title="Toggle dark mode">
          {darkMode ? '☀️' : '🌙'}
        </button>
      </div>
    </header>
  );
}
