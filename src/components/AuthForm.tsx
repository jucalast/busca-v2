'use client';

import React, { useState } from 'react';
import { Lock, Mail, User, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image';
import ParticleLoader from '@/components/ParticleLoader';

export default function AuthForm() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login, register, loginWithGoogle } = useAuth();

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
    <div className="min-h-screen bg-[#09090b] flex overflow-hidden">
      {/* Form Side */}
      <div className="w-full lg:w-[40%] flex flex-col justify-center px-8 sm:px-16 py-12 z-10 relative bg-[#09090b] overflow-y-auto">
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
            <h1 className="text-3xl font-bold text-white tracking-tight">
              {mode === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'}
            </h1>
            <p className="text-zinc-500 mt-2 text-sm">
              {mode === 'login'
                ? 'Acesse sua plataforma IA de Business Intelligence.'
                : 'Inicie agora com a plataforma avançada de estratégia.'}
            </p>
          </div>

          <div className="w-full">

            {/* Google Login Option */}
            <button
              onClick={() => loginWithGoogle()}
              disabled={loading}
              type="button"
              className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-zinc-800/50 text-white rounded-xl hover:bg-zinc-800 hover:ring-1 hover:ring-zinc-600 transition-all mb-6 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
              Continuar com o Google
            </button>

            <div className="relative flex items-center justify-center mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-800/50"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase font-medium tracking-widest">
                <span className="bg-[#111113] px-3 text-zinc-600">Ou use seu E-mail</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name field (register only) */}
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-[0.2em] mb-2">
                    Nome
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Seu nome"
                      className="w-full pl-10 pr-4 py-3 bg-zinc-800/40 rounded-xl text-white text-sm placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 transition-all"
                      required={mode === 'register'}
                    />
                  </div>
                </div>
              )}

              {/* Email field */}
              <div>
                <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-[0.2em] mb-2">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full pl-10 pr-4 py-3 bg-zinc-800/40 rounded-xl text-white text-sm placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 transition-all"
                    required
                  />
                </div>
              </div>

              {/* Password field */}
              <div>
                <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-[0.2em] mb-2">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-12 py-3 bg-zinc-800/40 rounded-xl text-white text-sm placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 transition-all"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {mode === 'register' && (
                  <p className="text-xs text-zinc-600 mt-1.5">Mínimo de 6 caracteres</p>
                )}
              </div>

              {/* Error message */}
              {error && (
                <div className="p-3 bg-red-500/10 rounded-xl text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-zinc-800/60 text-white font-semibold text-sm rounded-xl hover:bg-zinc-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
              >
                {loading ? 'Processando...' : mode === 'login' ? 'Entrar com E-mail' : 'Criar Conta com E-mail'}
              </button>
            </form>

            {/* Toggle mode */}
            <div className="mt-5 pt-5 border-t border-zinc-800/50 text-center">
              <button
                onClick={toggleMode}
                className="text-sm text-zinc-500 hover:text-white transition-colors"
              >
                {mode === 'login' ? (
                  <>
                    Não tem uma conta? <span className="text-white font-medium">Registre-se</span>
                  </>
                ) : (
                  <>
                    Já tem uma conta? <span className="text-white font-medium">Faça login</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Animation Side */}
      <div className="hidden lg:flex flex-1 relative bg-black items-center justify-center border-l border-white/[0.02]">
        <ParticleLoader
          progress=""
          thoughts={[]}
        />
        {/* Gradient overlay for blending */}
        <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#09090b] to-transparent z-10 pointer-events-none"></div>
      </div>
    </div>
  );
}
