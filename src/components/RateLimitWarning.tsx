'use client';

import React from 'react';
import { AlertTriangle, RefreshCw, Zap } from 'lucide-react';
import ModelSelector from './ModelSelector';

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
        <div className="fixed top-4 right-4 z-[10000] max-w-sm bg-gradient-to-r from-orange-500/20 to-red-500/20 backdrop-blur-md border border-orange-500/30 rounded-xl p-4 shadow-xl">
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                    <AlertTriangle className="w-5 h-5 text-orange-400" />
                </div>
                
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-white mb-1">
                        Limite de Taxa Atingido
                    </h3>
                    
                    <p className="text-xs text-zinc-300 mb-3 leading-relaxed">
                        O modelo <span className="text-orange-400 font-medium">{currentModel}</span>{' '}
                        atingiu o limite diário de uso. Tente outro modelo ou aguarde.
                    </p>
                    
                    <div className="flex flex-col gap-2">
                        {/* Model Selector */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-400">Tentar com:</span>
                            <ModelSelector 
                                value={currentModel}
                                onChange={onModelChange}
                            />
                        </div>
                        
                        {/* Retry Button */}
                        {onRetry && (
                            <button
                                onClick={onRetry}
                                disabled={isRetrying}
                                className="flex items-center gap-2 w-full justify-center px-3 py-2 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isRetrying ? (
                                    <>
                                        <RefreshCw className="w-3 h-3 animate-spin" />
                                        <span className="text-xs text-orange-300">Tentando...</span>
                                    </>
                                ) : (
                                    <>
                                        <Zap className="w-3 h-3" />
                                        <span className="text-xs text-orange-300">Tentar Novamente</span>
                                    </>
                                )}
                            </button>
                        )}
                        
                        {/* Tips */}
                        <div className="text-xs text-zinc-500 space-y-1">
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
