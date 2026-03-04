'use client';

import React from 'react';
import {
    Loader2, ChevronRight, RefreshCw, Users, AlertCircle, RotateCcw
} from 'lucide-react';
import { ScoreRing } from './ScoreRing';
import { ScoreGauge } from './ScoreGauge';
import { PILLAR_META, PILLAR_ORDER } from '../constants';
import { safeRender, openInGoogleDocs, exportFullAnalysis } from '../utils';

interface SpecialistGridProps {
    userProfile: { name: string; segment: string };
    scoreGeral: number;
    classificacao: string;
    resumo: string;
    dims: Record<string, any>;
    specialists: Record<string, any>;
    loadingPillar: string | null;
    pillarStates: Record<string, any>;
    completedTasks: Record<string, Set<string>>;
    marketData: any;
    session: any;
    profile: any;
    score: any;
    analysisId: string | null;
    businessId: string | null;
    loadingFullExport: boolean;
    setLoadingFullExport: (loading: boolean) => void;
    loadingDoc: string | null;
    setLoadingDoc: (docId: string | null) => void;
    onRedo: () => void;
    handleSelectPillar: (key: string) => void;
    error: string;
    setError: (error: string) => void;
}

export function SpecialistGrid({
    userProfile,
    scoreGeral,
    classificacao,
    resumo,
    dims,
    specialists,
    loadingPillar,
    pillarStates,
    completedTasks,
    marketData,
    session,
    profile,
    score,
    analysisId,
    businessId,
    loadingFullExport,
    setLoadingFullExport,
    loadingDoc,
    setLoadingDoc,
    onRedo,
    handleSelectPillar,
    error,
    setError
}: SpecialistGridProps) {
    return (
        <div className="min-h-full bg-[#09090b] relative z-20">
            <div className="flex flex-col gap-8">
                {/* Score Gauge Header */}
                <ScoreGauge
                    score={scoreGeral}
                    classificacao={safeRender(classificacao) as string}
                    onExport={() => exportFullAnalysis(session, setLoadingFullExport, {
                        profile, score, specialists, marketData, taskPlan: pillarStates
                    }, userProfile.name)}
                    onRedo={onRedo}
                    loadingExport={loadingFullExport}
                    hasSession={!!session?.accessToken}
                />

                {error && (
                    <div className="p-3 rounded-xl bg-red-950/30 text-red-200 text-sm">
                        {error}
                        <button onClick={() => setError('')} className="ml-2 text-red-400 underline text-xs">Fechar</button>
                    </div>
                )}

                {/* Specialist Cards Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2 px-2">
                    {PILLAR_ORDER.map((key: string) => {
                        const meta = PILLAR_META[key];
                        const Icon = meta.icon;
                        const dim = dims[key] || {};
                        const s = typeof dim.score === 'number' ? dim.score : 0;
                        const spec = specialists[key] || {};
                        const isLoading = loadingPillar === key;
                        const statusBadge = s >= 70 ? { text: 'Forte', cls: 'text-emerald-400 bg-emerald-500/10' }
                            : s >= 40 ? { text: 'Atenção', cls: 'text-amber-400 bg-amber-500/10' }
                                : s > 0 ? { text: 'Crítico', cls: 'text-red-400 bg-red-500/10' }
                                    : { text: 'Sem dados', cls: 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20' };
                        const cached = pillarStates[key];
                        const hasPlan = cached?.plan?.plan_data;
                        const progress = cached?.progress;

                        return (
                            <div key={key}
                                className="flex flex-col text-left p-3 rounded-2xl hover:bg-white/[0.04] transition-all duration-200 group cursor-pointer relative"
                                onClick={() => !isLoading && handleSelectPillar(key)}>

                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="p-2 rounded-lg" style={{ backgroundColor: `${meta.color}12` }}>
                                            <Icon className="w-4 h-4" style={{ color: meta.color }} />
                                        </div>
                                        {isLoading
                                            ? <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />
                                            : <ChevronRight className="w-4 h-4 text-zinc-800 group-hover:text-zinc-500 transition-colors" />}
                                    </div>

                                    <h3 className="text-white text-sm font-semibold mb-0.5">{meta.label}</h3>
                                    <p className="text-zinc-600 text-[11px] mb-2">{spec.cargo || ''}</p>

                                    <div className="flex items-center gap-2.5 mb-2">
                                        <ScoreRing score={s} size={36} color={meta.color} />
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${statusBadge.cls}`}>
                                            {statusBadge.text}
                                        </span>
                                    </div>

                                    {/* Diagnostic justificativa inline */}
                                    {dim.justificativa && (
                                        <p className="text-zinc-600 text-[10px] leading-relaxed line-clamp-2 mb-1">
                                            {safeRender(dim.justificativa)}
                                        </p>
                                    )}

                                    {hasPlan && progress && (
                                        <div className="mt-1">
                                            <div className="flex items-center justify-between text-[10px] text-zinc-600 mb-1">
                                                <span>{progress.completed || 0}/{progress.total || 0} tarefas</span>
                                            </div>
                                            <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                                                <div className="h-full rounded-full transition-all"
                                                    style={{ width: `${progress.total > 0 ? ((progress.completed || 0) / progress.total) * 100 : 0}%`, backgroundColor: meta.color }} />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Actions Footer */}
                                <div className="mt-4 pt-3 border-t border-white/[0.05] flex justify-end">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();

                                            // Format the context for export
                                            const mktCat = marketData?.categories?.find((c: any) => c.id === key);
                                            const marketHighlights = (mktCat?.resumo?.pontos_chave || [])
                                                .map((p: any) => '• ' + safeRender(p))
                                                .join('\n');
                                            const highlightsSection = marketHighlights ? `\n${marketHighlights}` : '';
                                            const mktInsights = mktCat?.resumo?.visao_geral
                                                ? `\n\n**Visão de Mercado:**\n${safeRender(mktCat.resumo.visao_geral)}${highlightsSection}`
                                                : '';

                                            // Format the context to look like a deliverable
                                            const contextDeliverable = {
                                                id: `context_${key}`,
                                                entregavel_titulo: `Contexto de Análise: ${meta.label}`,
                                                conteudo_completo: `**Diagnóstico da IA:**\n${safeRender(dim.justificativa || 'Sem dados diagnósticos.')}\n\n**Meta do Pilar:**\n${safeRender(dim.meta_pilar || 'Não definida.')}\n\n**Principal Desafio/Oportunidade:**\n${safeRender(dim.dado_chave || 'Não identificado.')}${mktInsights}`,
                                                fontes_consultadas: mktCat?.fontes || []
                                            };

                                            openInGoogleDocs(contextDeliverable, meta.label, session, setLoadingDoc, `ctx_${key}`);
                                        }}
                                        disabled={loadingDoc === `ctx_${key}`}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${!session?.accessToken ? 'bg-blue-500/10 text-blue-400' : 'bg-white/[0.03] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'}`}
                                    >
                                        {loadingDoc === `ctx_${key}` ? <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" /> : <img src="/docs.png" alt="" className="w-4 h-4" />}
                                        {loadingDoc === `ctx_${key}` ? 'Gerando Doc...' : !session?.accessToken ? 'Login c/ Google' : 'Abrir no Docs'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

