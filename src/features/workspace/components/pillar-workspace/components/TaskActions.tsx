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
    task, pillarKey, tid, isDone, executingTask, expandingTask, autoExecuting,
    taskDeliverables, taskSubtasks, autoExecSubtasks, autoExecResults, autoExecStatuses,
    setFocusedTaskId, handleAutoExecute, handleExpandSubtasks, handleRedoSubtasks,
    handleRedoTask, handleStopExecution, handleAITryUserTask,
}: TaskActionsProps) {
    const isExecuting = executingTask === tid;
    const isExpanding = expandingTask === tid;
    const isAutoExec = autoExecuting === tid;
    const deliverable = taskDeliverables[tid];
    const subtasks = taskSubtasks[tid];
    const taskExecSubtasks = autoExecSubtasks[tid] || [];
    const hasExecPanel = taskExecSubtasks.length > 0;

    if (isDone && !deliverable && !hasExecPanel) return null;

    const btnPrimary = "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-150 disabled:opacity-50";
    const btnSecondary = "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-150 disabled:opacity-50";

    return (
        <div className="mt-3 space-y-3">
            {/* Expanding spinner */}
            {isAutoExec && !hasExecPanel && (
                <div
                    className="flex items-center gap-2.5 p-3.5 rounded-xl"
                    style={{
                        backgroundColor: 'var(--color-accent-muted)',
                        border: '1px solid rgba(59,130,246,0.1)',
                    }}
                >
                    <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--color-accent)' }} />
                    <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--color-accent)', opacity: 0.8 }}>Criando subtarefas...</span>
                </div>
            )}

            {/* Action buttons */}
            {!isDone && !deliverable && !isAutoExec && !hasExecPanel && (
                <div className="flex flex-wrap gap-2">
                    {task.executavel_por_ia ? (
                        <>
                            <button
                                onClick={() => { setFocusedTaskId(tid); handleAutoExecute(pillarKey, task); }}
                                disabled={!!autoExecuting || isExecuting}
                                className={btnPrimary}
                                style={{
                                    backgroundColor: 'var(--color-accent-muted)',
                                    color: 'var(--color-accent)',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(59,130,246,0.15)')}
                                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--color-accent-muted)')}
                            >
                                <Play className="w-3 h-3" />
                                {subtasks
                                    ? `Executar ${(subtasks.subtarefas || []).length} subtarefas com IA`
                                    : 'Executar com IA'}
                            </button>
                            {!subtasks ? (
                                <button
                                    onClick={() => handleExpandSubtasks(pillarKey, task)}
                                    disabled={isExpanding || !!autoExecuting}
                                    className={btnSecondary}
                                    style={{
                                        backgroundColor: 'var(--color-surface-hover)',
                                        color: 'var(--color-text-tertiary)',
                                        border: '1px solid var(--color-border)',
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-active)')}
                                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
                                >
                                    {isExpanding
                                        ? <><Loader2 className="w-3 h-3 animate-spin" />Criando subtarefas...</>
                                        : <><ListTree className="w-3 h-3" />Ver subtarefas</>}
                                </button>
                            ) : null}
                            {(subtasks || isExpanding) && (
                                <button
                                    onClick={() => {
                                        if (isExpanding) handleStopExecution(tid);
                                        handleRedoSubtasks(pillarKey, tid, task);
                                    }}
                                    className={btnSecondary}
                                    style={{
                                        backgroundColor: 'var(--color-surface-hover)',
                                        color: 'var(--color-text-tertiary)',
                                        border: '1px solid var(--color-border)',
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-active)')}
                                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
                                >
                                    <RefreshCw className={`w-3 h-3 ${isExpanding ? 'animate-spin' : ''}`} />
                                    Refazer subtarefas
                                </button>
                            )}
                            {subtasks && (
                                <button
                                    onClick={() => handleRedoSubtasks(pillarKey, tid, task)}
                                    disabled={!!autoExecuting}
                                    className={btnSecondary}
                                    style={{
                                        backgroundColor: 'var(--color-warning-muted)',
                                        color: 'var(--color-warning)',
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(234,179,8,0.15)')}
                                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--color-warning-muted)')}
                                >
                                    <RefreshCw className="w-3 h-3" />
                                    Refazer Subtarefas
                                </button>
                            )}
                        </>
                    ) : (
                        <button
                            onClick={() => handleAITryUserTask(pillarKey, task)}
                            disabled={!!autoExecuting || isExecuting}
                            className={btnSecondary}
                            style={{
                                backgroundColor: 'var(--color-warning-muted)',
                                color: 'var(--color-warning)',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(234,179,8,0.15)')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--color-warning-muted)')}
                        >
                            {isExecuting ? <><Loader2 className="w-3 h-3 animate-spin" />Tentando...</>
                                : <><Wand2 className="w-3 h-3" />Delegar para IA</>}
                        </button>
                    )}
                </div>
            )}

            {/* Stop button */}
            {(isAutoExec || isExecuting || isExpanding) && (
                <div className="flex flex-wrap gap-2 mt-2">
                    <button
                        onClick={() => handleStopExecution(tid)}
                        className={btnSecondary}
                        style={{
                            backgroundColor: 'var(--color-destructive-muted)',
                            color: 'var(--color-destructive)',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.15)')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--color-destructive-muted)')}
                    >
                        <AlertTriangle className="w-3 h-3" />
                        Parar Execução
                    </button>
                    {isAutoExec && (
                        <button
                            onClick={() => handleStopExecution(tid)}
                            className={btnSecondary}
                            style={{
                                backgroundColor: 'var(--color-warning-muted)',
                                color: 'var(--color-warning)',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(234,179,8,0.15)')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--color-warning-muted)')}
                        >
                            <AlertTriangle className="w-3 h-3" />
                            Parar Auto-execução
                        </button>
                    )}
                </div>
            )}

            {/* Redo task */}
            {(isDone || deliverable || (hasExecPanel && !isAutoExec) || isAutoExec || isExecuting) && (
                <div className="flex flex-wrap gap-2 mt-2">
                    <button
                        onClick={() => {
                            if (isAutoExec || isExecuting) handleStopExecution(tid);
                            handleRedoTask(pillarKey, tid, task);
                        }}
                        className={btnSecondary}
                        style={{
                            backgroundColor: 'var(--color-surface-hover)',
                            color: 'var(--color-text-muted)',
                            border: '1px solid var(--color-border)',
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.color = 'var(--color-text-secondary)';
                            e.currentTarget.style.backgroundColor = 'var(--color-surface-active)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.color = 'var(--color-text-muted)';
                            e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
                        }}
                    >
                        <RefreshCw className="w-2.5 h-2.5 opacity-40" />
                        Refazer Tarefa
                    </button>
                    {subtasks && (
                        <button
                            onClick={() => {
                                if (isAutoExec || isExecuting) handleStopExecution(tid);
                                handleRedoTask(pillarKey, tid, task);
                            }}
                            className={btnSecondary}
                            style={{
                                backgroundColor: 'var(--color-accent-muted)',
                                color: 'var(--color-accent)',
                                border: '1px solid rgba(59,130,246,0.08)',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(59,130,246,0.12)')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--color-accent-muted)')}
                        >
                            <RefreshCw className="w-2.5 h-2.5 opacity-40" />
                            Refazer Tudo
                        </button>
                    )}
                </div>
            )}

            {/* Sources */}
            {(deliverable?.sources?.length > 0 || deliverable?.fontes_consultadas?.length > 0) && (
                <SourceBadgeList sources={[...(deliverable.sources || []), ...(deliverable.fontes_consultadas || [])]} maxVisible={4} />
            )}
        </div>
    );
}
