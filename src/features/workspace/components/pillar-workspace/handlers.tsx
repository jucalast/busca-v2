import { useCallback } from 'react';
import { TaskItem } from './types';

// ─── Task Handlers ───
export const useTaskHandlers = (
    analysisId: string,
    apiCall: (action: string, data: any, options?: { signal?: AbortSignal, skipCache?: boolean }) => Promise<any>,
    profile: any,
    taskSubtasks: Record<string, any>,
    taskDeliverables: Record<string, any>,
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
    setExpandingTask: React.Dispatch<React.SetStateAction<string | null>>,
    abortControllersRef: React.RefObject<Record<string, AbortController>>,
    pollingIntervalsRef: React.RefObject<Record<string, NodeJS.Timeout>>
) => {

    // ─── Expand Subtasks Handler ───
    const handleExpandSubtasks = useCallback(async (pillarKey: string, task: TaskItem) => {
        const tid = `${pillarKey}_${task.id}`;
        // Set expanding state to show loading dots
        setExpandingTask(tid);
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
            // Clear expanding state
            setExpandingTask(null);
        }
    }, [analysisId, profile, apiCall, setTaskSubtasks, setSubtasksUpdateKey, setExpandingTask, setError, abortControllersRef]);

    // ─── Auto Execute Handler ───
    const handleAutoExecute = useCallback(async (pillarKey: string, task: TaskItem, skipTrigger = false) => {
        const tid = `${pillarKey}_${task.id}`;
        
        console.log(`🤖 handleAutoExecute: ${tid} (skipTrigger: ${skipTrigger})`);

        // If already polling for this task, don't start a second loop
        if (pollingIntervalsRef.current?.[tid]) {
            console.log(`⏳ Already polling for ${tid}, ignoring repeat call.`);
            return;
        }

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

            // Step 2: Trigger server-side background execution (unless skipTrigger is true)
            if (!skipTrigger) {
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
            } else {
                console.log(`🔄 Resuming polling only for ${tid} (skipping trigger)`);
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

                        console.log('🔍 Polling status:', { status, current_step, total_steps, taskId: task.id, tid, hasResultData: !!result_data });

                        // Status finais possíveis
                        const finalStatuses = ['done', 'completed', 'finalization', 'finalized', 'success'];

                        // Only update step if actually running ou finalizado
                        if (status === 'running' || finalStatuses.includes(status) || status === 'error') {
                            setAutoExecStep(current_step);
                            setAutoExecTotal(total_steps);
                        }

                        // Atualiza status das subtarefas
                        if (subtasks) {
                            const newStatuses: Record<number, any> = {};
                            for (let i = 0; i < subtasks.length; i++) {
                                if (finalStatuses.includes(status)) {
                                    // Status final: todas as subtarefas estão completas
                                    newStatuses[i] = 'done';
                                } else if (i + 1 < current_step) {
                                    newStatuses[i] = 'done';
                                } else if (i + 1 === current_step && status === 'running') {
                                    newStatuses[i] = 'running';
                                } else if (i + 1 === current_step && status === 'error') {
                                    newStatuses[i] = 'error';
                                } else {
                                    newStatuses[i] = 'waiting';
                                }
                            }
                            
                            // Se status final, também marca a subtarefa de finalização (se existir)
                            if (finalStatuses.includes(status) && total_steps > subtasks.length) {
                                newStatuses[subtasks.length] = 'done'; // Finalization task
                            }
                            
                            console.log('🔄 Updating subtask statuses:', { tid, newStatuses, totalSteps: total_steps, subtaskCount: subtasks.length });
                            setAutoExecStatuses(prev => ({ ...prev, [tid]: newStatuses }));
                        }

                        // Atualiza resultados intermediários
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

                        if (finalStatuses.includes(status)) {
                            console.log('✅ Final status detected:', { status, hasResultData: !!result_data, taskId: task.id, resultDataLength: result_data ? Object.keys(result_data).length : 0 });
                            
                            // Garante que o progresso mostre 100% completado
                            setAutoExecStep(total_steps);
                            setAutoExecTotal(total_steps);
                            
                            if (result_data) {
                                console.log('💾 Saving deliverable to state:', { tid, resultDataKeys: Object.keys(result_data) });
                                setTaskDeliverables(prev => ({ ...prev, [tid]: result_data }));
                                setCompletedTasks(prev => {
                                    const s = new Set(prev[pillarKey] || []);
                                    s.add(task.id);
                                    s.add(tid);
                                    console.log('✅ Task marked as completed:', { taskId: task.id, tid, totalCompleted: s.size });
                                    return { ...prev, [pillarKey]: s };
                                });
                                setAutoExecuting(null);
                                return true; // Stop polling
                            } else {
                                console.log('⚠️ Final status but no result_data:', { status, taskId: task.id });
                                // Additional safety check: continue polling if we have final status but no deliverable yet
                                const currentDeliverable = taskDeliverables?.[tid];
                                if (!currentDeliverable) {
                                    console.log('⚠️ Final status detected but no deliverable yet, continuing polling...', { tid, status });
                                    return false; // Continue polling
                                }
                                setAutoExecuting(null);
                                return true; // Stop polling
                            }
                        } else if (status === 'error' || status === 'cancelled') {
                            console.log('❌ Error/cancelled status:', { status, error_message, taskId: task.id });
                            if (status === 'error') setError(error_message || 'Erro na execução');
                            
                            // Cleanup interval
                            if (pollingIntervalsRef.current?.[tid]) {
                                clearInterval(pollingIntervalsRef.current[tid]);
                                delete pollingIntervalsRef.current[tid];
                            }
                            
                            setAutoExecuting(null);
                            return true; // Stop polling
                        }
                    } else if (statusRes && statusRes.success === false) {
                        console.log('❌ Polling failed:', statusRes);
                        // If task is not found (deleted) or similar explicit failure
                        setAutoExecuting(null);
                        return true;
                    } else {
                        console.log('⏳ No status yet, continuing polling:', { taskId: task.id, tid, statusRes });
                    }
                } catch (err) {
                    console.error('Polling error:', err);
                }

                // If it was stopped, abort controllers will be undefined
                if (!abortControllersRef.current[tid]) {
                    console.log('🛑 Polling stopped: abort controller cleared', { tid });
                    return true;
                }

                console.log('🔄 Continuing polling...', { tid });
                return false;
            };

            // Start first poll and then interval
            console.log('🚀 Starting polling for task:', { taskId: task.id, tid });
            const finished = await poll();
            console.log('📊 First poll result:', { finished, tid });
            if (!finished) {
                console.log('⏰ Setting up interval polling...');
                const interval = setInterval(async () => {
                    const done = await poll();
                    if (done) {
                        console.log('✅ Polling interval cleared');
                        if (pollingIntervalsRef.current?.[tid]) delete pollingIntervalsRef.current[tid];
                        clearInterval(interval);
                    }
                }, 3000);
                
                if (pollingIntervalsRef.current) {
                    pollingIntervalsRef.current[tid] = interval;
                }
            } else {
                console.log('✅ Polling finished after first check');
            }

        } catch (err: any) {
            setError(err.message || 'Erro na execução automática');
            setAutoExecuting(null);
        }
    }, [analysisId, profile, apiCall, taskSubtasks, taskDeliverables, setTaskSubtasks, setSubtasksUpdateKey, setAutoExecuting, setAutoExecSubtasks, setAutoExecResults, setAutoExecStatuses, setTaskDeliverables, setCompletedTasks, setError]);

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
    }, [analysisId, apiCall, setTaskDeliverables, taskDeliverables, setAutoExecResults, setAutoExecStatuses, setAutoExecSubtasks, setCompletedTasks, setTaskSubtasks, setError]);

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

        // Clear local interval if exists
        if (pollingIntervalsRef.current?.[tid]) {
            console.log(`🛑 Stopping polling interval for ${tid}`);
            clearInterval(pollingIntervalsRef.current[tid]);
            delete pollingIntervalsRef.current[tid];
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
