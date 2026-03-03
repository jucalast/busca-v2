'use client';

import React from 'react';
import { TaskItem } from '../types';
import TaskCard from '@/features/workspace/components/task-card';

interface TasksListProps {
    visibleTasks: TaskItem[];
    selectedPillar: string;
    done: Set<string>;
    expandedTaskIds: Set<string>;
    focusedTaskId: string | null;
    selectedTaskAiModel: string;
    isReanalyzing: boolean;
    autoExecuting: string | null;
    executingTask: string | null;
    expandingTask: string | null;
    autoExecSubtasks: Record<string, any[]>;
    autoExecStatuses: Record<string, Record<number, 'waiting' | 'running' | 'done' | 'error'>>;
    autoExecStep: number;
    autoExecTotal: number;
    setFocusedTaskId: (id: string | null) => void;
    setExpandedTaskIds: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export function TasksList({
    visibleTasks,
    selectedPillar,
    done,
    expandedTaskIds,
    focusedTaskId,
    selectedTaskAiModel,
    isReanalyzing,
    autoExecuting,
    executingTask,
    expandingTask,
    autoExecSubtasks,
    autoExecStatuses,
    autoExecStep,
    autoExecTotal,
    setFocusedTaskId,
    setExpandedTaskIds,
}: TasksListProps) {
    return (
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
                        if (!isExpanded) {
                            setExpandedTaskIds(prev => new Set(prev).add(tid));
                        }
                    };

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
                            disabled={isReanalyzing}
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
                                        for (let si = 0; si < subtasks.length; si++) {
                                            if (statuses[si] === 'running') {
                                                runningIndex = si;
                                                break;
                                            }
                                        }

                                        if (runningIndex === -1) {
                                            for (let si = 0; si < subtasks.length; si++) {
                                                if (!statuses[si] || statuses[si] === 'waiting') {
                                                    runningIndex = si;
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
    );
}
