'use client';

import React, { useState } from 'react';
import { Lock, Mail, User, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image';

export default function AuthForm() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login, register } = useAuth();

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
    <div className="min-h-screen bg-[#09090b] flex items-start justify-center">
      <div className="w-full max-w-md px-6 py-16">
        {/* Logo and Header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center justify-center mb-10">
            <Image 
              src="/logo.png" 
              alt="Logo" 
              width={180} 
              height={180}
              className="rounded-2xl"
              priority
            />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            {mode === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'}
          </h1>
        </div>

        {/* Form */}
        <div className="p-5 rounded-2xl bg-[#111113] border border-white/[0.06]">
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
                    className="w-full pl-10 pr-4 py-3 bg-[#09090b] border border-white/[0.06] rounded-xl text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-white/[0.12] transition-all"
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
                  className="w-full pl-10 pr-4 py-3 bg-[#09090b] border border-white/[0.06] rounded-xl text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-white/[0.12] transition-all"
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
                  className="w-full pl-10 pr-12 py-3 bg-[#09090b] border border-white/[0.06] rounded-xl text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-white/[0.12] transition-all"
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
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-white text-black font-semibold text-sm rounded-xl hover:bg-white/90 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
            >
              {loading ? 'Processando...' : mode === 'login' ? 'Entrar' : 'Criar Conta'}
            </button>
          </form>

          {/* Toggle mode */}
          <div className="mt-5 pt-5 border-t border-white/[0.06] text-center">
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
  );
}
