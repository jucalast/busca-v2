import React from 'react';
import { scoreColor } from '../utils';

interface CentralNodeProps {
    scoreGeral: number;
    userProfile: { name: string; segment: string };
}

export function CentralNode({ scoreGeral, userProfile }: CentralNodeProps) {
    const color = scoreColor(scoreGeral);

    return (
        <div
            className="mindmap-node absolute flex flex-col items-center justify-center z-10"
            style={{ left: -70, top: -70, width: 140, height: 140 }}
        >
            {/* Glow */}
            <div className="absolute inset-0 rounded-full opacity-15 blur-2xl pointer-events-none" style={{ backgroundColor: color }} />

            {/* Score ring */}
            <div className="relative w-[110px] h-[110px] mt-1">
                <svg viewBox="0 0 110 110" className="absolute inset-0 rounded-full" style={{ backgroundColor: '#0a0a0c' }}>
                    <circle cx="55" cy="55" r="49" fill="#0a0a0c" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
                    <circle
                        cx="55" cy="55" r="49"
                        fill="none"
                        stroke={color}
                        strokeWidth="5"
                        strokeLinecap="round"
                        strokeDasharray={`${(scoreGeral / 100) * 307.9} 307.9`}
                        transform="rotate(-90 55 55)"
                        className="transition-all duration-1000"
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold" style={{ color }}>
                        {scoreGeral}
                    </span>
                    <span className="text-[7px] text-zinc-500 uppercase tracking-widest">Score</span>
                </div>
            </div>

            {/* Business info */}
            <div className="absolute top-[150px] flex flex-col items-center w-[200px]">
                <p className="text-[12px] font-extrabold text-white truncate w-full text-center" style={{ lineHeight: '1.2' }}>{userProfile.name}</p>
                <p className="text-[10px] text-zinc-400 truncate w-full text-center mt-1">{userProfile.segment}</p>
            </div>
        </div>
    );
}
