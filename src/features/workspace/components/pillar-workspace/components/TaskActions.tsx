'use client';

import React from 'react';
import {
    Loader2, Play, ListTree, Wand2, RefreshCw, AlertTriangle
} from 'lucide-react';
import { PILLAR_META } from '../constants';
import { TaskItem } from '../types';
import { SourceBadgeList } from './SourceBadgeList';

interface TaskActionsProps {
    task: TaskItem;
    pillarKey: string;
    tid: string;
    isDone: boolean;
    executingTask: string | null;
    expandingTask: string | null;
    autoExecuting: string | null;
    taskDeliverables: Record<string, any>;
    taskSubtasks: Record<string, any>;
    autoExecSubtasks: Record<string, any[]>;
    autoExecResults: Record<string, Record<number, any>>;
    autoExecStatuses: Record<string, Record<number, string>>;
    setFocusedTaskId: (id: string) => void;
    handleAutoExecute: (pillarKey: string, task: TaskItem) => void;
    handleExpandSubtasks: (pillarKey: string, task: TaskItem) => void;
    handleRedoSubtasks: (pillarKey: string, tid: string, task: TaskItem) => void;
    handleRedoTask: (pillarKey: string, tid: string, task: TaskItem) => void;
    handleStopExecution: (tid: string) => void;
    handleAITryUserTask: (pillarKey: string, task: TaskItem) => void;
}

export function TaskActions({
    task,
    pillarKey,
    tid,
    isDone,
    executingTask,
    expandingTask,
    autoExecuting,
    taskDeliverables,
    taskSubtasks,
    autoExecSubtasks,
    autoExecResults,
    autoExecStatuses,
    setFocusedTaskId,
    handleAutoExecute,
    handleExpandSubtasks,
    handleRedoSubtasks,
    handleRedoTask,
    handleStopExecution,
    handleAITryUserTask,
}: TaskActionsProps) {
    const isExecuting = executingTask === tid;
    const isExpanding = expandingTask === tid;
    const isAutoExec = autoExecuting === tid;
    const deliverable = taskDeliverables[tid];
    const subtasks = taskSubtasks[tid];
    const taskExecSubtasks = autoExecSubtasks[tid] || [];
    const hasExecPanel = taskExecSubtasks.length > 0;

    if (isDone && !deliverable && !hasExecPanel) return null;

    return (
        <div className="mt-3 space-y-3">
            {/* Expanding spinner */}
            {isAutoExec && !hasExecPanel && (
                <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-violet-500/[0.03] border border-violet-500/10">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />
                    <span className="text-[11px] font-medium text-violet-300/80 uppercase tracking-wider">Criando subtarefas...</span>
                </div>
            )}

            {/* Action buttons row */}
            {!isDone && !deliverable && !isAutoExec && !hasExecPanel && (
                <div className="flex flex-wrap gap-2">
                    {task.executavel_por_ia ? (
                        <>
                            <button onClick={() => { setFocusedTaskId(tid); handleAutoExecute(pillarKey, task); }} disabled={!!autoExecuting || isExecuting}
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
                    {isAutoExec && (
                        <button onClick={() => handleStopExecution(tid)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-orange-500/15 text-orange-400 hover:bg-orange-500/25 transition-all">
                            <AlertTriangle className="w-3 h-3" />
                            Parar Auto-execução
                        </button>
                    )}
                </div>
            )}

            {/* Redo task button */}
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

            {/* Sources from deliverable */}
            {(deliverable?.sources?.length > 0 || deliverable?.fontes_consultadas?.length > 0) && (
                <SourceBadgeList sources={[...(deliverable.sources || []), ...(deliverable.fontes_consultadas || [])]} maxVisible={4} />
            )}
        </div>
    );
}
