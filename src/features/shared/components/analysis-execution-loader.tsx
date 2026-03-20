'use client';

import React from 'react';
import { Loader2, Globe } from 'lucide-react';
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
}

export default function AnalysisExecutionLoader({
    subtasks,
    statuses,
    results,
    businessName,
    isExecuting,
    currentStep,
    onComplete
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
            className="absolute inset-0 z-[100] flex flex-col items-center justify-center p-6 sm:pr-14 sm:pb-14 overflow-hidden transition-all duration-700"
            style={{ backgroundColor: 'var(--color-bg)', backdropFilter: 'blur(24px)' }}
        >
            <div className="w-full max-w-3xl flex flex-col relative z-20 h-full max-h-[85vh] text-left">
                {/* Feed Area - Using the SAME component as task execution */}
                <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar mt-4">
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
                <div className="mt-8 flex items-center justify-start border-t pt-6 transition-colors duration-300" style={{ borderColor: 'var(--color-border)' }}>
                    {!isExecuting && (
                        <button 
                            onClick={() => (onComplete as any)?.()}
                            className="flex items-center gap-2 px-8 py-3 rounded-full bg-accent text-white font-black text-[13px] uppercase tracking-[0.2em] hover:brightness-110 active:scale-95 transition-all shadow-xl shadow-accent/20 animate-in fade-in slide-in-from-bottom-2 duration-700"
                        >
                            Ir para o Pilar →
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
