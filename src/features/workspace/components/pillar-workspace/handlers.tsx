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
    autoExecuting: string | null,
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
    pollingIntervalsRef: React.RefObject<Record<string, NodeJS.Timeout>>,
    eventSourcesRef: React.RefObject<Record<string, EventSource>>,
    selectedPillar: string | null = null
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

        // Clear any cancelled status for this task before starting new operation
        try {
            const clearResult = await apiCall('clear-task-status', {
                analysis_id: analysisId,
                task_id: task.id,
                pillar_key: pillarKey
            }, { skipCache: true });
            console.log(`🧹 [Expand] Cleared task status: ${clearResult.success}`);
        } catch (clearErr) {
            console.log(`⚠️ [Expand] Could not clear status, continuing...`);
        }

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
            else if (err.message && (err.message.includes('Task cancelled by user') || err.message.includes('Task was cancelled'))) {
                // Handle the specific cancellation error
                console.log(`⚠️ [Expand] Task cancelled during expansion, handling gracefully`);
                setError('');
                // Don't show error to user, just stop
            } else {
                setError(err.message || 'Erro');
            }
        } finally {
            if (abortControllersRef.current[tid]) delete abortControllersRef.current[tid];
            // Clear expanding state
            setExpandingTask(null);
        }
    }, [analysisId, profile, apiCall, setTaskSubtasks, setSubtasksUpdateKey, setExpandingTask, setError, abortControllersRef]);

    // ─── Auto Execute Handler ───
    const handleAutoExecute = useCallback(async (pillarKey: string, task: TaskItem, skipTrigger = false) => {
        const tid = `${pillarKey}_${task.id}`;
        
        console.log(`🤖 [AutoExec] handleAutoExecute: ${tid} (skipTrigger: ${skipTrigger})`);
        console.log(`🤖 [AutoExec] autoExecuting current: ${autoExecuting}`);

        // If already polling for this task, don't start a second loop
        if (pollingIntervalsRef.current?.[tid]) {
            console.log(`⏳ [AutoExec] Already polling for ${tid}, ignoring repeat call.`);
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
        setAutoExecStep(1);
        setAutoExecTotal(0);
        setAutoExecLog([]);
        setError('');
        
        // NOVO: Se for uma execução nova (não recovery), limpa qualquer status de cancelamento prévio
        if (!skipTrigger) {
            try {
                await apiCall('clear-task-status', {
                    analysis_id: analysisId,
                    task_id: task.id,
                    pillar_key: pillarKey
                }, { skipCache: true });
            } catch (err) {
                console.warn('⚠️ Could not clear task status before start:', err);
            }
        }

        try {
            // Step 1: Ensure we have subtasks locally for the UI list
            let subtasks = taskSubtasks[tid]?.subtarefas;
            if (!subtasks) {
                // Check for cancellation before expanding subtasks
                try {
                    const statusResult = await apiCall('poll-background-status', {
                        analysis_id: analysisId,
                        task_id: task.id,
                        pillar_key: pillarKey
                    }, { skipCache: true });
                    
                    if (statusResult.success && statusResult.progress) {
                        const status = statusResult.progress.status;
                        if (status === 'cancelled') {
                            console.log(`⚠️ [AutoExec] Task ${task.id} was cancelled, stopping execution`);
                            setAutoExecuting(null);
                            setAutoExecStep(0);
                            setAutoExecTotal(0);
                            return;
                        }
                    }
                } catch (statusErr) {
                    // If status check fails, continue with subtask expansion
                    console.log(`⚠️ [AutoExec] Could not check status, continuing...`);
                }
                
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

            // Step 2.5: Conectar ao Streaming de Eventos (SSE) para feedback em tempo real
            if (eventSourcesRef.current) {
                if (eventSourcesRef.current[tid]) {
                    eventSourcesRef.current[tid].close();
                }

                // O backend publica no canal task_updates:task_id
                const sseUrl = `/api/v1/growth/task-events/${task.id}`;
                console.log(`📡 [SSE] Conectando ao stream: ${sseUrl}`);
                const eventSource = new EventSource(sseUrl);
                eventSourcesRef.current[tid] = eventSource;

                eventSource.onmessage = (event) => {
                    try {
                        const payload = JSON.parse(event.data);
                        if (payload.type === 'thought' || payload.type === 'tool' || payload.type === 'source') {
                            const subtaskId = payload.task_id;
                            const match = subtaskId.match(/_st(\d+)$/);
                            let index = -1;
                            
                            // Determina qual índice de subtarefa deve ser atualizado
                            if (match) {
                                index = parseInt(match[1]) - 1;
                            } else if (subtaskId.endsWith('_summary_final') || subtaskId.endsWith('_finalization')) {
                                index = subtasks ? subtasks.length : -1;
                            } else if (subtaskId === task.id) {
                                index = 0;
                            }

                            if (index !== -1) {
                                setAutoExecResults(prev => {
                                    const currentResults = prev[tid] || {};
                                    const res = currentResults[index] || {};
                                    
                                    const nextRes = { ...res };
                                    if (payload.type === 'thought') {
                                        nextRes.opiniao = payload.data.text;
                                    } else if (payload.type === 'tool') {
                                        const tools = nextRes.intelligence_tools_used ? [...nextRes.intelligence_tools_used] : [];
                                        const incoming = payload.data;
                                        const existingIdx = tools.findIndex((t: any) => t.tool === incoming.tool);
                                        if (existingIdx !== -1) {
                                            tools[existingIdx] = { ...tools[existingIdx], ...incoming };
                                        } else {
                                            tools.push(incoming);
                                        }
                                        nextRes.intelligence_tools_used = tools;
                                    } else if (payload.type === 'source') {
                                        const sources = nextRes.sources ? [...nextRes.sources] : [];
                                        const incomingSource = payload.data.source;
                                        if (!sources.find((s: any) => s.url === incomingSource.url)) {
                                            sources.push(incomingSource);
                                        }
                                        nextRes.sources = sources;
                                    }
                                    
                                    return {
                                        ...prev,
                                        [tid]: { ...currentResults, [index]: nextRes }
                                    };
                                });

                                // Também atualiza o status para 'running' se recebermos um pensamento/extração
                                setAutoExecStatuses(prev => {
                                    const current = prev[tid] || {};
                                    if (current[index] !== 'done' && current[index] !== 'error') {
                                        return { ...prev, [tid]: { ...current, [index]: 'running' } };
                                    }
                                    return prev;
                                });
                            }
                        }
                    } catch (e) {
                        console.error('❌ [SSE] Erro ao processar evento:', e);
                    }
                };

                eventSource.onerror = (err) => {
                    console.warn('⚠️ [SSE] Conexão encerrada ou erro:', err);
                    eventSource.close();
                    if (eventSourcesRef.current?.[tid]) delete eventSourcesRef.current[tid];
                };
            }

            // Step 3: Polling Loop (Backup de sincronização)
            const poll = async () => {
                try {
                    const statusRes = await apiCall('poll-background-status', {
                        analysis_id: analysisId,
                        task_id: task.id
                    }, { skipCache: true });

                    if (statusRes.success && statusRes.progress) {
                        const { status, current_step, total_steps, result_data, error_message, subtask_results } = statusRes.progress;

                        console.log('🔍 Polling status:', { status, current_step, total_steps, taskId: task.id, tid, hasResultData: !!result_data });

                        const finalStatuses = ['done', 'completed', 'finalization', 'finalized', 'success'];

                        if (status === 'running' || status === 'started' || status === 'processing' || finalStatuses.includes(status) || status === 'error') {
                            const step = current_step > 0 ? (current_step > total_steps && total_steps > 0 ? total_steps : current_step) : 1;
                            setAutoExecStep(step);
                            setAutoExecTotal(total_steps || (subtasks?.length ? subtasks.length + 1 : 0));
                        }

                        if (subtasks) {
                            const newStatuses: Record<number, any> = {};
                            for (let i = 0; i < subtasks.length; i++) {
                                if (finalStatuses.includes(status)) {
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

                            if (subtask_results && Array.isArray(subtask_results)) {
                                subtask_results.forEach((res: any) => {
                                    const match = res.task_id.match(/_st(\d+)$/);
                                    if (match) {
                                        const idx = parseInt(match[1]) - 1;
                                        if (res.status === 'ai_executing') newStatuses[idx] = 'running';
                                        else if (res.status === 'ai_executed' || res.status === 'done') newStatuses[idx] = 'done';
                                        else if (res.status === 'error') newStatuses[idx] = 'error';
                                    } else if (res.task_id.endsWith('_finalization')) {
                                        const idx = subtasks.length;
                                        if (res.status === 'ai_executing') newStatuses[idx] = 'running';
                                        else if (res.status === 'ai_executed' || res.status === 'done') newStatuses[idx] = 'done';
                                    }
                                });
                            }
                            
                            if (finalStatuses.includes(status)) {
                                Object.keys(newStatuses).forEach(k => newStatuses[Number(k)] = 'done');
                                if (total_steps > subtasks.length) newStatuses[subtasks.length] = 'done';
                            }
                            setAutoExecStatuses(prev => ({ ...prev, [tid]: newStatuses }));
                        }

                        if (subtask_results) {
                            const resultsMap: Record<number, any> = {};
                            subtask_results.forEach((res: any) => {
                                const match = res.task_id.match(/_st(\d+)$/);
                                if (match) {
                                    const index = parseInt(match[1]) - 1;
                                    resultsMap[index] = res.result_data;
                                } else if (res.task_id.endsWith('_finalization')) {
                                    const index = subtasks ? subtasks.length : total_steps - 1;
                                    resultsMap[index] = res.result_data;
                                }
                            });
                            setAutoExecResults(prev => ({ ...prev, [tid]: resultsMap }));
                        }

                        if (finalStatuses.includes(status)) {
                            setAutoExecStep(total_steps);
                            setAutoExecTotal(total_steps);
                            
                            if (result_data) {
                                setTaskDeliverables(prev => ({ ...prev, [tid]: result_data }));
                                setCompletedTasks(prev => {
                                    const s = new Set(prev[pillarKey] || []);
                                    s.add(task.id);
                                    s.add(tid);
                                    return { ...prev, [pillarKey]: s };
                                });

                                // Fechar SSE ao finalizar com sucesso
                                if (eventSourcesRef.current?.[tid]) {
                                    eventSourcesRef.current[tid].close();
                                    delete eventSourcesRef.current[tid];
                                }

                                setAutoExecuting(null);
                                return true; 
                            } else {
                                const currentDeliverable = taskDeliverables?.[tid];
                                if (!currentDeliverable) return false; 
                                
                                setAutoExecuting(null);
                                return true; 
                            }
                        } else if (status === 'error' || status === 'cancelled') {
                            if (status === 'error') setError(error_message || 'Erro na execução');
                            
                            if (pollingIntervalsRef.current?.[tid]) {
                                clearInterval(pollingIntervalsRef.current[tid]);
                                delete pollingIntervalsRef.current[tid];
                            }

                            // Fechar SSE em erro
                            if (eventSourcesRef.current?.[tid]) {
                                eventSourcesRef.current[tid].close();
                                delete eventSourcesRef.current[tid];
                            }
                            
                            setAutoExecuting(null);
                            return true; 
                        }
                    } else if (statusRes && statusRes.success === false) {
                        setAutoExecuting(null);
                        return true;
                    }
                } catch (err) {
                    console.error('Polling error:', err);
                }

                if (!abortControllersRef.current[tid]) return true;
                return false;
            };

            console.log('🚀 Starting polling fallback for task:', tid);
            const finished = await poll();
            if (!finished) {
                const interval = setInterval(async () => {
                    const done = await poll();
                    if (done) {
                        if (pollingIntervalsRef.current?.[tid]) delete pollingIntervalsRef.current[tid];
                        clearInterval(interval);
                    }
                }, 3000);
                
                if (pollingIntervalsRef.current) {
                    pollingIntervalsRef.current[tid] = interval;
                }
            }

        } catch (err: any) {
            if (err.message && (err.message.includes('Task cancelled by user') || err.message.includes('Task was cancelled'))) {
                console.log(`⚠️ [AutoExec] Task cancelled gracefully`);
                setError('');
                setAutoExecuting(null);
                setAutoExecStep(0);
                setAutoExecTotal(0);
            } else {
                setError(err.message || 'Erro na execução automática');
                setAutoExecuting(null);
            }
        } finally {
             // Cleanup if needed
        }
    }, [analysisId, profile, apiCall, taskSubtasks, taskDeliverables, setTaskSubtasks, setSubtasksUpdateKey, setAutoExecuting, setAutoExecSubtasks, setAutoExecResults, setAutoExecStatuses, setTaskDeliverables, setCompletedTasks, setError, eventSourcesRef]);

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

        // NOVO: Parar conexão SSE (Fluxo em Tempo Real)
        if (eventSourcesRef.current?.[tid]) {
            console.log(`🛑 Stopping SSE connection for ${tid}`);
            eventSourcesRef.current[tid].close();
            delete eventSourcesRef.current[tid];
        }

        // Notify backend to cancel the task loop
        try {
            // tid format is usually `${selectedPillar}_${task.id}`
            // Robust extraction: remove the pillar prefix if it matches
            let pillar_key = '';
            let task_id = '';
            
            if (selectedPillar && tid.startsWith(`${selectedPillar}_`)) {
                pillar_key = selectedPillar;
                task_id = tid.substring(selectedPillar.length + 1);
            } else {
                // Fallback to old splitting logic if selectedPillar doesn't match
                const [p, ...rest] = tid.split('_');
                pillar_key = p;
                task_id = rest.join('_');
            }

            console.log(`📡 Sending cancel-task for pillar: ${pillar_key}, task: ${task_id}`);

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

        // Clear all execution-related state from localStorage
        if (typeof window !== 'undefined') {
            const keysToRemove = [
                `pillar_execution_${analysisId}_${tid}`,
                `auto_executing_${analysisId}`,
                `auto_exec_step_${analysisId}`,
                `auto_exec_total_${analysisId}`,
                `auto_exec_log_${analysisId}`
            ];
            keysToRemove.forEach(key => localStorage.removeItem(key));
        }

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
