import React from 'react';
import { AlertTriangle } from 'lucide-react';

export function DepBadge({ dep }: { dep: { label: string; score: number; pillar: string } }) {
    const isCritical = dep.score < 25;
    return (
        <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${isCritical
            ? 'bg-red-500/10 text-red-400'
            : 'bg-amber-500/10 text-amber-400'
            }`}>
            <AlertTriangle className="w-2.5 h-2.5" />
            {dep.label} {dep.score}/100
        </span>
    );
}
