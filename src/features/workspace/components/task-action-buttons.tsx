'use client';

import React from 'react';
import { Play, ListTree, RefreshCw } from 'lucide-react';
export interface TaskItem {
    id: string;
    titulo: string;
    descricao?: string;
    executavel_por_ia: boolean;
    entregavel_ia?: string;
    instrucoes_usuario?: string;
    ferramenta?: string;
    ferramenta_url?: string;
    tempo_estimado?: string;
    resultado_esperado?: string;
    kpi?: string;
    [key: string]: any;
}
interface TaskActionButtonsProps {
    task: TaskItem;
    pillarKey: string;
    tid: string;
    isDone: boolean;
    isExpanding?: boolean;
    autoExecuting?: string | null;
    subtasks?: any;
    onExpandSubtasks?: () => void;
    onAutoExecute?: () => void;
    onRedoTask?: () => void;
    onRedoSubtasks?: () => void;
}

export default function TaskActionButtons({
    task,
    pillarKey,
    tid,
    isDone,
    isExpanding = false,
    autoExecuting = null,
    subtasks = null,
    onExpandSubtasks = () => { },
    onAutoExecute = () => { },
    onRedoTask = () => { },
    onRedoSubtasks = () => { },
}: TaskActionButtonsProps) {
    const isAI = task.executavel_por_ia;
    const hasSubtasks = subtasks && subtasks.subtarefas && subtasks.subtarefas.length > 0;

    const btnBase = "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-150 disabled:opacity-50";

    return (
        <div className="flex flex-wrap gap-2">
            {isAI && (
                <button
                    onClick={onAutoExecute}
                    disabled={isExpanding || !!autoExecuting}
                    className={btnBase}
                    style={{
                        backgroundColor: 'var(--color-accent-muted)',
                        color: 'var(--color-accent)',
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.backgroundColor = 'rgba(59,130,246,0.15)';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.backgroundColor = 'var(--color-accent-muted)';
                    }}
                >
                    <Play className="w-3 h-3" />
                    {hasSubtasks
                        ? `Executar ${(subtasks.subtarefas || []).length} subtarefas com IA`
                        : 'Executar com IA'}
                </button>
            )}

            {!hasSubtasks ? (
                <button
                    onClick={onExpandSubtasks}
                    disabled={isExpanding || !!autoExecuting}
                    className={btnBase}
                    style={{
                        backgroundColor: 'var(--color-surface-hover)',
                        color: 'var(--color-text-tertiary)',
                        border: '1px solid var(--color-border)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--color-surface-active)'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'; }}
                >
                    {isExpanding
                        ? <><div className="w-3 h-3 animate-spin rounded-full" style={{ border: '1px solid var(--color-border-strong)', borderTopColor: 'transparent' }} />...</>
                        : <><ListTree className="w-3 h-3" />Ver subtarefas</>}
                </button>
            ) : (
                <button
                    onClick={onExpandSubtasks}
                    disabled={isExpanding || !!autoExecuting}
                    className={btnBase}
                    style={{
                        backgroundColor: 'var(--color-surface-hover)',
                        color: 'var(--color-text-tertiary)',
                        border: '1px solid var(--color-border)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--color-surface-active)'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'; }}
                >
                    {isExpanding
                        ? <><div className="w-3 h-3 animate-spin rounded-full" style={{ border: '1px solid var(--color-border-strong)', borderTopColor: 'transparent' }} />...</>
                        : <><RefreshCw className="w-3 h-3" />Refazer subtarefas</>}
                </button>
            )}

            {hasSubtasks && (
                <button
                    onClick={onRedoSubtasks}
                    disabled={!!autoExecuting}
                    className={btnBase}
                    style={{
                        backgroundColor: 'var(--color-warning-muted)',
                        color: 'var(--color-warning)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(245,158,11,0.15)'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--color-warning-muted)'; }}
                >
                    <RefreshCw className="w-3 h-3" />
                    Refazer Subtarefas
                </button>
            )}

            <button
                onClick={onRedoTask}
                disabled={!!autoExecuting}
                className={btnBase}
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
                <RefreshCw className="w-3 h-3 opacity-40" />
                Refazer Tarefa
            </button>
        </div>
    );
}
