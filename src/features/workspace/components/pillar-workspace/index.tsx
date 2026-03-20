'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    ArrowLeft, Link2
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useSidebar } from '@/contexts/SidebarContext';

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
import ConfirmDialog from '@/features/shared/components/confirm-dialog';
import { TaskProgressBar } from './components/TaskProgressBar';
import { FocusedTaskView } from './components/FocusedTaskView';
import { TasksList } from './components/TasksList';
import { DepBadge } from './components/DepBadge';

import TaskErrorBanner from '@/features/shared/components/task-error-banner';

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
    const { isDark } = useSidebar();
    const router = useRouter();
    const DEFAULT_TASK_AI_MODEL = 'groq';
    const currentAiModel = aiModel || authAiModel || DEFAULT_TASK_AI_MODEL;

    // ─── UI State ───
    const [loadingDoc, setLoadingDoc] = useState<string | null>(null);
    const [loadingFullExport, setLoadingFullExport] = useState(false);
    const [selectedPillar, setSelectedPillar] = useState<string | null>(initialActivePillar || null);
    const [pillarStates, setPillarStates] = useState<Record<string, any>>({});
    const [loadingPillar, setLoadingPillar] = useState<string | null>(null);
    const [generatingPillar, setGeneratingPillar] = useState<string | null>(null);
    const [isPillarExecuting, setIsPillarExecuting] = useState(false);
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
    const [generationResults, setGenerationResults] = useState<Record<string, any>>({});
    const [generationSubtasks, setGenerationSubtasks] = useState<Record<string, any[]>>({});
    const [generationStatuses, setGenerationStatuses] = useState<Record<string, Record<number, 'waiting' | 'running' | 'done' | 'error'>>>({});
    const abortControllersRef = useRef<Record<string, AbortController>>({});
    const pollingIntervalsRef = useRef<Record<string, NodeJS.Timeout>>({});

    // ─── UI Preferences ───
    const [selectedTaskAiModel, setSelectedTaskAiModel] = useState<string>(currentAiModel);
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

    const handleModelFallback = useCallback((from: string, to: string) => {
        console.log(`🚀 Model fallback triggered: ${from} -> ${to}`);
        setSelectedTaskAiModel(to);
        setRateLimitError(`Limite atingido no ${from}. Trocamos automaticamente para ${to} para não parar sua execução.`);
        setShowRateLimitWarning(true);
    }, []);

    // ─── Custom Hooks ───
    const { apiCall, clearCache } = usePillarApi(selectedTaskAiModel, currentAiModel, handleModelFallback);

    const [showHistoricalThoughts, setShowHistoricalThoughts] = useState(false);
    const [showRedoConfirm, setShowRedoConfirm] = useState(false);
    const [pillarToRedo, setPillarToRedo] = useState<string | null>(null);
    
    const { isStorageLoaded } = useLocalStoragePersistence({
        analysisId,
        currentAiModel,
        state: {
            completedTasks, taskDeliverables, taskSubtasks,
            autoExecSubtasks, autoExecResults, autoExecStatuses, pillarStates,
            selectedTaskAiModel,
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
        autoExecuting,
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
        abortControllersRef,
        pollingIntervalsRef,
        selectedPillar
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
        specialists,
        selectedPillar, autoExecuting, focusedTaskId, executingTask,
        isStorageLoaded, initialActivePillar,
        autoExecResults, autoExecSubtasks, autoExecStatuses,
        setPillarStates, setSelectedPillar, setLoadingPillar, setExpandedTaskIds, setError,
        setTaskSubtasks, setAutoExecSubtasks, setAutoExecResults, setAutoExecStatuses,
        setTaskDeliverables, setCompletedTasks, setFocusedTaskId, setAutoExecuting,
        setAutoExecStep, setAutoExecTotal, setAutoExecLog,
        setTaskDeliverablesClear: setTaskDeliverables,
        setTaskSubtasksClear: setTaskSubtasks,
        setCompletedTasksClear: setCompletedTasks,
        setExpandedTaskIdsClear: setExpandedTaskIds,
        handleAutoExecute,
        setGeneratingPillar,
        setGenerationResults,
        setGenerationSubtasks,
        setGenerationStatuses,
        setIsPillarExecuting,
    });

    // Reset view states when pillar changes
    useEffect(() => {
        if (selectedPillar) {
            setFocusedTaskId(null);
            setActiveRightTab('tasks');
            setShowHistoricalThoughts(false);
        }
    }, [selectedPillar]);

    const handleRedoRequest = (pillarKey: string) => {
        setPillarToRedo(pillarKey);
        setShowRedoConfirm(true);
    };

    const confirmRedo = () => {
        if (pillarToRedo) {
            handleRedoPillar(pillarToRedo);
        }
        setShowRedoConfirm(false);
        setPillarToRedo(null);
    };

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
        const fullPlan = state?.plan || specialists[selectedPillar]?.plan;
        const planData = fullPlan?.plan_data;
        const tarefas: TaskItem[] = planData?.tarefas || planData?.acoes || [];
        const deps = state?.dependencies || specialists[selectedPillar]?.plan?.dependencies || { ready: true, blockers: [], warnings: [] };
        const done = completedTasks[selectedPillar] || new Set<string>();
        const isLoading = loadingPillar === selectedPillar;

        const onBack = () => {
            setSelectedPillar(null);
            if (businessId) router.push(`/analysis/${businessId}/especialistas`);
        };

        if (!planData || (generatingPillar === selectedPillar)) {
            return (
                <LoadingErrorState
                    selectedPillar={selectedPillar}
                    error={error}
                    businessId={businessId}
                    handleSelectPillar={handleSelectPillar}
                    onBack={onBack}
                    isGenerating={generatingPillar === selectedPillar}
                    isExecuting={isPillarExecuting}
                    results={generationResults[selectedPillar] || {}}
                    subtasks={generationSubtasks[selectedPillar] || []}
                    statuses={generationStatuses[selectedPillar] || {}}
                    onComplete={() => setGeneratingPillar(null)}
                />
            );
        }

        const visibleTasks = tarefas.filter(t => t.executavel_por_ia);
        const totalTasks = visibleTasks.length;
        const completedCount = visibleTasks.filter(t => done.has(t.id)).length;
        const planSources = planData?.context_sources || planData?.sources || [];
        const planEntregaveis = planData?.entregaveis || [];

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
            <div className="h-full flex relative overflow-hidden">
                {/* Left Column - Info & Docs (Slate Background for separation) */}
                <PillarHeader
                    selectedPillar={selectedPillar}
                    plan={planData}
                    specialists={specialists}
                    dims={dims}
                    allSources={allSources}
                    session={session}
                    businessId={businessId}
                    setLoadingDoc={setLoadingDoc}
                    setError={setError}
                    handleRedoPillar={handleRedoRequest}
                    onBack={onBack}
                    docsForDropdown={docsForDropdown}
                    visibleTasks={visibleTasks}
                    openFolders={openFolders}
                    setOpenFolders={setOpenFolders}
                    loadingDoc={loadingDoc}
                    done={done}
                    onVerPensamento={() => setShowHistoricalThoughts(true)}
                />

                {/* Right Column - Tasks Area (Pure White / Dark Surface) */}
                <div className={`flex-1 min-w-0 flex flex-col pt-0 relative z-10 transition-colors duration-300 ${
                    isDark ? 'bg-[--color-bg]' : 'bg-white'
                }`}>
                    {/* Replay of thought history */}
                    {showHistoricalThoughts && (
                        <div className="absolute inset-0 z-[200]">
                            <LoadingErrorState
                                selectedPillar={selectedPillar}
                                error={error}
                                businessId={businessId}
                                handleSelectPillar={handleSelectPillar}
                                onBack={() => setShowHistoricalThoughts(false)}
                                isGenerating={true}
                                isExecuting={false}
                                isFullPage={false}
                                // Use saved results log if available, otherwise reconstruct basic version
                                results={(() => {
                                    if (fullPlan?.full_thought_log) return fullPlan.full_thought_log;
                                    const ops = fullPlan?.analysis_opinions || {};
                                    return {
                                        0: { type: 'thought', text: 'Especialista Acionado', opiniao: 'Conexão estratégica estabelecida.', _tokens: 0, intelligence_tools_used: [{tool: 'cnpj_lookup', status: 'success'}] },
                                        1: { type: 'thought', text: 'Analise de Cenário Inicial', opiniao: ops.diagnostic?.opiniao || 'Análise técnica concluída.', _tokens: 0 },
                                        2: { type: 'thought', text: 'Pesquisa de Mercado', opiniao: ops.research?.opiniao || 'Tendências capturadas.', _tokens: 0, intelligence_tools_used: [{tool: 'web_search', status: 'success'}, {tool: 'trend_analyzer', status: 'success'}] },
                                        3: { type: 'thought', text: 'Plano de Ações Estruturado', opiniao: ops.plan?.opiniao || 'Tarefas validadas.', _tokens: 0 }
                                    };
                                })()}
                                subtasks={fullPlan?.full_thought_subtasks || [
                                    { id: 1, titulo: 'Especialista Acionado', status: 'done' },
                                    { id: 2, titulo: 'Analise de Cenário Inicial', status: 'done' },
                                    { id: 3, titulo: 'Pesquisa de Mercado', status: 'done' },
                                    { id: 4, titulo: 'Plano de Ações Estruturado', status: 'done' }
                                ]}
                                statuses={(() => {
                                    const len = fullPlan?.full_thought_subtasks?.length || 4;
                                    const s: Record<number, any> = {};
                                    for (let i = 0; i < len; i++) s[i] = 'done';
                                    return s;
                                })()} 
                                onComplete={() => setShowHistoricalThoughts(false)}
                            />
                        </div>
                    )}
                    {/* Progress Bar Header */}
                    <div className={`border-b z-[120] px-8 py-2 transition-colors duration-300 ${
                        isDark ? 'bg-[--color-bg] border-white/5' : 'bg-white border-gray-100'
                    }`}>
                        <TaskProgressBar
                            totalTasks={totalTasks}
                            completedCount={completedCount}
                            activeRightTab={activeRightTab}
                            setActiveRightTab={setActiveRightTab}
                            focusedTaskId={focusedTaskId}
                            setFocusedTaskId={setFocusedTaskId}
                            docsCount={0}
                        />
                    </div>

                    {/* Content Scroll Area */}
                    <div className="flex-1 flex flex-col overflow-hidden relative">
                        <div className="flex-1 overflow-y-auto px-12 py-8 pb-32 custom-scrollbar">
                            {/* Banners & Errors */}
                            {(deps.blockers?.length > 0 || deps.warnings?.length > 0) && (
                                <div className={`mb-8 p-5 rounded-xl border transition-colors duration-300 ${
                                    isDark ? 'bg-white/5 border-white/5' : 'bg-gray-50 border-gray-100'
                                }`}>
                                    <div className="flex items-center gap-2 mb-3">
                                        <Link2 size={16} className="text-blue-500" />
                                        <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>Dependências</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {(deps.blockers || []).map((b: any) => <DepBadge key={b.pillar} dep={b} />)}
                                        {(deps.warnings || []).map((w: any) => <DepBadge key={w.pillar} dep={w} />)}
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div className={`mb-8 p-4 rounded-xl border flex items-center justify-between transition-colors duration-300 ${
                                    isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-100'
                                }`}>
                                    <div className={`flex items-center gap-3 text-[13px] font-medium ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${isDark ? 'bg-red-400' : 'bg-red-500'}`} />
                                        <span>{error}</span>
                                    </div>
                                    <button onClick={() => setError('')} className="text-[11px] font-bold text-red-400 uppercase hover:text-red-500 transition-colors">Dispensar</button>
                                </div>
                            )}

                            {/* Main Task Views */}
                            {focusedTaskId ? (
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
                                    rateLimitError={rateLimitError}
                                    showRateLimitWarning={showRateLimitWarning}
                                    handleCloseRateLimit={handleCloseRateLimitWarning}
                                />
                            ) : (
                                <div className="max-w-4xl">
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
                                        handleStopExecution={handleStopExecution}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Redo Confirmation Modal */}
                <ConfirmDialog
                    isOpen={showRedoConfirm}
                    title="Refazer Análise"
                    message={`Tem certeza que deseja refazer a análise do pilar "${selectedPillar}"? Isso apagará todas as tarefas geradas e executadas deste pilar.`}
                    confirmText="Refazer"
                    cancelText="Cancelar"
                    onConfirm={confirmRedo}
                    onCancel={() => {
                        setShowRedoConfirm(false);
                        setPillarToRedo(null);
                    }}
                    isDangerous
                />
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
            generationResults={generationResults}
            isReanalyzing={normalizedReanalysisState.isReanalyzing}
        />
    );
}
