'use client';

import React from 'react';
import { Loader2, Globe, ArrowLeft } from 'lucide-react';
import { useSidebar } from '@/contexts/SidebarContext';
import TaskSubtasksDisplay from '@/features/workspace/components/task-subtasks-display';
import { TaskItem } from '@/features/workspace/components/pillar-workspace/types';

interface AnalysisExecutionLoaderProps {
    subtasks: any[];
    statuses: Record<number, 'waiting' | 'running' | 'done' | 'error'>;
    results: Record<number, any>;
    businessName: string;
    isExecuting: boolean;
    currentStep: number;
    onComplete?: () => void;
    onBack?: () => void;
    isFullPage?: boolean;
}

export default function AnalysisExecutionLoader({
    subtasks,
    statuses,
    results,
    businessName,
    isExecuting,
    currentStep,
    onComplete,
    onBack,
    isFullPage = true
}: AnalysisExecutionLoaderProps) {
    const { isDark } = useSidebar();

    // Mock task for TaskSubtasksDisplay
    const mockTask: TaskItem = {
        id: 'reanalysis',
        titulo: 'Análise Estratégica Completa',
        descricao: 'Diagnóstico de maturidade comercial e plano de growth.',
        executavel_por_ia: true
    };

    const tid = 'reanalysis-meta';

    // Calcular fontes únicas encontradas nos resultados
    const foundSourcesCount = new Set(
        Object.values(results || {})
            .flatMap(r => r?.sources || [])
            .map(s => typeof s === 'string' ? s : s?.url || s?.link)
            .filter(Boolean)
    ).size;

    return (
        <div
            className="absolute inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden transition-all duration-700"
            style={{ backgroundColor: 'var(--color-bg)', backdropFilter: 'blur(24px)' }}
        >
            {/* Top Back Button (Only for inner pilar / thought history) */}
            {onBack && !isFullPage && (
                <div className="absolute top-8 left-8 z-30">
                    <button
                        onClick={onBack}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-bold transition-all border ${isDark
                                ? 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                                : 'bg-black/5 border-black/5 text-black hover:bg-black/10'
                            }`}
                    >
                        <ArrowLeft size={16} /> Voltar
                    </button>
                </div>
            )}

            <div className={`w-full ${isFullPage ? 'max-w-5xl' : 'max-w-3xl'} flex flex-col relative z-20 h-full max-h-[85vh] text-left`}>


                {/* Feed Area - Using the SAME component as task execution */}
                <div className="flex-1 overflow-y-auto px-4 sm:px-0 custom-scrollbar mt-4">
                    <TaskSubtasksDisplay
                        task={mockTask}
                        pillarKey="geral"
                        tid={tid}
                        isDone={!isExecuting}
                        subtasks={subtasks}
                        autoExecSubtasks={{ [tid]: subtasks }}
                        autoExecResults={{ [tid]: results }}
                        autoExecStatuses={{ [tid]: statuses }}
                        autoExecuting={isExecuting ? tid : null}
                        autoExecStep={currentStep}
                        autoExecTotal={subtasks.length}
                        displayMode="result"
                        color="var(--color-accent)"
                    />
                </div>

                {/* Footer - Only Action Button */}
                {!isExecuting && isFullPage && (
                    <div className={`mt-8 flex items-center justify-center transition-colors duration-300 w-full ${isFullPage ? 'border-t-0' : 'border-t pt-6'}`} style={{ borderColor: 'var(--color-border)' }}>
                        <button
                            onClick={() => (onComplete as any)?.()}
                            className={`flex items-center justify-center gap-2 py-5 rounded-2xl font-black text-[15px] uppercase tracking-[0.3em] transition-all hover:scale-[1.01] active:scale-95 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-700 ${isFullPage
                                    ? `w-full ${isDark ? 'bg-white text-black' : 'bg-black text-white'} ring-1 ring-inset ${isDark ? 'ring-white/10' : 'ring-black/10'}`
                                    : 'px-8 bg-accent text-white'
                                }`}
                        >
                            Ir para o Pilar
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
