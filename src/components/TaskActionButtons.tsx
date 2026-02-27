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

    return (
        <div className="flex flex-wrap gap-2">
            {isAI && (
                <button
                    onClick={onAutoExecute}
                    disabled={isExpanding || !!autoExecuting}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-violet-500/[0.03] text-violet-400/60 hover:text-violet-400 hover:bg-violet-500/10 transition-all border border-violet-500/[0.05]"
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
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] transition-all disabled:opacity-50"
                >
                    {isExpanding
                        ? <><div className="w-3 h-3 animate-spin border border-zinc-600 border-t-transparent rounded-full" />Criando subtarefas...</>
                        : <><ListTree className="w-3 h-3" />Ver subtarefas</>}
                </button>
            ) : (
                <button
                    onClick={onExpandSubtasks}
                    disabled={isExpanding || !!autoExecuting}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] transition-all disabled:opacity-50"
                >
                    {isExpanding
                        ? <><div className="w-3 h-3 animate-spin border border-zinc-600 border-t-transparent rounded-full" />Refazendo...</>
                        : <><RefreshCw className="w-3 h-3" />Refazer subtarefas</>}
                </button>
            )}

            {hasSubtasks && (
                <button
                    onClick={onRedoSubtasks}
                    disabled={!!autoExecuting}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-amber-500/[0.03] text-amber-400/60 hover:text-amber-400 hover:bg-amber-500/10 transition-all border border-amber-500/[0.05]"
                >
                    <RefreshCw className="w-3 h-3" />
                    Refazer Subtarefas
                </button>
            )}

            <button
                onClick={onRedoTask}
                disabled={!!autoExecuting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-white/[0.02] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.05] transition-all border border-white/[0.02]"
            >
                <RefreshCw className="w-3 h-3 opacity-40" />
                Refazer Tarefa
            </button>
        </div>
    );
}
