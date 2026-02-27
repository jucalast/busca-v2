'use client';

import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
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

export default function ModelSelector({ value, onChange, direction = 'up' }: ModelSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
    const [viewport, setViewport] = useState({ width: 0, height: 0 });

    const selected = MODEL_OPTIONS.find((m) => m.value === value) || MODEL_OPTIONS[0];

    const handleToggle = () => {
        setIsOpen((prev) => !prev);
    };

    useEffect(() => {
        if (!isOpen) return;
        const close = (e: MouseEvent) => {
            if (ref.current && ref.current.contains(e.target as Node)) return;
            if (dropdownRef.current && dropdownRef.current.contains(e.target as Node)) return;
            setIsOpen(false);
        };
        const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', esc);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('keydown', esc);
        };
    }, [isOpen]);

    useLayoutEffect(() => {
        if (!isOpen || typeof window === 'undefined') return;

        const updateRect = () => {
            if (!ref.current) return;
            setTriggerRect(ref.current.getBoundingClientRect());
            setViewport({ width: window.innerWidth, height: window.innerHeight });
        };

        updateRect();
        window.addEventListener('resize', updateRect);
        window.addEventListener('scroll', updateRect, true);
        return () => {
            window.removeEventListener('resize', updateRect);
            window.removeEventListener('scroll', updateRect, true);
        };
    }, [isOpen]);

    const dropdownWidth = triggerRect ? Math.max(triggerRect.width, 220) : 220;
    const horizontalPadding = 12;
    const viewportWidth = viewport.width || (typeof window !== 'undefined' ? window.innerWidth : 0);
    const computedLeft = triggerRect
        ? Math.min(
            Math.max(triggerRect.left, horizontalPadding),
            Math.max(horizontalPadding, viewportWidth - dropdownWidth - horizontalPadding)
        )
        : 0;
    const baseTop = triggerRect
        ? direction === 'up'
            ? Math.max(12, triggerRect.top - 8)
            : triggerRect.bottom + 8
        : 0;
    const dropdownTransform = direction === 'up' ? 'translateY(-100%)' : undefined;

    const dropdown = (isOpen && triggerRect && typeof document !== 'undefined')
        ? createPortal(
            <div
                ref={dropdownRef}
                className="fixed z-[12000] min-w-[200px] p-1 rounded-lg shadow-xl shadow-black/70 overflow-hidden bg-[#111113]"
                style={{
                    top: baseTop,
                    left: computedLeft,
                    width: dropdownWidth,
                    transform: dropdownTransform,
                }}
            >
                <div className="px-2 pt-1.5 pb-1">
                    <span className="text-[9px] font-semibold text-zinc-600 uppercase tracking-wider">Modelo</span>
                </div>

                {MODEL_OPTIONS.map((opt) => {
                    const active = opt.value === value;
                    return (
                        <button
                            key={opt.value}
                            onClick={() => {
                                onChange(opt.value);
                                setIsOpen(false);
                            }}
                            className={`w-full flex items-center gap-2 px-2 py-2 rounded transition-all duration-150 cursor-pointer ${active ? 'bg-zinc-800' : 'hover:bg-[#1b1b1f]'}`}
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
            </div>,
            document.body
        )
        : null;

    return (
        <div ref={ref} className="relative">
            {/* Trigger */}
            <button
                onClick={handleToggle}
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

            {dropdown}
        </div>
    );
}
