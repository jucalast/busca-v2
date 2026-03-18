'use client';

import React from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
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
}

export default function AnalysisExecutionLoader({
    subtasks,
    statuses,
    results,
    businessName,
    isExecuting,
    currentStep
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

    return (
        <div className={`absolute inset-0 z-[100] backdrop-blur-2xl flex flex-col items-center justify-center p-6 sm:pr-14 sm:pb-14 overflow-hidden rounded-3xl transition-all duration-700 ${
            isDark ? 'bg-zinc-950/40' : 'bg-white/40'
        }`}>
            {/* Background Particles (Animated) */}
            <div className="absolute inset-0 pointer-events-none opacity-40">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] animate-pulse delay-700" />
            </div>

            <div className="w-full max-w-3xl flex flex-col relative z-20 h-full max-h-[85vh]">
                {/* Header */}
                <div className="mb-8 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 mb-4">
                        <Loader2 className="w-3 h-3 animate-spin text-accent" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Análise em Tempo Real</span>
                    </div>
                    <h2 className={`text-3xl font-medium mb-1 transition-colors duration-300 ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                        {businessName || 'Seu Negócio'}
                    </h2>
                    <p className={`text-sm transition-colors duration-300 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                        Executando diagnóstico de ponta a ponta com Inteligência de Mercado.
                    </p>
                </div>

                {/* Feed Area - Using the SAME component as task execution */}
                <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar">
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

                {/* Footer */}
                <div className={`mt-8 flex items-center justify-between border-t pt-6 text-[11px] font-medium tracking-widest uppercase transition-colors duration-300 ${
                    isDark ? 'border-white/10 text-zinc-500' : 'border-zinc-200 text-zinc-500'
                }`}>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-emerald-500" />
                            <span>Discovery Ativo</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-blue-500" />
                            <span>Live Research</span>
                        </div>
                    </div>
                    <span>{isExecuting ? 'Processando dados...' : 'Finalizado'}</span>
                </div>
            </div>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'};
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'};
                }
            `}</style>
        </div>
    );
}
