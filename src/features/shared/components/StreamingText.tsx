import React, { useState, useEffect } from 'react';

export function StreamingText({ text, speed = 8, className = '', style = {}, onDone }: {
    text: string;
    speed?: number;
    className?: string;
    style?: React.CSSProperties;
    onDone?: () => void;
}) {
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
                onDone?.();
            }
        }, speed);
        return () => clearInterval(interval);
    }, [text, speed, onDone]);

    return (
        <span className={className} style={style}>
            {displayed}
            {!done && <span className="inline-block w-1.5 h-3 bg-zinc-400 animate-pulse ml-0.5 align-middle rounded-sm" />}
        </span>
    );
}
