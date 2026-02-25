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

    // Accordion toggle & Zoom to node
    const togglePillar = useCallback((key: string) => {
        setExpandedPillar(prev => {
            const isClosing = prev === key;
            if (isClosing) return null;

            // It's opening: zoom and pan
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const viewCenterX = rect.width / 2;
                const viewCenterY = rect.height / 2;

                const idx = PILLAR_ORDER.indexOf(key);
                if (idx !== -1) {
                    const pos = PILLAR_POSITIONS[idx];
                    const targetZoom = 1.1; // zoom level when clicking a node

                    // Offset x so the expanded menu also fits well
                    const direction = pos.side === 'left' ? -1 : 1;
                    const visualCenterX = pos.x + direction * 100; // midpoint between node and subitems
                    const visualCenterY = pos.y;

                    setZoom(targetZoom);
                    setPan({
                        x: viewCenterX - visualCenterX * targetZoom,
                        y: viewCenterY - visualCenterY * targetZoom
                    });
                }
            }

            return key;
        });
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
        // Line calculation logic
        // Center node is at (0, 0) logically, size is ~140x140. Edge is ~70px out. 
        // We'll draw from center, but markerEnd places marker at the very tip of the line.
        const direction = p.pos.side === 'left' ? -1 : 1;

        // As you can see in the screenshot, the line on the left side is traversing ABOVE the icon. 
        // We really need to stop it far away from the icon so it doesn't cross it! 
        // For right side, pos.x is where the node starts (icon is on the left). 
        // For left side, pos.x is where the node ENDS (icon is on the right). 
        // The line from center goes from (0,0) to the node. 
        // Left node is at x < 0. Center is at x = 0.
        const targetX = p.pos.x - (direction * 60);
        const targetY = p.pos.y;

        // Center → pillar line
        svgLines.push(
            <path
                key={`line-${p.key}`}
                d={bezierPath(0, 0, targetX, targetY)}
                stroke={p.meta.color}
                strokeWidth={2}
                fill="none"
                markerEnd={`url(#arrow-${p.key})`}
            />
        );

        // Pillar → sub-items lines (if expanded)
        if (p.isExpanded && p.subItems.length > 0) {
            // Base X for sub items
            const subXBase = p.pos.x + direction * 230; // Further away to avoid overlaps 

            // Start line exactly near the `>` chevron indicator at the edge of the pillar box
            // Aumentando de 165 para 180 para iniciar "mais pra frente da setinha"
            const startSubX = p.pos.x + direction * 180;

            p.subItems.forEach((sub, si) => {
                const subY = p.pos.y - ((p.subItems.length - 1) * 28) / 2 + si * 28;

                // Pull back the end of the line so the circle connects exactly to the edge of the subItem content
                // Removemos o offset (- direction * 8) para que alinhe exatamente nas bolinhas/icones do item
                const targetSubX = subXBase;

                svgLines.push(
                    <path
                        key={`sub-${p.key}-${si}`}
                        d={bezierPath(startSubX, p.pos.y, targetSubX, subY)}
                        stroke={sub.color}
                        strokeWidth={1.2}
                        fill="none"
                        markerEnd={`url(#sub-arrow-${p.key}-${si})`}
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
                <button onClick={zoomIn} className="w-8 h-8 rounded-lg bg-zinc-800/60 hover:bg-zinc-700 flex items-center justify-center transition-colors">
                    <ZoomIn className="w-4 h-4 text-zinc-400" />
                </button>
                <button onClick={zoomOut} className="w-8 h-8 rounded-lg bg-zinc-800/60 hover:bg-zinc-700 flex items-center justify-center transition-colors">
                    <ZoomOut className="w-4 h-4 text-zinc-400" />
                </button>
                <button onClick={resetView} className="w-8 h-8 rounded-lg bg-zinc-800/60 hover:bg-zinc-700 flex items-center justify-center transition-colors">
                    <Maximize2 className="w-4 h-4 text-zinc-400" />
                </button>
            </div>

            {/* ─── Title ─── */}
            <div className="absolute top-4 left-4 z-30">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-800/40 backdrop-blur-sm">
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
                    transition: dragging ? 'none' : 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)',
                }}
            >
                {/* SVG layer */}
                <svg className="absolute inset-0 pointer-events-none" style={{ overflow: 'visible', width: '100%', height: '100%', zIndex: 0 }}>
                    <defs>
                        {pillarNodes.map(p => {
                            const direction = p.pos.side === 'left' ? -1 : 1;
                            return (
                                <React.Fragment key={`defs-${p.key}`}>
                                    <marker
                                        id={`arrow-${p.key}`}
                                        markerWidth="16"
                                        markerHeight="16"
                                        refX="8"
                                        refY="8"
                                        orient="auto"
                                    >
                                        <circle cx="8" cy="8" r="3.5" fill="#0a0a0c" stroke={p.meta.color} strokeWidth="1.5" />
                                    </marker>
                                    {p.isExpanded && p.subItems.map((sub, si) => (
                                        <marker
                                            key={`defs-sub-${p.key}-${si}`}
                                            id={`sub-arrow-${p.key}-${si}`}
                                            markerWidth="12"
                                            markerHeight="12"
                                            refX="6"
                                            refY="6"
                                            orient="auto"
                                        >
                                            <circle cx="6" cy="6" r="2.5" fill="#0a0a0c" stroke={sub.color} strokeWidth="1.2" />
                                        </marker>
                                    ))}
                                </React.Fragment>
                            );
                        })}
                    </defs>

                    {/* Move the origin to center to match the absolutely positioned HTML nodes */}
                    <g transform={`translate(0, 0)`}>
                        {/* Subtle orbit ring */}
                        <circle cx={0} cy={0} r={340} fill="none" stroke="rgba(255,255,255,0.025)" strokeWidth={1} strokeDasharray="6 12" />
                        {svgLines}
                    </g>
                </svg>

                {/* ─── Central Node ─── */}
                <div
                    className="mindmap-node absolute flex flex-col items-center justify-center z-10"
                    style={{ left: -70, top: -70, width: 140, height: 140 }}
                >
                    {/* Glow */}
                    <div className="absolute inset-0 rounded-full opacity-15 blur-2xl pointer-events-none" style={{ backgroundColor: scoreColor(scoreGeral) }} />

                    {/* Score ring */}
                    <div className="relative w-[110px] h-[110px] mt-1">
                        <svg viewBox="0 0 110 110" className="absolute inset-0 rounded-full" style={{ backgroundColor: '#0a0a0c' }}>
                            <circle cx="55" cy="55" r="49" fill="#0a0a0c" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
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
                    <div className="absolute top-[150px] flex flex-col items-center w-[200px]">
                        <p className="text-[12px] font-extrabold text-white truncate w-full text-center" style={{ lineHeight: '1.2' }}>{userProfile.name}</p>
                        <p className="text-[10px] text-zinc-400 truncate w-full text-center mt-1">{userProfile.segment}</p>
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
                                    className="w-11 h-11 flex items-center justify-center flex-shrink-0 transition-transform duration-300 relative z-10"
                                >
                                    <Icon style={{ color: p.meta.color, width: 28, height: 28 }} />
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
                                // Match the subXBase calculation
                                const subX = p.pos.x + direction * 230;
                                const startY = p.pos.y - ((p.subItems.length - 1) * 28) / 2;

                                return (
                                    <div
                                        className="absolute"
                                        style={{
                                            left: p.pos.side === 'left' ? subX - 260 : subX,
                                            top: startY - 8,
                                            pointerEvents: 'none'
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
                                                    {p.pos.side === 'left' && (
                                                        <span className="text-[10px] leading-tight whitespace-nowrap" style={{ color: sub.color }}>
                                                            {sub.label}
                                                        </span>
                                                    )}
                                                    {SubIcon ? (
                                                        <SubIcon className="w-3 h-3 flex-shrink-0" style={{ color: sub.color }} />
                                                    ) : (
                                                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: sub.color }} />
                                                    )}
                                                    {p.pos.side === 'right' && (
                                                        <span className="text-[10px] leading-tight whitespace-nowrap" style={{ color: sub.color }}>
                                                            {sub.label}
                                                        </span>
                                                    )}
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
