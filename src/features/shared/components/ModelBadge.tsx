'use client';

import React from 'react';
import Image from 'next/image';

const MODEL_MAP: Record<string, { label: string; logo: string; accent: string }> = {
    gemini: {
        label: 'Gemini',
        logo: '/gemini.png',
        accent: '#60a5fa',
    },
    groq: {
        label: 'Groq',
        logo: '/groq llama.svg',
        accent: '#f97316',
    },
    openrouter: {
        label: 'OpenRouter',
        logo: '/openrouter.png',
        accent: '#34d399',
    },
    sambanova: {
        label: 'SambaNova',
        logo: '/sambanova.png',
        accent: '#8b5cf6',
    },
    cerebras: {
        label: 'Cerebras',
        logo: '/cerebras.png',
        accent: '#22c55e',
    },
};

interface ModelBadgeProps {
    model: string;
    tokens?: number;
}

export default function ModelBadge({ model, tokens }: ModelBadgeProps) {
    // Normalize model name (e.g. gemini-2.0-flash -> gemini)
    const baseModel = model.toLowerCase().split('-')[0];
    const config = MODEL_MAP[baseModel] || MODEL_MAP.groq;

    const fmt = (n: number) => n > 1000 ? (n / 1000).toFixed(1) + 'k' : n;

    return (
        <div
            className="flex items-center gap-2 h-7 px-3 rounded-lg transition-all duration-150"
        >
            <div className="flex items-center gap-1.5 border-r border-white/5 pr-2.5">
                <Image
                    src={config.logo}
                    alt={config.label}
                    width={16}
                    height={16}
                    className="rounded shrink-0 object-contain"
                    style={{ filter: baseModel === 'groq' ? 'invert(1)' : 'none' }}
                />
                <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                    {config.label}
                </span>
            </div>

            {tokens !== undefined && tokens > 0 && (
                <div className="flex items-center gap-1.5 pl-0.5" title="Consumo desta tarefa">
                    <span className="text-[10px] font-medium text-white/50 tabular-nums">
                        {fmt(tokens)} <span className="text-[9px] opacity-40 uppercase tracking-tighter">tokens</span>
                    </span>
                </div>
            )}
        </div>
    );
}
