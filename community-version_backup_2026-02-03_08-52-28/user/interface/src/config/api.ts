// Citadel API Configuration
// This file contains all API endpoints and configuration for the Nave

// Runtime environment configuration interface
interface RuntimeEnv {
  CATHEDRAL_API_URL?: string;
  API_URL?: string;
  WS_URL?: string;
}

// Extend Window interface to include __ENV__
declare global {
  interface Window {
    __ENV__?: RuntimeEnv;
  }
}

// Get API URL from runtime config (window.__ENV__) or fallback to build-time env vars
function getRuntimeConfig(key: string, fallback: string): string {
  // Check for runtime config injected by entrypoint script (from docker-compose env vars)
  if (typeof window !== 'undefined' && window.__ENV__) {
    const envObj = window.__ENV__ as Record<string, string | undefined>;
    const value = envObj[key];
    if (value !== undefined && value !== '') {
      return value;
    }
  }
  // Fallback to build-time environment variables
  return import.meta.env[`VITE_${key}`] || fallback;
}

export const API_CONFIG = {
  // Base URL for the Citadel backend
  // In production, this should be set via environment variables
  // VITE_CATHEDRAL_API_URL is set to https://api.citadelai.app/api/user in docker-compose
  BASE_URL: getRuntimeConfig('CATHEDRAL_API_URL', import.meta.env.VITE_CATHEDRAL_API_URL || 'http://localhost:3002'),
  
  // API endpoints
  ENDPOINTS: {
    // Authentication Chapel
    AUTH: {
      LOGIN: '/api/auth/login',
      REGISTER: '/api/auth/register',
      REFRESH: '/api/auth/refresh',
      LOGOUT: '/api/auth/logout',
    },
    
    // Chat Chapel
    CHAT: {
      RESPOND: '/api/chat/respond',
      RESPOND_STREAMING: '/api/chat/respond-streaming',
      HISTORY: '/api/chat/history',
      SUGGESTIONS: '/api/chat/suggestions',
    },
    
    // Stones (Work Items) Chapel
    STONES: {
      LIST: '/api/stones',
      CREATE: '/api/stones',
      UPDATE: '/api/stones/:id',
      DELETE: '/api/stones/:id',
    },
    
    // Chapels (Modules) Chapel
    CHAPELS: {
      LIST: '/api/chapels',
      STATUS: '/api/chapels/status',
    },

    // Chatbots Chapel
    CHATBOTS: {
      LIST: '/api/chatbots',
    },
  },
  
  // Request configuration
  DEFAULT_HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  
  // Timeout configuration
  TIMEOUT: 10000, // 10 seconds
};

// Helper function to build full URLs
export const buildApiUrl = (endpoint: string): string => {
  // In development, use relative paths (proxy handles routing)
  // In production, use the BASE_URL from environment (VITE_CATHEDRAL_API_URL)
  // Note: VITE_CATHEDRAL_API_URL is set to https://api.citadelai.app/api/user in docker-compose
  const baseUrl = import.meta.env.DEV ? '' : (API_CONFIG.BASE_URL || 'https://api.citadelai.app');
  
  // If endpoint already starts with /api/user, and BASE_URL ends with /api/user, avoid duplication
  if (!import.meta.env.DEV && baseUrl.endsWith('/api/user') && endpoint.startsWith('/api/user')) {
    // Remove /api/user from endpoint since it's already in baseUrl
    const endpointWithoutPrefix = endpoint.replace(/^\/api\/user/, '');
    return `${baseUrl}${endpointWithoutPrefix}`;
  }
  
  return `${baseUrl}${endpoint}`;
};

// Helper function to create authenticated headers
export const getAuthHeaders = (token?: string): Record<string, string> => {
  const authToken = token || localStorage.getItem('citadel-token');
  
  return {
    ...API_CONFIG.DEFAULT_HEADERS,
    ...(authToken && { Authorization: `Bearer ${authToken}` }),
  };
};

// Mock API responses for development
export const MOCK_RESPONSES = {
  AUTH: {
    LOGIN_SUCCESS: {
      token: 'mock-jwt-token',
      user: {
        id: 'user-1',
        name: 'Citadel Builder',
        email: 'builder@citadel.dev',
      },
    },
  },
  
  CHAT: {
    WELCOME: "Welcome to the Citadel! I'm your architectural assistant - built to help not to replace.",
    RESPONSES: [
      "In the Citadel methodology, we build stone by stone, ensuring each element contributes to the greater architectural vision.",
      "Each module in our system serves a specific purpose, maintaining the principles of modularity and extensibility.",
      "The Citadel architecture emphasizes longevity - every decision we make today supports the system of tomorrow.",
    ],
    SUGGESTIONS: [
      { id: '1', text: "Show me the roadmap", icon: 'Building' },
      { id: '2', text: "Create a new Stone", icon: 'Sparkles' },
      { id: '3', text: "Explore existing Chapels", icon: 'MessageSquare' },
    ],
  },
};