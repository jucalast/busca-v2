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
    <span className="absolute inset-0 rounded-full pointer-events-none">
        <span
            className="absolute inset-[2px] rounded-full border-2 border-red-500/30"
            style={{ animation: 'voice-ripple 1.5s ease-out infinite' }}
        />
        <span
            className="absolute inset-0 rounded-full bg-red-500/10 animate-pulse"
        />
    </span>
);

// Inline interim transcript badge shown above the button bar
export const VoiceInterimBadge: React.FC<{ text: string }> = ({ text }) => {
    if (!text) return null;
    return (
        <div className="flex items-center gap-2 px-1 mb-1" style={{ animation: 'fadeIn 0.2s ease' }}>
            <span
                className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0"
                style={{ animation: 'dot-pulse 1s ease-in-out infinite' }}
            />
            <span className="text-[13px] text-white/50 italic leading-snug truncate font-medium">{text}</span>
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
                className="flex items-center justify-center w-11 h-11 rounded-full bg-transparent opacity-20 cursor-not-allowed"
            >
                <MicOff className="w-5 h-5 text-white" />
            </button>
        );
    }

    if (state === 'error') {
        return (
            <button
                onClick={onToggle}
                className="flex items-center justify-center w-11 h-11 rounded-full bg-red-500/20 transition-all duration-200 cursor-pointer border border-red-500/20"
                title="Erro ao acessar microfone"
            >
                <AlertCircle className="w-5 h-5 text-red-500" />
            </button>
        );
    }

    if (state === 'processing') {
        return (
            <button
                disabled
                className="flex items-center justify-center w-11 h-11 rounded-full bg-white/5 cursor-default"
            >
                <Loader2 className="w-5 h-5 text-white/40 animate-spin" />
            </button>
        );
    }

    if (state === 'listening') {
        return (
            <button
                onClick={onToggle}
                className="relative flex items-center justify-center w-11 h-11 rounded-full bg-red-500/20 border border-red-500/30 transition-all duration-300 cursor-pointer shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                title="Parar gravação"
            >
                <ListeningRing />
                <Mic className="w-5 h-5 text-red-500 relative z-10 animate-pulse" />
            </button>
        );
    }

    // idle
    return (
        <button
            onClick={onToggle}
            className="flex items-center justify-center w-11 h-11 rounded-full bg-white/5 hover:bg-white/10 transition-all duration-300 cursor-pointer border border-white/5 hover:border-white/10"
            title="Escrever por voz"
        >
            <Mic className="w-5 h-5 text-white/60" />
        </button>
    );
};
