import React, { useState, ReactNode, useEffect } from 'react';
import { registerUser, loginUser, getMe } from '@/lib/api';
import { AuthContext } from './AuthContext.context';
import { setGlobalLogout } from '@/lib/apiClient';

interface User {
  id: string;
  email: string;
  name?: string;
  role: 'architect' | 'admin';
  provider?: 'email' | 'google' | 'microsoft' | 'sso';
  avatar?: string;
  company?: string;
  tutorialCompleted?: boolean;
  twoFactorEnabled?: boolean;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, company?: string, name?: string, invitationCode?: string) => Promise<boolean>;
  logout: () => void;
  updateUser: (userData: User) => void;
  setAuth: (token: string, userData: User) => void;
  refreshUser: () => Promise<void>;
}

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('auth_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('auth_token');
  });

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const { token, user } = await loginUser(email, password);
      setUser(user);
      setToken(token);
      localStorage.setItem('auth_user', JSON.stringify(user));
      localStorage.setItem('auth_token', token);
      console.log("User email:", user.email);
      return true;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  };

  const register = async (email: string, password: string, company?: string, name?: string, invitationCode?: string): Promise<boolean> => {
    try {
      await registerUser(email, password, company, name, invitationCode);
      // After successful registration, log the user in to get a token
      await login(email, password);
      return true;
    } catch (error) {
      console.error('Registration failed:', error);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_token');
  };

  const updateUser = (userData: User) => {
    setUser(userData);
    localStorage.setItem('auth_user', JSON.stringify(userData));
  };

  const setAuth = (newToken: string, userData: User) => {
    setToken(newToken);
    setUser(userData);
    localStorage.setItem('auth_token', newToken);
    localStorage.setItem('auth_user', JSON.stringify(userData));
  };

  const refreshUser = async () => {
    if (!token) return;
    try {
      const userData = await getMe(token);
      updateUser(userData as User);
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  // Set the global logout function for the API client
  useEffect(() => {
    setGlobalLogout(logout);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, updateUser, setAuth, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export { useAuth } from './AuthContext.hooks';