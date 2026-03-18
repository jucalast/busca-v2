'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useSidebar } from '@/contexts/SidebarContext';

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
    const { isDark } = useSidebar();
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
                        stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}
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
                        <React.Fragment key={`gfg-group-${i}`}>
                            <path
                                d={describeArc(cx, cy, r, seg.start, drawEnd)}
                                stroke={seg.color}
                                strokeWidth={sw}
                                strokeLinecap="round"
                                fill="none"
                                style={{ filter: 'blur(4px)', opacity: 0.6 }}
                            />
                            <path
                                d={describeArc(cx, cy, r, seg.start, drawEnd)}
                                stroke={seg.color}
                                strokeWidth={sw}
                                strokeLinecap="round"
                                fill="none"
                            />
                        </React.Fragment>
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
                    <tspan fill={isDark ? "#f8fafc" : "#0f172a"} fontWeight="700" letterSpacing="-2">{displayInt}</tspan>
                    <tspan fill={isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)"} fontWeight="500" fontSize="32">/100</tspan>
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
    const { isDark } = useSidebar();
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
        <div className={`w-full flex flex-col relative border overflow-hidden mb-6 transition-all duration-300 ${
            isDark ? 'border-white/5 bg-zinc-900 shadow-2xl' : 'border-gray-100 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02)]'
        }`}>
            {/* Top section: two cards */}
            <div className={`flex flex-col md:flex-row gap-0 w-full relative z-10 border-b transition-colors duration-300 ${
                isDark ? 'border-white/5' : 'border-gray-100'
            }`}>
                {/* Left: Score */}
                <div
                    className={`flex-1 relative h-[180px] overflow-hidden p-8 backdrop-blur-xl group/score border-r transition-all duration-300 md:border-r-0 ${
                        isDark 
                        ? 'bg-zinc-950/40 border-white/5' 
                        : 'bg-white border-gray-100'
                    }`}
                >
                    {/* Background Pattern */}
                    <div 
                        className="absolute inset-0 opacity-[0.03] transition-opacity duration-500" 
                        style={{ 
                            backgroundImage: `radial-gradient(${isDark ? 'white' : 'black'} 1px, transparent 0)`, 
                            backgroundSize: '16px 16px' 
                        }} 
                    />
                    <div 
                        className="absolute -top-32 -right-32 w-[450px] h-[450px] blur-[120px] rounded-full transition-all duration-1000"
                        style={{ 
                            backgroundColor: getCurrentSegmentColor(),
                            opacity: isDark ? 0.15 : 0.08
                        }} 
                    />

                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div>
                            <div className={`text-[10px] mb-1 font-semibold uppercase tracking-[0.2em] transition-colors duration-300 ${
                                isDark ? 'text-violet-400' : 'text-violet-600'
                            }`}>
                                Comercial Score
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className={`text-5xl font-semibold tracking-tight transition-colors duration-300 ${
                                    isDark ? 'text-slate-100' : 'text-zinc-900'
                                }`}>{displayInt}</span>
                                <span className={`text-5xl font-semibold transition-colors duration-300 ${
                                    isDark ? 'text-white/10' : 'text-zinc-200'
                                }`}>/100</span>
                            </div>
                        </div>

                        <div className="flex flex-col items-start gap-1">
                            <div className={`text-[10px] font-semibold uppercase tracking-0.15em opacity-40 transition-colors duration-300 ${
                                isDark ? 'text-white' : 'text-zinc-900'
                            }`}>
                                Status do Negócio
                            </div>
                            <div
                                className={`inline-block px-3 py-1 rounded-full text-[11px] font-bold transition-all duration-500 border ${
                                    isDark ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/5'
                                }`}
                                style={{
                                    color: statusData.color,
                                    boxShadow: `0 0 15px ${statusData.color}20`
                                }}
                            >
                                {statusData.label}
                            </div>
                        </div>
                    </div>

                    <div className="absolute bottom-[-60px] right-8 w-[320px] h-[160px] opacity-100">
                        <svg viewBox="0 0 320 160" className="w-full h-full" style={{ overflow: 'visible' }}>
                            {segments.map((seg, index) => (
                                <path
                                    key={`bg-${index}`}
                                    d={describeArc(cx, cy, radius, seg.start, seg.end)}
                                    stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}
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
                                    <React.Fragment key={`active-group-${index}`}>
                                        {/* Glow Layer */}
                                        <path
                                            d={describeArc(cx, cy, radius, seg.start, drawEnd)}
                                            stroke={seg.color}
                                            strokeWidth={strokeWidth}
                                            strokeLinecap="round"
                                            fill="none"
                                            style={{ filter: 'blur(12px)', opacity: 0.8 }}
                                        />
                                        {/* Main Path */}
                                        <path
                                            d={describeArc(cx, cy, radius, seg.start, drawEnd)}
                                            stroke={seg.color}
                                            strokeWidth={strokeWidth}
                                            strokeLinecap="round"
                                            fill="none"
                                        />
                                    </React.Fragment>
                                );
                            })}
                        </svg>
                    </div>
                </div>

                {/* Right: Hub title */}
                <div
                    className={`flex-1 h-[180px] flex flex-col justify-center p-10 md:p-12 relative overflow-hidden transition-colors duration-300 ${
                        isDark ? 'bg-zinc-900' : 'bg-white'
                    }`}
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[60px] rounded-full" />
                    <h2 className="text-[28px] font-bold leading-[1.2] tracking-tight mb-4 relative z-10 transition-colors duration-300" style={{ color: 'var(--color-text-primary)' }}>
                        Hub de Especialistas IA<br />
                        <span className="opacity-40">Diagnóstico Estratégico</span>
                    </h2>
                    <div className="w-12 h-1 rounded-full relative z-10" style={{ backgroundColor: 'var(--color-accent)' }} />
                </div>
            </div>

            {/* Bottom: action bar */}
            <div
                className={`w-full p-4 px-6 flex flex-col sm:flex-row items-center justify-between gap-4 relative z-50 transition-colors duration-300 ${
                    isDark ? 'bg-white/5' : 'bg-gray-50/50'
                }`}
            >
                <div className="flex items-center gap-2">
                    {children}
                </div>

                <div className="flex flex-wrap gap-2.5">
                    <button
                        onClick={onExport}
                        disabled={loadingExport}
                        className={`px-5 py-2.5 rounded-xl text-[12px] font-bold transition-all duration-200 whitespace-nowrap border shadow-sm hover:shadow-md hover:-translate-y-0.5 ${
                            isDark 
                            ? 'bg-zinc-800 border-white/5 hover:bg-zinc-700' 
                            : 'bg-white border-black/5 hover:bg-gray-50'
                        }`}
                        style={{ color: 'var(--color-text-secondary)' }}
                    >
                        {loadingExport ? 'Gerando...' : !hasSession ? 'Login c/ Google' : 'Exportar Plano'}
                    </button>
                    <button
                        onClick={onRedo}
                        className={`px-5 py-2.5 rounded-xl text-[12px] font-bold transition-all duration-200 whitespace-nowrap shadow-xl hover:-translate-y-0.5 ${
                            isDark
                            ? 'bg-white text-black hover:bg-white/90 shadow-white/5'
                            : 'bg-black text-white hover:shadow-black/20'
                        }`}
                    >
                        Refazer Tudo
                    </button>
                </div>
            </div>
        </div>
    );
}

