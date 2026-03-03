'use client';

import React from 'react';
import { Mic, MicOff, Loader2, AlertCircle } from 'lucide-react';
import type { VoiceState } from '@/features/shared/hooks/use-voice-input';

interface VoiceButtonProps {
    state: VoiceState;
    interimText: string;
    isSupported: boolean;
    onToggle: () => void;
}

// Ripple ring shown while listening
const ListeningRing: React.FC = () => (
    <span className="absolute inset-0 rounded-lg pointer-events-none">
        <span
            className="absolute inset-0 rounded-lg border border-red-400/50"
            style={{ animation: 'voice-ripple 1.2s ease-out infinite' }}
        />
    </span>
);

// Inline interim transcript badge shown above the button bar
export const VoiceInterimBadge: React.FC<{ text: string }> = ({ text }) => {
    if (!text) return null;
    return (
        <div className="flex items-center gap-2 px-1 mb-1" style={{ animation: 'fadeIn 0.15s ease' }}>
            <span
                className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0"
                style={{ animation: 'dot-pulse 0.8s ease-in-out infinite' }}
            />
            <span className="text-[12px] text-zinc-400 italic leading-snug truncate">{text}</span>
        </div>
    );
};

export const VoiceButton: React.FC<VoiceButtonProps> = ({
    state,
    isSupported,
    onToggle,
}) => {
    if (!isSupported) {
        return (
            <button
                disabled
                title="Reconhecimento de voz não suportado neste navegador"
                className="flex items-center gap-2 h-7 px-3 rounded-lg bg-transparent opacity-30 cursor-not-allowed"
            >
                <MicOff className="w-3.5 h-3.5 text-zinc-500" />
            </button>
        );
    }

    if (state === 'error') {
        return (
            <button
                onClick={onToggle}
                title="Erro ao acessar microfone — clique para tentar de novo"
                className="flex items-center gap-2 h-7 px-3 rounded-lg bg-red-500/10 transition-all duration-200 cursor-pointer"
            >
                <AlertCircle className="w-3.5 h-3.5 text-red-400" />
            </button>
        );
    }

    if (state === 'processing') {
        return (
            <button
                disabled
                className="flex items-center gap-2 h-7 px-3 rounded-lg bg-transparent opacity-60 cursor-default"
                title="Processando áudio..."
            >
                <Loader2 className="w-3.5 h-3.5 text-zinc-400 animate-spin" />
            </button>
        );
    }

    if (state === 'listening') {
        return (
            <button
                onClick={onToggle}
                title="Parar gravação"
                className="relative flex items-center gap-2 h-7 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-all duration-200 cursor-pointer"
            >
                <ListeningRing />
                <Mic className="w-3.5 h-3.5 text-red-400 relative z-10" />
                <span className="text-[11px] font-medium text-red-400 relative z-10">Parar</span>
            </button>
        );
    }

    // idle
    return (
        <button
            onClick={onToggle}
            title="Escrever por voz"
            className="flex items-center gap-2 h-7 px-3 rounded-lg bg-transparent hover:bg-white/5 transition-all duration-200 cursor-pointer"
        >
            <Mic className="w-3.5 h-3.5 text-zinc-400" />
        </button>
    );
};
