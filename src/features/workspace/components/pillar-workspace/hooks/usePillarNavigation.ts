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
    handleAutoExecute: (pillarKey: string, task: TaskItem) => void;
}

export function usePillarNavigation({
    analysisId,
    businessId,
    profile,
    apiCall,
    pillarStates,
    taskSubtasks,
    completedTasks,
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
        if (businessId) {
            router.push(`/analysis/${businessId}/${key}`);
        }
        setSelectedPillar(key);
        setExpandedTaskIds(new Set());
        setError('');
        if (pillarStates[key]?.plan) return;

        setLoadingPillar(key);
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
                        plan: { plan_data: tasksResult.data.plan_data, status: 'loaded' },
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

            const result = await apiCall('specialist-tasks', {
                analysis_id: analysisId, pillar_key: key,
                business_id: businessId, profile: profile?.profile || profile,
            });

            if (result.success && result.plan) {
                setPillarStates(prev => ({
                    ...prev,
                    [key]: {
                        success: true, pillar_key: key,
                        plan: { plan_data: result.plan, status: 'generated' },
                        results: [], kpis: [],
                        dependencies: result.plan.dependencies || { ready: true, blockers: [], warnings: [] },
                        progress: { total: result.plan.tarefas?.length || 0, completed: 0 },
                    },
                }));
            } else {
                console.error(`Pillar ${key} load failed:`, result.error);
                setError(result.error || 'Erro ao carregar o pilar');
            }
        } catch (err: any) {
            console.error(`Pillar ${key} communication error:`, err);
            setError(err.message || 'Erro de comunicação');
        } finally {
            setLoadingPillar(null);
        }
    }, [pillarStates, analysisId, businessId, profile, apiCall, router, hydratePillarData]);

    // ─── Redo entire pillar ───
    const handleRedoPillar = useCallback(async (pillarKey: string) => {
        if (!confirm('Tem certeza? Isso apagará todas as tarefas geradas e executadas deste pilar.')) return;

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

        try {
            await apiCall('redo-pillar', {
                analysis_id: analysisId,
                pillar_key: pillarKey,
            }, { skipCache: true });

            const result = await apiCall('specialist-tasks', {
                analysis_id: analysisId, pillar_key: pillarKey,
                business_id: businessId, profile: profile?.profile || profile,
            }, { skipCache: true });

            if (result.success && result.plan) {
                setPillarStates(prev => ({
                    ...prev,
                    [pillarKey]: {
                        success: true, pillar_key: pillarKey,
                        plan: { plan_data: result.plan, status: 'generated' },
                        results: [], kpis: [],
                        dependencies: result.plan.dependencies || { ready: true, blockers: [], warnings: [] },
                        progress: { total: result.plan.tarefas?.length || 0, completed: 0 },
                    },
                }));
            } else {
                setError(result.error || 'Erro ao recriar tarefas do pilar');
                setSelectedPillar(null);
            }

        } catch (err: any) {
            console.error('Failed to redo pillar:', err);
            setError('Failed to redo pillar data');
            setSelectedPillar(null);
        } finally {
            setLoadingPillar(null);
        }
    }, [analysisId, businessId, profile, apiCall, focusedTaskId, autoExecuting, executingTask]);

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
                            handleAutoExecute(selectedPillar, task);
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
