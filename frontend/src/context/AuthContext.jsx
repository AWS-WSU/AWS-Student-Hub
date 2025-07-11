import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
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

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://0jqaxbqaa2.execute-api.us-east-1.amazonaws.com/prod';

// Generate device ID for this browser
const generateDeviceId = () => {
  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('deviceId', deviceId);
  }
  return deviceId;
};

// Helper to get initial user state from cache
const getInitialUserState = () => {
  try {
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    const cachedUser = localStorage.getItem('cachedUser');
    
    if (accessToken && refreshToken && cachedUser) {
      return JSON.parse(cachedUser);
    }
  } catch {
    console.warn('Failed to parse cached user data');
  }
  return null;
};

// Helper to get initial loading state
const getInitialLoadingState = () => {
  const accessToken = localStorage.getItem('accessToken');
  const refreshToken = localStorage.getItem('refreshToken');
  const cachedUser = localStorage.getItem('cachedUser');
  
  // If we have valid cached data, don't show loading
  return !(accessToken && refreshToken && cachedUser);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(getInitialUserState);
  const [loading, setLoading] = useState(getInitialLoadingState);
  const refreshPromiseRef = useRef(null);
  const deviceId = generateDeviceId();
  const { isAuthenticated: isAuth0Authenticated, user: auth0User } = useAuth0();

  const logout = useCallback(async (allDevices = false) => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      
      if (refreshToken) {
        // Attempt to logout on server
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          },
          body: JSON.stringify({
            refreshToken,
            deviceId,
            allDevices
          }),
        }).catch(() => {
          // Ignore errors - logout locally anyway
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always clear local storage
      setUser(null);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('cachedUser');
      localStorage.removeItem('deviceId');
      
      // Clear refresh promise
      if (refreshPromiseRef.current) {
        refreshPromiseRef.current = null;
      }
    }
  }, [deviceId]);

  // Force clear all corrupted data - for debugging browser issues
  const forceLogoutAndClearData = useCallback(() => {
    console.log('Force clearing all browser data due to corrupted state');
    setUser(null);
    localStorage.clear();
    sessionStorage.clear();
    
    // Clear refresh promise
    if (refreshPromiseRef.current) {
      refreshPromiseRef.current = null;
    }
    
    // Force page reload to reset state
    window.location.reload();
  }, []);

  const refreshTokens = useCallback(async () => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      logout();
      return;
    }

    refreshPromiseRef.current = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            refreshToken,
            deviceId
          }),
        });

        if (!response.ok) {
          throw new Error('Token refresh failed');
        }

        const data = await response.json();
        
        // Update stored tokens
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        localStorage.setItem('cachedUser', JSON.stringify(data.user));
        
        setUser(data.user);
        return data;
      } catch (error) {
        console.error('Token refresh failed:', error);
        logout();
        throw error;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    return refreshPromiseRef.current;
  }, [deviceId, logout]);

  // Auto-refresh token before expiration
  useEffect(() => {
    const setupTokenRefresh = () => {
      const accessToken = localStorage.getItem('accessToken');
      if (!accessToken) return;

      try {
        const payload = JSON.parse(atob(accessToken.split('.')[1]));
        const expiresAt = payload.exp * 1000;
        const now = Date.now();
        const refreshTime = expiresAt - now - 60000; // Refresh 1 minute before expiry

        if (refreshTime > 0) {
          return setTimeout(() => {
            refreshTokens();
          }, refreshTime);
        } else {
          // Token already expired, try to refresh immediately
          refreshTokens();
        }
      } catch (error) {
        console.error('Error setting up token refresh:', error);
      }
    };

    if (user && !isAuth0Authenticated) {
      const timeoutId = setupTokenRefresh();
      return () => {
        if (timeoutId) clearTimeout(timeoutId);
      };
    }
  }, [user, isAuth0Authenticated, refreshTokens]);

  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const accessToken = localStorage.getItem('accessToken');
        const refreshToken = localStorage.getItem('refreshToken');
        
        if (accessToken && refreshToken) {
          setLoading(false);
          
          // Verify token in background
          try {
            const userData = await authAPI.getCurrentUser();
            setUser(userData);
            localStorage.setItem('cachedUser', JSON.stringify(userData));
          } catch (verifyError) {
            console.error('Token verification failed:', verifyError);
            
            // If access token is expired, try to refresh
            if (verifyError.message?.includes('expired') || verifyError.status === 401) {
              try {
                await refreshTokens();
              } catch (refreshError) {
                console.error('Token refresh failed during verification:', refreshError);
                logout();
              }
            } else if (!verifyError.message?.includes('ECONNREFUSED') && 
                      !verifyError.message?.includes('Failed to fetch') &&
                      !verifyError.message?.includes('timeout')) {
              logout();
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
  }, [isAuth0Authenticated, logout, refreshTokens]);

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
        body: JSON.stringify({
          ...credentials,
          deviceId
        }),
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
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('cachedUser', JSON.stringify(data.user));

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
        body: JSON.stringify({
          ...userData,
          deviceId
        }),
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
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('cachedUser', JSON.stringify(data.user));

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
    
    // Update cached user data
    localStorage.setItem('cachedUser', JSON.stringify(response.user));
    
    return response;
  };

  const uploadProfilePicture = async (file) => {
    const formData = new FormData();
    formData.append('profilePicture', file);

    const response = await fetch(`${API_BASE_URL}/upload/profile-picture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      // Try to refresh token if unauthorized
      if (response.status === 401) {
        try {
          await refreshTokens();
          // Retry the upload with new token
          const retryResponse = await fetch(`${API_BASE_URL}/upload/profile-picture`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
            },
            body: formData,
          });
          
          if (retryResponse.ok) {
            const retryData = await retryResponse.json();
            
            const updatedUser = {
              ...user,
              profilePicture: retryData.profilePicture
            };
            
            setUser(updatedUser);
            localStorage.setItem('cachedUser', JSON.stringify(updatedUser));
            
            return retryData;
          } else {
            const retryError = await retryResponse.json();
            throw new Error(retryError.message || 'Upload failed after token refresh');
          }
        } catch {
          logout();
          throw new Error('Session expired. Please log in again.');
        }
      }
      throw new Error(data.message || 'Upload failed');
    }

    const updatedUser = {
      ...user,
      profilePicture: data.profilePicture
    };
    
    setUser(updatedUser);
    localStorage.setItem('cachedUser', JSON.stringify(updatedUser));

    return data;
  };



  const value = {
    user,
    loading,
    login,
    signup,
    logout,
    updateUser,
    uploadProfilePicture,
    refreshTokens,
    forceLogoutAndClearData
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};