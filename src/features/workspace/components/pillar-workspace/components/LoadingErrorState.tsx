'use client';

import React from 'react';
import {
    AlertCircle, Loader2, RotateCcw
} from 'lucide-react';
import { PILLAR_META } from '../constants';

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
        <div className="h-full bg-[#09090b] flex items-center justify-center">
            <div className="text-center max-w-md px-6">
                {error ? (
                    <>
                        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                            <AlertCircle className="w-6 h-6 text-red-500" />
                        </div>
                        <h3 className="text-white font-semibold mb-2">Erro ao carregar o pilar</h3>
                        <p className="text-zinc-400 text-sm mb-6">{error}</p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => handleSelectPillar(selectedPillar)}
                                className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-all text-sm font-medium flex items-center justify-center gap-2"
                            >
                                <RotateCcw className="w-4 h-4" /> Tentar Novamente
                            </button>
                            <button
                                onClick={onBack}
                                className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
                            >
                                Voltar para o Hub
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" style={{ color: meta?.color }} />
                        <p className="text-zinc-400 text-sm font-medium">O especialista está analisando e criando tarefas...</p>
                        <p className="text-zinc-600 text-xs mt-2 leading-relaxed">
                            Pesquisando dados reais + cruzando com outros pilares para gerar recomendações personalizadas.
                        </p>
                        <div className="mt-8 pt-8 border-t border-zinc-800/50">
                            <p className="text-[10px] text-zinc-700 uppercase tracking-widest font-semibold mb-1">Status</p>
                            <p className="text-xs text-zinc-500 animate-pulse">Iniciando protocolo de análise profunda...</p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
