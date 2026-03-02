'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    Users, Palette, Eye, ShoppingBag, TrendingUp, Megaphone, HandCoins,
    ChevronRight, ArrowLeft, Loader2, Bot, User as UserIcon,
    CheckCircle2, Circle, AlertTriangle, Link2, ExternalLink, AlertCircle, RotateCcw,
    Clock, BarChart3, ChevronDown, ChevronUp, Sparkles,
    RefreshCw, Play, FileText, ListTree, Wand2, Target,
    Layers, ArrowRight, Zap, Globe, Package, Loader, Check, X, Plus, Download, Search, Square
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useSession, signIn } from 'next-auth/react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

// ─── Constants ───
import { PILLAR_META, PILLAR_ORDER } from './constants';

// ─── Imports Modulares ───
import { PillarWorkspaceProps, TaskItem } from './types';
import { safeRender, openInGoogleDocs, exportFullAnalysis, getToolInfo } from './utils';
import { useTaskHandlers } from './handlers';
import { ScoreRing } from './components/ScoreRing';
import { DepBadge } from './components/DepBadge';
import { DeliverableCard } from './components/DeliverableCard';
import { SubtaskList } from './components/SubtaskList';
import { SourceBadgeList } from './components/SourceBadgeList';
import { MarkdownContent } from './components/MarkdownContent';
import { StreamingText } from './components/StreamingText';
import RateLimitWarning from '@/features/shared/components/rate-limit-warning';
import TaskCard from '@/features/workspace/components/task-card';
import TaskActionButtons from '@/features/workspace/components/task-action-buttons';
import TaskSubtasksDisplay from '@/features/workspace/components/task-subtasks-display';
import ModelSelector from '@/features/shared/components/model-selector';
import { SpecialistGrid } from './components/SpecialistGrid';

// Sub-component for auto-scrolling container
function AutoScrollContainer({ children }: { children: React.ReactNode }) {
    const scrollRef = React.useRef<HTMLDivElement>(null);

    React.useLayoutEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        const observer = new MutationObserver(() => {
            el.scrollTop = el.scrollHeight;
        });

        observer.observe(el, { childList: true, subtree: true, characterData: true, attributes: true });

        return () => observer.disconnect();
    }, []);

    return (
        <div ref={scrollRef} className="absolute inset-x-0 top-0 bottom-0 overflow-y-auto pb-48 scrollbar-hide flex flex-col">
            <div className="mt-auto">
                {children}
            </div>
        </div>
    );
}

export default function PillarWorkspace({
    score,
    specialists,
    analysisId,
    businessId,
    profile,
    marketData,
    userProfile,
    onRedo,
    onStateChange,
    initialActivePillar,
    aiModel,
    reanalysisState
}: PillarWorkspaceProps) {
    const { data: session } = useSession();
    const { aiModel: authAiModel } = useAuth();
    const router = useRouter();
    const DEFAULT_TASK_AI_MODEL = 'groq';
    const currentAiModel = aiModel || authAiModel || DEFAULT_TASK_AI_MODEL;
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
    // Force re-render key for TaskSubtasksDisplay
    const [subtasksUpdateKey, setSubtasksUpdateKey] = useState(0);
    const abortControllersRef = React.useRef<Record<string, AbortController>>({});
    const [selectedTaskAiModel, setSelectedTaskAiModel] = useState<string>(DEFAULT_TASK_AI_MODEL);

    // Rate limit states
    const [showRateLimitWarning, setShowRateLimitWarning] = useState(false);
    const [rateLimitError, setRateLimitError] = useState<string | null>(null);
    const [isRetrying, setIsRetrying] = useState(false);

    // Rate limit handlers
    const handleRetryWithNewModel = useCallback(async () => {
        setIsRetrying(true);
        setShowRateLimitWarning(false);
        // Retry logic would go here - for now just reset state
        setTimeout(() => {
            setIsRetrying(false);
            setRateLimitError(null);
        }, 2000);
    }, []);

    const handleCloseRateLimitWarning = useCallback(() => {
        setShowRateLimitWarning(false);
        setRateLimitError(null);
    }, []);

    const handleModelChange = useCallback((newModel: string) => {
        console.log('PillarWorkspace handleModelChange:', newModel);
        setSelectedTaskAiModel(newModel);
        // Close rate limit warning when user changes model
        if (showRateLimitWarning) {
            handleCloseRateLimitWarning();
        }
    }, [showRateLimitWarning, handleCloseRateLimitWarning]);

    // ─── localStorage persistence ───
    const prevAnalysisIdRef = React.useRef<string | null | undefined>(undefined);
    const [isStorageLoaded, setIsStorageLoaded] = useState(false);
    // Ref to track current analysisId for save effect — avoids stale writes when analysisId changes
    const analysisIdForSaveRef = React.useRef<string | null>(analysisId);

    // Combined load / reset effect — uses ref to distinguish first mount from reanalysis
    useEffect(() => {
        if (!analysisId) return;

        const previousAnalysisId = prevAnalysisIdRef.current;
        const isFirstMount = previousAnalysisId === undefined;
        const isReanalysis = !isFirstMount && previousAnalysisId !== analysisId;
        prevAnalysisIdRef.current = analysisId;

        if (isReanalysis) {
            // Clear cache on reanalysis to ensure fresh data
            apiCache.current.clear();
            console.log('🗑️ Cache cleared on reanalysis');

            // Reset all states
            setPillarStates({});
            setTaskDeliverables({});
            setTaskSubtasks({});
            setAutoExecuting(null);
            setAutoExecStep(0);
            setAutoExecTotal(0);
            setAutoExecLog([]);
            setAutoExecSubtasks({});
            setAutoExecResults({});
            setAutoExecStatuses({});
            setCompletedTasks({});
            setExpandedTaskIds(new Set());
            setShowKPIs(false);
            setSelectedTaskAiModel(DEFAULT_TASK_AI_MODEL);
            setError('');
            setIsStorageLoaded(true);

            // Clear old analysis localStorage AND pre-emptively clear new analysis localStorage
            // to prevent stale save-effect writes from being restored on re-mount
            if (previousAnalysisId) {
                localStorage.removeItem(`pillar_workspace_${previousAnalysisId}`);
            }
            localStorage.removeItem(`pillar_workspace_${analysisId}`);
            // Update save ref AFTER clearing so subsequent saves use new key with fresh state
            analysisIdForSaveRef.current = analysisId;
        } else if (isFirstMount) {
            // On first mount, we will load from localStorage in the next effect
            // We don't want to reset states here because it might wipe what we just restored
            console.log('🏗️ Initial mount for analysis:', analysisId);
        }
    }, [analysisId, currentAiModel]);

    // First mount: load persisted state from localStorage
    useEffect(() => {
        if (!analysisId) return;

        try {
            const saved = localStorage.getItem(`pillar_workspace_${analysisId}`);
            if (saved) {
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
            }
        } catch (e) {
            console.warn('Failed to load persisted state:', e);
        }
        setIsStorageLoaded(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [analysisId]);

    // useEffect(() => {
    //     if (!selectedPillar && Object.keys(score?.dimensoes || {}).length > 0) {
    //         setSelectedPillar(Object.keys(score.dimensoes)[0]);
    //     }
    // }, [score, selectedPillar]);



    // Keep analysisIdForSaveRef current so save effect always writes to correct key
    // IMPORTANT: this must stay separate from the save effect deps to avoid stale writes
    useEffect(() => {
        analysisIdForSaveRef.current = analysisId;
    }, [analysisId]);

    // Save state to localStorage on changes
    // NOTE: analysisId is intentionally NOT in deps — we use analysisIdForSaveRef instead.
    // This prevents the effect from firing when analysisId changes (before pillarStates resets),
    // which would write old pillarStates under the new analysis key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        const currentId = analysisIdForSaveRef.current;
        if (!currentId || !isStorageLoaded) return;
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
            localStorage.setItem(`pillar_workspace_${currentId}`, JSON.stringify({
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
    }, [completedTasks, taskDeliverables, taskSubtasks, autoExecSubtasks, autoExecResults, autoExecStatuses, pillarStates, isStorageLoaded]);

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

    // ─── API Cache ───
    const apiCache = React.useRef<Map<string, { data: any; timestamp: number }>>(new Map());
    const CACHE_DURATION = 300000; // 5 minutos (evita refetching constante em navegação lateral)

    // ─── API helper with Cache ───
    const normalizedReanalysisState = reanalysisState ?? { isReanalyzing: false };
    const isReanalyzing = normalizedReanalysisState.isReanalyzing;
    const apiCall = useCallback(async (action: string, data: any, options?: { signal?: AbortSignal; skipCache?: boolean }) => {
        const cacheKey = `${action}-${JSON.stringify(data)}`;
        const cached = apiCache.current.get(cacheKey);

        // Return cached data if available and not expired
        if (!options?.skipCache && cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            console.log('📦 Using cached API response for:', action);
            return cached.data;
        }

        console.log('🌐 Making fresh API call for:', action, 'with model:', selectedTaskAiModel);
        const requestBody = { action, ...data, aiModel: selectedTaskAiModel || currentAiModel };
        const res = await fetch('/api/growth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: options?.signal,
        });

        const result = await res.json();

        // Cache successful responses
        if (!options?.skipCache && res.ok) {
            apiCache.current.set(cacheKey, { data: result, timestamp: Date.now() });

            // Clean old cache entries periodically
            if (apiCache.current.size > 50) {
                const now = Date.now();
                for (const [key, value] of apiCache.current.entries()) {
                    if (now - value.timestamp > CACHE_DURATION * 2) {
                        apiCache.current.delete(key);
                    }
                }
            }
        }

        return result;
    }, [selectedTaskAiModel, currentAiModel]);

    // ─── Use Task Handlers Hook ───
    const taskHandlers = useTaskHandlers(
        analysisId ?? '',
        apiCall,
        profile,
        taskSubtasks,
        autoExecResults,
        setTaskSubtasks,
        setAutoExecuting,
        setAutoExecStep,
        setAutoExecTotal,
        setAutoExecLog,
        setAutoExecSubtasks,
        setAutoExecResults,
        setAutoExecStatuses,
        setTaskDeliverables,
        setCompletedTasks,
        setSubtasksUpdateKey,
        setError,
        setExpandingTask,
        abortControllersRef
    );

    // Only use handlers if we have a valid analysisId
    const {
        handleExpandSubtasks,
        handleAutoExecute,
        handleRedoTask,
        handleRedoSubtasks,
        handleStopExecution,
    } = analysisId ? taskHandlers : {
        handleExpandSubtasks: () => { },
        handleAutoExecute: () => { },
        handleRedoTask: () => { },
        handleRedoSubtasks: () => { },
        handleStopExecution: () => { },
    };

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

        // Clear auto-execution states for this pillar
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

        // Clear expanded tasks and focus for this pillar
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
            setExecutingTask(null);
        }

        setError('');
        setLoadingPillar(pillarKey); // Show loading spinner

        // Clear backend data
        try {
            await apiCall('redo-pillar', {
                analysis_id: analysisId,
                pillar_key: pillarKey,
            }, { skipCache: true });

            // Reload the pillar to get brand new tasks
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

    // ─── Hydrate subtasks and executions from DB ───
    const hydratePillarData = useCallback(async (key: string) => {
        // Skip if we already have some data for this pillar to avoid flickering/redundancy
        if (pillarStates[key]?.plan && Object.keys(taskSubtasks).some(tid => tid.startsWith(key + '_'))) {
            console.log(`⏩ Skipping hydration for ${key}, already has data.`);
            return;
        }

        try {
            // Fetch subtasks and executions in parallel
            const [subtasksRes, execsRes] = await Promise.all([
                apiCall('get-subtasks', { analysis_id: analysisId, pillar_key: key }),
                apiCall('get-pillar-executions', { analysis_id: analysisId, pillar_key: key }),
            ]);

            // Hydrate subtasks
            if (subtasksRes.success && subtasksRes.subtasks) {
                const savedSubtasks = subtasksRes.subtasks as Record<string, any>;
                for (const [taskId, stData] of Object.entries(savedSubtasks)) {
                    const tid = taskId.includes('_') ? taskId : `${key}_${taskId}`;
                    setTaskSubtasks(prev => ({ ...prev, [tid]: stData }));
                    // Also set up autoExec display data
                    const items = (stData as any)?.subtarefas || [];
                    if (items.length > 0) {
                        setAutoExecSubtasks(prev => ({ ...prev, [tid]: items }));
                    }
                }
                console.log(`📦 Hydrated ${Object.keys(savedSubtasks).length} subtask groups for ${key}`);
            }

            // Hydrate executions (deliverables)
            if (execsRes.success && execsRes.executions) {
                const savedExecs = execsRes.executions as Record<string, any>;
                const maxIdxPerTask: Record<string, number> = {};

                for (const [taskId, execData] of Object.entries(savedExecs)) {
                    const tid = taskId.includes('_') ? taskId : `${key}_${taskId}`;
                    const result = (execData as any).result_data;
                    if (result) {
                        // Set deliverable
                        setTaskDeliverables(prev => ({ ...prev, [tid]: result }));
                        // Mark as completed
                        setCompletedTasks(prev => {
                            const s = new Set(prev[key] || []);
                            s.add(taskId);
                            s.add(tid);
                            return { ...prev, [key]: s };
                        });
                        // Set autoExec status to done for this subtask index if it's a subtask execution
                        const stMatch = taskId.match(/_st(\d+)$/);
                        if (stMatch) {
                            const rawParentTid = taskId.replace(/_st\d+$/, '');
                            const parentTid = rawParentTid.includes('_') ? rawParentTid : `${key}_${rawParentTid}`;
                            const idx = parseInt(stMatch[1], 10) - 1;

                            setAutoExecResults(prev => ({
                                ...prev,
                                [parentTid]: { ...prev[parentTid] || {}, [idx]: result }
                            }));
                            setAutoExecStatuses(prev => ({
                                ...prev,
                                [parentTid]: { ...prev[parentTid] || {}, [idx]: 'done' }
                            }));
                        }
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
            // Primeiro tenta buscar o estado existente
            const stateResult = await apiCall('pillar-state', { analysis_id: analysisId, pillar_key: key });
            if (stateResult.success && stateResult.plan?.plan_data) {
                setPillarStates(prev => ({ ...prev, [key]: stateResult }));
                // Hydrate subtasks and executions from DB
                hydratePillarData(key);
                setLoadingPillar(null);
                return;
            }

            // Se não encontrar estado existente, tenta buscar as tarefas já existentes da análise
            const tasksResult = await apiCall('get-analysis-tasks', {
                analysis_id: analysisId,
                pillar_key: key
            });

            if (tasksResult.success && tasksResult.data && tasksResult.data.plan_data) {
                // Encontrou dados existentes, usa eles
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
                // Hydrate subtasks and executions from DB
                hydratePillarData(key);
                setLoadingPillar(null);
                return;
            }

            // Só gera novas tarefas se não encontrar nada existente
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

    const initialPillarRef = React.useRef<string | null>(null);

    // Listener para o initialActivePillar quando mudar de cima pra baixo (Hub -> Workspace)
    useEffect(() => {
        if (isStorageLoaded && initialActivePillar && initialActivePillar !== initialPillarRef.current) {
            initialPillarRef.current = initialActivePillar;
            handleSelectPillar(initialActivePillar);
        }
    }, [isStorageLoaded, initialActivePillar, handleSelectPillar]);

    // Reset any visual "expanded" highlight once the user leaves the task focus view
    useEffect(() => {
        if (!focusedTaskId) {
            setExpandedTaskIds(prev => (prev.size > 0 ? new Set() : prev));
        }
    }, [focusedTaskId]);

    // ─── Background Task Recovery ───
    const hasCheckedRecovery = React.useRef<Record<string, boolean>>({});

    useEffect(() => {
        if (!analysisId || !selectedPillar || autoExecuting) return;

        const state = pillarStates[selectedPillar];
        if (!state?.plan) return;

        const tasks = state.plan.plan_data.tarefas || [];

        // This effect runs when the pillar is loaded or analysis changes
        // We check if any tasks are already running on the server
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
                            break; // Only one task auto-executes at a time per UI logic
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
                // Ensure conteudo_completo exists for openInGoogleDocs consistency
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
        } catch (err: any) {
            if (err.name === 'AbortError') {
                setError('Execução cancelada pelo usuário.');
            } else {
                // Check for rate limit errors
                const errorMessage = err.message || '';
                if (errorMessage.includes('rate limit') ||
                    errorMessage.includes('TPD esgotado') ||
                    errorMessage.includes('429') ||
                    errorMessage.includes('limit exceeded')) {
                    setRateLimitError(errorMessage);
                    setShowRateLimitWarning(true);
                    setError('Limite de uso do modelo atingido. Tente outro modelo.');
                } else {
                    setError(err.message || 'Erro ao executar tarefa');
                }
            }
        } finally {
            if (abortControllersRef.current[tid]) delete abortControllersRef.current[tid];
            setExecutingTask(null);
        }
    }, [analysisId, businessId, profile, apiCall]);

    // ─── AI tries user task ───— delegates to specific backend endpoint ───
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
                // Normalize deliverable to include conteudo_completo for openInGoogleDocs
                const executionData = { ...execResult.execution, id: execResult.execution.id || task.id };
                if (!executionData.conteudo_completo && executionData.conteudo) {
                    executionData.conteudo_completo = executionData.conteudo;
                }
                // Save as deliverable so the "Abrir" button works
                setTaskDeliverables(prev => ({ ...prev, [tid]: executionData }));
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
                                ) : null}
                                {/* Redo subtasks button when subtasks exist */}
                                {(subtasks || isExpanding) && (
                                    <button onClick={() => {
                                        if (isExpanding) {
                                            handleStopExecution(tid);
                                        }
                                        handleRedoSubtasks(pillarKey, tid, task);
                                    }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] transition-all disabled:opacity-50">
                                        <RefreshCw className={`w-3 h-3 ${isExpanding ? 'animate-spin' : ''}`} />
                                        Refazer subtarefas
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

                {/* Redo task button for completed tasks, failed partial execution, or active execution */}
                {(isDone || deliverable || (hasExecPanel && !isAutoExec) || isAutoExec || isExecuting) && (
                    <div className="flex flex-wrap gap-2 mt-2">
                        <button onClick={() => {
                            if (isAutoExec || isExecuting) handleStopExecution(tid);
                            handleRedoTask(pillarKey, tid, task);
                        }}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium bg-white/[0.02] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.05] transition-all border border-white/[0.02]">
                            <RefreshCw className="w-2.5 h-2.5 opacity-40" />
                            Refazer Tarefa
                        </button>
                        {/* Additional redo button for tasks with subtasks */}
                        {subtasks && (
                            <button onClick={() => {
                                if (isAutoExec || isExecuting) handleStopExecution(tid);
                                handleRedoTask(pillarKey, tid, task);
                            }}
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

        const visibleTasks = tarefas.filter(t => t.executavel_por_ia);
        const totalTasks = visibleTasks.length;
        const completedCount = visibleTasks.filter(t => done.has(t.id)).length;
        const aiTasks = visibleTasks;
        const userTasks: TaskItem[] = [];
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
                                                    onClick={() => {
                                                        if (isMiddleCard) {
                                                            // If clicked card is the center one, open it
                                                            // We format it to match the deliverable structure expected by openInGoogleDocs
                                                            const tid = entregavel.tarefa_origem ? `${selectedPillar}_${entregavel.tarefa_origem}` : null;
                                                            const generatedDeliverable = tid ? taskDeliverables[tid] : null;

                                                            if (!generatedDeliverable) {
                                                                setError('Execute a tarefa para gerar o entregável completo antes de abrir no Google Docs.');
                                                                return;
                                                            }

                                                            openInGoogleDocs(generatedDeliverable, meta.label, session, setLoadingDoc, entregavel.id);
                                                        } else {
                                                            // Otherwise, move to center
                                                            handleReorderEntregaveis(originalIndex);
                                                        }
                                                    }}
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
                                                        {isMiddleCard ? (
                                                            <span className="text-[8px] text-blue-400 italic">
                                                                Clique para abrir no {toolInfo.name}
                                                            </span>
                                                        ) : (
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
                <div className="w-1/2 flex flex-col pt-0 relative z-30" style={{ backgroundColor: 'lab(5 0 0)' }}>
                    {/* Top Top Bar: Task Progress & Back Button (aligned with header) */}
                    {totalTasks > 0 && (
                        <div className="flex items-center justify-between px-6 pt-5 pb-3">
                            <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest">
                                {completedCount} de {totalTasks} tarefas
                            </span>
                        </div>
                    )}

                    <div className="px-6 pb-4 pt-2">
                        {focusedTaskId && (
                            <div className="mb-6 flex items-center justify-between relative z-20">
                                <button
                                    onClick={() => setFocusedTaskId(null)}
                                    className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 transition-colors text-sm"
                                >
                                    <ArrowLeft className="w-4 h-4" /> Voltar
                                </button>
                            </div>
                        )}
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
                        {/* Subtasks Execution Area - Above */}
                        {focusedTaskId && (
                            <div className="flex-1 flex flex-col mb-4 overflow-hidden pt-2">
                                <div className="w-full sm:pt-0 flex-1 flex flex-col overflow-hidden pb-2">
                                    {(() => {
                                        const task = visibleTasks.find(t => `${selectedPillar}_${t.id}` === focusedTaskId);
                                        if (!task) return null;
                                        const tid = focusedTaskId;
                                        const isDone = done.has(task.id) || done.has(tid);
                                        const isAI = task.executavel_por_ia;
                                        const taskIndex = visibleTasks.indexOf(task);

                                        return (
                                            <div className="w-full flex flex-col h-full gap-4">
                                                <div className="flex-1 relative overflow-hidden">
                                                    <AutoScrollContainer>
                                                        <TaskSubtasksDisplay
                                                            key={`result_${subtasksUpdateKey}`}
                                                            task={task}
                                                            pillarKey={selectedPillar}
                                                            tid={tid}
                                                            isDone={isDone}
                                                            subtasks={taskSubtasks[tid]}
                                                            autoExecSubtasks={autoExecSubtasks}
                                                            autoExecResults={autoExecResults}
                                                            autoExecStatuses={autoExecStatuses}
                                                            autoExecuting={autoExecuting}
                                                            autoExecStep={autoExecStep}
                                                            autoExecTotal={autoExecTotal}
                                                            color={PILLAR_META[selectedPillar]?.color}
                                                            taskDeliverables={taskDeliverables}
                                                            expandingTask={expandingTask}
                                                            executingTask={executingTask}
                                                            handleRetryAutoExecSubtask={handleRetryAutoExecSubtask}
                                                            safeRender={safeRender}
                                                            displayMode="result"
                                                        />
                                                    </AutoScrollContainer>
                                                </div>

                                                <div className="absolute bottom-6 left-4 right-4 max-w-4xl mx-auto flex flex-col gap-3 p-3 bg-[#09090b]/90 backdrop-blur-md border border-white/[0.05] shadow-2xl rounded-xl overflow-hidden z-50">
                                                    {/* Subtasks Execution Area outside lighter div */}
                                                    <div className="w-full">
                                                        <TaskSubtasksDisplay
                                                            key={`lines_${subtasksUpdateKey}`}
                                                            task={task}
                                                            pillarKey={selectedPillar}
                                                            tid={tid}
                                                            isDone={isDone}
                                                            subtasks={taskSubtasks[tid]}
                                                            autoExecSubtasks={autoExecSubtasks}
                                                            autoExecResults={autoExecResults}
                                                            autoExecStatuses={autoExecStatuses}
                                                            autoExecuting={autoExecuting}
                                                            autoExecStep={autoExecStep}
                                                            autoExecTotal={autoExecTotal}
                                                            color={PILLAR_META[selectedPillar]?.color}
                                                            taskDeliverables={taskDeliverables}
                                                            expandingTask={expandingTask}
                                                            executingTask={executingTask}
                                                            handleRetryAutoExecSubtask={handleRetryAutoExecSubtask}
                                                            safeRender={safeRender}
                                                            displayMode="subtasks"
                                                        />
                                                    </div>

                                                    {/* Lighter Inner Card for Task Details */}
                                                    <div className="w-full rounded-xl bg-white/[0.06] p-3 flex flex-col gap-2">
                                                        <div className="flex flex-col gap-2 flex-1 min-w-0 w-full mb-1">
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

                                                        {/* AI Selector and Action Buttons */}
                                                        <div className="w-full border-t border-white/[0.05] pt-3">
                                                            {/* Single Row Layout */}
                                                            <div className="flex items-center justify-between w-full">
                                                                {/* Left Side - AI Model Selector */}
                                                                <div className="flex items-center gap-2">
                                                                    {isAI && (
                                                                        <ModelSelector
                                                                            value={selectedTaskAiModel}
                                                                            onChange={setSelectedTaskAiModel}
                                                                        />
                                                                    )}
                                                                </div>

                                                                {/* Right Side - Action Buttons */}
                                                                <div className="flex items-center gap-1">
                                                                    {isAI ? (
                                                                        <>
                                                                            {(() => {
                                                                                const isGenerating = autoExecuting === tid && !taskSubtasks[tid];
                                                                                const isExecutingAuto = autoExecuting === tid && !!taskSubtasks[tid];
                                                                                return (
                                                                                    <>
                                                                                        {!taskSubtasks[tid] && (
                                                                                            <button
                                                                                                onClick={() => handleExpandSubtasks(selectedPillar, task)}
                                                                                                disabled={autoExecuting === tid}
                                                                                                className="flex items-center gap-2 h-7 px-3 rounded-lg bg-transparent hover:bg-white/5 transition-all duration-200 cursor-pointer disabled:opacity-50"
                                                                                                title={isGenerating ? 'Gerando...' : 'Gerar subtarefas'}
                                                                                            >
                                                                                                {isGenerating ? (
                                                                                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
                                                                                                ) : (
                                                                                                    <ListTree className="w-3.5 h-3.5 text-zinc-400" />
                                                                                                )}
                                                                                            </button>
                                                                                        )}
                                                                                        {taskSubtasks[tid] && !isDone && !taskDeliverables[tid] && (
                                                                                            <button
                                                                                                onClick={() => handleRedoSubtasks(selectedPillar, tid, task)}
                                                                                                disabled={autoExecuting === tid}
                                                                                                className="flex items-center gap-2 h-7 px-3 rounded-lg bg-transparent hover:bg-white/5 transition-all duration-200 cursor-pointer disabled:opacity-50"
                                                                                                title="Refazer subtarefas"
                                                                                            >
                                                                                                <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
                                                                                            </button>
                                                                                        )}
                                                                                        {(isExecutingAuto || isGenerating) ? (
                                                                                            <button
                                                                                                onClick={() => handleStopExecution(tid)}
                                                                                                className="flex items-center gap-2 h-7 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-all duration-200 cursor-pointer text-red-400"
                                                                                                title="Parar execução"
                                                                                            >
                                                                                                <Square className="w-3.5 h-3.5 fill-current" />
                                                                                                <span className="text-[11px] font-medium">Parar</span>
                                                                                            </button>
                                                                                        ) : (isDone || taskDeliverables[tid]) ? (
                                                                                            <button
                                                                                                onClick={() => handleRedoTask(selectedPillar, tid, task)}
                                                                                                className="flex items-center gap-2 h-7 px-3 rounded-lg bg-transparent hover:bg-white/5 transition-all duration-200 cursor-pointer disabled:opacity-50"
                                                                                                title="Refazer tarefa inteira"
                                                                                            >
                                                                                                <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
                                                                                                <span className="text-[11px] text-zinc-400 font-medium">Refazer Tarefa</span>
                                                                                            </button>
                                                                                        ) : (
                                                                                            <button
                                                                                                onClick={() => handleAutoExecute(selectedPillar, task)}
                                                                                                disabled={!!autoExecuting || expandingTask === tid}
                                                                                                className="flex items-center gap-2 h-7 px-3 rounded-lg bg-transparent hover:bg-white/5 transition-all duration-200 cursor-pointer disabled:opacity-50"
                                                                                                title={taskSubtasks[tid]
                                                                                                    ? `Executar ${(taskSubtasks[tid].subtarefas || []).length} subtarefas com IA`
                                                                                                    : 'Executar com IA'}
                                                                                            >
                                                                                                {isExecutingAuto ? (
                                                                                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
                                                                                                ) : (
                                                                                                    <Play className="w-3.5 h-3.5 text-zinc-400" />
                                                                                                )}
                                                                                                {taskSubtasks[tid] && (
                                                                                                    <span className="text-[11px] text-zinc-400 font-medium">
                                                                                                        {(taskSubtasks[tid].subtarefas || []).length} Tasks
                                                                                                    </span>
                                                                                                )}
                                                                                            </button>
                                                                                        )}
                                                                                    </>
                                                                                );
                                                                            })()}
                                                                        </>
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => handleAITryUserTask(selectedPillar, task)}
                                                                            disabled={!!autoExecuting || executingTask === tid}
                                                                            className="flex items-center gap-2 h-7 px-3 rounded-lg bg-transparent hover:bg-white/5 transition-all duration-200 cursor-pointer disabled:opacity-50"
                                                                            title={executingTask === tid ? 'Tentando...' : 'Delegar para IA'}
                                                                        >
                                                                            {executingTask === tid ? (
                                                                                <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
                                                                            ) : (
                                                                                <Wand2 className="w-3.5 h-3.5 text-zinc-400" />
                                                                            )}
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div >
                            </div>
                        )}

                        {/* Regular Tasks List - Below */}
                        {!focusedTaskId && (
                            <div className="rounded-xl overflow-visible p-1.5 h-full flex flex-col">
                                <section className="space-y-0.5 flex-1 pr-1 pt-2">
                                    {visibleTasks.map((task, i) => {
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

                                        // Persist subtasks visibility when executing even if collapsed
                                        const isActiveInList = (autoExecuting === tid || executingTask === tid || expandingTask === tid);

                                        return (
                                            <TaskCard
                                                key={task.id}
                                                task={task}
                                                index={i}
                                                isDone={isDone}
                                                isExpanded={isExpanded}
                                                isFocused={isFocused}
                                                isAI={isAI}
                                                onClick={handleTaskClick}
                                                aiModel={selectedTaskAiModel}
                                                disabled={normalizedReanalysisState.isReanalyzing}
                                                currentSubtask={
                                                    (autoExecuting === tid || executingTask === tid || expandingTask === tid)
                                                        ? (() => {
                                                            const isCreating = expandingTask === tid || (autoExecuting === tid && (!autoExecSubtasks?.[tid] || autoExecSubtasks[tid].length === 0));
                                                            if (isCreating) {
                                                                return { titulo: 'Criando subtarefas...', status: 'running' };
                                                            }
                                                            if (executingTask === tid) {
                                                                return { titulo: 'Delegando para IA...', status: 'running' };
                                                            }

                                                            const isSummary = (autoExecStep || 0) > (autoExecTotal || 0);
                                                            if (autoExecuting === tid && isSummary) {
                                                                return { titulo: 'Gerando resumo executivo...', status: 'running' };
                                                            }

                                                            const subtasks = autoExecSubtasks?.[tid] || [];
                                                            if (subtasks.length === 0) return undefined;

                                                            const statuses = autoExecStatuses?.[tid] || {};

                                                            let runningIndex = -1;
                                                            for (let i = 0; i < subtasks.length; i++) {
                                                                if (statuses[i] === 'running') {
                                                                    runningIndex = i;
                                                                    break;
                                                                }
                                                            }

                                                            if (runningIndex === -1) {
                                                                for (let i = 0; i < subtasks.length; i++) {
                                                                    if (!statuses[i] || statuses[i] === 'waiting') {
                                                                        runningIndex = i;
                                                                        break;
                                                                    }
                                                                }
                                                            }

                                                            if (runningIndex === -1) {
                                                                runningIndex = 0;
                                                            }

                                                            const subtask = subtasks[runningIndex];
                                                            const status = statuses[runningIndex] || 'waiting';

                                                            return subtask ? {
                                                                titulo: subtask.titulo,
                                                                status: status
                                                            } : undefined;
                                                        })()
                                                        : undefined
                                                }
                                                isSubtaskLoading={autoExecuting === tid || executingTask === tid || expandingTask === tid}
                                            >
                                                {/* Removido o TaskSubtasksDisplay duplicado para mostrar só o cardzinho simples */}
                                            </TaskCard>
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
        <SpecialistGrid
            userProfile={userProfile}
            scoreGeral={scoreGeral}
            classificacao={classificacao}
            resumo={resumo}
            dims={dims}
            specialists={specialists}
            loadingPillar={loadingPillar}
            pillarStates={pillarStates}
            completedTasks={completedTasks}
            marketData={marketData}
            session={session}
            profile={profile}
            score={score}
            analysisId={analysisId}
            businessId={businessId}
            loadingFullExport={loadingFullExport}
            setLoadingFullExport={setLoadingFullExport}
            loadingDoc={loadingDoc}
            setLoadingDoc={setLoadingDoc}
            onRedo={onRedo}
            handleSelectPillar={handleSelectPillar}
            error={error}
            setError={setError}
        />
    );
}
