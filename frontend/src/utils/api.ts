import type { AdminStats, EmailQueueEntry } from '../types/admin';
import type { ApiResponse } from '../types/api';
import type { AuthResponse, LoginCredentials, SignupPayload } from '../types/auth';
import type { Event as FrontendEvent, EventFormPayload } from '../types/event';
import type { PublicProfile, User, UserRole } from '../types/user';

const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'https://bx7226tmz2.execute-api.us-east-1.amazonaws.com/prod';

type JsonRecord = Record<string, any>;

type RequestOptions = Omit<RequestInit, 'headers'> & {
  headers?: Record<string, string>;
};

interface UsersResponse {
  users: User[];
  pagination?: {
    totalPages: number;
    [key: string]: any;
  };
  [key: string]: any;
}

interface EmailQueueStatsResponse {
  stats: Record<string, any>;
  [key: string]: any;
}

interface EmailQueueEntriesResponse {
  entries?: EmailQueueEntry[];
  pagination?: {
    totalPages?: number;
    [key: string]: any;
  };
  [key: string]: any;
}

interface ProcessEmailQueueResponse {
  result?: {
    processed?: number;
    succeeded?: number;
    failed?: number;
    [key: string]: any;
  };
  [key: string]: any;
}

interface EventsListResponse {
  events?: FrontendEvent[];
  [key: string]: any;
}

interface EventMutationResponse {
  event: FrontendEvent;
  [key: string]: any;
}

interface EventNotificationResponse {
  emailsSent?: number;
  emailsFailed?: number;
  [key: string]: any;
}

interface DiscordInviteResponse {
  inviteUrl?: string;
  invite_url?: string;
  [key: string]: any;
}

// Get item from either storage (check both for backwards compatibility)
const getStoredItem = (key: string): string | null => {
  return localStorage.getItem(key) || sessionStorage.getItem(key);
};

// Clear item from both storages
const clearStoredItem = (key: string): void => {
  localStorage.removeItem(key);
  sessionStorage.removeItem(key);
};

const getAuthHeaders = (): Record<string, string> => {
  const token = getStoredItem('accessToken');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

const readJson = async <T = any>(response: Response): Promise<T> => {
  const contentType = response.headers.get('content-type');

  if (contentType && contentType.includes('application/json')) {
    return response.json() as Promise<T>;
  }

  throw new Error('Server response was not JSON');
};

const apiRequest = async <T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> => {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getStoredItem('accessToken');

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const finalOptions: RequestInit & { headers: Record<string, string> } = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers || {}),
    },
  };

  try {
    const response = await fetch(url, finalOptions);

    // If unauthorized and we have a refresh token, try to refresh
    if (response.status === 401) {
      const refreshToken = getStoredItem('refreshToken');
      if (refreshToken) {
        try {
          await refreshTokens();
          // Retry the original request with the new token
          finalOptions.headers.Authorization = `Bearer ${getStoredItem('accessToken')}`;
          const retryResponse = await fetch(url, finalOptions);
          const data = await readJson<JsonRecord>(retryResponse);

          if (!retryResponse.ok) {
            throw new Error(
              data.error || data.message || `HTTP error! status: ${retryResponse.status}`
            );
          }

          return data as T;
        } catch {
          // Refresh failed, logout user
          clearStoredItem('accessToken');
          clearStoredItem('refreshToken');
          clearStoredItem('cachedUser');
          throw new Error('Session expired. Please log in again.');
        }
      }
    }

    const data = await readJson<JsonRecord>(response);

    if (!response.ok) {
      throw new Error(data.error || data.message || `HTTP error! status: ${response.status}`);
    }

    return data as T;
  } catch (error) {
    console.error('api request failed.', error);
    if (error instanceof Error && error.message === 'Failed to fetch') {
      throw new Error('Unable to connect to the server. Please check your connection.');
    }
    throw error;
  }
};

// Set item to appropriate storage based on rememberMe
const setStoredItem = (key: string, value: string): void => {
  const shouldRemember = localStorage.getItem('rememberMe') === 'true';
  const storage = shouldRemember ? localStorage : sessionStorage;

  // Clear from the other storage
  if (shouldRemember) {
    sessionStorage.removeItem(key);
  } else {
    localStorage.removeItem(key);
  }

  storage.setItem(key, value);
};

const refreshTokens = async (): Promise<AuthResponse> => {
  const refreshToken = getStoredItem('refreshToken');
  const deviceId = getStoredItem('deviceId') || localStorage.getItem('deviceId');

  if (!refreshToken || !deviceId) {
    throw new Error('No refresh token available');
  }

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

  const data = (await response.json()) as AuthResponse;
  setStoredItem('accessToken', data.accessToken);
  setStoredItem('refreshToken', data.refreshToken);
  setStoredItem('cachedUser', JSON.stringify(data.user));

  return data;
};

const appendPayloadToForm = (form: FormData, payload: EventFormPayload | JsonRecord): void => {
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return;

    if (value instanceof Blob) {
      form.append(key, value);
      return;
    }

    form.append(key, String(value));
  });
};

export const newsletterAPI = {
  subscribe: async (email: string): Promise<ApiResponse> => {
    return apiRequest('/newsletter/subscribe', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },
};

export const authAPI = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    return response.json() as Promise<AuthResponse>;
  },

  signup: async (userData: SignupPayload): Promise<AuthResponse> => {
    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Signup failed');
    }

    return response.json() as Promise<AuthResponse>;
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get user');
    }

    return response.json() as Promise<User>;
  },

  updateProfile: async (
    updates: Partial<User> | JsonRecord
  ): Promise<{ user: User; [key: string]: any }> => {
    const response = await fetch(`${API_BASE_URL}/auth/profile`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update profile');
    }

    return response.json() as Promise<{ user: User; [key: string]: any }>;
  },

  checkUsername: async (username: string): Promise<JsonRecord> => {
    const response = await fetch(`${API_BASE_URL}/auth/check-username`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ username }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to check username');
    }

    return response.json();
  },

  getRecentUsers: async (limit = 6): Promise<UsersResponse> => {
    const response = await fetch(`${API_BASE_URL}/auth/recent-users?limit=${limit}`, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch recent users');
    }

    return response.json() as Promise<UsersResponse>;
  },

  getPublicProfile: async (
    username: string
  ): Promise<{ profile: PublicProfile; [key: string]: any }> => {
    const response = await fetch(`${API_BASE_URL}/auth/public-profile/${username}`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get public profile');
    }

    return response.json() as Promise<{ profile: PublicProfile; [key: string]: any }>;
  },

  uploadProfilePicture: async (file: File | Blob): Promise<JsonRecord> => {
    const formData = new FormData();
    formData.append('profilePicture', file);

    const token = getStoredItem('accessToken');
    const response = await fetch(`${API_BASE_URL}/upload/profile-picture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to upload profile picture');
    }

    return response.json();
  },

  searchUsers: async (query: string, limit = 10): Promise<UsersResponse> => {
    const params = new URLSearchParams({
      q: query,
      limit: limit.toString(),
    });

    const response = await fetch(`${API_BASE_URL}/auth/search?${params}`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to search users');
    }

    return response.json() as Promise<UsersResponse>;
  },

  forgotPassword: async (identifier: string): Promise<JsonRecord> => {
    const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  },

  verifyEmail: async (username: string, email: string): Promise<JsonRecord> => {
    const response = await fetch(`${API_BASE_URL}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to verify email');
    }

    return response.json();
  },

  verifyResetCode: async (identifier: string, code: string): Promise<JsonRecord> => {
    const response = await fetch(`${API_BASE_URL}/auth/verify-reset-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, code }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to verify reset code');
    }

    return response.json();
  },

  resetPassword: async (
    identifier: string,
    code: string,
    newPassword: string
  ): Promise<JsonRecord> => {
    const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, code, newPassword }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to reset password');
    }

    return response.json();
  },
};

export const discordAPI = {
  getInvite: async (): Promise<DiscordInviteResponse> => {
    return apiRequest('/discord-invite');
  },
};

export const adminAPI = {
  getDashboardStats: async (): Promise<{ stats: AdminStats; [key: string]: any }> => {
    const response = await fetch(`${API_BASE_URL}/admin/dashboard/stats`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch dashboard stats');
    }

    return response.json() as Promise<{ stats: AdminStats; [key: string]: any }>;
  },

  getAllUsers: async (
    page = 1,
    limit = 20,
    search = '',
    role = '',
    status = ''
  ): Promise<UsersResponse> => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(search && { search }),
      ...(role && { role }),
      ...(status && { status }),
    });

    const response = await fetch(`${API_BASE_URL}/admin/users?${params}`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch users');
    }

    return response.json() as Promise<UsersResponse>;
  },

  getUserDetails: async (userId: string): Promise<{ user: User; [key: string]: any }> => {
    const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch user details');
    }

    return response.json() as Promise<{ user: User; [key: string]: any }>;
  },

  updateUserRole: async (userId: string, role: UserRole): Promise<JsonRecord> => {
    const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/role`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ role }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update user role');
    }

    return response.json();
  },

  banUser: async (userId: string, reason: string): Promise<JsonRecord> => {
    const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/ban`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to ban user');
    }

    return response.json();
  },

  unbanUser: async (userId: string): Promise<JsonRecord> => {
    const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/unban`, {
      method: 'PUT',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to unban user');
    }

    return response.json();
  },

  deleteUser: async (userId: string): Promise<JsonRecord> => {
    const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete user');
    }

    return response.json();
  },

  // Email Queue Management
  getEmailQueueStats: async (): Promise<EmailQueueStatsResponse> => {
    const response = await fetch(`${API_BASE_URL}/admin/email-queue/stats`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch email queue stats');
    }

    return response.json() as Promise<EmailQueueStatsResponse>;
  },

  getEmailQueueEntries: async (
    status: string | null = null,
    page = 1,
    limit = 20
  ): Promise<EmailQueueEntriesResponse> => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(status && { status }),
    });

    const response = await fetch(`${API_BASE_URL}/admin/email-queue/entries?${params}`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch email queue entries');
    }

    return response.json() as Promise<EmailQueueEntriesResponse>;
  },

  retryQueuedEmail: async (queueId: string): Promise<JsonRecord> => {
    const response = await fetch(`${API_BASE_URL}/admin/email-queue/${queueId}/retry`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to retry email');
    }

    return response.json();
  },

  processEmailQueue: async (batchSize = 10): Promise<ProcessEmailQueueResponse> => {
    const response = await fetch(
      `${API_BASE_URL}/admin/email-queue/process?batchSize=${batchSize}`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to process email queue');
    }

    return response.json() as Promise<ProcessEmailQueueResponse>;
  },
};

export const eventsAPI = {
  listPublic: async (limit = 6): Promise<EventsListResponse> => {
    return apiRequest(`/events/public?limit=${limit}`);
  },
  get: async (eventId: string): Promise<EventMutationResponse> => {
    return apiRequest(`/events/${eventId}`);
  },
  adminList: async (page = 1, limit = 20): Promise<EventsListResponse> => {
    return apiRequest(`/events/admin?page=${page}&limit=${limit}`);
  },
  create: async (payload: EventFormPayload | JsonRecord): Promise<EventMutationResponse> => {
    const token = getStoredItem('accessToken');
    const form = new FormData();
    appendPayloadToForm(form, payload);
    const res = await fetch(`${API_BASE_URL}/events`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const data = (await res.json()) as EventMutationResponse & { error?: string };
    if (!res.ok) throw new Error(data.error || 'Failed to create event');
    return data;
  },
  update: async (
    eventId: string,
    payload: EventFormPayload | JsonRecord
  ): Promise<EventMutationResponse> => {
    const token = getStoredItem('accessToken');
    const form = new FormData();
    appendPayloadToForm(form, payload);
    const res = await fetch(`${API_BASE_URL}/events/${eventId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const data = (await res.json()) as EventMutationResponse & { error?: string };
    if (!res.ok) throw new Error(data.error || 'Failed to update event');
    return data;
  },
  delete: async (eventId: string): Promise<JsonRecord> => {
    return apiRequest(`/events/${eventId}`, { method: 'DELETE' });
  },
  sendNotification: async (
    eventId: string,
    customMessage = ''
  ): Promise<EventNotificationResponse> => {
    return apiRequest(`/events/${eventId}/notify`, {
      method: 'POST',
      body: JSON.stringify({ customMessage }),
    });
  },
};

export { apiRequest };
