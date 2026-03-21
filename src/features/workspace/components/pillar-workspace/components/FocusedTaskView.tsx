'use client';

import React from 'react';
import {
    Loader2, Play, ListTree, Wand2, RefreshCw, Square, Check, Edit3, Copy, X, Globe
} from 'lucide-react';
import { TOOL_CONFIG } from '@/features/shared/components/intelligence-tools';
import { useSidebar } from '@/contexts/SidebarContext';
import { PILLAR_META } from '../constants';
import { AutoScrollContainer } from '@/features/shared/components/AutoScrollContainer';
import { TaskItem } from '../types';
import TaskSubtasksDisplay from '@/features/workspace/components/task-subtasks-display';
import ModelBadge from '@/features/shared/components/ModelBadge';
import LLMUsageIndicator from '@/features/shared/components/llm-usage-indicator';
import TaskErrorBanner from '@/features/shared/components/task-error-banner';
import { safeRender } from '../utils';

interface FocusedTaskViewProps {
    focusedTaskId: string;
    visibleTasks: TaskItem[];
    selectedPillar: string;
    done: Set<string>;
    taskSubtasks: Record<string, any>;
    autoExecSubtasks: Record<string, any[]>;
    autoExecResults: Record<string, Record<number, any>>;
    autoExecStatuses: Record<string, Record<number, 'waiting' | 'running' | 'done' | 'error'>>;
    autoExecuting: string | null;
    autoExecStep: number;
    autoExecTotal: number;
    taskDeliverables: Record<string, any>;
    expandingTask: string | null;
    executingTask: string | null;
    subtasksUpdateKey: number;
    selectedTaskAiModel: string;
    setSelectedTaskAiModel: (model: string) => void;
    handleRetryAutoExecSubtask: (pillarKey: string, task: TaskItem, subtaskIndex: number) => void;
    handleExpandSubtasks: (pillarKey: string, task: TaskItem) => void;
    handleAutoExecute: (pillarKey: string, task: TaskItem) => void;
    handleRedoTask: (pillarKey: string, tid: string, task: TaskItem) => void;
    handleRedoSubtasks: (pillarKey: string, tid: string, task: TaskItem) => void;
    handleStopExecution: (tid: string) => void;
    handleAITryUserTask: (pillarKey: string, task: TaskItem) => void;
    rateLimitError: string | null;
    showRateLimitWarning: boolean;
    handleCloseRateLimit: () => void;
}

export function FocusedTaskView({
    focusedTaskId,
    visibleTasks,
    selectedPillar,
    done,
    taskSubtasks,
    autoExecSubtasks,
    autoExecResults,
    autoExecStatuses,
    autoExecuting,
    autoExecStep,
    autoExecTotal,
    taskDeliverables,
    expandingTask,
    executingTask,
    subtasksUpdateKey,
    selectedTaskAiModel,
    setSelectedTaskAiModel,
    handleRetryAutoExecSubtask,
    handleExpandSubtasks,
    handleAutoExecute,
    handleRedoTask,
    handleRedoSubtasks,
    handleStopExecution,
    handleAITryUserTask,
    rateLimitError,
    showRateLimitWarning,
    handleCloseRateLimit,
}: FocusedTaskViewProps) {
    const { isDark } = useSidebar();
    const task = visibleTasks.find(t => `${selectedPillar}_${t.id}` === focusedTaskId);
    if (!task) return null;

    const tid = focusedTaskId;
    const isDone = done.has(task.id) || done.has(tid);
    const isAI = task.executavel_por_ia;
    const taskIndex = visibleTasks.indexOf(task);

    const activeTools = React.useMemo(() => {
        if (!autoExecResults || !autoExecResults[tid]) return [];
        const tools: any[] = [];
        Object.values(autoExecResults[tid]).forEach((res: any) => {
            if (res.intelligence_tools_used) {
                res.intelligence_tools_used.forEach((t: any) => {
                    const existingIdx = tools.findIndex(x => x.tool === t.tool);
                    if (existingIdx >= 0) {
                        tools[existingIdx] = t;
                    } else {
                        tools.push(t);
                    }
                });
            }
        });
        return tools;
    }, [autoExecResults, tid]);

    return (
        <div className="flex-1 flex flex-col mb-4 overflow-hidden pt-2">
            <div className="w-full sm:pt-0 flex-1 flex flex-col overflow-hidden pb-2">
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
                                onStopExecution={() => handleStopExecution(tid)}
                            />
                        </AutoScrollContainer>
                    </div>

                    <div
                        className={`absolute bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-3xl flex flex-col backdrop-blur-3xl rounded-[24px] z-[100] border transition-colors duration-300 p-4 ${isDark ? 'bg-zinc-900/90 border-white/10 shadow-2xl' : 'bg-gray-200/98 border-gray-300 shadow-xl'
                            }`}
                    >
                        {/* Subtasks Execution Line Trace */}
                        {(taskSubtasks[tid]?.subtarefas?.length > 0 || (autoExecuting === tid && !taskSubtasks[tid]) || (expandingTask === tid && !taskSubtasks[tid])) && (
                            <div className="w-full mb-3">
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
                                    onStopExecution={() => handleStopExecution(tid)}
                                />
                            </div>
                        )}

                        {/* Task Card Inner */}
                        <div className={`border rounded-[14px] pt-4 px-4 pb-2 shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-colors duration-300 ${isDark ? 'bg-zinc-800/40 border-white/5' : 'bg-white border-gray-200'
                            }`}>

                            {/* Badges */}
                            <div className="flex flex-wrap items-center gap-2 mb-4">
                                {task.prioridade && (
                                    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-normal ${isDark
                                        ? task.prioridade === 'critica' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-500'
                                        : task.prioridade === 'critica' ? 'bg-red-50 text-[#d94d34]' : 'bg-yellow-50 text-yellow-600'
                                        }`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                                            <line x1="4" x2="4" y1="22" y2="15"></line>
                                        </svg>
                                        <span className="capitalize">{task.prioridade}</span>
                                    </span>
                                )}

                                {activeTools.map((t) => {
                                    const config = TOOL_CONFIG[t.tool] || { icon: Globe, label: t.tool };
                                    const Icon = config.icon;
                                    const isRunning = t.status === 'running';

                                    return (
                                        <span key={`tool-${t.tool}`} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all duration-300 animate-in fade-in zoom-in-95 ${isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-gray-50 text-gray-700'
                                            }`}>
                                            <div className="relative flex items-center justify-center w-3 h-3">
                                                <Icon className={`w-3 h-3 shrink-0 ${isRunning ? 'animate-pulse' : ''} ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} />
                                                {isRunning && (
                                                    <div className={`absolute inset-0 rounded-full opacity-20 animate-ping ${isDark ? 'bg-white' : 'bg-black'}`} />
                                                )}
                                            </div>
                                            <span style={{ opacity: isRunning ? 0.8 : 1 }}>
                                                {config.label}
                                            </span>
                                        </span>
                                    );
                                })}
                            </div>

                            {/* Content */}
                            <div className="flex items-start justify-between gap-4 w-full">
                                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                                    <h3 className="text-[16px] font-medium leading-tight mb-2" style={{ color: 'var(--color-text-primary)' }}>
                                        {task.titulo}
                                    </h3>

                                </div>


                            </div>

                            {/* Divider */}
                            <div className={`h-[1px] w-full mt-3 mb-2 ${isDark ? 'bg-white/10' : 'bg-gray-100'}`}></div>

                            {/* Error Banner */}
                            {showRateLimitWarning && rateLimitError && (
                                <div>
                                    <TaskErrorBanner
                                        error={rateLimitError}
                                        onClose={handleCloseRateLimit}
                                        modelName={selectedTaskAiModel}
                                    />
                                </div>
                            )}



                            {/* Footer Info */}
                            <div className="flex items-center justify-between">
                                {/* Avatars or Meta */}
                                <div className="flex items-center gap-3">
                                    {isAI && (
                                        <div className="flex items-center gap-1.5 py-0.5 transition-colors duration-300">
                                            <ModelBadge
                                                model={taskDeliverables[tid]?.result_data?._actual_provider || taskDeliverables[tid]?.result_data?._actual_model || selectedTaskAiModel}
                                                tokens={taskDeliverables[tid]?.result_data?._tokens}
                                            />
                                            <LLMUsageIndicator provider={selectedTaskAiModel} />
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    {isAI ? (
                                        <AIActionButtons
                                            tid={tid}
                                            task={task}
                                            isDone={isDone}
                                            selectedPillar={selectedPillar}
                                            taskSubtasks={taskSubtasks}
                                            taskDeliverables={taskDeliverables}
                                            autoExecuting={autoExecuting}
                                            expandingTask={expandingTask}
                                            handleExpandSubtasks={handleExpandSubtasks}
                                            handleAutoExecute={handleAutoExecute}
                                            handleRedoTask={handleRedoTask}
                                            handleRedoSubtasks={handleRedoSubtasks}
                                            handleStopExecution={handleStopExecution}
                                            isDark={isDark}
                                        />
                                    ) : (
                                        <button
                                            onClick={() => handleAITryUserTask(selectedPillar, task)}
                                            disabled={!!autoExecuting || executingTask === tid}
                                            className={`flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] font-medium transition-all duration-150 disabled:opacity-50 border ${
                                                isDark
                                                    ? 'bg-zinc-800/50 border-white/5 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                                                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-black'
                                            }`}
                                        >
                                            {executingTask === tid ? (
                                                <Loader2 size={10} className="animate-spin" />
                                            ) : (
                                                <Wand2 size={10} />
                                            )}
                                            <span>Delegar</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── AI Action Buttons ───

interface AIActionButtonsProps {
    tid: string;
    task: TaskItem;
    isDone: boolean;
    selectedPillar: string;
    taskSubtasks: Record<string, any>;
    taskDeliverables: Record<string, any>;
    autoExecuting: string | null;
    expandingTask: string | null;
    handleExpandSubtasks: (pillarKey: string, task: TaskItem) => void;
    handleAutoExecute: (pillarKey: string, task: TaskItem) => void;
    handleRedoTask: (pillarKey: string, tid: string, task: TaskItem) => void;
    handleRedoSubtasks: (pillarKey: string, tid: string, task: TaskItem) => void;
    handleStopExecution: (tid: string) => void;
    isDark: boolean;
}

function AIActionButtons({
    tid, task, isDone, selectedPillar, taskSubtasks, taskDeliverables,
    autoExecuting, expandingTask, handleExpandSubtasks, handleAutoExecute,
    handleRedoTask, handleRedoSubtasks, handleStopExecution, isDark
}: AIActionButtonsProps) {
    const isGenerating = autoExecuting === tid && !taskSubtasks[tid];
    const isExecutingAuto = autoExecuting === tid && !!taskSubtasks[tid];

    const btnBase = "flex items-center gap-2 h-7 px-3 rounded-lg transition-all duration-150 cursor-pointer disabled:opacity-50";

    return (
        <>
            {!taskSubtasks[tid] && (
                <button
                    onClick={() => handleExpandSubtasks(selectedPillar, task)}
                    disabled={autoExecuting === tid}
                    className={btnBase}
                    style={{ backgroundColor: 'transparent', color: 'var(--color-text-tertiary)' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    title={isGenerating ? 'Gerando...' : 'Gerar subtarefas'}
                >
                    {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ListTree className="w-3.5 h-3.5" />}
                </button>
            )}
            {taskSubtasks[tid] && !isDone && !taskDeliverables[tid] && (
                <button
                    onClick={() => handleRedoSubtasks(selectedPillar, tid, task)}
                    disabled={autoExecuting === tid}
                    className={btnBase}
                    style={{ backgroundColor: 'transparent', color: 'var(--color-text-tertiary)' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    title="Refazer subtarefas"
                >
                    <RefreshCw className="w-3.5 h-3.5" />
                </button>
            )}
            {(isExecutingAuto || isGenerating) ? (
                <button
                    onClick={() => handleStopExecution(tid)}
                    className={btnBase}
                    style={{
                        backgroundColor: 'var(--color-destructive-muted)',
                        color: 'var(--color-destructive)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.15)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--color-destructive-muted)')}
                    title="Parar execução"
                >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span className="text-[11px] font-medium">Parar</span>
                </button>
            ) : (isDone || taskDeliverables[tid]) ? (
                <button
                    onClick={() => handleRedoTask(selectedPillar, tid, task)}
                    className={btnBase}
                    style={{
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                        color: 'var(--color-text-secondary)',
                        paddingLeft: '12px',
                        paddingRight: '12px'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)')}
                    title="Refazer tarefa inteira"
                >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-medium">Refazer Tarefa</span>
                </button>
            ) : (
                <button
                    onClick={() => handleAutoExecute(selectedPillar, task)}
                    disabled={!!autoExecuting || expandingTask === tid}
                    className={btnBase}
                    style={{ backgroundColor: 'transparent', color: 'var(--color-text-tertiary)' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    title={taskSubtasks[tid]
                        ? `Executar ${(taskSubtasks[tid].subtarefas || []).length} subtarefas com IA`
                        : 'Executar com IA'}
                >
                    {isExecutingAuto ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    {taskSubtasks[tid] && (
                        <span className="text-[11px] font-medium">
                            {(taskSubtasks[tid].subtarefas || []).length} Tasks
                        </span>
                    )}
                </button>
            )}
        </>
    );
}
