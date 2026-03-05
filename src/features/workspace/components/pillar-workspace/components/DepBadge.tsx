import React from 'react';
import { AlertTriangle } from 'lucide-react';

export function DepBadge({ dep }: { dep: { label: string; score: number; pillar: string } }) {
    const isCritical = dep.score < 25;
    return (
        <span
            className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full"
            style={{
                backgroundColor: isCritical ? 'var(--color-destructive-muted)' : 'var(--color-warning-muted)',
                color: isCritical ? 'var(--color-destructive)' : 'var(--color-warning)',
            }}
        >
            <AlertTriangle className="w-2.5 h-2.5" />
            {dep.label} {dep.score}/100
        </span>
    );
}
