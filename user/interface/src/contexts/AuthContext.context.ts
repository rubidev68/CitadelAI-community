import { createContext } from 'react';
import { AuthContextType } from './AuthContext';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
