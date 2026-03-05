'use client';

import Link from 'next/link';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Building2, Plus, LogOut, Trash2, MoreVertical, Search } from 'lucide-react';
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
    <div className="relative h-screen overflow-hidden" style={{ background: 'var(--color-bg)' }}>
      <div className="absolute inset-0 flex">

        {/* ── LEFT SIDEBAR ──────────────────────────────────────────── */}
        <aside
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="flex-shrink-0 flex flex-col overflow-hidden relative z-30"
          style={{
            width: isExpanded ? 256 : 52,
            background: 'var(--color-bg)',
            borderRight: '1px solid var(--color-border)',
            transition: `width var(--duration-slow) var(--ease-out)`,
          }}
        >
          {/* Logo */}
          <div
            className="flex-shrink-0 flex items-center justify-center"
            style={{
              height: 56,
              position: 'relative',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <img
              src="/logo_icon.png"
              alt="Logo"
              className="object-contain"
              style={{ width: 24, height: 24, position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}
            />
          </div>

          {/* New Business */}
          <div className="flex-shrink-0 px-2 py-3">
            <button
              onClick={onCreateNew}
              title="Novo Negócio"
              className="w-full flex items-center gap-2.5 rounded-lg overflow-hidden transition-all duration-150"
              style={{
                height: 36,
                paddingLeft: 10,
                paddingRight: 10,
                color: 'var(--color-text-tertiary)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = 'var(--color-text-primary)';
                e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'var(--color-text-tertiary)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              <span
                className="text-[12px] font-medium whitespace-nowrap overflow-hidden"
                style={{
                  opacity: isExpanded ? 1 : 0,
                  maxWidth: isExpanded ? 160 : 0,
                  transition: `opacity var(--duration-slow) var(--ease-out), max-width var(--duration-slow) var(--ease-out)`,
                }}
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
              className="w-full flex items-center gap-2.5 rounded-lg overflow-hidden transition-all duration-150"
              style={{
                height: 36,
                paddingLeft: 10,
                paddingRight: 10,
                color: isPinned ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                backgroundColor: isPinned ? 'var(--color-surface-active)' : 'transparent',
              }}
              onMouseEnter={e => {
                if (!isPinned) {
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                  e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
                }
              }}
              onMouseLeave={e => {
                if (!isPinned) {
                  e.currentTarget.style.color = 'var(--color-text-muted)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <Building2 className="w-4 h-4 flex-shrink-0" />
              <span
                className="text-[12px] font-medium whitespace-nowrap overflow-hidden"
                style={{
                  opacity: isExpanded ? 1 : 0,
                  maxWidth: isExpanded ? 160 : 0,
                  transition: `opacity var(--duration-slow) var(--ease-out), max-width var(--duration-slow) var(--ease-out)`,
                }}
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
                  <div
                    className="w-5 h-5 rounded-full border-2 animate-spin"
                    style={{ borderColor: 'var(--color-border-strong)', borderTopColor: 'var(--color-accent)' }}
                  />
                </div>
              ) : businesses.length === 0 ? (
                <div className="flex items-center gap-2 px-2 py-3">
                  <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Nenhum negócio cadastrado</p>
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
                        className="flex items-center gap-2.5 rounded-lg overflow-hidden transition-all duration-150"
                        style={{
                          height: 36,
                          paddingLeft: 8,
                          paddingRight: 32,
                          backgroundColor: isActive ? 'var(--color-surface-active)' : 'transparent',
                        }}
                        onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'; }}
                        onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <div
                          className="flex-shrink-0 flex items-center justify-center rounded-md"
                          style={{ width: 24, height: 24, background: 'var(--color-surface-hover)', minWidth: 24 }}
                        >
                          <Building2 className="w-3 h-3" style={{ color: 'var(--color-text-muted)' }} />
                        </div>
                        <div className="flex-1 min-w-0 flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-medium truncate leading-none" style={{ color: 'var(--color-text-secondary)' }}>{business.name}</p>
                            <p className="text-[10px] truncate mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{displaySegment}</p>
                          </div>
                          {business.latest_analysis && (
                            <span
                              className="text-[10px] font-bold ml-2 flex-shrink-0 tabular-nums"
                              style={{ color: getScoreColor(business.latest_analysis.score_geral) }}
                            >
                              {business.latest_analysis.score_geral}
                            </span>
                          )}
                        </div>
                      </Link>
                      <div className="absolute right-1 top-0 bottom-0 flex items-center" ref={openMenuId === business.id ? menuRef : null}>
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpenMenuId(openMenuId === business.id ? null : business.id); }}
                          className={`p-1 rounded-md transition-all duration-150 ${openMenuId === business.id ? '' : 'opacity-0 group-hover:opacity-100'}`}
                          style={{
                            color: 'var(--color-text-muted)',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <MoreVertical className="w-3 h-3" />
                        </button>
                        {openMenuId === business.id && (
                          <div
                            className="absolute right-0 bottom-full mb-1 w-40 rounded-lg overflow-hidden z-50"
                            style={{
                              backgroundColor: 'var(--color-surface-1)',
                              border: '1px solid var(--color-border)',
                              boxShadow: 'var(--shadow-popover)',
                              animation: 'fade-in-up 0.1s ease-out',
                            }}
                            onClick={e => e.stopPropagation()}
                          >
                            <button
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpenMenuId(null); handleDeleteBusiness(business.id, business.name, e); }}
                              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs transition-colors text-left"
                              style={{ color: 'var(--color-destructive)' }}
                              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-destructive-muted)')}
                              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
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

          {/* Footer — Cmd+K hint + logout */}
          <div className="flex-shrink-0 px-2 py-3" style={{ borderTop: '1px solid var(--color-border)' }}>
            {/* Cmd+K shortcut hint */}
            {isExpanded && (
              <div
                className="flex items-center gap-2 px-2.5 py-2 mb-2 rounded-lg cursor-default"
                style={{
                  backgroundColor: 'var(--color-surface-hover)',
                  animation: 'fade-in 0.2s ease-out',
                }}
              >
                <Search className="w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} />
                <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Buscar...</span>
                <kbd
                  className="ml-auto text-[9px] font-medium px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: 'var(--color-surface-2)',
                    color: 'var(--color-text-muted)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  ⌘K
                </kbd>
              </div>
            )}

            <button
              onClick={onLogout}
              title="Sair"
              className="w-full flex items-center gap-2.5 rounded-lg overflow-hidden transition-all duration-150"
              style={{
                height: 36,
                paddingLeft: 10,
                paddingRight: 10,
                color: 'var(--color-text-muted)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = 'var(--color-text-secondary)';
                e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'var(--color-text-muted)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              <span
                className="text-[12px] font-medium whitespace-nowrap overflow-hidden"
                style={{
                  opacity: isExpanded ? 1 : 0,
                  maxWidth: isExpanded ? 160 : 0,
                  transition: `opacity var(--duration-slow) var(--ease-out), max-width var(--duration-slow) var(--ease-out)`,
                }}
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
            className="flex-shrink-0 flex items-center justify-end px-4 z-[60]"
            style={{
              height: 56,
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <UserAvatar />
          </header>

          {/* Content */}
          <main className="flex-1 overflow-hidden" style={{ height: 'calc(100% - 56px)' }}>
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
                className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[60]"
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
