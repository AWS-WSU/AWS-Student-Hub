// API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

// Helper function for making API requests
const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Get token from localStorage
  const token = localStorage.getItem('token');
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
  };

  const finalOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, finalOptions);
    
    // Check if the response has content
    const contentType = response.headers.get('content-type');
    let data;
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      throw new Error('Server response was not JSON');
    }

    if (!response.ok) {
      throw new Error(data.error || data.message || `HTTP error! status: ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error('API request failed:', error);
    if (error.message === 'Failed to fetch') {
      throw new Error('Unable to connect to the server. Please check your connection.');
    }
    throw error;
  }
};

// Newsletter API functions
export const newsletterAPI = {
  subscribe: async (email) => {
    return apiRequest('/newsletter/subscribe', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }
};

// Auth API functions
export const authAPI = {
  login: async (credentials) => {
    return apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },
  signup: async (userData) => {
    return apiRequest('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },
  getCurrentUser: async () => {
    return apiRequest('/auth/me');
  }
};

export { apiRequest };
