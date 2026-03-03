'use client';

import React from 'react';
import {
    Loader2, Play, ListTree, Wand2, RefreshCw, Square, Check
} from 'lucide-react';
import { PILLAR_META } from '../constants';
import { TaskItem } from '../types';
import { AutoScrollContainer } from './AutoScrollContainer';
import TaskSubtasksDisplay from '@/features/workspace/components/task-subtasks-display';
import ModelSelector from '@/features/shared/components/model-selector';
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
            </div>
        </div>
    );
}

// ─── AI Action Buttons (internal sub-component) ───

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
    tid,
    task,
    isDone,
    selectedPillar,
    taskSubtasks,
    taskDeliverables,
    autoExecuting,
    expandingTask,
    handleExpandSubtasks,
    handleAutoExecute,
    handleRedoTask,
    handleRedoSubtasks,
    handleStopExecution,
}: AIActionButtonsProps) {
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
}
