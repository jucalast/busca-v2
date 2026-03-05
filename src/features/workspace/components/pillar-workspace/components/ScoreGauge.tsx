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

    const fixedWidth = size;
    const fixedHeight = 105;
    const svgHeight = 81;
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
            <svg
                viewBox={`0 0 ${vw} ${vh}`}
                style={{ width: fixedWidth, height: svgHeight, overflow: 'visible', display: 'block' }}
            >
                {segments.map((seg, i) => (
                    <path
                        key={`gbg-${i}`}
                        d={describeArc(cx, cy, r, seg.start, seg.end)}
                        stroke="var(--color-border)"
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
                            style={{ filter: `drop-shadow(0 0 8px ${seg.color}55)` }}
                        />
                    );
                })}
                <text
                    x={cx}
                    y={cy - 42}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="52"
                    fontFamily="inherit"
                >
                    <tspan fill="var(--color-text-primary)" fontWeight="500">{displayInt}</tspan>
                    <tspan fill="var(--color-text-muted)" fontWeight="400">/100</tspan>
                </text>
            </svg>
            <div
                className="absolute bottom-0 left-0 right-0 pointer-events-none"
                style={{
                    height: 18,
                    background: 'linear-gradient(to top, var(--color-bg) 60%, transparent 100%)',
                    zIndex: 2,
                }}
            />
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

    const getCurrentSegmentColor = () => {
        for (const seg of segments) {
            if (fillAngle <= seg.start) return segments[0].color;
            if (fillAngle >= seg.start && fillAngle <= seg.end) return seg.color;
        }
        return segments[segments.length - 1].color;
    };

    return (
        <div className="w-full flex flex-col relative border-b border-r border-[var(--color-border)]">
            {/* Top section: two cards */}
            <div className="flex flex-col md:flex-row gap-0 w-full relative z-10 border-b border-[var(--color-border)]">
                {/* Left: Score */}
                <div
                    className="flex-1 relative h-[160px] overflow-hidden p-8"
                    style={{ borderRight: '1px solid var(--color-border)' }}
                >
                    <div
                        className="absolute -top-20 right-1/4 translate-x-1/2 w-[700px] h-[500px] opacity-15 blur-[130px] pointer-events-none transition-colors duration-1000 z-0"
                        style={{ background: `radial-gradient(circle, ${getCurrentSegmentColor()} 0%, transparent 70%)` }}
                    />
                    <div className="absolute top-8 left-8">
                        <div className="text-xs mb-1 font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--color-text-muted)' }}>
                            Score Comercial Total
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-medium tracking-tighter" style={{ color: 'var(--color-text-primary)' }}>{displayInt}</span>
                            <span className="text-3xl font-normal" style={{ color: 'var(--color-text-muted)' }}>/100</span>
                        </div>
                    </div>

                    <div className="absolute top-8 right-8 text-right">
                        <div className="text-xs mb-1 font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--color-text-muted)' }}>
                            Status de Performance
                        </div>
                        <div
                            className="inline-block px-3 py-1 rounded-full text-[12px] font-bold transition-colors duration-500"
                            style={{
                                color: statusData.color,
                                backgroundColor: statusData.bg,
                                border: '1px solid var(--color-border)',
                            }}
                        >
                            {statusData.label}
                        </div>
                    </div>

                    <div className="absolute bottom-[-50px] left-1/2 -translate-x-1/2 w-[340px] h-[170px]">
                        <svg viewBox="0 0 320 160" className="w-full h-full" style={{ filter: 'drop-shadow(0 0 20px rgba(0,0,0,0.4))' }}>
                            {segments.map((seg, index) => (
                                <path
                                    key={`bg-${index}`}
                                    d={describeArc(cx, cy, radius, seg.start, seg.end)}
                                    stroke="var(--color-border)"
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
                                        style={{ filter: `drop-shadow(0 0 8px ${seg.color}44)` }}
                                    />
                                );
                            })}
                        </svg>
                    </div>
                </div>

                {/* Right: Hub title */}
                <div
                    className="flex-1 h-[160px] flex flex-col justify-center p-12"
                    style={{ backgroundColor: 'var(--color-surface-1)' }}
                >
                    <h2 className="text-[34px] leading-[1.1] tracking-tight mb-5" style={{ color: 'var(--color-text-primary)' }}>
                        Hub de Especialistas:<br />
                        Seu Diagnóstico<br />
                        <span style={{ color: 'var(--color-text-muted)' }}>Comercial Completo</span>
                    </h2>
                    <div className="w-16 h-1 rounded-full" style={{ backgroundColor: 'var(--color-accent)' }} />
                </div>
            </div>

            {/* Bottom: action bar */}
            <div
                className="w-full p-2 px-2 sm:px-4 flex flex-col sm:flex-row items-center justify-between gap-6 relative z-50 bg-transparent"
                style={{ borderTop: 'none' }}
            >
                <div className="flex items-center gap-2">
                    {children}
                </div>

                <div className="flex flex-wrap gap-2.5">
                    <button
                        onClick={onExport}
                        disabled={loadingExport}
                        className="px-4 py-2 rounded-lg text-[12px] font-medium transition-all duration-200 whitespace-nowrap"
                        style={{
                            backgroundColor: 'var(--color-surface-1)',
                            color: 'var(--color-text-secondary)',
                            border: '1px solid var(--color-border)',
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
                            e.currentTarget.style.color = 'var(--color-text-primary)';
                            e.currentTarget.style.borderColor = 'var(--color-border-strong)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.backgroundColor = 'var(--color-surface-1)';
                            e.currentTarget.style.color = 'var(--color-text-secondary)';
                            e.currentTarget.style.borderColor = 'var(--color-border)';
                        }}
                    >
                        {loadingExport ? 'Gerando...' : !hasSession ? 'Login c/ Google' : 'Exportar para Google Docs'}
                    </button>
                    <button
                        onClick={onRedo}
                        className="px-4 py-2 rounded-lg text-[12px] font-medium transition-all duration-200 whitespace-nowrap"
                        style={{
                            backgroundColor: 'var(--color-surface-1)',
                            color: 'var(--color-text-secondary)',
                            border: '1px solid var(--color-border)',
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
                            e.currentTarget.style.color = 'var(--color-text-primary)';
                            e.currentTarget.style.borderColor = 'var(--color-border-strong)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.backgroundColor = 'var(--color-surface-1)';
                            e.currentTarget.style.color = 'var(--color-text-secondary)';
                            e.currentTarget.style.borderColor = 'var(--color-border)';
                        }}
                    >
                        Refazer Diagnóstico
                    </button>
                </div>
            </div>
        </div>
    );
}
