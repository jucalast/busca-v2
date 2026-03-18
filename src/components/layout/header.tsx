'use client';

import React, { useState } from 'react';
import {
    Bell, HelpCircle, Settings, Box, CreditCard,
    Sparkles, Download, Search, LogOut, ChevronDown, Plus, BookOpen, Brain, X
} from 'lucide-react';
import UserAvatar from '@/components/ui/UserAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { Moon, Sun } from 'lucide-react';
import Link from 'next/link';

interface HotzoneMapButtonProps {
  setRightSidebarOpen: (open: boolean) => void;
}

const HotzoneMapButton: React.FC<HotzoneMapButtonProps> = ({ setRightSidebarOpen }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { isDark } = useSidebar();

  return (
    <>
      {/* Hotzone: invisible strip on right edge */}
      <div className="fixed top-0 right-0 h-screen w-10 z-[69] group pointer-events-auto flex items-start justify-end">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`mt-16 flex items-center gap-2 px-3 py-2 rounded-l-lg transition-all duration-200 opacity-0 group-hover:opacity-100 border ${
            isDark 
            ? 'bg-[--color-bg]/90 backdrop-blur-3xl border-white/10' 
            : 'bg-white/90 backdrop-blur-xl border-gray-300 shadow-lg'
          }`}
          onMouseEnter={e => {
            if (isDark) e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.8)';
            else e.currentTarget.style.backgroundColor = 'rgba(255,255,255,1)';
          }}
          onMouseLeave={e => {
            if (isDark) e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.6)';
            else e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.9)';
          }}
        >
          <Brain className={`w-4 h-4 ${isDark ? 'text-violet-400' : 'text-violet-600'}`} />
          <span className={`text-[11px] font-medium hidden md:inline ${isDark ? 'text-white/80' : 'text-gray-700'}`}>Mapa</span>
        </button>
      </div>

      {/* Overlay when open */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-[60]"
          style={{ animation: 'fade-in 0.2s ease-out' }}
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Panel */}
      <div
        className={`fixed top-0 right-0 bottom-0 z-[65] overflow-hidden border-l transition-all duration-500 ${
          isDark 
          ? 'bg-[--color-bg]/90 backdrop-blur-3xl border-white/10' 
          : 'bg-white/90 backdrop-blur-3xl border-gray-300 shadow-2xl'
        }`}
        style={{
          width: isOpen ? '80vw' : 0,
        }}
      >
        <div className={`p-6 ${isDark ? 'text-white/80' : 'text-gray-800'}`}>
          <h3 className="text-lg font-semibold mb-4">Mapa de Hotzones</h3>
          <p className={`text-sm ${isDark ? 'text-white/60' : 'text-gray-500'}`}>Funcionalidade de mapa em desenvolvimento...</p>
          <button
            onClick={() => setIsOpen(false)}
            className="mt-4 px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </>
  );
};

export function Header() {
    const { user, nextSession, logout } = useAuth();
    const { isDark, setIsDark } = useSidebar();



    return (
        <>
            <header className={`h-14 flex items-center justify-between px-6 sticky top-0 z-[100] transition-all duration-300 ${
                isDark 
                ? 'bg-[--color-bg]/90 backdrop-blur-3xl border-b border-white/10' 
                : 'bg-white/80 backdrop-blur-md border-b border-gray-300'
            }`}>
                {/* Left side - Empty now */}
                <div className="flex items-center">
                    {/* Espaço vazio ou pode adicionar logo aqui */}
                </div>

                {/* Right side - All buttons */}
                <div className="flex items-center gap-3">
                    {/* Theme Toggle */}
                    <button 
                        onClick={() => setIsDark(!isDark)}
                        className={`p-2 rounded-lg transition-all active:scale-95 flex items-center justify-center ${
                            isDark 
                            ? 'hover:bg-white/10 text-white/60 hover:text-white/90' 
                            : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'
                        }`}
                        title={isDark ? "Mudar para modo claro" : "Mudar para modo escuro"}
                    >
                        {isDark ? <Sun size={18} strokeWidth={1.5} /> : <Moon size={18} strokeWidth={1.5} />}
                    </button>

                    {/* Support */}
                    <Link href="/support" className={`p-2 rounded-lg transition-colors group ${
                        isDark ? 'hover:bg-white/10 text-white/60' : 'hover:bg-gray-100 text-gray-500'
                    }`}>
                        <HelpCircle size={18} strokeWidth={1.5} className={isDark ? "group-hover:text-white/90" : "group-hover:text-gray-900"} />
                    </Link>
                    
                    {/* Settings */}
                    <Link href="/settings" className={`p-2 rounded-lg transition-colors group ${
                        isDark ? 'hover:bg-white/10 text-white/60' : 'hover:bg-gray-100 text-gray-500'
                    }`}>
                        <Settings size={18} strokeWidth={1.5} className={isDark ? "group-hover:text-white/90" : "group-hover:text-gray-900"} />
                    </Link>
                    
                    {/* Documentation */}
                    <Link href="/docs" className={`p-2 rounded-lg transition-colors group ${
                        isDark ? 'hover:bg-white/10 text-white/60' : 'hover:bg-gray-100 text-gray-500'
                    }`}>
                        <BookOpen size={18} strokeWidth={1.5} className={isDark ? "group-hover:text-white/90" : "group-hover:text-gray-900"} />
                    </Link>
                    
                    {/* Upgrade Button */}
                    <button className={`flex items-center gap-2 px-4 py-1.5 rounded-lg transition-all active:scale-95 text-[12px] font-bold shadow-sm ${
                        isDark ? 'bg-[#151417] hover:bg-black text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                    }`}>
                        <Sparkles size={14} fill="currentColor" />
                        <span>Upgrade</span>
                    </button>

                    <UserAvatar isExpanded={false} />

                    {/* Logout Button */}
                    <button
                        onClick={logout}
                        className={`p-2 transition-all rounded-lg ${
                            isDark ? 'hover:bg-red-50/10 text-red-400 hover:text-red-300' : 'hover:bg-red-50 text-red-500 hover:text-red-600'
                        }`}
                        title="Sair"
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </header>

            {/* Hotzone Map Button */}
            <HotzoneMapButton setRightSidebarOpen={() => {}} />
        </>
    );
}
