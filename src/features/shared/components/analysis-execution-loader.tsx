'use client';

import React from 'react';
import { ArrowLeft } from 'lucide-react';
import TaskSubtasksDisplay from '@/features/workspace/components/task-subtasks-display';
import { useSidebar } from '@/contexts/SidebarContext';
import LoadingDots from './LoadingDots';

interface AnalysisExecutionLoaderProps {
    subtasks: any[];
    statuses: Record<number, 'waiting' | 'running' | 'done' | 'error'>;
    results: Record<number, any>;
    businessName: string;
    isExecuting: boolean;
    currentStep: number;
    onBack?: () => void;
    onComplete?: () => void;
    isFullPage?: boolean;
}

const AnalysisExecutionLoader: React.FC<AnalysisExecutionLoaderProps> = ({
    subtasks,
    statuses,
    results,
    businessName,
    isExecuting,
    currentStep,
    onBack,
    onComplete,
    isFullPage = true
}) => {
    const { isDark } = useSidebar();
    const tid = "reanalysis-meta";

    // Mock task for the display component
    const mockTask = {
        id: tid,
        titulo: "Processamento de Inteligência",
        descricao: "Análise estratégica em tempo real",
        executavel_por_ia: true
    };

    return (
        <div
            className="absolute inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden transition-all duration-700"
            style={{ backgroundColor: 'var(--color-bg)', backdropFilter: 'blur(24px)' }}
        >
            {/* Top Back Button (Only for specific contexts) */}
            {onBack && !isFullPage && (
                <div className="absolute top-8 left-8 z-30">
                    <button
                        onClick={onBack}
                        className={`p-2 rounded-lg backdrop-blur-md transition-all hover:scale-105 active:scale-95 border ${isDark ? 'bg-zinc-900/50 border-white/10 text-zinc-400 hover:text-white' : 'bg-white border-zinc-200 text-zinc-600'
                            }`}
                    >
                        <ArrowLeft size={16} />
                    </button>
                </div>
            )}

            <div className={`w-full ${isFullPage ? 'max-w-5xl' : 'max-w-3xl'} flex flex-col relative z-20 h-full max-h-[85vh] text-left`}>


                {/* Feed Area */}
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
                {!isExecuting && (
                    <div className="mt-8 flex items-center justify-center p-4 border-t border-white/5">
                        <button
                            onClick={() => onComplete?.()}
                            className={`flex items-center justify-center gap-2 py-5 rounded-2xl font-black text-[15px] uppercase tracking-[0.3em] transition-all hover:scale-[1.01] active:scale-95 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-700 w-full ${isDark ? 'bg-white text-black' : 'bg-black text-white'
                                }`}
                        >
                            Finalizar Auditoria
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AnalysisExecutionLoader;