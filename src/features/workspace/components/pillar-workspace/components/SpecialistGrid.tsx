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
        <div className="min-h-full relative z-20" style={{ backgroundColor: 'var(--color-bg)' }}>
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
                    <div
                        className="p-3 rounded-lg text-sm mx-2"
                        style={{
                            backgroundColor: 'var(--color-destructive-muted)',
                            color: 'var(--color-destructive)',
                            border: '1px solid rgba(239,68,68,0.15)',
                        }}
                    >
                        {error}
                        <button onClick={() => setError('')} className="ml-2 underline text-xs" style={{ color: 'var(--color-destructive)' }}>Fechar</button>
                    </div>
                )}

                {/* Agent Pipeline Architecture */}
                <div className="w-full max-w-5xl mx-auto px-4 md:px-8 mt-4 pb-16">
                    <div className="flex items-center gap-3 mb-8 ml-2">
                        <Users className="w-6 h-6" style={{ color: 'var(--color-text-primary)' }} />
                        <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>Arquitetura de Agentes</h2>
                    </div>

                    <div className="relative pl-14 md:pl-20">
                        {/* Connecting Line */}
                        <div className="absolute left-[27px] md:left-[39px] top-8 bottom-12 w-[2px] z-0" style={{ backgroundColor: 'var(--color-border)' }}></div>

                        {PILLAR_ORDER.map((key: string, index: number) => {
                            const meta = PILLAR_META[key];
                            const Icon = meta.icon;
                            const dim = dims[key] || {};
                            const s = typeof dim.score === 'number' ? dim.score : 0;
                            const spec = specialists[key] || {};
                            const isLoading = loadingPillar === key;

                            const statusBadge = s >= 70
                                ? { text: 'Forte', color: 'var(--color-success)', bg: 'var(--color-success-muted)' }
                                : s >= 40
                                    ? { text: 'Atenção', color: 'var(--color-warning)', bg: 'var(--color-warning-muted)' }
                                    : s > 0
                                        ? { text: 'Crítico', color: 'var(--color-destructive)', bg: 'var(--color-destructive-muted)' }
                                        : { text: 'Sem dados', color: 'var(--color-text-muted)', bg: 'var(--color-surface-hover)' };

                            const cached = pillarStates[key];
                            const hasPlan = cached?.plan?.plan_data;
                            const progress = cached?.progress;

                            return (
                                <div
                                    key={key}
                                    className="relative flex flex-col group cursor-pointer mb-8 transition-opacity"
                                    style={{
                                        animationDelay: `${index * 60}ms`,
                                        animation: 'fade-in-up 0.4s ease-out backwards',
                                    }}
                                    onClick={() => !isLoading && handleSelectPillar(key)}
                                >
                                    {/* Timeline Node Icon */}
                                    <div
                                        className="absolute -left-14 md:-left-20 top-4 w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-[4deg] shadow-md z-10"
                                        style={{ backgroundColor: 'var(--color-surface-1)', border: `2px solid ${meta.color}` }}
                                    >
                                        <Icon className="w-5 h-5 md:w-6 md:h-6" style={{ color: meta.color }} />
                                    </div>

                                    {/* Agent Workspace Card */}
                                    <div
                                        className="w-full rounded-2xl p-0 transition-all duration-300 overflow-hidden relative"
                                        style={{ backgroundColor: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}
                                        onMouseEnter={e => {
                                            e.currentTarget.style.borderColor = meta.color;
                                            e.currentTarget.style.boxShadow = `0 8px 30px -4px ${meta.color}25`;
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                        }}
                                        onMouseLeave={e => {
                                            e.currentTarget.style.borderColor = 'var(--color-border)';
                                            e.currentTarget.style.boxShadow = 'none';
                                            e.currentTarget.style.transform = 'translateY(0)';
                                        }}
                                    >
                                        <div className="flex flex-col md:flex-row h-full">
                                            {/* Main Agent Info */}
                                            <div className="flex-1 p-6 md:p-8 flex flex-col justify-center relative">
                                                {/* Background subtle glow */}
                                                <div
                                                    className="absolute top-0 right-0 w-40 h-40 rounded-bl-full opacity-[0.03] transition-opacity duration-300 group-hover:opacity-[0.08]"
                                                    style={{ backgroundColor: meta.color, pointerEvents: 'none' }}
                                                />

                                                <div className="flex items-center gap-3 mb-2 relative z-10">
                                                    <h3 className="text-lg md:text-xl font-bold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>Agente {meta.label}</h3>
                                                    <span
                                                        className="text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wide"
                                                        style={{ color: statusBadge.color, backgroundColor: statusBadge.bg }}
                                                    >
                                                        {statusBadge.text}
                                                    </span>
                                                </div>

                                                <div className="text-sm font-semibold mb-4 flex items-center gap-2 relative z-10" style={{ color: meta.color }}>
                                                    <Users className="w-4 h-4" style={{ opacity: 0.8 }} />
                                                    {spec.cargo || 'Especialista em Análise'}
                                                </div>

                                                {dim.justificativa && (
                                                    <p className="text-sm leading-relaxed mb-6 text-left line-clamp-2 relative z-10 font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                                                        {safeRender(dim.justificativa)}
                                                    </p>
                                                )}

                                                {hasPlan && progress && (
                                                    <div className="mt-auto relative z-10 w-full max-w-md">
                                                        <div className="flex items-center justify-between text-[11px] font-bold mb-2 uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>
                                                            <span>Progresso das Tarefas</span>
                                                            <span style={{ color: 'var(--color-text-primary)' }}>{progress.completed || 0} / {progress.total || 0} ({progress.total > 0 ? Math.round(((progress.completed || 0) / progress.total) * 100) : 0}%)</span>
                                                        </div>
                                                        <div className="h-2 rounded-full overflow-hidden w-full" style={{ backgroundColor: 'var(--color-border)' }}>
                                                            <div className="h-full rounded-full transition-all duration-700 ease-out"
                                                                style={{ width: `${progress.total > 0 ? ((progress.completed || 0) / progress.total) * 100 : 0}%`, backgroundColor: meta.color }} />
                                                        </div>
                                                    </div>
                                                )}
                                                {!hasPlan && (
                                                    <div className="mt-auto text-xs font-semibold py-1.5 px-3 rounded-md self-start relative z-10" style={{ backgroundColor: 'var(--color-surface-hover)', color: 'var(--color-text-muted)' }}>
                                                        Nenhuma tarefa gerada
                                                    </div>
                                                )}
                                            </div>

                                            {/* Metrics & Actions Sidebar */}
                                            <div className="w-full md:w-64 p-6 md:p-8 flex flex-row md:flex-col items-center justify-between gap-5 border-t md:border-t-0 md:border-l relative z-10" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-hover)' }}>
                                                <div className="flex flex-col items-center justify-center w-full">
                                                    <ScoreRing score={s} size={76} color={meta.color} />
                                                    <span className="text-[11px] font-bold uppercase tracking-widest mt-3" style={{ color: 'var(--color-text-tertiary)' }}>Score do Pilar</span>
                                                </div>

                                                <div className="flex flex-col gap-2.5 w-full mt-2 md:mt-4">
                                                    <button
                                                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all hover:brightness-110 active:scale-[0.98] shadow-sm"
                                                        style={{ backgroundColor: meta.color, color: '#FFFFFF' }}
                                                    >
                                                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                                                        {isLoading ? 'Abrindo...' : 'Abrir Workspace'}
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const mktCat = marketData?.categories?.find((c: any) => c.id === key);
                                                            const marketHighlights = (mktCat?.resumo?.pontos_chave || [])
                                                                .map((p: any) => '• ' + safeRender(p))
                                                                .join('\n');
                                                            const highlightsSection = marketHighlights ? `\n${marketHighlights}` : '';
                                                            const mktInsights = mktCat?.resumo?.visao_geral
                                                                ? `\n\n**Visão de Mercado:**\n${safeRender(mktCat.resumo.visao_geral)}${highlightsSection}`
                                                                : '';
                                                            const contextDeliverable = {
                                                                id: `context_${key}`,
                                                                entregavel_titulo: `Contexto de Análise: ${meta.label}`,
                                                                conteudo_completo: `**Diagnóstico da IA:**\n${safeRender(dim.justificativa || 'Sem dados diagnósticos.')}\n\n**Meta do Pilar:**\n${safeRender(dim.meta_pilar || 'Não definida.')}\n\n**Principal Desafio/Oportunidade:**\n${safeRender(dim.dado_chave || 'Não identificado.')}${mktInsights}`,
                                                                fontes_consultadas: mktCat?.fontes || []
                                                            };
                                                            openInGoogleDocs(contextDeliverable, meta.label, session, setLoadingDoc, `ctx_${key}`);
                                                        }}
                                                        disabled={loadingDoc === `ctx_${key}`}
                                                        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all hover:bg-[var(--color-surface-active)]"
                                                        style={{
                                                            backgroundColor: 'transparent',
                                                            color: 'var(--color-text-secondary)',
                                                            border: '1px solid var(--color-border)'
                                                        }}
                                                        onMouseEnter={e => {
                                                            e.currentTarget.style.color = 'var(--color-text-primary)';
                                                        }}
                                                        onMouseLeave={e => {
                                                            e.currentTarget.style.color = 'var(--color-text-secondary)';
                                                        }}
                                                    >
                                                        {loadingDoc === `ctx_${key}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <img src="/docs.png" alt="" className="w-3.5 h-3.5 opacity-70" style={{ filter: 'grayscale(100%)' }} />}
                                                        Ver Contexto
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
