'use client';

import React from 'react';
import { Circle, CheckCircle2, AlertTriangle, Loader2, RefreshCw, Clock, Play, ListTree, ChevronDown, ChevronUp, Check, Globe, Newspaper, TrendingUp, Search, Building2, Zap } from 'lucide-react';
import { TaskItem } from '@/features/workspace/components/pillar-workspace/types';
import { SourceBadgeList } from '@/features/workspace/components/pillar-workspace/components/SourceBadgeList';
import { MarkdownContent } from '@/features/workspace/components/pillar-workspace/components/MarkdownContent';
import { StreamingText } from '@/features/workspace/components/pillar-workspace/components/StreamingText';
import { cleanMarkdown, exportAsCSV, openInGoogleDocs, openInGoogleSheets, openInGoogleForms } from '@/features/workspace/components/pillar-workspace/utils';
import { useSession } from 'next-auth/react';

// ═══ Intelligence Tools Visualization ═══
const TOOL_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string; bgColor: string }> = {
    web_search:            { icon: Search,      label: 'Web Search',       color: 'text-blue-400',    bgColor: 'bg-blue-500/10 border-blue-500/20' },
    web_extractor:         { icon: Globe,        label: 'Web Extractor',    color: 'text-cyan-400',    bgColor: 'bg-cyan-500/10 border-cyan-500/20' },
    news_extractor:        { icon: Newspaper,    label: 'News Intel',       color: 'text-amber-400',   bgColor: 'bg-amber-500/10 border-amber-500/20' },
    trend_analyzer:        { icon: TrendingUp,   label: 'Google Trends',    color: 'text-emerald-400', bgColor: 'bg-emerald-500/10 border-emerald-500/20' },
    trend_analyzer_rising: { icon: Zap,          label: 'Termos em Alta',   color: 'text-orange-400',  bgColor: 'bg-orange-500/10 border-orange-500/20' },
    sales_triggers:        { icon: Zap,          label: 'Sales Triggers',   color: 'text-rose-400',    bgColor: 'bg-rose-500/10 border-rose-500/20' },
    cnpj_lookup:           { icon: Building2,    label: 'CNPJ Lookup',      color: 'text-violet-400',  bgColor: 'bg-violet-500/10 border-violet-500/20' },
};

function IntelToolRow({ tool }: { tool: any }) {
    const [open, setOpen] = React.useState(false);
    const config = TOOL_CONFIG[tool.tool] || { icon: Globe, label: tool.tool };
    const Icon = config.icon;
    const detail = tool.detail as string | undefined;

    return (
        <div className="flex flex-col">
            <button
                onClick={() => detail && setOpen(p => !p)}
                className={`group flex items-center gap-1.5 w-fit transition-colors ${detail ? 'cursor-pointer' : 'cursor-default'}`}
            >
                <Icon className="w-3 h-3 text-zinc-500 shrink-0 group-hover:text-zinc-200 transition-colors" />
                <span className="text-[11px] text-zinc-500 group-hover:text-zinc-200 transition-colors">{config.label}</span>
                {detail && (
                    <ChevronDown className={`w-3 h-3 text-zinc-600 group-hover:text-zinc-300 transition-all duration-200 ${open ? 'rotate-180' : ''}`} />
                )}
            </button>
            {open && detail && (
                <p className="text-[11px] text-zinc-500 leading-relaxed mt-1 pl-[18px]">{detail}</p>
            )}
        </div>
    );
}

function IntelligenceToolsBadges({ tools, isRunning = false }: { tools?: any[]; isRunning?: boolean }) {
    const applied = tools?.filter(t => t.status === 'success') ?? [];
    if (applied.length === 0) return null;

    return (
        <div className="flex flex-col gap-1 py-3">
            {applied.map((tool, idx) => (
                <IntelToolRow key={`${tool.tool}-${idx}`} tool={tool} />
            ))}
        </div>
    );
}

/**
 * If a string looks like raw JSON (starts with { or [), format it into readable markdown.
 * Otherwise return as-is.
 */
function formatJsonAsReadable(text: string): string {
    const trimmed = (text || '').trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return text;
    try {
        const obj = JSON.parse(trimmed);
        return jsonToMarkdown(obj, 0);
    } catch {
        return text;
    }
}

function jsonToMarkdown(value: any, depth: number): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) {
        return value.map(item => {
            if (typeof item === 'string') return `- ${item}`;
            if (typeof item === 'object') return jsonToMarkdown(item, depth + 1);
            return `- ${String(item)}`;
        }).join('\n');
    }
    if (typeof value === 'object') {
        const heading = depth === 0 ? '###' : depth === 1 ? '####' : '**';
        const headingEnd = depth <= 1 ? '' : '**';
        return Object.entries(value).map(([key, val]) => {
            const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
                return `${heading} ${label}${headingEnd}\n${String(val)}`;
            }
            return `${heading} ${label}${headingEnd}\n${jsonToMarkdown(val, depth + 1)}`;
        }).join('\n\n');
    }
    return String(value);
}

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
    const itemsToShow = isExp ? renderList : (renderList.length > 0 ? [renderList[effectiveIndex]] : []);

    return (
        <>
            <style>{`
                @keyframes subtask-shimmer {
                    0%   { transform: translateX(-100%); }
                    100% { transform: translateX(200%); }
                }
            `}</style>
            <div className="flex flex-col gap-1 w-full">
                {itemsToShow.filter(st => st != null).map((st: any, arrayIdx: number) => {
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

// ── Content accordion: "Ver pensamento da IA" + export buttons alongside ──────
function ContentAccordion({
    content,
    executionMode,
    safeRenderFn,
    exportFormats,
    loadingDocId,
    onExport,
}: {
    content: string;
    executionMode?: string;
    safeRenderFn: (t: string) => string;
    exportFormats?: string[];
    loadingDocId: string | null;
    onExport: (fmt: string) => void;
}) {
    const [open, setOpen] = React.useState(false);
    const fmts = exportFormats || [];

    return (
        <div className="mt-3">
            {/* Header row: toggle + export buttons */}
            <div className="flex items-center gap-2 flex-wrap">
                <button
                    onClick={() => setOpen(p => !p)}
                    className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                    <span>Ver pensamento da IA</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
                </button>
                {fmts.length > 0 && (
                    <>
                        <span className="text-zinc-700 select-none">·</span>
                        {fmts.map((fmt) => {
                            const isLoading = loadingDocId === fmt;
                            return (
                                <button
                                    key={fmt}
                                    disabled={!!isLoading}
                                    onClick={() => onExport(fmt)}
                                    className="flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded bg-white/[0.04] text-zinc-400 font-medium hover:bg-white/[0.08] hover:text-zinc-200 transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    {isLoading ? '...' : (
                                        <>
                                            {fmt === 'google_docs' && <img src="/docs.png" alt="" className="w-3 h-3 object-contain" />}
                                            {fmt === 'google_forms' && <img src="/forms.svg" alt="" className="w-3 h-3 object-contain" />}
                                            {(fmt === 'google_sheets' || fmt === 'csv') && <img src="/sheets.png" alt="" className={`w-3 h-3 object-contain ${fmt === 'csv' ? 'opacity-60' : ''}`} />}
                                            {fmt === 'pdf' && <img src="/docs.png" alt="" className="w-3 h-3 object-contain opacity-60" />}
                                            {fmt === 'google_docs' ? 'Google Docs' :
                                             fmt === 'google_forms' ? 'Google Forms' :
                                             fmt === 'google_sheets' ? 'Google Sheets' :
                                             fmt === 'pdf' ? 'PDF' :
                                             fmt === 'csv' ? 'CSV' : fmt}
                                        </>
                                    )}
                                </button>
                            );
                        })}
                    </>
                )}
            </div>

            {/* Collapsible content */}
            {open && (
                <div className="mt-3 text-[13px] font-light text-zinc-100 leading-relaxed">
                    <MarkdownContent content={cleanMarkdown(safeRenderFn(
                        executionMode === 'producao' ? content : formatJsonAsReadable(content)
                    ))} />
                </div>
            )}
        </div>
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
    const { data: session } = useSession();
    const [loadingDoc, setLoadingDoc] = React.useState<string | null>(null);
    const [expandedContent, setExpandedContent] = React.useState<Record<number, boolean>>({});

    // Per-task execution state
    const taskExecSubtasks = autoExecSubtasks?.[tid] || [];
    const taskExecResults = autoExecResults?.[tid] || {};
    const taskExecStatuses = autoExecStatuses?.[tid] || {};
    const hasExecPanel = taskExecSubtasks.length > 0;

    if (isDone && !deliverable && !hasExecPanel) return null;

    const getOpinionText = (result: any, allowFallback = false) => {
        if (!result) return '';
        // Prioritize opiniao or resumo for the quick thought/summary line
        let base = result.opiniao || result.resumo || '';

        // conteudo is rendered separately: inline MarkdownContent for PESQUISA, expandable for PRODUCAO
        // Only fallback to other keys when conteudo isn't available to display
        if (!base && allowFallback && !result.conteudo) {
            const meaningfulKeys = Object.keys(result).filter(k =>
                !['sources', 'task_id', 'entregavel_titulo', 'fontes_consultadas',
                  'entregavel_tipo', 'execution_mode', 'artifact_type',
                  'export_formats', 'structured_data', 'conteudo'].includes(k)
            );
            if (meaningfulKeys.length > 0) {
                const firstKey = meaningfulKeys[0];
                const val = result[firstKey];
                base = Array.isArray(val) ? val.join(', ') : String(val);
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
                        ? 'text-[13px] font-light text-zinc-100 leading-relaxed'
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
            <div className="w-full space-y-6 px-1">
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
{/* Intelligence tools visualization */}
                            <IntelligenceToolsBadges
                                tools={result?.intelligence_tools_used}
                                isRunning={isStreaming}
                            />

                            {/* Sources above title */}
                            {hasSources && (
                                <div className="mb-3">
                                    <SourceBadgeList
                                        sources={[...(result.sources || []), ...(result.fontes_consultadas || [])]} 
                                        maxVisible={4}
                                        animated={isStreaming || taskExecStatuses[index] === 'done'}
                                    />
                                </div>
                            )}

                            {/* Subtask title */}
                            <div className="flex items-center gap-2 mb-2">
                                <div className="text-[24px] font-medium text-white tracking-normal">
                                    {subtaskTitle}
                                </div>
                            </div>

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
                            ) : result?.conteudo && status === 'done' ? null : (
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

                            {/* PESQUISA: instructional "como fazer" content shown as AI opinion */}
                            {/* Content accordion — "Ver pensamento da IA" + export buttons */}
                            {result?.conteudo && status === 'done' && !isStreaming && (
                                <ContentAccordion
                                    content={result.conteudo}
                                    executionMode={result.execution_mode}
                                    safeRenderFn={safeRender}
                                    exportFormats={result.export_formats}
                                    loadingDocId={loadingDoc}
                                    onExport={(fmt) => {
                                        if (fmt === 'csv' && result.structured_data) {
                                            exportAsCSV(result.structured_data, safeRender(result.entregavel_titulo || 'dados'));
                                        } else if (fmt === 'google_sheets' && result.structured_data?.abas?.length > 0) {
                                            openInGoogleSheets(
                                                result, session,
                                                (id) => setLoadingDoc(id ? `${tid}_${index}_${fmt}` : null),
                                                `${tid}_st${index}`
                                            );
                                        } else if (fmt === 'google_forms' && result.structured_data?.secoes?.length > 0) {
                                            openInGoogleForms(
                                                result, session,
                                                (id) => setLoadingDoc(id ? `${tid}_${index}_${fmt}` : null),
                                                `${tid}_st${index}`
                                            );
                                        } else if (fmt === 'google_docs' || fmt === 'pdf') {
                                            openInGoogleDocs(
                                                { ...result, conteudo_completo: result.conteudo },
                                                '', session,
                                                (id) => setLoadingDoc(id ? `${tid}_${index}_${fmt}` : null),
                                                `${tid}_st${index}`
                                            );
                                        }
                                    }}
                                />
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
                                                    {st.modo_execucao === 'producao' && (
                                                        <span className="inline-flex items-center px-1 py-0 mr-1.5 text-[8px] font-bold tracking-wider uppercase rounded bg-amber-500/15 text-amber-400/80 border border-amber-500/20">
                                                            produção
                                                        </span>
                                                    )}
                                                    {safeRender(st.titulo)}
                                                </span>

                                                {status === 'running' && (
                                                    <span className="text-[9px] font-medium text-violet-400 animate-pulse px-2">
                                                        {st.modo_execucao === 'producao' ? '🏭 Produzindo...' : 'Executando...'}
                                                    </span>
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
                                                    {renderResearchBubbles(
                                                        st.modo_execucao === 'producao' 
                                                            ? '🏭 Produzindo artefato...' 
                                                            : 'Pesquisando fontes...'
                                                    )}
                                                    <div className="px-3 pb-2">
                                                        <IntelligenceToolsBadges isRunning={true} />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Intelligence tools used — shown after completion */}
                                            {status === 'done' && resultForSubtask?.intelligence_tools_used && (
                                                <div className="px-3">
                                                    <IntelligenceToolsBadges tools={resultForSubtask.intelligence_tools_used} />
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
