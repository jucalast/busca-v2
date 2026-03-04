'use client';

import React from 'react';
import {
    ArrowLeft, RefreshCw
} from 'lucide-react';
import { PILLAR_META } from '../constants';
import { safeRender } from '../utils';
import { SourceBadgeList } from './SourceBadgeList';
import { DocumentsTab, DocItem } from './DocumentsTab';
import { TaskItem } from '../types';

interface PillarHeaderProps {
    selectedPillar: string;
    plan: any;
    specialists: Record<string, any>;
    dims: Record<string, any>;
    allSources: string[];
    session: any;
    businessId: string | null;
    setLoadingDoc: (id: string | null) => void;
    setError: (err: string) => void;
    handleRedoPillar: (key: string) => void;
    onBack: () => void;
    // DocumentsTab props
    docsForDropdown: DocItem[];
    visibleTasks: TaskItem[];
    openFolders: Set<string>;
    setOpenFolders: React.Dispatch<React.SetStateAction<Set<string>>>;
    loadingDoc: string | null;
}

export function PillarHeader({
    selectedPillar,
    plan,
    specialists,
    allSources,
    session,
    setLoadingDoc,
    handleRedoPillar,
    onBack,
    docsForDropdown,
    visibleTasks,
    openFolders,
    setOpenFolders,
    loadingDoc,
}: PillarHeaderProps) {
    const meta = PILLAR_META[selectedPillar];
    const Icon = meta?.icon;

    return (
        <div className="flex-1 min-w-0 border-r border-zinc-800 flex flex-col pt-0 relative z-0 overflow-hidden">
            {/* Fixed header area */}
            <div className="shrink-0 px-6 pt-5 pb-4">
                <div className="flex items-center justify-between mb-4">
                    <button onClick={onBack}
                        className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 transition-colors text-sm">
                        <ArrowLeft className="w-4 h-4" /> Especialistas
                    </button>
                    <button
                        onClick={() => handleRedoPillar(selectedPillar)}
                        title="Apagar e Refazer Todo o Pilar"
                        className="p-2 border border-red-500/20 text-red-400/70 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/50 rounded-lg transition-all"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>

                {/* Header */}
                <div className="flex items-center gap-3.5 mb-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${meta.color}12` }}>
                        <Icon className="w-5 h-5" style={{ color: meta.color, width: 22, height: 22 }} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-lg font-semibold text-white leading-tight truncate">{plan.titulo_plano || meta.label}</h1>
                        <p className="text-zinc-500 text-xs mt-0.5 truncate">
                            {specialists[selectedPillar]?.cargo || meta.label}
                        </p>
                    </div>
                </div>

                {/* Objetivo (compact single line) */}
                {plan.objetivo && (
                    <p className="text-zinc-500 text-xs leading-snug mb-3 line-clamp-2">{safeRender(plan.objetivo)}</p>
                )}

                {/* Sources (compact) */}
                {allSources.length > 0 && (
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <img src="/google.png" alt="Fontes" className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wide">Fontes</span>
                            <span className="text-[10px] text-zinc-700 ml-auto">{allSources.length}</span>
                        </div>
                        <SourceBadgeList sources={allSources} maxVisible={3} />
                    </div>
                )}
            </div>

            {/* Divider */}
            <div className="shrink-0 mx-6 border-t border-zinc-800/60" />

            {/* Documents fill remaining space */}
            <DocumentsTab
                docsForDropdown={docsForDropdown}
                visibleTasks={visibleTasks}
                selectedPillar={selectedPillar}
                openFolders={openFolders}
                setOpenFolders={setOpenFolders}
                session={session}
                loadingDoc={loadingDoc}
                setLoadingDoc={setLoadingDoc}
            />
        </div>
    );
}