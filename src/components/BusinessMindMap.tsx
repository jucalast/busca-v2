'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    Users, Palette, Eye, ShoppingBag, TrendingUp, Megaphone, HandCoins,
    CheckCircle2, Circle, Target, Globe, ZoomIn, ZoomOut, Maximize2,
    Brain, ChevronRight
} from 'lucide-react';

// ─── Pillar metadata ───
const PILLAR_META: Record<string, { label: string; icon: any; color: string; ordem: number }> = {
    publico_alvo: { label: 'Público-Alvo', icon: Users, color: '#8b5cf6', ordem: 1 },
    branding: { label: 'Branding', icon: Palette, color: '#f59e0b', ordem: 2 },
    identidade_visual: { label: 'Identidade Visual', icon: Eye, color: '#ec4899', ordem: 3 },
    canais_venda: { label: 'Canais de Venda', icon: ShoppingBag, color: '#3b82f6', ordem: 4 },
    trafego_organico: { label: 'Tráfego Orgânico', icon: TrendingUp, color: '#10b981', ordem: 5 },
    trafego_pago: { label: 'Tráfego Pago', icon: Megaphone, color: '#f97316', ordem: 6 },
    processo_vendas: { label: 'Processo de Vendas', icon: HandCoins, color: '#6366f1', ordem: 7 },
};

const PILLAR_ORDER = ['publico_alvo', 'branding', 'identidade_visual', 'canais_venda', 'trafego_organico', 'trafego_pago', 'processo_vendas'];

interface BusinessMindMapProps {
    score: any;
    specialists: Record<string, any>;
    marketData: any;
    pillarStates: Record<string, any>;
    completedTasks: Record<string, Set<string>>;
    userProfile: { name: string; segment: string };
}

// ─── Layout positions for 7 pillars ───
// Distributed around center with generous spacing
// Left side: indices 0,1,2  |  Right side: 3,4,5,6
const PILLAR_POSITIONS: { x: number; y: number; side: 'left' | 'right' }[] = [
    { x: -320, y: -220, side: 'left' },   // publico_alvo
    { x: -340, y: -30, side: 'left' },   // branding
    { x: -320, y: 160, side: 'left' },   // identidade_visual
    { x: 320, y: -260, side: 'right' },  // canais_venda
    { x: 340, y: -70, side: 'right' },  // trafego_organico
    { x: 320, y: 120, side: 'right' },  // trafego_pago
    { x: 300, y: 300, side: 'right' },  // processo_vendas
];

// ─── Helpers ───
function truncate(str: string, max: number) {
    if (!str) return '';
    const s = typeof str === 'string' ? str : JSON.stringify(str);
    return s.length > max ? s.slice(0, max) + '…' : s;
}

function scoreColor(s: number) {
    if (s >= 70) return '#34d399';
    if (s >= 40) return '#fbbf24';
    return '#f87171';
}

function scoreBg(s: number) {
    if (s >= 70) return 'rgba(52,211,153,0.12)';
    if (s >= 40) return 'rgba(251,191,36,0.12)';
    return 'rgba(248,113,113,0.12)';
}

// Smooth bezier curve from parent to child
function bezierPath(x1: number, y1: number, x2: number, y2: number): string {
    const cpx = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${cpx} ${y1}, ${cpx} ${y2}, ${x2} ${y2}`;
}

// ═══════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════
export default function BusinessMindMap({
    score, specialists, marketData, pillarStates, completedTasks, userProfile,
}: BusinessMindMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [expandedPillar, setExpandedPillar] = useState<string | null>(null); // Accordion: only one at a time
    const [zoom, setZoom] = useState(0.75);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [hoveredNode, setHoveredNode] = useState<string | null>(null);

    const dims = score?.dimensoes || {};
    const scoreGeral = score?.score_geral || 0;
    const mktCats = marketData?.categories || [];

    // Center on mount
    useEffect(() => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setPan({ x: rect.width / 2, y: rect.height / 2 });
        }
    }, []);

    // Accordion toggle
    const togglePillar = useCallback((key: string) => {
        setExpandedPillar(prev => prev === key ? null : key);
    }, []);

    // ─── Pan handlers ───
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('.mindmap-node')) return;
        setDragging(true);
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }, [pan]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!dragging) return;
        setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }, [dragging, dragStart]);

    const handleMouseUp = useCallback(() => setDragging(false), []);

    // ─── Zoom ───
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        setZoom(prev => Math.min(2, Math.max(0.3, prev - e.deltaY * 0.001)));
    }, []);

    const zoomIn = useCallback(() => setZoom(prev => Math.min(2, prev + 0.15)), []);
    const zoomOut = useCallback(() => setZoom(prev => Math.max(0.3, prev - 0.15)), []);
    const resetView = useCallback(() => {
        setZoom(0.75);
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setPan({ x: rect.width / 2, y: rect.height / 2 });
        }
    }, []);

    // ─── Build pillar data ───
    const pillarNodes = PILLAR_ORDER.map((key, idx) => {
        const meta = PILLAR_META[key];
        const dim = dims[key] || {};
        const pos = PILLAR_POSITIONS[idx];
        const state = pillarStates[key];
        const plan = state?.plan?.plan_data;
        const tarefas = plan?.tarefas || [];
        const entregaveis = plan?.entregaveis || [];
        const done = completedTasks[key] || new Set();
        const mktCat = mktCats.find((c: any) => c.id === key);

        // Build sub-items list
        const subItems: { label: string; color: string; icon?: any }[] = [];

        if (dim.dado_chave) subItems.push({ label: truncate(dim.dado_chave, 50), color: '#34d399', icon: CheckCircle2 });
        if (dim.meta_pilar) subItems.push({ label: `Meta: ${truncate(dim.meta_pilar, 45)}`, color: '#fbbf24', icon: Target });

        const gaps = dim.acoes_imediatas || [];
        gaps.slice(0, 2).forEach((g: any) => {
            const txt = typeof g === 'string' ? g : g.acao || g.titulo || JSON.stringify(g);
            subItems.push({ label: truncate(txt, 45), color: '#fb923c' });
        });

        if (tarefas.length > 0) {
            subItems.push({ label: `${done.size}/${tarefas.length} tarefas concluídas`, color: meta.color });
        }

        entregaveis.slice(0, 2).forEach((e: any) => {
            const taskDone = e.tarefa_origem && done.has(e.tarefa_origem);
            subItems.push({
                label: truncate(e.titulo, 45),
                color: taskDone ? '#34d399' : '#71717a',
                icon: taskDone ? CheckCircle2 : Circle,
            });
        });

        if (mktCat?.fontes?.length > 0) {
            subItems.push({ label: `${mktCat.fontes.length} fontes de pesquisa`, color: '#60a5fa', icon: Globe });
        }

        return { key, meta, dim, pos, subItems, tarefas, done, isExpanded: expandedPillar === key };
    });

    // ─── Render ───
    // Build all SVG lines
    const svgLines: React.ReactNode[] = [];

    pillarNodes.forEach(p => {
        // Center → pillar line
        svgLines.push(
            <path
                key={`line-${p.key}`}
                d={bezierPath(0, 0, p.pos.x, p.pos.y)}
                stroke={p.meta.color}
                strokeWidth={2}
                strokeOpacity={0.3}
                fill="none"
            />
        );

        // Pillar → sub-items lines (if expanded)
        if (p.isExpanded && p.subItems.length > 0) {
            const direction = p.pos.side === 'left' ? -1 : 1;
            const subX = p.pos.x + direction * 200;

            p.subItems.forEach((sub, si) => {
                const subY = p.pos.y - ((p.subItems.length - 1) * 28) / 2 + si * 28;
                svgLines.push(
                    <path
                        key={`sub-${p.key}-${si}`}
                        d={bezierPath(p.pos.x, p.pos.y, subX, subY)}
                        stroke={sub.color}
                        strokeWidth={1.2}
                        strokeOpacity={0.25}
                        fill="none"
                    />
                );
            });
        }
    });

    return (
        <div
            ref={containerRef}
            className="h-full w-full bg-[#0a0a0c] relative select-none overflow-hidden"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            style={{ cursor: dragging ? 'grabbing' : 'grab' }}
        >
            {/* ─── Zoom controls ─── */}
            <div className="absolute top-4 right-4 z-30 flex flex-col gap-1.5">
                <button onClick={zoomIn} className="w-8 h-8 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] flex items-center justify-center transition-colors">
                    <ZoomIn className="w-4 h-4 text-zinc-400" />
                </button>
                <button onClick={zoomOut} className="w-8 h-8 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] flex items-center justify-center transition-colors">
                    <ZoomOut className="w-4 h-4 text-zinc-400" />
                </button>
                <button onClick={resetView} className="w-8 h-8 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] flex items-center justify-center transition-colors">
                    <Maximize2 className="w-4 h-4 text-zinc-400" />
                </button>
            </div>

            {/* ─── Title ─── */}
            <div className="absolute top-4 left-4 z-30">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-sm">
                    <Brain className="w-4 h-4 text-violet-400" />
                    <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Mapa do Negócio</span>
                </div>
            </div>

            {/* ─── Zoom level ─── */}
            <div className="absolute bottom-4 left-4 z-30">
                <span className="text-[10px] text-zinc-600 font-mono px-2 py-1 rounded bg-white/[0.03]">
                    {Math.round(zoom * 100)}%
                </span>
            </div>

            {/* ─── Canvas ─── */}
            <div
                className="absolute inset-0"
                style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: '0 0',
                    transition: dragging ? 'none' : 'transform 0.15s ease-out',
                }}
            >
                {/* SVG layer */}
                <svg className="absolute" style={{ overflow: 'visible', left: 0, top: 0, width: 0, height: 0 }}>
                    {/* Subtle orbit ring */}
                    <circle cx={0} cy={0} r={340} fill="none" stroke="rgba(255,255,255,0.025)" strokeWidth={1} strokeDasharray="6 12" />
                    {svgLines}
                </svg>

                {/* ─── Central Node ─── */}
                <div
                    className="mindmap-node absolute flex flex-col items-center"
                    style={{ left: -70, top: -70, width: 140, height: 140 }}
                >
                    {/* Glow */}
                    <div className="absolute inset-0 rounded-full opacity-15 blur-2xl" style={{ backgroundColor: scoreColor(scoreGeral) }} />

                    {/* Score ring */}
                    <div className="relative w-[110px] h-[110px] mt-1">
                        <svg viewBox="0 0 110 110" className="absolute inset-0">
                            <circle cx="55" cy="55" r="49" fill="rgba(0,0,0,0.4)" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
                            <circle
                                cx="55" cy="55" r="49"
                                fill="none"
                                stroke={scoreColor(scoreGeral)}
                                strokeWidth="5"
                                strokeLinecap="round"
                                strokeDasharray={`${(scoreGeral / 100) * 307.9} 307.9`}
                                transform="rotate(-90 55 55)"
                                className="transition-all duration-1000"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-bold" style={{ color: scoreColor(scoreGeral) }}>
                                {scoreGeral}
                            </span>
                            <span className="text-[7px] text-zinc-500 uppercase tracking-widest">Score</span>
                        </div>
                    </div>

                    {/* Business info */}
                    <div className="text-center mt-1">
                        <p className="text-[11px] font-bold text-white truncate max-w-[140px]">{userProfile.name}</p>
                        <p className="text-[9px] text-zinc-500 truncate max-w-[130px]">{userProfile.segment}</p>
                    </div>
                </div>

                {/* ─── Pillar Nodes ─── */}
                {pillarNodes.map(p => {
                    const Icon = p.meta.icon;
                    const pillarScore = p.dim.score ?? 0;
                    const isHovered = hoveredNode === p.key;
                    const direction = p.pos.side === 'left' ? -1 : 1;

                    return (
                        <React.Fragment key={p.key}>
                            {/* Pillar node */}
                            <button
                                className="mindmap-node absolute flex items-center gap-2.5 group"
                                style={{
                                    left: p.pos.x - (p.pos.side === 'left' ? 170 : 10),
                                    top: p.pos.y - 22,
                                    transition: 'transform 0.2s ease',
                                    transform: isHovered ? 'scale(1.06)' : 'scale(1)',
                                }}
                                onClick={() => togglePillar(p.key)}
                                onMouseEnter={() => setHoveredNode(p.key)}
                                onMouseLeave={() => setHoveredNode(null)}
                            >
                                {/* For left-side pillars: label first, then icon */}
                                {p.pos.side === 'left' && (
                                    <div className="text-right min-w-0 flex-1">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <ChevronRight
                                                className="w-3 h-3 text-zinc-600 transition-transform duration-300"
                                                style={{ transform: p.isExpanded ? 'rotate(180deg)' : 'rotate(180deg) scaleX(-1)' }}
                                            />
                                            {pillarScore > 0 && (
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                                                    style={{ color: scoreColor(pillarScore), backgroundColor: scoreBg(pillarScore) }}>
                                                    {pillarScore}
                                                </span>
                                            )}
                                            <span className="text-[12px] font-semibold text-zinc-200 whitespace-nowrap">{p.meta.label}</span>
                                        </div>
                                        {p.tarefas.length > 0 && (
                                            <div className="flex items-center justify-end gap-1.5 mt-0.5">
                                                <span className="text-[9px] text-zinc-600">{p.done.size}/{p.tarefas.length}</span>
                                                <div className="h-1 w-14 bg-zinc-800 rounded-full overflow-hidden">
                                                    <div className="h-full rounded-full transition-all duration-700"
                                                        style={{ width: `${(p.done.size / p.tarefas.length) * 100}%`, backgroundColor: p.meta.color }} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Icon box */}
                                <div
                                    className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-shadow duration-300"
                                    style={{
                                        backgroundColor: `${p.meta.color}20`,
                                        border: `1.5px solid ${p.meta.color}50`,
                                        boxShadow: isHovered ? `0 0 24px ${p.meta.color}30` : 'none',
                                    }}
                                >
                                    <Icon style={{ color: p.meta.color, width: 20, height: 20 }} />
                                </div>

                                {/* For right-side pillars: icon first, then label */}
                                {p.pos.side === 'right' && (
                                    <div className="text-left min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[12px] font-semibold text-zinc-200 whitespace-nowrap">{p.meta.label}</span>
                                            {pillarScore > 0 && (
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                                                    style={{ color: scoreColor(pillarScore), backgroundColor: scoreBg(pillarScore) }}>
                                                    {pillarScore}
                                                </span>
                                            )}
                                            <ChevronRight
                                                className="w-3 h-3 text-zinc-600 transition-transform duration-300"
                                                style={{ transform: p.isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                                            />
                                        </div>
                                        {p.tarefas.length > 0 && (
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <div className="h-1 w-14 bg-zinc-800 rounded-full overflow-hidden">
                                                    <div className="h-full rounded-full transition-all duration-700"
                                                        style={{ width: `${(p.done.size / p.tarefas.length) * 100}%`, backgroundColor: p.meta.color }} />
                                                </div>
                                                <span className="text-[9px] text-zinc-600">{p.done.size}/{p.tarefas.length}</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </button>

                            {/* ─── Sub-items (vertical list extending outward) ─── */}
                            {p.isExpanded && p.subItems.length > 0 && (() => {
                                const subX = p.pos.x + direction * 200;
                                const startY = p.pos.y - ((p.subItems.length - 1) * 28) / 2;

                                return (
                                    <div
                                        className="absolute"
                                        style={{
                                            left: p.pos.side === 'left' ? subX - 260 : subX,
                                            top: startY - 8,
                                        }}
                                    >
                                        {p.subItems.map((sub, si) => {
                                            const SubIcon = sub.icon;
                                            return (
                                                <div
                                                    key={`${p.key}-s-${si}`}
                                                    className="mindmap-node flex items-center gap-1.5 py-1 opacity-0 animate-[fadeSlideIn_0.3s_ease_forwards]"
                                                    style={{
                                                        animationDelay: `${si * 40}ms`,
                                                        justifyContent: p.pos.side === 'left' ? 'flex-end' : 'flex-start',
                                                    }}
                                                >
                                                    {SubIcon ? (
                                                        <SubIcon className="w-3 h-3 flex-shrink-0" style={{ color: sub.color }} />
                                                    ) : (
                                                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: sub.color }} />
                                                    )}
                                                    <span className="text-[10px] leading-tight whitespace-nowrap" style={{ color: sub.color }}>
                                                        {sub.label}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </React.Fragment>
                    );
                })}
            </div>

            {/* Animation keyframes */}
            <style jsx>{`
                @keyframes fadeSlideIn {
                    from { opacity: 0; transform: translateX(-8px); }
                    to { opacity: 1; transform: translateX(0); }
                }
            `}</style>
        </div>
    );
}
