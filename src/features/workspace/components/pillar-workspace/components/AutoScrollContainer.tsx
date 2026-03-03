'use client';

import React from 'react';

export function AutoScrollContainer({ children }: { children: React.ReactNode }) {
    const scrollRef = React.useRef<HTMLDivElement>(null);
    const isFollowingRef = React.useRef(true);
    const [showScrollBtn, setShowScrollBtn] = React.useState(false);

    const scrollToBottom = React.useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
        isFollowingRef.current = true;
        setShowScrollBtn(false);
    }, []);

    React.useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        const onScroll = () => {
            const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
            if (distFromBottom < 60) {
                isFollowingRef.current = true;
                setShowScrollBtn(false);
            } else {
                isFollowingRef.current = false;
                setShowScrollBtn(true);
            }
        };

        el.addEventListener('scroll', onScroll, { passive: true });
        return () => el.removeEventListener('scroll', onScroll);
    }, []);

    React.useLayoutEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        const observer = new MutationObserver(() => {
            if (isFollowingRef.current) {
                el.scrollTop = el.scrollHeight;
            }
        });

        observer.observe(el, { childList: true, subtree: true, characterData: true });
        return () => observer.disconnect();
    }, []);

    return (
        <div className="absolute inset-x-0 top-0 bottom-0">
            <div ref={scrollRef} className="absolute inset-0 overflow-y-auto pb-48 scrollbar-hide flex flex-col">
                <div className="mt-auto">
                    {children}
                </div>
            </div>

            {showScrollBtn && (
                <div className="absolute bottom-25 left-0 right-0 flex justify-center pointer-events-none z-20">
                    <button
                        onClick={scrollToBottom}
                        className="pointer-events-auto w-7 h-7 flex items-center justify-center rounded-full bg-zinc-800 border border-white/10 text-zinc-400 shadow-lg hover:bg-zinc-700 hover:text-zinc-200 transition-all active:scale-95"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 2.5v7M3 7l3 3 3-3" />
                        </svg>
                    </button>
                </div>
            )}
        </div>
    );
}
