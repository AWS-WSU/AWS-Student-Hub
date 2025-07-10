import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { useState, useEffect } from 'react';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import Account from './pages/Account';
import PublicProfile from './pages/PublicProfile';
import AdminDashboard from './pages/AdminDashboard';
import NotFoundPage from './pages/NotFoundPage';
import QuickSetup from './pages/QuickSetup';
import './App.css';

function AppContent() {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const location = useLocation();
  const navigate = useNavigate();
  
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (location.pathname === '/' && location.hash) {
      setTimeout(() => {
        const element = document.getElementById(location.hash.substring(1));
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  }, [location.hash]);

  useEffect(() => {
    const validPaths = ['/', '/auth', '/account', '/admin', '/setup'];
    const isValidProfilePath = location.pathname.startsWith('/profile/');
    const isValidPath = validPaths.includes(location.pathname) || isValidProfilePath;
    
    if (!isValidPath && !location.state?.fromApp) {
      const timer = setTimeout(() => {
        navigate('/', { replace: true, state: { fromApp: true } });
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [location.pathname, navigate]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };

  return (
    <div className={`app ${theme}`}>
      <Routes>
        <Route path="/" element={<Landing theme={theme} toggleTheme={toggleTheme} />} />
        <Route path="/auth" element={<Auth theme={theme} />} />
        <Route path="/setup" element={<QuickSetup theme={theme} />} />
        <Route 
          path="/account" 
          element={<Account theme={theme} toggleTheme={toggleTheme} />} 
        />
        <Route 
          path="/profile/:username" 
          element={<PublicProfile theme={theme} toggleTheme={toggleTheme} />} 
        />
        <Route path="/admin" element={<AdminDashboard theme={theme} toggleTheme={toggleTheme} />} />
        <Route path="*" element={<NotFoundPage theme={theme} toggleTheme={toggleTheme} />} />
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
