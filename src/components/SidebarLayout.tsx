'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Building2, Plus, TrendingUp, LogOut, Menu, X, MapPin, Trash2, MoreVertical } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';

interface Business {
  id: string;
  name: string;
  segment: string;
  model: string;
  location: string;
  created_at: string;
  updated_at: string;
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
}

export default function SidebarLayout({
  userId,
  currentBusinessId,
  onSelectBusiness,
  onCreateNew,
  onDeleteBusiness,
  onLogout,
  children,
}: SidebarLayoutProps) {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
    <div className="flex flex-col h-screen bg-[#09090b] overflow-hidden">
      {/* Top Bar - Full Width */}
      <header className="h-20 border-b border-zinc-800 bg-[#111113] flex items-center px-6 flex-shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-4">
          <img 
            src="/logo.png" 
            alt="Logo" 
            className="h-12 w-auto object-contain"
          />
        </div>

        
      </header>

      {/* Bottom Area - Sidebar + Main Content */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? 'w-80' : 'w-0'
          } transition-all duration-300 flex-shrink-0 border-r border-zinc-800 bg-zinc-950 flex flex-col overflow-hidden`}
        >
          {/* New Business Button */}
          <div className="p-4 flex-shrink-0">
            <button
              onClick={onCreateNew}
              className="w-full flex items-center justify-center gap-2.5 px-4 py-3.5 hover:bg-white/[0.04] rounded-xl transition-all"
            >
              <Plus className="w-5 h-5 text-zinc-400" />
              <span className="text-zinc-300 font-semibold">Novo Negócio</span>
            </button>
          </div>

          {/* Business List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 border-t border-zinc-800">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-zinc-600 border-t-transparent mx-auto mb-3"></div>
              <p className="text-xs text-zinc-500">Carregando negócios...</p>
            </div>
          ) : businesses.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-8 h-8 text-zinc-600" />
              </div>
              <p className="text-sm text-zinc-400 mb-2 font-medium">Nenhum negócio ainda</p>
              <p className="text-xs text-zinc-600">Crie seu primeiro negócio para começar</p>
            </div>
          ) : (
            businesses.map((business) => (
              <div key={business.id} className="relative">
                <div
                  onClick={() => onSelectBusiness(business.id)}
                  className={`cursor-pointer p-5 rounded-2xl bg-[#111113] border transition-all duration-200 ${
                    currentBusinessId === business.id
                      ? 'border-white/[0.12]'
                      : 'border-white/[0.06] hover:border-white/[0.12]'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2.5">
                    <div className="flex-1 min-w-0 pr-2">
                      <h3 className="text-sm font-semibold text-white truncate mb-1.5">
                        {business.name}
                      </h3>
                      <p className="text-xs text-zinc-500 truncate">
                        {business.segment}
                      </p>
                    </div>
                    {business.latest_analysis && (
                      <div
                        className={`ml-3 px-2.5 py-1.5 rounded-lg ${getScoreBg(
                          business.latest_analysis.score_geral
                        )} flex-shrink-0 border ${
                          business.latest_analysis.score_geral >= 80
                            ? 'border-green-500/30'
                            : business.latest_analysis.score_geral >= 60
                            ? 'border-yellow-500/30'
                            : 'border-red-500/30'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <TrendingUp
                            className={`w-3.5 h-3.5 ${getScoreColor(
                              business.latest_analysis.score_geral
                            )}`}
                          />
                          <span
                            className={`text-sm font-bold ${getScoreColor(
                              business.latest_analysis.score_geral
                            )}`}
                          >
                            {business.latest_analysis.score_geral}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs text-zinc-600">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-zinc-800/80 rounded-md font-medium">
                        {business.model}
                      </span>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        <span>{business.location}</span>
                      </div>
                    </div>
                    <div className="relative" ref={openMenuId === business.id ? menuRef : null}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === business.id ? null : business.id);
                        }}
                        className="p-1 hover:bg-zinc-800 rounded transition-colors"
                      >
                        <MoreVertical className="w-3.5 h-3.5 text-zinc-500" />
                      </button>
                      {openMenuId === business.id && (
                        <div className="absolute right-0 bottom-full mb-1 w-40 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl overflow-hidden z-50">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(null);
                              handleDeleteBusiness(business.id, business.name, e);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors text-left"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Excluir negócio</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Sidebar Footer - Logout */}
        <div className="p-4 border-t border-zinc-800 flex-shrink-0">
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-3 bg-zinc-900 hover:bg-zinc-800 border border-white/[0.06] hover:border-white/[0.12] rounded-xl transition-all text-zinc-400 hover:text-white"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-medium">Sair da Conta</span>
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
        className={`absolute top-4 z-20 w-8 h-8 bg-[#111113] hover:bg-zinc-700 border border-zinc-700 rounded-md flex items-center justify-center transition-all duration-300 ${
          sidebarOpen ? 'left-[19rem]' : 'left-3'
        }`}
      >
        {sidebarOpen ? (
          <X className="w-4 h-4 text-zinc-400" />
        ) : (
          <Menu className="w-4 h-4 text-zinc-400" />
        )}
      </button>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {error && (
            <div className="m-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
              {error}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  </div>
  );
}
