import React, { useState, useEffect } from 'react';

export function StreamingText({ text, speed = 8, className = '' }: { text: string; speed?: number; className?: string }) {
    const [displayed, setDisplayed] = useState('');
    const [done, setDone] = useState(false);

    useEffect(() => {
        if (!text) return;
        setDisplayed('');
        setDone(false);
        let idx = 0;
        const interval = setInterval(() => {
            // Reveal in chunks for smoother feel
            const chunk = Math.min(3, text.length - idx);
            idx += chunk;
            setDisplayed(text.slice(0, idx));
            if (idx >= text.length) {
                clearInterval(interval);
                setDone(true);
            }
        }, speed);
        return () => clearInterval(interval);
    }, [text, speed]);

    return (
        <span className={className}>
            {displayed}
            {!done && <span className="inline-block w-1.5 h-3 bg-zinc-400 animate-pulse ml-0.5 align-middle rounded-sm" />}
        </span>
    );
}
