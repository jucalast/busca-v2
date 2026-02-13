'use client';

import React, { useState } from 'react';

interface TaskSuporteIA {
    tipo: string;
    descricao: string;
    disponivel: boolean;
}

interface TaskData {
    id: string;
    titulo: string;
    categoria: string;
    impacto: number;
    esforco: number;
    prioridade_calculada: number;
    prazo_sugerido: string;
    descricao: string;
    passos: string[];
    suporte_ia: TaskSuporteIA;
    dados_suporte?: Record<string, string>;
}

interface TaskPlan {
    tasks: TaskData[];
    resumo_plano: string;
    meta_principal: string;
    tempo_estimado_total: string;
}

interface TaskBoardProps {
    data: TaskPlan;
    onRequestAssist?: (task: TaskData) => void;
}

const CATEGORY_META: Record<string, { icon: string; color: string; label: string }> = {
    presenca_digital: { icon: '🌐', color: '#3b82f6', label: 'Digital' },
    competitividade: { icon: '🎯', color: '#f59e0b', label: 'Competitividade' },
    canais: { icon: '📡', color: '#8b5cf6', label: 'Canais' },
    precificacao: { icon: '💎', color: '#ec4899', label: 'Preços' },
    mercado: { icon: '📊', color: '#10b981', label: 'Mercado' },
    operacional: { icon: '⚙️', color: '#6366f1', label: 'Operação' },
    credibilidade: { icon: '🏆', color: '#eab308', label: 'Credibilidade' },
    conversao: { icon: '💰', color: '#22c55e', label: 'Conversão' },
};

const IA_TYPE_LABELS: Record<string, { icon: string; label: string }> = {
    copywriting: { icon: '✍️', label: 'Gerar Textos' },
    analise_concorrente: { icon: '🔍', label: 'Analisar Concorrente' },
    lista_leads: { icon: '📋', label: 'Gerar Lista de Leads' },
    script_abordagem: { icon: '📞', label: 'Criar Script' },
    plano_conteudo: { icon: '📅', label: 'Plano de Conteúdo' },
    precificacao: { icon: '💰', label: 'Simular Preços' },
};

type TaskStatus = 'todo' | 'doing' | 'done';

function ImpactDots({ value, max = 10 }: { value: number; max?: number }) {
    return (
        <div className="flex gap-0.5">
            {Array.from({ length: max }, (_, i) => (
                <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full ${i < value ? 'bg-emerald-400' : 'bg-zinc-800'
                        }`}
                />
            ))}
        </div>
    );
}

function TaskCard({
    task,
    status,
    onStatusChange,
    onRequestAssist,
}: {
    task: TaskData;
    status: TaskStatus;
    onStatusChange: (id: string, status: TaskStatus) => void;
    onRequestAssist?: (task: TaskData) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const cat = CATEGORY_META[task.categoria] || { icon: '📌', color: '#71717a', label: task.categoria };
    const iaType = IA_TYPE_LABELS[task.suporte_ia?.tipo] || { icon: '🤖', label: 'Assistente IA' };

    const nextStatus: Record<TaskStatus, TaskStatus> = {
        todo: 'doing',
        doing: 'done',
        done: 'todo',
    };

    const statusDisplay: Record<TaskStatus, { label: string; color: string }> = {
        todo: { label: 'A Fazer', color: 'bg-zinc-800 text-zinc-400' },
        doing: { label: 'Em Progresso', color: 'bg-blue-500/15 text-blue-400' },
        done: { label: 'Concluída', color: 'bg-emerald-500/15 text-emerald-400' },
    };

    return (
        <div
            className={`bg-zinc-950 border rounded-2xl overflow-hidden transition-all duration-300 ${status === 'done'
                    ? 'border-emerald-500/20 opacity-70'
                    : status === 'doing'
                        ? 'border-blue-500/30 shadow-lg shadow-blue-500/5'
                        : 'border-zinc-800 hover:border-zinc-700'
                }`}
        >
            {/* Color strip */}
            <div className="h-1" style={{ background: cat.color }} />

            <div className="p-4">
                {/* Top row */}
                <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-lg flex-shrink-0">{cat.icon}</span>
                        <h4
                            className={`text-sm font-semibold cursor-pointer transition-colors ${status === 'done' ? 'text-zinc-500 line-through' : 'text-white hover:text-emerald-300'
                                }`}
                            onClick={() => setExpanded(!expanded)}
                        >
                            {task.titulo}
                        </h4>
                    </div>
                    <button
                        onClick={() => onStatusChange(task.id, nextStatus[status])}
                        className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all hover:scale-105 flex-shrink-0 ml-2 ${statusDisplay[status].color}`}
                    >
                        {statusDisplay[status].label}
                    </button>
                </div>

                {/* Tags row */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-400 border border-zinc-800">
                        {cat.label}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-400 border border-zinc-800">
                        ⏱️ {task.prazo_sugerido}
                    </span>
                </div>

                {/* Impact/Effort bars */}
                <div className="flex items-center gap-4 text-[10px] text-zinc-500 mb-3">
                    <div className="flex items-center gap-1.5">
                        <span>🔥 Impacto</span>
                        <ImpactDots value={task.impacto} />
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span>⏱️ Esforço</span>
                        <ImpactDots value={task.esforco} />
                    </div>
                </div>

                {/* Expanded content */}
                {expanded && (
                    <div className="space-y-3 animate-in fade-in duration-200 border-t border-zinc-800/50 pt-3 mt-1">
                        <p className="text-zinc-400 text-xs leading-relaxed">{task.descricao}</p>

                        {task.passos && task.passos.length > 0 && (
                            <div>
                                <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
                                    Passos
                                </p>
                                <ol className="space-y-1.5">
                                    {task.passos.map((passo, i) => (
                                        <li key={i} className="flex items-start gap-2 text-xs text-zinc-300">
                                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-zinc-800 text-zinc-500 text-[10px] font-bold flex items-center justify-center mt-0.5">
                                                {i + 1}
                                            </span>
                                            {passo}
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        )}

                        {task.dados_suporte && Object.keys(task.dados_suporte).length > 0 && (
                            <div className="bg-zinc-900/50 rounded-xl p-3">
                                <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
                                    📊 Dados que suportam esta tarefa
                                </p>
                                {Object.entries(task.dados_suporte).map(([key, val]) => (
                                    <p key={key} className="text-xs text-zinc-400">
                                        <span className="text-zinc-500">{key.replace(/_/g, ' ')}:</span> {val}
                                    </p>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* AI Assist button */}
                {task.suporte_ia?.disponivel && status !== 'done' && (
                    <button
                        onClick={() => onRequestAssist?.(task)}
                        className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600/20 to-blue-600/20 border border-violet-500/30 text-violet-300 text-xs font-semibold hover:border-violet-500/50 hover:shadow-lg hover:shadow-violet-500/10 transition-all group"
                    >
                        <span className="text-sm group-hover:scale-110 transition-transform">🤖</span>
                        {iaType.icon} {iaType.label}
                    </button>
                )}
            </div>
        </div>
    );
}

const TaskBoard: React.FC<TaskBoardProps> = ({ data, onRequestAssist }) => {
    const [statuses, setStatuses] = useState<Record<string, TaskStatus>>({});
    const [filter, setFilter] = useState<string>('all');

    const getStatus = (taskId: string): TaskStatus => statuses[taskId] || 'todo';

    const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
        setStatuses(prev => ({ ...prev, [taskId]: newStatus }));
    };

    const tasks = data.tasks || [];
    const categories = [...new Set(tasks.map(t => t.categoria))];

    const filteredTasks = filter === 'all'
        ? tasks
        : tasks.filter(t => t.categoria === filter);

    const completedCount = tasks.filter(t => getStatus(t.id) === 'done').length;
    const progressPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

    return (
        <div className="space-y-6">
            {/* Plan Header */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 md:p-8 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500" />

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="inline-block px-4 py-1.5 rounded-full bg-violet-950/50 border border-violet-800/50 mb-3">
                            <span className="text-violet-400 text-sm font-semibold tracking-wider uppercase">
                                📋 Plano de Crescimento
                            </span>
                        </div>
                        <h2 className="text-xl font-bold text-white mb-1">{data.meta_principal}</h2>
                        <p className="text-zinc-400 text-sm">{data.resumo_plano}</p>
                    </div>

                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <div className="text-right">
                            <span className="text-3xl font-bold text-white tabular-nums">{completedCount}</span>
                            <span className="text-zinc-500 text-sm"> / {tasks.length} tarefas</span>
                        </div>
                        <div className="w-48 h-2 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full transition-all duration-500"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                        <span className="text-xs text-zinc-500">⏱️ {data.tempo_estimado_total}</span>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => setFilter('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${filter === 'all'
                            ? 'bg-zinc-700 text-white'
                            : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300 border border-zinc-800'
                        }`}
                >
                    Todas ({tasks.length})
                </button>
                {categories.map(cat => {
                    const meta = CATEGORY_META[cat] || { icon: '📌', label: cat };
                    const count = tasks.filter(t => t.categoria === cat).length;
                    return (
                        <button
                            key={cat}
                            onClick={() => setFilter(cat)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${filter === cat
                                    ? 'bg-zinc-700 text-white'
                                    : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300 border border-zinc-800'
                                }`}
                        >
                            {meta.icon} {meta.label} ({count})
                        </button>
                    );
                })}
            </div>

            {/* Task Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredTasks.map(task => (
                    <TaskCard
                        key={task.id}
                        task={task}
                        status={getStatus(task.id)}
                        onStatusChange={handleStatusChange}
                        onRequestAssist={onRequestAssist}
                    />
                ))}
            </div>
        </div>
    );
};

export default TaskBoard;
