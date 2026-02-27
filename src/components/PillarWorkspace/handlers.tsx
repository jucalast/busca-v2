import { useCallback } from 'react';
import { TaskItem } from './types';

// ─── Task Handlers ───
export const useTaskHandlers = (
    analysisId: string,
    apiCall: (action: string, data: any, options?: { signal?: AbortSignal }) => Promise<any>,
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
        setAutoExecuting(tid);
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
            }, { signal: controller.signal });
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
            setAutoExecuting(null);
        }
    }, [analysisId, profile, apiCall, setTaskSubtasks, setSubtasksUpdateKey, setAutoExecuting, setError, abortControllersRef]);

    // ─── Auto Execute Handler ───
    const handleAutoExecute = useCallback(async (pillarKey: string, task: TaskItem) => {
        const tid = `${pillarKey}_${task.id}`;
        setAutoExecuting(tid);
        setAutoExecStep(0);
        setAutoExecTotal(0);
        setAutoExecLog([]);
        // Clear this task's execution data
        setAutoExecSubtasks(prev => ({ ...prev, [tid]: [] }));
        setAutoExecResults(prev => ({ ...prev, [tid]: {} }));
        setAutoExecStatuses(prev => ({ ...prev, [tid]: {} }));
        setError('');

        const controller = new AbortController();
        abortControllersRef.current[tid] = controller;

        try {
            // Step 1: Use already-expanded subtasks if available, otherwise expand now
            let existingSubtasks = taskSubtasks[tid];
            if (!existingSubtasks) {
                const expandResult = await apiCall('expand-subtasks', {
                    analysis_id: analysisId, pillar_key: pillarKey,
                    task_data: task, profile: profile?.profile || profile,
                });
                if (!expandResult.success || !expandResult.subtasks) {
                    throw new Error(expandResult.error || 'Falha ao expandir tarefa');
                }
                existingSubtasks = expandResult.subtasks;
                setTaskSubtasks(prev => ({ ...prev, [tid]: existingSubtasks }));
                // Force update of TaskSubtasksDisplay
                setSubtasksUpdateKey(prev => prev + 1);
            }

            const allItems: any[] = existingSubtasks.subtarefas || [];
            if (allItems.length === 0) {
                throw new Error('Nenhuma subtarefa encontrada para esta ação.');
            }

            // Populate visual list for THIS task
            setAutoExecSubtasks(prev => ({ ...prev, [tid]: allItems }));
            setAutoExecTotal(allItems.length);

            // Step 2: Execute each subtask sequentially
            for (let i = 0; i < allItems.length; i++) {
                const subtask = allItems[i];
                setAutoExecStep(i + 1);
                setAutoExecStatuses(prev => ({
                    ...prev,
                    [tid]: { ...prev[tid], [i]: 'running' }
                }));
                setAutoExecLog(prev => [...prev, `Executando subtarefa ${i + 1}: ${subtask.titulo}`]);

                try {
                    const execResult = await apiCall('specialist-execute', {
                        analysis_id: analysisId, pillar_key: pillarKey,
                        task_id: task.id, subtask_index: i,
                        task_data: subtask, profile: profile?.profile || profile,
                    }, { signal: controller.signal });

                    const actualResult = execResult.execution || execResult.result;
                    if (execResult.success && actualResult) {
                        setAutoExecResults(prev => ({
                            ...prev,
                            [tid]: { ...prev[tid], [i]: actualResult }
                        }));
                        setAutoExecStatuses(prev => ({
                            ...prev,
                            [tid]: { ...prev[tid], [i]: 'done' }
                        }));
                        setAutoExecLog(prev => [...prev, `✅ Subtarefa ${i + 1} concluída`]);
                    } else {
                        throw new Error(execResult.error || 'Falha na execução');
                    }
                } catch (err: any) {
                    setAutoExecStatuses(prev => ({
                        ...prev,
                        [tid]: { ...prev[tid], [i]: 'error' }
                    }));
                    setAutoExecLog(prev => [...prev, `❌ Erro na subtarefa ${i + 1}: ${err.message}`]);
                    // Continue with next subtask even if one fails
                }

                // Small delay between subtasks
                await new Promise(resolve => setTimeout(resolve, 800));
            }

            // Step 3: Combine all results into a single deliverable
            const allResults = Object.values(autoExecResults[tid] || {});
            const combinedSources = allResults.flatMap((r: any) => r.sources || []);
            const combinedContent = allResults.map((r: any, i: number) =>
                `## ${i + 1}. ${allItems[i]?.titulo || `Subtarefa ${i + 1}`}\n\n${r.conteudo || ''}`
            ).join('\n\n---\n\n');

            const combinedDeliverable = {
                titulo: `Resultado: ${task.titulo}`,
                conteudo: combinedContent,
                sources: [...new Set(combinedSources)],
                parts: allResults,
            };
            setTaskDeliverables(prev => ({ ...prev, [tid]: combinedDeliverable }));
            setCompletedTasks(prev => {
                const s = new Set(prev[pillarKey] || []);
                s.add(task.id);
                s.add(tid);
                return { ...prev, [pillarKey]: s };
            });
            // Force update of TaskSubtasksDisplay
            setSubtasksUpdateKey(prev => prev + 1);

            // Clear execution state on success
            setAutoExecuting(null);

        } catch (err: any) {
            if (err.name === 'AbortError') {
                setError('Execução cancelada pelo usuário.');
            } else {
                setError(err.message || 'Erro na execução automática');
            }

            // Mark task as error state if it failed early
            setAutoExecuting(null);
            setAutoExecStep(0);
            // We intentionally leave autoExecTotal/Subtasks intact so the UI shows the error state
        }
    }, [analysisId, profile, apiCall, taskSubtasks, setTaskSubtasks, setSubtasksUpdateKey, setAutoExecuting, setAutoExecSubtasks, setAutoExecResults, setAutoExecStatuses, setTaskDeliverables, setCompletedTasks, setError, abortControllersRef]);

    // ─── Redo Task Handler ───
    const handleRedoTask = useCallback(async (pillarKey: string, tid: string, task: TaskItem) => {
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

        // Clear backend data
        try {
            await apiCall('redo-task', {
                analysis_id: analysisId,
                pillar_key: pillarKey,
                task_id: task.id,
            });
        } catch (err: any) {
            console.error('Failed to clear task data:', err);
            setError('Failed to reset task data');
        }
    }, [analysisId, apiCall, setTaskDeliverables, setAutoExecResults, setAutoExecStatuses, setAutoExecSubtasks, setCompletedTasks, setTaskSubtasks, setError]);

    // ─── Redo Subtasks Handler ───
    const handleRedoSubtasks = useCallback(async (pillarKey: string, tid: string, task: TaskItem) => {
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
            });
        } catch (err: any) {
            console.error('Failed to clear subtasks data:', err);
            setError('Failed to reset subtasks data');
            return;
        }

        // Regenerate subtasks automatically
        await handleExpandSubtasks(pillarKey, task);
    }, [analysisId, apiCall, handleExpandSubtasks, setTaskSubtasks, setAutoExecResults, setAutoExecStatuses, setAutoExecSubtasks, setSubtasksUpdateKey, setError]);

    // ─── Stop Execution Handler ───
    const handleStopExecution = useCallback((tid: string) => {
        if (abortControllersRef.current[tid]) {
            abortControllersRef.current[tid].abort();
            delete abortControllersRef.current[tid];
        }
        // Also clear auto-execution state if this was an auto-execution
        setAutoExecuting(null);
        setAutoExecStep(0);
        setAutoExecTotal(0);
        setAutoExecLog([]);
    }, [setAutoExecuting, abortControllersRef]);

    return {
        handleExpandSubtasks,
        handleAutoExecute,
        handleRedoTask,
        handleRedoSubtasks,
        handleStopExecution,
    };
};
