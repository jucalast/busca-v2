'use client';

import React from 'react';
import { Search, Globe, Newspaper, TrendingUp, Zap, Building2, ChevronDown } from 'lucide-react';
import { useSidebar } from '@/contexts/SidebarContext';

export const TOOL_CONFIG: Record<string, { icon: React.ElementType; label: string; style: React.CSSProperties }> = {
    web_search: { icon: Search, label: 'Web Search', style: { color: 'var(--color-accent)' } },
    web_extractor: { icon: Globe, label: 'Web Extractor', style: { color: 'var(--color-accent)' } },
    news_extractor: { icon: Newspaper, label: 'News Intel', style: { color: 'var(--color-warning)' } },
    trend_analyzer: { icon: TrendingUp, label: 'Google Trends', style: { color: 'var(--color-success)' } },
    trend_analyzer_rising: { icon: Zap, label: 'Termos em Alta', style: { color: 'var(--color-warning)' } },
    sales_triggers: { icon: Zap, label: 'Sales Triggers', style: { color: 'var(--color-destructive)' } },
    cnpj_lookup: { icon: Building2, label: 'CNPJ Lookup', style: { color: 'var(--color-accent)' } },
};

export function IntelToolRow({ tool }: { tool: any }) {
    const [isDetailVisible, setIsDetailVisible] = React.useState(false);
    const { isDark } = useSidebar();
    const config = TOOL_CONFIG[tool.tool] || { icon: Globe, label: tool.tool, style: { color: 'var(--color-text-secondary)' } };
    const Icon = config.icon;
    const detail = tool.detail as string | undefined;
    const isRunning = tool.status === 'running';

    return (
        <div className="flex flex-col animate-in fade-in slide-in-from-left-2 duration-300">
            <button
                onClick={() => detail && !isRunning && setIsDetailVisible(p => !p)}
                className={`group flex items-center gap-2 px-2 py-1 rounded-lg transition-all ${
                    detail && !isRunning 
                        ? (isDark ? 'hover:bg-white/5 cursor-pointer' : 'hover:bg-gray-50 cursor-pointer') 
                        : 'cursor-default'
                }`}
            >
                <div className={`relative flex items-center justify-center w-5 h-5 rounded-md transition-colors duration-300 ${
                    isRunning ? 'animate-pulse' : ''
                } ${
                    isDark ? 'bg-zinc-900' : 'bg-gray-100'
                }`}>
                    <Icon className="w-3 h-3 shrink-0 transition-colors" style={config.style} />
                    {isRunning && (
                        <div className="absolute inset-0 rounded-md bg-current opacity-10 animate-ping" style={config.style} />
                    )}
                </div>
                <span className="text-[11px] font-semibold tracking-tight" style={{ color: 'var(--color-text-primary)', opacity: isRunning ? 0.7 : 1 }}>
                    {config.label} {isRunning ? 'em andamento...' : ''}
                </span>
                {detail && !isRunning && (
                    <ChevronDown className={`w-3.5 h-3.5 transition-all duration-300 ${isDetailVisible ? 'rotate-180' : ''}`} style={{ color: 'var(--color-text-muted)' }} />
                )}
            </button>
            {isDetailVisible && detail && !isRunning && (
                <div className={`mt-1 ml-7 mr-4 p-2.5 rounded-xl border animate-in zoom-in-95 duration-200 transition-colors ${
                    isDark ? 'bg-white/5 border-white/5' : 'bg-gray-50/80 border-gray-100/50'
                }`}>
                    <p className={`text-[11px] leading-relaxed font-medium italic ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{detail}</p>
                </div>
            )}
        </div>
    );
}

export function IntelligenceToolsBadges({ tools, isRunning = false }: { tools?: any[]; isRunning?: boolean }) {
    const { isDark } = useSidebar();
    const applied = tools?.filter(t => t.status === 'success' || t.status === 'running') ?? [];
    
    // If running but no tools yet, or we have tools, show the container
    if (applied.length === 0 && !isRunning) return null;

    return (
        <div className="flex flex-col gap-1.5 py-2 my-1 transition-colors duration-300">
            {applied.length > 0 ? (
                applied.map((tool, idx) => (
                    <IntelToolRow key={`${tool.tool}-${idx}`} tool={tool} />
                ))
            ) : isRunning ? (
                <div className="flex items-center gap-2.5 px-2 py-1 opacity-60 animate-in fade-in duration-700">
                    <div className="flex items-center justify-center transition-colors duration-300">
                        <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500/10" />
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Ativando Inteligência...</span>
                </div>
            ) : null}
        </div>
    );
}
