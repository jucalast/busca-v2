'use client';

import Link from 'next/link';
import React, { useState, useEffect, useRef } from 'react';
import { Building2, Plus, TrendingUp, LogOut, Menu, X, MapPin, Trash2, MoreVertical, Brain } from 'lucide-react';
import ConfirmDialog from '@/features/shared/components/confirm-dialog';
import { HotzoneMapButton } from './HotzoneMapButton';

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
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
    <div className="relative h-screen bg-[#09090b] overflow-hidden">
      {/* Bottom Area - Sidebar + Main Content */}
      <div className="absolute inset-x-0 top-0 bottom-0">
        <div className="flex h-full overflow-hidden relative">
          {/* Sidebar */}
          <aside
            className={`${sidebarOpen ? 'w-72' : 'w-0'
              } transition-all duration-300 flex-shrink-0 border-r border-white/[0.04] bg-[#0c0c0e] flex flex-col overflow-hidden relative z-30`}
          >
            {/* Branding header */}
            <div className="px-5 pt-5 pb-4 flex-shrink-0 border-b border-white/[0.04]">
              <img src="/logo.png" alt="Logo" className="h-7 w-auto object-contain" />
            </div>

            {/* New Business Button */}
            <div className="p-4 flex-shrink-0">
              <button
                onClick={onCreateNew}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 bg-white/[0.04] hover:bg-white/[0.07] text-white rounded-xl transition-all duration-200 border border-white/[0.06] hover:border-white/[0.10] group"
              >
                <Plus className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-200 transition-colors" />
                <span className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">Novo Negócio</span>
              </button>
            </div>

            {/* Business List */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-2">
              <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.2em] px-1 mb-1">
                Negócios
              </p>
              {loading ? (
                <div className="text-center py-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-zinc-700 border-t-violet-500/60 mx-auto mb-3"></div>
                  <p className="text-xs text-zinc-600">Carregando negócios...</p>
                </div>
              ) : businesses.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
                    <Building2 className="w-6 h-6 text-zinc-700" />
                  </div>
                  <p className="text-sm text-zinc-400 mb-1 font-medium">Nenhum negócio ainda</p>
                  <p className="text-xs text-zinc-600 leading-relaxed">Crie seu primeiro negócio para começar a análise</p>
                </div>
              ) : (
                businesses.map((business) => {
                  const profileRoot = business.profile_data?.profile || business.profile_data || {};
                  const perfil = profileRoot.perfil || profileRoot || {};
                  const displaySegment =
                    business.segment ||
                    perfil.segmento ||
                    perfil.segmento_principal ||
                    perfil.industria ||
                    profileRoot.segmento ||
                    '—';
                  const displayModel =
                    business.model ||
                    perfil.modelo_negocio ||
                    perfil.modelo ||
                    profileRoot.modelo_negocio ||
                    profileRoot.modelo ||
                    '—';
                  const displayLocation =
                    business.location ||
                    perfil.localizacao ||
                    perfil.cidade ||
                    perfil.estado ||
                    profileRoot.localizacao ||
                    profileRoot.cidade ||
                    profileRoot.estado ||
                    '—';
                  return (
                    <div key={business.id} className="relative">
                      <Link
                        href={`/analysis/${business.id}`}
                        scroll={false}
                        className={`block p-4 rounded-2xl transition-all duration-200 ${currentBusinessId === business.id
                          ? 'bg-white/[0.07] border border-white/[0.08]'
                          : 'bg-white/[0.02] hover:bg-white/[0.05] border border-transparent hover:border-white/[0.05]'
                          }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0 pr-2">
                            <h3 className="text-sm font-semibold text-white truncate leading-snug">
                              {business.name}
                            </h3>
                            <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                              {displaySegment}
                            </p>
                          </div>
                          {business.latest_analysis && (
                            <div
                              className={`ml-2 px-2 py-1 rounded-lg ${getScoreBg(
                                business.latest_analysis.score_geral
                              )} flex-shrink-0`}
                            >
                              <div className="flex items-center gap-1">
                                <TrendingUp
                                  className={`w-3 h-3 ${getScoreColor(
                                    business.latest_analysis.score_geral
                                  )}`}
                                />
                                <span
                                  className={`text-xs font-bold ${getScoreColor(
                                    business.latest_analysis.score_geral
                                  )}`}
                                >
                                  {business.latest_analysis.score_geral}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2 text-[10px] text-zinc-600">
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 bg-white/[0.04] rounded-md font-medium">
                              {displayModel}
                            </span>
                            <div className="flex items-center gap-1">
                              <MapPin className="w-2.5 h-2.5" />
                              <span className="truncate max-w-[80px]">{displayLocation}</span>
                            </div>
                          </div>
                          <div className="relative" ref={openMenuId === business.id ? menuRef : null}>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setOpenMenuId(openMenuId === business.id ? null : business.id);
                              }}
                              className="p-1 hover:bg-white/[0.06] rounded-lg transition-colors"
                            >
                              <MoreVertical className="w-3 h-3 text-zinc-600" />
                            </button>
                            {openMenuId === business.id && (
                              <div className="absolute right-0 bottom-full mb-1 w-40 bg-[#111113] border border-white/[0.06] rounded-xl overflow-hidden z-50 shadow-xl shadow-black/50">
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setOpenMenuId(null);
                                    handleDeleteBusiness(business.id, business.name, e);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors text-left"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Excluir negócio</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </Link>
                    </div>
                  );
                })
              )}
            </div>

            {/* Sidebar Footer */}
            <div className="p-4 border-t border-white/[0.04] flex-shrink-0">
              {/* Logout */}
              <button
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white/[0.03] hover:bg-white/[0.06] rounded-xl transition-all text-zinc-500 hover:text-zinc-300 border border-transparent hover:border-white/[0.05]"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">Sair da Conta</span>
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

          {/* Toggle Button - Floating between sidebar and content */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`absolute top-5 z-20 w-7 h-7 bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.06] rounded-lg flex items-center justify-center transition-all duration-300 ${sidebarOpen ? 'left-[17rem]' : 'left-3'
              }`}
          >
            {sidebarOpen ? (
              <X className="w-3.5 h-3.5 text-zinc-500" />
            ) : (
              <Menu className="w-3.5 h-3.5 text-zinc-500" />
            )}
          </button>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col">
            {/* Content */}
            <main className="flex-1">
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
              {/* Backdrop overlay */}
              {rightSidebarOpen && (
                <div
                  className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] transition-opacity duration-300"
                  onClick={() => setRightSidebarOpen(false)}
                />
              )}
              {/* Hotzone para mostrar o botão */}
              <HotzoneMapButton
                rightSidebarOpen={rightSidebarOpen}
                setRightSidebarOpen={setRightSidebarOpen}
              />
              {/* Sidebar panel */}
              <aside
                className={`fixed top-0 right-0 bottom-0 z-[65] transition-all duration-500 ease-in-out overflow-hidden ${rightSidebarOpen ? 'w-[80vw]' : 'w-0'}`}
              >
                {rightSidebar}
              </aside>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
