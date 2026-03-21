'use client';

import React from 'react';
import { useSidebar } from '@/contexts/SidebarContext';

interface LoadingDotsProps {
    className?: string;
    dotClassName?: string;
    color?: string; // Optional custom color
}

export default function LoadingDots({ className = "flex items-center gap-1 px-3 py-2", dotClassName = "w-1.5 h-1.5", color }: LoadingDotsProps) {
    const { isDark } = useSidebar();
    
    // Default neutral gray colors, avoiding the 'bluish-gray' look
    const defaultColor = isDark ? '#71717a' : '#94a3b8';

    return (
        <div className={className}>
            {[0, 1, 2].map(i => (
                <span
                    key={i}
                    className={`rounded-full ${dotClassName}`}
                    style={{
                        backgroundColor: color || defaultColor,
                        opacity: 1,
                        animation: 'dot-pulse 1.2s ease-in-out infinite',
                        animationDelay: `${i * 0.2}s`
                    }}
                />
            ))}
        </div>
    );
}
