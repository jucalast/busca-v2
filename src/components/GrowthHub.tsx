'use client';

import React from 'react';
import {
    Globe, Target, Share2, DollarSign, TrendingUp, Settings,
    RotateCcw, ChevronRight, Activity, ArrowUpRight, CheckCircle2,
    Zap, Search, BarChart3, ShoppingBag, Instagram, MessageCircle
} from 'lucide-react';

const DIMENSIONS: Record<string, { icon: React.ComponentType<any>; label: string; color: string; brandBg: string }> = {
    presenca_digital: { icon: Globe, label: 'Presença Digital', color: '#3b82f6', brandBg: '#1d4ed820' },
    competitividade: { icon: Target, label: 'Competitividade', color: '#f59e0b', brandBg: '#92400e20' },
    diversificacao_canais: { icon: Share2, label: 'Canais de Venda', color: '#8b5cf6', brandBg: '#5b21b620' },
    precificacao: { icon: DollarSign, label: 'Precificação', color: '#ec4899', brandBg: '#9d174d20' },
    potencial_mercado: { icon: TrendingUp, label: 'Potencial de Mercado', color: '#10b981', brandBg: '#06522820' },
    maturidade_operacional: { icon: Settings, label: 'Operação', color: '#6366f1', brandBg: '#312e8120' },
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

const FEATURE_CHIPS = [
    { icon: Instagram, label: 'Redes Sociais', color: '#e1306c', bg: '#e1306c18' },
    { icon: Search, label: 'Pesquisa Web', color: '#4285f4', bg: '#4285f418' },
    { icon: BarChart3, label: 'Análise IA', color: '#a855f7', bg: '#a855f718' },
    { icon: ShoppingBag, label: 'Canais de Venda', color: '#f59e0b', bg: '#f59e0b18' },
    { icon: MessageCircle, label: 'WhatsApp', color: '#25d366', bg: '#25d36618' },
    { icon: Zap, label: 'Automação', color: '#facc15', bg: '#facc1518' },
];

function ScoreRing({ score, size = 160 }: { score: number; size?: number }) {
    const radius = (size - 16) / 2;
    const circumference = 2 * Math.PI * radius;
    const safeScore = typeof score === 'number' && !isNaN(score) ? Math.max(0, Math.min(100, score)) : 0;
    const offset = circumference - (safeScore / 100) * circumference;
    const color = safeScore >= 70 ? '#10b981' : safeScore >= 40 ? '#f59e0b' : '#ef4444';

    return (
        <div className="relative inline-flex" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                <circle
                    cx={size / 2} cy={size / 2} r={radius}
                    fill="none" stroke={color} strokeWidth="8"
                    strokeDasharray={circumference} strokeDashoffset={offset}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold text-white tracking-tight">{safeScore}</span>
                <span className="text-zinc-600 text-xs mt-0.5">de 100</span>
            </div>
        </div>
    );
}

function BrandIcon({ icon: Icon, color, bg, size = 36 }: { icon: React.ComponentType<any>; color: string; bg: string; size?: number }) {
    return (
        <div
            className="rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ width: size, height: size, backgroundColor: bg, border: `1px solid ${color}22` }}
        >
            <Icon style={{ color, width: size * 0.5, height: size * 0.5 }} />
        </div>
    );
}

interface GrowthHubProps {
    data: any;
    userProfile: { name: string; segment: string };
    onSelectDimension: (key: string) => void;
    onRedo: () => void;
    onBackToExecution?: () => void;
}

export default function GrowthHub({ data, userProfile, onSelectDimension, onRedo, onBackToExecution }: GrowthHubProps) {
    const score = data.score || {};
    const dimensoes = score.dimensoes || {};
    const scoreGeral = score.score_geral || 0;
    const classificacao = score.classificacao || '';
    const resumo = score.resumo_executivo || '';
    const tasks = data.taskPlan?.tasks || [];
    const sources = data.marketData?.allSources || [];

    const scoreColor = scoreGeral >= 70 ? '#10b981' : scoreGeral >= 40 ? '#f59e0b' : '#ef4444';
    const scoreTextClass = scoreGeral >= 70 ? 'text-emerald-400' : scoreGeral >= 40 ? 'text-amber-400' : 'text-red-400';
    const scoreBorderClass = scoreGeral >= 70 ? 'border-emerald-500/20 bg-emerald-500/10' : scoreGeral >= 40 ? 'border-amber-500/20 bg-amber-500/10' : 'border-red-500/20 bg-red-500/10';

    const dimEntries = Object.entries(DIMENSIONS);

    return (
        <div className="min-h-screen bg-[#09090b]">
            <div className="w-full max-w-5xl mx-auto px-6 py-10">

                {/* ── Header ── */}
                <div className="flex items-start justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">{userProfile.name}</h1>
                        <p className="text-zinc-500 mt-1 text-sm">{userProfile.segment}</p>
                    </div>
                    {onBackToExecution && (
                        <button
                            onClick={onBackToExecution}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl text-zinc-500 hover:text-zinc-300 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-all text-xs"
                        >
                            Voltar ao Plano
                        </button>
                    )}
                </div>

                {/* ── Feature Chips Row ── */}
                <div className="flex flex-wrap gap-2 mb-8">
                    {FEATURE_CHIPS.map((chip) => (
                        <div
                            key={chip.label}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.07] bg-[#111113]"
                        >
                            <BrandIcon icon={chip.icon} color={chip.color} bg={chip.bg} size={22} />
                            <span className="text-xs font-medium text-zinc-300">{chip.label}</span>
                        </div>
                    ))}
                </div>

                {/* ── Section Label ── */}
                <p className="text-xs font-semibold text-zinc-600 uppercase tracking-[0.2em] mb-4">
                    Diagnóstico do negócio
                </p>

                {/* ── Bento Grid ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 auto-rows-auto">

                    {/* Score Card — spans 1 col, 2 rows visually via padding */}
                    <div className="row-span-2 flex flex-col items-center justify-center p-6 rounded-2xl bg-[#111113] border border-white/[0.06]">
                        <ScoreRing score={scoreGeral} />
                        {classificacao && (
                            <span className={`mt-4 text-xs font-semibold px-3 py-1 rounded-full border ${scoreTextClass} ${scoreBorderClass}`}>
                                {classificacao}
                            </span>
                        )}
                        {resumo && (
                            <p className="text-zinc-500 text-center mt-4 text-xs leading-relaxed line-clamp-4">
                                {resumo}
                            </p>
                        )}
                        <div className="flex items-center gap-4 mt-5 text-[11px] text-zinc-600">
                            <span className="flex items-center gap-1.5">
                                <Activity className="w-3 h-3" />
                                {tasks.length} ações
                            </span>
                            <span className="w-px h-3 bg-zinc-800" />
                            <span className="flex items-center gap-1.5">
                                <Globe className="w-3 h-3" />
                                {sources.length} fontes
                            </span>
                        </div>
                    </div>

                    {/* Dimension Cards — fill remaining grid slots */}
                    {dimEntries.map(([key, meta], idx) => {
                        const dim = dimensoes[key] || {};
                        const s = typeof dim.score === 'number' ? dim.score : 50;
                        const Icon = meta.icon;
                        const relatedTasks = tasks.filter((t: any) =>
                            t.categoria === key || TASK_TO_DIMENSION[t.categoria] === key
                        );
                        const sColor = s >= 70 ? '#10b981' : s >= 40 ? '#f59e0b' : '#ef4444';
                        const sTextClass = s >= 70 ? 'text-emerald-500' : s >= 40 ? 'text-amber-500' : 'text-red-500';

                        return (
                            <button
                                key={key}
                                onClick={() => onSelectDimension(key)}
                                className="text-left p-5 rounded-2xl bg-[#111113] border border-white/[0.06] hover:border-white/[0.14] hover:bg-[#16161a] transition-all duration-200 group"
                            >
                                {/* Card header */}
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2.5">
                                        <BrandIcon icon={Icon} color={meta.color} bg={meta.brandBg} size={34} />
                                        <span className="text-white text-sm font-semibold leading-tight">{meta.label}</span>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400 transition-colors flex-shrink-0 mt-0.5" />
                                </div>

                                {/* Score bar */}
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-700"
                                            style={{ width: `${s}%`, backgroundColor: sColor }}
                                        />
                                    </div>
                                    <span className={`text-xs font-bold font-mono ${sTextClass}`}>{s}</span>
                                </div>

                                {/* Description */}
                                <p className="text-zinc-500 text-xs line-clamp-2 leading-relaxed">
                                    {dim.justificativa || 'Clique para ver detalhes e conversar com a IA'}
                                </p>

                                {/* Footer meta */}
                                {(relatedTasks.length > 0 || dim.fontes_utilizadas?.length > 0) && (
                                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/[0.04]">
                                        {relatedTasks.length > 0 && (
                                            <span className="flex items-center gap-1 text-zinc-600 text-[10px]">
                                                <ArrowUpRight className="w-3 h-3" />
                                                {relatedTasks.length} {relatedTasks.length === 1 ? 'ação' : 'ações'}
                                            </span>
                                        )}
                                        {dim.fontes_utilizadas?.length > 0 && (
                                            <span className="flex items-center gap-1 text-zinc-600 text-[10px]">
                                                <Globe className="w-3 h-3" />
                                                {dim.fontes_utilizadas.length} {dim.fontes_utilizadas.length === 1 ? 'fonte' : 'fontes'}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* ── Checklist Footer ── */}
                <div className="mt-6 p-5 rounded-2xl bg-[#111113] border border-white/[0.06]">
                    <p className="text-xs font-semibold text-zinc-600 uppercase tracking-[0.2em] mb-4">
                        O que está incluído
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {[
                            { icon: Instagram, color: '#e1306c', text: 'Análise de redes sociais (Instagram, Facebook, TikTok)' },
                            { icon: Search, color: '#4285f4', text: 'Pesquisa aprofundada de mercado na internet' },
                            { icon: BarChart3, color: '#a855f7', text: 'Score de maturidade em 6 dimensões de negócio' },
                            { icon: ShoppingBag, color: '#f59e0b', text: 'Análise de canais de venda e marketplace' },
                            { icon: MessageCircle, color: '#25d366', text: 'Diagnóstico de WhatsApp e canais de atendimento' },
                            { icon: Zap, color: '#facc15', text: 'Sugestões de automação e funis de vendas' },
                        ].map((item, i) => (
                            <div key={i} className="flex items-start gap-2.5">
                                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: item.color }} />
                                <span className="text-zinc-400 text-xs leading-relaxed">{item.text}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Redo ── */}
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
