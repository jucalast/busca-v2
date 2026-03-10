'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';

interface User {
  id: string;
  email: string;
  name?: string;
}

interface CustomSession {
  token: string;
  expires_at: string;
}

interface AuthContextType {
  user: User | null;
  session: CustomSession | null;
  nextSession: any | null; // Google Session including accessToken
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  validateSession: () => Promise<boolean>;
  aiModel: string;
  setAiModel: (model: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Custom Auth state
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<CustomSession | null>(null);
  const [isLoadingCustom, setIsLoadingCustom] = useState(true);

  // NextAuth state
  const { data: nextSessionData, status: nextAuthStatus } = useSession();
  const isLoadingNextAuth = nextAuthStatus === 'loading';
  const isNextAuthenticated = nextAuthStatus === 'authenticated';

  // Global AI Model preference
  const [aiModel, setAiModel] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('global_ai_model') || 'gemini';
    }
    return 'gemini';
  });

  // Load purely custom session from localStorage on mount
  useEffect(() => {
    const loadSession = async () => {
      const storedToken = localStorage.getItem('auth_token');

      if (storedToken) {
        const valid = await validateStoredSession(storedToken);
        if (!valid) {
          localStorage.removeItem('auth_token');
        }
      }

      setIsLoadingCustom(false);
    };

    loadSession();
  }, []);

  // Sync AI Model preference to local storage
  useEffect(() => {
    localStorage.setItem('global_ai_model', aiModel);
  }, [aiModel]);

  const validateStoredSession = async (token: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/growth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'validate-session',
          token,
        }),
      });

      const data = await res.json();

      if (data.success && data.session) {
        setUser({
          id: data.session.user_id,
          email: data.session.email,
          name: data.session.name,
        });
        setSession({
          token: data.session.token,
          expires_at: data.session.expires_at,
        });
        return true;
      }

      return false;
    } catch {
      return false;
    }
  };

  const validateSession = async (): Promise<boolean> => {
    if (isNextAuthenticated) return true;
    if (!session?.token) return false;
    return validateStoredSession(session.token);
  };

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/growth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          email,
          password,
        }),
      });

      const data = await res.json();

      if (data.success && data.user && data.session) {
        setUser(data.user);
        setSession(data.session);
        localStorage.setItem('auth_token', data.session.token);
        return { success: true };
      }

      return { success: false, error: data.error || 'Erro ao fazer login' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro de conexão' };
    }
  };

  const loginWithGoogle = async () => {
    await signIn('google', { callbackUrl: '/' });
  };

  const register = async (email: string, password: string, name?: string) => {
    try {
      const res = await fetch('/api/growth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register',
          email,
          password,
          name,
        }),
      });

      const data = await res.json();

      if (data.success && data.user && data.session) {
        setUser(data.user);
        setSession(data.session);
        localStorage.setItem('auth_token', data.session.token);
        return { success: true };
      }

      return { success: false, error: data.error || 'Erro ao criar conta' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro de conexão' };
    }
  };

  const logout = async () => {
    // Fazer signOut de ambos os provedores
    if (isNextAuthenticated) {
      await signOut({ callbackUrl: '/' });
    }

    try {
      if (session?.token) {
        await fetch('/api/growth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'logout',
            token: session.token,
          }),
        });
      }
    } catch {
      // Ignore errors on logout
    } finally {
      setUser(null);
      setSession(null);
      localStorage.removeItem('auth_token');
    }
  };

  // Derive consolidated states
  const nextAuthUser: User | null = isNextAuthenticated && nextSessionData?.user ? {
    id: nextSessionData.user.email || 'default_google_user',
    email: nextSessionData.user.email || '',
    name: nextSessionData.user.name || undefined,
  } : null;

  const combinedUser = user || nextAuthUser;
  const combinedIsAuthenticated = !!user || isNextAuthenticated;
  const combinedIsLoading = isLoadingCustom || isLoadingNextAuth;

  return (
    <AuthContext.Provider
      value={{
        user: combinedUser,
        session, // Mantém a session antiga para hooks antigos se existirem
        nextSession: nextSessionData,
        isLoading: combinedIsLoading,
        isAuthenticated: combinedIsAuthenticated,
        login,
        loginWithGoogle,
        register,
        logout,
        validateSession,
        aiModel,
        setAiModel,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
