import { useNavigate, useLocation } from 'react-router-dom';
import { useCallback } from 'react';

export interface ApiError extends Error {
  status?: number;
  code?: string;
}

export const useErrorHandler = (logout?: () => void) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleError = useCallback((error: ApiError) => {
    // Check if it's a chatbot not found (404), forbidden (403), or unauthorized (401) error
    if (error.status === 404 || error.status === 403 || error.status === 401 || 
        error.message?.toLowerCase().includes('not found') ||
        error.message?.toLowerCase().includes('forbidden') ||
        error.message?.toLowerCase().includes('unauthorized') ||
        error.message?.toLowerCase().includes('session expired')) {
      
      // For 401 (unauthorized) and 403 (forbidden) errors, clear authentication state
      if ((error.status === 401 || error.status === 403) && logout) {
        logout();
      }
      
      // Determine current route and navigate accordingly
      if (location.pathname === '/login') {
        // If already in login, stay there - don't redirect
        return;
      } else if (location.pathname.startsWith('/chatbot/') || location.pathname === '/builder') {
        // If in chatbot builder, go to dashboard
        navigate('/', { replace: true });
      } else if (location.pathname === '/') {
        // If in dashboard, go to login
        navigate('/login', { replace: true });
      }
    }
  }, [navigate, location.pathname, logout]);

  return { handleError };
};

export default useErrorHandler;