'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  name?: string;
}

interface Session {
  token: string;
  expires_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  validateSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load session from localStorage on mount
  useEffect(() => {
    const loadSession = async () => {
      const storedToken = localStorage.getItem('auth_token');
      
      if (storedToken) {
        const valid = await validateStoredSession(storedToken);
        if (!valid) {
          localStorage.removeItem('auth_token');
        }
      }
      
      setIsLoading(false);
    };

    loadSession();
  }, []);

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

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isAuthenticated: !!user && !!session,
        login,
        register,
        logout,
        validateSession,
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
