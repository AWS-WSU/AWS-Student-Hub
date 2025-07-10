import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { authAPI } from '../utils/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

// Helper to get initial user state from cache
const getInitialUserState = () => {
  try {
    const token = localStorage.getItem('token');
    const rememberMe = localStorage.getItem('rememberMe') === 'true';
    const cachedUser = localStorage.getItem('cachedUser');
    
    if (token && rememberMe && cachedUser) {
      return JSON.parse(cachedUser);
    }
  } catch (e) {
    console.warn('Failed to parse cached user data');
  }
  return null;
};

// Helper to get initial loading state
const getInitialLoadingState = () => {
  const token = localStorage.getItem('token');
  const rememberMe = localStorage.getItem('rememberMe') === 'true';
  const cachedUser = localStorage.getItem('cachedUser');
  
  // If we have valid cached data, don't show loading
  return !(token && rememberMe && cachedUser);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(getInitialUserState);
  const [loading, setLoading] = useState(getInitialLoadingState);
  const { isAuthenticated: isAuth0Authenticated, user: auth0User } = useAuth0();

  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const token = localStorage.getItem('token');
        const rememberMe = localStorage.getItem('rememberMe') === 'true';
        const cachedUser = localStorage.getItem('cachedUser');
        
        if (token && rememberMe) {
          // Loading is already set to false in initial state if we have cached data
          setLoading(false);
          
          // Verify token in background and update user data
          try {
            const userData = await authAPI.getCurrentUser();
            setUser(userData);
            // Update cache with fresh data
            localStorage.setItem('cachedUser', JSON.stringify(userData));
          } catch (verifyError) {
            // Only clear user if token is actually invalid (not network errors)
            if (!verifyError.message?.includes('ECONNREFUSED') && 
                !verifyError.message?.includes('Failed to fetch') &&
                !verifyError.message?.includes('timeout')) {
              console.error('Token verification failed:', verifyError);
              setUser(null);
              localStorage.removeItem('token');
              localStorage.removeItem('rememberMe');
              localStorage.removeItem('cachedUser');
            }
          }
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Session check error:', error);
        setLoading(false);
      }
    };

    if (!isAuth0Authenticated) {
      checkExistingSession();
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
      
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });
      
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Network error' }));
        
        if (data.errors && Array.isArray(data.errors)) {
          const errorMessages = data.errors.map(err => err.msg).join('. ');
          throw new Error(errorMessages);
        }
        
        throw new Error(data.error || `HTTP ${response.status}: Login failed`);
      }

      const data = await response.json();

      setUser(data.user);
      localStorage.setItem('token', data.token);
      
      if (credentials.rememberMe) {
        localStorage.setItem('rememberMe', 'true');
        // Cache user data for optimistic loading
        localStorage.setItem('cachedUser', JSON.stringify(data.user));
      } else {
        localStorage.removeItem('rememberMe');
        localStorage.removeItem('cachedUser');
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
      
      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Network error' }));
        
        if (data.errors && Array.isArray(data.errors)) {
          const errorMessages = data.errors.map(err => err.msg).join('. ');
          throw new Error(errorMessages);
        }
        
        throw new Error(data.error || `HTTP ${response.status}: Signup failed`);
      }

      const data = await response.json();

      setUser(data.user);
      localStorage.setItem('token', data.token);
      
      if (userData.rememberMe) {
        localStorage.setItem('rememberMe', 'true');
        // Cache user data for optimistic loading
        localStorage.setItem('cachedUser', JSON.stringify(data.user));
      } else {
        localStorage.removeItem('rememberMe');
        localStorage.removeItem('cachedUser');
      }

      setLoading(false);
      return data;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const updateUser = async (updateData) => {
    const response = await authAPI.updateProfile(updateData);

    setUser(response.user);
    
    // Update cached user data if rememberMe is enabled
    const rememberMe = localStorage.getItem('rememberMe') === 'true';
    if (rememberMe) {
      localStorage.setItem('cachedUser', JSON.stringify(response.user));
    }
    
    return response;
  };

  const uploadProfilePicture = async (file) => {
    const formData = new FormData();
    formData.append('profilePicture', file);

    const response = await fetch(`${API_BASE_URL}/upload/profile-picture`, {
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

    const cacheBustedUrl = `${data.profilePicture}?t=${Date.now()}`;
    
    const updatedUser = {
      ...user,
      profilePicture: cacheBustedUrl
    };
    
    setUser(updatedUser);
    
    // Update cached user data if rememberMe is enabled
    const rememberMe = localStorage.getItem('rememberMe') === 'true';
    if (rememberMe) {
      localStorage.setItem('cachedUser', JSON.stringify(updatedUser));
    }

    return data;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('rememberMe');
    localStorage.removeItem('cachedUser');
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