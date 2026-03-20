'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Building2, Plus, LogOut, Trash2, MoreVertical, Search,
  Settings, Folder, Star, Users, Hash, Sparkles, BookOpen
} from 'lucide-react';
import { Header } from './header';
import ConfirmDialog from '@/features/shared/components/confirm-dialog';
import { HotzoneMapButton } from './HotzoneMapButton';
import UserAvatar from '@/components/ui/UserAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { useSession } from 'next-auth/react';
import { useSidebar } from '@/contexts/SidebarContext';

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
  rightSidebarPersistent?: boolean;
  defaultPinned?: boolean;
  isDark?: boolean;
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
  rightSidebarPersistent = false,
  defaultPinned = false, // We want it closed by default per user request
  isDark: isDarkProp,
}: SidebarLayoutProps) {
  const { isDark: isDarkContext } = useSidebar();
  const isDark = isDarkProp ?? isDarkContext;
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(defaultPinned);
  const isExpanded = isHovered || isPinned;
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const { user, nextSession } = useAuth();
  const { data: session } = useSession();
  const pathname = usePathname();
  const isActivePath = (path: string) => pathname === path;

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
    // ─── Instant Cache Load ───
    let hasCache = false;
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(`businesses_${userId}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setBusinesses(parsed);
            setLoading(false); // We have cached data, don't show the initial pulse
            hasCache = true;
          }
        } catch (e) {
          console.error("Error parsing cached businesses", e);
        }
      }
    }
    // Pass cache status to avoid redundant loading states
    loadBusinesses(hasCache);
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

  useEffect(() => {
    setIsPinned(defaultPinned);
  }, [defaultPinned]);

  const loadBusinesses = async (hasCache = false) => {
    // SOMENTE mostrar loading se não tiver nada em cache para exibir
    // Usamos hasCache como backup se businesses ainda for [] (async state)
    if (!hasCache && businesses.length === 0) {
      setLoading(true);
    }
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
        const newBusinesses = data.businesses || [];
        setBusinesses(newBusinesses);
        // ─── Persist to Cache ───
        if (typeof window !== 'undefined') {
          localStorage.setItem(`businesses_${userId}`, JSON.stringify(newBusinesses));
        }
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
    <div className="relative h-screen overflow-hidden flex flex-col">
      <Header />
      <div className="flex flex-1 w-full transition-all duration-300 overflow-hidden">
        {/* --- SIDEBAR --- */}
        <aside
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={`flex flex-col relative z-20 overflow-hidden transition-all duration-300 border-r ${isDark ? 'border-white/10 bg-[--color-bg]/90 backdrop-blur-3xl' : 'border-r-2 border-gray-300 bg-white'}`}
          style={{
            width: isExpanded ? 320 : 64,
            transition: 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)',
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
                className={`grayscale transition-all duration-300 ${isDark ? 'opacity-90' : ''}`}
                style={{ filter: isDark ? 'brightness(0) invert(1)' : 'brightness(0)' }}
              />
            </div>
          </div>


          <div className="px-3 py-4 flex flex-col items-center">
            <Link
              href="/"
              onClick={onCreateNew}
              className={`flex items-center gap-2 rounded-xl font-bold shadow-sm transition-all border group active:scale-95 ${isDark ? 'bg-white/5 hover:bg-white/10 text-white border-white/10' : 'bg-white hover:bg-white text-gray-800 border-gray-200'} ${isExpanded ? 'w-full h-10 px-3' : 'w-10 h-10 justify-center'}`}
              title="Novo Negócio"
            >
              <Plus size={18} className="text-violet-500 group-hover:rotate-90 transition-transform" />
              {isExpanded && (
                <>
                  <span className="flex-1 text-left text-[13px] tracking-tight">Novo Negócio</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${isDark ? 'text-white/40 bg-white/5 border-white/10' : 'text-gray-400 bg-gray-50 border-gray-100'}`}>⌘N</span>
                </>
              )}
            </Link>
          </div>

          {/* Sidebar Content (Scrollable) */}
          <div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-0.5 custom-scrollbar" style={{ scrollbarWidth: 'none' }}>

            {/* Smart Folders */}
            <div className={`mt-2 flex flex-col gap-1 ${isExpanded ? 'px-2' : 'items-center'}`}>
              {isExpanded && <div className={`px-3 pb-1 text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-white/20' : 'text-gray-400'}`}>Smart Folders</div>}

              <Link href="/dashboard" className={`group relative flex items-center gap-2 rounded-lg transition-all active:scale-[0.98] ${isActivePath('/dashboard') ? (isDark ? 'bg-white/10 text-white shadow-none border border-white/10' : 'bg-white shadow-sm border border-gray-100 text-blue-600') : (isDark ? 'hover:bg-white/5 text-white/50' : 'hover:bg-gray-100/50 text-gray-500')} ${isExpanded ? 'px-3 py-2' : 'w-10 h-10 justify-center'}`} title="Paineis Hoje">
                {isActivePath('/dashboard') && <div className="absolute left-[-8px] w-1 h-4 bg-blue-500 rounded-r-full" />}
                <Star size={18} className={isActivePath('/dashboard') ? 'fill-blue-500/10' : (isDark ? 'text-white/30 group-hover:text-white/50' : 'text-gray-400 group-hover:text-gray-600')} />
                {isExpanded && <span className="flex-1 text-[13px] font-bold">Paineis Hoje</span>}
                {isExpanded && <span className={`text-[11px] font-bold px-1.5 rounded-full ${isDark ? 'opacity-40 bg-white/10' : 'opacity-60 bg-gray-100'}`}>{businesses.length}</span>}
              </Link>

              <Link href="/insights" className={`group relative flex items-center gap-2 rounded-lg transition-all active:scale-[0.98] ${isActivePath('/insights') ? (isDark ? 'bg-white/10 text-white border border-white/10' : 'bg-white shadow-sm border border-gray-100 text-purple-600') : (isDark ? 'hover:bg-white/5 text-white/50' : 'hover:bg-gray-100/50 text-gray-500')} ${isExpanded ? 'px-3 py-2' : 'w-10 h-10 justify-center'}`} title="Insights">
                {isActivePath('/insights') && <div className="absolute left-[-8px] w-1 h-4 bg-purple-500 rounded-r-full" />}
                <div className={`w-4.5 h-4.5 flex items-center justify-center bg-gradient-to-br from-pink-400 to-purple-400 rounded-md text-white shadow-sm ring-1 ring-purple-200/50`}>
                  <Sparkles size={12} />
                </div>
                {isExpanded && <span className="flex-1 text-[13px] font-bold">Insights</span>}
              </Link>

              <Link href="/contacts" className={`group relative flex items-center gap-2 rounded-lg transition-all active:scale-[0.98] ${isActivePath('/contacts') ? (isDark ? 'bg-white/10 text-white border border-white/10' : 'bg-white shadow-sm border border-gray-100 text-gray-900') : (isDark ? 'hover:bg-white/5 text-white/50' : 'hover:bg-gray-100/50 text-gray-500')} ${isExpanded ? 'px-3 py-2' : 'w-10 h-10 justify-center'}`} title="Contatos">
                {isActivePath('/contacts') && <div className="absolute left-[-8px] w-1 h-4 bg-gray-900 rounded-r-full" />}
                <Users size={18} className={isActivePath('/contacts') ? (isDark ? 'text-white' : 'text-gray-900') : (isDark ? 'text-white/30 group-hover:text-white/50' : 'text-gray-400 group-hover:text-gray-600')} />
                {isExpanded && <span className="flex-1 text-[13px] font-bold">Contatos</span>}
              </Link>
            </div>

            {/* Business List */}
            <div className={`mt-6 flex flex-col gap-1 ${isExpanded ? 'px-2' : 'items-center'}`}>
              {isExpanded && <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">Seus Negócios</div>}

              {loading ? (
                isExpanded && <div className="px-3 py-2 text-[11px] text-gray-400 animate-pulse">Carregando...</div>
              ) : businesses.length === 0 ? (
                isExpanded && <div className="px-3 py-2 text-[11px] text-gray-400 italic">Nenhum negócio ainda.</div>
              ) : (
                businesses.map((business: Business) => {
                  const isActive = currentBusinessId === business.id;
                  return (
                    <div key={business.id} className="group relative">
                        <Link
                          href={`/analysis/${business.id}/especialistas`}
                          className={`flex items-center gap-2 rounded-xl transition-all duration-150 cursor-pointer relative ${
                            isActive 
                              ? (isDark ? 'bg-white text-zinc-950 shadow-xl shadow-white/5' : 'bg-gray-900 text-white shadow-lg shadow-gray-200') 
                              : (isDark ? 'hover:bg-white/5 text-white/60' : 'hover:bg-gray-100/80 text-gray-500 hover:text-gray-900')
                          } ${isExpanded ? 'px-3 py-2.5' : 'w-10 h-10 justify-center'}`}
                          title={business.name}
                        >
                        {isActive && <div className={`absolute left-[-12px] w-1 h-5 rounded-r-full ${isDark ? 'bg-white' : 'bg-gray-900'}`} />}
                        {isExpanded ? (
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${
                              isActive 
                                ? (isDark ? 'bg-black/10 text-black' : 'bg-white/20 text-white') 
                                : (isDark ? 'bg-white/10 text-white/60' : 'bg-gray-200 text-gray-600')
                            }`}
                          >
                            {business.name.charAt(0).toUpperCase()}
                          </div>
                        ) : (
                          <span className={`text-[15px] font-bold uppercase transition-transform group-hover:scale-110 ${
                            isActive 
                              ? (isDark ? 'text-zinc-950' : 'text-white') 
                              : (isDark ? 'text-white/40' : 'text-gray-400')
                          }`}>
                            {business.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        {isExpanded && <span className="flex-1 text-[13px] font-bold truncate tracking-tight">{business.name}</span>}
                      </Link>

                      {isExpanded && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center z-30 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setOpenMenuId(openMenuId === business.id ? null : business.id);
                            }}
                            className={`w-6 h-6 flex items-center justify-center rounded-lg transition-all ${isActive ? (isDark ? 'hover:bg-black/10 text-zinc-950/70' : 'hover:bg-white/10 text-white') : (isDark ? 'hover:bg-white/10 text-white/40' : 'hover:bg-gray-200 text-gray-500')}`}
                          >
                            <MoreVertical size={14} />
                          </button>

                          {openMenuId === business.id && (
                            <div
                              ref={menuRef}
                              className={`absolute right-0 top-full mt-1 w-44 rounded-xl overflow-hidden z-[100] shadow-2xl border p-1 ${isDark ? 'border-white/10 bg-zinc-900/90 backdrop-blur-xl' : 'border-gray-100 bg-white'}`}
                              onClick={e => e.stopPropagation()}
                            >
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setOpenMenuId(null);
                                  handleDeleteBusiness(business.id, business.name, e);
                                }}
                                className={`w-full flex items-center gap-2 px-3 py-2.5 text-[12px] font-bold text-red-500 rounded-lg transition-colors text-left ${isDark ? 'hover:bg-red-500/10' : 'hover:bg-red-50'}`}
                              >
                                <Trash2 size={14} />
                                <span>Excluir negócio</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Tech Stack Section */}
            <div className={`mt-auto mb-4 flex flex-col gap-1 ${isExpanded ? 'px-2' : 'items-center'}`}>
              {isExpanded && <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">Tech Stack</div>}

              <Link href="https://vercel.com" target="_blank" className={`flex items-center gap-2 rounded-lg hover:bg-gray-50 text-violet-500 transition-all ${isExpanded ? 'px-3 py-1.5' : 'w-10 h-10 justify-center'}`} title="Vercel">
                <div className="w-5 h-5 bg-black rounded flex items-center justify-center text-white shrink-0">
                  <VercelIcon />
                </div>
                {isExpanded && <span className="flex-1 text-[13px] font-semibold">Vercel</span>}
              </Link>

              <Link href="https://linear.app" target="_blank" className={`flex items-center gap-2 rounded-lg hover:bg-gray-50 text-violet-500 transition-all ${isExpanded ? 'px-3 py-1.5' : 'w-10 h-10 justify-center'}`} title="Linear">
                <div className="w-5 h-5 bg-white rounded border border-gray-100 flex items-center justify-center text-black shrink-0 shadow-sm">
                  <LinearIcon />
                </div>
                {isExpanded && <span className="flex-1 text-[13px] font-semibold">Linear</span>}
              </Link>
            </div>
          </div>

          {/* Sidebar Footer - Simplified */}
          <div className={`mt-auto py-6 flex items-center justify-center ${isExpanded ? 'px-4' : 'px-2'}`}>
            <div className="flex items-center gap-2 text-[9px] font-black text-gray-300 uppercase tracking-[0.2em] opacity-80">
              <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
              {isExpanded ? 'Growth Platform v3.5.2' : 'V3.5'}
            </div>
          </div>
        </aside>

        {/* --- SECONDARY SIDEBAR (ROULETTE) --- */}
        {rightSidebar && rightSidebarPersistent && (
          <aside className="hidden md:block h-full flex-shrink-0 z-10 transition-all duration-300">
            {rightSidebar}
          </aside>
        )}

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

          <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-transparent relative z-10">
            {/* Content */}
            <main className="flex-1 overflow-hidden h-full">
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

        {/* Overlay Right Sidebar (like Hotzone Map) */}
        {rightSidebar && !rightSidebarPersistent && (
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
