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
        const hoverColor = isExecuted ? meta.color : '#A1A1AA';

        return (
            <div
                key={key}
                className="relative flex flex-col group cursor-pointer transition-all"
                style={{
                    animationDelay: `${index * 50}ms`,
                    animation: 'fade-in-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) backwards',
                }}
                onClick={() => !isLoading && !hasMoved && handleSelectPillar(key)}
            >
                {/* macOS Style Glass Chip Card */}
                <div
                    className="w-72 h-[72px] rounded-2xl px-5 transition-all duration-300 overflow-hidden relative flex items-center justify-between pointer-events-auto bg-white border border-gray-200 shadow-[0_4px_30px_rgba(0,0,0,0.03)]"
                    onMouseEnter={e => {
                        e.currentTarget.style.borderColor = `${hoverColor}40`;
                        e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                        e.currentTarget.style.boxShadow = `0 12px 30px -10px ${hoverColor}20`;
                        e.currentTarget.style.backgroundColor = 'white';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.5)';
                        e.currentTarget.style.transform = 'translateY(0) scale(1)';
                        e.currentTarget.style.boxShadow = '0 4px 30px rgba(0,0,0,0.03)';
                        e.currentTarget.style.backgroundColor = 'white';
                    }}
                >
                    <div className="flex flex-col gap-1 truncate pr-4">
                        <h3 className="text-[15px] font-bold tracking-tight truncate leading-tight" style={{ color: 'var(--color-text-primary)' }}>
                            {meta.label}
                        </h3>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-md bg-black/5">
                                <span className="text-[9px] font-bold uppercase tracking-wider opacity-60" style={{ color: 'var(--color-text-primary)' }}>
                                    Score
                                </span>
                                <span className="text-[10px] font-bold" style={{ color: hoverColor }}>
                                    {typeof dim.score === 'number' ? Math.round(dim.score) : 0}
                                </span>
                            </div>
                            {isExecuted && pillarSources.length > 0 && <StackedSources sources={pillarSources} max={3} />}
                        </div>
                    </div>

                    <div className="flex items-center transition-all duration-300">
                        {isLoading ? (
                            <Loader2 size={16} className="animate-spin" style={{ color: hoverColor }} />
                        ) : (
                            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <ChevronRight size={14} style={{ color: 'var(--color-text-primary)' }} />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-full relative z-20 overflow-hidden bg-white rounded-3xl mb-8 mr-4">
            <div className="flex flex-col">
                {/* Score Gauge Header */}
                <div className="relative z-[100]">
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
                                className="h-9 px-4 rounded-xl border border-black/5 bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center gap-2"
                            >
                                <RotateCcw size={14} className="text-zinc-500" />
                                <span className="text-[11px] font-bold text-zinc-600">Centralizar Vista</span>
                            </button>
                            <div className="h-9 px-4 rounded-xl border border-black/5 bg-black/5 text-[10px] text-zinc-500 font-bold uppercase tracking-widest flex items-center">
                                Arraste p/ Mover
                            </div>
                        </div>
                    </ScoreGauge>
                </div>

                {error && (
                    <div className="px-6 py-2">
                        <div className="p-4 rounded-2xl bg-red-50/50 border border-red-100 backdrop-blur-sm flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <AlertCircle size={16} className="text-red-500" />
                                <span className="text-[13px] font-medium text-red-600">{error}</span>
                            </div>
                            <button onClick={() => setError('')} className="text-[11px] font-bold uppercase tracking-wider text-red-400">Fechar</button>
                        </div>
                    </div>
                )}

                {/* Agent Pipeline Architecture - board Section with Dots */}
                <div className="w-full -mt-[40px] relative z-0 overflow-hidden select-none rounded-3xl">
                    <div
                        ref={boardRef}
                        className="w-full relative min-h-[90vh] outline-none cursor-grab active:cursor-grabbing"
                        style={{
                            backgroundColor: 'rgba(243, 244, 246, 0.5)',
                            backgroundImage: `radial-gradient(rgba(0,0,0,0.15) 1.5px, transparent 1.5px)`,
                            backgroundSize: '40px 40px',
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
                                transformStyle: 'preserve-3d'
                            }}
                        >
                            <div className="flex flex-row items-center justify-start gap-0 relative min-h-[600px] min-w-max px-32">
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
                                                stroke="rgba(0,0,0,0.1)"
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
                                            d="M 0 96 C 36 96, 40 32, 76 32 L 96 32"
                                            fill="none"
                                            stroke={((pillarStates['publico_alvo'] || (completedTasks['publico_alvo']?.size ?? 0) > 0) ? PILLAR_META['publico_alvo'].color : 'rgba(0,0,0,0.1)')}
                                            strokeWidth="3"
                                            strokeOpacity={((pillarStates['publico_alvo'] || (completedTasks['publico_alvo']?.size ?? 0) > 0) ? "0.4" : "0.1")}
                                            markerEnd={((pillarStates['publico_alvo'] || (completedTasks['publico_alvo']?.size ?? 0) > 0) ? "url(#arrowhead-publico_alvo)" : "url(#arrowhead-inactive)")}
                                        />
                                        <path
                                            d="M 0 96 C 36 96, 40 160, 76 160 L 96 160"
                                            fill="none"
                                            stroke={((pillarStates['publico_alvo'] || (completedTasks['publico_alvo']?.size ?? 0) > 0) ? PILLAR_META['publico_alvo'].color : 'rgba(0,0,0,0.1)')}
                                            strokeWidth="3"
                                            strokeOpacity={((pillarStates['publico_alvo'] || (completedTasks['publico_alvo']?.size ?? 0) > 0) ? "0.4" : "0.1")}
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
                                            d="M 0 32 C 36 32, 40 96, 76 96 L 96 96"
                                            fill="none"
                                            stroke={((pillarStates['branding'] || (completedTasks['branding']?.size ?? 0) > 0) ? PILLAR_META['branding'].color : 'rgba(0,0,0,0.1)')}
                                            strokeWidth="3"
                                            strokeOpacity={((pillarStates['branding'] || (completedTasks['branding']?.size ?? 0) > 0) ? "0.4" : "0.1")}
                                            markerEnd={((pillarStates['branding'] || (completedTasks['branding']?.size ?? 0) > 0) ? "url(#arrowhead-branding)" : "url(#arrowhead-inactive)")}
                                        />
                                        <path
                                            d="M 0 160 C 36 160, 40 96, 76 96 L 96 96"
                                            fill="none"
                                            stroke={((pillarStates['identidade_visual'] || (completedTasks['identidade_visual']?.size ?? 0) > 0) ? PILLAR_META['identidade_visual'].color : 'rgba(0,0,0,0.1)')}
                                            strokeWidth="3"
                                            strokeOpacity={((pillarStates['identidade_visual'] || (completedTasks['identidade_visual']?.size ?? 0) > 0) ? "0.4" : "0.1")}
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
                                            d="M 0 96 C 36 96, 40 32, 76 32 L 96 32"
                                            fill="none"
                                            stroke={((pillarStates['canais_venda'] || (completedTasks['canais_venda']?.size ?? 0) > 0) ? PILLAR_META['canais_venda'].color : 'rgba(0,0,0,0.1)')}
                                            strokeWidth="3"
                                            strokeOpacity={((pillarStates['canais_venda'] || (completedTasks['canais_venda']?.size ?? 0) > 0) ? "0.4" : "0.1")}
                                            markerEnd={((pillarStates['canais_venda'] || (completedTasks['canais_venda']?.size ?? 0) > 0) ? "url(#arrowhead-canais_venda)" : "url(#arrowhead-inactive)")}
                                        />
                                        <path
                                            d="M 0 96 C 36 96, 40 160, 76 160 L 96 160"
                                            fill="none"
                                            stroke={((pillarStates['canais_venda'] || (completedTasks['canais_venda']?.size ?? 0) > 0) ? PILLAR_META['canais_venda'].color : 'rgba(0,0,0,0.1)')}
                                            strokeWidth="3"
                                            strokeOpacity={((pillarStates['canais_venda'] || (completedTasks['canais_venda']?.size ?? 0) > 0) ? "0.4" : "0.1")}
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
                                            d="M 0 32 C 36 32, 40 96, 76 96 L 96 96"
                                            fill="none"
                                            stroke={((pillarStates['trafego_organico'] || (completedTasks['trafego_organico']?.size ?? 0) > 0) ? PILLAR_META['trafego_organico'].color : 'rgba(0,0,0,0.1)')}
                                            strokeWidth="3"
                                            strokeOpacity={((pillarStates['trafego_organico'] || (completedTasks['trafego_organico']?.size ?? 0) > 0) ? "0.4" : "0.1")}
                                            markerEnd={((pillarStates['trafego_organico'] || (completedTasks['trafego_organico']?.size ?? 0) > 0) ? "url(#arrowhead-trafego_organico)" : "url(#arrowhead-inactive)")}
                                        />
                                        <path
                                            d="M 0 160 C 36 160, 40 96, 76 96 L 96 96"
                                            fill="none"
                                            stroke={((pillarStates['trafego_pago'] || (completedTasks['trafego_pago']?.size ?? 0) > 0) ? PILLAR_META['trafego_pago'].color : 'rgba(0,0,0,0.1)')}
                                            strokeWidth="3"
                                            strokeOpacity={((pillarStates['trafego_pago'] || (completedTasks['trafego_pago']?.size ?? 0) > 0) ? "0.4" : "0.1")}
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
