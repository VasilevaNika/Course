import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { content } from './lib/content';
import Toasts from './components/Toasts';

/** Общий каркас: шапка, тосты и страница с анимацией появления. */
export default function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <>
      <header className="topbar">
        <div className="container topbar__inner">
          <Link to="/" className="logo">
            {content.meta.title}
          </Link>
          <nav className="nav">
            <NavLink to="/" end>
              Карта
            </NavLink>
            <NavLink to="/exam">Боссы</NavLink>
            <NavLink to="/achievements">Ачивки</NavLink>
            <NavLink to="/settings">Настройки</NavLink>
          </nav>
        </div>
      </header>
      <Toasts />
      <main className="container main">
        <div className="page" key={pathname}>
          <Outlet />
        </div>
      </main>
    </>
  );
}

export function NotFound() {
  return (
    <div className="card">
      <h1>Такой страницы нет</h1>
      <p>
        <Link to="/">Вернуться на карту</Link>
      </p>
    </div>
  );
}
