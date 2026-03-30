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

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://cxj1v57w5d.execute-api.us-east-1.amazonaws.com/prod';


const getStoredItem = (key) => {
  return localStorage.getItem(key) || sessionStorage.getItem(key);
};

const setStoredItem = (key, value, rememberMe = null) => {
  const shouldRemember = rememberMe !== null ? rememberMe : localStorage.getItem('rememberMe') === 'true';
  const storage = shouldRemember ? localStorage : sessionStorage;
  
  if (shouldRemember) {
    sessionStorage.removeItem(key);
  } else {
    localStorage.removeItem(key);
  }
  
  storage.setItem(key, value);
};

const clearStoredItem = (key) => {
  localStorage.removeItem(key);
  sessionStorage.removeItem(key);
};

// Generate device ID for this browser
const generateDeviceId = () => {
  let deviceId = getStoredItem('deviceId');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    // Device ID always goes in localStorage for persistence
    localStorage.setItem('deviceId', deviceId);
  }
  return deviceId;
};

// Helper to get initial user state from cache
const getInitialUserState = () => {
  try {
    const accessToken = getStoredItem('accessToken');
    const refreshToken = getStoredItem('refreshToken');
    const cachedUser = getStoredItem('cachedUser');
    
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
  const accessToken = getStoredItem('accessToken');
  const refreshToken = getStoredItem('refreshToken');
  const cachedUser = getStoredItem('cachedUser');
  
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
      const refreshToken = getStoredItem('refreshToken');
      
      if (refreshToken) {
        // Attempt to logout on server
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getStoredItem('accessToken')}`
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
      // Clear all auth data from both storages
      setUser(null);
      clearStoredItem('accessToken');
      clearStoredItem('refreshToken');
      clearStoredItem('cachedUser');
      clearStoredItem('deviceId');
      localStorage.removeItem('rememberMe');
      
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

    const refreshToken = getStoredItem('refreshToken');
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
        
        // Update stored tokens using appropriate storage
        setStoredItem('accessToken', data.accessToken);
        setStoredItem('refreshToken', data.refreshToken);
        setStoredItem('cachedUser', JSON.stringify(data.user));
        
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
      const accessToken = getStoredItem('accessToken');
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
        const accessToken = getStoredItem('accessToken');
        const refreshToken = getStoredItem('refreshToken');
        
        if (accessToken && refreshToken) {
          setLoading(false);
          
          // Verify token in background
          try {
            const userData = await authAPI.getCurrentUser();
            setUser(userData);
            setStoredItem('cachedUser', JSON.stringify(userData));
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
      
      const { rememberMe, ...restCredentials } = credentials;
      
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...restCredentials,
          deviceId,
          rememberMe: !!rememberMe
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

      // Store rememberMe preference in localStorage (always)
      localStorage.setItem('rememberMe', rememberMe ? 'true' : 'false');
      
      setUser(data.user);
      setStoredItem('accessToken', data.accessToken, !!rememberMe);
      setStoredItem('refreshToken', data.refreshToken, !!rememberMe);
      setStoredItem('cachedUser', JSON.stringify(data.user), !!rememberMe);

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
      
      const { rememberMe, ...restUserData } = userData;
      
      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...restUserData,
          deviceId,
          rememberMe: !!rememberMe
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

      // Store rememberMe preference in localStorage (always)
      localStorage.setItem('rememberMe', rememberMe ? 'true' : 'false');
      
      // Store tokens in appropriate storage based on rememberMe
      setUser(data.user);
      setStoredItem('accessToken', data.accessToken, !!rememberMe);
      setStoredItem('refreshToken', data.refreshToken, !!rememberMe);
      setStoredItem('cachedUser', JSON.stringify(data.user), !!rememberMe);

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
    setStoredItem('cachedUser', JSON.stringify(response.user));
    
    return response;
  };

  const uploadProfilePicture = async (file) => {
    const formData = new FormData();
    formData.append('profilePicture', file);

    const response = await fetch(`${API_BASE_URL}/upload/profile-picture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getStoredItem('accessToken')}`
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
              'Authorization': `Bearer ${getStoredItem('accessToken')}`
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
            setStoredItem('cachedUser', JSON.stringify(updatedUser));
            
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
    setStoredItem('cachedUser', JSON.stringify(updatedUser));

    return data;
  };

  const getAwsCredentials = async (password) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/aws-credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getStoredItem('accessToken')}`
        },
        body: JSON.stringify({ password })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to retrieve AWS credentials');
      }

      return data.awsCredentials;
    } catch (error) {
      console.error('Get AWS credentials error:', error);
      throw error;
    }
  };

  const markAwsCredentialsViewed = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/mark-aws-credentials-viewed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getStoredItem('accessToken')}`
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to mark credentials as viewed');
      }

      // Update user state
      setUser(prevUser => ({
        ...prevUser,
        hasViewedAwsCredentials: true
      }));

      return data;
    } catch (error) {
      console.error('Mark AWS credentials viewed error:', error);
      throw error;
    }
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
    forceLogoutAndClearData,
    getAwsCredentials,
    markAwsCredentialsViewed
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};