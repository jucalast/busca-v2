import { useCallback } from 'react';
import { TaskItem } from './types';

// ─── Task Handlers ───
export const useTaskHandlers = (
    analysisId: string,
    apiCall: (action: string, data: any, options?: { signal?: AbortSignal, skipCache?: boolean }) => Promise<any>,
    profile: any,
    taskSubtasks: Record<string, any>,
    autoExecResults: Record<string, Record<number, any>>,
    setTaskSubtasks: React.Dispatch<React.SetStateAction<Record<string, any>>>,
    setAutoExecuting: React.Dispatch<React.SetStateAction<string | null>>,
    setAutoExecStep: React.Dispatch<React.SetStateAction<number>>,
    setAutoExecTotal: React.Dispatch<React.SetStateAction<number>>,
    setAutoExecLog: React.Dispatch<React.SetStateAction<string[]>>,
    setAutoExecSubtasks: React.Dispatch<React.SetStateAction<Record<string, any[]>>>,
    setAutoExecResults: React.Dispatch<React.SetStateAction<Record<string, Record<number, any>>>>,
    setAutoExecStatuses: React.Dispatch<React.SetStateAction<Record<string, Record<number, 'waiting' | 'running' | 'done' | 'error'>>>>,
    setTaskDeliverables: React.Dispatch<React.SetStateAction<Record<string, any>>>,
    setCompletedTasks: React.Dispatch<React.SetStateAction<Record<string, Set<string>>>>,
    setSubtasksUpdateKey: React.Dispatch<React.SetStateAction<number>>,
    setError: React.Dispatch<React.SetStateAction<string>>,
    abortControllersRef: React.RefObject<Record<string, AbortController>>
) => {

    // ─── Expand Subtasks Handler ───
    const handleExpandSubtasks = useCallback(async (pillarKey: string, task: TaskItem) => {
        const tid = `${pillarKey}_${task.id}`;
        // Don't set autoExecuting for expansion, only for execution
        // setAutoExecuting(tid);
        setAutoExecStep(0);
        setAutoExecTotal(0);
        setAutoExecLog([]);
        setError('');

        const controller = new AbortController();
        abortControllersRef.current[tid] = controller;

        try {
            const result = await apiCall('expand-subtasks', {
                analysis_id: analysisId, pillar_key: pillarKey,
                task_data: task, profile: profile?.profile || profile,
            }, { skipCache: true, signal: controller.signal });
            if (result.success && result.subtasks) {
                setTaskSubtasks(prev => ({ ...prev, [tid]: result.subtasks }));
                // Force update of TaskSubtasksDisplay
                setSubtasksUpdateKey(prev => prev + 1);
            } else { setError(result.error || 'Erro ao expandir'); }
        } catch (err: any) {
            if (err.name === 'AbortError') setError('Ação cancelada pelo usuário.');
            else setError(err.message || 'Erro');
        } finally {
            if (abortControllersRef.current[tid]) delete abortControllersRef.current[tid];
            // Don't reset autoExecuting here since we didn't set it
            // setAutoExecuting(null);
        }
    }, [analysisId, profile, apiCall, setTaskSubtasks, setSubtasksUpdateKey, setAutoExecuting, setError, abortControllersRef]);

    // ─── Auto Execute Handler ───
    const handleAutoExecute = useCallback(async (pillarKey: string, task: TaskItem) => {
        const tid = `${pillarKey}_${task.id}`;

        // Cancel previous if any
        if (abortControllersRef.current[tid]) {
            abortControllersRef.current[tid].abort();
            delete abortControllersRef.current[tid];
        }

        const controller = new AbortController();
        abortControllersRef.current[tid] = controller;

        setAutoExecuting(tid);
        setAutoExecStep(0);
        setAutoExecTotal(0);
        setAutoExecLog([]);
        setError('');

        try {
            // Step 1: Ensure we have subtasks locally for the UI list
            let subtasks = taskSubtasks[tid]?.subtarefas;
            if (!subtasks) {
                const expandResult = await apiCall('expand-subtasks', {
                    analysis_id: analysisId, pillar_key: pillarKey,
                    task_data: task, profile: profile?.profile || profile,
                }, { skipCache: true });
                if (expandResult.success && expandResult.subtasks) {
                    subtasks = expandResult.subtasks.subtarefas;
                    setTaskSubtasks(prev => ({ ...prev, [tid]: expandResult.subtasks }));
                    setSubtasksUpdateKey(prev => prev + 1);
                }
            }

            if (subtasks) {
                setAutoExecSubtasks(prev => ({ ...prev, [tid]: subtasks }));
                setAutoExecTotal(subtasks.length + 1);
            }

            // Step 2: Trigger server-side background execution
            const startResult = await apiCall('execute-all-subtasks', {
                analysis_id: analysisId,
                pillar_key: pillarKey,
                task_id: task.id,
                task_data: task,
                profile: profile?.profile || profile,
            }, { skipCache: true });

            if (!startResult.success) {
                throw new Error(startResult.error || 'Falha ao iniciar execução');
            }

            // Step 3: Polling Loop
            const poll = async () => {
                try {
                    const statusRes = await apiCall('poll-background-status', {
                        analysis_id: analysisId,
                        task_id: task.id
                    }, { skipCache: true });

                    if (statusRes.success && statusRes.progress) {
                        const { status, current_step, total_steps, result_data, error_message, subtask_results } = statusRes.progress;

                        // Only update step if actually running or completed
                        if (status === 'running' || status === 'done' || status === 'completed' || status === 'error') {
                            setAutoExecStep(current_step);
                            setAutoExecTotal(total_steps);
                        }

                        // Update statuses for the list
                        if (subtasks) {
                            const newStatuses: Record<number, any> = {};
                            for (let i = 0; i < subtasks.length; i++) {
                                if (status === 'done' || status === 'completed') newStatuses[i] = 'done';
                                else if (i + 1 < current_step) newStatuses[i] = 'done';
                                else if (i + 1 === current_step && status === 'running') newStatuses[i] = 'running';
                                else if (i + 1 === current_step && status === 'error') newStatuses[i] = 'error';
                                else newStatuses[i] = 'waiting';
                            }
                            setAutoExecStatuses(prev => ({ ...prev, [tid]: newStatuses }));
                        }

                        // Update intermediate results
                        if (subtask_results) {
                            const resultsMap: Record<number, any> = {};
                            subtask_results.forEach((res: any) => {
                                const match = res.task_id.match(/_st(\d+)$/);
                                if (match) {
                                    const index = parseInt(match[1]) - 1;
                                    resultsMap[index] = res.result_data;
                                }
                            });
                            setAutoExecResults(prev => ({ ...prev, [tid]: resultsMap }));
                        }

                        if (status === 'done') {
                            if (result_data) {
                                setTaskDeliverables(prev => ({ ...prev, [tid]: result_data }));
                                setCompletedTasks(prev => {
                                    const s = new Set(prev[pillarKey] || []);
                                    s.add(task.id);
                                    s.add(tid);
                                    return { ...prev, [pillarKey]: s };
                                });
                            }
                            setAutoExecuting(null);
                            return true; // Stop polling
                        } else if (status === 'error' || status === 'cancelled') {
                            if (status === 'error') setError(error_message || 'Erro na execução');
                            setAutoExecuting(null);
                            return true; // Stop polling
                        }
                    } else if (statusRes && statusRes.success === false) {
                        // If task is not found (deleted) or similar explicit failure
                        setAutoExecuting(null);
                        return true;
                    }
                } catch (err) {
                    console.error('Polling error:', err);
                }

                // If it was stopped, abortControllersRef.current[tid] will be undefined
                if (!abortControllersRef.current[tid]) {
                    return true;
                }

                return false;
            };

            // Start first poll and then interval
            const finished = await poll();
            if (!finished) {
                const interval = setInterval(async () => {
                    const done = await poll();
                    if (done) clearInterval(interval);
                }, 3000);
            }

        } catch (err: any) {
            setError(err.message || 'Erro na execução automática');
            setAutoExecuting(null);
        }
    }, [analysisId, profile, apiCall, taskSubtasks, setTaskSubtasks, setSubtasksUpdateKey, setAutoExecuting, setAutoExecSubtasks, setAutoExecResults, setAutoExecStatuses, setTaskDeliverables, setCompletedTasks, setError]);

    // ─── Redo Task Handler ───
    const handleRedoTask = useCallback(async (pillarKey: string, tid: string, task: TaskItem) => {
        console.log('handleRedoTask triggered for:', tid);
        if (abortControllersRef.current[tid]) {
            abortControllersRef.current[tid].abort();
            delete abortControllersRef.current[tid];
        }

        // Clear frontend state
        setTaskDeliverables(prev => {
            const next = { ...prev };
            delete next[tid];
            return next;
        });
        setAutoExecResults(prev => {
            const next = { ...prev };
            delete next[tid];
            return next;
        });
        setAutoExecStatuses(prev => {
            const next = { ...prev };
            delete next[tid];
            return next;
        });
        setAutoExecSubtasks(prev => {
            const next = { ...prev };
            delete next[tid];
            return next;
        });
        setCompletedTasks(prev => {
            const next = { ...prev };
            const s = new Set(next[pillarKey] || []);
            s.delete(task.id);
            s.delete(tid);
            next[pillarKey] = s;
            return next;
        });
        setTaskSubtasks(prev => {
            const next = { ...prev };
            delete next[tid];
            return next;
        });

        // Force UI to clear old lines
        setSubtasksUpdateKey(prev => prev + 1);
        setAutoExecStep(0);
        setAutoExecTotal(0);

        // Clear backend data
        let success = true;
        try {
            console.log('Sending redo-task API request for', task.id);
            const apiResult = await apiCall('redo-task', {
                analysis_id: analysisId,
                pillar_key: pillarKey,
                task_id: task.id,
            }, { skipCache: true });
            console.log('API Result:', apiResult);
        } catch (err: any) {
            console.error('Failed to clear task data:', err);
            alert('Falha ao limpar os dados da tarefa: ' + err.message);
            setError('Failed to reset task data');
            success = false;
        }

        console.log('task.executavel_por_ia:', task.executavel_por_ia, 'success:', success);
    }, [analysisId, apiCall, setTaskDeliverables, setAutoExecResults, setAutoExecStatuses, setAutoExecSubtasks, setCompletedTasks, setTaskSubtasks, setError]);

    // ─── Redo Subtasks Handler ───
    const handleRedoSubtasks = useCallback(async (pillarKey: string, tid: string, task: TaskItem) => {
        if (abortControllersRef.current[tid]) {
            abortControllersRef.current[tid].abort();
            delete abortControllersRef.current[tid];
        }

        // Clear only subtasks from frontend
        setTaskSubtasks(prev => {
            const next = { ...prev };
            delete next[tid];
            return next;
        });
        setAutoExecResults(prev => {
            const next = { ...prev };
            delete next[tid];
            return next;
        });
        setAutoExecStatuses(prev => {
            const next = { ...prev };
            delete next[tid];
            return next;
        });
        setAutoExecSubtasks(prev => {
            const next = { ...prev };
            delete next[tid];
            return next;
        });
        setTaskDeliverables(prev => {
            const next = { ...prev };
            delete next[tid];
            return next;
        });
        setCompletedTasks(prev => {
            const next = { ...prev };
            if (next[pillarKey]) {
                const s = new Set(next[pillarKey]);
                s.delete(task.id);
                s.delete(tid);
                next[pillarKey] = s;
            }
            return next;
        });

        // Force re-render of TaskSubtasksDisplay
        setSubtasksUpdateKey(prev => prev + 1);

        // Clear subtasks from backend, then regenerate
        try {
            await apiCall('redo-subtasks', {
                analysis_id: analysisId,
                pillar_key: pillarKey,
                task_id: task.id,
            }, { skipCache: true });
            await handleExpandSubtasks(pillarKey, task);
        } catch (err: any) {
            console.error('Failed to clear subtasks data:', err);
            setError('Failed to reset subtasks data');
            return;
        }
    }, [analysisId, apiCall, handleExpandSubtasks, setTaskSubtasks, setAutoExecResults, setAutoExecStatuses, setAutoExecSubtasks, setSubtasksUpdateKey, setError]);

    // ─── Stop Execution Handler ───
    const handleStopExecution = useCallback(async (tid: string) => {
        if (abortControllersRef.current[tid]) {
            abortControllersRef.current[tid].abort();
            delete abortControllersRef.current[tid];
        }

        // Notify backend to cancel the task loop
        try {
            // tid format is usually `${selectedPillar}_${task.id}`
            const [pillar_key, ...rest] = tid.split('_');
            const task_id = rest.join('_');

            await apiCall('cancel-task', {
                analysis_id: analysisId,
                pillar_key: pillar_key,
                task_id: task_id,
            }, { skipCache: true });
        } catch (err) {
            console.error('Failed to notify backend of task cancellation:', err);
        }

        // Clear auto-execution state
        setAutoExecuting(null);
        setAutoExecStep(0);
        setAutoExecTotal(0);
        setAutoExecLog([]);

        // Remove lingering 'running' UI states so spinners disappear
        setAutoExecStatuses(prev => {
            if (!prev[tid]) return prev;
            const nextStatuses = { ...prev[tid] };
            for (const key in nextStatuses) {
                if (nextStatuses[key] === 'running') {
                    nextStatuses[key] = 'waiting';
                }
            }
            return { ...prev, [tid]: nextStatuses };
        });
    }, [analysisId, apiCall, setAutoExecuting, setAutoExecStep, setAutoExecTotal, setAutoExecLog, setAutoExecStatuses, abortControllersRef]);

    return {
        handleExpandSubtasks,
        handleAutoExecute,
        handleRedoTask,
        handleRedoSubtasks,
        handleStopExecution,
    };
};
