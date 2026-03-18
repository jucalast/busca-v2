'use client';

import React, { useState, useEffect } from 'react';
import { Lock, Mail, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

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
    <div className="h-screen flex bg-white font-sans selection:bg-purple-100 overflow-hidden">
      {/* LEFT COLUMN: AUTH FORM (70%) - Light Mode */}
      <div className="w-full lg:w-[70%] flex flex-col h-full p-8 sm:p-12 relative z-10 overflow-hidden bg-[#FAFAFA]">
        {/* Subtle Background Pattern */}
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'radial-gradient(black 0.5px, transparent 0)', backgroundSize: '32px 32px' }} />

        {/* Logo */}
        <div className="mb-4 relative z-10">
          <Image
            src="/logo.png"
            alt="Logo"
            width={120}
            height={36}
            className="h-9 w-auto object-contain invert"
            priority
          />
        </div>

        <div className="flex-1 flex flex-col justify-center max-w-[420px] mx-auto w-full relative z-10">
          <div className="mb-10 text-center lg:text-left">
            <h1 className="text-[32px] font-semibold tracking-tight text-gray-900 mb-1.5">
              {mode === 'login' ? 'Bem-vindo de volta!' : 'Crie sua conta'}
            </h1>
            <p className="text-gray-500 text-[15px] font-medium">
              {mode === 'login'
                ? 'Acesse a inteligência estratégica do seu negócio.'
                : 'Inicie agora com a plataforma avançada de BI.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'register' && (
              <div className="group">
                <div className="relative border border-gray-200 rounded-xl bg-white transition-all duration-200 focus-within:border-black !outline-none !ring-0 shadow-sm">
                  <div className="flex items-center px-4 py-3.5">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nome completo"
                      className="w-full bg-transparent border-none outline-none focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:outline-none text-[15px] text-gray-900 placeholder:text-gray-400 font-medium"
                      required={mode === 'register'}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="group">
              <div className="relative border border-gray-200 rounded-xl bg-white transition-all duration-200 focus-within:border-black !outline-none !ring-0 shadow-sm">
                <div className="flex items-center px-4 py-3.5">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="E-mail profissional"
                    className="w-full bg-transparent border-none outline-none focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:outline-none text-[15px] text-gray-900 placeholder:text-gray-400 font-medium"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="group transition-all">
              <div className="relative border border-gray-200 rounded-xl bg-white transition-all duration-200 focus-within:border-black !outline-none !ring-0 shadow-sm">
                <div className="flex items-center px-4 py-3.5 gap-2">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Sua senha"
                    className="w-full bg-transparent border-none outline-none focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:outline-none text-[15px] text-gray-900 placeholder:text-gray-400 font-medium"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-400 hover:text-gray-600 transition-colors px-1 outline-none focus:outline-none"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            {mode === 'login' && (
              <div className="flex justify-start pt-1">
                <a href="/forgot-password" title="Não implementado" className="text-[13px] font-medium text-gray-500 hover:text-black transition-colors decoration-gray-300 underline-offset-4 hover:underline">
                  Esqueceu sua senha?
                </a>
              </div>
            )}

            {error && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-[13px] font-semibold">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white h-[56px] rounded-xl text-base font-bold transition-all duration-200 hover:bg-gray-900 active:scale-[0.98] disabled:opacity-50 mt-2 outline-none focus:outline-none shadow-xl shadow-black/10"
            >
              {loading ? 'Processando...' : mode === 'login' ? 'Entrar na plataforma' : 'Criar minha conta'}
            </button>
          </form>

          {/* Social Logins */}
          <div className="mt-8">
            <p className="text-center text-[11px] font-medium text-gray-500 mb-6 flex items-center gap-3 before:h-px before:flex-1 before:bg-gray-100 after:h-px after:flex-1 after:bg-gray-100 uppercase tracking-widest">
              Ou continue com
            </p>
            <button
              type="button"
              onClick={() => loginWithGoogle()}
              className="flex items-center justify-center gap-3 w-full h-[56px] border border-gray-200 rounded-xl hover:bg-gray-50 transition-all active:scale-[0.97] bg-white font-medium text-[14px] text-gray-700 shadow-sm outline-none focus:outline-none"
            >
              <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
              Acessar com Google
            </button>
          </div>

          {/* Toggle Mode */}
          <div className="mt-8 text-center flex items-center justify-center gap-1.5 py-4 border-t border-gray-100">
            <span className="text-[14px] text-gray-500 font-medium">
              {mode === 'login' ? "Não tem uma conta?" : "Já tem uma conta?"}
            </span>
            <button
              onClick={toggleMode}
              className="text-[14px] font-medium text-black hover:underline underline-offset-4"
            >
              {mode === 'login' ? 'Cadastre-se' : 'Fazer login'}
            </button>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-[11px] text-gray-400 max-w-[340px] mx-auto leading-relaxed">
              Respeitamos sua privacidade. Site protegido por reCAPTCHA. <a href="#" className="underline">Privacidade</a> e <a href="#" className="underline">Termos</a>
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: BRANDING (30%) - Original Purple with New Typography */}
      <div className="hidden lg:flex lg:w-[30%] h-screen relative bg-[#8b5cf6] overflow-hidden items-center justify-center p-12">
        {/* Decorative background effects */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-white/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-purple-400/20 rounded-full blur-[100px]" />
          {/* Subtle grid pattern */}
          <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
        </div>

        <div className="relative z-10 w-full text-center lg:text-left">
          <h2 className="text-[36px] font-bold text-white leading-[1.1] mb-6 tracking-tighter italic uppercase text-shadow-sm">
            Dados <br/> Estratégicos.
          </h2>
          <p className="text-purple-50 text-lg leading-relaxed font-medium max-w-[480px] opacity-90">
            Conecte-se com decisores, mapeie mercados e execute planos de ação com o poder da Inteligência Artificial.
          </p>
        </div>
      </div>
    </div>
  );
}
