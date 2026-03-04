'use client';

import React from 'react';
import { ArrowLeft, RefreshCw, Lightbulb } from 'lucide-react';
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
    critico:  { label: 'Crítico',  color: '#f87171', bg: 'rgba(239,68,68,0.10)'  },
    atencao:  { label: 'Atenção',  color: '#fbbf24', bg: 'rgba(251,191,36,0.10)' },
    bom:      { label: 'Bom',      color: '#34d399', bg: 'rgba(52,211,153,0.10)' },
    otimo:    { label: 'Ótimo',    color: '#818cf8', bg: 'rgba(129,140,248,0.10)'},
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
            <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wide mb-3">
                Entregas previstas
            </p>
            <div className="flex flex-col gap-1.5">
                {entregaveis.map((e: any, i: number) => (
                    <div key={i} className="flex items-center gap-2.5 py-2 px-3 rounded-lg bg-zinc-900/50 border border-zinc-800/40">
                        <img
                            src={ferramentaIcon(e.ferramenta)}
                            alt=""
                            style={{ width: 14, height: 14, objectFit: 'contain', flexShrink: 0, opacity: 0.7 }}
                        />
                        <span className="text-[11px] text-zinc-400 leading-snug line-clamp-2">
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
        <div className="flex-1 min-w-0 border-r border-zinc-800 flex flex-col pt-0 relative z-0 overflow-hidden">
            {/* Pillar color glow — top corner */}
            <div
                className="pointer-events-none absolute top-0 left-0 right-0 z-10"
                style={{
                    height: 320,
                    background: `radial-gradient(ellipse 100% 70% at 15% 0%, ${meta.color}28 0%, ${meta.color}0a 50%, transparent 100%)`,
                }}
            />

            {/* ── Fixed top area ─────────────────────────────────────────── */}
            <div className="shrink-0 px-6 pt-0 pb-4">
                {/* Linha fixa igual ao sidebar */}
                <div className="flex items-center justify-between border-b border-white/[0.04]" style={{ height: 56 }}>
                    <button onClick={onBack}
                        className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 transition-colors text-sm">
                        <ArrowLeft className="w-4 h-4" /> Especialistas
                    </button>
                    <button
                        onClick={() => handleRedoPillar(selectedPillar)}
                        title="Apagar e Refazer Todo o Pilar"
                        className="p-2 rounded-lg transition-all text-zinc-500 hover:bg-zinc-800/10"
                    >
                        <RefreshCw className="w-4 h-4 text-zinc-500" />
                    </button>
                </div>

                {/* Nome do Pilar à esquerda, score à direita */}
                <div className="flex items-center justify-between mb-2">
                    <h1 className="text-4xl font-semibold text-white leading-tight truncate">{plan.titulo_plano || meta.label}</h1>
                    {score > 0 && (
                        <div className="flex flex-col items-center gap-1 flex-shrink-0 ml-3">
                            <GaugeArc score={score} size={140} />
                            {statusCfg && (
                                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                                    style={{ color: statusCfg.color, background: statusCfg.bg }}>
                                    {statusCfg.label}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Diagnóstico */}
                {diagnostico && (
                    <p className="text-zinc-500 text-[11px] leading-relaxed mb-3 line-clamp-3">{diagnostico}</p>
                )}

                {/* Dado chave callout */}
                {dadoChave && (
                    <div className="flex items-start gap-2 mb-3 px-3 py-2 rounded-lg"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <Lightbulb className="w-3 h-3 mt-0.5 flex-shrink-0 text-amber-400/70" />
                        <p className="text-[11px] text-zinc-400 leading-snug">{dadoChave}</p>
                    </div>
                )}

                {/* Sources */}
                {allSources.length > 0 && (
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <img src="/google.png" alt="Fontes" className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wide">Fontes</span>
                            <span className="text-[10px] text-zinc-700 ml-auto">{allSources.length}</span>
                        </div>
                        <SourceBadgeList sources={allSources} maxVisible={3} />
                    </div>
                )}
            </div>

            {/* Divider */}
            <div className="shrink-0 mx-6 border-t border-zinc-800/60" />

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