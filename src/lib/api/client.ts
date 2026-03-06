import { exec, spawn } from 'child_process';
import path from 'path';
import util from 'util';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';

const execPromise = util.promisify(exec);

type CacheRecord = {
    expiresAt: number;
    data: any;
};

const CACHEABLE_ACTIONS = new Set([
    'get-business',
    'list-businesses',
    'pillar-state',
    'all-pillars-state',
    'get-pillar-data',
    'get-analysis-tasks',
    'get-subtasks',
    'get-pillar-executions',
]);

const CACHE_INVALIDATING_ACTIONS = new Set([
    'save-analysis',
    'create-business',
    'delete-business',
    'analyze',
    'redo-pillar',
    'redo-task',
    'redo-subtasks',
    'specialist-tasks',
    'specialist-execute',
    'ai-try-user-task',
    'expand-subtasks',
    'run-pillar',
    'track-result',
]);

const DEFAULT_CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes
const CACHE_TTL_MS = Number(process.env.GROWTH_CACHE_TTL_MS || DEFAULT_CACHE_TTL_MS);

const orchestratorCache = new Map<string, CacheRecord>();

type RunOrchestratorOptions = {
    timeoutMs?: number;
    skipCache?: boolean;
};

function normalizeOptions(optionsOrTimeout?: number | RunOrchestratorOptions): RunOrchestratorOptions {
    if (typeof optionsOrTimeout === 'number') {
        return { timeoutMs: optionsOrTimeout };
    }
    return optionsOrTimeout || {};
}

function buildCacheKey(action: string, inputData: any): string | null {
    try {
        return `${action}:${JSON.stringify(inputData)}`;
    } catch (err) {
        console.warn('[Orchestrator] Failed to build cache key:', err);
        return null;
    }
}

function getCachedResult(action: string, inputData: any, skipCache: boolean) {
    if (skipCache || !CACHEABLE_ACTIONS.has(action)) return null;
    const key = buildCacheKey(action, inputData);
    if (!key) return null;
    const cached = orchestratorCache.get(key);
    if (!cached) return null;
    if (cached.expiresAt < Date.now()) {
        orchestratorCache.delete(key);
        return null;
    }
    return cached.data;
}

function saveCachedResult(action: string, inputData: any, result: any, skipCache: boolean) {
    if (skipCache || !CACHEABLE_ACTIONS.has(action)) return;
    const key = buildCacheKey(action, inputData);
    if (!key) return;
    orchestratorCache.set(key, {
        data: result,
        expiresAt: Date.now() + CACHE_TTL_MS,
    });
}

function invalidateCacheIfNeeded(action: string) {
    if (CACHE_INVALIDATING_ACTIONS.has(action)) {
        orchestratorCache.clear();
    }
}

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://127.0.0.1:8000';

/**
 * Write input JSON to a temp file so we don't hit Windows command-line limits.
 * Returns the temp file path.
 */
export function writeTempInput(data: any): string {
    const tmpDir = os.tmpdir();
    const fileName = `growth_${crypto.randomBytes(8).toString('hex')}.json`;
    const tmpPath = path.join(tmpDir, fileName);
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 0), 'utf-8');
    return tmpPath;
}

/**
 * Run the growth orchestrator with given action and input data.
 * Re-routed to the new FastAPI Backend.
 */
export async function runOrchestrator(
    action: string,
    inputData: any,
    optionsOrTimeout?: number | RunOrchestratorOptions,
    authToken?: string | null
): Promise<any> {
    const options = normalizeOptions(optionsOrTimeout);
    const timeoutMs = options.timeoutMs ?? 300000;
    const skipCache = options.skipCache ?? false;

    const cached = getCachedResult(action, inputData, skipCache);
    if (cached) {
        console.log(`[Growth Orchestrator Server] Cache hit: ${action}`);
        return cached;
    }

    const url = `${FASTAPI_URL}/api/v1/growth/${action}`;

    try {
        console.log(`[Growth Orchestrator Server] Fetching: ${action} via FastAPI (${url})`);

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }

        // Using standard fetch wrapper
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(inputData),
            // AbortController could be integrated here for timeouts
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`FastAPI responded with ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        invalidateCacheIfNeeded(action);
        saveCachedResult(action, inputData, result, skipCache);

        return result;

    } catch (error: any) {
        console.error(`[Growth Orchestrator Server Error on action ${action}]:`, error);
        throw error;
    }
}

export function runOrchestratorStreaming(inputData: any, timeoutMs: number = 480000, authToken?: string | null): ReadableStream {
    // This previously used child_process spawn + SSE emulation from Python.
    // For now we will adapt this to proxy an actual HTTP SSE stream from FastAPI.
    return new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();
            let controllerClosed = false;

            const send = (obj: object) => {
                if (!controllerClosed) {
                    try {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
                    } catch {
                        controllerClosed = true; /* stream closed */
                    }
                }
            };

            try {
                // The /analyze route must return a SSE response (text/event-stream)
                const url = `${process.env.FASTAPI_URL || 'http://127.0.0.1:8000'}/api/v1/growth/analyze`;
                console.log(`[Growth SSE] Fetching stream from ${url}`);

                const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                if (authToken) {
                    headers['Authorization'] = `Bearer ${authToken}`;
                }

                const response = await fetch(url, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(inputData),
                });

                if (!response.ok || !response.body) {
                    throw new Error(`FastAPI responded with ${response.status}`);
                }

                // Proxy the stream chunks
                const reader = response.body.getReader();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    if (!controllerClosed) {
                        try {
                            controller.enqueue(value);
                        } catch {
                            controllerClosed = true;
                            break;
                        }
                    } else {
                        break;
                    }
                }
                if (!controllerClosed) {
                    controllerClosed = true;
                    controller.close();
                }
            } catch (error: any) {
                console.error('[Growth SSE Proxy Error]', error);
                send({ type: 'error', message: error.message });
                if (!controllerClosed) {
                    controllerClosed = true;
                    try { controller.close(); } catch { /* ignore */ }
                }
            }
        },
    });
}
