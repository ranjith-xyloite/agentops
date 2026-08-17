import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { loginApi, getMeApi, setAuthToken, getAuthToken } from '../services/api';

interface AuthContextType {
  user: User | null;
  role: UserRole;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  demoLogin: (role: UserRole) => Promise<void>;
  logout: () => void;
}

const DEMO_CREDENTIALS: Record<UserRole, { u: string; p: string }> = {
  admin: { u: 'admin', p: 'admin123' },
  operator: { u: 'operator', p: 'operator123' },
  viewer: { u: 'viewer', p: 'viewer123' },
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const initAuth = async () => {
    const token = getAuthToken();
    if (token) {
      try {
        const me = await getMeApi();
        setUser(me);
      } catch (err) {
        console.warn('Session expired or invalid, logging out...');
        setAuthToken(null);
        setUser(null);
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    initAuth();
  }, []);

  const login = async (username: string, password: string) => {
    const res = await loginApi(username, password);
    setAuthToken(res.access_token);
    setUser(res.user);
  };

  const demoLogin = async (targetRole: UserRole) => {
    const creds = DEMO_CREDENTIALS[targetRole];
    await login(creds.u, creds.p);
  };

  const logout = () => {
    setAuthToken(null);
    setUser(null);
  };

  const role: UserRole = user?.role || 'viewer';
  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAuthenticated,
        isLoading,
        login,
        demoLogin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
