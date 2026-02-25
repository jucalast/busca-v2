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
}

export default function ModelSelector({ value, onChange }: ModelSelectorProps) {
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
                className="flex items-center gap-2.5 h-9 px-4 rounded-lg bg-transparent hover:bg-white/5 hover:ring-1 hover:ring-zinc-600 transition-all duration-200 cursor-pointer"
            >
                <Image
                    src={selected.logo}
                    alt={selected.label}
                    width={20}
                    height={20}
                    className="rounded shrink-0 object-contain"
                />
                <span className="text-[13px] font-medium text-zinc-300">{selected.label}</span>
                <ChevronDown
                    className={`w-3 h-3 text-zinc-600 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute top-full right-0 mt-1.5 z-50 min-w-[240px] p-1.5 bg-zinc-900 rounded-xl shadow-2xl shadow-black/70 overflow-hidden">
                    <div className="px-3 pt-2 pb-1.5">
                        <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Modelo</span>
                    </div>

                    {MODEL_OPTIONS.map((opt) => {
                        const active = opt.value === value;
                        return (
                            <button
                                key={opt.value}
                                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all duration-150 cursor-pointer ${active ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'
                                    }`}
                            >
                                <Image
                                    src={opt.logo}
                                    alt={opt.label}
                                    width={22}
                                    height={22}
                                    className="rounded shrink-0 object-contain"
                                />

                                <div className="flex-1 flex items-center gap-2 text-left min-w-0 whitespace-nowrap">
                                    <span className={`text-[13px] font-medium ${active ? 'text-white' : 'text-zinc-400'}`}>
                                        {opt.label}
                                    </span>
                                    <span className="text-[11px] text-zinc-600">{opt.sub}</span>
                                </div>

                                {active && (
                                    <Check className="w-3.5 h-3.5 shrink-0" style={{ color: opt.accent }} />
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
