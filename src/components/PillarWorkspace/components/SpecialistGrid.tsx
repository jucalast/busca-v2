'use client';

import React from 'react';
import {
    Loader2, ChevronRight, RefreshCw, Users, AlertCircle, RotateCcw
} from 'lucide-react';
import { ScoreRing } from './ScoreRing';
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
        <div className="min-h-screen bg-[#09090b]">
            <div className="max-w-6xl mx-auto px-6 py-12">
                <div className="flex flex-col gap-8 lg:flex-row">
                    {/* Left column: business info + actions */}
                    <div className="w-full lg:w-5/12 space-y-6">
                        <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/[0.02] shadow-2xl shadow-black/40">
                            <p className="text-[11px] uppercase tracking-[0.3em] text-zinc-500 mb-3">Visão Geral</p>
                            <h1 className="text-2xl font-bold text-white tracking-tight">{userProfile.name}</h1>
                            <p className="text-zinc-500 text-sm mt-1">{userProfile.segment}</p>
                            <div className="mt-5 flex items-center gap-4">
                                <ScoreRing score={scoreGeral} size={88} color={scoreGeral >= 70 ? '#10b981' : scoreGeral >= 40 ? '#f59e0b' : '#ef4444'} />
                                <div className="flex flex-col gap-3">
                                    {classificacao && (
                                        <span className={`inline-flex items-center justify-center text-xs font-medium px-3 py-1 rounded-full ${scoreGeral >= 70
                                            ? 'text-emerald-400 bg-emerald-500/10'
                                            : scoreGeral >= 40 ? 'text-amber-400 bg-amber-500/10'
                                                : 'text-red-400 bg-red-500/10'}`}>
                                            {safeRender(classificacao)}
                                        </span>
                                    )}
                                    {resumo && (
                                        <p className="text-zinc-400 text-sm leading-relaxed">
                                            {safeRender(resumo)}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-white/[0.015] border border-white/[0.02]">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xs font-semibold text-zinc-600 uppercase tracking-[0.2em]">
                                    Seus 7 Especialistas
                                </h2>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => exportFullAnalysis(session, setLoadingFullExport, {
                                            profile, score, specialists, marketData, taskPlan: pillarStates
                                        }, userProfile.name)}
                                        disabled={loadingFullExport}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${!session?.accessToken ? 'bg-blue-500/10 text-blue-400' : 'text-zinc-400 hover:text-zinc-200'}`}>
                                        {loadingFullExport ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                                                Gerando Doc...
                                            </>
                                        ) : (
                                            <>
                                                <img src="/docs.png" alt="" className="w-5 h-5" />
                                                {!session?.accessToken ? 'Login c/ Google' : 'Abrir no Docs'}
                                            </>
                                        )}
                                    </button>
                                    <button onClick={onRedo}
                                        className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg bg-zinc-800/40 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors">
                                        <RefreshCw className="w-3 h-3" /> Reanalisar
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <div className="mt-4 p-3 rounded-xl bg-red-950/30 text-red-200 text-sm">
                                    {error}
                                    <button onClick={() => setError('')} className="ml-2 text-red-400 underline text-xs">Fechar</button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right column: specialists cards */}
                    <div className="flex-1 w-full">
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
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
                                className="flex flex-col text-left p-5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] transition-all duration-200 group cursor-pointer relative"
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
            </div>
        </div>
    );
}
