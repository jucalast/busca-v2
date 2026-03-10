'use client';

import React from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { PILLAR_META } from '../constants';
import { safeRender } from '../utils';
import { SourceBadgeList } from '@/features/shared/components/SourceBadgeList';
import { DocumentsTab, DocItem } from './DocumentsTab';
import { GaugeArc } from './ScoreGauge';
import { TaskItem } from '../types';

interface PillarHeaderProps {
    selectedPillar: string;
    plan: any;
    specialists: Record<string, any>;
    dims: Record<string, any>;
    allSources: string[];
    session: any;
    businessId: string | null;
    setLoadingDoc: (id: string | null) => void;
    setError: (err: string) => void;
    handleRedoPillar: (key: string) => void;
    onBack: () => void;
    docsForDropdown: DocItem[];
    visibleTasks: TaskItem[];
    openFolders: Set<string>;
    setOpenFolders: React.Dispatch<React.SetStateAction<Set<string>>>;
    loadingDoc: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    critico: { label: 'Crítico', color: 'var(--color-destructive)', bg: 'var(--color-destructive-muted)' },
    atencao: { label: 'Atenção', color: 'var(--color-warning)', bg: 'var(--color-warning-muted)' },
    bom: { label: 'Bom', color: 'var(--color-success)', bg: 'var(--color-success-muted)' },
    otimo: { label: 'Ótimo', color: '#818cf8', bg: 'rgba(129,140,248,0.10)' },
};

function ferramentaIcon(ferramenta: string): string {
    const f = (ferramenta || '').toLowerCase();
    if (f.includes('planilha') || f.includes('calendario') || f.includes('cronograma')) return '/sheets.png';
    if (f.includes('formulario') || f.includes('pesquisa') || f.includes('survey')) return '/forms.svg';
    if (f.includes('linkedin')) return '/linkedin.png';
    if (f.includes('instagram')) return '/instagram.png';
    if (f.includes('facebook') || f.includes('fb') || f.includes('library')) return '/facebook.png';
    if (f.includes('trends')) return '/trends.png';
    if (f.includes('google') || f.includes('ads')) return '/google.png';
    return '/docs.png';
}

function PlannedDeliverables({ entregaveis }: { entregaveis: any[] }) {
    if (!entregaveis?.length) return null;
    return (
        <div className="flex-1 overflow-y-auto px-6 py-6 pb-20" style={{ scrollbarWidth: 'none' }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-4 opacity-50" style={{ color: 'var(--color-text-secondary)' }}>
                Entregas previstas
            </p>
            <div className="flex flex-col gap-2">
                {entregaveis.map((e: any, i: number) => (
                    <div
                        key={i}
                        className="flex items-center gap-3 py-3 px-4 rounded-xl bg-white border border-gray-200"
                    >
                        <img
                            src={ferramentaIcon(e.ferramenta)}
                            alt=""
                            className="w-4 h-4 object-contain shrink-0 opacity-80"
                        />
                        <span className="text-[12px] font-semibold leading-snug line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>
                            {safeRender(e.titulo)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function PillarHeader({
    selectedPillar,
    plan,
    specialists,
    dims,
    allSources,
    session,
    setLoadingDoc,
    handleRedoPillar,
    onBack,
    docsForDropdown,
    visibleTasks,
    openFolders,
    setOpenFolders,
    loadingDoc,
}: PillarHeaderProps) {
    const meta = PILLAR_META[selectedPillar];
    const Icon = meta?.icon;

    const score: number = plan.score ?? dims[selectedPillar]?.score ?? 0;
    const status: string = (plan.status ?? dims[selectedPillar]?.status ?? '').toLowerCase();
    const statusCfg = STATUS_CONFIG[status] ?? null;

    const diagnostico = safeRender(plan.diagnostico || plan.objetivo || '');

    const hasDocs = docsForDropdown.length > 0;
    const entregaveis: any[] = plan.entregaveis || [];

    return (
        <div className="w-[60%] flex flex-col pt-0 relative z-0 overflow-hidden bg-white/85 backdrop-blur-2xl rounded-[24px] border border-white/60 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)]">

            {/* Gradiente Decorativo no Topo */}
            <div className="pointer-events-none absolute top-0 left-0 right-0 z-0 h-[400px]"
                style={{
                    background: `radial-gradient(100% 70% at 15% 0%, ${meta.color}15 0%, ${meta.color}05 60%, transparent 100%)`,
                }}>
            </div>

            {/* ── Fixed top area ─────────────────────────────────────────── */}
            <div className="shrink-0 px-6 pt-0 pb-6 relative z-10">
                {/* Top bar */}
                <div className="flex items-center justify-between mb-8 h-16 border-b border-gray-200/50">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-[13px] font-medium transition-all duration-200 px-3 py-1.5 rounded-xl bg-white/40 hover:bg-white/70 border border-white/50 shadow-sm text-gray-700"
                    >
                        <ArrowLeft size={14} />
                        Especialistas
                    </button>
                    <button
                        onClick={() => handleRedoPillar(selectedPillar)}
                        title="Apagar e Refazer Todo o Pilar"
                        className="p-2.5 rounded-xl transition-all duration-150 bg-white/40 hover:bg-red-50 border border-white/50 shadow-sm text-red-400 hover:text-red-500"
                    >
                        <RefreshCw size={14} />
                    </button>
                </div>

                {/* Título e Gráfico */}
                <div className="flex items-start justify-between mb-4 gap-4">
                    <h1 className="text-[28px] font-bold leading-[1.1] tracking-tight text-gray-900">
                        {plan.titulo_plano || meta.label}
                    </h1>
                    {score > 0 && (
                        <div className="flex flex-col items-center gap-2 flex-shrink-0">
                            <div className="relative flex items-end justify-center w-[80px] h-[68px]">
                                <GaugeArc score={score} size={80} strokeWidth={8} />
                            </div>
                            {statusCfg && (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider text-gray-700 bg-white/60 border border-gray-200/50">
                                    {statusCfg.label}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Descrição */}
                {diagnostico && (
                    <p className="text-[13px] leading-relaxed mb-6 font-medium line-clamp-4 text-gray-600">{diagnostico}</p>
                )}

                {/* Sources */}
                {allSources.length > 0 && (
                    <div className="mt-2">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40 ml-1" style={{ color: 'var(--color-text-secondary)' }}>Fontes de Pesquisa</span>
                            <div className="h-[1px] flex-1 bg-black/5" />
                        </div>
                        <SourceBadgeList sources={allSources} maxVisible={4} />
                    </div>
                )}
            </div>

            {/* ── Bottom area: context before execution, docs after ──────── */}
            <div className="flex-1 flex flex-col min-h-0 relative z-10">
                {hasDocs ? (
                    <DocumentsTab
                        docsForDropdown={docsForDropdown}
                        visibleTasks={visibleTasks}
                        selectedPillar={selectedPillar}
                        openFolders={openFolders}
                        setOpenFolders={setOpenFolders}
                        session={session}
                        loadingDoc={loadingDoc}
                        setLoadingDoc={setLoadingDoc}
                    />
                ) : (
                    <PlannedDeliverables entregaveis={entregaveis} />
                )}
            </div>
        </div>
    );
}
