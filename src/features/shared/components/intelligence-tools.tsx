'use client';

import React from 'react';
import { Search, Globe, Newspaper, TrendingUp, Zap, Building2, ChevronDown } from 'lucide-react';
import { useSidebar } from '@/contexts/SidebarContext';

export const TOOL_CONFIG: Record<string, { icon: React.ElementType; label: string }> = {
    web_search: { icon: Search, label: 'Web Search' },
    web_extractor: { icon: Globe, label: 'Web Extractor' },
    news_extractor: { icon: Newspaper, label: 'News Intel' },
    trend_analyzer: { icon: TrendingUp, label: 'Google Trends' },
    trend_analyzer_rising: { icon: Zap, label: 'Termos em Alta' },
    sales_triggers: { icon: Zap, label: 'Sales Triggers' },
    cnpj_lookup: { icon: Building2, label: 'CNPJ Lookup' },
};

export function IntelToolRow({ tool }: { tool: any }) {
    const [isDetailVisible, setIsDetailVisible] = React.useState(false);
    const { isDark } = useSidebar();
    const config = TOOL_CONFIG[tool.tool] || { icon: Globe, label: tool.tool };
    const Icon = config.icon;
    const detail = tool.detail as string | undefined;
    const isRunning = tool.status === 'running';

    const colorClasses = isDark 
        ? 'text-zinc-500 group-hover:text-white' 
        : 'text-zinc-400 group-hover:text-zinc-900';

    return (
        <div className="flex flex-col animate-in fade-in slide-in-from-left-2 duration-300">
            <button
                onClick={() => detail && !isRunning && setIsDetailVisible(p => !p)}
                className={`group flex items-center gap-1.5 py-1.5 transition-all ${
                    detail && !isRunning ? 'cursor-pointer' : 'cursor-default'
                }`}
            >
                <div className={`flex items-center justify-center h-4 w-4 relative transition-colors duration-300 ${
                    isRunning ? 'animate-pulse' : ''
                }`}>
                    <Icon className={`w-[15px] h-[15px] shrink-0 transition-colors duration-150 ${colorClasses}`} />
                    {isRunning && (
                        <div className={`absolute inset-0 rounded-full opacity-10 animate-ping ${isDark ? 'bg-white' : 'bg-black'}`} />
                    )}
                </div>
                <span className={`text-[11px] font-normal tracking-tight leading-none transition-colors duration-150 ${colorClasses}`} style={{ opacity: isRunning ? 0.7 : 1 }}>
                    {config.label} {isRunning ? 'em andamento...' : ''}
                </span>
                {detail && !isRunning && (
                    <ChevronDown className={`w-3 h-3 transition-all duration-300 ${isDetailVisible ? 'rotate-180' : ''} ${colorClasses}`} />
                )}
            </button>
            {isDetailVisible && detail && !isRunning && (
                <div className={`mt-0.5 ml-7 mr-4 animate-in slide-in-from-top-1 duration-200 transition-colors`}>
                    <p className={`text-[11px] leading-relaxed font-normal italic ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{detail}</p>
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
