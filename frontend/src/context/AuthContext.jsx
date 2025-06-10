import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { isAuthenticated: isAuth0Authenticated, user: auth0User, getAccessTokenSilently } = useAuth0();

  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const token = localStorage.getItem('token');
        const rememberMe = localStorage.getItem('rememberMe') === 'true';
        
        if (token && rememberMe) {
          const response = await fetch('/api/auth/me', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const userData = await response.json();
            setUser(userData);
          } else {
            localStorage.removeItem('token');
            localStorage.removeItem('rememberMe');
          }
        }
      } catch (error) {
        if (!error.message?.includes('ECONNREFUSED') && !error.message?.includes('Failed to fetch')) {
          console.error('Session check error:', error);
        }
        if (error.message?.includes('ECONNREFUSED') || error.message?.includes('Failed to fetch')) {
          setTimeout(checkExistingSession, 2000);
          return;
        } else {
          localStorage.removeItem('token');
          localStorage.removeItem('rememberMe');
        }
      } finally {
        setLoading(false);
      }
    };

    if (!isAuth0Authenticated) {
      setTimeout(checkExistingSession, 1000);
    } else {
      setLoading(false);
    }
  }, [isAuth0Authenticated]);

  useEffect(() => {
    if (isAuth0Authenticated && auth0User) {
      setUser({
        ...auth0User,
        fullName: auth0User.name,
        profilePicture: auth0User.picture
      });
      setLoading(false);
    }
  }, [isAuth0Authenticated, auth0User]);

  const login = async (credentials) => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });
      
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(data.error || `HTTP ${response.status}: Login failed`);
      }

      const data = await response.json();

      setUser(data.user);
      localStorage.setItem('token', data.token);
      
      if (credentials.rememberMe) {
        localStorage.setItem('rememberMe', 'true');
      } else {
        localStorage.removeItem('rememberMe');
      }

      setLoading(false); 
      return data;
    } catch (error) {
      setLoading(false); 
      throw error;
    }
  };

  const signup = async (userData) => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(data.error || `HTTP ${response.status}: Signup failed`);
      }

      const data = await response.json();

      setUser(data.user);
      localStorage.setItem('token', data.token);
      
      if (userData.rememberMe) {
        localStorage.setItem('rememberMe', 'true');
      } else {
        localStorage.removeItem('rememberMe');
      }

      setLoading(false);
      return data;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const updateUser = async (updateData) => {
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Update failed');
      }

      setUser(data.user);
      return data;
    } catch (error) {
      throw error;
    }
  };

  const uploadProfilePicture = async (file) => {
    try {
      const formData = new FormData();
      formData.append('profilePicture', file);

      const response = await fetch('/api/upload/profile-picture', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Upload failed');
      }

      setUser(prev => ({
        ...prev,
        profilePicture: data.profilePicture
      }));

      return data;
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('rememberMe');
  };

  const value = {
    user,
    loading,
    login,
    signup,
    logout,
    updateUser,
    uploadProfilePicture
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};