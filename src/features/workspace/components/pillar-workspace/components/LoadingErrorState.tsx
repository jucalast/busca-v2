'use client';

import React from 'react';
import {
    AlertCircle, RotateCcw
} from 'lucide-react';
import { useSidebar } from '@/contexts/SidebarContext';
import { PILLAR_META } from '../constants';
import { PillarSkeletonLoading } from './PillarSkeletonLoading';
import AnalysisExecutionLoader from '@/features/shared/components/analysis-execution-loader';

interface LoadingErrorStateProps {
    selectedPillar: string;
    error: string;
    businessId: string | null;
    handleSelectPillar: (key: string) => void;
    onBack: () => void;
    isGenerating?: boolean;
    isExecuting?: boolean;
    results?: Record<number, any>;
    subtasks?: any[];
    statuses?: Record<number, 'waiting' | 'running' | 'done' | 'error'>;
    onComplete?: () => void;
}

export function LoadingErrorState({
    selectedPillar,
    error,
    businessId,
    handleSelectPillar,
    onBack,
    isGenerating = false,
    isExecuting = true,
    results = {},
    subtasks,
    statuses,
    onComplete,
}: LoadingErrorStateProps) {
    const { isDark } = useSidebar();
    const meta = PILLAR_META[selectedPillar];

    // Use live subtasks if provided and non-empty, otherwise fall back to mock
    const hasliveSubtasks = subtasks && subtasks.length > 0;

    const mockLoadingSubtasks = hasliveSubtasks ? subtasks! : [
        { id: 1, titulo: `Ativando especialista em ${meta?.label || 'Negócio'}...`, status: 'done' as const },
        { id: 2, titulo: 'Cruzando dados de mercado com perfil do negócio...', status: 'running' as const },
        { id: 3, titulo: 'Gerando plano de tarefas personalizadas...', status: 'waiting' as const }
    ];

    const mockStatuses: Record<number, any> = hasliveSubtasks && statuses && Object.keys(statuses).length > 0
        ? statuses
        : { 0: 'done', 1: 'running', 2: 'waiting' };

    return (
        <div className="h-full w-full" style={{ backgroundColor: 'var(--color-bg)' }}>
            <div className="text-center w-full h-full relative">
                {error ? (
                    <div className="max-w-md mx-auto pt-20">
                        <div
                            className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                            style={{
                                backgroundColor: 'var(--color-destructive-muted)',
                                border: '1px solid rgba(239,68,68,0.2)',
                            }}
                        >
                            <AlertCircle className="w-6 h-6" style={{ color: 'var(--color-destructive)' }} />
                        </div>
                        <h3 className="font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>Erro ao carregar o pilar</h3>
                        <p className="text-sm mb-6" style={{ color: 'var(--color-text-tertiary)' }}>{error}</p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => handleSelectPillar(selectedPillar)}
                                className="px-6 py-2.5 rounded-lg transition-all duration-150 text-sm font-medium flex items-center justify-center gap-2"
                                style={{
                                    backgroundColor: 'var(--color-surface-2)',
                                    color: 'var(--color-text-primary)',
                                    border: '1px solid var(--color-border)',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-3)')}
                                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-2)')}
                            >
                                <RotateCcw className="w-4 h-4" /> Tentar Novamente
                            </button>
                            <button
                                onClick={onBack}
                                className={`text-sm transition-colors duration-150 ${isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                Voltar para o Hub
                            </button>
                        </div>
                    </div>
                ) : isGenerating ? (
                    <div className="absolute inset-0">
                        <AnalysisExecutionLoader
                            subtasks={mockLoadingSubtasks}
                            statuses={mockStatuses}
                            results={results}
                            businessName={`Especialista: ${meta?.label || 'Negócio'}`}
                            isExecuting={isExecuting ?? true}
                            currentStep={hasliveSubtasks ? subtasks!.length : 1}
                            onComplete={onComplete}
                        />
                    </div>
                ) : (
                    <PillarSkeletonLoading />
                )}
            </div>
        </div>
    );
}
