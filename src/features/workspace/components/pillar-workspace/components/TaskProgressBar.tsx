'use client';

import React from 'react';
import { ArrowLeft, FileText } from 'lucide-react';
import { useSidebar } from '@/contexts/SidebarContext';

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
    const { isDark } = useSidebar();
    if (totalTasks <= 0) return null;

    return (
        <>
            {/* Top Bar */}
            <div className="flex flex-col pt-4 pb-2 gap-2">
                <div className="flex items-center justify-between">
                    {focusedTaskId && (
                        <button
                            onClick={() => setFocusedTaskId(null)}
                            className={`p-2 rounded-full backdrop-blur-md transition-all hover:scale-110 active:scale-95 shadow-sm ${
                                isDark 
                                ? 'bg-white/5 text-white hover:bg-white/10' 
                                : 'bg-black/5 text-zinc-900 hover:bg-black/10'
                            }`}
                        >
                            <ArrowLeft size={18} />
                        </button>
                    )}

                    {docsCount > 0 && (
                        <div
                            className="flex items-center rounded-lg p-1 gap-1 z-10"
                            style={{
                                backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'var(--color-surface-1)',
                                backdropFilter: 'blur(8px)',
                                border: '1px solid var(--color-border)',
                                boxShadow: 'var(--shadow-sm)',
                            }}
                        >
                            <button
                                onClick={() => { setActiveRightTab('tasks'); setFocusedTaskId(null); }}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all duration-150 cursor-pointer"
                                style={{
                                    backgroundColor: activeRightTab === 'tasks' ? 'var(--color-surface-active)' : 'transparent',
                                    color: activeRightTab === 'tasks' ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                                }}
                            >
                                Tarefas
                            </button>
                            <button
                                onClick={() => { setActiveRightTab('docs'); setFocusedTaskId(null); }}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all duration-150 cursor-pointer"
                                style={{
                                    backgroundColor: activeRightTab === 'docs' ? 'var(--color-surface-active)' : 'transparent',
                                    color: activeRightTab === 'docs' ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                                }}
                            >
                                <FileText className="w-3 h-3" />
                                <span>Documentos</span>
                                <span
                                    className="min-w-[16px] text-center text-[9px] rounded-full px-1 py-0.5 font-medium"
                                    style={{
                                        backgroundColor: 'var(--color-surface-2)',
                                        color: 'var(--color-text-tertiary)',
                                    }}
                                >
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
