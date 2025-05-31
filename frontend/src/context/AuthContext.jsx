import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Check if user is authenticated on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const userData = await authAPI.getCurrentUser();
        setUser(userData);
      } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('token');
        setUser(null);
      }
    }
    setLoading(false);
  };

  const login = async (credentials) => {
    const response = await authAPI.login(credentials);
    localStorage.setItem('token', response.token);
    setUser(response.user);
    navigate('/');
  };

  const signup = async (userData) => {
    const response = await authAPI.signup(userData);
    localStorage.setItem('token', response.token);
    setUser(response.user);
    navigate('/');
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    navigate('/auth');
  };

  const value = {
    user,
    loading,
    login,
    signup,
    logout,
    checkAuth
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)'
      }}>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 