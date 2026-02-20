'use client';

import React, { useState } from 'react';
import {
    Globe, Target, Share2, DollarSign, TrendingUp, Settings,
    ChevronDown, ChevronRight, Clock, Zap, CheckCircle2,
    RotateCcw, Rocket, Flag, Lock, ArrowRight, Loader2,
    BarChart3, Activity
} from 'lucide-react';

const DIMENSION_META: Record<string, { icon: React.ComponentType<any>; color: string }> = {
    presenca_digital: { icon: Globe, color: '#3b82f6' },
    competitividade: { icon: Target, color: '#f59e0b' },
    diversificacao_canais: { icon: Share2, color: '#8b5cf6' },
    precificacao: { icon: DollarSign, color: '#ec4899' },
    potencial_mercado: { icon: TrendingUp, color: '#10b981' },
    maturidade_operacional: { icon: Settings, color: '#6366f1' },
};

const IMPACT_COLORS: Record<string, string> = {
    alto: '#10b981',
    medio: '#f59e0b',
    baixo: '#6b7280',
};

interface ExecutionTask {
    id: string;
    titulo: string;
    categoria: string;
    impacto: string;
    tempo_estimado: string;
}

interface ExecutionPhase {
    id: string;
    titulo: string;
    descricao_curta: string;
    semanas: string;
    tarefas: ExecutionTask[];
}

interface ExecutionPlan {
    meta: string;
    horizonte: string;
    resumo_estrategia: string;
    fases: ExecutionPhase[];
}

interface ExecutionDashboardProps {
    plan: ExecutionPlan;
    score: any;
    userProfile: { name: string; segment: string };
    planId: string | null;
    onSelectTask: (task: ExecutionTask, phaseTitle: string) => void;
    onRedo: () => void;
    onViewDiagnostic: () => void;
    expandingTaskId: string | null;
}

function MiniScoreRing({ score, size = 48 }: { score: number; size?: number }) {
    const r = (size - 6) / 2;
    const c = 2 * Math.PI * r;
    const s = Math.max(0, Math.min(100, score));
    const offset = c - (s / 100) * c;
    const color = s >= 70 ? '#10b981' : s >= 40 ? '#f59e0b' : '#ef4444';
    return (
        <div className="relative inline-flex" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="4"
                    strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
                    className="transition-all duration-700" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-white">{s}</span>
            </div>
        </div>
    );
}

export default function ExecutionDashboard({
    plan,
    score,
    userProfile,
    planId,
    onSelectTask,
    onRedo,
    onViewDiagnostic,
    expandingTaskId,
}: ExecutionDashboardProps) {
    const [expandedPhase, setExpandedPhase] = useState<string | null>(plan.fases?.[0]?.id || null);

    const scoreGeral = score?.score_geral || 0;
    const totalTasks = plan.fases?.reduce((acc, f) => acc + (f.tarefas?.length || 0), 0) || 0;

    return (
        <div className="min-h-screen bg-[#09090b]">
            <div className="w-full max-w-5xl mx-auto px-6 py-10">

                {/* ── Header Row ── */}
                <div className="flex items-start justify-between mb-8">
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold text-white tracking-tight">{userProfile.name}</h1>
                        <p className="text-zinc-500 mt-1 text-sm">{userProfile.segment}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onViewDiagnostic}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl text-zinc-500 hover:text-zinc-300 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-all text-xs"
                        >
                            <BarChart3 className="w-3.5 h-3.5" />
                            Diagnóstico
                        </button>
                        <MiniScoreRing score={scoreGeral} />
                    </div>
                </div>

                {/* ── Meta Card ── */}
                <div className="p-5 rounded-2xl bg-[#111113] border border-white/[0.06] mb-6">
                    <div className="flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex-shrink-0">
                            <Flag className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div className="flex-1">
                            <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.15em] mb-1">Meta de crescimento</p>
                            <p className="text-white text-sm font-medium leading-relaxed">{plan.meta}</p>
                            <div className="flex items-center gap-4 mt-2 text-[11px] text-zinc-600">
                                <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {plan.horizonte}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Activity className="w-3 h-3" />
                                    {totalTasks} tarefas
                                </span>
                                <span className="flex items-center gap-1">
                                    <Rocket className="w-3 h-3" />
                                    {plan.fases?.length || 0} fases
                                </span>
                            </div>
                        </div>
                    </div>
                    {plan.resumo_estrategia && (
                        <p className="text-zinc-500 text-xs leading-relaxed mt-3 pl-11">{plan.resumo_estrategia}</p>
                    )}
                </div>

                {/* ── Section Label ── */}
                <p className="text-xs font-semibold text-zinc-600 uppercase tracking-[0.2em] mb-4">
                    Plano de execução
                </p>

                {/* ── Phases ── */}
                <div className="space-y-3">
                    {(plan.fases || []).map((fase, fi) => {
                        const isExpanded = expandedPhase === fase.id;
                        const phaseColor = fi === 0 ? '#10b981' : fi === 1 ? '#3b82f6' : fi === 2 ? '#a855f7' : '#f59e0b';

                        return (
                            <div key={fase.id} className="rounded-2xl bg-[#111113] border border-white/[0.06] overflow-hidden">
                                {/* Phase Header */}
                                <button
                                    onClick={() => setExpandedPhase(isExpanded ? null : fase.id)}
                                    className="w-full flex items-center gap-3 p-4 hover:bg-white/[0.02] transition-colors text-left"
                                >
                                    <div
                                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
                                        style={{ backgroundColor: `${phaseColor}15`, color: phaseColor, border: `1px solid ${phaseColor}30` }}
                                    >
                                        {fi + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white text-sm font-semibold truncate">{fase.titulo}</p>
                                        <p className="text-zinc-600 text-xs mt-0.5">{fase.descricao_curta}</p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className="text-[10px] text-zinc-600 px-2 py-0.5 rounded bg-white/[0.03]">
                                            {fase.tarefas?.length || 0} tarefas
                                        </span>
                                        {isExpanded
                                            ? <ChevronDown className="w-4 h-4 text-zinc-600" />
                                            : <ChevronRight className="w-4 h-4 text-zinc-600" />
                                        }
                                    </div>
                                </button>

                                {/* Tasks List */}
                                {isExpanded && (
                                    <div className="px-4 pb-4 space-y-2">
                                        {(fase.tarefas || []).map((task) => {
                                            const dimMeta = DIMENSION_META[task.categoria] || { icon: Zap, color: '#71717a' };
                                            const DimIcon = dimMeta.icon;
                                            const impactColor = IMPACT_COLORS[task.impacto] || '#6b7280';
                                            const isExpanding = expandingTaskId === task.id;

                                            return (
                                                <button
                                                    key={task.id}
                                                    onClick={() => !isExpanding && onSelectTask(task, fase.titulo)}
                                                    disabled={isExpanding}
                                                    className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.10] hover:bg-white/[0.04] transition-all text-left group disabled:opacity-60"
                                                >
                                                    {/* Category Icon */}
                                                    <div
                                                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                                        style={{ backgroundColor: `${dimMeta.color}12`, border: `1px solid ${dimMeta.color}22` }}
                                                    >
                                                        <DimIcon style={{ color: dimMeta.color, width: 14, height: 14 }} />
                                                    </div>

                                                    {/* Task Info */}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-zinc-200 text-sm font-medium truncate group-hover:text-white transition-colors">
                                                            {task.titulo}
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                                                                style={{ backgroundColor: `${impactColor}15`, color: impactColor }}>
                                                                {task.impacto}
                                                            </span>
                                                            {task.tempo_estimado && (
                                                                <span className="text-[10px] text-zinc-600 flex items-center gap-0.5">
                                                                    <Clock className="w-2.5 h-2.5" />
                                                                    {task.tempo_estimado}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Arrow / Loading */}
                                                    {isExpanding ? (
                                                        <Loader2 className="w-4 h-4 text-zinc-500 animate-spin flex-shrink-0" />
                                                    ) : (
                                                        <ArrowRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400 transition-colors flex-shrink-0" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* ── Footer ── */}
                <div className="flex justify-center mt-8">
                    <button
                        onClick={onRedo}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-zinc-500 hover:text-zinc-300 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-all text-sm"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Refazer Análise
                    </button>
                </div>
            </div>
        </div>
    );
}
