'use client';

import React from 'react';
import { ArrowLeft, FileText } from 'lucide-react';

interface TaskProgressBarProps {
    totalTasks: number;
    completedCount: number;
    activeRightTab: 'tasks' | 'docs';
    setActiveRightTab: (tab: 'tasks' | 'docs') => void;
    focusedTaskId: string | null;
    setFocusedTaskId: (id: string | null) => void;
    docsCount: number;
}

export function TaskProgressBar({
    totalTasks,
    completedCount,
    activeRightTab,
    setActiveRightTab,
    focusedTaskId,
    setFocusedTaskId,
    docsCount,
}: TaskProgressBarProps) {
    if (totalTasks <= 0) return null;

    return (
        <>
            {/* Full-width progress bar */}
            <div className="w-full h-[2px] bg-zinc-800 shrink-0">
                <div
                    className="h-full bg-violet-600 transition-all duration-700 ease-out"
                    style={{ width: `${(completedCount / totalTasks) * 100}%` }}
                />
            </div>
            {/* Top Bar: Task Progress & Tab Switch */}
            <div className="flex flex-col px-6 pt-5 pb-3 gap-2">
                <div className="flex items-center justify-between">
                    {focusedTaskId && (
                        <button
                            onClick={() => setFocusedTaskId(null)}
                            className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 transition-colors text-sm"
                        >
                            <ArrowLeft className="w-4 h-4" /> Voltar
                        </button>
                    )}

                    {docsCount > 0 && (
                        <div
                            className="flex items-center rounded-xl p-1 gap-1 z-10"
                            style={{
                                background: 'rgba(9,9,11,0.90)',
                                backdropFilter: 'blur(8px)',
                                border: '1px solid rgba(255,255,255,0.05)',
                                boxShadow: '0 6px 32px 0 rgba(0,0,0,0.30)',
                                overflow: 'hidden',
                            }}
                        >
                            <button
                                onClick={() => { setActiveRightTab('tasks'); setFocusedTaskId(null); }}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all duration-200 cursor-pointer ${
                                    activeRightTab === 'tasks'
                                        ? 'bg-white/[0.08] text-zinc-200 shadow-sm'
                                        : 'text-zinc-500 hover:text-zinc-400'
                                }`}
                            >
                                Tarefas
                            </button>
                            <button
                                onClick={() => { setActiveRightTab('docs'); setFocusedTaskId(null); }}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all duration-200 cursor-pointer ${
                                    activeRightTab === 'docs'
                                        ? 'bg-white/[0.08] text-zinc-200 shadow-sm'
                                        : 'text-zinc-500 hover:text-zinc-400'
                                }`}
                            >
                                <FileText className="w-3 h-3" />
                                <span>Documentos</span>
                                <span className="min-w-[16px] text-center text-[9px] bg-zinc-800 text-zinc-400 rounded-full px-1 py-0.5 font-medium">
                                    {docsCount}
                                </span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
