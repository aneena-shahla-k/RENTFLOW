import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getAccessToken, setAccessToken } from '../services/api';
import { Company, Subscription, User } from '../types';

interface AuthContextValue {
  user: User | null;
  company: Company | null;
  subscription: Subscription | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refreshSession: () => Promise<void>;
  setSessionData: (data: {
    accessToken: string;
    user: User;
    company?: Company | null;
  }) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const token = getAccessToken();
      if (!token) {
        // Attempt silent refresh via httpOnly cookie
        try {
          const refreshRes = await api.post('/auth/refresh', {});
          const newToken = refreshRes.data?.data?.accessToken;
          if (!newToken) {
            setUser(null);
            setCompany(null);
            setSubscription(null);
            return;
          }
          setAccessToken(newToken);
        } catch {
          setUser(null);
          setCompany(null);
          setSubscription(null);
          return;
        }
      }

      const res = await api.get('/auth/me');
      setUser(res.data.data.user);
      setCompany(res.data.data.company || null);
      setSubscription(res.data.data.subscription || null);
    } catch {
      setAccessToken(null);
      setUser(null);
      setCompany(null);
      setSubscription(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const setSessionData = useCallback(
    (data: { accessToken: string; user: User; company?: Company | null }) => {
      setAccessToken(data.accessToken);
      setUser(data.user);
      if (data.company !== undefined) {
        setCompany(data.company);
      }
      setIsLoading(false);
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', {});
    } catch {
      // Ignore logout network errors
    } finally {
      setAccessToken(null);
      setUser(null);
      setCompany(null);
      setSubscription(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        company,
        subscription,
        isLoading,
        isAuthenticated: Boolean(user),
        refreshSession,
        setSessionData,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
