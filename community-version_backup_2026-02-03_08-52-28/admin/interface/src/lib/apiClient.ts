// Global reference to the logout function - will be set by the AuthProvider
let globalLogout: (() => void) | null = null;

// Function to set the global logout function
export const setGlobalLogout = (logoutFn: () => void) => {
  globalLogout = logoutFn;
};

// Centralized API client that handles authentication and errors
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async makeRequest(
    endpoint: string,
    options: RequestInit = {},
    token?: string
  ): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: HeadersInit = {
      ...options.headers,
    };

    // Only set Content-Type for JSON data, not for FormData
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle 401 Unauthorized responses
    // Don't redirect if we're on the success/cancel pages (they handle auth separately)
    if (response.status === 401) {
      const currentPath = window.location.pathname;
      const isSubscriptionPage = currentPath.includes('/subscription/success') || currentPath.includes('/subscription/cancel');
      
      if (!isSubscriptionPage) {
        // Clear authentication state and redirect to login
        if (globalLogout) {
          globalLogout();
        }
        
        // Redirect to login page
        window.location.href = '/login';
      }
      
      // Throw an error to stop further processing
      throw new Error('Session expired. Please log in again.');
    }

    return response;
  }

  async get(endpoint: string, token?: string): Promise<Response> {
    return this.makeRequest(endpoint, { method: 'GET' }, token);
  }

  async post(endpoint: string, data?: unknown, token?: string): Promise<Response> {
    return this.makeRequest(endpoint, {
      method: 'POST',
      body: data ? (data instanceof FormData ? data : JSON.stringify(data)) : undefined,
    }, token);
  }

  async put(endpoint: string, data?: unknown, token?: string): Promise<Response> {
    return this.makeRequest(endpoint, {
      method: 'PUT',
      body: data ? (data instanceof FormData ? data : JSON.stringify(data)) : undefined,
    }, token);
  }

  async delete(endpoint: string, token?: string): Promise<Response> {
    return this.makeRequest(endpoint, { method: 'DELETE' }, token);
  }
}

// Runtime environment configuration interface
interface RuntimeEnv {
  ADMIN_API_URL?: string;
  USER_API_URL?: string;
  USER_INTERFACE_URL?: string;
  FEATURE_BILLING?: string;
  FEATURE_ENTERPRISE?: string;
  FEATURE_ADVANCED_ANALYTICS?: string;
  FEATURE_PREMIUM_AI_MODELS?: string;
  FEATURE_ADMINJS_DASHBOARD?: string;
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
  if (typeof window !== 'undefined' && window.__ENV__ && window.__ENV__[key as keyof RuntimeEnv] !== undefined && window.__ENV__[key as keyof RuntimeEnv] !== '') {
    return window.__ENV__[key as keyof RuntimeEnv] || fallback;
  }
  // Fallback to build-time environment variables (for main instance)
  return import.meta.env[`VITE_${key}`] || fallback;
}

// Create API client instances
const ADMIN_API_URL = getRuntimeConfig('ADMIN_API_URL', import.meta.env.VITE_API_URL || import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:3002/api/admin');
const USER_API_URL = getRuntimeConfig('USER_API_URL', import.meta.env.VITE_USER_API_URL || 'http://localhost:3002/api');

// User interface URL for test mode
export const USER_INTERFACE_URL = getRuntimeConfig('USER_INTERFACE_URL', import.meta.env.VITE_USER_INTERFACE_URL || 'http://localhost:8080');

export const adminApiClient = new ApiClient(ADMIN_API_URL);
export const userApiClient = new ApiClient(USER_API_URL);

// Helper function to handle API responses and throw appropriate errors
export const handleApiResponse = async (response: Response): Promise<unknown> => {
  if (!response.ok) {
    let errorMessage = 'Request failed';
    let errorData: { error?: string; message?: string } = {};
    
    try {
      errorData = await response.json();
      errorMessage = errorData.error || errorData.message || errorMessage;
    } catch {
      errorMessage = response.statusText || errorMessage;
    }
    
    // Create error object that mimics axios error structure for compatibility
    const error = new Error(errorMessage) as Error & { 
      status: number;
      response?: {
        status: number;
        statusText: string;
        data: { error?: string; message?: string };
      };
    };
    error.status = response.status;
    error.response = {
      status: response.status,
      statusText: response.statusText,
      data: errorData,
    };
    throw error;
  }

  // Handle 204 No Content responses
  if (response.status === 204) {
    return true;
  }

  return response.json();
};