'use client';

import React from 'react';
import { ArrowLeft, RefreshCw, Lightbulb, Zap } from 'lucide-react';
import { PILLAR_META } from '../constants';
import { safeRender } from '../utils';
import { SourceBadgeList } from './SourceBadgeList';
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
    if (f === 'planilha' || f === 'calendario' || f === 'cronograma') return '/sheets.png';
    if (f === 'formulario' || f === 'pesquisa' || f === 'survey') return '/forms.svg';
    return '/docs.png';
}

function PlannedDeliverables({ entregaveis }: { entregaveis: any[] }) {
    if (!entregaveis?.length) return null;
    return (
        <div className="flex-1 overflow-y-auto px-6 py-4" style={{ scrollbarWidth: 'none' }}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] mb-3" style={{ color: 'var(--color-text-muted)' }}>
                Entregas previstas
            </p>
            <div className="flex flex-col gap-1.5">
                {entregaveis.map((e: any, i: number) => (
                    <div
                        key={i}
                        className="flex items-center gap-2.5 py-2 px-3 rounded-lg"
                        style={{
                            backgroundColor: 'var(--color-surface-hover)',
                            border: '1px solid var(--color-border)',
                        }}
                    >
                        <img
                            src={ferramentaIcon(e.ferramenta)}
                            alt=""
                            style={{ width: 14, height: 14, objectFit: 'contain', flexShrink: 0, opacity: 0.7 }}
                        />
                        <span className="text-[11px] leading-snug line-clamp-2" style={{ color: 'var(--color-text-tertiary)' }}>
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
    const dadoChave = safeRender(dims[selectedPillar]?.dado_chave || plan.dado_chave || '');

    const hasDocs = docsForDropdown.length > 0;
    const entregaveis: any[] = plan.entregaveis || [];

    return (
        <div
            className="flex-1 min-w-0 flex flex-col pt-0 relative z-0 overflow-hidden"
            style={{ borderRight: '1px solid var(--color-border)' }}
        >
            {/* Pillar color glow — top corner */}
            <div
                className="pointer-events-none absolute top-0 left-0 right-0 z-10"
                style={{
                    height: 320,
                    background: `radial-gradient(ellipse 100% 70% at 15% 0%, ${meta.color}18 0%, ${meta.color}06 50%, transparent 100%)`,
                }}
            />

            {/* ── Fixed top area ─────────────────────────────────────────── */}
            <div className="shrink-0 px-6 pt-0 pb-4">
                {/* Top bar */}
                <div
                    className="flex items-center justify-between"
                    style={{ height: 56, borderBottom: '1px solid var(--color-border)' }}
                >
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-sm transition-colors duration-150"
                        style={{ color: 'var(--color-text-muted)' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}
                    >
                        <ArrowLeft className="w-4 h-4" /> Especialistas
                    </button>
                    <button
                        onClick={() => handleRedoPillar(selectedPillar)}
                        title="Apagar e Refazer Todo o Pilar"
                        className="p-2 rounded-lg transition-all duration-150"
                        style={{ color: 'var(--color-text-muted)' }}
                        onMouseEnter={e => {
                            e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
                            e.currentTarget.style.color = 'var(--color-text-secondary)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = 'var(--color-text-muted)';
                        }}
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>

                {/* Pillar name + score */}
                <div className="flex items-center justify-between mb-2">
                    <h1 className="text-4xl font-semibold leading-tight truncate" style={{ color: 'var(--color-text-primary)' }}>
                        {plan.titulo_plano || meta.label}
                    </h1>
                    {score > 0 && (
                        <div className="flex flex-col items-center gap-1 flex-shrink-0 ml-3">
                            <GaugeArc score={score} size={140} />
                            {statusCfg && (
                                <span
                                    className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                                    style={{ color: statusCfg.color, background: statusCfg.bg }}
                                >
                                    {statusCfg.label}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Diagnostic */}
                {diagnostico && (
                    <p className="text-[11px] leading-relaxed mb-3 line-clamp-3" style={{ color: 'var(--color-text-muted)' }}>{diagnostico}</p>
                )}

                {/* 🔄 STRATEGIC FEEDBACK NOTE */}
                {dims[selectedPillar]?.justificativa_feedback && (
                    <div className="mb-4 p-3 rounded-lg border border-indigo-500/20 bg-indigo-500/5 flex items-start gap-2.5">
                        <Zap className="w-3.5 h-3.5 text-indigo-400 mt-0.5 shrink-0" />
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-400 opacity-80">Feedback Estratégico Real</span>
                            <span className="text-[11px] text-zinc-300 italic">
                                {safeRender(dims[selectedPillar].justificativa_feedback)}
                            </span>
                        </div>
                    </div>
                )}



                {/* Sources */}
                {allSources.length > 0 && (
                    <div className="mt-4">
                        <div className="flex items-center gap-2 mb-2">
                            <img src="/google.png" alt="Fontes" className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: 'var(--color-text-muted)' }}>Fontes</span>
                            <span className="text-[10px] ml-auto" style={{ color: 'var(--color-text-ghost)' }}>{allSources.length}</span>
                        </div>
                        <SourceBadgeList sources={allSources} maxVisible={3} />
                    </div>
                )}
            </div>

            {/* Divider */}
            <div className="shrink-0 mx-6" style={{ borderTop: '1px solid var(--color-border)' }} />

            {/* ── Bottom area: context before execution, docs after ──────── */}
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
    );
}