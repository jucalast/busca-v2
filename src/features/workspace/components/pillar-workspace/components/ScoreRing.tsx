import React from 'react';

export function ScoreRing({ score, size = 48, color }: { score: number; size?: number; color: string }) {
    const r = (size - 6) / 2;
    const circ = 2 * Math.PI * r;
    const pct = Math.max(0, Math.min(100, score || 0));
    return (
        <svg width={size} height={size} className="transform -rotate-90">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={3} />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={3}
                strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)}
                strokeLinecap="round" className="transition-all duration-700" />
            <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
                className="fill-white text-[11px] font-bold" transform={`rotate(90 ${size / 2} ${size / 2})`}>
                {pct}
            </text>
        </svg>
    );
}
