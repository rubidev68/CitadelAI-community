import React, { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AuthContext } from './AuthContext.context';

// Define the shape of the context
export type AuthContextType = ReturnType<typeof useAuth>;

// Create the provider component
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const auth = useAuth();

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
};
