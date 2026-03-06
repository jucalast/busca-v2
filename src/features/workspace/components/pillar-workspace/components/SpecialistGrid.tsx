'use client';

import React from 'react';
import {
    Loader2, ChevronRight, RefreshCw, Users, AlertCircle, RotateCcw
} from 'lucide-react';
import { ScoreRing } from './ScoreRing';
import { ScoreGauge } from './ScoreGauge';
import { PILLAR_META, PILLAR_ORDER } from '../constants';
import { safeRender, openInGoogleDocs, exportFullAnalysis } from '../utils';
import { StackedSources } from './StackedSources';

interface SpecialistGridProps {
    userProfile: { name: string; segment: string };
    scoreGeral: number;
    classificacao: string;
    resumo: string;
    dims: Record<string, any>;
    specialists: Record<string, any>;
    loadingPillar: string | null;
    pillarStates: Record<string, any>;
    completedTasks: Record<string, Set<string>>;
    marketData: any;
    session: any;
    profile: any;
    score: any;
    analysisId: string | null;
    businessId: string | null;
    loadingFullExport: boolean;
    setLoadingFullExport: (loading: boolean) => void;
    loadingDoc: string | null;
    setLoadingDoc: (docId: string | null) => void;
    onRedo: () => void;
    handleSelectPillar: (key: string) => void;
    error: string;
    setError: (error: string) => void;
}

export function SpecialistGrid({
    userProfile,
    scoreGeral,
    classificacao,
    resumo,
    dims,
    specialists,
    loadingPillar,
    pillarStates,
    completedTasks,
    marketData,
    session,
    profile,
    score,
    analysisId,
    businessId,
    loadingFullExport,
    setLoadingFullExport,
    loadingDoc,
    setLoadingDoc,
    onRedo,
    handleSelectPillar,
    error,
    setError
}: SpecialistGridProps) {
    const [transform, setTransform] = React.useState<{ x: number; y: number; scale: number }>({ x: 80, y: 150, scale: 0.85 });
    const [isMounted, setIsMounted] = React.useState(false);

    React.useEffect(() => {
        setIsMounted(true);
        const saved = sessionStorage.getItem('tgt_map_transform');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setTransform(parsed);
            } catch (e) { }
        }
    }, []);

    React.useEffect(() => {
        if (isMounted) {
            sessionStorage.setItem('tgt_map_transform', JSON.stringify(transform));
        }
    }, [transform, isMounted]);

    const [isDragging, setIsDragging] = React.useState(false);
    const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });
    const [hasMoved, setHasMoved] = React.useState(false);
    const boardRef = React.useRef<HTMLDivElement>(null);

    const handleWheel = (e: React.WheelEvent) => {
        // Zooming centered on mouse position
        e.preventDefault();
        const board = boardRef.current;
        if (!board) return;

        const rect = board.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const zoomSpeed = 0.0015;
        const delta = -e.deltaY * zoomSpeed;
        const newScale = Math.min(Math.max(transform.scale * (1 + delta), 0.1), 4);

        const scaleFactor = newScale / transform.scale;

        setTransform(prev => ({
            x: mouseX - (mouseX - prev.x) * scaleFactor,
            y: mouseY - (mouseY - prev.y) * scaleFactor,
            scale: newScale
        }));
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        // Panning with just Left Click or Middle Click
        if (e.button === 0 || e.button === 1) {
            setIsDragging(true);
            setHasMoved(false);
            setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
            // We don't preventDefault here to allow clicks on cards, 
            // unless we specifically want to block selection while dragging.
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            const newX = e.clientX - dragStart.x;
            const newY = e.clientY - dragStart.y;

            // If moved more than 3px, it's a drag
            if (Math.abs(newX - transform.x) > 3 || Math.abs(newY - transform.y) > 3) {
                setHasMoved(true);
            }

            setTransform(prev => ({
                ...prev,
                x: newX,
                y: newY
            }));
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const resetTransform = () => setTransform({ x: 0, y: 0, scale: 0.85 });

    const renderAgentCard = (key: string, index: number) => {
        const meta = PILLAR_META[key];
        const dim = dims[key] || {};
        const isLoading = loadingPillar === key;

        if (!meta) return null;

        const mktCats = marketData?.categories || [];
        const mktCat = mktCats.find((c: any) => c.id === key);
        const mktSources = mktCat?.fontes || [];
        const planSources = pillarStates[key]?.sources || [];
        const pillarSources = [...new Set([...mktSources, ...planSources])];

        const isExecuted = !!(pillarStates[key] || (completedTasks[key]?.size ?? 0) > 0);
        const hoverColor = isExecuted ? meta.color : '#4B5563';

        return (
            <div
                key={key}
                className="relative flex flex-col group cursor-pointer transition-all"
                style={{
                    animationDelay: `${index * 60}ms`,
                    animation: 'fade-in-up 0.4s ease-out backwards',
                }}
                onClick={() => !isLoading && !hasMoved && handleSelectPillar(key)}
            >
                {/* Minimalist Agent Card - Opaque with Subtitle */}
                <div
                    className="w-72 h-16 rounded-xl px-5 transition-all duration-200 overflow-hidden relative flex items-center justify-between pointer-events-auto"
                    style={{ backgroundColor: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}
                    onMouseEnter={e => {
                        e.currentTarget.style.borderColor = hoverColor;
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = `0 4px 20px -5px ${hoverColor}30`;
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.borderColor = 'var(--color-border)';
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                    }}
                >
                    <div className="flex flex-col gap-0.5 mt-0.5 truncate pr-4">
                        <h3 className="text-lg font-normal tracking-tight truncate leading-tight" style={{ color: 'var(--color-text-primary)' }}>
                            {meta.label}
                        </h3>
                        <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px] font-medium" style={{ color: 'var(--color-text-tertiary)' }}>
                                Diag: {typeof dim.score === 'number' ? Math.round(dim.score) : 0}
                            </span>
                            {isExecuted && pillarSources.length > 0 && <StackedSources sources={pillarSources} max={3} />}
                        </div>
                    </div>

                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-all duration-200">
                        {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" style={{ color: hoverColor }} />
                        ) : (
                            <ChevronRight className="w-4 h-4" style={{ color: hoverColor }} />
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-full relative z-20" style={{ backgroundColor: 'var(--color-bg)' }}>
            <div className="flex flex-col">
                {/* Score Gauge Header */}
                <ScoreGauge
                    score={scoreGeral}
                    classificacao={safeRender(classificacao) as string}
                    onExport={() => exportFullAnalysis(session, setLoadingFullExport, {
                        profile, score, specialists, marketData, taskPlan: pillarStates
                    }, userProfile.name)}
                    onRedo={onRedo}
                    loadingExport={loadingFullExport}
                    hasSession={!!session?.accessToken}
                >
                    {/* Map Controls */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={resetTransform}
                            className="p-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-hover)] transition-colors shadow-lg text-[var(--color-text-secondary)] flex items-center gap-2 px-3 h-8"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span className="text-[9px] font-bold uppercase tracking-wider">Resetar Vista</span>
                        </button>
                        <div className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] text-[8px] text-[var(--color-text-muted)] font-bold uppercase tracking-widest text-center h-8 flex items-center">
                            Apenas Arraste p/ Mover
                        </div>
                        <div className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] text-[8px] text-[var(--color-text-muted)] font-bold uppercase tracking-widest text-center h-8 flex items-center">
                            Scroll p/ Zoom
                        </div>
                    </div>
                </ScoreGauge>

                {error && (
                    <div
                        className="p-3 rounded-lg text-sm mx-2"
                        style={{
                            backgroundColor: 'var(--color-destructive-muted)',
                            color: 'var(--color-destructive)',
                            border: '1px solid rgba(239,68,68,0.15)',
                        }}
                    >
                        {error}
                        <button onClick={() => setError('')} className="ml-2 underline text-xs" style={{ color: 'var(--color-destructive)' }}>Fechar</button>
                    </div>
                )}

                {/* Agent Pipeline Architecture - Dark Board Section with Dots */}
                <div className="w-full -mt-[57px] relative z-0 overflow-hidden select-none">
                    <div
                        ref={boardRef}
                        className="w-full relative min-h-[85vh] outline-none cursor-grab active:cursor-grabbing"
                        style={{
                            backgroundColor: 'var(--color-bg)',
                            backgroundImage: `radial-gradient(var(--color-border) 1px, transparent 1px)`,
                            backgroundSize: '24px 24px',
                            backgroundPosition: `${transform.x}px ${transform.y}px`
                        }}
                        onWheel={handleWheel}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                    >
                        {/* Hierarchical Content with Transform */}
                        <div
                            className="absolute inset-0"
                            style={{
                                transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
                                transformOrigin: '0 0',
                                backfaceVisibility: 'hidden',
                                WebkitFontSmoothing: 'antialiased',
                                MozOsxFontSmoothing: 'grayscale',
                                transformStyle: 'preserve-3d'
                            }}
                        >
                            <div className="flex flex-row items-center justify-start gap-0 relative min-h-[600px] min-w-max px-32">
                                <style jsx>{`
                                    .custom-scrollbar::-webkit-scrollbar {
                                        height: 5px;
                                        width: 5px;
                                    }
                                    .custom-scrollbar::-webkit-scrollbar-track {
                                        background: transparent;
                                    }
                                    .custom-scrollbar::-webkit-scrollbar-thumb {
                                        background: var(--color-border);
                                        border-radius: 10px;
                                    }
                                    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                                        background: var(--color-text-tertiary);
                                    }
                                `}</style>

                                {/* SVG DEFS for Dynamic Colored Arrows */}
                                <svg className="absolute w-0 h-0">
                                    <defs>
                                        <marker
                                            id="arrowhead-inactive"
                                            markerWidth="16"
                                            markerHeight="16"
                                            refX="10"
                                            refY="8"
                                            orient="auto"
                                            markerUnits="userSpaceOnUse"
                                        >
                                            <path
                                                d="M 4 3 L 10 8 L 4 13"
                                                fill="none"
                                                stroke="#4B5563"
                                                strokeWidth="2.5"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        </marker>
                                        {Object.entries(PILLAR_META).map(([key, meta]) => (
                                            <marker
                                                key={`arrow-${key}`}
                                                id={`arrowhead-${key}`}
                                                markerWidth="16"
                                                markerHeight="16"
                                                refX="10"
                                                refY="8"
                                                orient="auto"
                                                markerUnits="userSpaceOnUse"
                                            >
                                                <path
                                                    d="M 4 3 L 10 8 L 4 13"
                                                    fill="none"
                                                    stroke={meta.color}
                                                    strokeWidth="2.5"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                            </marker>
                                        ))}
                                    </defs>
                                </svg>

                                {/* Phase 1: Público-Alvo */}
                                <div className="flex-none z-10 w-72 flex justify-center">
                                    {renderAgentCard('publico_alvo', 0)}
                                </div>

                                {/* Flow 1 -> 2 (Colors from publico_alvo) - Curved Branch */}
                                <div className="w-24 h-[192px] flex-none relative z-0">
                                    <svg className="w-full h-full" style={{ overflow: 'visible' }}>
                                        <path
                                            d="M 0 96 C 36 96, 36 32, 76 32 L 96 32"
                                            fill="none"
                                            stroke={((pillarStates['publico_alvo'] || (completedTasks['publico_alvo']?.size ?? 0) > 0) ? PILLAR_META['publico_alvo'].color : '#4B5563')}
                                            strokeWidth="2.5"
                                            strokeOpacity={((pillarStates['publico_alvo'] || (completedTasks['publico_alvo']?.size ?? 0) > 0) ? "0.6" : "0.3")}
                                            markerEnd={((pillarStates['publico_alvo'] || (completedTasks['publico_alvo']?.size ?? 0) > 0) ? "url(#arrowhead-publico_alvo)" : "url(#arrowhead-inactive)")}
                                        />
                                        <path
                                            d="M 0 96 C 36 96, 36 160, 76 160 L 96 160"
                                            fill="none"
                                            stroke={((pillarStates['publico_alvo'] || (completedTasks['publico_alvo']?.size ?? 0) > 0) ? PILLAR_META['publico_alvo'].color : '#4B5563')}
                                            strokeWidth="2.5"
                                            strokeOpacity={((pillarStates['publico_alvo'] || (completedTasks['publico_alvo']?.size ?? 0) > 0) ? "0.6" : "0.3")}
                                            markerEnd={((pillarStates['publico_alvo'] || (completedTasks['publico_alvo']?.size ?? 0) > 0) ? "url(#arrowhead-publico_alvo)" : "url(#arrowhead-inactive)")}
                                        />
                                    </svg>
                                </div>

                                {/* Phase 2: Branding & Identidade Visual */}
                                <div className="flex-none flex flex-col justify-center gap-[64px] z-10 w-72 h-[192px]">
                                    <div className="flex justify-center">{renderAgentCard('branding', 1)}</div>
                                    <div className="flex justify-center">{renderAgentCard('identidade_visual', 2)}</div>
                                </div>

                                {/* Flow 2 -> 3 (Converging curved paths) */}
                                <div className="w-24 h-[192px] flex-none relative z-0">
                                    <svg className="w-full h-full" style={{ overflow: 'visible' }}>
                                        <path
                                            d="M 0 32 C 36 32, 36 96, 76 96 L 96 96"
                                            fill="none"
                                            stroke={((pillarStates['branding'] || (completedTasks['branding']?.size ?? 0) > 0) ? PILLAR_META['branding'].color : '#4B5563')}
                                            strokeWidth="2.5"
                                            strokeOpacity={((pillarStates['branding'] || (completedTasks['branding']?.size ?? 0) > 0) ? "0.6" : "0.3")}
                                            markerEnd={((pillarStates['branding'] || (completedTasks['branding']?.size ?? 0) > 0) ? "url(#arrowhead-branding)" : "url(#arrowhead-inactive)")}
                                        />
                                        <path
                                            d="M 0 160 C 36 160, 36 96, 76 96 L 96 96"
                                            fill="none"
                                            stroke={((pillarStates['identidade_visual'] || (completedTasks['identidade_visual']?.size ?? 0) > 0) ? PILLAR_META['identidade_visual'].color : '#4B5563')}
                                            strokeWidth="2.5"
                                            strokeOpacity={((pillarStates['identidade_visual'] || (completedTasks['identidade_visual']?.size ?? 0) > 0) ? "0.6" : "0.3")}
                                            markerEnd={((pillarStates['identidade_visual'] || (completedTasks['identidade_visual']?.size ?? 0) > 0) ? "url(#arrowhead-identidade_visual)" : "url(#arrowhead-inactive)")}
                                        />
                                    </svg>
                                </div>

                                {/* Phase 3: Canais de Venda */}
                                <div className="flex-none z-10 w-72 flex justify-center">
                                    {renderAgentCard('canais_venda', 3)}
                                </div>

                                {/* Flow 3 -> 4 - Curved Branch */}
                                <div className="w-24 h-[192px] flex-none relative z-0">
                                    <svg className="w-full h-full" style={{ overflow: 'visible' }}>
                                        <path
                                            d="M 0 96 C 36 96, 36 32, 76 32 L 96 32"
                                            fill="none"
                                            stroke={((pillarStates['canais_venda'] || (completedTasks['canais_venda']?.size ?? 0) > 0) ? PILLAR_META['canais_venda'].color : '#4B5563')}
                                            strokeWidth="2.5"
                                            strokeOpacity={((pillarStates['canais_venda'] || (completedTasks['canais_venda']?.size ?? 0) > 0) ? "0.6" : "0.3")}
                                            markerEnd={((pillarStates['canais_venda'] || (completedTasks['canais_venda']?.size ?? 0) > 0) ? "url(#arrowhead-canais_venda)" : "url(#arrowhead-inactive)")}
                                        />
                                        <path
                                            d="M 0 96 C 36 96, 36 160, 76 160 L 96 160"
                                            fill="none"
                                            stroke={((pillarStates['canais_venda'] || (completedTasks['canais_venda']?.size ?? 0) > 0) ? PILLAR_META['canais_venda'].color : '#4B5563')}
                                            strokeWidth="2.5"
                                            strokeOpacity={((pillarStates['canais_venda'] || (completedTasks['canais_venda']?.size ?? 0) > 0) ? "0.6" : "0.3")}
                                            markerEnd={((pillarStates['canais_venda'] || (completedTasks['canais_venda']?.size ?? 0) > 0) ? "url(#arrowhead-canais_venda)" : "url(#arrowhead-inactive)")}
                                        />
                                    </svg>
                                </div>

                                {/* Phase 4: Tráfego Orgânico & Pago */}
                                <div className="flex-none flex flex-col justify-center gap-[64px] z-10 w-72 h-[192px]">
                                    <div className="flex justify-center">{renderAgentCard('trafego_organico', 4)}</div>
                                    <div className="flex justify-center">{renderAgentCard('trafego_pago', 5)}</div>
                                </div>

                                {/* Flow 4 -> 5 - Curved convergence */}
                                <div className="w-24 h-[192px] flex-none relative z-0">
                                    <svg className="w-full h-full" style={{ overflow: 'visible' }}>
                                        <path
                                            d="M 0 32 C 36 32, 36 96, 76 96 L 96 96"
                                            fill="none"
                                            stroke={((pillarStates['trafego_organico'] || (completedTasks['trafego_organico']?.size ?? 0) > 0) ? PILLAR_META['trafego_organico'].color : '#4B5563')}
                                            strokeWidth="2.5"
                                            strokeOpacity={((pillarStates['trafego_organico'] || (completedTasks['trafego_organico']?.size ?? 0) > 0) ? "0.6" : "0.3")}
                                            markerEnd={((pillarStates['trafego_organico'] || (completedTasks['trafego_organico']?.size ?? 0) > 0) ? "url(#arrowhead-trafego_organico)" : "url(#arrowhead-inactive)")}
                                        />
                                        <path
                                            d="M 0 160 C 36 160, 36 96, 76 96 L 96 96"
                                            fill="none"
                                            stroke={((pillarStates['trafego_pago'] || (completedTasks['trafego_pago']?.size ?? 0) > 0) ? PILLAR_META['trafego_pago'].color : '#4B5563')}
                                            strokeWidth="2.5"
                                            strokeOpacity={((pillarStates['trafego_pago'] || (completedTasks['trafego_pago']?.size ?? 0) > 0) ? "0.6" : "0.3")}
                                            markerEnd={((pillarStates['trafego_pago'] || (completedTasks['trafego_pago']?.size ?? 0) > 0) ? "url(#arrowhead-trafego_pago)" : "url(#arrowhead-inactive)")}
                                        />
                                    </svg>
                                </div>

                                {/* Phase 5: Processo de Vendas */}
                                <div className="flex-none z-10 w-72 flex justify-center">
                                    {renderAgentCard('processo_vendas', 6)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}