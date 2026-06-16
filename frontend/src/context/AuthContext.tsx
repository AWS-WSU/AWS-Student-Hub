import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { authAPI } from '../utils/api';
import type {
  AuthContextValue,
  AuthResponse,
  LoginCredentials,
  ProfileUpdatePayload,
  SignupPayload,
} from '../types/auth';
import type { User } from '../types/user';

interface JwtPayload {
  exp: number;
  id?: string;
  email?: string;
  tokenVersion?: number;
}

interface AuthProviderProps {
  children: ReactNode;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'https://bx7226tmz2.execute-api.us-east-1.amazonaws.com/prod';

const getStoredItem = (key: string): string | null => {
  return localStorage.getItem(key) || sessionStorage.getItem(key);
};

const setStoredItem = (key: string, value: string, rememberMe: boolean | null = null): void => {
  const shouldRemember =
    rememberMe !== null ? rememberMe : localStorage.getItem('rememberMe') === 'true';
  const storage = shouldRemember ? localStorage : sessionStorage;

  if (shouldRemember) {
    sessionStorage.removeItem(key);
  } else {
    localStorage.removeItem(key);
  }

  storage.setItem(key, value);
};

const clearStoredItem = (key: string): void => {
  localStorage.removeItem(key);
  sessionStorage.removeItem(key);
};

// Generate device ID for this browser
const generateDeviceId = (): string => {
  let deviceId = getStoredItem('deviceId');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    // Device ID always goes in localStorage for persistence
    localStorage.setItem('deviceId', deviceId);
  }
  return deviceId;
};

// Helper to get initial user state from cache
const getInitialUserState = (): User | null => {
  try {
    const accessToken = getStoredItem('accessToken');
    const refreshToken = getStoredItem('refreshToken');
    const cachedUser = getStoredItem('cachedUser');

    if (accessToken && refreshToken && cachedUser) {
      return JSON.parse(cachedUser) as User;
    }
  } catch {
    console.warn('failed to parse cached user data.');
  }
  return null;
};

// Helper to get initial loading state
const getInitialLoadingState = (): boolean => {
  const accessToken = getStoredItem('accessToken');
  const refreshToken = getStoredItem('refreshToken');
  const cachedUser = getStoredItem('cachedUser');

  // If we have valid cached data, don't show loading
  return !(accessToken && refreshToken && cachedUser);
};

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(getInitialUserState);
  const [loading, setLoading] = useState<boolean>(getInitialLoadingState);
  const refreshPromiseRef = useRef<Promise<AuthResponse | void> | null>(null);
  const deviceId = generateDeviceId();
  const { isAuthenticated: isAuth0Authenticated, user: auth0User } = useAuth0();

  const logout = useCallback(
    async (allDevices = false): Promise<void> => {
      try {
        const refreshToken = getStoredItem('refreshToken');

        if (refreshToken) {
          // Attempt to logout on server
          await fetch(`${API_BASE_URL}/auth/logout`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${getStoredItem('accessToken')}`,
            },
            body: JSON.stringify({
              refreshToken,
              deviceId,
              allDevices,
            }),
          }).catch(() => {
            // Ignore errors - logout locally anyway
          });
        }
      } catch (error) {
        console.error('logout error.', error);
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
    },
    [deviceId]
  );

  // Force clear all corrupted data - for debugging browser issues
  const forceLogoutAndClearData = useCallback(() => {
    console.log('force clearing all browser data due to corrupted state.');
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
            deviceId,
          }),
        });

        if (!response.ok) {
          throw new Error('Token refresh failed');
        }

        const data = await response.json();

        // Update stored tokens using appropriate storage
        localStorage.setItem('rememberMe', data.rememberMe ? 'true' : 'false');
        setStoredItem('accessToken', data.accessToken);
        setStoredItem('refreshToken', data.refreshToken);
        setStoredItem('cachedUser', JSON.stringify(data.user));

        setUser(data.user);
        return data;
      } catch (error) {
        console.error('token refresh failed.', error);
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
        const payload = JSON.parse(atob(accessToken.split('.')[1] || '')) as JwtPayload;
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
        console.error('error setting up token refresh.', error);
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
            console.error('token verification failed.', verifyError);

            // If access token is expired, try to refresh
            const authError = verifyError as Error & { status?: number };
            if (authError.message?.includes('expired') || authError.status === 401) {
              try {
                await refreshTokens();
              } catch (refreshError) {
                console.error('token refresh failed during verification.', refreshError);
                logout();
              }
            } else if (
              !authError.message?.includes('ECONNREFUSED') &&
              !authError.message?.includes('Failed to fetch') &&
              !authError.message?.includes('timeout')
            ) {
              logout();
            }
          }
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('session check error.', error);
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
        ...(auth0User as Record<string, unknown>),
        fullName: auth0User.name || auth0User.email || '',
        email: auth0User.email || '',
        username: auth0User.nickname || auth0User.email || '',
        profilePicture: auth0User.picture,
      } as User);
      setLoading(false);
    }
  }, [isAuth0Authenticated, auth0User]);

  const login = async (credentials: LoginCredentials): Promise<AuthResponse> => {
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
          rememberMe: !!rememberMe,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Network error' }));

        if (data.errors && Array.isArray(data.errors)) {
          const errorMessages = data.errors.map((err: { msg?: string }) => err.msg).join('. ');
          throw new Error(errorMessages);
        }

        throw new Error(data.error || `HTTP ${response.status}: Login failed`);
      }

      const data = (await response.json()) as AuthResponse;

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

  const signup = async (userData: SignupPayload): Promise<AuthResponse> => {
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
          rememberMe: !!rememberMe,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Network error' }));

        if (data.errors && Array.isArray(data.errors)) {
          const errorMessages = data.errors.map((err: { msg?: string }) => err.msg).join('. ');
          throw new Error(errorMessages);
        }

        throw new Error(data.error || `HTTP ${response.status}: Signup failed`);
      }

      const data = (await response.json()) as AuthResponse;

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

  const updateUser = async (updateData: ProfileUpdatePayload) => {
    const response = await authAPI.updateProfile(updateData);

    setUser(response.user);

    // Update cached user data
    setStoredItem('cachedUser', JSON.stringify(response.user));

    return response;
  };

  const uploadProfilePicture = async (file: File | Blob): Promise<Record<string, unknown>> => {
    const formData = new FormData();
    formData.append('profilePicture', file);

    const response = await fetch(`${API_BASE_URL}/upload/profile-picture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getStoredItem('accessToken')}`,
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
              Authorization: `Bearer ${getStoredItem('accessToken')}`,
            },
            body: formData,
          });

          if (retryResponse.ok) {
            const retryData = await retryResponse.json();

            const updatedUser = {
              ...user,
              profilePicture: retryData.profilePicture,
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
      profilePicture: data.profilePicture,
    };

    setUser(updatedUser);
    setStoredItem('cachedUser', JSON.stringify(updatedUser));

    return data;
  };

  const getAwsCredentials = async (password: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/aws-credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getStoredItem('accessToken')}`,
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to retrieve AWS credentials');
      }

      return data.awsCredentials;
    } catch (error) {
      console.error('get aws credentials error.', error);
      throw error;
    }
  };

  const markAwsCredentialsViewed = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/mark-aws-credentials-viewed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getStoredItem('accessToken')}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to mark credentials as viewed');
      }

      // Update user state
      setUser((prevUser) => ({
        ...prevUser,
        hasViewedAwsCredentials: true,
      }));

      return data;
    } catch (error) {
      console.error('mark aws credentials viewed error.', error);
      throw error;
    }
  };

  const value: AuthContextValue = {
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
    markAwsCredentialsViewed,
    isAuthenticated: isAuth0Authenticated || !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
