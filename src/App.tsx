import { useEffect } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { content } from './lib/content';
import MapPage from './pages/MapPage';
import TopicPage from './pages/TopicPage';
import SettingsPage from './pages/SettingsPage';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <header className="topbar">
        <div className="container topbar__inner">
          <Link to="/" className="logo">
            {content.meta.title}
          </Link>
          <nav className="nav">
            <NavLink to="/" end>
              Карта
            </NavLink>
            <NavLink to="/settings">Настройки</NavLink>
          </nav>
        </div>
      </header>
      <main className="container main">
        <Routes>
          <Route path="/" element={<MapPage />} />
          <Route path="/topic/:id" element={<TopicPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </>
  );
}

function NotFound() {
  return (
    <div className="card">
      <h1>Такой страницы нет</h1>
      <p>
        <Link to="/">Вернуться на карту</Link>
      </p>
    </div>
  );
}
