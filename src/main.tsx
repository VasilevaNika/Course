import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import App, { NotFound } from './App';
import { ProgressProvider } from './ProgressContext';
import MapPage from './pages/MapPage';
import TopicPage from './pages/TopicPage';
import SettingsPage from './pages/SettingsPage';
import AchievementsPage from './pages/AchievementsPage';
import CouponPage from './pages/CouponPage';
import ExamListPage from './pages/ExamListPage';
import ExamRunPage from './pages/ExamRunPage';
import './styles.css';
import './map.css';

// Data router (а не <HashRouter>) нужен для useBlocker: предупреждение при уходе из боя.
const router = createHashRouter([
  {
    element: <App />,
    children: [
      { path: '/', element: <MapPage /> },
      { path: '/topic/:id', element: <TopicPage /> },
      { path: '/exam', element: <ExamListPage /> },
      { path: '/exam/:id', element: <ExamRunPage /> },
      { path: '/achievements', element: <AchievementsPage /> },
      { path: '/coupon/:id', element: <CouponPage /> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProgressProvider>
      <RouterProvider router={router} />
    </ProgressProvider>
  </StrictMode>,
);
