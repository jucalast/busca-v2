'use client';

import React, { useEffect, useState } from 'react';

interface UsageData {
    daily: {
        requests: number;
        limit_requests: number;
        tokens: number;
        limit_tokens: number;
        percent_requests: number;
    };
    minute: {
        requests: number;
        limit_requests: number;
        tokens: number;
        limit_tokens: number;
    };
    status: string;
    error?: string;
}

export default function LLMUsageIndicator({ provider }: { provider: string }) {
    const [usage, setUsage] = useState<UsageData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUsage = async () => {
            try {
                const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
                const res = await fetch(`${baseUrl}/api/v1/growth/usage-metrics`);
                const data = await res.json();
                if (data.success && data.usage) {
                    setUsage(data.usage[provider.toLowerCase()] || null);
                }
            } catch (err) {
                // Silently fail
            } finally {
                setLoading(false);
            }
        };

        fetchUsage();
        const interval = setInterval(fetchUsage, 30000); // 30s (Otimizado: era 3s)
        return () => clearInterval(interval);
    }, [provider]);

    if (loading || !usage || usage.error) return null;

    const { daily, status } = usage;
    const isBlocked = status === 'blocked';
    const fmt = (n: number) => n > 1000 ? (n / 1000).toFixed(1) + 'k' : n;

    const getStatusColor = () => {
        if (isBlocked) return 'var(--color-destructive)';
        if (status === 'warning') return 'var(--color-warning)';
        return 'var(--color-text-secondary)';
    };

    return (
        <div className="flex items-center gap-1 px-1 py-0.5 rounded" title={isBlocked ? "Limite atingido (Requisições ou Tokens)" : "Uso de cota LLM"}>
            <span className="text-[11px] font-medium whitespace-nowrap" style={{ color: getStatusColor(), opacity: status === 'ok' ? 0.8 : 1 }}>
                {daily.requests}/{fmt(daily.limit_requests)} req
                {daily.limit_tokens > 0 && daily.tokens > 0 && ` • ${fmt(daily.tokens)}/${fmt(daily.limit_tokens)} tk`}
            </span>
        </div>
    );
}
