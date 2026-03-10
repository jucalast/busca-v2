'use client';

import React, { useState, useEffect } from 'react';

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
    if (val >= 50) return { label: "C / Selo Prata", color: "var(--color-success)", bg: "var(--color-success-muted)", status: "Bom" };
    if (val >= 30) return { label: "D / Selo Bronze", color: "var(--color-warning)", bg: "var(--color-warning-muted)", status: "Atenção" };
    return { label: "E / Risco Alto", color: "var(--color-destructive)", bg: "var(--color-destructive-muted)", status: "Crítico" };
};

const segments = [
    { start: -78, end: -58, color: '#f87171' },
    { start: -43, end: -23, color: '#fbbf24' },
    { start: -10, end: 10, color: '#34d399' },
    { start: 23, end: 43, color: '#818cf8' },
    { start: 58, end: 78, color: '#6366f1' },
];

interface GaugeArcProps {
    score: number;
    size?: number;
    strokeWidth?: number;
}

export function GaugeArc({ score, size = 120, strokeWidth = 22 }: GaugeArcProps) {
    const [current, setCurrent] = useState(0);

    useEffect(() => {
        let id: number;
        const start = performance.now();
        const target = Math.max(0, Math.min(100, score || 0));
        const animate = (now: number) => {
            const p = Math.min((now - start) / 1200, 1);
            const e = 1 - Math.pow(1 - p, 4); // Smoother quintic ease
            setCurrent(current + (target - current) * e);
            if (p < 1) id = requestAnimationFrame(animate);
            else setCurrent(target);
        };
        id = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(id);
    }, [score]);

    const fixedWidth = size;
    const fixedHeight = size * 0.85;
    const svgHeight = size * 0.65;
    const vw = 320;
    const vh = 190;
    const cx = 160;
    const cy = 175;
    const r = 148;
    const sw = strokeWidth;

    const fillAngle = -78 + (current / 100) * 156;
    const displayInt = Math.round(current);

    return (
        <div style={{ width: fixedWidth, height: fixedHeight }} className="relative flex items-end justify-center">
            <svg
                viewBox={`0 0 ${vw} ${vh}`}
                style={{ width: fixedWidth, height: svgHeight, overflow: 'visible', display: 'block' }}
            >
                {segments.map((seg, i) => (
                    <path
                        key={`gbg-${i}`}
                        d={describeArc(cx, cy, r, seg.start, seg.end)}
                        stroke="rgba(0,0,0,0.05)"
                        strokeWidth={sw}
                        strokeLinecap="round"
                        fill="none"
                    />
                ))}
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
                            style={{ filter: `drop-shadow(0 2px 4px ${seg.color}40)` }}
                        />
                    );
                })}
                <text
                    x={cx}
                    y={cy - 45}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="64"
                    fontFamily="inherit"
                >
                    <tspan fill="var(--color-text-primary)" fontWeight="700" letterSpacing="-2">{displayInt}</tspan>
                    <tspan fill="var(--color-text-muted)" fontWeight="500" fontSize="32">/100</tspan>
                </text>
            </svg>
        </div>
    );
}

interface ScoreGaugeProps {
    score: number;
    classificacao?: string;
    onExport: () => void;
    onRedo: () => void;
    loadingExport?: boolean;
    hasSession?: boolean;
    children?: React.ReactNode;
}

export function ScoreGauge({ score, classificacao, onExport, onRedo, loadingExport, hasSession, children }: ScoreGaugeProps) {
    const [currentScore, setCurrentScore] = useState(0);

    useEffect(() => {
        let animationFrameId: number;
        const startTime = performance.now();
        const startValue = currentScore;
        const targetScore = Math.max(0, Math.min(100, score || 0));
        const duration = 1500;

        const animate = (time: number) => {
            const elapsed = time - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 4);
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
    const strokeWidth = 26;

    const statusData = classificacao
        ? { ...getStatusData(Math.round(currentScore)), label: classificacao }
        : getStatusData(Math.round(currentScore));

    const fillAngle = -78 + (currentScore / 100) * 156;
    const displayInt = Math.round(currentScore);

    const getCurrentSegmentColor = () => {
        let lastColor = segments[0].color;
        for (const seg of segments) {
            if (fillAngle >= seg.start) {
                lastColor = seg.color;
            } else {
                break;
            }
        }
        return lastColor;
    };

    return (
        <div className="w-full flex flex-col relative border-b border-black/5 rounded-t-3xl">
            {/* Top section: two cards */}
            <div className="flex flex-col md:flex-row gap-0 w-full relative z-10 border-b border-black/5">
                {/* Left: Score */}
                <div
                    className="flex-1 relative h-[180px] overflow-hidden p-8 border-r border-black/5 rounded-tl-3xl"
                >
                    <div
                        className="absolute -top-10 -right-10 w-[600px] h-[400px] opacity-[0.08] blur-[100px] pointer-events-none transition-colors duration-1000 z-0"
                        style={{ background: `radial-gradient(circle, ${getCurrentSegmentColor()} 0%, transparent 75%)` }}
                    />

                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div>
                            <div className="text-[10px] mb-1 font-bold uppercase tracking-[0.2em] opacity-40" style={{ color: 'var(--color-text-primary)' }}>
                                Comercial Score
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-4xl font-bold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>{displayInt}</span>
                                <span className="text-lg font-medium opacity-30" style={{ color: 'var(--color-text-primary)' }}>/100</span>
                            </div>
                        </div>

                        <div className="flex flex-col items-start gap-1">
                            <div className="text-[10px] font-bold uppercase tracking-[0.15em] opacity-30" style={{ color: 'var(--color-text-primary)' }}>
                                Status do Negócio
                            </div>
                            <div
                                className="inline-block px-3 py-1 rounded-full text-[11px] font-bold transition-all duration-500"
                                style={{
                                    color: statusData.color,
                                    backgroundColor: 'white',
                                    border: `1px solid ${statusData.color}20`,
                                    boxShadow: `0 2px 10px -2px ${statusData.color}15`
                                }}
                            >
                                {statusData.label}
                            </div>
                        </div>
                    </div>

                    <div className="absolute bottom-[-60px] right-8 w-[320px] h-[160px] opacity-100">
                        <svg viewBox="0 0 320 160" className="w-full h-full">
                            {segments.map((seg, index) => (
                                <path
                                    key={`bg-${index}`}
                                    d={describeArc(cx, cy, radius, seg.start, seg.end)}
                                    stroke="rgba(0,0,0,0.04)"
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
                                        style={{ filter: `drop-shadow(0 0 10px ${seg.color}30)` }}
                                    />
                                );
                            })}
                        </svg>
                    </div>
                </div>

                {/* Right: Hub title */}
                <div
                    className="flex-1 h-[180px] flex flex-col justify-center p-10 md:p-12 relative overflow-hidden rounded-tr-3xl"
                    style={{ backgroundColor: 'rgba(243, 244, 246, 0.8)' }}
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[60px] rounded-full" />
                    <h2 className="text-[28px] font-bold leading-[1.2] tracking-tight mb-4 relative z-10" style={{ color: 'var(--color-text-primary)' }}>
                        Hub de Especialistas IA<br />
                        <span className="opacity-40">Diagnóstico Estratégico</span>
                    </h2>
                    <div className="w-12 h-1 rounded-full relative z-10" style={{ backgroundColor: 'var(--color-accent)' }} />
                </div>
            </div>

            {/* Bottom: action bar */}
            <div
                className="w-full p-4 px-6 flex flex-col sm:flex-row items-center justify-between gap-4 relative z-50 bg-white/40 backdrop-blur-md rounded-b-3xl"
            >
                <div className="flex items-center gap-2">
                    {children}
                </div>

                <div className="flex flex-wrap gap-2.5">
                    <button
                        onClick={onExport}
                        disabled={loadingExport}
                        className="px-5 py-2.5 rounded-xl text-[12px] font-bold transition-all duration-200 whitespace-nowrap bg-white border border-black/5 shadow-sm hover:shadow-md hover:-translate-y-0.5"
                        style={{ color: 'var(--color-text-secondary)' }}
                    >
                        {loadingExport ? 'Gerando...' : !hasSession ? 'Login c/ Google' : 'Exportar Plano'}
                    </button>
                    <button
                        onClick={onRedo}
                        className="px-5 py-2.5 rounded-xl text-[12px] font-bold transition-all duration-200 whitespace-nowrap bg-black text-white shadow-xl hover:shadow-black/20 hover:-translate-y-0.5"
                    >
                        Refazer Tudo
                    </button>
                </div>
            </div>
        </div>
    );
}

