'use client';

import Link from 'next/link';
import React, { useState, useEffect, useRef } from 'react';
import { Building2, Plus, TrendingUp, LogOut, MapPin, Trash2, MoreVertical } from 'lucide-react';
import ConfirmDialog from '@/features/shared/components/confirm-dialog';
import { HotzoneMapButton } from './HotzoneMapButton';
import UserAvatar from '@/components/ui/UserAvatar';

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

  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; businessId: string; businessName: string }>({ isOpen: false, businessId: '', businessName: '' });
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-500/10';
    if (score >= 60) return 'bg-yellow-500/10';
    return 'bg-red-500/10';
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
    <div className="relative h-screen overflow-hidden" style={{ background: 'lab(5 0 0)' }}>
      <div className="absolute inset-0 flex">

        {/* ── LEFT SIDEBAR — hover to expand ──────────────────────────── */}
        <aside
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="flex-shrink-0 flex flex-col overflow-hidden relative z-30 transition-all duration-300 ease-in-out border-r border-white/[0.04]"
          style={{
            width: isExpanded ? 256 : 52,
            background: 'lab(5 0 0)',
          }}
        >
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center justify-center border-b border-white/[0.04]" style={{ height: 56, position: 'relative' }}>
            <img src="/logo_icon.png" alt="Logo" className="object-contain" style={{ width: 24, height: 24, position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
          </div>

          {/* New Business */}
          <div className="flex-shrink-0 px-2 py-3">
            <button
              onClick={onCreateNew}
              title="Novo Negócio"
              className="w-full flex items-center gap-2.5 rounded-lg transition-all duration-200 text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] overflow-hidden"
              style={{ height: 36, paddingLeft: 10, paddingRight: 10 }}
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              <span
                className="text-[12px] font-medium whitespace-nowrap transition-all duration-300 overflow-hidden"
                style={{ opacity: isExpanded ? 1 : 0, maxWidth: isExpanded ? 160 : 0 }}
              >
                Novo Negócio
              </span>
            </button>
          </div>

          {/* Businesses section toggle */}
          <div className="flex-shrink-0 px-2 pb-1">
            <button
              onClick={() => setIsPinned(!isPinned)}
              title="Negócios"
              className={`w-full flex items-center gap-2.5 rounded-lg transition-all duration-200 overflow-hidden ${isPinned ? 'text-zinc-200 bg-white/[0.07]' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06]'
                }`}
              style={{ height: 36, paddingLeft: 10, paddingRight: 10 }}
            >
              <Building2 className="w-4 h-4 flex-shrink-0" />
              <span
                className="text-[12px] font-medium whitespace-nowrap transition-all duration-300 overflow-hidden"
                style={{ opacity: isExpanded ? 1 : 0, maxWidth: isExpanded ? 160 : 0 }}
              >
                Negócios
              </span>
            </button>
          </div>

          {/* Business List */}
          <div className="flex-1 overflow-y-auto pb-4 flex flex-col gap-0.5 px-2" style={{ scrollbarWidth: 'none' }}>
            {isExpanded && (
              loading ? (
                <div className="flex justify-center py-6">
                  <div className="w-5 h-5 rounded-full border-2 border-zinc-700 border-t-violet-500/60 animate-spin" />
                </div>
              ) : businesses.length === 0 ? (
                <div className="flex items-center gap-2 px-2 py-3">
                  <p className="text-[11px] text-zinc-600">Nenhum negócio cadastrado</p>
                </div>
              ) : (
                businesses.map((business) => {
                  const profileRoot = business.profile_data?.profile || business.profile_data || {};
                  const perfil = profileRoot.perfil || profileRoot || {};
                  const displaySegment = business.segment || perfil.segmento || perfil.segmento_principal || perfil.industria || profileRoot.segmento || '—';
                  const isActive = currentBusinessId === business.id;

                  return (
                    <div key={business.id} className="relative group">
                      <Link
                        href={`/analysis/${business.id}`}
                        scroll={false}
                        title={business.name}
                        className={`flex items-center gap-2.5 rounded-lg transition-all duration-200 overflow-hidden ${isActive ? 'bg-white/[0.08]' : 'hover:bg-white/[0.05]'}`}
                        style={{ height: 36, paddingLeft: 8, paddingRight: 32 }}
                      >
                        <div
                          className="flex-shrink-0 flex items-center justify-center rounded-md"
                          style={{ width: 24, height: 24, background: 'rgba(255,255,255,0.05)', minWidth: 24 }}
                        >
                          <Building2 className="w-3 h-3 text-zinc-500" />
                        </div>
                        <div className="flex-1 min-w-0 flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-medium text-zinc-300 truncate leading-none">{business.name}</p>
                            <p className="text-[10px] text-zinc-600 truncate mt-0.5">{displaySegment}</p>
                          </div>
                          {business.latest_analysis && (
                            <span className={`text-[10px] font-bold ml-2 flex-shrink-0 ${getScoreColor(business.latest_analysis.score_geral)}`}>
                              {business.latest_analysis.score_geral}
                            </span>
                          )}
                        </div>
                      </Link>
                      <div className="absolute right-1 top-0 bottom-0 flex items-center" ref={openMenuId === business.id ? menuRef : null}>
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpenMenuId(openMenuId === business.id ? null : business.id); }}
                          className={`p-1 hover:bg-white/[0.06] rounded-md transition-colors ${openMenuId === business.id ? '' : 'opacity-0 group-hover:opacity-100'}`}
                        >
                          <MoreVertical className="w-3 h-3 text-zinc-600" />
                        </button>
                        {openMenuId === business.id && (
                          <div
                            className="absolute right-0 bottom-full mb-1 w-40 bg-[#111113] border border-white/[0.06] rounded-xl overflow-hidden z-50 shadow-xl shadow-black/50"
                            onClick={e => e.stopPropagation()}
                          >
                            <button
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpenMenuId(null); handleDeleteBusiness(business.id, business.name, e); }}
                              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors text-left"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Excluir negócio</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )
            )}
          </div>

          {/* Footer — logout */}
          <div className="flex-shrink-0 px-2 py-3 border-t border-white/[0.04]">
            <button
              onClick={onLogout}
              title="Sair"
              className="w-full flex items-center gap-2.5 rounded-lg transition-all duration-200 text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.05] overflow-hidden"
              style={{ height: 36, paddingLeft: 10, paddingRight: 10 }}
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              <span
                className="text-[12px] font-medium whitespace-nowrap transition-all duration-300 overflow-hidden"
                style={{ opacity: isExpanded ? 1 : 0, maxWidth: isExpanded ? 160 : 0 }}
              >
                Sair da Conta
              </span>
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
          {/* Top Header Bar */}
          <header
            className="flex-shrink-0 flex items-center justify-end border-b border-white/[0.04] px-4 z-[60]"
            style={{ height: 56 }}
          >
            <UserAvatar />
          </header>

          {/* Content */}
          <main className="flex-1 overflow-hidden" style={{ height: 'calc(100% - 56px)' }}>
            {error && (
              <div className="m-6 p-4 bg-red-500/10 rounded-xl text-red-400">
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
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] transition-opacity duration-300"
                onClick={() => setRightSidebarOpen(false)}
              />
            )}
            <HotzoneMapButton
              rightSidebarOpen={rightSidebarOpen}
              setRightSidebarOpen={setRightSidebarOpen}
            />
            <aside
              className={`fixed top-0 right-0 bottom-0 z-[65] transition-all duration-500 ease-in-out overflow-hidden ${rightSidebarOpen ? 'w-[80vw]' : 'w-0'}`}
            >
              {rightSidebar}
            </aside>
          </>
        )}
      </div>
    </div>
  );
}
