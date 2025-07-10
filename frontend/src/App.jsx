import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { Auth0Provider } from '@auth0/auth0-react';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { auth0Config } from './config/auth0';
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
    
    if (location.pathname !== '/' && location.pathname !== '/auth' && location.pathname !== '/account' && location.pathname !== '/admin' && location.pathname !== '/setup' && !location.pathname.startsWith('/profile/')) {
      navigate('/', { replace: true });
    }
  }, [location, navigate]);

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
    <Auth0Provider
      domain={auth0Config.domain}
      clientId={auth0Config.clientId}
      authorizationParams={{
        redirect_uri: auth0Config.redirectUri,
        audience: auth0Config.audience,
      }}
      cacheLocation="localstorage"
      useRefreshTokens={true}
    >
      <AuthProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </AuthProvider>
    </Auth0Provider>
  );
}

export default App;
