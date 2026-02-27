import React, { useState } from 'react';

export function SourceBadgeList({ sources, maxVisible = 4, animated = false }: { sources: string[], maxVisible?: number, animated?: boolean }) {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!sources || !Array.isArray(sources) || sources.length === 0) return null;

    const uniqueHostnames = new Set<string>();
    const deduplicatedSources: { src: string, hostname: string, displayUrl: string }[] = [];

    for (const src of sources.filter(Boolean)) {
        let displayUrl = src;
        let hostname = src;
        try {
            const url = new URL(src);
            hostname = url.hostname;
            displayUrl = hostname.replace(/^www\./i, '');
        } catch (e) { /* fallback to src string */ }

        if (!uniqueHostnames.has(displayUrl)) {
            uniqueHostnames.add(displayUrl);
            deduplicatedSources.push({ src, hostname, displayUrl });
        }
    }

    if (deduplicatedSources.length === 0) return null;

    const visibleSources = isExpanded ? deduplicatedSources : deduplicatedSources.slice(0, maxVisible);
    const hiddenCount = Math.max(0, deduplicatedSources.length - maxVisible);

    return (
        <>
            {animated && (
                <style>{`
                    @keyframes source-fade-in {
                        from { opacity: 0; transform: translateY(6px); }
                        to   { opacity: 1; transform: translateY(0); }
                    }
                `}</style>
            )}
            <div className="flex flex-wrap gap-2 mt-2">
                {visibleSources.map(({ src, hostname, displayUrl }, idx) => {
                    const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;

                    return (
                        <a key={idx} href={src} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all duration-150 cursor-pointer bg-white/[0.04] hover:bg-white/[0.08] shadow-sm border border-white/[0.02] group"
                            style={animated ? {
                                opacity: 0,
                                animation: 'source-fade-in 0.4s ease forwards',
                                animationDelay: `${idx * 0.18}s`,
                            } : undefined}
                        >
                            <img
                                src={faviconUrl}
                                alt=""
                                className="w-4 h-4 rounded-sm shrink-0 object-contain"
                            />
                            <div className="flex-1 flex flex-col min-w-0 pr-1">
                                <span className="text-[11px] font-medium text-zinc-400 group-hover:text-white transition-colors truncate max-w-[120px] leading-tight mt-[1px]">{displayUrl}</span>
                            </div>
                        </a>
                    );
                })}
                {!isExpanded && hiddenCount > 0 && (
                    <button
                        onClick={() => setIsExpanded(true)}
                        className="inline-flex items-center px-2 py-1.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.02] text-[10px] text-zinc-400 hover:text-white transition-colors cursor-pointer shadow-sm"
                        style={animated ? {
                            opacity: 0,
                            animation: 'source-fade-in 0.4s ease forwards',
                            animationDelay: `${visibleSources.length * 0.18}s`,
                        } : undefined}
                    >
                        +{hiddenCount} mais
                    </button>
                )}
                {isExpanded && hiddenCount > 0 && (
                    <button
                        onClick={() => setIsExpanded(false)}
                        className="inline-flex items-center px-2 py-1.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.02] text-[10px] text-zinc-400 hover:text-white transition-colors cursor-pointer shadow-sm">
                        Recolher
                    </button>
                )}
            </div>
        </>
    );
}
