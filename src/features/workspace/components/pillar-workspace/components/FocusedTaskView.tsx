'use client';

import React from 'react';
import {
    Loader2, Play, ListTree, Wand2, RefreshCw, Square, Check, Edit3, Copy, X
} from 'lucide-react';
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
    const task = visibleTasks.find(t => `${selectedPillar}_${t.id}` === focusedTaskId);
    if (!task) return null;

    const tid = focusedTaskId;
    const isDone = done.has(task.id) || done.has(tid);
    const isAI = task.executavel_por_ia;
    const taskIndex = visibleTasks.indexOf(task);

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
                            />
                        </AutoScrollContainer>
                    </div>

                    <div
                        className="absolute bottom-1 left-1/2 -translate-x-1/2 w-full max-w-3xl flex flex-col gap-0 backdrop-blur-3xl rounded-[28px] overflow-hidden z-[100] border-2 border-gray-300"
                        style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.94)',
                        }}
                    >
                        {/* Subtasks Execution Line Trace */}
                        <div className="w-full bg-black/5 backdrop-blur-md px-4 py-1">
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

                        {/* Task Details Card Container */}
                        <div className="flex flex-col w-full">
                            <div className="w-full p-6 flex flex-col gap-5">
                                <div className="flex flex-col gap-4 w-full">
                                    <div className="flex items-start justify-between gap-4 w-full">
                                        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                                            <div className="flex items-center gap-2.5">
                                                <h1 className="text-[16px] font-bold tracking-tight leading-tight line-clamp-2" style={{ color: 'var(--color-text-primary)' }}>
                                                    {task.titulo}
                                                </h1>
                                                {isDone && <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center shrink-0"><Check size={10} className="text-white" strokeWidth={4} /></div>}
                                            </div>

                                            <div className="flex items-center gap-3 text-[11px] font-medium" style={{ color: 'var(--color-text-tertiary)' }}>
                                                <span className="opacity-40">#{taskIndex + 1}</span>
                                                <div className="w-1 h-1 rounded-full bg-black/10" />
                                                <span>{isAI ? 'Agente de IA' : 'Ação Operacional'}</span>
                                                {task.prioridade && (
                                                    <>
                                                        <div className="w-1 h-1 rounded-full bg-black/10" />
                                                        <span className="uppercase tracking-[0.05em]" style={{
                                                            color: task.prioridade === 'critica'
                                                                ? 'var(--color-destructive)'
                                                                : task.prioridade === 'alta'
                                                                    ? 'var(--color-warning)'
                                                                    : 'var(--color-text-tertiary)'
                                                        }}>
                                                            {task.prioridade}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            {isAI ? (
                                                <div className="flex items-center gap-1.5 bg-black/5 hover:bg-black/10 transition-colors px-1.5 py-1.5 rounded-xl border border-black/5 group cursor-pointer">
                                                    <Edit3 size={15} className="text-gray-400 group-hover:text-gray-600 transition" />
                                                    <Copy size={15} className="text-gray-400 group-hover:text-gray-600 transition" />
                                                    <X size={15} className="text-gray-400 group-hover:text-gray-600 transition" />
                                                </div>
                                            ) : (
                                                <X size={18} className="text-gray-400 cursor-pointer hover:text-gray-700 transition" />
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between w-full pt-2 border-t border-black/5">
                                        <div className="flex items-center gap-3">
                                            {isAI && (
                                                <div className="flex items-center gap-3 bg-black/5 px-3 py-1.5 rounded-xl border border-black/5">
                                                    <ModelBadge
                                                        model={taskDeliverables[tid]?.result_data?._actual_provider || taskDeliverables[tid]?.result_data?._actual_model || selectedTaskAiModel}
                                                        tokens={taskDeliverables[tid]?.result_data?._tokens}
                                                    />
                                                    <div className="w-[1px] h-3 bg-black/10" />
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
                                                />
                                            ) : (
                                                <button
                                                    onClick={() => handleAITryUserTask(selectedPillar, task)}
                                                    disabled={!!autoExecuting || executingTask === tid}
                                                    className="flex items-center gap-2 h-9 px-4 rounded-xl bg-black text-white text-[12px] font-bold shadow-lg shadow-black/20 hover:-translate-y-0.5 transition-all disabled:opacity-50"
                                                >
                                                    {executingTask === tid ? (
                                                        <Loader2 size={14} className="animate-spin" />
                                                    ) : (
                                                        <>
                                                            <Wand2 size={14} />
                                                            <span>Delegar para IA</span>
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>
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
}

function AIActionButtons({
    tid, task, isDone, selectedPillar, taskSubtasks, taskDeliverables,
    autoExecuting, expandingTask, handleExpandSubtasks, handleAutoExecute,
    handleRedoTask, handleRedoSubtasks, handleStopExecution,
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
                    style={{ backgroundColor: 'transparent', color: 'var(--color-text-tertiary)' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
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
