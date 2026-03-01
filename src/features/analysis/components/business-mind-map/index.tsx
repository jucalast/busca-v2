'use client';

import React, { useRef, useState } from 'react';
import { Brain, CheckCircle2, Circle, Target, Globe } from 'lucide-react';

import { BusinessMindMapProps } from './types';
import { PILLAR_ORDER, PILLAR_META, PILLAR_POSITIONS } from './constants';
import { truncate } from './utils';
import { useZoomPan } from './hooks/useZoomPan';

import { ZoomControls } from './components/ZoomControls';
import { CentralNode } from './components/CentralNode';
import { SvgMapLines } from './components/SvgMapLines';
import { PillarItem } from './components/PillarItem';

export default function BusinessMindMap({
    score, specialists, marketData, pillarStates, completedTasks, userProfile,
}: BusinessMindMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [expandedPillar, setExpandedPillar] = useState<string | null>(null);
    const [hoveredNode, setHoveredNode] = useState<string | null>(null);

    const dims = score?.dimensoes || {};
    const scoreGeral = score?.score_geral || 0;
    const mktCats = marketData?.categories || [];

    const {
        zoom, pan, dragging,
        handleMouseDown, handleMouseMove, handleMouseUp,
        zoomIn, zoomOut, resetView, focusNode
    } = useZoomPan({ containerRef });

    const togglePillar = (key: string) => {
        setExpandedPillar(prev => {
            if (prev === key) return null;
            focusNode(key);
            return key;
        });
    };

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

    return (
        <div
            ref={containerRef}
            className="h-full w-full bg-[#0a0a0c] relative select-none overflow-hidden"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ cursor: dragging ? 'grabbing' : 'grab' }}
        >
            <ZoomControls onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetView} />

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
                <SvgMapLines pillarNodes={pillarNodes} />

                <CentralNode scoreGeral={scoreGeral} userProfile={userProfile} />

                {pillarNodes.map(p => (
                    <PillarItem
                        key={p.key}
                        p={p}
                        togglePillar={togglePillar}
                        hoveredNode={hoveredNode}
                        setHoveredNode={setHoveredNode}
                    />
                ))}
            </div>

            <style jsx>{`
                @keyframes fadeSlideIn {
                    from { opacity: 0; transform: translateX(-8px); }
                    to { opacity: 1; transform: translateX(0); }
                }
            `}</style>
        </div>
    );
}
