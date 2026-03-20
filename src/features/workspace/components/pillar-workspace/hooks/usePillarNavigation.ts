'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { TaskItem } from '../types';

interface UsePillarNavigationProps {
    analysisId: string | null;
    businessId: string | null;
    profile: any;
    apiCall: (action: string, data: any, options?: { signal?: AbortSignal; skipCache?: boolean }) => Promise<any>;
    pillarStates: Record<string, any>;
    taskSubtasks: Record<string, any>;
    completedTasks: Record<string, Set<string>>;
    specialists: Record<string, any>;
    selectedPillar: string | null;
    autoExecuting: string | null;
    focusedTaskId: string | null;
    executingTask: string | null;
    isStorageLoaded: boolean;
    initialActivePillar?: string | null;
    setPillarStates: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    setSelectedPillar: React.Dispatch<React.SetStateAction<string | null>>;
    setLoadingPillar: React.Dispatch<React.SetStateAction<string | null>>;
    setExpandedTaskIds: React.Dispatch<React.SetStateAction<Set<string>>>;
    setError: React.Dispatch<React.SetStateAction<string>>;
    setTaskSubtasks: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    setAutoExecSubtasks: React.Dispatch<React.SetStateAction<Record<string, any[]>>>;
    setAutoExecResults: React.Dispatch<React.SetStateAction<Record<string, Record<number, any>>>>;
    setAutoExecStatuses: React.Dispatch<React.SetStateAction<Record<string, Record<number, 'waiting' | 'running' | 'done' | 'error'>>>>;
    setTaskDeliverables: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    setCompletedTasks: React.Dispatch<React.SetStateAction<Record<string, Set<string>>>>;
    setFocusedTaskId: React.Dispatch<React.SetStateAction<string | null>>;
    setAutoExecuting: React.Dispatch<React.SetStateAction<string | null>>;
    setAutoExecStep: React.Dispatch<React.SetStateAction<number>>;
    setAutoExecTotal: React.Dispatch<React.SetStateAction<number>>;
    setAutoExecLog: React.Dispatch<React.SetStateAction<string[]>>;
    setTaskDeliverablesClear: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    setTaskSubtasksClear: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    setCompletedTasksClear: React.Dispatch<React.SetStateAction<Record<string, Set<string>>>>;
    setExpandedTaskIdsClear: React.Dispatch<React.SetStateAction<Set<string>>>;
    handleAutoExecute: (pillarKey: string, task: TaskItem, skipTrigger?: boolean) => void;
    setGeneratingPillar: React.Dispatch<React.SetStateAction<string | null>>;
    setGenerationResults: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    setGenerationSubtasks: React.Dispatch<React.SetStateAction<Record<string, any[]>>>;
    setGenerationStatuses: React.Dispatch<React.SetStateAction<Record<string, Record<number, 'waiting' | 'running' | 'done' | 'error'>>>>;
    setIsPillarExecuting: React.Dispatch<React.SetStateAction<boolean>>;
}

export function usePillarNavigation({
    analysisId,
    businessId,
    profile,
    apiCall,
    pillarStates,
    taskSubtasks,
    completedTasks,
    specialists,
    selectedPillar,
    autoExecuting,
    focusedTaskId,
    executingTask,
    isStorageLoaded,
    initialActivePillar,
    setPillarStates,
    setSelectedPillar,
    setLoadingPillar,
    setExpandedTaskIds,
    setError,
    setTaskSubtasks,
    setAutoExecSubtasks,
    setAutoExecResults,
    setAutoExecStatuses,
    setTaskDeliverables,
    setCompletedTasks,
    setFocusedTaskId,
    setAutoExecuting,
    setAutoExecStep,
    setAutoExecTotal,
    setAutoExecLog,
    handleAutoExecute,
    setGeneratingPillar,
    setGenerationResults,
    setGenerationSubtasks,
    setGenerationStatuses,
    setIsPillarExecuting,
}: UsePillarNavigationProps) {
    const router = useRouter();

    // ─── Hydrate subtasks and executions from DB ───
    const hydratePillarData = useCallback(async (key: string) => {
        if (pillarStates[key]?.plan && Object.keys(taskSubtasks).some(tid => tid.startsWith(key + '_'))) {
            console.log(`⏩ Skipping hydration for ${key}, already has data.`);
            return;
        }

        try {
            const [subtasksRes, execsRes] = await Promise.all([
                apiCall('get-subtasks', { analysis_id: analysisId, pillar_key: key }),
                apiCall('get-pillar-executions', { analysis_id: analysisId, pillar_key: key }),
            ]);

            if (subtasksRes.success && subtasksRes.subtasks) {
                const savedSubtasks = subtasksRes.subtasks as Record<string, any>;
                for (const [taskId, stData] of Object.entries(savedSubtasks)) {
                    const tid = taskId.includes('_') ? taskId : `${key}_${taskId}`;
                    setTaskSubtasks(prev => ({ ...prev, [tid]: stData }));
                    const items = (stData as any)?.subtarefas || [];
                    if (items.length > 0) {
                        setAutoExecSubtasks(prev => ({ ...prev, [tid]: items }));
                    }
                }
                console.log(`📦 Hydrated ${Object.keys(savedSubtasks).length} subtask groups for ${key}`);
            }

            if (execsRes.success && execsRes.executions) {
                const savedExecs = execsRes.executions as Record<string, any>;

                for (const [taskId, execData] of Object.entries(savedExecs)) {
                    const result = (execData as any).result_data;
                    if (!result) continue;

                    const stMatch = taskId.match(/_st(\d+)$/);

                    if (stMatch) {
                        const rawParentTaskId = taskId.replace(/_st\d+$/, '');
                        const parentTid = `${key}_${rawParentTaskId}`;
                        const idx = parseInt(stMatch[1], 10) - 1;

                        setAutoExecResults(prev => ({
                            ...prev,
                            [parentTid]: { ...(prev[parentTid] || {}), [idx]: result }
                        }));
                        setAutoExecStatuses(prev => ({
                            ...prev,
                            [parentTid]: { ...(prev[parentTid] || {}), [idx]: 'done' as const }
                        }));
                    } else if (!taskId.endsWith('_finalization')) {
                        const tid = `${key}_${taskId}`;
                        setTaskDeliverables(prev => ({ ...prev, [tid]: result }));
                        setCompletedTasks(prev => {
                            const s = new Set(prev[key] || []);
                            s.add(taskId);
                            s.add(tid);
                            return { ...prev, [key]: s };
                        });
                    }
                }

                console.log(`📦 Hydrated ${Object.keys(savedExecs).length} executions for ${key}`);
            }
        } catch (err) {
            console.warn('Failed to hydrate pillar data:', err);
        }
    }, [analysisId, apiCall, setTaskSubtasks, setAutoExecSubtasks, setTaskDeliverables, setCompletedTasks, setAutoExecResults, setAutoExecStatuses]);

    // ─── Select pillar ───
    const handleSelectPillar = useCallback(async (key: string) => {
        if (!key || !analysisId) {
            if (!analysisId) console.debug(`[usePillarNavigation] handleSelectPillar aborted: analysisId is missing`);
            return;
        }

        const targetPath = `/analysis/${businessId}/${key}`;
        if (businessId && typeof window !== 'undefined' && window.location.pathname !== targetPath) {
            console.log(`[usePillarNavigation] Navigating to ${targetPath}`);
            router.push(targetPath);
        }

        setSelectedPillar(key);
        setExpandedTaskIds(new Set());
        setError('');
        const existingPillar = pillarStates[key]?.plan || specialists[key]?.plan;
        if (existingPillar) {
            if (!pillarStates[key]?.plan) {
                console.log(`⚡ [PillarNav] Populating pillarStates[${key}] from specialists prop`);
                setPillarStates(prev => ({ 
                    ...prev, 
                    [key]: specialists[key] 
                }));
                hydratePillarData(key);
            }
            return;
        }

        setLoadingPillar(key);
        setGeneratingPillar(key);
        setIsPillarExecuting(true);
        // Reset generation state for this pillar
        setGenerationSubtasks(prev => ({ ...prev, [key]: [] }));
        setGenerationStatuses(prev => ({ ...prev, [key]: {} }));
        setGenerationResults(prev => ({ ...prev, [key]: {} }));
        try {
            const stateResult = await apiCall('pillar-state', { analysis_id: analysisId, pillar_key: key });
            if (stateResult.success && stateResult.plan?.plan_data) {
                setPillarStates(prev => ({ ...prev, [key]: stateResult }));
                hydratePillarData(key);
                setLoadingPillar(null);
                return;
            }

            const tasksResult = await apiCall('get-analysis-tasks', {
                analysis_id: analysisId,
                pillar_key: key
            });

            if (tasksResult.success && tasksResult.data && tasksResult.data.plan_data) {
                setPillarStates(prev => ({
                    ...prev,
                    [key]: {
                        success: true,
                        pillar_key: key,
                        plan: { 
                            plan_data: tasksResult.data.plan_data, 
                            full_thought_log: tasksResult.data.full_thought_log,
                            full_thought_subtasks: tasksResult.data.full_thought_subtasks,
                            analysis_opinions: tasksResult.data.analysis_opinions,
                            status: 'loaded' 
                        },
                        results: tasksResult.data.results || [],
                        kpis: tasksResult.data.kpis || [],
                        dependencies: tasksResult.data.dependencies || { ready: true, blockers: [], warnings: [] },
                        progress: tasksResult.data.progress || { total: tasksResult.data.plan_data?.tarefas?.length || 0, completed: 0 },
                    },
                }));
                hydratePillarData(key);
                setLoadingPillar(null);
                return;
            }

            // ─── STREAMING SPECIALIST TASKS ───
            const response = await fetch('/api/growth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'specialist-tasks',
                    analysis_id: analysisId, 
                    pillar_key: key,
                    business_id: businessId, 
                    profile: profile?.profile || profile,
                    force_refresh: true, // Força a regeneração completa em cada clique
                }),
            });

            if (!response.ok || !response.body) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `Erro HTTP! status: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let finalResult = null;
            let buffer = '';

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const parts = buffer.split('\n\n');
                    buffer = parts.pop() ?? '';

                    for (const part of parts) {
                        const line = part.trim();
                        if (!line.startsWith('data: ')) continue;

                        try {
                            const data = JSON.parse(line.substring(6));
                            
                            // ── thought: cria nova subtarefa ──
                            if (data.type === 'thought') {
                                setGenerationSubtasks(prev => {
                                    const existing = prev[key] || [];
                                    return { ...prev, [key]: [...existing, { titulo: data.text }] };
                                });
                                setGenerationStatuses(prev => {
                                    const existing = { ...(prev[key] || {}) };
                                    // Marca a anterior como done
                                    const count = Object.keys(existing).length;
                                    if (count > 0) existing[count - 1] = 'done';
                                    existing[count] = 'running';
                                    return { ...prev, [key]: existing };
                                });
                                // Cria slot no results para acumular tools
                                setGenerationResults(prev => {
                                    const existing = prev[key] || {};
                                    const slots = Object.keys(existing).filter(k => k !== '_idx').length;
                                    const idx = slots; // Cada novo pensamento ganha seu próprio slot
                                    const cur = existing[idx] || {};
                                    return { 
                                        ...prev, 
                                        [key]: { 
                                            ...existing, 
                                            [idx]: { 
                                                ...cur,
                                                opiniao: data.opiniao || cur.opiniao || '', 
                                                _tokens: (cur._tokens || 0) + (data._tokens || 0) 
                                            } 
                                        } 
                                    };
                                });
                            }

                            // ── tool: adiciona ao slot atual ──
                            if (data.type === 'tool') {
                                setGenerationResults(prev => {
                                    const existing = prev[key] || {};
                                    const slots = Object.keys(existing).filter(k => k !== '_idx').length;
                                    const idx = slots > 0 ? slots - 1 : 0; // Ferramenta usa o slot atual
                                    const cur = existing[idx] || {};
                                    const tools = [...(cur.intelligence_tools_used || [])];
                                    const ei = tools.findIndex((t: any) => t.tool === data.tool);
                                    if (ei >= 0) tools[ei] = data; else tools.push(data);
                                    return { ...prev, [key]: { ...existing, [idx]: { ...cur, intelligence_tools_used: tools } } };
                                });
                            }

                            // ── step_result: fontes normalizadas no slot atual ──
                            if (data.type === 'step_result' && data.sources != null) {
                                const normalizedSrcs: string[] = (data.sources as any[]).map((s: any) =>
                                    typeof s === 'string' ? s : (s?.url || s?.link || '')
                                ).filter(Boolean);

                                setGenerationResults(prev => {
                                    const existing = prev[key] || {};
                                    const slots = Object.keys(existing).filter(k => k !== '_idx').length;
                                    const idx = slots > 0 ? slots - 1 : 0; // Resultado finaliza o slot atual
                                    const cur = existing[idx] || {};
                                    return {
                                        ...prev,
                                        [key]: {
                                            ...existing,
                                            [idx]: { 
                                                ...cur, 
                                                opiniao: data.opiniao || cur.opiniao || '', 
                                                sources: normalizedSrcs,
                                                _tokens: (cur._tokens || 0) + (data._tokens || 0)
                                            }
                                        }
                                    };
                                });
                                // Marca subtask atual como done e avança
                                setGenerationSubtasks(prev => {
                                    const existing = prev[key] || [];
                                    if (existing.length === 0) return prev;
                                    const updated = [...existing];
                                    updated[updated.length - 1] = { ...updated[updated.length - 1], status: 'done' };
                                    return { ...prev, [key]: updated };
                                });
                                setGenerationStatuses(prev => {
                                    const existing = { ...(prev[key] || {}) };
                                    const count = Object.keys(existing).length;
                                    if (count > 0) existing[count - 1] = 'done';
                                    return { ...prev, [key]: existing };
                                });
                            }

                            if (data.type === 'result') {
                                finalResult = data.data;
                            }

                            if (data.type === 'error') {
                                throw new Error(data.message);
                            }
                        } catch (e: any) {
                            console.error("Error parsing stream line:", e);
                            if (e.message.includes('Error: ')) throw e;
                        }
                    }
                }
            }

            if (finalResult && finalResult.success && finalResult.plan) {
                setPillarStates(prev => ({
                    ...prev,
                    [key]: {
                        success: true, 
                        pillar_key: key,
                        plan: { plan_data: finalResult.plan, status: 'generated' },
                        results: [], 
                        kpis: [],
                        dependencies: finalResult.plan.dependencies || { ready: true, blockers: [], warnings: [] },
                        progress: { total: finalResult.plan.tarefas?.length || 0, completed: 0 },
                    },
                }));
                
                // Finaliza a EXECUÇÃO técnica, mas MANTÉM o generatingPillar ativo
                // para que o botão "Ir para o Pilar" apareça via AnalysisExecutionLoader
                setIsPillarExecuting(false);
            } else {
                console.error(`Pillar ${key} load failed: No plan returned`);
                setError('Erro ao gerar o plano do pilar');
            }
        } catch (err: any) {
            console.error(`Pillar ${key} communication error:`, err);
            setError(err.message || 'Erro de comunicação');
        } finally {
            setLoadingPillar(null);
        }
    }, [pillarStates, analysisId, businessId, profile, apiCall, router, hydratePillarData, setGeneratingPillar, setGenerationResults, setIsPillarExecuting]);

    // ─── Redo entire pillar ───
    const handleRedoPillar = useCallback(async (pillarKey: string) => {
        setTaskDeliverables(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(k => { if (k.startsWith(pillarKey + '_')) delete next[k]; });
            return next;
        });
        setTaskSubtasks(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(k => { if (k.startsWith(pillarKey + '_')) delete next[k]; });
            return next;
        });
        setCompletedTasks(prev => {
            const next = { ...prev };
            delete next[pillarKey];
            return next;
        });
        setPillarStates(prev => {
            const next = { ...prev };
            delete next[pillarKey];
            return next;
        });
        setAutoExecSubtasks(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(k => { if (k.startsWith(pillarKey + '_')) delete next[k]; });
            return next;
        });
        setAutoExecResults(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(k => { if (k.startsWith(pillarKey + '_')) delete next[k]; });
            return next;
        });
        setAutoExecStatuses(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(k => { if (k.startsWith(pillarKey + '_')) delete next[k]; });
            return next;
        });
        setExpandedTaskIds(prev => {
            const next = new Set(prev);
            prev.forEach(k => { if (k.startsWith(pillarKey + '_')) next.delete(k); });
            return next;
        });
        if (focusedTaskId?.startsWith(pillarKey + '_')) {
            setFocusedTaskId(null);
        }
        if (autoExecuting?.startsWith(pillarKey + '_')) {
            setAutoExecuting(null);
        }
        if (executingTask?.startsWith(pillarKey + '_')) {
            // executingTask is managed by parent
        }

        setError('');
        setLoadingPillar(pillarKey);
        setGeneratingPillar(pillarKey);
        setIsPillarExecuting(true);
        // Reset generation state for this pillar
        setGenerationSubtasks(prev => ({ ...prev, [pillarKey]: [] }));
        setGenerationStatuses(prev => ({ ...prev, [pillarKey]: {} }));
        setGenerationResults(prev => ({ ...prev, [pillarKey]: {} }));

        try {
            await apiCall('redo-pillar', {
                analysis_id: analysisId,
                pillar_key: pillarKey,
            }, { skipCache: true });

            // ─── STREAMING SPECIALIST TASKS ───
            const response = await fetch('/api/growth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'specialist-tasks',
                        analysis_id: analysisId,
                        pillar_key: pillarKey,
                        business_id: businessId,
                        profile: profile?.profile || profile,
                        force_refresh: true, // Força a regeneração completa para testes
                    }),
            });

            if (!response.ok || !response.body) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `Erro HTTP! status: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let finalResult = null;
            let buffer = '';

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const parts = buffer.split('\n\n');
                    buffer = parts.pop() ?? '';

                    for (const part of parts) {
                        const line = part.trim();
                        if (!line.startsWith('data: ')) continue;

                        try {
                            const data = JSON.parse(line.substring(6));
                            
                            // ── thought: nova subtarefa ──
                            if (data.type === 'thought') {
                                setGenerationSubtasks(prev => {
                                    const existing = prev[pillarKey] || [];
                                    return { ...prev, [pillarKey]: [...existing, { titulo: data.text }] };
                                });
                                setGenerationStatuses(prev => {
                                    const existing = { ...(prev[pillarKey] || {}) };
                                    const count = Object.keys(existing).length;
                                    if (count > 0) existing[count - 1] = 'done';
                                    existing[count] = 'running';
                                    return { ...prev, [pillarKey]: existing };
                                });
                                setGenerationResults(prev => {
                                    const existing = prev[pillarKey] || {};
                                    const slots = Object.keys(existing).filter(k => k !== '_idx').length;
                                    const idx = slots; // Redo ganha slot incremental
                                    const cur = existing[idx] || {};
                                    return { 
                                        ...prev, 
                                        [pillarKey]: { 
                                            ...existing, 
                                            [idx]: { 
                                                ...cur,
                                                opiniao: data.opiniao || cur.opiniao || '', 
                                                _tokens: (cur._tokens || 0) + (data._tokens || 0) 
                                            } 
                                        } 
                                    };
                                });
                            }

                            // ── tool: slot atual ──
                            if (data.type === 'tool') {
                                setGenerationResults(prev => {
                                    const existing = prev[pillarKey] || {};
                                    const slots = Object.keys(existing).filter(k => k !== '_idx').length;
                                    const idx = slots > 0 ? slots - 1 : 0;
                                    const cur = existing[idx] || {};
                                    const tools = [...(cur.intelligence_tools_used || [])];
                                    const ei = tools.findIndex((t: any) => t.tool === data.tool);
                                    if (ei >= 0) tools[ei] = data; else tools.push(data);
                                    return { ...prev, [pillarKey]: { ...existing, [idx]: { ...cur, intelligence_tools_used: tools } } };
                                });
                            }

                            // ── step_result: fontes normalizadas ──
                            if (data.type === 'step_result' && data.sources != null) {
                                const normalizedSrcs: string[] = (data.sources as any[]).map((s: any) =>
                                    typeof s === 'string' ? s : (s?.url || s?.link || '')
                                ).filter(Boolean);

                                setGenerationResults(prev => {
                                    const existing = prev[pillarKey] || {};
                                    const slots = Object.keys(existing).filter(k => k !== '_idx').length;
                                    const idx = slots > 0 ? slots - 1 : 0;
                                    const cur = existing[idx] || {};
                                    return {
                                        ...prev,
                                        [pillarKey]: {
                                            ...existing,
                                            [idx]: { 
                                                ...cur, 
                                                opiniao: data.opiniao || cur.opiniao || '', 
                                                sources: normalizedSrcs,
                                                _tokens: (cur._tokens || 0) + (data._tokens || 0)
                                            }
                                        }
                                    };
                                });
                                setGenerationSubtasks(prev => {
                                    const existing = prev[pillarKey] || [];
                                    if (existing.length === 0) return prev;
                                    const updated = [...existing];
                                    updated[updated.length - 1] = { ...updated[updated.length - 1], status: 'done' };
                                    return { ...prev, [pillarKey]: updated };
                                });
                                setGenerationStatuses(prev => {
                                    const existing = { ...(prev[pillarKey] || {}) };
                                    const count = Object.keys(existing).length;
                                    if (count > 0) existing[count - 1] = 'done';
                                    return { ...prev, [pillarKey]: existing };
                                });
                            }

                            if (data.type === 'result') {
                                finalResult = data.data;
                            }

                            if (data.type === 'error') {
                                throw new Error(data.message);
                            }
                        } catch (e: any) {
                            console.error("Error parsing stream line:", e);
                            if (e.message.includes('Error: ')) throw e;
                        }
                    }
                }
            }

            if (finalResult && finalResult.success && finalResult.plan) {
                setPillarStates(prev => ({
                    ...prev,
                    [pillarKey]: {
                        success: true, 
                        pillar_key: pillarKey,
                        plan: { 
                            plan_data: finalResult.plan, 
                            full_thought_log: finalResult.full_thought_log,
                            full_thought_subtasks: finalResult.full_thought_subtasks,
                            analysis_opinions: finalResult.analysis_opinions,
                            status: 'generated' 
                        },
                        results: [], 
                        kpis: [],
                        dependencies: finalResult.plan.dependencies || { ready: true, blockers: [], warnings: [] },
                        progress: { total: finalResult.plan.tarefas?.length || 0, completed: 0 },
                    },
                }));
                
                // Finaliza a EXECUÇÃO técnica, mas MANTÉM o generatingPillar ativo
                setIsPillarExecuting(false);
            } else {
                console.error(`Pillar ${pillarKey} redo failed: No plan returned`);
                setError('Erro ao regerar o plano do pilar');
            }

        } catch (err: any) {
            console.error('Failed to redo pillar:', err);
            setError('Failed to redo pillar data');
            setSelectedPillar(null);
        } finally {
            setLoadingPillar(null);
        }
    }, [analysisId, businessId, profile, apiCall, setGeneratingPillar, setGenerationResults, setTaskDeliverables, setTaskSubtasks, setCompletedTasks, setPillarStates, setAutoExecSubtasks, setAutoExecResults, setAutoExecStatuses, setExpandedTaskIds, setFocusedTaskId, setAutoExecuting, executingTask, setIsPillarExecuting]);

    // ─── Initial pillar activation ───
    const initialPillarRef = useRef<string | null>(null);

    useEffect(() => {
        if (isStorageLoaded && initialActivePillar && initialActivePillar !== initialPillarRef.current) {
            initialPillarRef.current = initialActivePillar;
            handleSelectPillar(initialActivePillar);
        }
    }, [isStorageLoaded, initialActivePillar, handleSelectPillar]);

    // Reset expanded tasks when leaving focus
    useEffect(() => {
        if (!focusedTaskId) {
            setExpandedTaskIds(prev => (prev.size > 0 ? new Set() : prev));
        }
    }, [focusedTaskId]);

    // ─── Background Task Recovery ───
    const hasCheckedRecovery = useRef<Record<string, boolean>>({});

    useEffect(() => {
        if (!analysisId || !selectedPillar || autoExecuting) return;

        const state = pillarStates[selectedPillar];
        if (!state?.plan) return;

        const tasks = state.plan.plan_data.tarefas || [];

        const checkRunningTasks = async () => {
            for (const task of tasks) {
                if (task.executavel_por_ia) {
                    const tid = `${selectedPillar}_${task.id}`;
                    const isTaskDone = completedTasks[selectedPillar]?.has(task.id) || completedTasks[selectedPillar]?.has(tid);
                    if (isTaskDone) continue;

                    try {
                        const pollResult = await apiCall('poll-background-status', {
                            analysis_id: analysisId,
                            task_id: task.id
                        }, { skipCache: true });

                        if (pollResult.success && pollResult.progress && pollResult.progress.status === 'running') {
                            console.log(`🔄 Re-mounting background task polling for: ${task.id}`);
                            handleAutoExecute(selectedPillar, task, true);
                            break;
                        }
                    } catch (err) {
                        console.error('Background recovery error:', err);
                    }
                }
            }
        };
        const pillarStateKey = `${analysisId}_${selectedPillar}`;
        if (!hasCheckedRecovery.current[pillarStateKey]) {
            hasCheckedRecovery.current[pillarStateKey] = true;
            checkRunningTasks();
        }
    }, [analysisId, selectedPillar, pillarStates, apiCall, handleAutoExecute]);

    return {
        handleSelectPillar,
        handleRedoPillar,
        hydratePillarData,
    };
}
