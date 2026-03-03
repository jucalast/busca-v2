'use client';

import React, { useCallback, useRef } from 'react';

const CACHE_DURATION = 300000; // 5 minutes

export function usePillarApi(selectedTaskAiModel: string, currentAiModel: string) {
    const apiCache = useRef<Map<string, { data: any; timestamp: number }>>(new Map());

    const clearCache = useCallback(() => {
        apiCache.current.clear();
        console.log('🗑️ Cache cleared');
    }, []);

    const apiCall = useCallback(async (action: string, data: any, options?: { signal?: AbortSignal; skipCache?: boolean }) => {
        const cacheKey = `${action}-${JSON.stringify(data)}`;
        const cached = apiCache.current.get(cacheKey);

        if (!options?.skipCache && cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            console.log('📦 Using cached API response for:', action);
            return cached.data;
        }

        console.log('🌐 Making fresh API call for:', action, 'with model:', selectedTaskAiModel);
        const requestBody = { action, ...data, aiModel: selectedTaskAiModel || currentAiModel };
        const res = await fetch('/api/growth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: options?.signal,
        });

        const result = await res.json();

        if (!options?.skipCache && res.ok) {
            apiCache.current.set(cacheKey, { data: result, timestamp: Date.now() });

            if (apiCache.current.size > 50) {
                const now = Date.now();
                for (const [key, value] of apiCache.current.entries()) {
                    if (now - value.timestamp > CACHE_DURATION * 2) {
                        apiCache.current.delete(key);
                    }
                }
            }
        }

        return result;
    }, [selectedTaskAiModel, currentAiModel]);

    return { apiCall, clearCache };
}
