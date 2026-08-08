import { Routes, Route } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { useState, useEffect, useRef } from 'react';
import type { Theme } from './types/ui';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import About from './pages/About';
import Resources from './pages/Resources';
import Events from './pages/Events';
import Challenges from './pages/Challenges';
import ChallengeDetail from './pages/ChallengeDetail';
import Auth from './pages/Auth';
import Account from './pages/Account';
import PublicProfile from './pages/PublicProfile';
import AdminDashboard from './pages/AdminDashboard';
import NotFoundPage from './pages/NotFoundPage';
import QuickSetup from './pages/QuickSetup';
import PrivacyPolicy from './pages/PrivacyPolicy';
import VaultTrap from './challenges/robotsTxtTrap/VaultTrap';
import CipheredSealProtocol from './challenges/cipheredSeal/CipheredSealProtocol';
import SqlInjectionSandbox from './challenges/sqlInjection/SqlInjectionSandbox';
import './App.css';
import './styles/VisualRefresh.css';

function AppContent() {
  const [theme, setTheme] = useState<Theme>((localStorage.getItem('theme') as Theme) || 'dark');
  const { error: auth0Error } = useAuth0();
  const { authError } = useAuth();
  const { showToast } = useToast();
  const reportedAuth0Error = useRef<Error | null>(null);
  const reportedAuthExchangeError = useRef<string | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!auth0Error || reportedAuth0Error.current === auth0Error) return;

    reportedAuth0Error.current = auth0Error;
    console.error('auth0 login error.', auth0Error);
    showToast(
      'Google sign-in could not be completed. Use email sign-in or contact an admin.',
      'error'
    );
  }, [auth0Error, showToast]);

  useEffect(() => {
    if (!authError || reportedAuthExchangeError.current === authError) return;

    reportedAuthExchangeError.current = authError;
    showToast(authError, 'error');
  }, [authError, showToast]);

  const toggleTheme = () => {
    const newTheme: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };

  return (
    <div className={`app ${theme}`}>
      <Routes>
        <Route element={<Layout theme={theme} toggleTheme={toggleTheme} />}>
          <Route path="/" element={<Landing theme={theme} />} />
          <Route path="/about" element={<About />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/events" element={<Events theme={theme} />} />
          <Route path="/challenges" element={<Challenges theme={theme} />} />
          <Route path="/challenges/:slug/lab" element={<SqlInjectionSandbox />} />
          <Route path="/challenges/:slug" element={<ChallengeDetail theme={theme} />} />
          <Route path="/challenge/:routeKey" element={<CipheredSealProtocol />} />
          <Route path="/auth" element={<Auth theme={theme} />} />
          <Route path="/setup" element={<QuickSetup theme={theme} />} />
          <Route path="/account" element={<Account theme={theme} />} />
          <Route path="/profile/:username" element={<PublicProfile theme={theme} />} />
          <Route path="/admin" element={<AdminDashboard theme={theme} />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/vault-a7f3" element={<VaultTrap theme={theme} />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
