'use client';

import React from 'react';
import {
    ArrowLeft, RefreshCw, Target, Check
} from 'lucide-react';
import { PILLAR_META } from '../constants';
import { safeRender, openInGoogleDocs, getToolInfo } from '../utils';
import { SourceBadgeList } from './SourceBadgeList';

interface PillarHeaderProps {
    selectedPillar: string;
    plan: any;
    specialists: Record<string, any>;
    dims: Record<string, any>;
    allSources: string[];
    entregaveis: any[];
    entregaveisOrder: number[];
    done: Set<string>;
    taskDeliverables: Record<string, any>;
    session: any;
    businessId: string | null;
    setLoadingDoc: (id: string | null) => void;
    setError: (err: string) => void;
    handleRedoPillar: (key: string) => void;
    handleReorderEntregaveis: (clickedIndex: number) => void;
    onBack: () => void;
}

export function PillarHeader({
    selectedPillar,
    plan,
    specialists,
    allSources,
    entregaveis,
    entregaveisOrder,
    done,
    taskDeliverables,
    session,
    setLoadingDoc,
    setError,
    handleRedoPillar,
    handleReorderEntregaveis,
    onBack,
}: PillarHeaderProps) {
    const meta = PILLAR_META[selectedPillar];
    const Icon = meta?.icon;

    return (
        <div className="flex-1 min-w-0 border-r border-zinc-800 flex flex-col pt-0 relative z-0 overflow-hidden">
            <div className="p-6 pb-4">
                <div className="flex justify-end mb-6 relative z-20">
                    <button onClick={onBack}
                        className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 transition-colors text-sm">
                        <ArrowLeft className="w-4 h-4" /> Voltar para os Especialistas
                    </button>
                </div>

                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-6">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: `${meta.color}12` }}>
                            <Icon className="w-4 h-4" style={{ color: meta.color, width: 22, height: 22 }} />
                        </div>
                        <div className="flex-1">
                            <h1 className="text-xl font-bold text-white">{plan.titulo_plano || meta.label}</h1>
                            <p className="text-zinc-500 text-xs mt-0.5">
                                {specialists[selectedPillar]?.cargo || meta.label}
                            </p>
                            <p className="text-zinc-400 text-sm mt-1">{safeRender(plan.objetivo)}</p>
                        </div>
                    </div>

                    <div>
                        <button
                            onClick={() => handleRedoPillar(selectedPillar)}
                            title="Apagar e Refazer Todo o Pilar"
                            className="p-2 border border-red-500/20 text-red-400/70 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/50 rounded-lg transition-all"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Sources Section */}
            {allSources.length > 0 && (
                <div className="flex-1 px-6 pb-6">
                    <div className="p-4 rounded-xl">
                        <div className="flex items-center gap-2 mb-3">
                            <img src="/google.png" alt="Fontes" className="w-4 h-4" />
                            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Fontes Pesquisadas</span>
                            <span className="text-[9px] text-zinc-600 ml-auto">{allSources.length} fontes</span>
                        </div>
                        <SourceBadgeList sources={allSources} maxVisible={4} />
                    </div>

                    {/* Entregáveis Fan Cards */}
                    {entregaveis.length > 0 && (
                        <EntregaveisFanCards
                            selectedPillar={selectedPillar}
                            entregaveis={entregaveis}
                            entregaveisOrder={entregaveisOrder}
                            done={done}
                            taskDeliverables={taskDeliverables}
                            session={session}
                            meta={meta}
                            setLoadingDoc={setLoadingDoc}
                            setError={setError}
                            handleReorderEntregaveis={handleReorderEntregaveis}
                        />
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Entregáveis Fan Cards (internal sub-component) ───

interface EntregaveisFanCardsProps {
    selectedPillar: string;
    entregaveis: any[];
    entregaveisOrder: number[];
    done: Set<string>;
    taskDeliverables: Record<string, any>;
    session: any;
    meta: { label: string; icon: any; color: string; ordem: number };
    setLoadingDoc: (id: string | null) => void;
    setError: (err: string) => void;
    handleReorderEntregaveis: (clickedIndex: number) => void;
}

function EntregaveisFanCards({
    selectedPillar,
    entregaveis,
    entregaveisOrder,
    done,
    taskDeliverables,
    session,
    meta,
    setLoadingDoc,
    setError,
    handleReorderEntregaveis,
}: EntregaveisFanCardsProps) {
    return (
        <div className="mt-4">
            <div className="flex items-center gap-2 mb-3 px-4">
                <Target className="w-4 h-4" style={{ color: meta.color }} />
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Entregáveis</span>
                <span className="text-[9px] text-zinc-600 ml-auto">
                    {entregaveis.filter((e: any) =>
                        e.status === 'concluido' ||
                        (e.tarefa_origem && (done.has(e.tarefa_origem) || done.has(`${selectedPillar}_${e.tarefa_origem}`)))
                    ).length}/{entregaveis.length}
                </span>
            </div>

            <div className="relative h-64 flex items-center justify-center">
                <div className="pointer-events-none absolute inset-y-0 -left-12 w-12 bg-[#09090b]" />
                <div className="pointer-events-none absolute inset-y-0 -right-12 w-12 bg-[#09090b]" />
                {entregaveisOrder.map((originalIndex, displayIndex) => {
                    const entregavel = entregaveis[originalIndex];
                    if (!entregavel) return null;

                    const isCompleted = entregavel.status === 'concluido' ||
                        (entregavel.tarefa_origem && (done.has(entregavel.tarefa_origem) || done.has(`${selectedPillar}_${entregavel.tarefa_origem}`)));

                    const totalCards = entregaveisOrder.length;
                    const middleIndex = Math.floor(totalCards / 2);

                    const taskOriginId = entregavel.tarefa_origem ? `${selectedPillar}_${entregavel.tarefa_origem}` : null;
                    const executedDeliverable = taskOriginId ? taskDeliverables[taskOriginId] : null;
                    const toolInfo = getToolInfo({
                        entregavel_titulo: entregavel.titulo,
                        conteudo: entregavel.descricao,
                        entregavel_tipo: entregavel.tipo || '',
                        artifact_type: executedDeliverable?.artifact_type || '',
                    });

                    let angle = 0;
                    let translateX = 0;
                    if (displayIndex < middleIndex) {
                        angle = -(middleIndex - displayIndex) * 15;
                        translateX = -(middleIndex - displayIndex) * 120;
                    } else if (displayIndex > middleIndex) {
                        angle = (displayIndex - middleIndex) * 15;
                        translateX = (displayIndex - middleIndex) * 120;
                    }

                    const isMiddleCard = displayIndex === middleIndex;
                    const zStackBase = 6;
                    const depthOffset = Math.abs(displayIndex - middleIndex);
                    const zIndex = Math.max(1, zStackBase - depthOffset);

                    const cardBgClass = isMiddleCard
                        ? 'bg-zinc-800 shadow-2xl shadow-black/80'
                        : 'bg-zinc-900 hover:bg-[#202024] shadow-xl shadow-black/50';

                    const titleClass = isCompleted
                        ? 'text-zinc-500 line-through'
                        : (isMiddleCard ? 'text-white' : 'text-zinc-400');

                    return (
                        <div
                            key={entregavel.id || originalIndex}
                            className={`absolute w-96 p-3 rounded-xl overflow-hidden cursor-pointer transition-all duration-150 hover:scale-105 ${cardBgClass}`}
                            style={{
                                transform: `translateX(${translateX}px) rotate(${angle}deg) translateY(${Math.abs(angle) * 0.5}px) translateZ(${zIndex}px)`,
                                zIndex: zIndex,
                            }}
                            onClick={() => {
                                if (isMiddleCard) {
                                    const tid = entregavel.tarefa_origem ? `${selectedPillar}_${entregavel.tarefa_origem}` : null;
                                    const generatedDeliverable = tid ? taskDeliverables[tid] : null;

                                    if (!generatedDeliverable) {
                                        setError('Execute a tarefa para gerar o entregável completo antes de abrir no Google Docs.');
                                        return;
                                    }

                                    openInGoogleDocs(generatedDeliverable, meta.label, session, setLoadingDoc, entregavel.id);
                                } else {
                                    handleReorderEntregaveis(originalIndex);
                                }
                            }}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    handleReorderEntregaveis(originalIndex);
                                }
                            }}
                        >
                            {isCompleted && (
                                <div className="absolute top-2 left-2 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center z-30 shadow-lg">
                                    <Check className="w-3 h-3 text-white" />
                                </div>
                            )}

                            <div className="flex items-center gap-2.5 mb-2">
                                <div className="relative w-7 h-7 shrink-0">
                                    <img src={toolInfo.icon} alt={toolInfo.name} className={`w-full h-full rounded object-contain ${isMiddleCard ? '' : 'opacity-60 grayscale'}`} />
                                </div>
                                <div className="flex-1 flex items-center gap-2 text-left min-w-0 whitespace-nowrap">
                                    <span className={`text-[13px] font-medium ${titleClass}`}>
                                        {safeRender(entregavel.titulo)}
                                    </span>
                                    <span className={`text-[11px] ${toolInfo.color} ${isMiddleCard ? '' : 'opacity-70'}`}>
                                        {toolInfo.name}
                                    </span>
                                </div>
                            </div>

                            {entregavel.descricao && (
                                <p className="text-[11px] text-zinc-600 leading-tight mb-2">
                                    {safeRender(entregavel.descricao)}
                                </p>
                            )}

                            <div className="flex items-center justify-between pt-2 border-t border-white/[0.05]">
                                {entregavel.tarefa_origem && (
                                    <span className="text-[9px] text-zinc-600">
                                        T{entregavel.tarefa_origem}
                                    </span>
                                )}
                                {isMiddleCard ? (
                                    <span className="text-[8px] text-blue-400 italic">
                                        Clique para abrir no {toolInfo.name}
                                    </span>
                                ) : (
                                    <span className="text-[8px] text-zinc-600 italic">
                                        Clique para mover
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
