import React, { useState } from 'react';
import { useSidebar } from '@/contexts/SidebarContext';

export function SourceBadgeList({ sources, maxVisible = 4, animated = false }: { sources: any[], maxVisible?: number, animated?: boolean }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const { isDark } = useSidebar();

    if (!sources || !Array.isArray(sources) || sources.length === 0) return null;

    const uniqueHostnames = new Set<string>();
    const deduplicatedSources: { src: string, hostname: string, displayUrl: string }[] = [];

    for (const rawSrc of sources.filter(Boolean)) {
        const src: string = typeof rawSrc === 'string' ? rawSrc
            : (rawSrc as any).url || (rawSrc as any).link || String(rawSrc);
        let displayUrl = src;
        let hostname = src;
        try {
            const url = new URL(src);
            hostname = url.hostname;
            displayUrl = hostname.replace(/^www\./i, '');
        } catch (e) { /* fallback */ }

        if (!uniqueHostnames.has(displayUrl)) {
            uniqueHostnames.add(displayUrl);
            deduplicatedSources.push({ src, hostname, displayUrl });
        }
    }

    if (deduplicatedSources.length === 0) return null;

    const visibleSources = isExpanded ? deduplicatedSources : deduplicatedSources.slice(0, maxVisible);
    const hiddenCount = Math.max(0, deduplicatedSources.length - maxVisible);

    return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
            {visibleSources.map(({ src, hostname, displayUrl }, idx) => {
                const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
                return (
                    <a
                        key={idx}
                        href={src}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-1.5 text-[13px] font-normal transition-colors cursor-pointer ${
                            isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-zinc-900'
                        }`}
                        style={animated ? {
                            opacity: 0,
                            animation: 'fade-in-up 0.4s ease forwards',
                            animationDelay: `${idx * 0.18}s`,
                        } : undefined}
                    >
                        <img src={faviconUrl} alt="" className="w-3.5 h-3.5 rounded-sm shrink-0 object-contain" />
                        <span>{displayUrl}</span>
                    </a>
                );
            })}
            
            {!isExpanded && hiddenCount > 0 && (
                <button
                    onClick={() => setIsExpanded(true)}
                    className={`text-[12px] font-bold transition-colors cursor-pointer ${
                        isDark ? 'text-blue-500 hover:text-blue-400' : 'text-blue-600 hover:text-blue-700'
                    }`}
                >
                    +{hiddenCount} mais
                </button>
            )}
            
            {isExpanded && hiddenCount > 0 && (
                <button
                    onClick={() => setIsExpanded(false)}
                    className={`text-[12px] font-bold transition-colors cursor-pointer underline ${
                        isDark ? 'text-blue-500 hover:text-blue-400' : 'text-blue-600 hover:text-blue-700'
                    }`}
                >
                    Recolher
                </button>
            )}
        </div>
    );
}
