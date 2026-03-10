import React, { useState } from 'react';

export function SourceBadgeList({ sources, maxVisible = 4, animated = false }: { sources: any[], maxVisible?: number, animated?: boolean }) {
    const [isExpanded, setIsExpanded] = useState(false);

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
        <div className="flex flex-wrap gap-2 mt-2">
            {visibleSources.map(({ src, hostname, displayUrl }, idx) => {
                const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
                return (
                    <a
                        key={idx}
                        href={src}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all duration-150 cursor-pointer group"
                        style={{
                            backgroundColor: 'var(--color-surface-hover)',
                            border: '1px solid var(--color-border)',
                            boxShadow: 'var(--shadow-sm)',
                            ...(animated ? {
                                opacity: 0,
                                animation: 'fade-in-up 0.4s ease forwards',
                                animationDelay: `${idx * 0.18}s`,
                            } : {}),
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.backgroundColor = 'var(--color-surface-active)';
                            e.currentTarget.style.borderColor = 'var(--color-border-strong)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
                            e.currentTarget.style.borderColor = 'var(--color-border)';
                        }}
                    >
                        <img src={faviconUrl} alt="" className="w-4 h-4 rounded-sm shrink-0 object-contain" />
                        <div className="flex-1 flex flex-col min-w-0 pr-1">
                            <span
                                className="text-[11px] font-medium truncate max-w-[120px] leading-tight mt-[1px] transition-colors duration-150"
                                style={{ color: 'var(--color-text-tertiary)' }}
                            >
                                {displayUrl}
                            </span>
                        </div>
                    </a>
                );
            })}
            {!isExpanded && hiddenCount > 0 && (
                <button
                    onClick={() => setIsExpanded(true)}
                    className="inline-flex items-center px-2 py-1.5 rounded-lg text-[10px] transition-colors duration-150 cursor-pointer"
                    style={{
                        backgroundColor: 'var(--color-surface-hover)',
                        color: 'var(--color-text-tertiary)',
                        border: '1px solid var(--color-border)',
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.backgroundColor = 'var(--color-surface-active)';
                        e.currentTarget.style.color = 'var(--color-text-primary)';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
                        e.currentTarget.style.color = 'var(--color-text-tertiary)';
                    }}
                >
                    +{hiddenCount} mais
                </button>
            )}
            {isExpanded && hiddenCount > 0 && (
                <button
                    onClick={() => setIsExpanded(false)}
                    className="inline-flex items-center px-2 py-1.5 rounded-lg text-[10px] transition-colors duration-150 cursor-pointer"
                    style={{
                        backgroundColor: 'var(--color-surface-hover)',
                        color: 'var(--color-text-tertiary)',
                        border: '1px solid var(--color-border)',
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.backgroundColor = 'var(--color-surface-active)';
                        e.currentTarget.style.color = 'var(--color-text-primary)';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
                        e.currentTarget.style.color = 'var(--color-text-tertiary)';
                    }}
                >
                    Recolher
                </button>
            )}
        </div>
    );
}
