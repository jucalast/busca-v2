'use client';

import React, { useCallback, useRef } from 'react';

const CACHE_DURATION = 300000; // 5 minutes

export function usePillarApi(selectedTaskAiModel: string, currentAiModel: string, onModelFallback?: (from: string, to: string) => void) {
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

        // ── Detect Model Fallback (Nested Search) ──
        const findModelMetadata = (obj: any): { actual?: string; provider?: string } | null => {
            if (!obj || typeof obj !== 'object') return null;
            if (obj._actual_provider || obj._actual_model) {
                return { actual: obj._actual_model, provider: obj._actual_provider };
            }
            // Check common nested structures
            const nested = obj.execution || obj.subtasks || obj.progress?.result_data || obj.result_data;
            if (nested) return findModelMetadata(nested);

            // Special case: list of subtasks in progress
            const subResults = obj.progress?.subtask_results || obj.subtask_results;
            if (Array.isArray(subResults)) {
                for (const sub of subResults) {
                    const found = findModelMetadata(sub.result_data || sub);
                    if (found) return found;
                }
            }
            return null;
        };

        const metadata = findModelMetadata(result);
        if (metadata && onModelFallback) {
            const requested = selectedTaskAiModel || currentAiModel;
            const actual = metadata.provider || metadata.actual;

            if (actual) {
                if (requested.toLowerCase() !== actual.toLowerCase()) {
                    console.warn(`🔄 Backend switched model from ${requested} to ${actual}`);
                    onModelFallback(requested, actual);
                }
            }
        }

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
    }, [selectedTaskAiModel, currentAiModel, onModelFallback]);

    return { apiCall, clearCache };
}
