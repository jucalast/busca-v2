'use client';

import React from 'react';
import {
    Loader2, ChevronRight, RefreshCw, Users, AlertCircle, RotateCcw
} from 'lucide-react';
import { useSidebar } from '@/contexts/SidebarContext';
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
    generationResults?: Record<string, any>;
    isReanalyzing?: boolean;
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
    setError,
    generationResults = {},
    isReanalyzing = false,
}: SpecialistGridProps) {
    const { isDark } = useSidebar();
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
        const planSources = 
            pillarStates[key]?.sources || 
            pillarStates[key]?.plan?.plan_data?.sources ||
            pillarStates[key]?.plan?.plan_data?.context_sources ||
            pillarStates[key]?.plan_data?.sources ||
            pillarStates[key]?.plan_data?.context_sources ||
            specialists[key]?.plan?.plan_data?.sources || 
            specialists[key]?.plan?.plan_data?.context_sources || 
            specialists[key]?.plan?.plan_data?.fontes_consultadas || [];
        
        // Combine with live sources from mid-flight research
        const liveSources = Object.values(generationResults[key] || {}).flatMap((r: any) => r?.sources || []);
        
        const pillarSources = [...new Set([
            ...mktSources.map((s: any) => typeof s === 'string' ? s : (s.url || s.link)),
            ...planSources.map((s: any) => typeof s === 'string' ? s : (s.url || s.link)),
            ...liveSources.map((s: any) => typeof s === 'string' ? s : (s.url || s.link))
        ])].filter(Boolean);

        const isExecuted = !!(pillarStates[key] || specialists[key]?.plan || (completedTasks[key]?.size ?? 0) > 0);
        const hoverColor = (isExecuted || isLoading || isReanalyzing) ? meta.color : '#A1A1AA';

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
                    className={`w-72 h-[72px] rounded-2xl px-5 transition-all duration-300 overflow-hidden relative flex items-center justify-between pointer-events-auto border shadow-sm ${
                        isDark 
                        ? 'bg-zinc-900 border-white/10 hover:border-white/20' 
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                    onMouseEnter={e => {
                        e.currentTarget.style.borderColor = `${hoverColor}40`;
                        e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                        e.currentTarget.style.boxShadow = `0 12px 30px -10px ${hoverColor}20`;
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)';
                        e.currentTarget.style.transform = 'translateY(0) scale(1)';
                        e.currentTarget.style.boxShadow = isDark ? '0 4px 30px rgba(0,0,0,0.2)' : '0 4px 30px rgba(0,0,0,0.03)';
                    }}
                >
                    <div className="flex flex-col gap-1 truncate pr-4">
                        <h3 className="text-[15px] font-bold tracking-tight truncate leading-tight" style={{ color: 'var(--color-text-primary)' }}>
                            {meta.label}
                        </h3>
                        <div className="flex items-center gap-3">
                            <div className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded-md transition-colors duration-300 ${
                                isDark ? 'bg-white/5' : 'bg-black/5'
                            }`}>
                                <span className="text-[9px] font-bold uppercase tracking-wider opacity-60" style={{ color: 'var(--color-text-primary)' }}>
                                    Score
                                </span>
                                <span className="text-[10px] font-bold" style={{ color: hoverColor }}>
                                    {typeof dim.score === 'number' ? Math.round(dim.score) : 0}
                                </span>
                            </div>
                            {(isExecuted || isLoading || isReanalyzing) && pillarSources.length > 0 && <StackedSources sources={pillarSources} max={3} />}
                        </div>
                    </div>

                    <div className="flex items-center transition-all duration-300">
                        {isLoading ? (
                            <Loader2 size={16} className="animate-spin" style={{ color: hoverColor }} />
                        ) : (
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 ${
                                isDark ? 'bg-white/10' : 'bg-black/5'
                            }`}>
                                <ChevronRight size={14} style={{ color: 'var(--color-text-primary)' }} />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className={`min-h-full relative z-20 overflow-hidden transition-colors duration-300 ${isDark ? 'bg-[--color-bg]' : 'bg-white'}`}>
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
                                className={`h-9 px-4 rounded-xl border transition-all flex items-center gap-2 shadow-sm hover:shadow-md hover:-translate-y-0.5 ${
                                    isDark 
                                    ? 'bg-zinc-900 border-white/10 text-zinc-400 hover:text-white' 
                                    : 'bg-white border-black/5 text-zinc-600 hover:text-zinc-900'
                                }`}
                            >
                                <RotateCcw size={14} />
                                <span className="text-[11px] font-bold">Centralizar Vista</span>
                            </button>
                            <div className={`h-9 px-4 rounded-xl border text-[10px] font-bold uppercase tracking-widest flex items-center ${
                                isDark 
                                ? 'bg-white/5 border-white/5 text-white/40' 
                                : 'bg-black/5 border-black/5 text-zinc-500'
                            }`}>
                                Arraste p/ Mover
                            </div>
                        </div>
                    </ScoreGauge>
                </div>

                {error && (
                    <div className="px-6 py-2">
                        <div className={`p-4 rounded-2xl border backdrop-blur-sm flex items-center justify-between transition-colors duration-300 ${
                            isDark 
                            ? 'bg-red-500/10 border-red-500/20' 
                            : 'bg-red-50/50 border-red-100'
                        }`}>
                            <div className="flex items-center gap-3">
                                <AlertCircle size={16} className="text-red-500" />
                                <span className={`text-[13px] font-medium ${isDark ? 'text-red-400' : 'text-red-600'}`}>{error}</span>
                            </div>
                            <button onClick={() => setError('')} className="text-[11px] font-bold uppercase tracking-wider text-red-400">Fechar</button>
                        </div>
                    </div>
                )}

                {/* Agent Pipeline Architecture - board Section with Dots */}
                <div className="w-full -mt-[40px] relative z-0 overflow-hidden select-none">
                    <div
                        ref={boardRef}
                        className="w-full relative min-h-[90vh] outline-none cursor-grab active:cursor-grabbing transition-colors duration-300"
                        style={{
                            backgroundColor: isDark ? 'var(--color-bg)' : '#f8fafc',
                            backgroundImage: `radial-gradient(${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.15)'} 1.5px, transparent 0)`,
                            backgroundSize: '32px 32px',
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
                                                stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)'}
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
                                            stroke={((pillarStates['publico_alvo'] || (completedTasks['publico_alvo']?.size ?? 0) > 0) ? PILLAR_META['publico_alvo'].color : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)'))}
                                            strokeWidth="3"
                                            strokeOpacity={((pillarStates['publico_alvo'] || (completedTasks['publico_alvo']?.size ?? 0) > 0) ? "0.4" : "0.1")}
                                            markerEnd={((pillarStates['publico_alvo'] || (completedTasks['publico_alvo']?.size ?? 0) > 0) ? "url(#arrowhead-publico_alvo)" : "url(#arrowhead-inactive)")}
                                        />
                                        <path
                                            d="M 0 96 C 36 96, 40 160, 76 160 L 96 160"
                                            fill="none"
                                            stroke={((pillarStates['publico_alvo'] || (completedTasks['publico_alvo']?.size ?? 0) > 0) ? PILLAR_META['publico_alvo'].color : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)'))}
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
                                            stroke={((pillarStates['branding'] || (completedTasks['branding']?.size ?? 0) > 0) ? PILLAR_META['branding'].color : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)'))}
                                            strokeWidth="3"
                                            strokeOpacity={((pillarStates['branding'] || (completedTasks['branding']?.size ?? 0) > 0) ? "0.4" : "0.1")}
                                            markerEnd={((pillarStates['branding'] || (completedTasks['branding']?.size ?? 0) > 0) ? "url(#arrowhead-branding)" : "url(#arrowhead-inactive)")}
                                        />
                                        <path
                                            d="M 0 160 C 36 160, 40 96, 76 96 L 96 96"
                                            fill="none"
                                            stroke={((pillarStates['identidade_visual'] || (completedTasks['identidade_visual']?.size ?? 0) > 0) ? PILLAR_META['identidade_visual'].color : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)'))}
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
                                            stroke={((pillarStates['canais_venda'] || (completedTasks['canais_venda']?.size ?? 0) > 0) ? PILLAR_META['canais_venda'].color : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)'))}
                                            strokeWidth="3"
                                            strokeOpacity={((pillarStates['canais_venda'] || (completedTasks['canais_venda']?.size ?? 0) > 0) ? "0.4" : "0.1")}
                                            markerEnd={((pillarStates['canais_venda'] || (completedTasks['canais_venda']?.size ?? 0) > 0) ? "url(#arrowhead-canais_venda)" : "url(#arrowhead-inactive)")}
                                        />
                                        <path
                                            d="M 0 96 C 36 96, 40 160, 76 160 L 96 160"
                                            fill="none"
                                            stroke={((pillarStates['canais_venda'] || (completedTasks['canais_venda']?.size ?? 0) > 0) ? PILLAR_META['canais_venda'].color : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)'))}
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
                                            stroke={((pillarStates['trafego_organico'] || (completedTasks['trafego_organico']?.size ?? 0) > 0) ? PILLAR_META['trafego_organico'].color : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)'))}
                                            strokeWidth="3"
                                            strokeOpacity={((pillarStates['trafego_organico'] || (completedTasks['trafego_organico']?.size ?? 0) > 0) ? "0.4" : "0.1")}
                                            markerEnd={((pillarStates['trafego_organico'] || (completedTasks['trafego_organico']?.size ?? 0) > 0) ? "url(#arrowhead-trafego_organico)" : "url(#arrowhead-inactive)")}
                                        />
                                        <path
                                            d="M 0 160 C 36 160, 40 96, 76 96 L 96 96"
                                            fill="none"
                                            stroke={((pillarStates['trafego_pago'] || (completedTasks['trafego_pago']?.size ?? 0) > 0) ? PILLAR_META['trafego_pago'].color : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)'))}
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
