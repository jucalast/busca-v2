'use client';

import React from 'react';
import { Search, Globe, Newspaper, TrendingUp, Zap, Building2, ChevronDown } from 'lucide-react';

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
    const [open, setOpen] = React.useState(false);
    const config = TOOL_CONFIG[tool.tool] || { icon: Globe, label: tool.tool, style: { color: 'var(--color-text-secondary)' } };
    const Icon = config.icon;
    const detail = tool.detail as string | undefined;
    const isRunning = tool.status === 'running';

    return (
        <div className="flex flex-col">
            <button
                onClick={() => detail && !isRunning && setOpen(p => !p)}
                className={`group flex items-center gap-1.5 w-fit transition-colors ${detail && !isRunning ? 'cursor-pointer' : 'cursor-default'}`}
            >
                <div className={`${isRunning ? 'animate-pulse' : ''}`}>
                    <Icon className="w-3 h-3 shrink-0 transition-colors" style={config.style} />
                </div>
                <span className="text-[11px] transition-colors" style={{ color: 'var(--color-text-primary)', opacity: isRunning ? 0.6 : 0.9 }}>
                    {config.label} {isRunning ? '...' : ''}
                </span>
                {detail && !isRunning && (
                    <ChevronDown className={`w-3 h-3 transition-all duration-200 ${open ? 'rotate-180' : ''}`} style={{ color: 'var(--color-text-muted)' }} />
                )}
            </button>
            {open && detail && !isRunning && (
                <p className="text-[11px] leading-relaxed mt-1 pl-[18px]" style={{ color: 'var(--color-text-muted)' }}>{detail}</p>
            )}
        </div>
    );
}

export function IntelligenceToolsBadges({ tools, isRunning = false }: { tools?: any[]; isRunning?: boolean }) {
    const applied = tools?.filter(t => t.status === 'success' || t.status === 'running') ?? [];
    if (applied.length === 0) return null;

    return (
        <div className="flex flex-col gap-1 py-3">
            {applied.map((tool, idx) => (
                <IntelToolRow key={`${tool.tool}-${idx}`} tool={tool} />
            ))}
        </div>
    );
}
