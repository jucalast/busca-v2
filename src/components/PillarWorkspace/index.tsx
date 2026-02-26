'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
    Users, Palette, Eye, ShoppingBag, TrendingUp, Megaphone, HandCoins,
    ChevronRight, ArrowLeft, Loader2, Bot, User as UserIcon,
    CheckCircle2, Circle, AlertTriangle, Link2, ExternalLink, AlertCircle, RotateCcw,
    Clock, BarChart3, ChevronDown, ChevronUp, Sparkles,
    RefreshCw, Play, FileText, ListTree, Wand2, Target,
    Layers, ArrowRight, Zap, Globe, Package, Loader, Check
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useSession, signIn } from 'next-auth/react';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'next/navigation';

// ─── Pillar metadata ───
const PILLAR_META: Record<string, { label: string; icon: any; color: string; ordem: number }> = {
    publico_alvo: { label: 'Público-Alvo', icon: Users, color: '#8b5cf6', ordem: 1 },
    branding: { label: 'Branding', icon: Palette, color: '#f59e0b', ordem: 2 },
    identidade_visual: { label: 'Identidade Visual', icon: Eye, color: '#ec4899', ordem: 3 },
    canais_venda: { label: 'Canais de Venda', icon: ShoppingBag, color: '#3b82f6', ordem: 4 },
    trafego_organico: { label: 'Tráfego Orgânico', icon: TrendingUp, color: '#10b981', ordem: 5 },
    trafego_pago: { label: 'Tráfego Pago', icon: Megaphone, color: '#f97316', ordem: 6 },
    processo_vendas: { label: 'Processo de Vendas', icon: HandCoins, color: '#6366f1', ordem: 7 },
};

const PILLAR_ORDER = Object.keys(PILLAR_META).sort((a, b) => PILLAR_META[a].ordem - PILLAR_META[b].ordem);

// ─── Imports Modulares ───
import { PillarWorkspaceProps, TaskItem } from './types';
import { safeRender, openInGoogleDocs, exportFullAnalysis, getToolInfo } from './utils';
import { ScoreRing } from './components/ScoreRing';
import { DepBadge } from './components/DepBadge';
import { DeliverableCard } from './components/DeliverableCard';
import { SubtaskList } from './components/SubtaskList';
import { SourceBadgeList } from './components/SourceBadgeList';
import { MarkdownContent } from './components/MarkdownContent';
import { StreamingText } from './components/StreamingText';

// ═══════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════

export default function PillarWorkspace({
    score, specialists, analysisId, businessId, profile, marketData, userProfile, onRedo, onStateChange, initialActivePillar
}: PillarWorkspaceProps) {
    const { data: session } = useSession();
    const { aiModel } = useAuth();
    const router = useRouter();
    const [loadingDoc, setLoadingDoc] = useState<string | null>(null);
    const [loadingFullExport, setLoadingFullExport] = useState(false);
    const [selectedPillar, setSelectedPillar] = useState<string | null>(initialActivePillar || null);
    const [pillarStates, setPillarStates] = useState<Record<string, any>>({});
    const [loadingPillar, setLoadingPillar] = useState<string | null>(null);
    const [executingTask, setExecutingTask] = useState<string | null>(null);
    const [expandingTask, setExpandingTask] = useState<string | null>(null);
    const [taskDeliverables, setTaskDeliverables] = useState<Record<string, any>>({});
    const [taskSubtasks, setTaskSubtasks] = useState<Record<string, any>>({});
    const [completedTasks, setCompletedTasks] = useState<Record<string, Set<string>>>({});
    const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());
    const [showKPIs, setShowKPIs] = useState(false);
    const [error, setError] = useState('');
    const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
    const [entregaveisOrder, setEntregaveisOrder] = useState<number[]>([]); // Para controlar ordem dos entregáveis
    // Auto-execution state: expand → execute sequentially
    const [autoExecuting, setAutoExecuting] = useState<string | null>(null); // task id being auto-executed
    const [autoExecStep, setAutoExecStep] = useState<number>(0);
    const [autoExecTotal, setAutoExecTotal] = useState<number>(0);
    const [autoExecLog, setAutoExecLog] = useState<string[]>([]);
    // Per-subtask status + result during auto-execution (keyed by taskId)
    const [autoExecSubtasks, setAutoExecSubtasks] = useState<Record<string, any[]>>({});
    const [autoExecResults, setAutoExecResults] = useState<Record<string, Record<number, any>>>({});
    const [autoExecStatuses, setAutoExecStatuses] = useState<Record<string, Record<number, 'waiting' | 'running' | 'done' | 'error'>>>({});

    const abortControllersRef = React.useRef<Record<string, AbortController>>({});

    // ─── localStorage persistence ───
    const prevAnalysisIdRef = React.useRef<string | null | undefined>(undefined);

    // Combined load / reset effect — uses ref to distinguish first mount from reanalysis
    useEffect(() => {
        if (!analysisId) return;

        const isFirstMount = prevAnalysisIdRef.current === undefined;
        const isReanalysis = !isFirstMount && prevAnalysisIdRef.current !== analysisId;
        prevAnalysisIdRef.current = analysisId;

        if (isReanalysis) {
            // Reanalysis: clear everything + localStorage
            setPillarStates({});
            setTaskDeliverables({});
            setTaskSubtasks({});
            setCompletedTasks({});
            setExpandedTaskIds(new Set());
            setSelectedPillar(null);
            setLoadingPillar(null);
            setExecutingTask(null);
            setExpandingTask(null);
            setAutoExecuting(null);
            setAutoExecStep(0);
            setAutoExecTotal(0);
            setAutoExecLog([]);
            setAutoExecSubtasks({});
            setAutoExecResults({});
            setAutoExecStatuses({});
            setShowKPIs(false);
            setError('');
            localStorage.removeItem(`pillar_workspace_${analysisId}`);
            return;
        }

        // First mount: load persisted state from localStorage
        try {
            const saved = localStorage.getItem(`pillar_workspace_${analysisId}`);
            if (!saved) return;
            const data = JSON.parse(saved);
            if (data.completedTasks) {
                const restored: Record<string, Set<string>> = {};
                for (const [k, v] of Object.entries(data.completedTasks)) {
                    restored[k] = new Set(v as string[]);
                }
                setCompletedTasks(restored);
            }
            if (data.taskDeliverables) setTaskDeliverables(data.taskDeliverables);
            if (data.taskSubtasks) setTaskSubtasks(data.taskSubtasks);
            if (data.autoExecSubtasks) setAutoExecSubtasks(data.autoExecSubtasks);
            if (data.autoExecResults) setAutoExecResults(data.autoExecResults);
            if (data.autoExecStatuses) setAutoExecStatuses(data.autoExecStatuses);
            if (data.pillarStates) setPillarStates(data.pillarStates);
        } catch (e) {
            console.warn('Failed to load persisted state:', e);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [analysisId]);

    // useEffect(() => {
    //     if (!selectedPillar && Object.keys(score?.dimensoes || {}).length > 0) {
    //         setSelectedPillar(Object.keys(score.dimensoes)[0]);
    //     }
    // }, [score, selectedPillar]);



    // Save state to localStorage on changes
    useEffect(() => {
        if (!analysisId) return;
        // Don't save empty state (right after reset)
        const hasData = Object.keys(completedTasks).length > 0 ||
            Object.keys(taskDeliverables).length > 0 ||
            Object.keys(pillarStates).length > 0;
        if (!hasData) return;

        try {
            const ct: Record<string, string[]> = {};
            for (const [k, v] of Object.entries(completedTasks)) {
                ct[k] = Array.from(v);
            }
            localStorage.setItem(`pillar_workspace_${analysisId}`, JSON.stringify({
                completedTasks: ct,
                taskDeliverables,
                taskSubtasks,
                autoExecSubtasks,
                autoExecResults,
                autoExecStatuses,
                pillarStates,
            }));
        } catch (e) {
            console.warn('Failed to save state:', e);
        }
    }, [completedTasks, taskDeliverables, taskSubtasks, autoExecSubtasks, autoExecResults, autoExecStatuses, pillarStates, analysisId]);

    const dims = score?.dimensoes || {};
    const scoreGeral = score?.score_geral || 0;
    const resumo = score?.resumo_executivo || '';
    const classificacao = score?.classificacao || '';

    // Obter entregáveis do estado atual
    const currentPlan = selectedPillar ? pillarStates[selectedPillar]?.plan?.plan_data : null;
    const entregaveis = currentPlan?.entregaveis || [];

    // Report state changes to parent (for mind map)
    useEffect(() => {
        onStateChange?.(pillarStates, completedTasks);
    }, [pillarStates, completedTasks]);

    useEffect(() => {
        if (entregaveis.length > 0 && entregaveisOrder.length === 0) {
            setEntregaveisOrder(Array.from({ length: entregaveis.length }, (_, i) => i));
        }
    }, [entregaveis.length, entregaveisOrder.length]);

    const handleReorderEntregaveis = (clickedIndex: number) => {
        const newOrder = [...entregaveisOrder];
        const clickedOriginalIndex = newOrder.indexOf(clickedIndex);

        if (clickedOriginalIndex === 0) return; // Já está no meio

        // Mover o clicado para o início (posição 0)
        newOrder.splice(clickedOriginalIndex, 1);
        newOrder.unshift(clickedIndex);

        setEntregaveisOrder(newOrder);
    };

    // ─── API helper ───
    const apiCall = useCallback(async (action: string, data: any, options?: { signal?: AbortSignal }) => {
        const res = await fetch('/api/growth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, aiModel, ...data }),
            signal: options?.signal,
        });
        return await res.json();
    }, [aiModel]);

    // ─── Stop and Redo Handlers ───
    const handleStopExecution = useCallback((tid: string) => {
        if (abortControllersRef.current[tid]) {
            abortControllersRef.current[tid].abort();
            delete abortControllersRef.current[tid];
        }
        // Also clear auto-execution state if this was an auto-execution
        if (autoExecuting === tid) {
            setAutoExecuting(null);
            setAutoExecStep(0);
            setAutoExecTotal(0);
            setAutoExecLog([]);
        }
    }, [autoExecuting]);

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
    }, [analysisId, apiCall]);

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

        // Clear subtasks from backend
        try {
            await apiCall('redo-subtasks', {
                analysis_id: analysisId,
                pillar_key: pillarKey,
                task_id: task.id,
            });
        } catch (err: any) {
            console.error('Failed to clear subtasks data:', err);
            setError('Failed to reset subtasks data');
        }
    }, [analysisId, apiCall]);

    const handleRedoPillar = useCallback(async (pillarKey: string) => {
        if (!confirm('Tem certeza? Isso apagará todas as tarefas geradas e executadas deste pilar.')) return;

        // Clear frontend state for this specific pillar
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

        setError('');
        setLoadingPillar(pillarKey); // Show loading spinner

        // Clear backend data
        try {
            await apiCall('redo-pillar', {
                analysis_id: analysisId,
                pillar_key: pillarKey,
            });

            // Reload the pillar to get brand new tasks
            const result = await apiCall('specialist-tasks', {
                analysis_id: analysisId, pillar_key: pillarKey,
                business_id: businessId, profile: profile?.profile || profile,
            });

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
    }, [analysisId, businessId, profile, apiCall]);

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
    }, [pillarStates, analysisId, businessId, profile, apiCall, router]);

    // Listener para o initialActivePillar quando mudar de cima pra baixo (Hub -> Workspace)
    useEffect(() => {
        if (initialActivePillar) {
            handleSelectPillar(initialActivePillar);
        }
    }, [initialActivePillar, handleSelectPillar]);

    // Reset any visual "expanded" highlight once the user leaves the task focus view
    useEffect(() => {
        if (!focusedTaskId) {
            setExpandedTaskIds(prev => (prev.size > 0 ? new Set() : prev));
        }
    }, [focusedTaskId]);

    // ─── AI executes task ───
    const handleAIExecute = useCallback(async (pillarKey: string, task: TaskItem) => {
        const tid = `${pillarKey}_${task.id}`;
        setExecutingTask(tid);
        setExpandedTaskIds(prev => new Set(prev).add(tid));
        setError('');

        const controller = new AbortController();
        abortControllersRef.current[tid] = controller;

        try {
            const result = await apiCall('specialist-execute', {
                analysis_id: analysisId, pillar_key: pillarKey,
                task_id: task.id, task_data: task,
                business_id: businessId, profile: profile?.profile || profile,
            }, { signal: controller.signal });
            if (result.success && result.execution) {
                const executionData = { ...result.execution, id: result.execution.id || task.id };
                setTaskDeliverables(prev => ({ ...prev, [tid]: executionData }));
                setCompletedTasks(prev => {
                    const s = new Set(prev[pillarKey] || []);
                    s.add(task.id);
                    s.add(tid);
                    return { ...prev, [pillarKey]: s };
                });
            } else { setError(result.error || 'Erro na execução'); }
        } catch (err: any) {
            if (err.name === 'AbortError') setError('Execução cancelada pelo usuário.');
            else setError(err.message || 'Erro ao executar tarefa');
        } finally {
            if (abortControllersRef.current[tid]) delete abortControllersRef.current[tid];
            setExecutingTask(null);
        }
    }, [analysisId, businessId, profile, apiCall]);


    // ─── Expand subtasks ───
    const handleExpandSubtasks = useCallback(async (pillarKey: string, task: TaskItem) => {
        const tid = `${pillarKey}_${task.id}`;
        setExpandingTask(tid);
        setExpandedTaskIds(prev => new Set(prev).add(tid));
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
            } else { setError(result.error || 'Erro ao expandir'); }
        } catch (err: any) {
            if (err.name === 'AbortError') setError('Ação cancelada pelo usuário.');
            else setError(err.message || 'Erro');
        } finally {
            if (abortControllersRef.current[tid]) delete abortControllersRef.current[tid];
            setExpandingTask(null);
        }
    }, [analysisId, profile, apiCall]);

    // ─── Auto-execute: reuse existing subtasks or expand first, then execute each sequentially ───
    const handleAutoExecute = useCallback(async (pillarKey: string, task: TaskItem) => {
        const tid = `${pillarKey}_${task.id}`;
        setAutoExecuting(tid);
        setExpandedTaskIds(prev => new Set(prev).add(tid));
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
            }

            const allItems: any[] = existingSubtasks.subtarefas || [];
            if (allItems.length === 0) {
                throw new Error('Nenhuma subtarefa encontrada para esta ação.');
            }

            // Populate visual list for THIS task
            setAutoExecSubtasks(prev => ({ ...prev, [tid]: allItems }));

            // Initialize all as waiting
            const initStatuses: Record<number, 'waiting' | 'running' | 'done' | 'error'> = {};
            allItems.forEach((_, i) => { initStatuses[i] = 'waiting'; });
            setAutoExecStatuses(prev => ({ ...prev, [tid]: initStatuses }));

            // Execute ALL subtasks — parent task has been delegated to AI
            setAutoExecTotal(allItems.length);

            // Step 2: Execute each subtask sequentially, update card in real time
            const allResults: any[] = [];
            let aiIndex = 0;

            for (let i = 0; i < allItems.length; i++) {
                const st = allItems[i];

                setAutoExecStep(aiIndex + 1);
                setAutoExecStatuses(prev => ({
                    ...prev,
                    [tid]: { ...prev?.[tid], [i]: 'running' },
                }));

                // Build previous results for context chaining
                const previousResults = allResults.map(r => ({
                    titulo: safeRender(r.entregavel_titulo || ''),
                    conteudo: safeRender(r.conteudo || '').slice(0, 800),
                }));

                const execResult = await apiCall('specialist-execute', {
                    analysis_id: analysisId, pillar_key: pillarKey,
                    task_id: `${tid}_st${i + 1}`,
                    task_data: {
                        ...st, id: `${tid}_st${i + 1}`,
                        titulo: st.titulo,
                        descricao: st.descricao || st.entregavel || '',
                        entregavel_ia: st.entregavel || st.descricao,
                    },
                    business_id: businessId, profile: profile?.profile || profile,
                    previous_results: previousResults.length > 0 ? previousResults : undefined,
                }, { signal: controller.signal });

                if (execResult.success && execResult.execution) {
                    allResults.push(execResult.execution);
                    setAutoExecResults(prev => ({
                        ...prev,
                        [tid]: { ...prev?.[tid], [i]: execResult.execution },
                    }));
                    setAutoExecStatuses(prev => ({
                        ...prev,
                        [tid]: { ...prev?.[tid], [i]: 'done' },
                    }));
                } else {
                    setAutoExecStatuses(prev => ({
                        ...prev,
                        [tid]: { ...prev?.[tid], [i]: 'error' },
                    }));
                }
                aiIndex++;
            }

            // Combine all results into final deliverable
            if (allResults.length > 0) {
                const combinedContent = allResults.map((r) =>
                    safeRender(r.conteudo) || ''
                ).filter(Boolean).join('\n\n');

                // Generate Executive Summary for the UI
                setAutoExecStep(allItems.length + 1);

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
            }

        } catch (err: any) {
            if (err.name === 'AbortError') {
                setError('Execução cancelada pelo usuário.');
            } else {
                setError(err.message || 'Erro na execução automática');
            }

            // Mark task as error state if it failed early
            setAutoExecStatuses(prev => {
                const updated = { ...prev?.[tid] };
                if (Object.keys(updated).length === 0) {
                    updated[0] = 'error'; // At least show one error
                } else {
                    Object.keys(updated).forEach(k => {
                        if (updated[k as any] === 'running') updated[k as any] = 'error';
                    });
                }
                return { ...prev, [tid]: updated };
            });

        } finally {
            if (abortControllersRef.current[tid]) delete abortControllersRef.current[tid];
            setTimeout(() => {
                setAutoExecuting(null);
                setAutoExecStep(0);
                // We intentionally leave autoExecTotal/Subtasks intact so the UI shows the error state
            }, 800);
        }
    }, [analysisId, businessId, profile, apiCall, taskSubtasks]);

    // ─── AI tries user task — delegates to specific backend endpoint ───
    const handleAITryUserTask = useCallback(async (pillarKey: string, task: TaskItem) => {
        const tid = `${pillarKey}_${task.id}`;
        setAutoExecuting(tid); // Show general executing state
        setExpandedTaskIds(prev => new Set(prev).add(tid));
        setError('');

        // We will mock a single subtask execution visually
        setAutoExecStep(1);
        setAutoExecTotal(1);
        setAutoExecSubtasks(prev => ({ ...prev, [tid]: [task] }));
        setAutoExecStatuses(prev => ({ ...prev, [tid]: { 0: 'running' } }));

        const controller = new AbortController();
        abortControllersRef.current[tid] = controller;

        try {
            const execResult = await apiCall('ai-try-user-task', {
                analysis_id: analysisId,
                pillar_key: pillarKey,
                task_id: task.id,
                task_data: task,
                profile: profile?.profile || profile,
                business_id: businessId
            }, { signal: controller.signal });

            if (execResult.success && execResult.execution) {
                // Success
                setAutoExecResults(prev => ({
                    ...prev,
                    [tid]: { ...prev?.[tid], 0: execResult.execution },
                }));
                setAutoExecStatuses(prev => ({
                    ...prev,
                    [tid]: { ...prev?.[tid], 0: 'done' },
                }));
                setAutoExecStep(2); // Done
            } else {
                throw new Error(execResult.error || 'Falha ao tentar executar a tarefa com IA');
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
    }, [analysisId, businessId, profile, apiCall]);

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

            const combinedContent = allResults.map((r) =>
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

        setAutoExecuting(tid); // Show execution indicator for the whole card
        setError('');

        const controller = new AbortController();
        abortControllersRef.current[`${tid}_retry_${subtaskIndex}`] = controller;

        setAutoExecStatuses(prev => ({
            ...prev,
            [tid]: { ...prev?.[tid], [subtaskIndex]: 'running' }
        }));

        try {
            // Build previous results up to this index
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

                // Set to done, and check if all subtasks are complete
                setAutoExecStatuses(prev => {
                    const wasDone = prev[tid]?.[subtaskIndex] === 'done';
                    const nextStatuses = { ...prev };
                    if (!nextStatuses[tid]) nextStatuses[tid] = {};
                    else nextStatuses[tid] = { ...prev[tid] }; // Deep clone for the particular task

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
                            // After state update, check deliverable immediately
                            setTimeout(() => handleGenerateSummary(pillarKey, task, tid), 100);
                        } else if (nextIndexToRun !== -1) {
                            // Automatically start the next subtask
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

    // ─── Task action buttons ───
    const TaskActions = ({ task, pillarKey, tid, isDone }: { task: TaskItem; pillarKey: string; tid: string; isDone: boolean }) => {
        const isExecuting = executingTask === tid;
        const isExpanding = expandingTask === tid;
        const isAutoExec = autoExecuting === tid;
        const deliverable = taskDeliverables[tid];
        const subtasks = taskSubtasks[tid];
        // Per-task execution state
        const taskExecSubtasks = autoExecSubtasks[tid] || [];
        const taskExecResults = autoExecResults[tid] || {};
        const taskExecStatuses = autoExecStatuses?.[tid] || {};
        const hasExecPanel = taskExecSubtasks.length > 0;

        if (isDone && !deliverable && !hasExecPanel) return null;

        const color = PILLAR_META[pillarKey]?.color || '#8b5cf6';

        return (
            <div className="mt-3 space-y-3">
                {/* Expanding spinner — shown only before subtasks load for THIS task */}
                {isAutoExec && !hasExecPanel && (
                    <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-violet-500/[0.03] border border-violet-500/10">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />
                        <span className="text-[11px] font-medium text-violet-300/80 uppercase tracking-wider">Criando subtarefas...</span>
                    </div>
                )}

                {hasExecPanel && (
                    <div className="mt-4 rounded-xl border border-white/[0.04] bg-black/10 overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-2.5 bg-white/[0.02] border-b border-white/[0.02]">
                            <div className="flex items-center gap-2">
                                <ListTree className="w-3.5 h-3.5 opacity-20" style={{ color }} />
                                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.2em]">
                                    {isAutoExec ? 'Processando' : 'Ações Realizadas'}
                                </span>
                            </div>
                            {autoExecTotal > 0 && isAutoExec && (
                                <div className="flex items-center gap-2.5">
                                    <div className="w-16 h-1 bg-zinc-800/50 rounded-full overflow-hidden">
                                        <div className="h-full rounded-full transition-all duration-700 ease-out"
                                            style={{ width: `${(Math.min(autoExecStep, autoExecTotal) / autoExecTotal) * 100}%`, backgroundColor: color }} />
                                    </div>
                                    <span className="text-[9px] font-mono text-zinc-600">
                                        {autoExecStep > autoExecTotal ? 'Finalizando...' : `${autoExecStep} de ${autoExecTotal}`}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Subtask cards */}
                        <div className="flex flex-col gap-1 px-2 pt-2 pb-3">
                            {taskExecSubtasks.map((st: any, i: number) => {
                                const status = taskExecStatuses[i] || 'waiting';
                                const result = taskExecResults[i];
                                const isAI = st.executavel_por_ia;

                                return (
                                    <div key={i} className={`transition-colors rounded-xl overflow-hidden ${status === 'running' ? 'bg-violet-500/[0.04]' :
                                        status === 'error' ? 'bg-red-500/[0.03]' : ''
                                        }`}>
                                        {/* Subtask header row */}
                                        <div className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-white/[0.02]">
                                            {/* Status icon */}
                                            <div className="mt-1 flex-shrink-0 w-4 h-4 flex items-center justify-center">
                                                {status === 'waiting' && <Circle className="w-3 h-3 text-zinc-900" />}
                                                {status === 'running' && <Loader2 className="w-3 h-3 animate-spin text-blue-500" />}
                                                {status === 'done' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/80" />}
                                                {status === 'error' && <AlertTriangle className="w-3 h-3 text-red-500/80" />}
                                            </div>

                                            <div className="flex-1">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2 flex-wrap flex-1">
                                                        <span className="text-[9px] font-mono text-zinc-900 select-none">{i + 1}</span>
                                                        <p className={`text-[12px] font-medium leading-relaxed ${status === 'done' ? 'text-zinc-500' :
                                                            status === 'running' ? 'text-zinc-100 font-semibold' : 'text-zinc-600'}`}>
                                                            {safeRender(st.titulo)}
                                                        </p>
                                                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-sm border-none ${isAI
                                                            ? 'bg-blue-500/10 text-blue-500/50'
                                                            : 'bg-white/[0.04] text-zinc-700'
                                                            }`}>
                                                            {isAI ? 'IA' : 'VOCÊ'}
                                                        </span>
                                                        {status === 'running' && (
                                                            <span className="text-[8px] text-blue-400/40 uppercase tracking-widest font-bold animate-pulse">Running</span>
                                                        )}
                                                    </div>

                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleRetryAutoExecSubtask(pillarKey, task, i); }}
                                                        className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.02] hover:bg-white/[0.06] text-zinc-700 hover:text-zinc-400 transition-all text-[8px] active:scale-95 uppercase tracking-wider font-bold"
                                                        title="Refazer subtarefa">
                                                        <RefreshCw className={`w-2 h-2 ${status === 'running' ? 'animate-spin opacity-30' : ''}`} />
                                                        <span>Refazer</span>
                                                    </button>
                                                </div>
                                                {st.descricao && status === 'waiting' && (
                                                    <p className="text-[11px] text-zinc-700 mt-1 leading-relaxed">{safeRender(st.descricao)}</p>
                                                )}
                                                {st.tempo_estimado && (
                                                    <span className="text-[9px] text-zinc-900 font-mono flex items-center gap-1 mt-1">
                                                        <Clock className="w-2.5 h-2.5 opacity-10" />{safeRender(st.tempo_estimado)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Inline result — shown when subtask is done */}
                                        {status === 'done' && result && (
                                            <div className="mx-4 mb-3 px-3 py-2">
                                                {result.entregavel_titulo && (
                                                    <p className="text-[10px] font-medium text-zinc-600 italic mb-1">
                                                        {safeRender(result.entregavel_titulo)}
                                                    </p>
                                                )}
                                                {result.conteudo && (
                                                    <div className="max-h-48 overflow-y-auto scrollbar-hide">
                                                        {isAutoExec && i === autoExecStep - 2 ? (
                                                            <StreamingText text={safeRender(result.conteudo)} speed={6} />
                                                        ) : (
                                                            <MarkdownContent content={safeRender(result.conteudo)} />
                                                        )}
                                                    </div>
                                                )}
                                                {/* Sources inline — staggered when live */}
                                                {(result.sources?.length > 0 || result.fontes_consultadas?.length > 0) && (
                                                    <SourceBadgeList sources={[...(result.sources || []), ...(result.fontes_consultadas || [])]} maxVisible={4} />
                                                )}
                                            </div>
                                        )}

                                        {/* Error state */}
                                        {status === 'error' && (
                                            <div className="mx-4 mb-3 px-3 py-2 rounded-lg bg-red-500/5">
                                                <p className="text-[11px] text-red-400/80">Erro ao executar esta subtarefa</p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Summary generation indicator */}
                        {(isAutoExec && autoExecStep > autoExecTotal) || (taskExecSubtasks.length > 0 && !taskDeliverables[tid] && autoExecTotal > 0 && autoExecStep > autoExecTotal && !isAutoExec) ? (
                            <div className="flex items-start gap-3 px-4 py-3.5 bg-blue-500/[0.02] border-t border-white/[0.02]">
                                <div className="mt-0.5 flex-shrink-0 w-4 h-4 flex items-center justify-center">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400/60" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-[11px] font-semibold text-blue-400/60 uppercase tracking-wider">Gerando resumo executivo...</p>
                                    <p className="text-[11px] text-zinc-600 mt-1 leading-relaxed">Sintetizando os resultados para uma visão consolidada no card.</p>
                                </div>
                            </div>
                        ) : null}



                        {/* Footer: combined result summary */}
                        {!isAutoExec && Object.values(taskExecStatuses).some(s => s === 'done') && (
                            <div className="px-4 py-2.5 bg-white/[0.01] border-t border-white/[0.02]">
                                <p className="text-[9px] text-zinc-700 italic flex items-center gap-1.5 opacity-60">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-500/40" />
                                    {Object.values(taskExecStatuses).filter(s => s === 'done').length} subtarefas concluídas — resultado consolidado
                                </p>
                            </div>
                        )}
                    </div>
                )
                }



                {/* Action buttons row — hidden while executing or exec panel exists */}
                {!isDone && !deliverable && !isAutoExec && !hasExecPanel && (
                    <div className="flex flex-wrap gap-2">
                        {task.executavel_por_ia ? (
                            <>
                                <button onClick={() => handleAutoExecute(pillarKey, task)} disabled={!!autoExecuting || isExecuting}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-violet-500/15 text-violet-400 hover:bg-violet-500/25 transition-all disabled:opacity-50">
                                    <Play className="w-3 h-3" />
                                    {subtasks
                                        ? `Executar ${(subtasks.subtarefas || []).length} subtarefas com IA`
                                        : 'Executar com IA'}
                                </button>
                                {!subtasks ? (
                                    <button onClick={() => handleExpandSubtasks(pillarKey, task)} disabled={isExpanding || !!autoExecuting}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] transition-all disabled:opacity-50">
                                        {isExpanding
                                            ? <><Loader2 className="w-3 h-3 animate-spin" />Criando subtarefas...</>
                                            : <><ListTree className="w-3 h-3" />Ver subtarefas</>}
                                    </button>
                                ) : (
                                    <button onClick={() => handleExpandSubtasks(pillarKey, task)} disabled={isExpanding || !!autoExecuting}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] transition-all disabled:opacity-50">
                                        {isExpanding
                                            ? <><Loader2 className="w-3 h-3 animate-spin" />Refazendo...</>
                                            : <><RefreshCw className="w-3 h-3" />Refazer subtarefas</>}
                                    </button>
                                )}
                                {/* Redo subtasks button when subtasks exist */}
                                {subtasks && (
                                    <button onClick={() => handleRedoSubtasks(pillarKey, tid, task)} disabled={!!autoExecuting}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 transition-all disabled:opacity-50">
                                        <RefreshCw className="w-3 h-3" />
                                        Refazer Subtarefas
                                    </button>
                                )}
                            </>
                        ) : (
                            <button onClick={() => handleAITryUserTask(pillarKey, task)} disabled={!!autoExecuting || isExecuting}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 transition-all disabled:opacity-50">
                                {isExecuting ? <><Loader2 className="w-3 h-3 animate-spin" />Tentando...</>
                                    : <><Wand2 className="w-3 h-3" />Delegar para IA</>}
                            </button>
                        )}
                    </div>
                )}

                {/* Stop button while executing */}
                {(isAutoExec || isExecuting || isExpanding) && (
                    <div className="flex flex-wrap gap-2 mt-2">
                        <button onClick={() => handleStopExecution(tid)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-all">
                            <AlertTriangle className="w-3 h-3" />
                            Parar Execução
                        </button>
                        {/* Additional stop button for auto-execution */}
                        {isAutoExec && (
                            <button onClick={() => handleStopExecution(tid)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-orange-500/15 text-orange-400 hover:bg-orange-500/25 transition-all">
                                <AlertTriangle className="w-3 h-3" />
                                Parar Auto-execução
                            </button>
                        )}
                    </div>
                )}

                {/* Redo task button for completed tasks or failed partial execution */}
                {(isDone || deliverable || (hasExecPanel && !isAutoExec)) && (
                    <div className="flex flex-wrap gap-2 mt-2">
                        <button onClick={() => handleRedoTask(pillarKey, tid, task)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium bg-white/[0.02] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.05] transition-all border border-white/[0.02]">
                            <RefreshCw className="w-2.5 h-2.5 opacity-40" />
                            Refazer Tarefa
                        </button>
                        {/* Additional redo button for tasks with subtasks */}
                        {subtasks && (
                            <button onClick={() => handleRedoTask(pillarKey, tid, task)}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium bg-blue-500/[0.03] text-blue-400/60 hover:text-blue-400 hover:bg-blue-500/10 transition-all border border-blue-500/[0.05]">
                                <RefreshCw className="w-2.5 h-2.5 opacity-40" />
                                Refazer Tudo
                            </button>
                        )}
                    </div>
                )}

                {/* Deliverable */}

                {/* Sources from deliverable */}
                {
                    (deliverable?.sources?.length > 0 || deliverable?.fontes_consultadas?.length > 0) && (
                        <SourceBadgeList sources={[...(deliverable.sources || []), ...(deliverable.fontes_consultadas || [])]} maxVisible={4} />
                    )
                }

                {/* Subtasks — hide when exec panel already shows them */}
                {
                    subtasks && !isAutoExec && !hasExecPanel && <SubtaskList subtasks={subtasks} color={PILLAR_META[pillarKey]?.color || '#8b5cf6'}
                        onExecute={() => { }} executingId={null} />
                }
            </div >
        );
    };

    // ═══════════════════════════════════════════════════════
    // RENDER: Expanded Pillar View
    // ═══════════════════════════════════════════════════════
    if (selectedPillar) {
        const meta = PILLAR_META[selectedPillar];
        const Icon = meta?.icon || Users;
        const state = pillarStates[selectedPillar];
        const plan = state?.plan?.plan_data;
        const tarefas: TaskItem[] = plan?.tarefas || plan?.acoes || [];
        const deps = state?.dependencies || { ready: true, blockers: [], warnings: [] };
        const done = completedTasks[selectedPillar] || new Set<string>();
        const dim = dims[selectedPillar] || {};
        const dimScore = dim?.score ?? 0;
        const isLoading = loadingPillar === selectedPillar;

        if (isLoading || !plan) {
            return (
                <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
                    <div className="text-center max-w-md px-6">
                        {error ? (
                            <>
                                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                                    <AlertCircle className="w-6 h-6 text-red-500" />
                                </div>
                                <h3 className="text-white font-semibold mb-2">Erro ao carregar o pilar</h3>
                                <p className="text-zinc-400 text-sm mb-6">{error}</p>
                                <div className="flex flex-col gap-3">
                                    <button
                                        onClick={() => handleSelectPillar(selectedPillar)}
                                        className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-all text-sm font-medium flex items-center justify-center gap-2"
                                    >
                                        <RotateCcw className="w-4 h-4" /> Tentar Novamente
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSelectedPillar(null);
                                            if (businessId) router.push(`/analysis/${businessId}/especialistas`);
                                        }}
                                        className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
                                    >
                                        Voltar para o Hub
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" style={{ color: meta?.color }} />
                                <p className="text-zinc-400 text-sm font-medium">O especialista está analisando e criando tarefas...</p>
                                <p className="text-zinc-600 text-xs mt-2 leading-relaxed">
                                    Pesquisando dados reais + cruzando com outros pilares para gerar recomendações personalizadas.
                                </p>
                                <div className="mt-8 pt-8 border-t border-zinc-800/50">
                                    <p className="text-[10px] text-zinc-700 uppercase tracking-widest font-semibold mb-1">Status</p>
                                    <p className="text-xs text-zinc-500 animate-pulse">Iniciando protocolo de análise profunda...</p>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            );
        }

        const totalTasks = tarefas.length;
        const completedCount = tarefas.filter(t => done.has(t.id)).length;
        const aiTasks = tarefas.filter(t => t.executavel_por_ia);
        const userTasks = tarefas.filter(t => !t.executavel_por_ia);
        const planSources = plan.sources || [];
        const entregaveis = plan.entregaveis || []; // Declaração local dentro do escopo do render

        // Get market data sources for this pillar
        const mktCats = marketData?.categories || [];
        const mktCat = mktCats.find((c: any) => c.id === selectedPillar);
        const mktSources = mktCat?.fontes || [];
        const allSources = [...new Set([...planSources, ...mktSources])];

        return (
            <div className="h-screen bg-[#09090b] flex">
                {/* Left Column - Header and Sources */}
                <div className="w-1/2 border-r border-zinc-800 flex flex-col pt-0 relative z-0 overflow-hidden">
                    <div className="p-6 pb-4">
                        <div className="flex justify-end mb-6 relative z-20">
                            <button onClick={() => {
                                setSelectedPillar(null);
                                if (businessId) router.push(`/analysis/${businessId}/especialistas`);
                            }}
                                className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 transition-colors text-sm">
                                <ArrowLeft className="w-4 h-4" /> Voltar para os Especialistas
                            </button>
                        </div>



                        {/* Header */}
                        <div className="flex items-start justify-between gap-4 mb-6">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                                    style={{ backgroundColor: `${meta.color}12` }}>
                                    <Icon className="w-4 h-4" style={{ color: meta.color, width: 22, height: 22 }} />
                                </div>
                                <div className="flex-1">
                                    <h1 className="text-xl font-bold text-white">{plan.titulo_plano || meta.label}</h1>
                                    <p className="text-zinc-500 text-xs mt-0.5">
                                        {specialists[selectedPillar]?.cargo || meta.label}
                                    </p>
                                    <p className="text-zinc-400 text-sm mt-1">{safeRender(plan.objetivo)}</p>
                                </div>
                            </div>

                            {/* Actions Header */}
                            <div>
                                <button
                                    onClick={() => handleRedoPillar(selectedPillar)}
                                    title="Apagar e Refazer Todo o Pilar"
                                    className="p-2 border border-red-500/20 text-red-400/70 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/50 rounded-lg transition-all"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Sources Section */}
                    {allSources.length > 0 && (
                        <div className="flex-1 px-6 pb-6">
                            <div className="p-4 rounded-xl">
                                <div className="flex items-center gap-2 mb-3">
                                    <img src="/google.png" alt="Fontes" className="w-4 h-4" />
                                    <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Fontes Pesquisadas</span>
                                    <span className="text-[9px] text-zinc-600 ml-auto">{allSources.length} fontes</span>
                                </div>
                                <SourceBadgeList sources={allSources} maxVisible={4} />

                            </div>

                            {/* Entregáveis Checklist */}
                            {entregaveis.length > 0 && (
                                <div className="mt-4">
                                    <div className="flex items-center gap-2 mb-3 px-4">
                                        <Target className="w-4 h-4" style={{ color: meta.color }} />
                                        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Entregáveis</span>
                                        <span className="text-[9px] text-zinc-600 ml-auto">
                                            {entregaveis.filter((e: any) =>
                                                e.status === 'concluido' ||
                                                (e.tarefa_origem && (done.has(e.tarefa_origem) || done.has(`${selectedPillar}_${e.tarefa_origem}`)))
                                            ).length}/{entregaveis.length}
                                        </span>
                                    </div>

                                    {/* Cards em leque com perspectiva */}
                                    <div className="relative h-64 flex items-center justify-center">
                                        {/* Edge masks to simulate cards slipping under sidebars */}
                                        <div className="pointer-events-none absolute inset-y-0 -left-12 w-12 bg-[#09090b]" />
                                        <div className="pointer-events-none absolute inset-y-0 -right-12 w-12 bg-[#09090b]" />
                                        {entregaveisOrder.map((originalIndex, displayIndex) => {
                                            const entregavel = entregaveis[originalIndex];
                                            if (!entregavel) return null;

                                            const isCompleted = entregavel.status === 'concluido' ||
                                                (entregavel.tarefa_origem && (done.has(entregavel.tarefa_origem) || done.has(`${selectedPillar}_${entregavel.tarefa_origem}`)));

                                            const totalCards = entregaveisOrder.length;
                                            const middleIndex = Math.floor(totalCards / 2);

                                            // Detectar ferramenta para este entregável
                                            const toolInfo = getToolInfo({
                                                entregavel_titulo: entregavel.titulo,
                                                conteudo: entregavel.descricao,
                                                entregavel_tipo: ''
                                            });

                                            // Ângulos fixos para arranjo em leque
                                            let angle = 0;
                                            let translateX = 0;
                                            if (displayIndex < middleIndex) {
                                                // Cards à esquerda: inclinação para a esquerda (-15°, -30°, -45°...)
                                                angle = -(middleIndex - displayIndex) * 15;
                                                translateX = -(middleIndex - displayIndex) * 120; // Move mais para a esquerda
                                            } else if (displayIndex > middleIndex) {
                                                // Cards à direita: inclinação para a direita (15°, 30°, 45°...)
                                                angle = (displayIndex - middleIndex) * 15;
                                                translateX = (displayIndex - middleIndex) * 120; // Move mais para a direita
                                            }
                                            // Card do meio fica reto (angle = 0, translateX = 0)

                                            // O card do meio (reto) fica na frente
                                            const isMiddleCard = displayIndex === middleIndex;
                                            const zStackBase = 6;
                                            const depthOffset = Math.abs(displayIndex - middleIndex);
                                            const zIndex = Math.max(1, zStackBase - depthOffset);

                                            const cardBgClass = isMiddleCard
                                                ? 'bg-zinc-800 shadow-2xl shadow-black/80'
                                                : 'bg-zinc-900 hover:bg-[#202024] shadow-xl shadow-black/50';

                                            const titleClass = isCompleted
                                                ? 'text-zinc-500 line-through'
                                                : (isMiddleCard ? 'text-white' : 'text-zinc-400');

                                            return (
                                                <div
                                                    key={entregavel.id || originalIndex}
                                                    className={`absolute w-96 p-3 rounded-xl overflow-hidden cursor-pointer transition-all duration-150 hover:scale-105 ${cardBgClass}`}
                                                    style={{
                                                        transform: `translateX(${translateX}px) rotate(${angle}deg) translateY(${Math.abs(angle) * 0.5}px) translateZ(${zIndex}px)`,
                                                        zIndex: zIndex,
                                                    }}
                                                    onClick={() => handleReorderEntregaveis(originalIndex)}
                                                    role="button"
                                                    tabIndex={0}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault();
                                                            handleReorderEntregaveis(originalIndex);
                                                        }
                                                    }}
                                                >
                                                    {isCompleted && (
                                                        <div className="absolute top-2 left-2 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center z-30 shadow-lg">
                                                            <Check className="w-3 h-3 text-white" />
                                                        </div>
                                                    )}

                                                    {/* Header com ícone da ferramenta */}
                                                    <div className="flex items-center gap-2.5 mb-2">
                                                        <div className="relative w-7 h-7 shrink-0">
                                                            <img src={toolInfo.icon} alt={toolInfo.name} className={`w-full h-full rounded object-contain ${isMiddleCard ? '' : 'opacity-60 grayscale'}`} />
                                                        </div>
                                                        <div className="flex-1 flex items-center gap-2 text-left min-w-0 whitespace-nowrap">
                                                            <span className={`text-[13px] font-medium ${titleClass}`}>
                                                                {safeRender(entregavel.titulo)}
                                                            </span>
                                                            <span className={`text-[11px] ${toolInfo.color} ${isMiddleCard ? '' : 'opacity-70'}`}>
                                                                {toolInfo.name}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Descrição */}
                                                    {entregavel.descricao && (
                                                        <p className="text-[11px] text-zinc-600 leading-tight mb-2">
                                                            {safeRender(entregavel.descricao)}
                                                        </p>
                                                    )}

                                                    {/* Footer */}
                                                    <div className="flex items-center justify-between pt-2 border-t border-white/[0.05]">
                                                        {entregavel.tarefa_origem && (
                                                            <span className="text-[9px] text-zinc-600">
                                                                T{entregavel.tarefa_origem}
                                                            </span>
                                                        )}
                                                        {displayIndex !== 0 && (
                                                            <span className="text-[8px] text-zinc-600 italic">
                                                                Clique para mover
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Right Column - Tasks */}
                <div className="w-1/2 flex flex-col pt-0 relative z-30">
                    {/* Top Progress Bar - Glued to the top */}
                    {totalTasks > 0 && (
                        <div className="w-full flex-shrink-0">
                            <div className="h-[2px] w-full bg-zinc-800/30">
                                <div className="h-full transition-all duration-700 ease-out"
                                    style={{ width: `${(completedCount / totalTasks) * 100}%`, backgroundColor: meta.color }} />
                            </div>
                            <div className="px-6 py-1">
                                <span className="text-[9px] font-mono text-zinc-600 uppercase">
                                    {completedCount} de {totalTasks} tarefas
                                </span>
                            </div>
                        </div>
                    )}
                    <div className="p-6 pb-4">
                        {/* Dependencies */}
                        {(deps.blockers?.length > 0 || deps.warnings?.length > 0) && (
                            <div className={`mb-4 p-3 rounded-lg ${deps.blockers?.length > 0
                                ? 'bg-red-500/[0.04]' : 'bg-amber-500/[0.04]'}`}>
                                <div className="flex items-center gap-2 mb-2">
                                    <Link2 className="w-4 h-4 text-amber-400" />
                                    <span className="text-xs font-semibold text-amber-400">Dependências</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {(deps.blockers || []).map((b: any) => <DepBadge key={b.pillar} dep={b} />)}
                                    {(deps.warnings || []).map((w: any) => <DepBadge key={w.pillar} dep={w} />)}
                                </div>
                            </div>
                        )}



                        {error && (
                            <div className="mb-4 p-3 rounded-xl bg-red-950/30 text-red-200 text-sm">
                                {error}
                                <button onClick={() => setError('')} className="ml-2 text-red-400 underline text-xs">Fechar</button>
                            </div>
                        )}
                    </div>

                    {/* Tasks List */}
                    {/* Tasks List Area */}
                    <div className="flex-1 px-3 pb-28 overflow-visible flex flex-col relative">
                        {focusedTaskId ? (
                            <div className="flex-1 flex flex-col h-full">
                                {/* Back UI */}
                                <div className="px-3 pb-6">
                                    <button
                                        onClick={() => setFocusedTaskId(null)}
                                        className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 transition-all text-[10px] uppercase tracking-widest font-bold"
                                    >
                                        <ArrowLeft className="w-3 h-3" /> Voltar
                                    </button>
                                </div>

                                {/* Execution Stream / Subtasks Area */}
                                <div className="flex-1 px-1 flex flex-col-reverse">
                                    <div className="flex flex-col gap-2">
                                        {/* Main content area that grows upwards */}
                                        {tarefas.find(t => `${selectedPillar}_${t.id}` === focusedTaskId) && (() => {
                                            const task = tarefas.find(t => `${selectedPillar}_${t.id}` === focusedTaskId)!;
                                            const tid = focusedTaskId;
                                            const subtasks = taskSubtasks[tid]?.subtarefas || autoExecSubtasks[tid] || [];
                                            const statuses = autoExecStatuses[tid] || {};
                                            const results = autoExecResults[tid] || {};
                                            const isAutoExec = autoExecuting === tid;

                                            return (
                                                <div className="space-y-2">
                                                    {subtasks.map((st: any, i: number) => {
                                                        const status = statuses[i] || 'waiting';
                                                        if (status === 'waiting' && !isAutoExec) return null;
                                                        const result = results[i];

                                                        return (
                                                            <div key={i} className="p-3 bg-white/[0.02] border border-white/[0.03] rounded-lg">
                                                                <div className="flex items-start gap-3">
                                                                    <div className="mt-0.5">
                                                                        {status === 'running' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" /> :
                                                                            status === 'done' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> :
                                                                                <Circle className="w-3.5 h-3.5 text-zinc-900" />}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center justify-between mb-1">
                                                                            <p className={`text-[12px] font-medium leading-relaxed ${status === 'done' ? 'text-zinc-500' : 'text-zinc-100'}`}>
                                                                                {st.titulo}
                                                                            </p>
                                                                            <span className="text-[9px] text-zinc-700 font-mono shrink-0">#{i + 1}</span>
                                                                        </div>
                                                                        {status === 'done' && result && (
                                                                            <div className="mt-2 pt-2 border-t border-white/[0.02]">
                                                                                <div className="max-h-60 pr-1 text-[11px] text-zinc-400">
                                                                                    {i === autoExecStep - 2 ? (
                                                                                        <StreamingText text={safeRender(result.conteudo)} speed={8} />
                                                                                    ) : (
                                                                                        <MarkdownContent content={safeRender(result.conteudo)} />
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}

                                                    {/* Summary generation */}
                                                    {isAutoExec && autoExecStep > autoExecTotal && autoExecTotal > 0 && (
                                                        <div className="p-3 flex items-center gap-2">
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                                                            <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Processando...</p>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>

                                {/* Fixed Footer - The Main Task */}
                                <div className="absolute bottom-8 sm:bottom-10 md:bottom-12 left-0 right-0 pt-4 bg-[#09090b] transform -translate-y-3 sm:-translate-y-5">
                                    {tarefas.find(t => `${selectedPillar}_${t.id}` === focusedTaskId) && (() => {
                                        const task = tarefas.find(t => `${selectedPillar}_${t.id}` === focusedTaskId)!;
                                        const tid = focusedTaskId;
                                        const isDone = done.has(task.id) || done.has(tid);

                                        const isAI = task.executavel_por_ia;
                                        const taskIndex = tarefas.indexOf(task);

                                        return (
                                            <div className="px-1">
                                                <div className="w-full flex flex-col ">
                                                    <div className="w-full flex flex-col sm:items-start px-4 py-3 rounded-xl bg-white/[0.06]">
                                                        <div className="flex flex-col gap-2 flex-1 min-w-0">
                                                            <div className="flex items-start gap-2 w-full text-left">
                                                                <span className="text-[13px] font-medium text-white leading-snug">
                                                                    {task.titulo}
                                                                </span>
                                                                {isDone && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                                                            </div>

                                                            <div className="flex flex-wrap items-center gap-2 text-left text-[11px] text-zinc-500">
                                                                <span className="font-mono text-zinc-400">#{taskIndex + 1}</span>
                                                                <span>{isAI ? 'Inteligência Artificial' : 'Ações Manuais'}</span>
                                                                {task.prioridade && (
                                                                    <>
                                                                        <span className="w-1 h-1 rounded-full bg-zinc-700" />
                                                                        <span className={`${task.prioridade === 'critica'
                                                                            ? 'text-red-400'
                                                                            : task.prioridade === 'alta'
                                                                                ? 'text-amber-400'
                                                                                : 'text-zinc-400'}`}>
                                                                            {task.prioridade}
                                                                        </span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="w-full border-t border-white/[0.05] pt-4 mt-1 sm:border-t-0 sm:pl-5 sm:pt-0">
                                                            <TaskActions task={task} pillarKey={selectedPillar} tid={tid} isDone={isDone} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-xl overflow-hidden p-1.5 h-full flex flex-col">
                                <div className="px-3 pt-2 pb-1.5 flex items-center justify-between">
                                    <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Tarefas</span>
                                    <span className="text-[9px] font-mono text-zinc-700 uppercase">
                                        {completedCount} / {totalTasks}
                                    </span>
                                </div>

                                <section className="space-y-0.5 flex-1 pr-1">
                                    {tarefas.map((task, i) => {
                                        const tid = `${selectedPillar}_${task.id}`;
                                        const isDone = done.has(task.id) || done.has(tid);
                                        const isAI = task.executavel_por_ia;
                                        const isExpanded = expandedTaskIds.has(tid);
                                        const isFocused = focusedTaskId === tid;

                                        const handleTaskClick = () => {
                                            setFocusedTaskId(tid);
                                            // Also expand if not expanded
                                            if (!isExpanded) {
                                                setExpandedTaskIds(prev => new Set(prev).add(tid));
                                            }
                                        };

                                        const deliverable = taskDeliverables[tid];
                                        const subtasksList = taskSubtasks[tid]?.subtarefas || autoExecSubtasks[tid] || [];
                                        const subtasksCount = subtasksList.length;

                                        // Dynamic Icon Logic
                                        const tool = (task.ferramenta || '').toLowerCase();
                                        let baseIcon = null;

                                        if (tool.includes('docs') || tool.includes('document')) {
                                            baseIcon = <img src="/docs.png" className="w-[26px] h-[26px] rounded shrink-0 object-contain" alt="Docs" />;
                                        } else if (tool.includes('sheets') || tool.includes('planilha')) {
                                            baseIcon = <img src="/sheets.png" className="w-[26px] h-[26px] rounded shrink-0 object-contain" alt="Sheets" />;
                                        } else if (tool.includes('canva')) {
                                            baseIcon = <img src="/canva.png" className="w-[26px] h-[26px] rounded shrink-0 object-contain" alt="Canva" />;
                                        } else if (tool.includes('excel')) {
                                            baseIcon = <img src="/excel.png" className="w-[26px] h-[26px] rounded shrink-0 object-contain" alt="Excel" />;
                                        } else if (tool.includes('google') || tool.includes('search')) {
                                            baseIcon = <img src="/google.png" className="w-[26px] h-[26px] rounded shrink-0 object-contain" alt="Google" />;
                                        } else if (isAI) {
                                            const modelInfo =
                                                aiModel === 'gemini' ? { img: '/gemini.png', label: 'Gemini' } :
                                                    aiModel === 'groq' ? { img: '/groq llama.png', label: 'Groq' } :
                                                        { img: '/openrouter.png', label: 'OpenRouter' };
                                            baseIcon = <img src={modelInfo.img} className="w-[26px] h-[26px] rounded shrink-0 object-contain" alt={modelInfo.label} />;
                                        } else {
                                            baseIcon = <Circle className="w-[26px] h-[26px] text-zinc-800" />;
                                        }

                                        const taskIcon = (
                                            <div className="relative">
                                                {baseIcon}
                                                {isDone && (
                                                    <div className="absolute -top-1.5 -left-1.5 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg border-none">
                                                        <Check className="w-2.5 h-2.5 text-white" strokeWidth={4} />
                                                    </div>
                                                )}
                                            </div>
                                        );

                                        return (
                                            <div key={task.id} className="group">
                                                <button
                                                    onClick={handleTaskClick}
                                                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all duration-300 ease-out cursor-pointer ${isExpanded ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'} ${isFocused ? 'task-card-leave pointer-events-none' : ''}`}
                                                >
                                                    <div className="w-8 h-8 flex items-center justify-center shrink-0">
                                                        {taskIcon}
                                                    </div>

                                                    <div className="flex-1 min-w-0 flex flex-col items-start gap-0.5">
                                                        <div className="flex items-center gap-2 w-full text-left">
                                                            <span className={`text-[13px] font-medium truncate ${isExpanded ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-300'}`}>
                                                                {task.titulo}
                                                            </span>
                                                            {isDone && <Check className="w-3.5 h-3.5 text-blue-400" />}
                                                        </div>

                                                        <div className="flex items-center gap-2 whitespace-nowrap overflow-hidden text-left">
                                                            <span className="text-[11px] text-zinc-600">#{i + 1}</span>
                                                            <span className="text-[11px] text-zinc-600">
                                                                {isAI ? 'Inteligência Artificial' : 'Ações Manuais'}
                                                            </span>
                                                            {task.prioridade && (
                                                                <>
                                                                    <span className="w-1 h-1 rounded-full bg-zinc-800" />
                                                                    <span className={`text-[11px] ${task.prioridade === 'critica' ? 'text-red-500/50' : task.prioridade === 'alta' ? 'text-amber-500/50' : 'text-zinc-600'}`}>
                                                                        {task.prioridade}
                                                                    </span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="shrink-0 text-zinc-600 group-hover:text-zinc-400 transition-colors">
                                                        <ChevronRight className="w-3.5 h-3.5" />
                                                    </div>
                                                </button>
                                            </div>
                                        );
                                    })}
                                </section>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#09090b]">
            <div className="max-w-4xl mx-auto px-6 py-12">

                {/* Header with score + business info */}
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-white tracking-tight">{userProfile.name}</h1>
                    <p className="text-zinc-500 text-sm mt-1">{userProfile.segment}</p>
                    <div className="mt-4 flex justify-center">
                        <ScoreRing score={scoreGeral} size={72} color={scoreGeral >= 70 ? '#10b981' : scoreGeral >= 40 ? '#f59e0b' : '#ef4444'} />
                    </div>
                    {classificacao && (
                        <span className={`inline-block mt-3 text-xs font-medium px-3 py-1 rounded-full ${scoreGeral >= 70
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : scoreGeral >= 40 ? 'text-amber-400 bg-amber-500/10'
                                : 'text-red-400 bg-red-500/10'}`}>
                            {safeRender(classificacao)}
                        </span>
                    )}
                    {resumo && (
                        <p className="text-zinc-400 text-sm mt-3 max-w-xl mx-auto leading-relaxed">{safeRender(resumo)}</p>
                    )}
                </div>

                {/* Action bar */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xs font-semibold text-zinc-600 uppercase tracking-[0.2em]">
                        Seus 7 Especialistas
                    </h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => exportFullAnalysis(session, setLoadingFullExport, {
                                profile, score, specialists, marketData, taskPlan: pillarStates
                            }, userProfile.name)}
                            disabled={loadingFullExport}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${!session?.accessToken ? 'bg-blue-500/10 text-blue-400' : 'text-zinc-400 hover:text-zinc-200'}`}>
                            {loadingFullExport ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                                    Gerando Doc...
                                </>
                            ) : (
                                <>
                                    <img src="/docs.png" alt="" className="w-5 h-5" />
                                    {!session?.accessToken ? 'Login c/ Google' : 'Abrir no Docs'}
                                </>
                            )}
                        </button>
                        <button onClick={onRedo}
                            className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg bg-zinc-800/40 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors">
                            <RefreshCw className="w-3 h-3" /> Reanalisar
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="mb-4 p-3 rounded-xl bg-red-950/30 text-red-200 text-sm">
                        {error}
                        <button onClick={() => setError('')} className="ml-2 text-red-400 underline text-xs">Fechar</button>
                    </div>
                )}

                {/* Pillar Cards with diagnostic info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {PILLAR_ORDER.map((key) => {
                        const meta = PILLAR_META[key];
                        const Icon = meta.icon;
                        const dim = dims[key] || {};
                        const s = typeof dim.score === 'number' ? dim.score : 0;
                        const spec = specialists[key] || {};
                        const isLoading = loadingPillar === key;
                        const statusBadge = s >= 70 ? { text: 'Forte', cls: 'text-emerald-400 bg-emerald-500/10' }
                            : s >= 40 ? { text: 'Atenção', cls: 'text-amber-400 bg-amber-500/10' }
                                : s > 0 ? { text: 'Crítico', cls: 'text-red-400 bg-red-500/10' }
                                    : { text: 'Sem dados', cls: 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20' };
                        const cached = pillarStates[key];
                        const hasPlan = cached?.plan?.plan_data;
                        const progress = cached?.progress;

                        return (
                            <div key={key}
                                className="flex flex-col text-left p-5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] transition-all duration-200 group cursor-pointer relative"
                                onClick={() => !isLoading && handleSelectPillar(key)}>

                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="p-2 rounded-lg" style={{ backgroundColor: `${meta.color}12` }}>
                                            <Icon className="w-4 h-4" style={{ color: meta.color }} />
                                        </div>
                                        {isLoading
                                            ? <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />
                                            : <ChevronRight className="w-4 h-4 text-zinc-800 group-hover:text-zinc-500 transition-colors" />}
                                    </div>

                                    <h3 className="text-white text-sm font-semibold mb-0.5">{meta.label}</h3>
                                    <p className="text-zinc-600 text-[11px] mb-2">{spec.cargo || ''}</p>

                                    <div className="flex items-center gap-2.5 mb-2">
                                        <ScoreRing score={s} size={36} color={meta.color} />
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${statusBadge.cls}`}>
                                            {statusBadge.text}
                                        </span>
                                    </div>

                                    {/* Diagnostic justificativa inline */}
                                    {dim.justificativa && (
                                        <p className="text-zinc-600 text-[10px] leading-relaxed line-clamp-2 mb-1">
                                            {safeRender(dim.justificativa)}
                                        </p>
                                    )}

                                    {hasPlan && progress && (
                                        <div className="mt-1">
                                            <div className="flex items-center justify-between text-[10px] text-zinc-600 mb-1">
                                                <span>{progress.completed || 0}/{progress.total || 0} tarefas</span>
                                            </div>
                                            <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                                                <div className="h-full rounded-full transition-all"
                                                    style={{ width: `${progress.total > 0 ? ((progress.completed || 0) / progress.total) * 100 : 0}%`, backgroundColor: meta.color }} />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Actions Footer */}
                                <div className="mt-4 pt-3 border-t border-white/[0.05] flex justify-end">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();

                                            // Format the context for export
                                            const mktCat = marketData?.categories?.find((c: any) => c.id === key);
                                            const mktInsights = mktCat?.resumo?.visao_geral ? `\n\n**Visão de Mercado:**\n${safeRender(mktCat.resumo.visao_geral)}\n${(mktCat.resumo.pontos_chave || []).map((p: any) => `• ${safeRender(p)}`).join('\n')}` : '';

                                            // Format the context to look like a deliverable
                                            const contextDeliverable = {
                                                id: `context_${key}`,
                                                entregavel_titulo: `Contexto de Análise: ${meta.label}`,
                                                conteudo_completo: `**Diagnóstico da IA:**\n${safeRender(dim.justificativa || 'Sem dados diagnósticos.')}\n\n**Meta do Pilar:**\n${safeRender(dim.meta_pilar || 'Não definida.')}\n\n**Principal Desafio/Oportunidade:**\n${safeRender(dim.dado_chave || 'Não identificado.')}${mktInsights}`,
                                                fontes_consultadas: mktCat?.fontes || []
                                            };

                                            openInGoogleDocs(contextDeliverable, meta.label, session, setLoadingDoc, `ctx_${key}`);
                                        }}
                                        disabled={loadingDoc === `ctx_${key}`}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${!session?.accessToken ? 'bg-blue-500/10 text-blue-400' : 'bg-white/[0.03] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'}`}
                                    >
                                        {loadingDoc === `ctx_${key}` ? <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" /> : <img src="/docs.png" alt="" className="w-4 h-4" />}
                                        {loadingDoc === `ctx_${key}` ? 'Gerando Doc...' : !session?.accessToken ? 'Login c/ Google' : 'Abrir no Docs'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
