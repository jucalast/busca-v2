'use client';

import React from 'react';
import {
    Globe, Target, Share2, DollarSign, TrendingUp, Settings,
    RotateCcw, ChevronRight, Activity, ArrowUpRight
} from 'lucide-react';

const DIMENSIONS: Record<string, { icon: React.ComponentType<any>; label: string; color: string }> = {
    presenca_digital: { icon: Globe, label: 'Presença Digital', color: '#3b82f6' },
    competitividade: { icon: Target, label: 'Competitividade', color: '#f59e0b' },
    diversificacao_canais: { icon: Share2, label: 'Canais de Venda', color: '#8b5cf6' },
    precificacao: { icon: DollarSign, label: 'Precificação', color: '#ec4899' },
    potencial_mercado: { icon: TrendingUp, label: 'Potencial de Mercado', color: '#10b981' },
    maturidade_operacional: { icon: Settings, label: 'Operação', color: '#6366f1' },
};

const TASK_TO_DIMENSION: Record<string, string> = {
    presenca_digital: 'presenca_digital',
    competitividade: 'competitividade',
    canais: 'diversificacao_canais',
    precificacao: 'precificacao',
    mercado: 'potencial_mercado',
    operacional: 'maturidade_operacional',
    credibilidade: 'presenca_digital',
    conversao: 'competitividade',
};

function ScoreRing({ score, size = 200 }: { score: number; size?: number }) {
    const radius = (size - 16) / 2;
    const circumference = 2 * Math.PI * radius;
    const safeScore = typeof score === 'number' && !isNaN(score) ? Math.max(0, Math.min(100, score)) : 0;
    const offset = circumference - (safeScore / 100) * circumference;

    const color = safeScore >= 70 ? '#10b981' : safeScore >= 40 ? '#f59e0b' : '#ef4444';

    return (
        <div className="relative inline-flex" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
                <circle
                    cx={size / 2} cy={size / 2} r={radius}
                    fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="8"
                />
                <circle
                    cx={size / 2} cy={size / 2} r={radius}
                    fill="none" stroke={color} strokeWidth="8"
                    strokeDasharray={circumference} strokeDashoffset={offset}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-bold text-white tracking-tight">{safeScore}</span>
                <span className="text-zinc-600 text-sm mt-1">de 100</span>
            </div>
        </div>
    );
}

interface GrowthHubProps {
    data: any;
    userProfile: { name: string; segment: string };
    onSelectDimension: (key: string) => void;
    onRedo: () => void;
}

export default function GrowthHub({ data, userProfile, onSelectDimension, onRedo }: GrowthHubProps) {
    const score = data.score || {};
    const dimensoes = score.dimensoes || {};
    const scoreGeral = score.score_geral || 0;
    const classificacao = score.classificacao || '';
    const resumo = score.resumo_executivo || '';
    const tasks = data.taskPlan?.tasks || [];
    const sources = data.marketData?.allSources || [];

    return (
        <div className="min-h-screen bg-[#09090b] flex items-start justify-center">
            <div className="w-full max-w-4xl px-6 py-16">

                {/* Business Identity */}
                <div className="text-center mb-14">
                    <h1 className="text-3xl font-bold text-white tracking-tight">
                        {userProfile.name}
                    </h1>
                    <p className="text-zinc-500 mt-1.5 text-sm tracking-wide">
                        {userProfile.segment}
                    </p>
                </div>

                {/* Score Ring */}
                <div className="flex flex-col items-center mb-14">
                    <ScoreRing score={scoreGeral} />

                    {classificacao && (
                        <span className={`mt-5 text-sm font-medium px-4 py-1.5 rounded-full border ${scoreGeral >= 70
                            ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10'
                            : scoreGeral >= 40
                                ? 'text-amber-400 border-amber-500/20 bg-amber-500/10'
                                : 'text-red-400 border-red-500/20 bg-red-500/10'
                            }`}>
                            {classificacao}
                        </span>
                    )}

                    {resumo && (
                        <p className="text-zinc-400 text-center mt-6 max-w-xl text-sm leading-relaxed">
                            {resumo}
                        </p>
                    )}

                    {/* Quick stats */}
                    <div className="flex items-center gap-6 mt-6 text-xs text-zinc-600">
                        <span className="flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5" />
                            {tasks.length} {tasks.length === 1 ? 'acao' : 'acoes'}
                        </span>
                        <span className="w-px h-3 bg-zinc-800" />
                        <span className="flex items-center gap-1.5">
                            <Globe className="w-3.5 h-3.5" />
                            {sources.length} fontes
                        </span>
                    </div>
                </div>

                {/* Section Heading */}
                <div className="mb-6">
                    <h2 className="text-xs font-semibold text-zinc-600 uppercase tracking-[0.2em]">
                        Pontos a trabalhar
                    </h2>
                </div>

                {/* Dimension Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Object.entries(DIMENSIONS).map(([key, meta]) => {
                        const dim = dimensoes[key] || {};
                        const s = typeof dim.score === 'number' ? dim.score : 50;
                        const Icon = meta.icon;
                        const relatedTasks = tasks.filter((t: any) =>
                            t.categoria === key || TASK_TO_DIMENSION[t.categoria] === key
                        );

                        return (
                            <button
                                key={key}
                                onClick={() => onSelectDimension(key)}
                                className="text-left p-5 rounded-2xl bg-[#111113] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-200 group"
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <div
                                        className="p-2 rounded-lg"
                                        style={{ backgroundColor: `${meta.color}12` }}
                                    >
                                        <Icon className="w-4 h-4" style={{ color: meta.color }} />
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-zinc-800 group-hover:text-zinc-500 transition-colors" />
                                </div>

                                <h3 className="text-white text-sm font-semibold mb-2.5">{meta.label}</h3>

                                <div className="flex items-center gap-2.5 mb-2.5">
                                    <div className="flex-1 h-1 bg-zinc-800/80 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-700"
                                            style={{
                                                width: `${s}%`,
                                                backgroundColor: s >= 70 ? '#10b981' : s >= 40 ? '#f59e0b' : '#ef4444'
                                            }}
                                        />
                                    </div>
                                    <span className={`text-xs font-mono ${s >= 70 ? 'text-emerald-500' : s >= 40 ? 'text-amber-500' : 'text-red-500'
                                        }`}>
                                        {s}
                                    </span>
                                </div>

                                <p className="text-zinc-600 text-xs line-clamp-2 leading-relaxed">
                                    {dim.justificativa || 'Clique para ver detalhes e conversar com a IA'}
                                </p>

                                <div className="flex items-center gap-3 mt-3">
                                    {relatedTasks.length > 0 && (
                                        <span className="flex items-center gap-1 text-zinc-700 text-[10px]">
                                            <ArrowUpRight className="w-3 h-3" />
                                            {relatedTasks.length} {relatedTasks.length === 1 ? 'ação' : 'ações'}
                                        </span>
                                    )}
                                    {dim.fontes_utilizadas?.length > 0 && (
                                        <span className="flex items-center gap-1 text-zinc-700 text-[10px]">
                                            <Globe className="w-3 h-3" />
                                            {dim.fontes_utilizadas.length} {dim.fontes_utilizadas.length === 1 ? 'fonte' : 'fontes'}
                                        </span>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Redo */}
                <div className="flex justify-center mt-14">
                    <button
                        onClick={onRedo}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-zinc-500 hover:text-zinc-300 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-all text-sm"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Refazer Analise
                    </button>
                </div>
            </div>
        </div>
    );
}
