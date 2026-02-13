'use client';

import React, { useEffect, useState } from 'react';

interface Dimensao {
    score: number;
    peso: number;
    status: string;
    justificativa: string;
    acoes_imediatas?: string[];
    [key: string]: any;
}

interface Oportunidade {
    titulo: string;
    descricao: string;
    impacto_potencial: string;
    esforco: string;
    urgencia: string;
    dados_suporte: string;
    prioridade_calculada: number;
}

interface ScoreData {
    score_geral: number;
    classificacao: string;
    dimensoes: Record<string, Dimensao>;
    oportunidades: Oportunidade[];
    resumo_executivo: string;
}

interface ScoreCardProps {
    data: ScoreData;
    compact?: boolean;
}

const ScoreCard: React.FC<ScoreCardProps> = ({ data, compact }) => {
    if (!data) return null;

    if (compact) {
        return (
            <div className="flex flex-col md:flex-row items-center gap-2 md:gap-6">
                <div className="scale-75 origin-top md:origin-center -my-4 md:m-0 flex-shrink-0">
                    <AnimatedGauge score={data.score_geral} classification={data.classificacao} />
                </div>
                <div className="flex-1 w-full space-y-3 pr-2">
                    {Object.entries(data.dimensoes || {}).slice(0, 4).map(([key, dim]) => {
                        const label = DIMENSION_LABELS[key] || { name: key, icon: '📊' };
                        const colorClass = dim.score < 40 ? 'bg-red-500' : dim.score < 70 ? 'bg-amber-500' : 'bg-emerald-500';
                        const textClass = dim.score < 40 ? 'text-red-400' : dim.score < 70 ? 'text-amber-400' : 'text-emerald-400';

                        return (
                            <div key={key} className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-zinc-800/50 flex items-center justify-center text-lg shadow-sm border border-zinc-700/30">
                                    {label.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-end mb-1">
                                        <span className="text-xs font-semibold text-zinc-300 truncate">{label.name}</span>
                                        <span className={`text-xs font-bold tabular-nums ${textClass}`}>{dim.score}</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${dim.score}%` }} />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    const sortedOportunidades = [...(data.oportunidades || [])].sort(
        (a, b) => (b.prioridade_calculada || 0) - (a.prioridade_calculada || 0)
    );

    return (
        <div className="space-y-8">
            {/* Header + Gauge */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 md:p-8 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-lime-500" />

                <div className="text-center mb-6">
                    <div className="inline-block px-4 py-1.5 rounded-full bg-emerald-950/50 border border-emerald-800/50 mb-3">
                        <span className="text-emerald-400 text-sm font-semibold tracking-wider uppercase">
                            Score de Saúde do Negócio
                        </span>
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row items-center gap-8">
                    {/* Gauge */}
                    <AnimatedGauge score={data.score_geral} classification={data.classificacao} />

                    {/* Executive Summary + Dimensions */}
                    <div className="flex-1 space-y-4 w-full">
                        <p className="text-zinc-300 text-sm leading-relaxed bg-zinc-900/50 rounded-xl p-4 border-l-4 border-emerald-500">
                            {data.resumo_executivo}
                        </p>

                        <div className="space-y-2">
                            {Object.entries(data.dimensoes || {}).map(([key, dim]) => (
                                <DimensionBar key={key} dimKey={key} dim={dim} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Opportunities */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 md:p-8 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-500 to-orange-500" />

                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <span className="text-xl">🚀</span> Oportunidades Identificadas
                    </h3>
                    <span className="text-xs bg-amber-500/15 text-amber-400 px-3 py-1 rounded-full font-semibold">
                        {sortedOportunidades.length} encontradas
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {sortedOportunidades.map((op, idx) => (
                        <div
                            key={idx}
                            className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-5 hover:border-amber-500/30 transition-all group"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <h4 className="text-sm font-semibold text-white group-hover:text-amber-300 transition-colors flex-1">
                                    {op.titulo}
                                </h4>
                                <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full ml-2 tabular-nums">
                                    #{idx + 1}
                                </span>
                            </div>

                            <p className="text-zinc-400 text-xs leading-relaxed mb-3">{op.descricao}</p>

                            <div className="flex flex-wrap gap-2 mb-3">
                                <span className={`text-xs px-2 py-0.5 rounded-full bg-zinc-800 ${IMPACT_COLOR[op.impacto_potencial] || 'text-zinc-400'}`}>
                                    Impacto: {op.impacto_potencial}
                                </span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                                    Esforço: {op.esforco}
                                </span>
                                {op.urgencia === 'alta' && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">
                                        ⚡ Urgente
                                    </span>
                                )}
                            </div>

                            {op.dados_suporte && (
                                <p className="text-[11px] text-zinc-500 italic border-t border-zinc-800/30 pt-2 mt-2">
                                    📊 {op.dados_suporte}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const DIMENSION_LABELS: Record<string, { name: string; icon: string }> = {
    presenca_digital: { name: 'Presença Digital', icon: '🌐' },
    competitividade: { name: 'Competitividade', icon: '🎯' },
    diversificacao_canais: { name: 'Diversificação de Canais', icon: '📡' },
    precificacao: { name: 'Precificação', icon: '💎' },
    potencial_mercado: { name: 'Potencial de Mercado', icon: '📈' },
    maturidade_operacional: { name: 'Maturidade Operacional', icon: '⚙️' },
};

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
    critico: { bg: 'bg-red-500/15', text: 'text-red-400', label: '🔴 Crítico' },
    atencao: { bg: 'bg-amber-500/15', text: 'text-amber-400', label: '🟡 Atenção' },
    forte: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: '🟢 Forte' },
};

const IMPACT_COLOR: Record<string, string> = {
    alto: 'text-emerald-400',
    medio: 'text-amber-400',
    baixo: 'text-zinc-400',
};

function AnimatedGauge({ score, classification }: { score: number; classification: string }) {
    const safeScore = typeof score === 'number' && !isNaN(score) ? score : 0;
    const [animatedScore, setAnimatedScore] = useState(0);

    useEffect(() => {
        const duration = 1500;
        const steps = 60;
        const increment = safeScore / steps;
        let current = 0;
        const interval = setInterval(() => {
            current += increment;
            if (current >= safeScore) {
                setAnimatedScore(safeScore);
                clearInterval(interval);
            } else {
                setAnimatedScore(Math.round(current));
            }
        }, duration / steps);
        return () => clearInterval(interval);
    }, [safeScore]);

    const circumference = 2 * Math.PI * 80;
    const dashoffset = circumference - (animatedScore / 100) * circumference;

    const getColor = (s: number) => {
        if (s < 30) return '#ef4444';
        if (s < 50) return '#f59e0b';
        if (s < 70) return '#10b981';
        return '#22c55e';
    };

    return (
        <div className="flex flex-col items-center gap-3">
            <div className="relative w-48 h-48">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 180 180">
                    {/* Background track */}
                    <circle
                        cx="90" cy="90" r="80"
                        fill="none"
                        stroke="#27272a"
                        strokeWidth="12"
                    />
                    {/* Score arc */}
                    <circle
                        cx="90" cy="90" r="80"
                        fill="none"
                        stroke={getColor(animatedScore)}
                        strokeWidth="12"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={dashoffset}
                        className="transition-all duration-100"
                        style={{ filter: `drop-shadow(0 0 8px ${getColor(animatedScore)}40)` }}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-5xl font-bold text-white tabular-nums">
                        {animatedScore}
                    </span>
                    <span className="text-xs text-zinc-500 uppercase tracking-wider mt-1">de 100</span>
                </div>
            </div>
            <div className={`px-4 py-1.5 rounded-full text-sm font-semibold ${score < 30 ? 'bg-red-500/15 text-red-400' :
                score < 50 ? 'bg-amber-500/15 text-amber-400' :
                    score < 70 ? 'bg-emerald-500/15 text-emerald-400' :
                        'bg-green-500/15 text-green-400'
                }`}>
                {classification}
            </div>
        </div>
    );
}

function DimensionBar({ dimKey, dim }: { dimKey: string; dim: Dimensao }) {
    const [expanded, setExpanded] = useState(false);
    const label = DIMENSION_LABELS[dimKey] || { name: dimKey, icon: '📊' };
    const badge = STATUS_BADGE[dim.status] || STATUS_BADGE.atencao;

    return (
        <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800/50 overflow-hidden transition-all hover:border-zinc-700">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full p-4 flex items-center gap-4 text-left"
            >
                <span className="text-xl">{label.icon}</span>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-white">{label.name}</span>
                        <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
                                {badge.label}
                            </span>
                            <span className="text-sm font-bold text-white tabular-nums w-8 text-right">
                                {dim.score}
                            </span>
                        </div>
                    </div>
                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-1000"
                            style={{
                                width: `${dim.score}%`,
                                background: dim.score < 30 ? '#ef4444' : dim.score < 50 ? '#f59e0b' : dim.score < 70 ? '#10b981' : '#22c55e'
                            }}
                        />
                    </div>
                </div>
                <span className="text-zinc-600 text-sm">{expanded ? '▲' : '▼'}</span>
            </button>

            {expanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-zinc-800/30 pt-3 animate-in fade-in duration-200">
                    <p className="text-zinc-400 text-sm leading-relaxed">{dim.justificativa}</p>
                    {dim.acoes_imediatas && dim.acoes_imediatas.length > 0 && (
                        <div>
                            <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wider mb-1.5">
                                Ações Imediatas
                            </p>
                            <ul className="space-y-1">
                                {dim.acoes_imediatas.map((acao, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                                        <span className="text-emerald-500 mt-0.5">→</span>
                                        {acao}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default ScoreCard;
