'use client';

import React from 'react';
import { Circle, CheckCircle2, AlertTriangle, Loader2, RefreshCw, Clock, Play, ListTree, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { TaskItem } from '@/features/workspace/components/pillar-workspace/types';
import { SourceBadgeList } from '@/features/workspace/components/pillar-workspace/components/SourceBadgeList';
import { MarkdownContent } from '@/features/workspace/components/pillar-workspace/components/MarkdownContent';
import { StreamingText } from '@/features/workspace/components/pillar-workspace/components/StreamingText';
import { cleanMarkdown } from '@/features/workspace/components/pillar-workspace/utils';

// Sub-component so useState is used at the top level of a real component
function SubtaskList({ subtasks, safeRender, isLoading = false, isDone = false, activeIndex = -1, execStatuses = {} }: {
    subtasks: any;
    safeRender: (t: string) => string;
    isLoading?: boolean;
    isDone?: boolean;
    activeIndex?: number;
    execStatuses?: Record<number, string>;
}) {
    const [isExp, setIsExp] = React.useState(false);
    const renderList: any[] = subtasks?.subtarefas || [];

    // When not expanded, show the active subtask if it's within range, otherwise show the first one.
    const effectiveIndex = (activeIndex >= 0 && activeIndex < renderList.length) ? activeIndex : 0;
    const itemsToShow = isExp ? renderList : [renderList[effectiveIndex]];

    return (
        <>
            <style>{`
                @keyframes subtask-shimmer {
                    0%   { transform: translateX(-100%); }
                    100% { transform: translateX(200%); }
                }
            `}</style>
            <div className="flex flex-col gap-1 w-full">
                {itemsToShow.map((st: any, arrayIdx: number) => {
                    const i = isExp ? arrayIdx : effectiveIndex;
                    const status = execStatuses[i] || 'waiting';

                    return (
                        <div
                            key={i}
                            className="relative overflow-hidden transition-colors rounded-lg flex items-center gap-3 px-3 w-full hover:bg-white/[0.04] border border-transparent hover:border-white/[0.02]"
                        >
                            {/* Shimmer sweep — only on the currently running subtask or if overall loading at this index */}
                            {((isLoading && i === activeIndex) || status === 'running') && (
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '50%',
                                        height: '100%',
                                        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)',
                                        animation: 'subtask-shimmer 1.6s ease-in-out infinite',
                                        pointerEvents: 'none',
                                        zIndex: 0,
                                    }}
                                />
                            )}
                            {/* Done badge — per subtask or whole task done */}
                            {(isDone || status === 'done')
                                ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 relative z-10" />
                                : status === 'running' || (isLoading && i === activeIndex)
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-500 shrink-0 relative z-10" />
                                    : <Circle className="w-3.5 h-3.5 text-zinc-600 shrink-0 relative z-10" />
                            }
                            <span className={`text-[12px] font-medium truncate flex-1 relative z-10 ${status === 'done' || isDone ? 'text-zinc-500' : 'text-zinc-300'}`}>
                                {safeRender(st.titulo)}
                            </span>
                            {arrayIdx === 0 && renderList.length > 1 && (
                                <button
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsExp(p => !p); }}
                                    className="relative z-10 flex items-center justify-center p-1 rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-300 transition-colors ml-2"
                                    title={isExp ? 'Recolher' : 'Expandir'}
                                >
                                    {isExp ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </>
    );
}

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
    displayMode?: 'all' | 'result' | 'lines' | 'subtasks';
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

    const getOpinionText = (result: any, allowFallback = false) => {
        if (!result) return '';
        // Prioritize opiniao or resumo for the activity feed/thoughts
        let base = result.opiniao || result.resumo || '';

        // If done and still no opinion, use conteudo or stringified result as a safe fallback
        if (!base && allowFallback) {
            if (result.conteudo) {
                base = result.conteudo;
            } else {
                // Try to find any meaningful text content if the structure is unexpected
                const meaningfulKeys = Object.keys(result).filter(k =>
                    !['sources', 'task_id', 'entregavel_titulo', 'fontes_consultadas', 'entregavel_tipo'].includes(k)
                );
                if (meaningfulKeys.length > 0) {
                    const firstKey = meaningfulKeys[0];
                    const val = result[firstKey];
                    base = Array.isArray(val) ? val.join(', ') : String(val);
                }
            }
        }

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

        // Collect all subtasks that have results or are currently streaming
        const items: { index: number; result: any; isStreaming: boolean }[] = [];
        const currentStep = (autoExecStep || 0) - 1; // index of the step currently streaming

        for (let i = 0; i < taskExecSubtasks.length; i++) {
            const status = taskExecStatuses[i];
            const result = taskExecResults[i];
            const isStreaming = isAutoExec && i === currentStep;

            if (status === 'done' || isStreaming || result) {
                items.push({ index: i, result, isStreaming });
            }
        }

        if (items.length === 0) return null;

        return (
            <div className="w-full space-y-6 px-1 pt-3">
                <style>{`
                    @keyframes result-block-fade-in {
                        from { opacity: 0; transform: translateY(10px); }
                        to   { opacity: 1; transform: translateY(0); }
                    }
                `}</style>
                {items.map(({ index, result, isStreaming }) => {
                    const status = taskExecStatuses[index];
                    const opinionText = getOpinionText(result, status === 'done');
                    // Use opinion/resumo for streaming, never use the full technical content (conteudo) in the feed
                    const streamingText = safeRender(result?.opiniao || result?.resumo || '');
                    const hasSources = result && (result.sources?.length > 0 || result.fontes_consultadas?.length > 0);
                    const subtaskTitle = safeRender(taskExecSubtasks[index]?.titulo || '');

                    return (
                        <div key={index} className="w-full" style={{
                            animation: 'result-block-fade-in 0.5s ease-out forwards',
                            opacity: 0
                        }}>
                            {/* Subtask title */}
                            <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                                {subtaskTitle}
                            </div>

                            {/* Sources first */}
                            {hasSources && (
                                <div className="mb-3">
                                    <SourceBadgeList
                                        sources={[...(result.sources || []), ...(result.fontes_consultadas || [])]}
                                        maxVisible={4}
                                        animated={isStreaming || taskExecStatuses[index] === 'done'}
                                    />
                                </div>
                            )}

                            {/* AI opinion / streaming */}
                            {(opinionText || isStreaming) ? (
                                isStreaming ? (
                                    streamingText ? (
                                        <StreamingText text={streamingText} speed={6} className="text-[13px] text-zinc-300 leading-relaxed" />
                                    ) : (
                                        <div className="flex items-center gap-0.5 py-2">
                                            {[0, 1, 2].map(i => (
                                                <span
                                                    key={i}
                                                    className="w-1 h-1 rounded-full bg-zinc-500"
                                                    style={{ animation: 'dot-pulse 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }}
                                                />
                                            ))}
                                        </div>
                                    )
                                ) : (
                                    <div className="space-y-2">
                                        {renderOpinionParagraphs(opinionText)}
                                    </div>
                                )
                            ) : (
                                <div className="flex items-center gap-0.5 py-2">
                                    {[0, 1, 2].map(i => (
                                        <span
                                            key={i}
                                            className="w-1 h-1 rounded-full bg-zinc-500"
                                            style={{ animation: 'dot-pulse 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };


    const renderLines = () => {
        const [isExpanded, setIsExpanded] = React.useState(false);

        if (displayMode === 'result') {
            return null;
        }

        return (
            <div className="w-full">


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
                                        // Also look for undefined as waiting
                                        const waitingIndex = taskExecSubtasks.findIndex((_: any, i: number) => !taskExecStatuses[i] || taskExecStatuses[i] === 'waiting');
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
                                    const subtaskOpinionText = getOpinionText(resultForSubtask, status === 'done');

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
                                                    {status === 'running' && <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-500" />}
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

                {/* Regular subtasks list — shown in bottom card; with shimmer when auto-executing */}
                {displayMode === 'lines' && subtasks && !hasExecPanel && (
                    <SubtaskList subtasks={subtasks} safeRender={safeRender} isLoading={isAutoExec && taskExecSubtasks.length > 0} />
                )}

            </div>
        );
    };

    if (displayMode === 'result') return renderResult();
    if (displayMode === 'lines') return renderLines();
    if (displayMode === 'subtasks') {
        if (!subtasks) {
            if (isExpanding || isAutoExec) {
                return (
                    <div className="flex items-center gap-0.5 px-3 py-2">
                        {[0, 1, 2].map(i => (
                            <span
                                key={i}
                                className="w-1 h-1 rounded-full bg-zinc-500"
                                style={{ animation: 'dot-pulse 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }}
                            />
                        ))}
                    </div>
                );
            }
            return null;
        }
        // Find which subtask is currently running
        const runningIdx = taskExecSubtasks.findIndex((_, i) => taskExecStatuses[i] === 'running');
        const activeIndex = runningIdx !== -1 ? runningIdx : -1;
        return <SubtaskList subtasks={subtasks} safeRender={safeRender} isLoading={isAutoExec} isDone={isDone} activeIndex={activeIndex} execStatuses={taskExecStatuses} />;
    }

    return (
        <div className="mt-3 space-y-3 w-full">
            {renderResult()}
            {renderLines()}
        </div>
    );
}
