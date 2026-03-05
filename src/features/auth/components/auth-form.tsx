'use client';

import React, { useState } from 'react';
import { Lock, Mail, User, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image';
import ParticleLoader from '@/features/shared/components/particle-loader';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AuthForm() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login, register, loginWithGoogle, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const result = await login(email, password);
        if (!result.success) {
          setError(result.error || 'Erro ao fazer login');
        }
      } else {
        if (!name.trim()) {
          setError('Nome é obrigatório');
          setLoading(false);
          return;
        }
        const result = await register(email, password, name);
        if (!result.success) {
          setError(result.error || 'Erro ao criar conta');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao processar requisição');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError('');
  };

  return (
    <div className="min-h-screen flex overflow-hidden" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* Form Side */}
      <div
        className="w-full lg:w-[40%] flex flex-col justify-center px-8 sm:px-16 py-12 z-10 relative overflow-y-auto"
        style={{ backgroundColor: 'var(--color-bg)' }}
      >
        <div className="w-full max-w-sm mx-auto">
          {/* Logo and Header */}
          <div className="mb-10 text-center lg:text-left">
            <div className="inline-flex items-center justify-center lg:justify-start mb-10">
              <Image
                src="/logo.png"
                alt="Logo"
                width={120}
                height={120}
                className="rounded-2xl"
                priority
              />
            </div>
            <h1
              className="text-3xl font-bold tracking-tight"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {mode === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'}
            </h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {mode === 'login'
                ? 'Acesse sua plataforma IA de Business Intelligence.'
                : 'Inicie agora com a plataforma avançada de estratégia.'}
            </p>
          </div>

          <div className="w-full">

            {/* Google Login */}
            <button
              onClick={() => loginWithGoogle()}
              disabled={loading}
              type="button"
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-lg text-sm font-medium transition-all duration-150 mb-6 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: 'var(--color-surface-2)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = 'var(--color-surface-3)';
                e.currentTarget.style.borderColor = 'var(--color-border-strong)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = 'var(--color-surface-2)';
                e.currentTarget.style.borderColor = 'var(--color-border)';
              }}
            >
              <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
              Continuar com o Google
            </button>

            {/* Divider */}
            <div className="relative flex items-center justify-center mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full" style={{ borderTop: '1px solid var(--color-border)' }}></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase font-medium tracking-widest">
                <span className="px-3" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-muted)' }}>Ou use seu E-mail</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name field (register only) */}
              {mode === 'register' && (
                <div>
                  <label
                    className="block text-xs font-semibold uppercase tracking-[0.2em] mb-2"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    Nome
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Seu nome"
                      className="w-full pl-10 pr-4 py-3 rounded-lg text-sm transition-all duration-150"
                      style={{
                        backgroundColor: 'var(--color-surface-2)',
                        color: 'var(--color-text-primary)',
                        border: '1px solid var(--color-border)',
                        outline: 'none',
                      }}
                      onFocus={e => {
                        e.currentTarget.style.borderColor = 'var(--color-accent)';
                        e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-accent-ring)';
                      }}
                      onBlur={e => {
                        e.currentTarget.style.borderColor = 'var(--color-border)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                      required={mode === 'register'}
                    />
                  </div>
                </div>
              )}

              {/* Email field */}
              <div>
                <label
                  className="block text-xs font-semibold uppercase tracking-[0.2em] mb-2"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full pl-10 pr-4 py-3 rounded-lg text-sm transition-all duration-150"
                    style={{
                      backgroundColor: 'var(--color-surface-2)',
                      color: 'var(--color-text-primary)',
                      border: '1px solid var(--color-border)',
                      outline: 'none',
                    }}
                    onFocus={e => {
                      e.currentTarget.style.borderColor = 'var(--color-accent)';
                      e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-accent-ring)';
                    }}
                    onBlur={e => {
                      e.currentTarget.style.borderColor = 'var(--color-border)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                    required
                  />
                </div>
              </div>

              {/* Password field */}
              <div>
                <label
                  className="block text-xs font-semibold uppercase tracking-[0.2em] mb-2"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-12 py-3 rounded-lg text-sm transition-all duration-150"
                    style={{
                      backgroundColor: 'var(--color-surface-2)',
                      color: 'var(--color-text-primary)',
                      border: '1px solid var(--color-border)',
                      outline: 'none',
                    }}
                    onFocus={e => {
                      e.currentTarget.style.borderColor = 'var(--color-accent)';
                      e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-accent-ring)';
                    }}
                    onBlur={e => {
                      e.currentTarget.style.borderColor = 'var(--color-border)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors duration-150"
                    style={{ color: 'var(--color-text-muted)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text-tertiary)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {mode === 'register' && (
                  <p className="text-xs mt-1.5" style={{ color: 'var(--color-text-muted)' }}>Mínimo de 6 caracteres</p>
                )}
              </div>

              {/* Error message */}
              {error && (
                <div
                  className="p-3 rounded-lg text-sm"
                  style={{
                    backgroundColor: 'var(--color-destructive-muted)',
                    color: 'var(--color-destructive)',
                    border: '1px solid rgba(239,68,68,0.15)',
                  }}
                >
                  {error}
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 text-sm font-semibold rounded-lg transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
                style={{
                  backgroundColor: 'var(--color-accent)',
                  color: 'white',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-accent-hover)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--color-accent)')}
              >
                {loading ? 'Processando...' : mode === 'login' ? 'Entrar com E-mail' : 'Criar Conta com E-mail'}
              </button>
            </form>

            {/* Toggle mode */}
            <div className="mt-5 pt-5 text-center" style={{ borderTop: '1px solid var(--color-border)' }}>
              <button
                onClick={toggleMode}
                className="text-sm transition-colors duration-150"
                style={{ color: 'var(--color-text-muted)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text-primary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}
              >
                {mode === 'login' ? (
                  <>
                    Não tem uma conta? <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>Registre-se</span>
                  </>
                ) : (
                  <>
                    Já tem uma conta? <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>Faça login</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Animation Side */}
      <div
        className="hidden lg:flex flex-1 relative items-center justify-center"
        style={{
          backgroundColor: 'black',
          borderLeft: '1px solid var(--color-border)',
        }}
      >
        <ParticleLoader
          progress=""
          thoughts={[]}
        />
        {/* Gradient overlay for blending */}
        <div
          className="absolute inset-y-0 left-0 w-32 z-10 pointer-events-none"
          style={{ background: `linear-gradient(to right, var(--color-bg), transparent)` }}
        ></div>
      </div>
    </div>
  );
}
