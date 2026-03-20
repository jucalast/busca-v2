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
        if (!text) {
            setDisplayed('');
            setDone(false);
            return;
        }
        
        // If current text is a continuation of what we are already showing, don't restart from 0
        // BUT if it's completely different (e.g., next task), we DO need to reset
        const isContinuation = text.startsWith(displayed) && displayed.length > 0;
        
        if (!isContinuation) {
            setDisplayed('');
            setDone(false);
        } else if (displayed.length === text.length) {
            setDone(true);
            return;
        }

        let idx = isContinuation ? displayed.length : 0;
        const interval = setInterval(() => {
            const chunk = Math.min(3, text.length - idx);
            if (chunk <= 0) {
                clearInterval(interval);
                setDone(true);
                onDone?.();
                return;
            }
            idx += chunk;
            setDisplayed(text.slice(0, idx));
        }, speed);
        return () => clearInterval(interval);
    }, [text, speed, onDone]); // note: using displayed in check, but not in dependency list to avoid loops

    return (
        <span className={className} style={style}>
            {displayed}
            {!done && <span className="inline-block w-1.5 h-3 bg-zinc-400 animate-pulse ml-0.5 align-middle rounded-sm" />}
        </span>
    );
}
