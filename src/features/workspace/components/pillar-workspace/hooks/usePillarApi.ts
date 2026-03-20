'use client';

import React, { useCallback } from 'react';

const CACHE_DURATION = 300000; // 5 minutes

// ─── Module-level cache to persist across re-mounts ───
const globalApiCache = new Map<string, { data: any; timestamp: number }>();
const pendingRequests = new Map<string, Promise<any>>();

export function usePillarApi(selectedTaskAiModel: string, currentAiModel: string, onModelFallback?: (from: string, to: string) => void) {
    
    const clearCache = useCallback(() => {
        globalApiCache.clear();
        pendingRequests.clear();
        console.log('🗑️ Global API cache cleared');
    }, []);

    const apiCall = useCallback(async (action: string, data: any, options?: { signal?: AbortSignal; skipCache?: boolean }) => {
        const cacheKey = `${action}-${JSON.stringify(data)}`;
        
        // 1. Check if we already have a cached result
        const cached = globalApiCache.get(cacheKey);
        if (!options?.skipCache && cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            console.log('📦 Using cached API response for:', action);
            return cached.data;
        }

        // 2. Check if there is already a pending request for the same key
        if (!options?.skipCache && pendingRequests.has(cacheKey)) {
            console.log('⏳ Reusing pending request for:', action);
            return pendingRequests.get(cacheKey);
        }

        // 3. Perform the fresh call
        const performCall = async () => {
            try {
                console.log('🌐 Making fresh API call for:', action, 'with model:', selectedTaskAiModel);
                const requestBody = { action, ...data, aiModel: selectedTaskAiModel || currentAiModel };
                let res;
                let retryCount = 0;
                const MAX_RETRIES = 2;

                while (retryCount <= MAX_RETRIES) {
                    try {
                        res = await fetch('/api/growth', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(requestBody),
                            signal: options?.signal,
                        });
                        break; // Success, exit while
                    } catch (fetchErr: any) {
                        if (fetchErr.name === 'AbortError') throw fetchErr;
                        retryCount++;
                        if (retryCount > MAX_RETRIES) {
                            console.error('Final API fetch failure after retries:', fetchErr);
                            throw fetchErr;
                        }
                        console.warn(`⚠️ API fetch failed, retrying (${retryCount}/${MAX_RETRIES})...`, fetchErr.message);
                        await new Promise(r => setTimeout(r, 1000 * retryCount)); // Exponential backoff
                    }
                }

                if (!res || !res.ok) {
                    const error = res ? await res.json().catch(() => ({ error: `HTTP error! status: ${res.status}` })) : { error: 'Unknown fetch error' };
                    throw new Error(error.error || `HTTP error! status: ${res?.status}`);
                }

                const result = await res.json();

                // ── Detect Model Fallback (Nested Search) ──
                const findModelMetadata = (obj: any): { actual?: string; provider?: string } | null => {
                    if (!obj || typeof obj !== 'object') return null;
                    if (obj._actual_provider || obj._actual_model) {
                        return { actual: obj._actual_model, provider: obj._actual_provider };
                    }
                    const nested = obj.execution || obj.subtasks || obj.progress?.result_data || obj.result_data;
                    if (nested) return findModelMetadata(nested);
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
                    if (actual && requested.toLowerCase() !== actual.toLowerCase()) {
                        console.warn(`🔄 Backend switched model from ${requested} to ${actual}`);
                        onModelFallback(requested, actual);
                    }
                }

                if (!options?.skipCache) {
                    globalApiCache.set(cacheKey, { data: result, timestamp: Date.now() });
                    // Cleanup old cache entries if it gets too big
                    if (globalApiCache.size > 100) {
                        const now = Date.now();
                        for (const [key, value] of globalApiCache.entries()) {
                            if (now - value.timestamp > CACHE_DURATION * 2) globalApiCache.delete(key);
                        }
                    }
                }

                return result;
            } finally {
                // Remove from pending map once finished
                pendingRequests.delete(cacheKey);
            }
        };

        const requestPromise = performCall();
        if (!options?.skipCache) {
            pendingRequests.set(cacheKey, requestPromise);
        }

        return requestPromise;
    }, [selectedTaskAiModel, currentAiModel, onModelFallback]);

    return { apiCall, clearCache };
}
