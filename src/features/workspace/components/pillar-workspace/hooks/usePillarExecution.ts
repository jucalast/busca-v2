'use client';

import { useCallback } from 'react';
import { TaskItem } from '../types';
import { safeRender } from '../utils';

interface UsePillarExecutionProps {
    analysisId: string | null;
    businessId: string | null;
    profile: any;
    apiCall: (action: string, data: any, options?: { signal?: AbortSignal; skipCache?: boolean }) => Promise<any>;
    autoExecSubtasks: Record<string, any[]>;
    autoExecResults: Record<string, Record<number, any>>;
    abortControllersRef: React.MutableRefObject<Record<string, AbortController>>;
    setExecutingTask: React.Dispatch<React.SetStateAction<string | null>>;
    setExpandedTaskIds: React.Dispatch<React.SetStateAction<Set<string>>>;
    setError: React.Dispatch<React.SetStateAction<string>>;
    setTaskDeliverables: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    setCompletedTasks: React.Dispatch<React.SetStateAction<Record<string, Set<string>>>>;
    setAutoExecuting: React.Dispatch<React.SetStateAction<string | null>>;
    setAutoExecStep: React.Dispatch<React.SetStateAction<number>>;
    setAutoExecTotal: React.Dispatch<React.SetStateAction<number>>;
    setAutoExecSubtasks: React.Dispatch<React.SetStateAction<Record<string, any[]>>>;
    setAutoExecResults: React.Dispatch<React.SetStateAction<Record<string, Record<number, any>>>>;
    setAutoExecStatuses: React.Dispatch<React.SetStateAction<Record<string, Record<number, 'waiting' | 'running' | 'done' | 'error'>>>>;
    setRateLimitError: React.Dispatch<React.SetStateAction<string | null>>;
    setShowRateLimitWarning: React.Dispatch<React.SetStateAction<boolean>>;
}

export function usePillarExecution({
    analysisId,
    businessId,
    profile,
    apiCall,
    autoExecSubtasks,
    autoExecResults,
    abortControllersRef,
    setExecutingTask,
    setExpandedTaskIds,
    setError,
    setTaskDeliverables,
    setCompletedTasks,
    setAutoExecuting,
    setAutoExecStep,
    setAutoExecTotal,
    setAutoExecSubtasks,
    setAutoExecResults,
    setAutoExecStatuses,
    setRateLimitError,
    setShowRateLimitWarning,
}: UsePillarExecutionProps) {

    // ─── AI executes task ───
    const handleAIExecute = useCallback(async (pillarKey: string, task: TaskItem) => {
        const tid = `${pillarKey}_${task.id}`;
        setExecutingTask(tid);
        // Also set autoExecuting so the UI shows the intermediate display panel
        setAutoExecuting(tid);
        setExpandedTaskIds(prev => new Set(prev).add(tid));
        setError('');

        const controller = new AbortController();
        abortControllersRef.current[tid] = controller;

        // Reset/init intermediate state
        setAutoExecStep(1);
        setAutoExecTotal(1);
        setAutoExecSubtasks(prev => ({ ...prev, [tid]: [task] }));
        setAutoExecStatuses(prev => ({ ...prev, [tid]: { 0: 'running' as const } }));

        try {
            // Use streaming API for real-time updates for single tasks too
            const response = await fetch('/api/growth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'ai-try-user-task-stream', // We can use the same streaming engine
                    analysis_id: analysisId,
                    pillar_key: pillarKey,
                    task_id: task.id,
                    task_data: task,
                    profile: profile?.profile || profile,
                    business_id: businessId
                }),
                signal: controller.signal
            });

            if (!response.ok || !response.body) {
                // FALLBACK to old non-streaming API if streaming fails or is not available
                const result = await apiCall('specialist-execute', {
                    analysis_id: analysisId, pillar_key: pillarKey,
                    task_id: task.id, task_data: task,
                    business_id: businessId, profile: profile?.profile || profile,
                }, { signal: controller.signal });
                
                if (result.success && result.execution) {
                    const executionData = { ...result.execution, id: result.execution.id || task.id };
                    if (!executionData.conteudo_completo && executionData.conteudo) {
                        executionData.conteudo_completo = executionData.conteudo;
                    }
                    setTaskDeliverables(prev => ({ ...prev, [tid]: executionData }));
                    setCompletedTasks(prev => {
                        const s = new Set(prev[pillarKey] || []);
                        s.add(task.id);
                        s.add(tid);
                        return { ...prev, [pillarKey]: s };
                    });
                } else { setError(result.error || 'Erro na execução'); }
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

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
                        const event = JSON.parse(line.slice(6));

                        if (event.type === 'thought') {
                            setAutoExecResults(prev => ({
                                ...prev,
                                [tid]: { ...prev?.[tid], 0: { ...(prev?.[tid]?.[0] || {}), opiniao: event.text, streaming: true } }
                            }));
                        } else if (event.type === 'tool') {
                            setAutoExecResults(prev => ({
                                ...prev,
                                [tid]: {
                                    ...prev?.[tid],
                                    0: {
                                        ...(prev?.[tid]?.[0] || {}),
                                        intelligence_tools_used: [
                                            ...(prev?.[tid]?.[0]?.intelligence_tools_used || []),
                                            event
                                        ]
                                    }
                                }
                            }));
                        } else if (event.type === 'result') {
                            const execResult = event.data;
                            if (execResult) {
                                const executionData = { ...execResult, id: execResult.id || task.id };
                                if (!executionData.conteudo_completo && executionData.conteudo) {
                                    executionData.conteudo_completo = executionData.conteudo;
                                }
                                
                                setTaskDeliverables(prev => ({ ...prev, [tid]: executionData }));
                                setAutoExecResults(prev => ({
                                    ...prev,
                                    [tid]: { ...prev?.[tid], 0: { ...executionData, streaming: false } }
                                }));
                                setAutoExecStatuses(prev => ({
                                    ...prev,
                                    [tid]: { ...prev?.[tid], 0: 'done' as const }
                                }));
                                setCompletedTasks(prev => {
                                    const s = new Set(prev[pillarKey] || []);
                                    s.add(task.id);
                                    s.add(tid);
                                    return { ...prev, [pillarKey]: s };
                                });
                            }
                        } else if (event.type === 'error') {
                            throw new Error(event.message || 'Erro na execução');
                        }
                    } catch (parseErr) {
                        // Silent parse errors for partial chunks
                    }
                }
            }
        } catch (err: any) {
            if (err.name === 'AbortError') {
                setError('Execução cancelada pelo usuário.');
            } else {
                setError(err.message || 'Erro ao executar tarefa');
            }
        } finally {
            if (abortControllersRef.current[tid]) delete abortControllersRef.current[tid];
            setExecutingTask(null);
            setTimeout(() => setAutoExecuting(null), 500);
        }
    }, [analysisId, businessId, profile, apiCall, setExecutingTask, setAutoExecuting, setExpandedTaskIds, setError, setAutoExecStep, setAutoExecTotal, setAutoExecSubtasks, setAutoExecStatuses, setTaskDeliverables, setCompletedTasks, setAutoExecResults, setRateLimitError, setShowRateLimitWarning]);

    // ─── AI tries user task with streaming ───
    const handleAITryUserTask = useCallback(async (pillarKey: string, task: TaskItem) => {
        const tid = `${pillarKey}_${task.id}`;
        setAutoExecuting(tid);
        setExpandedTaskIds(prev => new Set(prev).add(tid));
        setError('');

        setAutoExecStep(1);
        setAutoExecTotal(1);
        setAutoExecSubtasks(prev => ({ ...prev, [tid]: [task] }));
        setAutoExecStatuses(prev => ({ ...prev, [tid]: { 0: 'running' } }));

        const controller = new AbortController();
        abortControllersRef.current[tid] = controller;

        try {
            // Use streaming API for real-time updates
            const response = await fetch('/api/growth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'ai-try-user-task-stream',
                    analysis_id: analysisId,
                    pillar_key: pillarKey,
                    task_id: task.id,
                    task_data: task,
                    profile: profile?.profile || profile,
                    business_id: businessId
                }),
                signal: controller.signal
            });

            if (!response.ok || !response.body) {
                throw new Error('Failed to start streaming');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

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
                        const event = JSON.parse(line.slice(6));

                        if (event.type === 'thought') {
                            // Update streaming opinion for current subtask
                            setAutoExecResults(prev => ({
                                ...prev,
                                [tid]: {
                                    ...prev?.[tid],
                                    0: {
                                        ...prev?.[tid]?.[0],
                                        opiniao: event.text,
                                        streaming: true
                                    }
                                }
                            }));
                        } else if (event.type === 'tool') {
                            // Update intelligence tools being used
                            setAutoExecResults(prev => ({
                                ...prev,
                                [tid]: {
                                    ...prev?.[tid],
                                    0: {
                                        ...prev?.[tid]?.[0],
                                        intelligence_tools_used: [
                                            ...(prev?.[tid]?.[0]?.intelligence_tools_used || []),
                                            event
                                        ]
                                    }
                                }
                            }));
                        } else if (event.type === 'source') {
                            // Update sources being consulted
                            setAutoExecResults(prev => ({
                                ...prev,
                                [tid]: {
                                    ...prev?.[tid],
                                    0: {
                                        ...prev?.[tid]?.[0],
                                        sources: [
                                            ...(prev?.[tid]?.[0]?.sources || []),
                                            event.source
                                        ]
                                    }
                                }
                            }));
                        } else if (event.type === 'result') {
                            // Final result
                            const execResult = event.data;
                            if (execResult.success && execResult.execution) {
                                const executionData = { ...execResult.execution, id: execResult.execution.id || task.id };
                                if (!executionData.conteudo_completo && executionData.conteudo) {
                                    executionData.conteudo_completo = executionData.conteudo;
                                }
                                
                                setTaskDeliverables(prev => ({ ...prev, [tid]: executionData }));
                                setAutoExecResults(prev => ({
                                    ...prev,
                                    [tid]: { ...prev?.[tid], 0: { ...executionData, streaming: false } }
                                }));
                                setAutoExecStatuses(prev => ({
                                    ...prev,
                                    [tid]: { ...prev?.[tid], 0: 'done' }
                                }));
                                setAutoExecStep(2);
                            } else {
                                throw new Error(execResult.error || 'Falha ao tentar executar a tarefa com IA');
                            }
                        } else if (event.type === 'error') {
                            throw new Error(event.message || 'Erro na execução');
                        }
                    } catch (parseErr: any) {
                        if (parseErr.message && !parseErr.message.includes('JSON')) throw parseErr;
                    }
                }
            }
        } catch (err: any) {
            if (err.name === 'AbortError') {
                setError('Execução cancelada pelo usuário.');
            } else {
                setError(err.message || 'Erro na execução da IA');
            }
            setAutoExecStatuses(prev => ({ ...prev, [tid]: { 0: 'error' } }));
        } finally {
            if (abortControllersRef.current[tid]) delete abortControllersRef.current[tid];
            setTimeout(() => {
                setAutoExecuting(null);
            }, 800);
        }
    }, [analysisId, businessId, profile]);

    // ─── Generate Summary and Deliverable ───
    const handleGenerateSummary = useCallback(async (pillarKey: string, task: TaskItem, tid: string) => {
        setAutoExecuting(tid);
        const controller = new AbortController();
        abortControllersRef.current[`${tid}_summary`] = controller;

        try {
            const allItems = autoExecSubtasks[tid] || [];
            setAutoExecTotal(allItems.length);
            setAutoExecStep(allItems.length + 1);

            const allResultsObj = autoExecResults[tid] || {};
            const allResults = [];
            for (let i = 0; i < allItems.length; i++) {
                if (allResultsObj[i]) allResults.push(allResultsObj[i]);
            }

            const producaoResults = allResults.filter(r => r.execution_mode === 'producao');
            const deliverableResults = producaoResults.length > 0 ? producaoResults : allResults;
            const combinedContent = deliverableResults.map((r) =>
                safeRender(r.conteudo) || ''
            ).filter(Boolean).join('\n\n');

            const summaryResult = await apiCall('specialist-execute', {
                analysis_id: analysisId, pillar_key: pillarKey,
                task_id: `${tid}_summary`,
                task_data: {
                    id: `${tid}_summary`,
                    titulo: 'Resumo Executivo da Tarefa',
                    descricao: 'Gere um resumo em texto corrido, detalhado e bem formatado, consolidando os principais resultados encontrados nas subtarefas, sem perder as principais informações.',
                    entregavel_ia: 'Resumo das Subtarefas',
                    ferramenta: 'analise_dados'
                },
                business_id: businessId, profile: profile?.profile || profile,
                previous_results: [{ titulo: 'Conteúdo Original Completo', conteudo: combinedContent.substring(0, 15000) }],
            }, { signal: controller.signal });

            let resumo = combinedContent;
            if (summaryResult.success && summaryResult.execution) {
                resumo = safeRender(summaryResult.execution.conteudo);
            }

            const combinedSources = allResults.flatMap(r => r.sources || r.fontes_consultadas || []);
            const combinedDeliverable = {
                id: tid,
                entregavel_titulo: task.entregavel_ia || task.titulo,
                entregavel_tipo: 'plano_completo',
                conteudo: resumo,
                conteudo_completo: combinedContent,
                execution_mode: 'producao',
                como_aplicar: safeRender(allResults[allResults.length - 1]?.como_aplicar || ''),
                impacto_estimado: safeRender(allResults[allResults.length - 1]?.impacto_estimado || ''),
                fontes_consultadas: combinedSources,
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

        } catch (err: any) {
            console.error('Summary error', err);
        } finally {
            if (abortControllersRef.current[`${tid}_summary`]) {
                delete abortControllersRef.current[`${tid}_summary`];
            }
            setTimeout(() => {
                setAutoExecuting(prev => prev === tid ? null : prev);
            }, 800);
        }
    }, [analysisId, businessId, profile, apiCall, autoExecSubtasks, autoExecResults]);

    // ─── Retry single auto-execution subtask ───
    const handleRetryAutoExecSubtask = useCallback(async (pillarKey: string, task: TaskItem, subtaskIndex: number) => {
        const tid = `${pillarKey}_${task.id}`;
        const allItems = autoExecSubtasks[tid];
        if (!allItems) return;
        const st = allItems[subtaskIndex];
        if (!st) return;

        setAutoExecuting(tid);
        setError('');

        const controller = new AbortController();
        abortControllersRef.current[`${tid}_retry_${subtaskIndex}`] = controller;

        setAutoExecStatuses(prev => ({
            ...prev,
            [tid]: { ...prev?.[tid], [subtaskIndex]: 'running' }
        }));

        try {
            const previousResults = [];
            for (let i = 0; i < subtaskIndex; i++) {
                const r = autoExecResults[tid]?.[i];
                if (r) {
                    previousResults.push({
                        titulo: safeRender(r.entregavel_titulo || ''),
                        conteudo: safeRender(r.conteudo || '').slice(0, 800),
                    });
                }
            }

            const execResult = await apiCall('specialist-execute', {
                analysis_id: analysisId, pillar_key: pillarKey,
                task_id: `${tid}_st${subtaskIndex + 1}`,
                task_data: {
                    ...st, id: `${tid}_st${subtaskIndex + 1}`,
                    titulo: st.titulo,
                    descricao: st.descricao || st.entregavel || '',
                    entregavel_ia: st.entregavel || st.descricao,
                },
                business_id: businessId, profile: profile?.profile || profile,
                previous_results: previousResults.length > 0 ? previousResults : undefined,
            }, { signal: controller.signal });

            if (execResult.success && execResult.execution) {
                setAutoExecResults(prev => ({
                    ...prev,
                    [tid]: { ...prev?.[tid], [subtaskIndex]: execResult.execution },
                }));

                setAutoExecStatuses(prev => {
                    const wasDone = prev[tid]?.[subtaskIndex] === 'done';
                    const nextStatuses = { ...prev };
                    if (!nextStatuses[tid]) nextStatuses[tid] = {};
                    else nextStatuses[tid] = { ...prev[tid] };

                    nextStatuses[tid][subtaskIndex] = 'done';

                    const totalItems = allItems.length;
                    let allDone = true;
                    let nextIndexToRun = -1;

                    for (let j = 0; j < totalItems; j++) {
                        if (nextStatuses[tid][j] !== 'done') {
                            allDone = false;
                            if (nextIndexToRun === -1 && (nextStatuses[tid][j] === 'waiting' || nextStatuses[tid][j] === 'error')) {
                                nextIndexToRun = j;
                            }
                        }
                    }

                    if (!wasDone) {
                        if (allDone) {
                            setTimeout(() => handleGenerateSummary(pillarKey, task, tid), 100);
                        } else if (nextIndexToRun !== -1) {
                            setTimeout(() => {
                                setAutoExecStep(nextIndexToRun + 1);
                                handleRetryAutoExecSubtask(pillarKey, task, nextIndexToRun);
                            }, 300);
                        }
                    }

                    return nextStatuses;
                });
            } else {
                throw new Error(execResult.error || 'Erro na execução da subtarefa');
            }
        } catch (err: any) {
            if (err.name === 'AbortError') setError('Execução cancelada pelo usuário.');
            else setError(err.message || 'Erro na execução');

            setAutoExecStatuses(prev => ({
                ...prev,
                [tid]: { ...prev?.[tid], [subtaskIndex]: 'error' }
            }));
        } finally {
            if (abortControllersRef.current[`${tid}_retry_${subtaskIndex}`]) {
                delete abortControllersRef.current[`${tid}_retry_${subtaskIndex}`];
            }
            setTimeout(() => {
                setAutoExecuting(prev => prev === tid ? null : prev);
            }, 800);
        }
    }, [analysisId, businessId, profile, apiCall, autoExecSubtasks, autoExecResults, handleGenerateSummary]);

    // ─── User completes task ───
    const handleUserComplete = useCallback(async (pillarKey: string, task: TaskItem) => {
        const tid = `${pillarKey}_${task.id}`;
        try {
            await apiCall('track-result', {
                analysis_id: analysisId, pillar_key: pillarKey,
                task_id: task.id, action_title: task.titulo,
                outcome: 'Concluído pelo usuário', business_impact: '',
            });
            setCompletedTasks(prev => {
                const s = new Set(prev[pillarKey] || []);
                s.add(task.id);
                s.add(tid);
                return { ...prev, [pillarKey]: s };
            });
        } catch { /* ignore */ }
    }, [analysisId, apiCall]);

    return {
        handleAIExecute,
        handleAITryUserTask,
        handleGenerateSummary,
        handleRetryAutoExecSubtask,
        handleUserComplete,
    };
}
