
import { API_CONFIG, buildApiUrl } from '../config/api';

interface LoginCredentials {
  email?: string;
  password?: string;
  provider?: string;
  token?: string;
}

interface UserInfo {
  email: string;
  password?: string;
  username: string;
  provider?: string;
}

export const loginUser = async (credentials: LoginCredentials) => {
  const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.AUTH.LOGIN), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    throw new Error('Login failed');
  }

  return response.json();
};

export const registerUser = async (userInfo: UserInfo) => {
  const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.AUTH.REGISTER), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userInfo),
  });

  if (!response.ok) {
    throw new Error('Registration failed');
  }

  return response.json();
};
