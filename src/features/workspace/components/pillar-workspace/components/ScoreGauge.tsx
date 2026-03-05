'use client';

import React, { useState, useEffect } from 'react';

// Funções utilitárias para o gráfico SVG
const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
        x: centerX + radius * Math.cos(angleInRadians),
        y: centerY + radius * Math.sin(angleInRadians),
    };
};

const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(x, y, radius, startAngle);
    const end = polarToCartesian(x, y, radius, endAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

    return [
        "M", start.x, start.y,
        "A", radius, radius, 0, largeArcFlag, 1, end.x, end.y
    ].join(" ");
};

const getStatusData = (val: number) => {
    if (val >= 85) return { label: "A+ / Selo Diamante", color: "#818cf8", bg: "rgba(129,140,248,0.10)", status: "Ótimo" };
    if (val >= 70) return { label: "B+ / Selo Ouro", color: "#818cf8", bg: "rgba(129,140,248,0.10)", status: "Ótimo" };
    if (val >= 50) return { label: "C / Selo Prata", color: "#34d399", bg: "rgba(52,211,153,0.10)", status: "Bom" };
    if (val >= 30) return { label: "D / Selo Bronze", color: "#fbbf24", bg: "rgba(251,191,36,0.10)", status: "Atenção" };
    return { label: "E / Risco Alto", color: "#f87171", bg: "rgba(239,68,68,0.10)", status: "Crítico" };
};

const segments = [
    { start: -78, end: -58, color: '#f87171' },
    { start: -43, end: -23, color: '#fbbf24' },
    { start: -10, end: 10, color: '#34d399' },
    { start: 23, end: 43, color: '#818cf8' },
    { start: 58, end: 78, color: '#6366f1' },
];

// ─── Mini arc reutilizável para views de pilar ───────────────────────────
interface GaugeArcProps {
    score: number;
    size?: number; // largura em px (altura = size * 0.55)
}

export function GaugeArc({ score, size = 120 }: GaugeArcProps) {
    const [current, setCurrent] = useState(0);

    useEffect(() => {
        let id: number;
        const start = performance.now();
        const target = Math.max(0, Math.min(100, score || 0));
        const animate = (now: number) => {
            const p = Math.min((now - start) / 1200, 1);
            const e = 1 - Math.pow(1 - p, 3);
            setCurrent(current + (target - current) * e);
            if (p < 1) id = requestAnimationFrame(animate);
            else setCurrent(target);
        };
        id = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(id);
    }, [score]);

    // Parâmetros fixos para garantir altura de 105px
    const fixedWidth = size;
    const fixedHeight = 105;
    const svgHeight = 81; // SVG visível dentro do container de 105px
    const vw = 320;
    const vh = 190;
    const cx = 160;
    const cy = 175;
    const r = 148;
    const sw = 22;

    const fillAngle = -78 + (current / 100) * 156;
    const displayInt = Math.round(current);

    return (
        <div style={{ width: fixedWidth, height: fixedHeight }} className="relative flex items-end justify-center">
            {/* SVG do arco — overflow visível mas a div pai recorta a parte de baixo */}
            <svg
                viewBox={`0 0 ${vw} ${vh}`}
                style={{ width: fixedWidth, height: svgHeight, overflow: 'visible', display: 'block' }}
            >
                {/* Trilhas de fundo */}
                {segments.map((seg, i) => (
                    <path
                        key={`gbg-${i}`}
                        d={describeArc(cx, cy, r, seg.start, seg.end)}
                        stroke="rgba(39,39,42,0.6)"
                        strokeWidth={sw}
                        strokeLinecap="round"
                        fill="none"
                    />
                ))}
                {/* Segmentos coloridos preenchidos */}
                {segments.map((seg, i) => {
                    if (fillAngle <= seg.start) return null;
                    const drawEnd = Math.min(seg.end, fillAngle);
                    if (drawEnd - seg.start < 0.01) return null;
                    return (
                        <path
                            key={`gfg-${i}`}
                            d={describeArc(cx, cy, r, seg.start, drawEnd)}
                            stroke={seg.color}
                            strokeWidth={sw}
                            strokeLinecap="round"
                            fill="none"
                            style={{ filter: `drop-shadow(0 0 10px ${seg.color}77)` }}
                        />
                    );
                })}
                {/* Score: número + /100 inline, mesmo tamanho */}
                <text
                    x={cx}
                    y={cy - 42}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="52"
                    fontFamily="inherit"
                >
                    <tspan fill="white" fontWeight="500">{displayInt}</tspan>
                    <tspan fill="rgba(113,113,122,0.9)" fontWeight="400">/100</tspan>
                </text>
            </svg>

            {/* Máscara inferior — tapa as pontas do arco, dando ilusão de profundidade */}
            <div
                className="absolute bottom-0 left-0 right-0 pointer-events-none"
                style={{
                    height: 18, // 105 - 81 = 24, metade para cima, metade para baixo
                    background: 'linear-gradient(to top, #09090b 60%, transparent 100%)',
                    zIndex: 2,
                }}
            />
        </div>
    );
}
// ──────────────────────────────────────────────────────────────────────────

interface ScoreGaugeProps {
    score: number;
    classificacao?: string;
    onExport: () => void;
    onRedo: () => void;
    loadingExport?: boolean;
    hasSession?: boolean;
}

export function ScoreGauge({ score, classificacao, onExport, onRedo, loadingExport, hasSession }: ScoreGaugeProps) {
    const [currentScore, setCurrentScore] = useState(0);

    useEffect(() => {
        let animationFrameId: number;
        const startTime = performance.now();
        const startValue = currentScore;
        const targetScore = Math.max(0, Math.min(100, score || 0));
        const duration = 1200;

        const animate = (time: number) => {
            const elapsed = time - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);
            const newValue = startValue + (targetScore - startValue) * ease;
            setCurrentScore(newValue);

            if (progress < 1) {
                animationFrameId = requestAnimationFrame(animate);
            } else {
                setCurrentScore(targetScore);
            }
        };

        animationFrameId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrameId);
    }, [score]);

    const cx = 160;
    const cy = 150;
    const radius = 135;
    const strokeWidth = 24;

    const statusData = classificacao
        ? { ...getStatusData(Math.round(currentScore)), label: classificacao }
        : getStatusData(Math.round(currentScore));

    const fillAngle = -78 + (currentScore / 100) * 156;
    const displayInt = Math.round(currentScore);

    // Find current segment color for shadow
    const getCurrentSegmentColor = () => {
        for (const seg of segments) {
            if (fillAngle <= seg.start) return segments[0].color;
            if (fillAngle >= seg.start && fillAngle <= seg.end) return seg.color;
        }
        return segments[segments.length - 1].color;
    };

    return (
        <div className="w-full flex flex-col relative">
            {/* PARTE SUPERIOR: DOIS CARTÕES */}
            <div className="flex flex-col md:flex-row gap-0 w-full relative z-10">
                {/* CARTÃO ESQUERDO: SCORE */}
                <div className="flex-1 relative h-[160px] overflow-hidden p-8 shadow-2xl border-r border-white/[0.04]">
                    {/* Efeito de Sombra Colorida apenas neste card */}
                    <div
                        className="absolute -top-20 right-1/4 translate-x-1/2 w-[700px] h-[500px] opacity-20 blur-[130px] pointer-events-none transition-colors duration-1000 z-0"
                        style={{ background: `radial-gradient(circle, ${getCurrentSegmentColor()} 0%, transparent 70%)` }}
                    />
                    <div className="absolute top-8 left-8">
                        <div className="text-zinc-500 text-xs mb-1 font-bold uppercase tracking-[0.2em]">
                            Score Comercial Total
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-white text-3xl font-medium tracking-tighter">{displayInt}</span>
                            <span className="text-zinc-600 text-3xl font-normal">/100</span>
                        </div>
                    </div>

                    <div className="absolute top-8 right-8 text-right">
                        <div className="text-zinc-500 text-xs mb-1 font-bold uppercase tracking-[0.2em]">
                            Status de Performance
                        </div>
                        <div
                            className="inline-block px-3 py-1 rounded-full text-[12px] font-bold border border-white/[0.05] transition-colors duration-500"
                            style={{ color: statusData.color, backgroundColor: statusData.bg }}
                        >
                            {statusData.label}
                        </div>
                    </div>

                    {/* Gráfico Gauge */}
                    <div className="absolute bottom-[-50px] left-1/2 -translate-x-1/2 w-[340px] h-[170px]">
                        <svg viewBox="0 0 320 160" className="w-full h-full drop-shadow-[0_0_20px_rgba(0,0,0,0.6)]">
                            {segments.map((seg, index) => (
                                <path
                                    key={`bg-${index}`}
                                    d={describeArc(cx, cy, radius, seg.start, seg.end)}
                                    stroke="rgba(39, 39, 42, 0.4)"
                                    strokeWidth={strokeWidth}
                                    strokeLinecap="round"
                                    fill="none"
                                />
                            ))}
                            {segments.map((seg, index) => {
                                if (fillAngle <= seg.start) return null;
                                const drawEnd = Math.min(seg.end, fillAngle);
                                if (drawEnd - seg.start < 0.01) return null;
                                return (
                                    <path
                                        key={`active-${index}`}
                                        d={describeArc(cx, cy, radius, seg.start, drawEnd)}
                                        stroke={seg.color}
                                        strokeWidth={strokeWidth}
                                        strokeLinecap="round"
                                        fill="none"
                                        style={{ filter: `drop-shadow(0 0 10px ${seg.color}55)` }}
                                    />
                                );
                            })}
                        </svg>
                    </div>
                </div>

                {/* CARTÃO DIREITO: HUB */}
                <div className="flex-1 h-[160px] bg-[#0d0d0d] flex flex-col justify-center p-12 shadow-lg">
                    <h2 className="text-white text-[34px] leading-[1.1] tracking-tight mb-5">
                        Hub de Especialistas:<br />
                        Seu Diagnóstico<br />
                        <span className="text-zinc-500">Comercial Completo</span>
                    </h2>
                    <div className="w-16 h-1 bg-violet-600 rounded-full" />
                </div>
            </div>

            {/* PARTE INFERIOR: BARRA DE AÇÕES */}
            <div className="w-full p-2 px-2 sm:px-4 flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10 border-t border-white/[0.04]">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-zinc-400 text-sm font-medium tracking-wide">
                        Análise processada com inteligência de dados
                    </span>
                </div>

                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={onExport}
                        disabled={loadingExport}
                        className="px-6 py-3 rounded-xl border border-white/[0.02] bg-white/[0.03] text-zinc-300 text-[13px] font-semibold hover:bg-white/[0.06] hover:text-white transition-all active:scale-95 whitespace-nowrap"
                    >
                        {loadingExport ? 'Gerando Doc...' : !hasSession ? 'Login c/ Google' : 'Exportar para Google Docs'}
                    </button>
                    <button
                        onClick={onRedo}
                        className="px-8 py-3 rounded-xl bg-violet-600 text-white text-[13px] font-bold hover:bg-violet-500 transition-all active:scale-95 shadow-lg shadow-violet-900/20 whitespace-nowrap"
                    >
                        Refazer Diagnóstico
                    </button>
                </div>
            </div>
        </div>
    );
}
