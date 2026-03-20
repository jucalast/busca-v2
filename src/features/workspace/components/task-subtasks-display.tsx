'use client';

import React from 'react';
import { Circle, CheckCircle2, AlertTriangle, Loader2, RefreshCw, Clock, Play, ListTree, ChevronDown, ChevronUp, Check, Globe, Newspaper, TrendingUp, Search, Building2, Zap } from 'lucide-react';
import { TaskItem } from '@/features/workspace/components/pillar-workspace/types';
import { SourceBadgeList } from '@/features/shared/components/SourceBadgeList';
import { MarkdownContent } from '@/features/shared/components/MarkdownContent';
import { StreamingText } from '@/features/shared/components/StreamingText';
import { cleanMarkdown, exportAsCSV, openInGoogleDocs, openInGoogleSheets, openInGoogleForms } from '@/features/workspace/components/pillar-workspace/utils';
import { useSession } from 'next-auth/react';
import { useSidebar } from '@/contexts/SidebarContext';

import { IntelligenceToolsBadges } from '@/features/shared/components/intelligence-tools';

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
                            className="relative overflow-hidden transition-colors rounded-lg flex items-center gap-3 px-3 w-full border border-transparent"
                            style={{
                                backgroundColor: 'transparent',
                            }}
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
                                        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)',
                                        animation: 'subtask-shimmer 1.6s ease-in-out infinite',
                                        pointerEvents: 'none',
                                        zIndex: 0,
                                    }}
                                />
                            )}
                            {/* Done badge — per subtask or whole task done */}
                            {(isDone || status === 'done')
                                ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 relative z-10" style={{ color: 'var(--color-success)' }} />
                                : status === 'running' || (isLoading && i === activeIndex)
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 relative z-10" style={{ color: 'var(--color-text-muted)' }} />
                                    : <Circle className="w-3.5 h-3.5 shrink-0 relative z-10" style={{ color: 'var(--color-text-muted)' }} />
                            }
                            <span
                                className="text-[12px] font-medium truncate flex-1 relative z-10"
                                style={{
                                    color: status === 'done' || isDone ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
                                    textDecoration: status === 'done' || isDone ? 'line-through' : 'none',
                                    opacity: status === 'done' || isDone ? 0.6 : 1
                                }}
                            >
                                {safeRender(st.titulo)}
                            </span>
                            {arrayIdx === 0 && renderList.length > 1 && (
                                <button
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsExp(p => !p); }}
                                    className="relative z-10 flex items-center justify-center p-1 rounded transition-colors ml-2"
                                    style={{ color: 'var(--color-text-muted)' }}
                                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
                                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}
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
                    className="flex items-center gap-1.5 text-[11px] transition-colors"
                    style={{ color: 'var(--color-text-muted)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}
                >
                    <span>Ver pensamento da IA</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
                </button>
                {fmts.length > 0 && (
                    <>
                        <span className="select-none" style={{ color: 'var(--color-text-ghost)' }}>·</span>
                        {fmts.map((fmt) => {
                            const isLoading = loadingDocId === fmt;
                            return (
                                <button
                                    key={fmt}
                                    disabled={!!isLoading}
                                    onClick={() => onExport(fmt)}
                                    className="flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded font-medium transition-colors cursor-pointer disabled:opacity-50"
                                    style={{
                                        backgroundColor: 'var(--color-surface-hover)',
                                        color: 'var(--color-text-tertiary)'
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.backgroundColor = 'var(--color-surface-active)';
                                        e.currentTarget.style.color = 'var(--color-text-secondary)';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
                                        e.currentTarget.style.color = 'var(--color-text-tertiary)';
                                    }}
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
                <div className="mt-3 text-[13px] font-light leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
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
    const { isDark } = useSidebar();
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

        return cleanMarkdown(String(safeRender(base) || ''));
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
                        ? 'text-[14px] font-normal leading-relaxed'
                        : 'text-[12px] leading-relaxed'}
                    style={{ color: variant === 'full' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}
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
                        className="w-2 h-2 rounded-full animate-pulse"
                        style={{
                            backgroundColor: 'var(--color-accent)',
                            animationDelay: `${idx * 120}ms`,
                            opacity: 0.6
                        }}
                    />
                ))}
            </div>
            <span className="text-[9px] font-semibold tracking-[0.24em] uppercase" style={{ color: 'var(--color-accent)' }}>
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

            if (status === 'done' || isStreaming || (result && (result.opiniao || result.conteudo || result.resumo))) {
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
                            {/* 🔄 STRATEGIC FEEDBACK LOOP INSIGHTS */}
                            {result?.strategic_insights && (
                                <div className={`mb-4 p-4 rounded-xl border backdrop-blur-sm ${
                                    isDark ? 'border-blue-500/30 bg-blue-500/10' : 'border-blue-500/20 bg-blue-500/5'
                                }`}>
                                    <div className="flex items-center gap-2 mb-2 text-blue-600">
                                        <Zap className="w-4 h-4 fill-current" />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Descoberta Estratégica Realimentada</span>
                                    </div>
                                    <div className="space-y-3">
                                        {result.strategic_insights.score_adjustment && (
                                            <div className="flex items-center gap-2">
                                                <div className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                                                    result.strategic_insights.score_adjustment.delta > 0 
                                                        ? (isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-500/10 text-emerald-600')
                                                        : (isDark ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-500/10 text-rose-600')
                                                }`}>
                                                    {result.strategic_insights.score_adjustment.delta > 0 ? '+' : ''}{result.strategic_insights.score_adjustment.delta} Score
                                                </div>
                                                <span className={`text-[11px] italic ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>"{result.strategic_insights.score_adjustment.motivo}"</span>
                                            </div>
                                        )}
                                        {result.strategic_insights.profile_updates && Object.keys(result.strategic_insights.profile_updates).length > 0 && (
                                            <div className="flex flex-wrap gap-2">
                                                {Object.entries(result.strategic_insights.profile_updates).map(([k, v]) => (
                                                    <div key={k} className={`text-[9px] px-2 py-1 rounded border ${
                                                        isDark ? 'bg-zinc-800 border-white/10 text-zinc-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                                                    }`}>
                                                        <span className="font-bold uppercase opacity-80 mr-1">{k}:</span> {String(v)}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

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
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="text-[22px] font-bold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
                                    {subtaskTitle}
                                </div>
                                {result !== undefined && (
                                    <div className="flex items-center gap-2 opacity-60">
                                        <span className={`text-[10px] font-bold tabular-nums whitespace-nowrap ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                                            1 req
                                        </span>
                                        <span className={`${isDark ? 'text-white/10' : 'text-slate-300'} mx-0.5`}>•</span>
                                        {result._actual_provider && (
                                            <div className={`flex items-center gap-1.5 mr-1 border-r pr-2 ${
                                                isDark ? 'border-white/10' : 'border-slate-200'
                                            }`}>
                                                <img
                                                    src={
                                                        result._actual_provider === 'gemini' ? '/gemini.png' :
                                                            result._actual_provider === 'groq' ? '/groq llama.svg' :
                                                                result._actual_provider === 'sambanova' ? '/sambanova.png' :
                                                                    result._actual_provider === 'deepseek' ? '/deepseek.png' :
                                                                        result._actual_provider === 'cerebras' ? '/cerebras.png' :
                                                                            result._actual_provider === 'openrouter' ? '/openrouter.png' :
                                                                                '/groq llama.svg'
                                                    }
                                                    className="w-3.5 h-3.5 rounded-sm object-contain"
                                                    alt={result._actual_provider}
                                                    style={{ filter: result._actual_provider === 'groq' ? (isDark ? 'none' : 'invert(1)') : 'none' }}
                                                />
                                                <span className={`text-[10px] font-bold capitalize ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                                                    {result._actual_model || (result._actual_provider === 'groq' ? 'Groq' :
                                                        result._actual_provider === 'gemini' ? 'Gemini' :
                                                            result._actual_provider === 'sambanova' ? 'SambaNova' :
                                                                result._actual_provider === 'cerebras' ? 'Cerebras' :
                                                                    result._actual_provider === 'deepseek' ? 'DeepSeek' :
                                                                        result._actual_provider)}
                                                </span>
                                            </div>
                                        )}
                                        {result._tokens > 0 && (
                                            <>
                                                <Zap className="w-3 h-3 text-amber-500" />
                                                <span className={`text-[10px] font-mono font-bold ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>{result._tokens} tokens</span>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* AI opinion / streaming */}
                            {(opinionText || isStreaming) ? (
                                isStreaming ? (
                                    streamingText ? (
                                        <StreamingText text={streamingText} speed={6} className="text-[14px] leading-relaxed" style={{ color: 'var(--color-text-primary)' }} />
                                    ) : (
                                        <div className="flex items-center gap-0.5 py-2">
                                            {[0, 1, 2].map(i => (
                                                <span
                                                    key={i}
                                                    className="w-1.5 h-1.5 rounded-full"
                                                    style={{ backgroundColor: 'var(--color-text-muted)', animation: 'dot-pulse 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }}
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
                                            className="w-1.5 h-1.5 rounded-full"
                                            style={{ backgroundColor: 'var(--color-text-muted)', animation: 'dot-pulse 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }}
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
                {items.length > 1 && (
                    <div className={`flex justify-end pt-5 border-t mt-8 transition-colors duration-300 ${
                        isDark ? 'border-white/5' : 'border-slate-100'
                    }`}>
                        <div className="flex items-center gap-2.5 group">
                            <span className={`text-[10px] uppercase tracking-widest font-bold transition-colors ${
                                isDark ? 'text-zinc-600 group-hover:text-zinc-500' : 'text-slate-400 group-hover:text-slate-500'
                            }`}>Total Tokens do Processo</span>
                            <div className="flex items-center gap-2">
                                <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20" />
                                <span className={`text-[13px] font-mono font-bold ${isDark ? 'text-zinc-300' : 'text-slate-800'}`}>
                                    {items.reduce((sum, item) => sum + (item.result?._tokens || 0), 0)}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
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
                                            <div className={`px-3 pb-3 pt-2 border-t transition-colors duration-300 ${
                                                isDark ? 'border-white/5' : 'border-slate-200/40'
                                            }`}>
                                                <div className={`text-[9px] font-bold tracking-[0.2em] uppercase mb-1 ${
                                                    isDark ? 'text-zinc-600' : 'text-slate-400'
                                                }`}>Opinião da IA</div>
                                                <div className="space-y-1.5">
                                                    {renderOpinionParagraphs(subtaskOpinionText, 'compact')}
                                                </div>
                                            </div>
                                        );
                                    };

                                    return (
                                        <div key={i} className={`transition-colors rounded-lg overflow-hidden flex flex-col border border-transparent`}
                                            style={{
                                                backgroundColor: status === 'running' ? 'var(--color-surface-active)' : 'transparent',
                                                borderColor: status === 'running' ? 'var(--color-border-strong)' : 'transparent',
                                                ...(status === 'error' ? { backgroundColor: 'var(--color-destructive-muted)', borderColor: 'rgba(239,68,68,0.1)' } : {}),
                                                ...(status !== 'running' && status !== 'error' ? { ':hover': { backgroundColor: 'var(--color-surface-hover)' } } : {}) as any // Simple fallback inline
                                            }}>
                                            <div className="flex items-center gap-3 px-3 w-full">
                                                <div className="flex-shrink-0 w-3.5 h-3.5 flex items-center justify-center">
                                                    {status === 'waiting' && <Circle className="w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} />}
                                                    {status === 'running' && <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--color-text-tertiary)' }} />}
                                                    {status === 'done' && <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--color-success)' }} />}
                                                    {status === 'error' && <AlertTriangle className="w-3.5 h-3.5" style={{ color: 'var(--color-destructive)' }} />}
                                                </div>

                                                <span
                                                    className="text-[12px] font-medium truncate flex-1"
                                                    style={{
                                                        color: status === 'done' ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
                                                        textDecoration: status === 'done' ? 'line-through' : 'none',
                                                        opacity: status === 'done' ? 0.6 : 1
                                                    }}
                                                >
                                                    {st.modo_execucao === 'producao' && (
                                                        <span
                                                            className="inline-flex items-center px-1 py-0 mr-1.5 text-[8px] font-bold tracking-wider uppercase rounded"
                                                            style={{
                                                                backgroundColor: 'var(--color-warning-muted)',
                                                                color: 'var(--color-warning)',
                                                                border: '1px solid rgba(234,179,8,0.2)'
                                                            }}
                                                        >
                                                            produção
                                                        </span>
                                                    )}
                                                    {safeRender(st.titulo)}
                                                </span>

                                                {status === 'running' && (
                                                    <span className="text-[9px] font-medium animate-pulse px-2" style={{ color: 'var(--color-accent)' }}>
                                                        {st.modo_execucao === 'producao' ? '🏭 Produzindo...' : 'Executando...'}
                                                    </span>
                                                )}

                                                {status === 'done' && resultForSubtask?._tokens > 0 && (
                                                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ml-auto transition-colors duration-300 ${
                                                        isDark ? 'text-zinc-500 bg-white/5 border-white/10' : 'text-slate-500 bg-slate-100 border-slate-200'
                                                    }`}>
                                                        {resultForSubtask._tokens} unit
                                                    </span>
                                                )}

                                                {status === 'error' && (
                                                    <span className="text-[9px] font-medium px-2" style={{ color: 'var(--color-destructive)' }}>Falhou</span>
                                                )}

                                                {handleRetryAutoExecSubtask && status === 'error' && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleRetryAutoExecSubtask(pillarKey, task, i); }}
                                                        className="flex items-center justify-center p-1 rounded transition-colors"
                                                        style={{ color: 'var(--color-text-muted)' }}
                                                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-text-secondary)' }}
                                                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-muted)' }}
                                                        title="Tentar Novamente">
                                                        <RefreshCw className="w-3 h-3" />
                                                    </button>
                                                )}

                                                {/* Expand/Collapse Toggle on First Item */}
                                                {isFirstItemInList && taskExecSubtasks.length > 1 && (
                                                    <button
                                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsExpanded(!isExpanded); }}
                                                        className="flex items-center justify-center p-1 rounded transition-colors ml-2"
                                                        style={{ color: 'var(--color-text-muted)' }}
                                                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-text-secondary)' }}
                                                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-muted)' }}
                                                        title={isExpanded ? 'Recolher' : 'Expandir'}
                                                    >
                                                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                    </button>
                                                )}
                                            </div>

                                            {status === 'running' && (
                                                <div style={{ backgroundColor: 'var(--color-surface-hover)' }}>
                                                    {renderResearchBubbles(
                                                        st.modo_execucao === 'producao'
                                                            ? '🏭 Produzindo artefato...'
                                                            : 'Pesquisando fontes...'
                                                    )}
                                                    
                                                    {/* Show streaming opinion/tools/sources during execution */}
                                                    {resultForSubtask && (
                                                        <div className="px-3 pb-2">
                                                            {/* Intelligence tools being used */}
                                                            {resultForSubtask.intelligence_tools_used && (
                                                                <IntelligenceToolsBadges 
                                                                    tools={resultForSubtask.intelligence_tools_used} 
                                                                    isRunning={true}
                                                                />
                                                            )}
                                                            
                                                            {/* Sources being consulted */}
                                                            {resultForSubtask.sources && resultForSubtask.sources.length > 0 && (
                                                                <div className="mt-2">
                                                                    <SourceBadgeList
                                                                        sources={resultForSubtask.sources}
                                                                        maxVisible={4}
                                                                        animated={true}
                                                                    />
                                                                </div>
                                                            )}
                                                            
                                                            {/* Streaming opinion/thought */}
                                                            {resultForSubtask.opiniao && (
                                                                <div className={`mt-2 px-2 py-1 rounded border transition-colors duration-300 ${
                                                                    isDark ? 'border-white/10 bg-white/5' : 'border-slate-200/40 bg-slate-50/50'
                                                                }`}>
                                                                    <div className={`text-[9px] font-bold tracking-[0.2em] uppercase mb-1 ${
                                                                        isDark ? 'text-zinc-600' : 'text-slate-400'
                                                                    }`}>Pensamento da IA</div>
                                                                    <div className="text-[11px] leading-relaxed">
                                                                        <StreamingText 
                                                                            text={resultForSubtask.opiniao} 
                                                                            speed={8} 
                                                                            style={{ color: 'var(--color-text-secondary)' }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    
                                                    {!resultForSubtask && (
                                                        <div className="px-3 pb-2">
                                                            <IntelligenceToolsBadges isRunning={true} />
                                                        </div>
                                                    )}
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
                            <div
                                className="flex items-center gap-3 px-3 py-2 rounded-lg mt-1"
                                style={{
                                    backgroundColor: 'var(--color-accent-muted)',
                                    border: '1px solid rgba(59,130,246,0.1)',
                                }}
                            >
                                <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--color-accent)' }} />
                                <span className="text-[11px] font-medium" style={{ color: 'var(--color-accent)' }}>Gerando resumo executivo...</span>
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
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: 'var(--color-text-muted)', animation: 'dot-pulse 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }}
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
