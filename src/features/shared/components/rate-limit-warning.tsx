'use client';

import React from 'react';
import { AlertTriangle, RefreshCw, Zap } from 'lucide-react';
import ModelSelector from './model-selector';

interface RateLimitWarningProps {
    currentModel: string;
    onModelChange: (model: string) => void;
    onRetry?: () => void;
    isRetrying?: boolean;
}

export default function RateLimitWarning({
    currentModel,
    onModelChange,
    onRetry,
    isRetrying = false
}: RateLimitWarningProps) {
    return (
        <div
            className="fixed top-4 right-4 z-[10000] max-w-sm rounded-xl p-4"
            style={{
                backgroundColor: 'var(--color-surface-1)',
                border: '1px solid var(--color-border-strong)',
                boxShadow: 'var(--shadow-popover)',
                animation: 'fade-in-up 0.2s ease-out',
            }}
        >
            <div className="flex items-start gap-3">
                <div
                    className="flex-shrink-0 p-1.5 rounded-lg"
                    style={{ backgroundColor: 'var(--color-warning-muted)' }}
                >
                    <AlertTriangle className="w-4 h-4" style={{ color: 'var(--color-warning)' }} />
                </div>

                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                        Limite de Taxa Atingido
                    </h3>

                    <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--color-text-secondary)' }}>
                        O modelo <span className="font-medium" style={{ color: 'var(--color-warning)' }}>{currentModel}</span>{' '}
                        atingiu o limite diário de uso. Tente outro modelo ou aguarde.
                    </p>

                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Tentar com:</span>
                            <ModelSelector
                                value={currentModel}
                                onChange={onModelChange}
                            />
                        </div>

                        {onRetry && (
                            <button
                                onClick={onRetry}
                                disabled={isRetrying}
                                className="flex items-center gap-2 w-full justify-center px-3 py-2 rounded-lg transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{
                                    backgroundColor: 'var(--color-accent-muted)',
                                    border: '1px solid var(--color-border)',
                                    color: 'var(--color-accent)',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(59,130,246,0.15)')}
                                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--color-accent-muted)')}
                            >
                                {isRetrying ? (
                                    <>
                                        <RefreshCw className="w-3 h-3 animate-spin" />
                                        <span className="text-xs">Tentando...</span>
                                    </>
                                ) : (
                                    <>
                                        <Zap className="w-3 h-3" />
                                        <span className="text-xs">Tentar Novamente</span>
                                    </>
                                )}
                            </button>
                        )}

                        <div className="text-xs space-y-1" style={{ color: 'var(--color-text-muted)' }}>
                            <p>• Gemini: Bom para tarefas criativas</p>
                            <p>• OpenRouter: Múltiplos modelos disponíveis</p>
                            <p>• Aguarde alguns minutos para reset do limite</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
