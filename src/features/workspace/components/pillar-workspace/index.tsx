'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    ArrowLeft, Link2
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

// ─── Constants & Types ───
import { PILLAR_META } from './constants';
import { PillarWorkspaceProps, TaskItem } from './types';
import { safeRender } from './utils';

// ─── Hooks ───
import { useTaskHandlers } from './handlers';
import { useLocalStoragePersistence } from './hooks/useLocalStoragePersistence';
import { usePillarApi } from './hooks/usePillarApi';
import { usePillarExecution } from './hooks/usePillarExecution';
import { usePillarNavigation } from './hooks/usePillarNavigation';

// ─── Components ───
import { SpecialistGrid } from './components/SpecialistGrid';
import { LoadingErrorState } from './components/LoadingErrorState';
import { PillarHeader } from './components/PillarHeader';
import { TaskProgressBar } from './components/TaskProgressBar';
import { FocusedTaskView } from './components/FocusedTaskView';
import { TasksList } from './components/TasksList';
import { DepBadge } from './components/DepBadge';
import RateLimitWarning from '@/features/shared/components/rate-limit-warning';

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

    // ─── UI State ───
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
    const [entregaveisOrder, setEntregaveisOrder] = useState<number[]>([]);

    // ─── Auto-execution state ───
    const [autoExecuting, setAutoExecuting] = useState<string | null>(null);
    const [autoExecStep, setAutoExecStep] = useState<number>(0);
    const [autoExecTotal, setAutoExecTotal] = useState<number>(0);
    const [autoExecLog, setAutoExecLog] = useState<string[]>([]);
    const [autoExecSubtasks, setAutoExecSubtasks] = useState<Record<string, any[]>>({});
    const [autoExecResults, setAutoExecResults] = useState<Record<string, Record<number, any>>>({});
    const [autoExecStatuses, setAutoExecStatuses] = useState<Record<string, Record<number, 'waiting' | 'running' | 'done' | 'error'>>>({});
    const [subtasksUpdateKey, setSubtasksUpdateKey] = useState(0);
    const abortControllersRef = useRef<Record<string, AbortController>>({});

    // ─── UI Preferences ───
    const [selectedTaskAiModel, setSelectedTaskAiModel] = useState<string>(DEFAULT_TASK_AI_MODEL);
    const [activeRightTab, setActiveRightTab] = useState<'tasks' | 'docs'>('tasks');
    const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());

    // ─── Rate limit states ───
    const [showRateLimitWarning, setShowRateLimitWarning] = useState(false);
    const [rateLimitError, setRateLimitError] = useState<string | null>(null);
    const [isRetrying, setIsRetrying] = useState(false);

    const handleRetryWithNewModel = useCallback(async () => {
        setIsRetrying(true);
        setShowRateLimitWarning(false);
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
        if (showRateLimitWarning) {
            handleCloseRateLimitWarning();
        }
    }, [showRateLimitWarning, handleCloseRateLimitWarning]);

    // ─── Custom Hooks ───
    const { apiCall, clearCache } = usePillarApi(selectedTaskAiModel, currentAiModel);

    const { isStorageLoaded } = useLocalStoragePersistence({
        analysisId,
        currentAiModel,
        state: {
            completedTasks, taskDeliverables, taskSubtasks,
            autoExecSubtasks, autoExecResults, autoExecStatuses, pillarStates,
        },
        setters: {
            setPillarStates, setTaskDeliverables, setTaskSubtasks,
            setAutoExecuting, setAutoExecStep, setAutoExecTotal, setAutoExecLog,
            setAutoExecSubtasks, setAutoExecResults, setAutoExecStatuses,
            setCompletedTasks, setExpandedTaskIds, setShowKPIs, setSelectedTaskAiModel, setError,
        },
        defaultTaskAiModel: DEFAULT_TASK_AI_MODEL,
    });

    const taskHandlers = useTaskHandlers(
        analysisId ?? '',
        apiCall,
        profile,
        taskSubtasks,
        taskDeliverables,
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

    const {
        handleAIExecute,
        handleAITryUserTask,
        handleGenerateSummary,
        handleRetryAutoExecSubtask,
        handleUserComplete,
    } = usePillarExecution({
        analysisId, businessId, profile, apiCall,
        autoExecSubtasks, autoExecResults, abortControllersRef,
        setExecutingTask, setExpandedTaskIds, setError,
        setTaskDeliverables, setCompletedTasks,
        setAutoExecuting, setAutoExecStep, setAutoExecTotal,
        setAutoExecSubtasks, setAutoExecResults, setAutoExecStatuses,
        setRateLimitError, setShowRateLimitWarning,
    });

    const {
        handleSelectPillar,
        handleRedoPillar,
    } = usePillarNavigation({
        analysisId, businessId, profile, apiCall,
        pillarStates, taskSubtasks, completedTasks,
        selectedPillar, autoExecuting, focusedTaskId, executingTask,
        isStorageLoaded, initialActivePillar,
        setPillarStates, setSelectedPillar, setLoadingPillar, setExpandedTaskIds, setError,
        setTaskSubtasks, setAutoExecSubtasks, setAutoExecResults, setAutoExecStatuses,
        setTaskDeliverables, setCompletedTasks, setFocusedTaskId, setAutoExecuting,
        setAutoExecStep, setAutoExecTotal, setAutoExecLog,
        setTaskDeliverablesClear: setTaskDeliverables,
        setTaskSubtasksClear: setTaskSubtasks,
        setCompletedTasksClear: setCompletedTasks,
        setExpandedTaskIdsClear: setExpandedTaskIds,
        handleAutoExecute,
    });

    // ─── Derived state ───
    const dims = score?.dimensoes || {};
    const scoreGeral = score?.score_geral || 0;
    const resumo = score?.resumo_executivo || '';
    const classificacao = score?.classificacao || '';
    const normalizedReanalysisState = reanalysisState ?? { isReanalyzing: false };

    const currentPlan = selectedPillar ? pillarStates[selectedPillar]?.plan?.plan_data : null;
    const entregaveis = currentPlan?.entregaveis || [];

    // ─── Side effects ───
    useEffect(() => {
        onStateChange?.(pillarStates, completedTasks);
    }, [pillarStates, completedTasks]);

    useEffect(() => {
        if (entregaveis.length > 0 && entregaveisOrder.length === 0) {
            setEntregaveisOrder(Array.from({ length: entregaveis.length }, (_, i) => i));
        }
    }, [entregaveis.length, entregaveisOrder.length]);

    const handleReorderEntregaveis = useCallback((clickedIndex: number) => {
        const newOrder = [...entregaveisOrder];
        const clickedOriginalIndex = newOrder.indexOf(clickedIndex);
        if (clickedOriginalIndex === 0) return;
        newOrder.splice(clickedOriginalIndex, 1);
        newOrder.unshift(clickedIndex);
        setEntregaveisOrder(newOrder);
    }, [entregaveisOrder]);

    // ═══════════════════════════════════════════════════════
    // RENDER: Expanded Pillar View
    // ═══════════════════════════════════════════════════════
    if (selectedPillar) {
        const meta = PILLAR_META[selectedPillar];
        const state = pillarStates[selectedPillar];
        const plan = state?.plan?.plan_data;
        const tarefas: TaskItem[] = plan?.tarefas || plan?.acoes || [];
        const deps = state?.dependencies || { ready: true, blockers: [], warnings: [] };
        const done = completedTasks[selectedPillar] || new Set<string>();
        const isLoading = loadingPillar === selectedPillar;

        const onBack = () => {
            setSelectedPillar(null);
            if (businessId) router.push(`/analysis/${businessId}/especialistas`);
        };

        if (isLoading || !plan) {
            return (
                <LoadingErrorState
                    selectedPillar={selectedPillar}
                    error={error}
                    businessId={businessId}
                    handleSelectPillar={handleSelectPillar}
                    onBack={onBack}
                />
            );
        }

        const visibleTasks = tarefas.filter(t => t.executavel_por_ia);
        const totalTasks = visibleTasks.length;
        const completedCount = visibleTasks.filter(t => done.has(t.id)).length;
        const planSources = plan.sources || [];
        const planEntregaveis = plan.entregaveis || [];

        const mktCats = marketData?.categories || [];
        const mktCat = mktCats.find((c: any) => c.id === selectedPillar);
        const mktSources = mktCat?.fontes || [];
        const allSources = [...new Set([...planSources, ...mktSources])];

        // Compute documents produced by subtasks
        const docsForDropdown: Array<{ tid: string; idx: number; result: any; title: string }> = [];
        for (const [tid, results] of Object.entries(autoExecResults)) {
            if (!tid.startsWith(`${selectedPillar}_`)) continue;
            const subtasks = autoExecSubtasks[tid] || [];
            for (const [idxStr, res] of Object.entries(results)) {
                const idx = Number(idxStr);
                const r = res as any;
                if (r?.execution_mode === 'producao' && (r.conteudo || r.export_formats?.length > 0)) {
                    const st = subtasks[idx];
                    const title = safeRender(r.entregavel_titulo || st?.titulo || st?.entregavel_ia || `Documento ${idx + 1}`);
                    docsForDropdown.push({ tid, idx, result: r, title });
                }
            }
        }

        return (
            <div className="h-full flex" style={{ backgroundColor: 'var(--color-bg)' }}>
                {/* Left Column - Header and Documents */}
                <PillarHeader
                    selectedPillar={selectedPillar}
                    plan={plan}
                    specialists={specialists}
                    dims={dims}
                    allSources={allSources}
                    session={session}
                    businessId={businessId}
                    setLoadingDoc={setLoadingDoc}
                    setError={setError}
                    handleRedoPillar={handleRedoPillar}
                    onBack={onBack}
                    docsForDropdown={docsForDropdown}
                    visibleTasks={visibleTasks}
                    openFolders={openFolders}
                    setOpenFolders={setOpenFolders}
                    loadingDoc={loadingDoc}
                />

                {/* Right Column - Tasks */}
                <div className="flex-1 min-w-0 flex flex-col pt-0 relative z-30 overflow-hidden" style={{ backgroundColor: 'var(--color-bg)' }}>
                    <TaskProgressBar
                        totalTasks={totalTasks}
                        completedCount={completedCount}
                        activeRightTab={activeRightTab}
                        setActiveRightTab={setActiveRightTab}
                        focusedTaskId={focusedTaskId}
                        setFocusedTaskId={setFocusedTaskId}
                        docsCount={0}
                    />

                    {/* === TASKS === */}
                    {<>
                        <div className="px-6">
                            {/* Dependencies */}
                            {(deps.blockers?.length > 0 || deps.warnings?.length > 0) && (
                                <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: deps.blockers?.length > 0 ? 'var(--color-destructive-muted)' : 'var(--color-warning-muted)' }}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <Link2 className="w-4 h-4" style={{ color: 'var(--color-warning)' }} />
                                        <span className="text-xs font-semibold" style={{ color: 'var(--color-warning)' }}>Dependências</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {(deps.blockers || []).map((b: any) => <DepBadge key={b.pillar} dep={b} />)}
                                        {(deps.warnings || []).map((w: any) => <DepBadge key={w.pillar} dep={w} />)}
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div className="mb-4 p-3 rounded-lg text-sm" style={{ backgroundColor: 'var(--color-destructive-muted)', color: 'var(--color-destructive)', border: '1px solid rgba(239,68,68,0.15)' }}>
                                    {error}
                                    <button onClick={() => setError('')} className="ml-2 underline text-xs" style={{ color: 'var(--color-destructive)' }}>Fechar</button>
                                </div>
                            )}
                        </div>

                        {/* Tasks List Area */}
                        <div className="flex-1 px-3 pb-28 overflow-visible flex flex-col relative">
                            {/* Focused Task View */}
                            {focusedTaskId && (
                                <FocusedTaskView
                                    focusedTaskId={focusedTaskId}
                                    visibleTasks={visibleTasks}
                                    selectedPillar={selectedPillar}
                                    done={done}
                                    taskSubtasks={taskSubtasks}
                                    autoExecSubtasks={autoExecSubtasks}
                                    autoExecResults={autoExecResults}
                                    autoExecStatuses={autoExecStatuses}
                                    autoExecuting={autoExecuting}
                                    autoExecStep={autoExecStep}
                                    autoExecTotal={autoExecTotal}
                                    taskDeliverables={taskDeliverables}
                                    expandingTask={expandingTask}
                                    executingTask={executingTask}
                                    subtasksUpdateKey={subtasksUpdateKey}
                                    selectedTaskAiModel={selectedTaskAiModel}
                                    setSelectedTaskAiModel={setSelectedTaskAiModel}
                                    handleRetryAutoExecSubtask={handleRetryAutoExecSubtask}
                                    handleExpandSubtasks={handleExpandSubtasks}
                                    handleAutoExecute={handleAutoExecute}
                                    handleRedoTask={handleRedoTask}
                                    handleRedoSubtasks={handleRedoSubtasks}
                                    handleStopExecution={handleStopExecution}
                                    handleAITryUserTask={handleAITryUserTask}
                                />
                            )}

                            {/* Regular Tasks List */}
                            {!focusedTaskId && (
                                <TasksList
                                    visibleTasks={visibleTasks}
                                    selectedPillar={selectedPillar}
                                    done={done}
                                    expandedTaskIds={expandedTaskIds}
                                    focusedTaskId={focusedTaskId}
                                    selectedTaskAiModel={selectedTaskAiModel}
                                    isReanalyzing={normalizedReanalysisState.isReanalyzing}
                                    autoExecuting={autoExecuting}
                                    executingTask={executingTask}
                                    expandingTask={expandingTask}
                                    autoExecSubtasks={autoExecSubtasks}
                                    autoExecStatuses={autoExecStatuses}
                                    autoExecStep={autoExecStep}
                                    autoExecTotal={autoExecTotal}
                                    setFocusedTaskId={setFocusedTaskId}
                                    setExpandedTaskIds={setExpandedTaskIds}
                                />
                            )}
                        </div>
                    </>}
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════
    // RENDER: Specialist Grid (Hub view)
    // ═══════════════════════════════════════════════════════
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
