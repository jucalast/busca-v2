'use client';

import React from 'react';
import {
    AlertCircle, Loader2, RotateCcw
} from 'lucide-react';
import { PILLAR_META } from '../constants';
import AnalysisExecutionLoader from '@/features/shared/components/analysis-execution-loader';

interface LoadingErrorStateProps {
    selectedPillar: string;
    error: string;
    businessId: string | null;
    handleSelectPillar: (key: string) => void;
    onBack: () => void;
}

export function LoadingErrorState({
    selectedPillar,
    error,
    businessId,
    handleSelectPillar,
    onBack,
}: LoadingErrorStateProps) {
    const meta = PILLAR_META[selectedPillar];

    return (
        <div className="h-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
            <div className="text-center max-w-md px-6">
                {error ? (
                    <>
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
                                className="text-sm transition-colors duration-150"
                                style={{ color: 'var(--color-text-muted)' }}
                                onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
                                onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}
                            >
                                Voltar para o Hub
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-2xl rounded-3xl overflow-hidden">
                        <AnalysisExecutionLoader
                            subtasks={[]}
                            statuses={{}}
                            results={{}}
                            businessName=""
                            isExecuting={true}
                            currentStep={0}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
