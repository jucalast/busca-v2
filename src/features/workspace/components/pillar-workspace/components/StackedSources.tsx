import React from 'react';

export function StackedSources({ sources, max = 3 }: { sources: string[]; max?: number }) {
    if (!sources || sources.length === 0) return null;

    const uniqueSources = Array.from(new Set(sources));
    const toShow = uniqueSources.slice(0, max);

    return (
        <div className="flex items-center">
            <div className="flex items-center">
                {toShow.map((src, i) => {
                    let domain = src;
                    try {
                        domain = new URL(src).hostname;
                    } catch (e) {
                        // fallback
                    }

                    return (
                        <div
                            key={i}
                            className="bg-[var(--color-surface-1)] rounded-full flex items-center justify-center overflow-hidden transition-all duration-200 hover:-translate-y-0.5"
                            style={{
                                width: 20,
                                height: 20,
                                marginLeft: i === 0 ? 0 : -6, // 30% overlap
                                zIndex: max - i,
                                border: '1px solid var(--color-border)',
                                boxShadow: 'var(--shadow-sm)'
                            }}
                            title={src}
                        >
                            <img
                                src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
                                alt={domain}
                                className="w-[14px] h-[14px] object-contain rounded-full"
                            />
                        </div>
                    );
                })}
            </div>
            {uniqueSources.length > max && (
                <span className="text-[9px] font-medium ml-1.5" style={{ color: 'var(--color-text-ghost)' }}>
                    +{uniqueSources.length - max}
                </span>
            )}
        </div>
    );
}
