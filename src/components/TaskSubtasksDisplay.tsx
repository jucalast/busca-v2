'use client';

import React from 'react';
import { Circle, CheckCircle2, AlertTriangle, Loader2, RefreshCw, Clock, Play, ListTree, ChevronDown, ChevronUp } from 'lucide-react';
import { TaskItem } from './PillarWorkspace/types';
import { SourceBadgeList } from './PillarWorkspace/components/SourceBadgeList';
import { MarkdownContent } from './PillarWorkspace/components/MarkdownContent';
import { StreamingText } from './PillarWorkspace/components/StreamingText';
import { cleanMarkdown } from './PillarWorkspace/utils';

interface TaskSubtasksDisplayProps {
    task: TaskItem;
    pillarKey: string;
    tid: string;
    isDone: boolean;
    subtasks?: any;
    autoExecSubtasks?: Record<string, any[]>;
    autoExecResults?: Record<string, Record<number, any>>;
    autoExecStatuses?: Record<string, Record<number, 'waiting' | 'running' | 'done' | 'error'>>;
    autoExecuting?: string | null;
    autoExecStep?: number;
    autoExecTotal?: number;
    color?: string;
    taskDeliverables?: Record<string, any>;
    expandingTask?: string | null;
    executingTask?: string | null;
    onExpandSubtasks?: () => void;
    onAutoExecute?: () => void;
    handleRetryAutoExecSubtask?: (pillarKey: string, task: TaskItem, subtaskIndex: number) => void;
    safeRender?: (text: string) => string;
    displayMode?: 'all' | 'result' | 'lines';
}

export default function TaskSubtasksDisplay({
    task,
    pillarKey,
    tid,
    isDone,
    subtasks,
    autoExecSubtasks,
    autoExecResults,
    autoExecStatuses,
    autoExecuting,
    autoExecStep,
    autoExecTotal,
    color = '#8b5cf6',
    taskDeliverables,
    expandingTask,
    executingTask,
    onExpandSubtasks,
    onAutoExecute,
    handleRetryAutoExecSubtask,
    displayMode = 'all',
    safeRender = (text) => text
}: TaskSubtasksDisplayProps) {
    const isExecuting = executingTask === tid;
    const isExpanding = expandingTask === tid;
    const isAutoExec = autoExecuting === tid;
    const deliverable = taskDeliverables?.[tid];

    // Per-task execution state
    const taskExecSubtasks = autoExecSubtasks?.[tid] || [];
    const taskExecResults = autoExecResults?.[tid] || {};
    const taskExecStatuses = autoExecStatuses?.[tid] || {};
    const hasExecPanel = taskExecSubtasks.length > 0;

    if (isDone && !deliverable && !hasExecPanel) return null;

    const getOpinionText = (result: any) => {
        if (!result) return '';
        const base = result.opiniao || result.resumo || result.conteudo || '';
        return cleanMarkdown(safeRender(base));
    };

    const renderOpinionParagraphs = (text: string, variant: 'full' | 'compact' = 'full') => {
        if (!text) return null;
        return text
            .split(/\n+/)
            .map(segment => segment.trim())
            .filter(Boolean)
            .map((paragraph, idx) => (
                <p
                    key={`${variant}-${idx}`}
                    className={variant === 'full'
                        ? 'text-[13px] text-zinc-100 leading-relaxed'
                        : 'text-[11px] text-zinc-300 leading-relaxed'}
                >
                    {paragraph}
                </p>
            ));
    };

    const renderResearchBubbles = (label = 'Pesquisando fontes...') => (
        <div className="flex items-center gap-3 px-3 py-2">
            <div className="flex items-center gap-1.5">
                {Array.from({ length: 4 }).map((_, idx) => (
                    <span
                        key={idx}
                        className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-violet-500/60 to-blue-500/40 animate-pulse"
                        style={{ animationDelay: `${idx * 120}ms` }}
                    />
                ))}
            </div>
            <span className="text-[9px] font-semibold tracking-[0.24em] uppercase text-violet-200/70">
                {label}
            </span>
        </div>
    );

    const renderResult = () => {
        if (!hasExecPanel) return null;

        // Find the latest subtask with a result or currently streaming
        let latestStepWithResult = -1;
        for (let i = taskExecSubtasks.length - 1; i >= 0; i--) {
            if (taskExecStatuses[i] === 'done' || (isAutoExec && i === (autoExecStep || 0) - 2)) {
                latestStepWithResult = i;
                break;
            }
        }

        if (latestStepWithResult >= 0) {
            const result = taskExecResults[latestStepWithResult];
            const isStreaming = isAutoExec && latestStepWithResult === (autoExecStep || 0) - 2;
            const opinionText = getOpinionText(result);
            const streamingText = safeRender(result?.conteudo || opinionText || '');

            if (result || isStreaming) {
                return (
                    <div className="w-full mb-4 px-5 py-4 rounded-2xl bg-gradient-to-br from-zinc-900/70 to-zinc-900/30 border border-white/[0.05] shadow-xl backdrop-blur">
                        <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-white/[0.05]">
                            <div className="flex items-center gap-2">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-violet-500/20 text-violet-300 font-bold text-[11px]">
                                    {latestStepWithResult + 1}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">{safeRender(taskExecSubtasks[latestStepWithResult]?.titulo || '')}</span>
                                    {result?.entregavel_titulo && (
                                        <span className="text-[13px] font-semibold text-white/90">{safeRender(result.entregavel_titulo)}</span>
                                    )}
                                </div>
                            </div>
                            <span className="text-[10px] font-semibold tracking-[0.3em] text-violet-200/60 uppercase">Opinião da IA</span>
                        </div>

                        {(opinionText || isStreaming) ? (
                            <div className="space-y-3">
                                {isStreaming ? (
                                    <StreamingText text={streamingText || 'Gerando opinião...'} speed={6} className="text-[13px] text-zinc-100" />
                                ) : (
                                    <div className="space-y-2">
                                        {renderOpinionParagraphs(opinionText)}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-zinc-500 text-[11px] py-4">
                                <Loader2 className="w-4 h-4 animate-spin text-violet-500" /> Elaborando opinião...
                            </div>
                        )}

                        {result && (result.sources?.length > 0 || result.fontes_consultadas?.length > 0) && (
                            <div className="mt-5 pt-4 border-t border-white/[0.05]">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="flex gap-1">
                                        {Array.from({ length: 3 }).map((_, idx) => (
                                            <span key={idx} className="w-1.5 h-1.5 rounded-full bg-violet-400/60 animate-pulse" style={{ animationDelay: `${idx * 120}ms` }} />
                                        ))}
                                    </div>
                                    <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Fontes analisadas</div>
                                </div>
                                <SourceBadgeList sources={[...(result.sources || []), ...(result.fontes_consultadas || [])]} maxVisible={4} />
                            </div>
                        )}
                    </div>
                );
            }
        }
        return null;
    };

    const renderLines = () => {
        const [isExpanded, setIsExpanded] = React.useState(false);

        if (displayMode === 'result') {
            return null;
        }

        return (
            <div className="w-full">
                {/* Expanding spinner — shown only before subtasks load for THIS task */}
                {isAutoExec && !hasExecPanel && (
                    <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-violet-500/[0.03] border border-violet-500/10 mb-3">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />
                        <span className="text-[11px] font-medium text-violet-300/80 uppercase tracking-wider">Criando subtarefas...</span>
                    </div>
                )}

                {hasExecPanel && (
                    <div className="mt-1">
                        {/* Subtask cards — flex-col-reverse so newest is at bottom (chat style) */}
                        <div className="flex flex-col gap-1 px-1 pb-2">
                            {(() => {
                                // Determine which subtask is currently running or should be displayed
                                let defaultIndexToShow = 0;
                                if (isAutoExec) {
                                    // Find the first running or waiting task
                                    const runningIndex = taskExecSubtasks.findIndex((_: any, i: number) => taskExecStatuses[i] === 'running');
                                    if (runningIndex !== -1) {
                                        defaultIndexToShow = runningIndex;
                                    } else {
                                        const waitingIndex = taskExecSubtasks.findIndex((_: any, i: number) => taskExecStatuses[i] === 'waiting');
                                        if (waitingIndex !== -1) {
                                            defaultIndexToShow = waitingIndex;
                                        } else {
                                            // All done or error, show the last one
                                            defaultIndexToShow = taskExecSubtasks.length - 1;
                                        }
                                    }
                                }

                                const itemsToShow = isExpanded
                                    ? taskExecSubtasks
                                    : [taskExecSubtasks[defaultIndexToShow]];

                                return itemsToShow.map((st: any, arrayIndex: number) => {
                                    const i = isExpanded ? arrayIndex : defaultIndexToShow;
                                    if (!st) return null;
                                    const status = taskExecStatuses[i] || 'waiting';
                                    const isAI = st.executavel_por_ia;
                                    const isFirstItemInList = arrayIndex === 0;
                                    const resultForSubtask = taskExecResults[i];
                                    const subtaskOpinionText = getOpinionText(resultForSubtask);

                                    const renderSubtaskOpinion = () => {
                                        if (!resultForSubtask || !subtaskOpinionText) return null;
                                        return (
                                            <div className="px-3 pb-3 pt-2 border-t border-white/[0.03]">
                                                <div className="text-[9px] font-semibold tracking-[0.3em] text-violet-200/60 uppercase mb-1">Opinião da IA</div>
                                                <div className="space-y-1.5">
                                                    {renderOpinionParagraphs(subtaskOpinionText, 'compact')}
                                                </div>
                                            </div>
                                        );
                                    };

                                    return (
                                        <div key={i} className={`transition-colors rounded-lg overflow-hidden flex flex-col hover:bg-white/[0.04] border border-transparent ${status === 'running' ? 'bg-violet-500/[0.04] border-violet-500/10' :
                                            status === 'error' ? 'bg-red-500/[0.03] border-red-500/10' : ''
                                            }`}>
                                            <div className="flex items-center gap-3 px-3 w-full">
                                                <div className="flex-shrink-0 w-3.5 h-3.5 flex items-center justify-center">
                                                    {status === 'waiting' && <Circle className="w-3.5 h-3.5 text-zinc-600" />}
                                                    {status === 'running' && <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />}
                                                    {status === 'done' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                                                    {status === 'error' && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                                                </div>

                                                <span className={`text-[12px] font-medium truncate flex-1 ${status === 'done' ? 'text-zinc-500 line-through decoration-zinc-800' :
                                                    status === 'running' ? 'text-zinc-200' : 'text-zinc-400'
                                                    }`}>
                                                    {safeRender(st.titulo)}
                                                </span>

                                                {status === 'running' && (
                                                    <span className="text-[9px] font-medium text-violet-400 animate-pulse px-2">Executando...</span>
                                                )}

                                                {status === 'error' && (
                                                    <span className="text-[9px] font-medium text-red-400 px-2">Falhou</span>
                                                )}

                                                {handleRetryAutoExecSubtask && status === 'error' && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleRetryAutoExecSubtask(pillarKey, task, i); }}
                                                        className="flex items-center justify-center p-1 rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-300 transition-colors"
                                                        title="Tentar Novamente">
                                                        <RefreshCw className="w-3 h-3" />
                                                    </button>
                                                )}

                                                {/* Expand/Collapse Toggle on First Item */}
                                                {isFirstItemInList && taskExecSubtasks.length > 1 && (
                                                    <button
                                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsExpanded(!isExpanded); }}
                                                        className="flex items-center justify-center p-1 rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-300 transition-colors ml-2"
                                                        title={isExpanded ? 'Recolher' : 'Expandir'}
                                                    >
                                                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                    </button>
                                                )}
                                            </div>

                                            {status === 'running' && (
                                                <div className="bg-violet-500/[0.02]">
                                                    {renderResearchBubbles()}
                                                </div>
                                            )}

                                            {status === 'done' && renderSubtaskOpinion()}
                                        </div>
                                    );
                                });
                            })()}
                        </div>

                        {/* Summary generation indicator */}
                        {(isAutoExec && (autoExecStep || 0) > (autoExecTotal || 0)) || (taskExecSubtasks.length > 0 && !deliverable && (autoExecTotal || 0) > 0 && (autoExecStep || 0) > (autoExecTotal || 0) && !isAutoExec) ? (
                            <div className="flex items-center gap-3 px-3 py-2 bg-blue-500/[0.04] rounded-lg mt-1 border border-blue-500/10">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                                <span className="text-[11px] font-medium text-blue-400/80">Gerando resumo executivo...</span>
                            </div>
                        ) : null}


                    </div>
                )}

                {/* Regular subtasks list */}
                {subtasks && !isAutoExec && !hasExecPanel && (
                    <div className="mt-1">
                        <div className="flex flex-col gap-1 px-1 pb-2">
                            {(() => {
                                const renderList = subtasks.subtarefas || [];
                                const itemsToShow = isExpanded ? renderList : renderList.slice(0, 1);

                                return itemsToShow.map((st: any, i: number) => {
                                    const isFirstItemInList = i === 0;
                                    return (
                                        <div key={i} className="transition-colors rounded-lg overflow-hidden flex items-center gap-3 px-3 w-full hover:bg-white/[0.04] border border-transparent hover:border-white/[0.02]">
                                            <Circle className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                                            <span className="text-[12px] font-medium text-zinc-300 truncate flex-1">
                                                {safeRender(st.titulo)}
                                            </span>

                                            {/* Expand/Collapse Toggle on First Item */}
                                            {isFirstItemInList && renderList.length > 1 && (
                                                <button
                                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsExpanded(!isExpanded); }}
                                                    className="flex items-center justify-center p-1 rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-300 transition-colors ml-2"
                                                    title={isExpanded ? 'Recolher' : 'Expandir'}
                                                >
                                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                </button>
                                            )}
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    if (displayMode === 'result') return renderResult();
    if (displayMode === 'lines') return renderLines();

    return (
        <div className="mt-3 space-y-3 w-full">
            {renderResult()}
            {renderLines()}
        </div>
    );
}
