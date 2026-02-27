'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import Image from 'next/image';

const MODEL_OPTIONS = [
    {
        value: 'groq',
        label: 'Groq',
        sub: 'Llama',
        logo: '/groq llama.png',
        accent: '#f97316',
    },
    {
        value: 'gemini',
        label: 'Gemini',
        sub: 'Google',
        logo: '/gemini.png',
        accent: '#60a5fa',
    },
    {
        value: 'openrouter',
        label: 'OpenRouter',
        sub: 'Multi-modelo',
        logo: '/openrouter.png',
        accent: '#34d399',
    },
];

interface ModelSelectorProps {
    value: string;
    onChange: (value: string) => void;
    direction?: 'up' | 'down';
}

export default function ModelSelector({ value, onChange, direction = 'down' }: ModelSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const selected = MODEL_OPTIONS.find((m) => m.value === value) || MODEL_OPTIONS[0];

    useEffect(() => {
        if (!isOpen) return;
        const close = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
        };
        const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', esc);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('keydown', esc);
        };
    }, [isOpen]);

    return (
        <div ref={ref} className="relative">
            {/* Trigger */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 h-7 px-3 rounded-lg bg-transparent hover:bg-white/5 transition-all duration-200 cursor-pointer"
            >
                <Image
                    src={selected.logo}
                    alt={selected.label}
                    width={16}
                    height={16}
                    className="rounded shrink-0 object-contain"
                />
                <span className="text-[11px] font-medium text-zinc-300">{selected.label}</span>
                <ChevronDown
                    className={`w-2.5 h-2.5 text-zinc-600 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className={`absolute ${direction === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'} right-0 z-50 min-w-[200px] p-1 bg-[#111113] rounded-lg shadow-xl shadow-black/70 overflow-hidden`}>
                    <div className="px-2 pt-1.5 pb-1">
                        <span className="text-[9px] font-semibold text-zinc-600 uppercase tracking-wider">Modelo</span>
                    </div>

                    {MODEL_OPTIONS.map((opt) => {
                        const active = opt.value === value;
                        return (
                            <button
                                key={opt.value}
                                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                                className={`w-full flex items-center gap-2 px-2 py-2 rounded transition-all duration-150 cursor-pointer ${active ? 'bg-zinc-800' : 'hover:bg-[#1b1b1f]'
                                    }`}
                            >
                                <Image
                                    src={opt.logo}
                                    alt={opt.label}
                                    width={18}
                                    height={18}
                                    className="rounded shrink-0 object-contain"
                                />

                                <div className="flex-1 flex items-center gap-1.5 text-left min-w-0 whitespace-nowrap">
                                    <span className={`text-[11px] font-medium ${active ? 'text-white' : 'text-zinc-400'}`}>
                                        {opt.label}
                                    </span>
                                    <span className="text-[10px] text-zinc-600">{opt.sub}</span>
                                </div>

                                {active && (
                                    <Check className="w-3 h-3 shrink-0" style={{ color: opt.accent }} />
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
