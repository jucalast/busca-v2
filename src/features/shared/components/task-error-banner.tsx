'use client';

import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface TaskErrorBannerProps {
    error: string | null;
    onClose: () => void;
    modelName?: string;
}

export default function TaskErrorBanner({ error, onClose, modelName }: TaskErrorBannerProps) {
    if (!error) return null;

    // Tentar extrair um motivo amigável do erro
    let reason = "Erro desconhecido";
    const errLower = error.toLowerCase();

    if (errLower.includes('token') || errLower.includes('tpd')) {
        reason = "Limite de tokens (TPD/TPM)";
    } else if (errLower.includes('request') || errLower.includes('rpd') || errLower.includes('rrate')) {
        reason = "Limite de requisições (RPD)";
    } else if (errLower.includes('429')) {
        reason = "Taxa de uso (Rate Limit)";
    } else if (errLower.includes('404')) {
        reason = "Modelo não encontrado (404)";
    } else if (errLower.includes('http') || errLower.includes('status')) {
        reason = "Resposta HTTP inválida";
    } else if (errLower.includes('timeout')) {
        reason = "Tempo limite (Timeout)";
    } else {
        // Se não identificou, tenta pegar o começo da mensagem
        reason = error.slice(0, 40) + "...";
    }

    return (
        <div
            className="w-full flex items-center justify-between px-3 py-1.5 transition-all duration-200"
        >
            <div className="flex items-center gap-2 overflow-hidden">
                <AlertTriangle className="w-3 h-3 shrink-0" style={{ color: 'var(--color-destructive)' }} />
                <span className="text-[11px] font-medium whitespace-nowrap" style={{ color: 'var(--color-destructive)' }}>
                    Aviso:
                </span>
                <span className="text-[11px] opacity-80" style={{ color: 'var(--color-destructive)' }}>
                    {error}
                </span>
            </div>

            <button
                onClick={onClose}
                className="p-1 hover:bg-black/5 rounded-full transition-colors"
                style={{ color: 'var(--color-destructive)' }}
            >
                <X className="w-3 h-3" />
            </button>
        </div>
    );
}
