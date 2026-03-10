'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Building2, Plus, LogOut, Trash2, MoreVertical, Search,
  Settings, Folder, Star, Users, Hash, Sparkles
} from 'lucide-react';
import ConfirmDialog from '@/features/shared/components/confirm-dialog';
import { HotzoneMapButton } from './HotzoneMapButton';
import UserAvatar from '@/components/ui/UserAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { useSession } from 'next-auth/react';

// --- SVGs Personalizados para Ícones Específicos da Marca ---
const VercelIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" clipRule="evenodd" d="M12 2L24 22H0L12 2Z" fill="currentColor" />
  </svg>
);

const LinearIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L22 7.5L12 13L2 7.5L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2 12.5L12 18L22 12.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2 17.5L12 23L22 17.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

interface Business {
  id: string;
  name: string;
  segment: string;
  model: string;
  location: string;
  created_at: string;
  updated_at: string;
  profile_data?: any;
  latest_analysis?: {
    id: string;
    score_geral: number;
    classificacao: string;
    created_at: string;
  };
}

interface SidebarLayoutProps {
  userId: string;
  currentBusinessId: string | null;
  onSelectBusiness: (businessId: string) => void;
  onCreateNew: () => void;
  onDeleteBusiness: (businessId: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
  rightSidebar?: React.ReactNode;
}

export default function SidebarLayout({
  userId,
  currentBusinessId,
  onSelectBusiness,
  onCreateNew,
  onDeleteBusiness,
  onLogout,
  children,
  rightSidebar,
}: SidebarLayoutProps) {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const isExpanded = isHovered || isPinned;
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const { user, nextSession } = useAuth();
  const { data: session } = useSession();

  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; businessId: string; businessName: string }>({ isOpen: false, businessId: '', businessName: '' });
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // ─── Command Menu (Cmd+K) ───
  const handleCommandMenu = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      // Command menu placeholder — will be implemented in future iteration
      console.log('Command Menu triggered');
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleCommandMenu);
    return () => document.removeEventListener('keydown', handleCommandMenu);
  }, [handleCommandMenu]);

  useEffect(() => {
    loadBusinesses();
  }, [userId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };

    if (openMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openMenuId]);

  const loadBusinesses = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/growth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'list-businesses',
          user_id: userId,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setBusinesses(data.businesses || []);
      } else {
        setError(data.error || 'Erro ao carregar negócios');
      }
    } catch (err: any) {
      setError('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'var(--color-success)';
    if (score >= 60) return 'var(--color-warning)';
    return 'var(--color-destructive)';
  };

  const handleDeleteBusiness = async (businessId: string, businessName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteDialog({ isOpen: true, businessId, businessName });
  };

  const confirmDelete = async () => {
    const { businessId } = deleteDialog;
    setDeleteDialog({ isOpen: false, businessId: '', businessName: '' });

    try {
      await onDeleteBusiness(businessId);
      await loadBusinesses();
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir negócio');
    }
  };

  return (
    <div className="relative h-screen overflow-hidden">
      <div className="flex h-screen w-full transition-all duration-300">
        {/* --- SIDEBAR --- */}
        <aside
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="flex flex-col relative z-20 transition-all duration-300 overflow-hidden"
          style={{
            width: isExpanded ? 320 : 57,
            background: 'transparent',
            backdropFilter: 'blur(30px)',
            WebkitBackdropFilter: 'blur(30px)',
          }}
        >
          {/* Brand Logo Replacement for Window Controls */}
          <div className="flex px-4 pt-6 pb-2 justify-start sm:justify-start">
            <div className={`w-12 h-12 flex items-center justify-center overflow-hidden transition-all duration-300 ${!isExpanded ? 'mx-auto' : ''}`}>
              <Image
                src="/logo_icon.png"
                alt="Logo"
                width={32}
                height={32}
                className="grayscale"
                style={{ filter: 'brightness(0)' }}
              />
            </div>
          </div>


          {/* New Business Button */}
          {isExpanded && (
            <div className="px-4 py-2" style={{ animation: 'fade-in 0.3s ease-out' }}>
              <Link
                href="/"
                onClick={onCreateNew}
                className="w-full h-9 flex items-center gap-2 bg-white/40 hover:bg-white/50 text-gray-800 rounded-xl px-3 font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-all border border-white/40 group active:scale-95"
              >
                <Plus size={16} className="text-gray-600 group-hover:rotate-90 transition-transform" />
                <span className="flex-1 text-left text-[13px]">Novo Negócio</span>
                <span className="text-[10px] text-gray-400 font-mono bg-white/50 px-1.5 py-0.5 rounded border border-white/20">⌘N</span>
              </Link>
            </div>
          )}

          {/* Sidebar Content (Scrollable) */}
          <div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-0.5 custom-scrollbar" style={{ scrollbarWidth: 'none' }}>

            {/* Smart Folders */}
            {isExpanded && (
              <div className="mt-2 flex flex-col gap-0.5">
                <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-700/80">Smart Folders</div>

                <Link href="/dashboard" className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/50 text-blue-600 font-bold shadow-sm border border-blue-500/10 cursor-pointer transition active:scale-[0.98]">
                  <Star size={16} className="text-blue-500 fill-blue-500/10" />
                  <span className="flex-1 text-[13px]">Paineis Hoje</span>
                  <span className="text-[11px] font-bold">{businesses.length}</span>
                </Link>

                <Link href="/insights" className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/30 text-gray-700 cursor-pointer group transition active:scale-[0.98]">
                  <div className="w-4 h-4 flex items-center justify-center bg-gradient-to-br from-pink-400 to-purple-400 rounded-sm text-white text-[10px]">
                    <Sparkles size={10} />
                  </div>
                  <span className="flex-1 text-[13px] font-semibold">Insights</span>
                </Link>

                <Link href="/contacts" className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/30 text-gray-700 cursor-pointer transition active:scale-[0.98]">
                  <Users size={16} className="text-gray-600" />
                  <span className="flex-1 text-[13px] font-semibold">Contatos</span>
                </Link>
              </div>
            )}

            {/* Business List */}
            {isExpanded && (
              <div className="mt-4 flex flex-col gap-0.5">
                <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-700/80">Seus Negócios</div>

                {loading ? (
                  <div className="px-3 py-2 text-[11px] text-gray-400 animate-pulse">Carregando...</div>
                ) : businesses.length === 0 ? (
                  <div className="px-3 py-2 text-[11px] text-gray-400 italic">Nenhum negócio ainda.</div>
                ) : (
                  businesses.map((business: Business) => {
                    const isActive = currentBusinessId === business.id;
                    return (
                      <div key={business.id} className="group relative">
                        <Link
                          href={`/analysis/${business.id}`}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-150 cursor-pointer"
                          style={{
                            backgroundColor: isActive ? 'rgba(0,0,0,0.8)' : 'transparent',
                            color: isActive ? 'white' : 'inherit',
                            boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
                          }}
                          onClick={() => onSelectBusiness(business.id)}
                        >
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${isActive ? 'bg-white/20' : 'bg-black/5 text-gray-600'}`}
                          >
                            {business.name.charAt(0).toUpperCase()}
                          </div>
                          <span className={`flex-1 text-[13px] font-bold truncate ${isActive ? 'text-white' : 'text-gray-600 group-hover:text-gray-900 font-semibold'}`}>
                            {business.name}
                          </span>
                        </Link>

                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center z-30">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setOpenMenuId(openMenuId === business.id ? null : business.id);
                            }}
                            className={`w-6 h-6 flex items-center justify-center rounded-lg transition-all ${isActive ? 'hover:bg-white/10 text-white' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-600'} ${isActive || openMenuId === business.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                          >
                            <MoreVertical size={14} />
                          </button>

                          {openMenuId === business.id && (
                            <div
                              ref={menuRef}
                              className="absolute right-0 top-full mt-1 w-44 rounded-xl overflow-hidden z-[100] shadow-2xl border border-gray-100 bg-white p-1"
                              onClick={e => e.stopPropagation()}
                            >
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setOpenMenuId(null);
                                  handleDeleteBusiness(business.id, business.name, e);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-[12px] font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors text-left"
                              >
                                <Trash2 size={14} />
                                <span>Excluir negócio</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Tech Stack Section */}
            {isExpanded && (
              <div className="mt-4 flex flex-col gap-0.5">
                <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-700/80">Tech Stack</div>

                <Link href="https://vercel.com" target="_blank" className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/30 text-gray-700 cursor-pointer transition active:scale-[0.98]">
                  <div className="w-5 h-5 bg-black rounded flex items-center justify-center text-white shadow-sm ring-1 ring-white/10">
                    <VercelIcon />
                  </div>
                  <span className="flex-1 text-[13px] font-semibold text-gray-600">Vercel</span>
                </Link>

                <Link href="https://linear.app" target="_blank" className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/30 text-gray-700 cursor-pointer transition active:scale-[0.98]">
                  <div className="w-5 h-5 bg-white rounded border border-gray-100 flex items-center justify-center text-black shadow-sm">
                    <LinearIcon />
                  </div>
                  <span className="flex-1 text-[13px] font-semibold text-gray-600">Linear</span>
                </Link>

                <Link href="https://slack.com" target="_blank" className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/30 text-gray-700 cursor-pointer transition active:scale-[0.98]">
                  <div className="w-5 h-5 bg-white rounded flex items-center justify-center text-[#ff4500] shadow-sm border border-gray-50">
                    <Hash size={12} strokeWidth={3} />
                  </div>
                  <span className="flex-1 text-[13px] font-semibold text-gray-600">Slack</span>
                </Link>
              </div>
            )}
          </div>

          {/* Sidebar Footer Controls */}
          <div className="px-2 pb-2">
            <Link href="/profile" className="flex items-center justify-between px-1 py-2 cursor-pointer hover:bg-white/20 rounded-lg transition group">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="flex-shrink-0">
                  <UserAvatar isExpanded={isExpanded} />
                </div>
                {isExpanded && (
                  <div className="flex flex-col min-w-0" style={{ animation: 'fade-in 0.3s ease-out' }}>
                    <span className="text-[13px] font-bold text-gray-800 truncate leading-tight">
                      {nextSession?.user?.name || user?.name || 'Consultor'}
                    </span>
                    <span className="text-[10px] text-gray-700 font-medium truncate">Mastermind AI</span>
                  </div>
                )}
              </div>
              {isExpanded && <Search size={14} className="text-gray-600 group-hover:text-gray-900 ml-2 flex-shrink-0" />}
            </Link>
          </div>

          <div className={`flex items-center justify-between mt-0 border-t border-white/20 ${isExpanded ? 'p-4' : 'p-2'}`}>
            <div className="flex items-center gap-3">
              <Link
                href="/settings"
                className="p-1.5 rounded-lg hover:bg-white/40 text-gray-700 hover:text-gray-900 transition shadow-sm border border-transparent hover:border-white/20"
              >
                <Settings size={18} />
              </Link>
              <Link
                href="/"
                className="p-1.5 rounded-lg hover:bg-white/40 text-gray-700 hover:text-gray-900 transition shadow-sm border border-transparent hover:border-white/20"
                onClick={onCreateNew}
              >
                <Plus size={18} />
              </Link>
            </div>

            <button
              onClick={onLogout}
              className={`flex items-center gap-2 h-9 rounded-xl hover:bg-red-50 text-red-500 transition-all font-bold text-[13px] ${isExpanded ? 'px-3' : 'px-2'}`}
            >
              <LogOut size={16} />
              {isExpanded && <span>Sair</span>}
            </button>
          </div>
        </aside>

        {/* Confirm Delete Dialog */}
        <ConfirmDialog
          isOpen={deleteDialog.isOpen}
          title="Excluir negócio"
          message={`Tem certeza que deseja excluir "${deleteDialog.businessName}"? Esta ação não pode ser desfeita e todos os dados serão perdidos permanentemente.`}
          confirmText="Excluir"
          cancelText="Cancelar"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteDialog({ isOpen: false, businessId: '', businessName: '' })}
          isDangerous
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Content */}
          <main className="flex-1 overflow-hidden h-full pt-6">
            {error && (
              <div
                className="m-6 p-4 rounded-lg text-sm"
                style={{
                  backgroundColor: 'var(--color-destructive-muted)',
                  color: 'var(--color-destructive)',
                  border: '1px solid rgba(239,68,68,0.15)',
                }}
              >
                {error}
              </div>
            )}
            {children}
          </main>
        </div>

        {/* Right Sidebar - Business Mind Map */}
        {rightSidebar && (
          <>
            {rightSidebarOpen && (
              <div
                className="fixed inset-0 bg-black/60 z-[60]"
                style={{ animation: 'fade-in 0.2s ease-out' }}
                onClick={() => setRightSidebarOpen(false)}
              />
            )}
            <HotzoneMapButton
              rightSidebarOpen={rightSidebarOpen}
              setRightSidebarOpen={setRightSidebarOpen}
            />
            <aside
              className="fixed top-0 right-0 bottom-0 z-[65] overflow-hidden"
              style={{
                width: rightSidebarOpen ? '80vw' : 0,
                transition: `width 500ms var(--ease-out)`,
              }}
            >
              {rightSidebar}
            </aside>
          </>
        )}
      </div>
    </div>
  );
}
