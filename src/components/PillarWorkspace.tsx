'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
    Users, Palette, Eye, ShoppingBag, TrendingUp, Megaphone, HandCoins,
    ChevronRight, ArrowLeft, Loader2, Bot, User as UserIcon,
    CheckCircle2, Circle, AlertTriangle, Link2, ExternalLink,
    Clock, BarChart3, ChevronDown, ChevronUp, Sparkles,
    RefreshCw, Play, FileText, ListTree, Wand2, Target,
    Layers, ArrowRight, Zap, Globe, Package, Loader, Check
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useSession, signIn } from 'next-auth/react';
import { useAuth } from '../contexts/AuthContext';

// ─── Pillar metadata ───
const PILLAR_META: Record<string, { label: string; icon: any; color: string; ordem: number }> = {
    publico_alvo: { label: 'Público-Alvo', icon: Users, color: '#8b5cf6', ordem: 1 },
    branding: { label: 'Branding', icon: Palette, color: '#f59e0b', ordem: 2 },
    identidade_visual: { label: 'Identidade Visual', icon: Eye, color: '#ec4899', ordem: 3 },
    canais_venda: { label: 'Canais de Venda', icon: ShoppingBag, color: '#3b82f6', ordem: 4 },
    trafego_organico: { label: 'Tráfego Orgânico', icon: TrendingUp, color: '#10b981', ordem: 5 },
    trafego_pago: { label: 'Tráfego Pago', icon: Megaphone, color: '#f97316', ordem: 6 },
    processo_vendas: { label: 'Processo de Vendas', icon: HandCoins, color: '#6366f1', ordem: 7 },
};

const PILLAR_ORDER = Object.keys(PILLAR_META).sort((a, b) => PILLAR_META[a].ordem - PILLAR_META[b].ordem);

// ─── Types ───
interface PillarWorkspaceProps {
    score: any;
    specialists: Record<string, any>;
    analysisId: string | null;
    businessId: string | null;
    profile: any;
    marketData: any;
    userProfile: { name: string; segment: string };
    onRedo: () => void;
    onStateChange?: (pillarStates: Record<string, any>, completedTasks: Record<string, Set<string>>) => void;
}

interface TaskItem {
    id: string;
    titulo: string;
    descricao: string;
    executavel_por_ia: boolean;
    entregavel_ia?: string;
    instrucoes_usuario?: string;
    ferramenta?: string;
    ferramenta_url?: string;
    tempo_estimado?: string;
    resultado_esperado?: string;
    kpi?: string;
    prioridade?: string;
    depende_de?: string | null;
    depende_pilar?: string | null;
}

// ─── Helpers ───

function safeRender(value: any): string {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) return value.map(safeRender).join('\n');
    if (typeof value === 'object') {
        return Object.entries(value)
            .map(([k, v]) => {
                const label = k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' ');
                return `${label}: ${safeRender(v)}`;
            })
            .join('\n');
    }
    return String(value);
}

// ─── Google Docs Export (API Native Flow) ───
async function openInGoogleDocs(deliverable: any, pillarLabel: string, session: any, setLoadingDoc: (id: string | null) => void, fallbackId?: string) {
    if (!session || !session.accessToken) {
        // Usuário não logado com o Google, forçamos o login primeiro
        await signIn('google');
        return;
    }

    const docId = deliverable.id || fallbackId || 'export';
    setLoadingDoc(docId);

    const title = safeRender(deliverable.entregavel_titulo || 'Entregável');
    const rawContent = safeRender(deliverable.conteudo_completo || deliverable.conteudo);
    const content = cleanMarkdown(rawContent);
    const comoAplicar = cleanMarkdown(safeRender(deliverable.como_aplicar || ''));
    const impacto = cleanMarkdown(safeRender(deliverable.impacto_estimado || ''));
    const sources = deliverable.sources || deliverable.fontes_consultadas || [];

    let plainText = ``;
    if (pillarLabel) plainText += `Pilar: ${pillarLabel}\n\n`;
    plainText += content + '\n\n';
    if (comoAplicar) plainText += `Como Aplicar\n${comoAplicar}\n\n`;
    if (impacto) plainText += `Impacto Estimado: ${impacto}\n\n`;
    if (sources.length > 0) {
        plainText += `Fontes:\n`;
        sources.forEach((src: string) => {
            plainText += `- ${src}\n`;
        });
        plainText += '\n';
    }

    try {
        const response = await fetch('/api/google-docs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: session.accessToken,
                title: title,
                plainContent: plainText,
            }),
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || 'Falha ao criar documento');
        }

        const result = await response.json();
        if (result.success && result.url) {
            window.open(result.url, '_blank');
        } else {
            throw new Error('Resposta inválida ao criar documento');
        }
    } catch (err: any) {
        console.error('Error creating Google Doc:', err);
        alert('Erro ao criar documento: ' + err.message);
    } finally {
        setLoadingDoc(null);
    }
}

// ─── Full Analysis Export ───
async function exportFullAnalysis(session: any, setLoadingFull: (loading: boolean) => void, analysisData: any, businessName: string) {
    if (!session || !session.accessToken) {
        await signIn('google');
        return;
    }

    setLoadingFull(true);

    try {
        const response = await fetch('/api/export-analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: session.accessToken,
                analysisData: {
                    profile: analysisData.profile,
                    score: analysisData.score,
                    specialists: analysisData.specialists,
                    marketData: analysisData.marketData,
                    taskPlan: analysisData.taskPlan
                },
                businessName: businessName
            }),
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || 'Falha ao criar documento completo');
        }

        const result = await response.json();
        if (result.success && result.url) {
            window.open(result.url, '_blank');
        } else {
            throw new Error('Resposta inválida ao criar documento');
        }
    } catch (err: any) {
        console.error('Error creating full analysis Google Doc:', err);
        alert('Erro ao criar documento completo: ' + err.message);
    } finally {
        setLoadingFull(false);
    }
}

// ─── Markdown content renderer ───
export function cleanMarkdown(raw: string): string {
    if (!raw) return '';
    let s = raw;

    // Remove formatting fences the LLM often adds (e.g. ```markdown ... ```)
    // Works even if the fence is in the middle of the text.
    s = s.replace(/```(markdown|md)?[\s\n]*/gi, '');
    s = s.replace(/```[\s\n]*/g, '');

    return s.trim();
}

function MarkdownContent({ content, className = '' }: { content: string; className?: string }) {
    const raw = typeof content === 'string' ? content : safeRender(content);
    const text = cleanMarkdown(raw);
    return (
        <div className={`markdown-content ${className}`}>
            <ReactMarkdown
                components={{
                    h1: ({ children }) => <h1 className="text-sm font-bold text-zinc-400 mt-3 mb-1.5">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-[13px] font-bold text-zinc-400 mt-2.5 mb-1">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-xs font-semibold text-zinc-500 mt-2 mb-1">{children}</h3>,
                    h4: ({ children }) => <h4 className="text-[11px] font-semibold text-zinc-500 mt-1.5 mb-0.5">{children}</h4>,
                    p: ({ children }) => <p className="text-[11px] text-zinc-500 leading-relaxed mb-1.5">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc list-outside pl-4 mb-1.5 space-y-0.5">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-outside pl-4 mb-1.5 space-y-0.5">{children}</ol>,
                    li: ({ children }) => <li className="text-[11px] text-zinc-500 leading-relaxed">{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold text-zinc-400">{children}</strong>,
                    em: ({ children }) => <em className="italic text-zinc-500">{children}</em>,
                    a: ({ href, children }) => (
                        <a href={href} target="_blank" rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-400 underline underline-offset-2">
                            {children}
                        </a>
                    ),
                    blockquote: ({ children }) => (
                        <blockquote className="border-l-2 border-zinc-700 pl-3 my-1.5 text-zinc-600 italic">{children}</blockquote>
                    ),
                    code: ({ children, className: codeClass }) => {
                        const isInline = !codeClass;
                        return isInline
                            ? <code className="bg-zinc-800 text-zinc-400 px-1 py-0.5 rounded text-[10px] font-mono">{children}</code>
                            : <code className="block bg-zinc-900 text-zinc-400 p-2 rounded-lg text-[10px] font-mono my-1.5 overflow-x-auto">{children}</code>;
                    },
                    pre: ({ children }) => <pre className="bg-zinc-900 rounded-lg my-1.5 overflow-x-auto">{children}</pre>,
                    hr: () => <hr className="border-zinc-800 my-2" />,
                    table: ({ children }) => (
                        <div className="overflow-x-auto my-1.5">
                            <table className="min-w-full text-[10px] border-collapse">{children}</table>
                        </div>
                    ),
                    thead: ({ children }) => <thead className="bg-zinc-800/50">{children}</thead>,
                    th: ({ children }) => <th className="text-left text-zinc-400 font-semibold px-2 py-1 border border-zinc-700/50">{children}</th>,
                    td: ({ children }) => <td className="text-zinc-500 px-2 py-1 border border-zinc-800/50">{children}</td>,
                }}
            >
                {text}
            </ReactMarkdown>
        </div>
    );
}

// ─── Streaming text reveal ───
function StreamingText({ text, speed = 8, className = '' }: { text: string; speed?: number; className?: string }) {
    const [displayed, setDisplayed] = React.useState('');
    const [done, setDone] = React.useState(false);

    React.useEffect(() => {
        if (!text) return;
        setDisplayed('');
        setDone(false);
        let idx = 0;
        const interval = setInterval(() => {
            // Reveal in chunks for smoother feel
            const chunk = Math.min(3, text.length - idx);
            idx += chunk;
            setDisplayed(text.slice(0, idx));
            if (idx >= text.length) {
                clearInterval(interval);
                setDone(true);
            }
        }, speed);
        return () => clearInterval(interval);
    }, [text, speed]);

    return (
        <span className={className}>
            {displayed}
            {!done && <span className="inline-block w-1.5 h-3 bg-zinc-400 animate-pulse ml-0.5 align-middle rounded-sm" />}
        </span>
    );
}

// ─── Sub-components ───

function ScoreRing({ score, size = 48, color }: { score: number; size?: number; color: string }) {
    const r = (size - 6) / 2;
    const circ = 2 * Math.PI * r;
    const pct = Math.max(0, Math.min(100, score));
    return (
        <svg width={size} height={size} className="transform -rotate-90">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={3} />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={3}
                strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)}
                strokeLinecap="round" className="transition-all duration-700" />
            <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
                className="fill-white text-[11px] font-bold" transform={`rotate(90 ${size / 2} ${size / 2})`}>
                {pct}
            </text>
        </svg>
    );
}

function DepBadge({ dep }: { dep: { label: string; score: number; pillar: string } }) {
    const isCritical = dep.score < 25;
    return (
        <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${isCritical
            ? 'bg-red-500/10 text-red-400'
            : 'bg-amber-500/10 text-amber-400'
            }`}>
            <AlertTriangle className="w-2.5 h-2.5" />
            {dep.label} {dep.score}/100
        </span>
    );
}

// ─── Tool Detection for Deliverables ───
function getToolInfo(deliverable: any): { icon: string; name: string; color: string } {
    const title = (deliverable.entregavel_titulo || '').toLowerCase();
    const content = (deliverable.conteudo || '').toLowerCase();
    const tipo = (deliverable.entregavel_tipo || '').toLowerCase();

    // Check for Google Docs
    if (title.includes('documento') || title.includes('doc') || tipo.includes('documento') ||
        content.includes('documento') || content.includes('relatório') || content.includes('texto')) {
        return { icon: '/docs.png', name: 'Google Docs', color: 'text-blue-400' };
    }

    // Check for Google Sheets/Spreadsheets
    if (title.includes('planilha') || title.includes('sheets') || title.includes('tabela') ||
        tipo.includes('planilha') || content.includes('planilha') || content.includes('tabela') ||
        content.includes('dados') || content.includes('métricas')) {
        return { icon: '/sheets.png', name: 'Google Sheets', color: 'text-green-400' };
    }

    // Check for Canva/Design
    if (title.includes('design') || title.includes('visual') || title.includes('banner') ||
        title.includes('logo') || title.includes('identidade') || tipo.includes('design') ||
        content.includes('design') || content.includes('visual') || content.includes('criativo') ||
        content.includes('identidade visual') || content.includes('marca')) {
        return { icon: '/canva.png', name: 'Canva', color: 'text-pink-400' };
    }

    // Default to Docs
    return { icon: '/docs.png', name: 'Google Docs', color: 'text-blue-400' };
}

// ─── Styled Deliverable Card ───
function DeliverableCard({ deliverable, color, session, loadingState, setLoadingDoc }: { deliverable: any; color: string; session: any; loadingState: string | null; setLoadingDoc: (v: string | null) => void }) {
    const [expanded, setExpanded] = useState(true);
    const content = safeRender(deliverable.conteudo);
    const isPartial = deliverable.was_user_task;
    const pct = deliverable.percentual_completado_ia;
    const toolInfo = getToolInfo(deliverable);

    return (
        <div className={`mt-3 p-3 bg-zinc-900 rounded-xl shadow-2xl shadow-black/70 overflow-hidden ${isPartial ? '' : ''}`}>
            {/* Header */}
            <div onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center gap-2.5 p-2.5 rounded-lg transition-all duration-150 cursor-pointer hover:bg-white/[0.04]">
                {/* Tool Icon */}
                <img src={toolInfo.icon} alt={toolInfo.name} className="w-7 h-7 rounded object-contain shrink-0 opacity-60 grayscale" />

                <div className="flex-1 flex items-center gap-2 text-left min-w-0">
                    <span className={`text-[13px] font-medium ${isPartial ? 'text-amber-300' : 'text-zinc-300'}`}>
                        {safeRender(deliverable.entregavel_titulo)}
                    </span>
                    <span className={`text-[11px] ${toolInfo.color}`}>
                        {toolInfo.name}
                    </span>
                    {deliverable.entregavel_tipo && (
                        <span className="text-[11px] text-zinc-600">
                            {safeRender(deliverable.entregavel_tipo)}
                        </span>
                    )}
                    {isPartial && pct && (
                        <span className="text-[11px] text-amber-400">
                            IA completou {pct}%
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <button onClick={(e) => { e.stopPropagation(); openInGoogleDocs(deliverable, '', session, setLoadingDoc); }} disabled={loadingState === (deliverable.id || 'export')}
                        className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg transition-all duration-150 text-[11px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] disabled:opacity-50">
                        {loadingState === (deliverable.id || 'export') ? <Loader2 className="w-4 h-4 animate-spin text-zinc-400" /> : <img src={toolInfo.icon} alt="" className="w-4 h-4 rounded object-contain opacity-60 grayscale" />}
                        {loadingState === (deliverable.id || 'export') ? 'Gerando...' : `Abrir no ${toolInfo.name}`}
                    </button>
                    {expanded ? <ChevronUp className="w-4 h-4 text-zinc-600" /> : <ChevronDown className="w-4 h-4 text-zinc-600" />}
                </div>
            </div>

            {expanded && (
                <div className="px-2.5 pb-2.5 pt-0">
                    <MarkdownContent content={content || 'Resumo final concluído.'} />
                </div>
            )}
        </div>
    );
}

// ─── Subtask List ───
function SubtaskList({ subtasks, color, onExecute, executingId }: {
    subtasks: any; color: string;
    onExecute: (st: any) => void; executingId: string | null;
}) {
    const items = subtasks?.subtarefas || [];
    if (!items.length) return null;

    return (
        <div className="mt-3 p-4 rounded-xl bg-[#0d0d0f]">
            <div className="flex items-center gap-2 mb-3">
                <ListTree className="w-4 h-4" style={{ color }} />
                <span className="text-xs font-semibold text-zinc-400">Subtarefas ({items.length})</span>
            </div>
            <div className="space-y-2">
                {items.map((st: any, i: number) => (
                    <div key={st.id || i} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02]">
                        <span className="text-[10px] font-mono text-zinc-600 mt-1 w-4">{i + 1}</span>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                                <p className="text-xs font-medium text-zinc-300">{safeRender(st.titulo)}</p>
                                <span className={`text-[8px] px-1 py-0.5 rounded-md ${st.executavel_por_ia
                                    ? 'bg-violet-500/10 text-violet-400'
                                    : 'bg-blue-500/10 text-blue-400'
                                    }`}>{st.executavel_por_ia ? 'IA' : 'Você'}</span>
                            </div>
                            {st.descricao && <p className="text-[11px] text-zinc-500 leading-relaxed">{safeRender(st.descricao)}</p>}
                            {st.tempo_estimado && (
                                <span className="text-[10px] text-zinc-600 flex items-center gap-0.5 mt-1">
                                    <Clock className="w-2.5 h-2.5" />{safeRender(st.tempo_estimado)}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            {subtasks.resultado_combinado && (
                <p className="text-[10px] text-zinc-600 mt-3 italic">
                    <Target className="w-3 h-3 inline mr-1" />{safeRender(subtasks.resultado_combinado)}
                </p>
            )}
        </div>
    );
}

// ─── Source Badge List ───
function SourceBadgeList({ sources, maxVisible = 4 }: { sources: string[], maxVisible?: number }) {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!sources || !Array.isArray(sources) || sources.length === 0) return null;

    const uniqueSources = Array.from(new Set(sources.filter(Boolean)));
    if (uniqueSources.length === 0) return null;

    const visibleSources = isExpanded ? uniqueSources : uniqueSources.slice(0, maxVisible);
    const hiddenCount = Math.max(0, uniqueSources.length - maxVisible);

    return (
        <div className="flex flex-wrap gap-2 mt-2">
            {visibleSources.map((src, idx) => {
                let displayUrl = src;
                let hostname = src;
                try {
                    const url = new URL(src);
                    hostname = url.hostname;
                    displayUrl = hostname.replace('www.', '');
                } catch (e) { /* ignore */ }

                const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;

                return (
                    <a key={idx} href={src} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all duration-150 cursor-pointer bg-white/[0.04] hover:bg-white/[0.08] shadow-sm border border-white/[0.02] group">
                        <img
                            src={faviconUrl}
                            alt={displayUrl}
                            className="w-4 h-4 rounded-sm shrink-0 object-contain"
                        />
                        <div className="flex-1 flex flex-col min-w-0 pr-1">
                            <span className="text-[11px] font-medium text-zinc-400 group-hover:text-white transition-colors truncate max-w-[120px] leading-tight mt-[1px]">{displayUrl}</span>
                        </div>
                    </a>
                );
            })}
            {!isExpanded && hiddenCount > 0 && (
                <button
                    onClick={() => setIsExpanded(true)}
                    className="inline-flex items-center px-2 py-1.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.02] text-[10px] text-zinc-400 hover:text-white transition-colors cursor-pointer shadow-sm">
                    +{hiddenCount} mais
                </button>
            )}
            {isExpanded && hiddenCount > 0 && (
                <button
                    onClick={() => setIsExpanded(false)}
                    className="inline-flex items-center px-2 py-1.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.02] text-[10px] text-zinc-400 hover:text-white transition-colors cursor-pointer shadow-sm">
                    Recolher
                </button>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════

export default function PillarWorkspace({
    score, specialists, analysisId, businessId, profile, marketData, userProfile, onRedo, onStateChange,
}: PillarWorkspaceProps) {
    const { data: session } = useSession();
    const { aiModel } = useAuth();
    const [loadingDoc, setLoadingDoc] = useState<string | null>(null);
    const [loadingFullExport, setLoadingFullExport] = useState(false);
    const [selectedPillar, setSelectedPillar] = useState<string | null>(null);
    const [pillarStates, setPillarStates] = useState<Record<string, any>>({});
    const [loadingPillar, setLoadingPillar] = useState<string | null>(null);
    const [executingTask, setExecutingTask] = useState<string | null>(null);
    const [expandingTask, setExpandingTask] = useState<string | null>(null);
    const [taskDeliverables, setTaskDeliverables] = useState<Record<string, any>>({});
    const [taskSubtasks, setTaskSubtasks] = useState<Record<string, any>>({});
    const [completedTasks, setCompletedTasks] = useState<Record<string, Set<string>>>({});
    const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());
    const [showKPIs, setShowKPIs] = useState(false);
    const [error, setError] = useState('');
    const [entregaveisOrder, setEntregaveisOrder] = useState<number[]>([]); // Para controlar ordem dos entregáveis
    // Auto-execution state: expand → execute sequentially
    const [autoExecuting, setAutoExecuting] = useState<string | null>(null); // task id being auto-executed
    const [autoExecStep, setAutoExecStep] = useState<number>(0);
    const [autoExecTotal, setAutoExecTotal] = useState<number>(0);
    const [autoExecLog, setAutoExecLog] = useState<string[]>([]);
    // Per-subtask status + result during auto-execution (keyed by taskId)
    const [autoExecSubtasks, setAutoExecSubtasks] = useState<Record<string, any[]>>({});
    const [autoExecResults, setAutoExecResults] = useState<Record<string, Record<number, any>>>({});
    const [autoExecStatuses, setAutoExecStatuses] = useState<Record<string, Record<number, 'waiting' | 'running' | 'done' | 'error'>>>({});

    const abortControllersRef = React.useRef<Record<string, AbortController>>({});

    // ─── localStorage persistence ───
    const prevAnalysisIdRef = React.useRef<string | null | undefined>(undefined);

    // Combined load / reset effect — uses ref to distinguish first mount from reanalysis
    useEffect(() => {
        if (!analysisId) return;

        const isFirstMount = prevAnalysisIdRef.current === undefined;
        const isReanalysis = !isFirstMount && prevAnalysisIdRef.current !== analysisId;
        prevAnalysisIdRef.current = analysisId;

        if (isReanalysis) {
            // Reanalysis: clear everything + localStorage
            setPillarStates({});
            setTaskDeliverables({});
            setTaskSubtasks({});
            setCompletedTasks({});
            setExpandedTaskIds(new Set());
            setSelectedPillar(null);
            setLoadingPillar(null);
            setExecutingTask(null);
            setExpandingTask(null);
            setAutoExecuting(null);
            setAutoExecStep(0);
            setAutoExecTotal(0);
            setAutoExecLog([]);
            setAutoExecSubtasks({});
            setAutoExecResults({});
            setAutoExecStatuses({});
            setShowKPIs(false);
            setError('');
            localStorage.removeItem(`pillar_workspace_${analysisId}`);
            return;
        }

        // First mount: load persisted state from localStorage
        try {
            const saved = localStorage.getItem(`pillar_workspace_${analysisId}`);
            if (!saved) return;
            const data = JSON.parse(saved);
            if (data.completedTasks) {
                const restored: Record<string, Set<string>> = {};
                for (const [k, v] of Object.entries(data.completedTasks)) {
                    restored[k] = new Set(v as string[]);
                }
                setCompletedTasks(restored);
            }
            if (data.taskDeliverables) setTaskDeliverables(data.taskDeliverables);
            if (data.taskSubtasks) setTaskSubtasks(data.taskSubtasks);
            if (data.autoExecSubtasks) setAutoExecSubtasks(data.autoExecSubtasks);
            if (data.autoExecResults) setAutoExecResults(data.autoExecResults);
            if (data.autoExecStatuses) setAutoExecStatuses(data.autoExecStatuses);
            if (data.pillarStates) setPillarStates(data.pillarStates);
        } catch (e) {
            console.warn('Failed to load persisted state:', e);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [analysisId]);

    // Save state to localStorage on changes
    useEffect(() => {
        if (!analysisId) return;
        // Don't save empty state (right after reset)
        const hasData = Object.keys(completedTasks).length > 0 ||
            Object.keys(taskDeliverables).length > 0 ||
            Object.keys(pillarStates).length > 0;
        if (!hasData) return;

        try {
            const ct: Record<string, string[]> = {};
            for (const [k, v] of Object.entries(completedTasks)) {
                ct[k] = Array.from(v);
            }
            localStorage.setItem(`pillar_workspace_${analysisId}`, JSON.stringify({
                completedTasks: ct,
                taskDeliverables,
                taskSubtasks,
                autoExecSubtasks,
                autoExecResults,
                autoExecStatuses,
                pillarStates,
            }));
        } catch (e) {
            console.warn('Failed to save state:', e);
        }
    }, [completedTasks, taskDeliverables, taskSubtasks, autoExecSubtasks, autoExecResults, autoExecStatuses, pillarStates, analysisId]);

    const dims = score?.dimensoes || {};
    const scoreGeral = score?.score_geral || 0;
    const resumo = score?.resumo_executivo || '';
    const classificacao = score?.classificacao || '';

    // Obter entregáveis do estado atual
    const currentPlan = selectedPillar ? pillarStates[selectedPillar]?.plan?.plan_data : null;
    const entregaveis = currentPlan?.entregaveis || [];

    // Report state changes to parent (for mind map)
    useEffect(() => {
        onStateChange?.(pillarStates, completedTasks);
    }, [pillarStates, completedTasks]);

    useEffect(() => {
        if (entregaveis.length > 0 && entregaveisOrder.length === 0) {
            setEntregaveisOrder(Array.from({ length: entregaveis.length }, (_, i) => i));
        }
    }, [entregaveis.length, entregaveisOrder.length]);

    const handleReorderEntregaveis = (clickedIndex: number) => {
        const newOrder = [...entregaveisOrder];
        const clickedOriginalIndex = newOrder.indexOf(clickedIndex);

        if (clickedOriginalIndex === 0) return; // Já está no meio

        // Mover o clicado para o início (posição 0)
        newOrder.splice(clickedOriginalIndex, 1);
        newOrder.unshift(clickedIndex);

        setEntregaveisOrder(newOrder);
    };

    // ─── API helper ───
    const apiCall = useCallback(async (action: string, data: any, options?: { signal?: AbortSignal }) => {
        const res = await fetch('/api/growth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, aiModel, ...data }),
            signal: options?.signal,
        });
        return await res.json();
    }, [aiModel]);

    // ─── Stop and Redo Handlers ───
    const handleStopExecution = useCallback((tid: string) => {
        if (abortControllersRef.current[tid]) {
            abortControllersRef.current[tid].abort();
            delete abortControllersRef.current[tid];
        }
        // Also clear auto-execution state if this was an auto-execution
        if (autoExecuting === tid) {
            setAutoExecuting(null);
            setAutoExecStep(0);
            setAutoExecTotal(0);
            setAutoExecLog([]);
        }
    }, [autoExecuting]);

    const handleRedoTask = useCallback(async (pillarKey: string, tid: string, task: TaskItem) => {
        // Clear frontend state
        setTaskDeliverables(prev => {
            const next = { ...prev };
            delete next[tid];
            return next;
        });
        setAutoExecResults(prev => {
            const next = { ...prev };
            delete next[tid];
            return next;
        });
        setAutoExecStatuses(prev => {
            const next = { ...prev };
            delete next[tid];
            return next;
        });
        setAutoExecSubtasks(prev => {
            const next = { ...prev };
            delete next[tid];
            return next;
        });
        setCompletedTasks(prev => {
            const next = { ...prev };
            const s = new Set(next[pillarKey] || []);
            s.delete(task.id);
            s.delete(tid);
            next[pillarKey] = s;
            return next;
        });
        setTaskSubtasks(prev => {
            const next = { ...prev };
            delete next[tid];
            return next;
        });

        // Clear backend data
        try {
            await apiCall('redo-task', {
                analysis_id: analysisId,
                pillar_key: pillarKey,
                task_id: task.id,
            });
        } catch (err: any) {
            console.error('Failed to clear task data:', err);
            setError('Failed to reset task data');
        }
    }, [analysisId, apiCall]);

    const handleRedoSubtasks = useCallback(async (pillarKey: string, tid: string, task: TaskItem) => {
        // Clear only subtasks from frontend
        setTaskSubtasks(prev => {
            const next = { ...prev };
            delete next[tid];
            return next;
        });
        setAutoExecResults(prev => {
            const next = { ...prev };
            delete next[tid];
            return next;
        });
        setAutoExecStatuses(prev => {
            const next = { ...prev };
            delete next[tid];
            return next;
        });
        setAutoExecSubtasks(prev => {
            const next = { ...prev };
            delete next[tid];
            return next;
        });

        // Clear subtasks from backend
        try {
            await apiCall('redo-subtasks', {
                analysis_id: analysisId,
                pillar_key: pillarKey,
                task_id: task.id,
            });
        } catch (err: any) {
            console.error('Failed to clear subtasks data:', err);
            setError('Failed to reset subtasks data');
        }
    }, [analysisId, apiCall]);

    // ─── Select pillar ───
    const handleSelectPillar = useCallback(async (key: string) => {
        setSelectedPillar(key);
        setExpandedTaskIds(new Set());
        setError('');
        if (pillarStates[key]?.plan) return;

        setLoadingPillar(key);
        try {
            const stateResult = await apiCall('pillar-state', { analysis_id: analysisId, pillar_key: key });
            if (stateResult.success && stateResult.plan?.plan_data) {
                setPillarStates(prev => ({ ...prev, [key]: stateResult }));
                setLoadingPillar(null);
                return;
            }

            const result = await apiCall('specialist-tasks', {
                analysis_id: analysisId, pillar_key: key,
                business_id: businessId, profile: profile?.profile || profile,
            });

            if (result.success && result.plan) {
                setPillarStates(prev => ({
                    ...prev,
                    [key]: {
                        success: true, pillar_key: key,
                        plan: { plan_data: result.plan, status: 'generated' },
                        results: [], kpis: [],
                        dependencies: result.plan.dependencies || { ready: true, blockers: [], warnings: [] },
                        progress: { total: result.plan.tarefas?.length || 0, completed: 0 },
                    },
                }));
            } else {
                setError(result.error || 'Erro ao gerar tarefas');
                setSelectedPillar(null);
            }
        } catch (err: any) {
            setError(err.message || 'Erro');
            setSelectedPillar(null);
        } finally {
            setLoadingPillar(null);
        }
    }, [pillarStates, analysisId, businessId, profile, apiCall]);

    // ─── AI executes task ───
    const handleAIExecute = useCallback(async (pillarKey: string, task: TaskItem) => {
        const tid = `${pillarKey}_${task.id}`;
        setExecutingTask(tid);
        setExpandedTaskIds(prev => new Set(prev).add(tid));
        setError('');

        const controller = new AbortController();
        abortControllersRef.current[tid] = controller;

        try {
            const result = await apiCall('specialist-execute', {
                analysis_id: analysisId, pillar_key: pillarKey,
                task_id: task.id, task_data: task,
                business_id: businessId, profile: profile?.profile || profile,
            }, { signal: controller.signal });
            if (result.success && result.execution) {
                const executionData = { ...result.execution, id: result.execution.id || task.id };
                setTaskDeliverables(prev => ({ ...prev, [tid]: executionData }));
                setCompletedTasks(prev => {
                    const s = new Set(prev[pillarKey] || []);
                    s.add(task.id);
                    s.add(tid);
                    return { ...prev, [pillarKey]: s };
                });
            } else { setError(result.error || 'Erro na execução'); }
        } catch (err: any) {
            if (err.name === 'AbortError') setError('Execução cancelada pelo usuário.');
            else setError(err.message || 'Erro');
        } finally {
            if (abortControllersRef.current[tid]) delete abortControllersRef.current[tid];
            setExecutingTask(null);
        }
    }, [analysisId, businessId, profile, apiCall]);


    // ─── Expand subtasks ───
    const handleExpandSubtasks = useCallback(async (pillarKey: string, task: TaskItem) => {
        const tid = `${pillarKey}_${task.id}`;
        setExpandingTask(tid);
        setExpandedTaskIds(prev => new Set(prev).add(tid));
        setError('');

        const controller = new AbortController();
        abortControllersRef.current[tid] = controller;

        try {
            const result = await apiCall('expand-subtasks', {
                analysis_id: analysisId, pillar_key: pillarKey,
                task_data: task, profile: profile?.profile || profile,
            }, { signal: controller.signal });
            if (result.success && result.subtasks) {
                setTaskSubtasks(prev => ({ ...prev, [tid]: result.subtasks }));
            } else { setError(result.error || 'Erro ao expandir'); }
        } catch (err: any) {
            if (err.name === 'AbortError') setError('Ação cancelada pelo usuário.');
            else setError(err.message || 'Erro');
        } finally {
            if (abortControllersRef.current[tid]) delete abortControllersRef.current[tid];
            setExpandingTask(null);
        }
    }, [analysisId, profile, apiCall]);

    // ─── Auto-execute: reuse existing subtasks or expand first, then execute each sequentially ───
    const handleAutoExecute = useCallback(async (pillarKey: string, task: TaskItem) => {
        const tid = `${pillarKey}_${task.id}`;
        setAutoExecuting(tid);
        setExpandedTaskIds(prev => new Set(prev).add(tid));
        setAutoExecStep(0);
        setAutoExecTotal(0);
        setAutoExecLog([]);
        // Clear this task's execution data
        setAutoExecSubtasks(prev => ({ ...prev, [tid]: [] }));
        setAutoExecResults(prev => ({ ...prev, [tid]: {} }));
        setAutoExecStatuses(prev => ({ ...prev, [tid]: {} }));
        setError('');

        const controller = new AbortController();
        abortControllersRef.current[tid] = controller;

        try {
            // Step 1: Use already-expanded subtasks if available, otherwise expand now
            let existingSubtasks = taskSubtasks[tid];
            if (!existingSubtasks) {
                const expandResult = await apiCall('expand-subtasks', {
                    analysis_id: analysisId, pillar_key: pillarKey,
                    task_data: task, profile: profile?.profile || profile,
                });
                if (!expandResult.success || !expandResult.subtasks) {
                    throw new Error(expandResult.error || 'Falha ao expandir tarefa');
                }
                existingSubtasks = expandResult.subtasks;
                setTaskSubtasks(prev => ({ ...prev, [tid]: existingSubtasks }));
            }

            const allItems: any[] = existingSubtasks.subtarefas || [];
            if (allItems.length === 0) {
                throw new Error('Nenhuma subtarefa encontrada para esta ação.');
            }

            // Populate visual list for THIS task
            setAutoExecSubtasks(prev => ({ ...prev, [tid]: allItems }));

            // Initialize all as waiting
            const initStatuses: Record<number, 'waiting' | 'running' | 'done' | 'error'> = {};
            allItems.forEach((_, i) => { initStatuses[i] = 'waiting'; });
            setAutoExecStatuses(prev => ({ ...prev, [tid]: initStatuses }));

            // Execute ALL subtasks — parent task has been delegated to AI
            setAutoExecTotal(allItems.length);

            // Step 2: Execute each subtask sequentially, update card in real time
            const allResults: any[] = [];
            let aiIndex = 0;

            for (let i = 0; i < allItems.length; i++) {
                const st = allItems[i];

                setAutoExecStep(aiIndex + 1);
                setAutoExecStatuses(prev => ({
                    ...prev,
                    [tid]: { ...prev?.[tid], [i]: 'running' },
                }));

                // Build previous results for context chaining
                const previousResults = allResults.map(r => ({
                    titulo: safeRender(r.entregavel_titulo || ''),
                    conteudo: safeRender(r.conteudo || '').slice(0, 800),
                }));

                const execResult = await apiCall('specialist-execute', {
                    analysis_id: analysisId, pillar_key: pillarKey,
                    task_id: `${tid}_st${i + 1}`,
                    task_data: {
                        ...st, id: `${tid}_st${i + 1}`,
                        titulo: st.titulo,
                        descricao: st.descricao || st.entregavel || '',
                        entregavel_ia: st.entregavel || st.descricao,
                    },
                    business_id: businessId, profile: profile?.profile || profile,
                    previous_results: previousResults.length > 0 ? previousResults : undefined,
                }, { signal: controller.signal });

                if (execResult.success && execResult.execution) {
                    allResults.push(execResult.execution);
                    setAutoExecResults(prev => ({
                        ...prev,
                        [tid]: { ...prev?.[tid], [i]: execResult.execution },
                    }));
                    setAutoExecStatuses(prev => ({
                        ...prev,
                        [tid]: { ...prev?.[tid], [i]: 'done' },
                    }));
                } else {
                    setAutoExecStatuses(prev => ({
                        ...prev,
                        [tid]: { ...prev?.[tid], [i]: 'error' },
                    }));
                }
                aiIndex++;
            }

            // Combine all results into final deliverable
            if (allResults.length > 0) {
                const combinedContent = allResults.map((r) =>
                    safeRender(r.conteudo) || ''
                ).filter(Boolean).join('\n\n');

                // Generate Executive Summary for the UI
                setAutoExecStep(allItems.length + 1);

                const summaryResult = await apiCall('specialist-execute', {
                    analysis_id: analysisId, pillar_key: pillarKey,
                    task_id: `${tid}_summary`,
                    task_data: {
                        id: `${tid}_summary`,
                        titulo: 'Resumo Executivo da Tarefa',
                        descricao: 'Gere um resumo em texto corrido, detalhado e bem formatado, consolidando os principais resultados encontrados nas subtarefas, sem perder as principais informações.',
                        entregavel_ia: 'Resumo das Subtarefas',
                        ferramenta: 'analise_dados'
                    },
                    business_id: businessId, profile: profile?.profile || profile,
                    previous_results: [{ titulo: 'Conteúdo Original Completo', conteudo: combinedContent.substring(0, 15000) }],
                }, { signal: controller.signal });

                let resumo = combinedContent;
                if (summaryResult.success && summaryResult.execution) {
                    resumo = safeRender(summaryResult.execution.conteudo);
                }

                const combinedSources = allResults.flatMap(r => r.sources || r.fontes_consultadas || []);
                const combinedDeliverable = {
                    id: tid,
                    entregavel_titulo: task.entregavel_ia || task.titulo,
                    entregavel_tipo: 'plano_completo',
                    conteudo: resumo,
                    conteudo_completo: combinedContent,
                    como_aplicar: safeRender(allResults[allResults.length - 1]?.como_aplicar || ''),
                    impacto_estimado: safeRender(allResults[allResults.length - 1]?.impacto_estimado || ''),
                    fontes_consultadas: combinedSources,
                    sources: [...new Set(combinedSources)],
                    parts: allResults,
                };
                setTaskDeliverables(prev => ({ ...prev, [tid]: combinedDeliverable }));
                setCompletedTasks(prev => {
                    const s = new Set(prev[pillarKey] || []);
                    s.add(task.id);
                    s.add(tid);
                    return { ...prev, [pillarKey]: s };
                });
            }

        } catch (err: any) {
            if (err.name === 'AbortError') {
                setError('Execução cancelada pelo usuário.');
            } else {
                setError(err.message || 'Erro na execução automática');
            }

            // Mark task as error state if it failed early
            setAutoExecStatuses(prev => {
                const updated = { ...prev?.[tid] };
                if (Object.keys(updated).length === 0) {
                    updated[0] = 'error'; // At least show one error
                } else {
                    Object.keys(updated).forEach(k => {
                        if (updated[k as any] === 'running') updated[k as any] = 'error';
                    });
                }
                return { ...prev, [tid]: updated };
            });

        } finally {
            if (abortControllersRef.current[tid]) delete abortControllersRef.current[tid];
            setTimeout(() => {
                setAutoExecuting(null);
                setAutoExecStep(0);
                // We intentionally leave autoExecTotal/Subtasks intact so the UI shows the error state
            }, 800);
        }
    }, [analysisId, businessId, profile, apiCall, taskSubtasks]);

    // ─── AI tries user task — delegates to specific backend endpoint ───
    const handleAITryUserTask = useCallback(async (pillarKey: string, task: TaskItem) => {
        const tid = `${pillarKey}_${task.id}`;
        setAutoExecuting(tid); // Show general executing state
        setExpandedTaskIds(prev => new Set(prev).add(tid));
        setError('');

        // We will mock a single subtask execution visually
        setAutoExecStep(1);
        setAutoExecTotal(1);
        setAutoExecSubtasks(prev => ({ ...prev, [tid]: [task] }));
        setAutoExecStatuses(prev => ({ ...prev, [tid]: { 0: 'running' } }));

        const controller = new AbortController();
        abortControllersRef.current[tid] = controller;

        try {
            const execResult = await apiCall('ai-try-user-task', {
                analysis_id: analysisId,
                pillar_key: pillarKey,
                task_id: task.id,
                task_data: task,
                profile: profile?.profile || profile,
                business_id: businessId
            }, { signal: controller.signal });

            if (execResult.success && execResult.execution) {
                // Success
                setAutoExecResults(prev => ({
                    ...prev,
                    [tid]: { ...prev?.[tid], 0: execResult.execution },
                }));
                setAutoExecStatuses(prev => ({
                    ...prev,
                    [tid]: { ...prev?.[tid], 0: 'done' },
                }));
                setAutoExecStep(2); // Done
            } else {
                throw new Error(execResult.error || 'Falha ao tentar executar a tarefa com IA');
            }
        } catch (err: any) {
            if (err.name === 'AbortError') {
                setError('Execução cancelada pelo usuário.');
            } else {
                setError(err.message || 'Erro na execução da IA');
            }
            setAutoExecStatuses(prev => ({ ...prev, [tid]: { 0: 'error' } }));
        } finally {
            if (abortControllersRef.current[tid]) delete abortControllersRef.current[tid];
            setTimeout(() => {
                setAutoExecuting(null);
            }, 800);
        }
    }, [analysisId, businessId, profile, apiCall]);

    // ─── User completes task ───
    const handleUserComplete = useCallback(async (pillarKey: string, task: TaskItem) => {
        const tid = `${pillarKey}_${task.id}`;
        try {
            await apiCall('track-result', {
                analysis_id: analysisId, pillar_key: pillarKey,
                task_id: task.id, action_title: task.titulo,
                outcome: 'Concluído pelo usuário', business_impact: '',
            });
            setCompletedTasks(prev => {
                const s = new Set(prev[pillarKey] || []);
                s.add(task.id);
                s.add(tid);
                return { ...prev, [pillarKey]: s };
            });
        } catch { /* ignore */ }
    }, [analysisId, apiCall]);

    // ─── Task action buttons ───
    const TaskActions = ({ task, pillarKey, tid, isDone }: { task: TaskItem; pillarKey: string; tid: string; isDone: boolean }) => {
        const isExecuting = executingTask === tid;
        const isExpanding = expandingTask === tid;
        const isAutoExec = autoExecuting === tid;
        const deliverable = taskDeliverables[tid];
        const subtasks = taskSubtasks[tid];
        // Per-task execution state
        const taskExecSubtasks = autoExecSubtasks[tid] || [];
        const taskExecResults = autoExecResults[tid] || {};
        const taskExecStatuses = autoExecStatuses?.[tid] || {};
        const hasExecPanel = taskExecSubtasks.length > 0;

        if (isDone && !deliverable && !hasExecPanel) return null;

        const color = PILLAR_META[pillarKey]?.color || '#8b5cf6';

        return (
            <div className="mt-2 space-y-2">
                {/* Expanding spinner — shown only before subtasks load for THIS task */}
                {isAutoExec && !hasExecPanel && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-violet-500/5">
                        <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                        <span className="text-sm text-violet-300">Criando subtarefas...</span>
                    </div>
                )}

                {hasExecPanel && (
                    <div className="mt-3 rounded-xl bg-[#0d0d0f] overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3">
                            <div className="flex items-center gap-2">
                                <ListTree className="w-4 h-4" style={{ color }} />
                                <span className="text-xs font-semibold text-zinc-400">
                                    {isAutoExec ? 'Executando subtarefas...' : 'Subtarefas executadas'}
                                </span>
                            </div>
                            {autoExecTotal > 0 && isAutoExec && (
                                <div className="flex items-center gap-2">
                                    <div className="w-24 h-1 bg-zinc-800 rounded-full overflow-hidden">
                                        <div className="h-full rounded-full transition-all duration-500"
                                            style={{ width: `${(Math.min(autoExecStep, autoExecTotal) / autoExecTotal) * 100}%`, backgroundColor: color }} />
                                    </div>
                                    <span className="text-[10px] font-mono text-zinc-600">
                                        {autoExecStep > autoExecTotal ? 'Resumo...' : `${autoExecStep}/${autoExecTotal}`}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Subtask cards */}
                        <div className="flex flex-col gap-1 px-2 pt-2 pb-3">
                            {taskExecSubtasks.map((st: any, i: number) => {
                                const status = taskExecStatuses[i] || 'waiting';
                                const result = taskExecResults[i];
                                const isAI = st.executavel_por_ia;

                                return (
                                    <div key={i} className={`transition-colors rounded-xl overflow-hidden ${status === 'running' ? 'bg-violet-500/[0.04]' :
                                        status === 'error' ? 'bg-red-500/[0.03]' : ''
                                        }`}>
                                        {/* Subtask header row */}
                                        <div className="flex items-start gap-3 px-4 py-3">
                                            {/* Status icon */}
                                            <div className="mt-0.5 flex-shrink-0 w-5 h-5 flex items-center justify-center">
                                                {status === 'waiting' && (
                                                    <Circle className="w-3.5 h-3.5 text-zinc-700" />
                                                )}
                                                {status === 'running' && (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />
                                                )}
                                                {status === 'done' && (
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                                )}
                                                {status === 'error' && (
                                                    <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                                                )}
                                            </div>

                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-[10px] font-mono text-zinc-700">{i + 1}</span>
                                                    <p className={`text-xs font-medium ${status === 'done' ? 'text-zinc-400' :
                                                        status === 'running' ? 'text-violet-300' :
                                                            'text-zinc-400'
                                                        }`}>{safeRender(st.titulo)}</p>
                                                    <span className={`text-[8px] px-1 py-0.5 rounded-md ${isAI
                                                        ? 'bg-violet-500/10 text-violet-400'
                                                        : 'bg-blue-500/10 text-blue-400'
                                                        }`}>{isAI ? 'IA' : 'Você'}</span>
                                                    {status === 'running' && (
                                                        <span className="text-[9px] text-violet-400/70 italic">executando...</span>
                                                    )}
                                                </div>
                                                {st.descricao && status === 'waiting' && (
                                                    <p className="text-[11px] text-zinc-600 mt-0.5 leading-relaxed">{safeRender(st.descricao)}</p>
                                                )}
                                                {st.tempo_estimado && (
                                                    <span className="text-[10px] text-zinc-700 flex items-center gap-0.5 mt-0.5">
                                                        <Clock className="w-2.5 h-2.5" />{safeRender(st.tempo_estimado)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Inline result — shown when subtask is done */}
                                        {status === 'done' && result && (
                                            <div className="mx-4 mb-3 px-3 py-2">
                                                {result.entregavel_titulo && (
                                                    <p className="text-[10px] font-medium text-zinc-600 italic mb-1">
                                                        {safeRender(result.entregavel_titulo)}
                                                    </p>
                                                )}
                                                {result.conteudo && (
                                                    <div className="max-h-48 overflow-y-auto scrollbar-hide">
                                                        {isAutoExec && i === autoExecStep - 2 ? (
                                                            <StreamingText text={safeRender(result.conteudo)} speed={6} />
                                                        ) : (
                                                            <MarkdownContent content={safeRender(result.conteudo)} />
                                                        )}
                                                    </div>
                                                )}
                                                {/* Sources inline — staggered when live */}
                                                {(result.sources?.length > 0 || result.fontes_consultadas?.length > 0) && (
                                                    <SourceBadgeList sources={[...(result.sources || []), ...(result.fontes_consultadas || [])]} maxVisible={4} />
                                                )}
                                            </div>
                                        )}

                                        {/* Error state */}
                                        {status === 'error' && (
                                            <div className="mx-4 mb-3 px-3 py-2 rounded-lg bg-red-500/5">
                                                <p className="text-[11px] text-red-400/80">Erro ao executar esta subtarefa</p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Summary generation indicator */}
                        {isAutoExec && autoExecStep > autoExecTotal && (
                            <div className="flex items-start gap-3 px-4 py-3 bg-violet-500/[0.04]">
                                <div className="mt-0.5 flex-shrink-0 w-5 h-5 flex items-center justify-center">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-medium text-violet-300">Gerando resumo corporativo...</p>
                                    <p className="text-[11px] text-zinc-600 mt-0.5 leading-relaxed">Sintetizando os resultados encontrados para sua visualização no card principal.</p>
                                </div>
                            </div>
                        )}

                        {/* Footer: combined result summary */}
                        {!isAutoExec && Object.values(taskExecStatuses).some(s => s === 'done') && (
                            <div className="px-4 py-3 bg-white/[0.01]">
                                <p className="text-[10px] text-zinc-600 italic flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-500/60" />
                                    {Object.values(taskExecStatuses).filter(s => s === 'done').length} subtarefas concluídas — resultado consolidado abaixo
                                </p>
                            </div>
                        )}
                    </div>
                )
                }



                {/* Action buttons row — hidden while executing or exec panel exists */}
                {!isDone && !deliverable && !isAutoExec && !hasExecPanel && (
                    <div className="flex flex-wrap gap-2">
                        {task.executavel_por_ia ? (
                            <>
                                <button onClick={() => handleAutoExecute(pillarKey, task)} disabled={!!autoExecuting || isExecuting}
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
                                ) : (
                                    <button onClick={() => handleExpandSubtasks(pillarKey, task)} disabled={isExpanding || !!autoExecuting}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] transition-all disabled:opacity-50">
                                        {isExpanding
                                            ? <><Loader2 className="w-3 h-3 animate-spin" />Refazendo...</>
                                            : <><RefreshCw className="w-3 h-3" />Refazer subtarefas</>}
                                    </button>
                                )}
                                {/* Redo subtasks button when subtasks exist */}
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
                        {/* Additional stop button for auto-execution */}
                        {isAutoExec && (
                            <button onClick={() => handleStopExecution(tid)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-orange-500/15 text-orange-400 hover:bg-orange-500/25 transition-all">
                                <AlertTriangle className="w-3 h-3" />
                                Parar Auto-execução
                            </button>
                        )}
                    </div>
                )}

                {/* Redo task button for completed tasks or failed partial execution */}
                {(isDone || deliverable || (hasExecPanel && !isAutoExec)) && (
                    <div className="flex flex-wrap gap-2 mt-2">
                        <button onClick={() => handleRedoTask(pillarKey, tid, task)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-zinc-800/40 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-all">
                            <RefreshCw className="w-3 h-3" />
                            Refazer Tarefa
                        </button>
                        {/* Additional redo button for tasks with subtasks */}
                        {subtasks && (
                            <button onClick={() => handleRedoTask(pillarKey, tid, task)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition-all">
                                <RefreshCw className="w-3 h-3" />
                                Refazer Tudo
                            </button>
                        )}
                    </div>
                )}

                {/* Deliverable */}

                {/* Sources from deliverable */}
                {
                    (deliverable?.sources?.length > 0 || deliverable?.fontes_consultadas?.length > 0) && (
                        <SourceBadgeList sources={[...(deliverable.sources || []), ...(deliverable.fontes_consultadas || [])]} maxVisible={4} />
                    )
                }

                {/* Subtasks — hide when exec panel already shows them */}
                {
                    subtasks && !isAutoExec && !hasExecPanel && <SubtaskList subtasks={subtasks} color={PILLAR_META[pillarKey]?.color || '#8b5cf6'}
                        onExecute={() => { }} executingId={null} />
                }
            </div >
        );
    };

    // ═══════════════════════════════════════════════════════
    // RENDER: Expanded Pillar View
    // ═══════════════════════════════════════════════════════
    if (selectedPillar) {
        const meta = PILLAR_META[selectedPillar];
        const Icon = meta?.icon || Users;
        const state = pillarStates[selectedPillar];
        const plan = state?.plan?.plan_data;
        const tarefas: TaskItem[] = plan?.tarefas || plan?.acoes || [];
        const deps = state?.dependencies || { ready: true, blockers: [], warnings: [] };
        const done = completedTasks[selectedPillar] || new Set<string>();
        const dim = dims[selectedPillar] || {};
        const dimScore = dim?.score ?? 0;
        const isLoading = loadingPillar === selectedPillar;

        if (isLoading || !plan) {
            return (
                <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
                    <div className="text-center">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" style={{ color: meta?.color }} />
                        <p className="text-zinc-400 text-sm">O especialista está analisando e criando tarefas...</p>
                        <p className="text-zinc-600 text-xs mt-2">Pesquisando dados reais + cruzando com outros pilares</p>
                    </div>
                </div>
            );
        }

        const totalTasks = tarefas.length;
        const completedCount = tarefas.filter(t => done.has(t.id)).length;
        const aiTasks = tarefas.filter(t => t.executavel_por_ia);
        const userTasks = tarefas.filter(t => !t.executavel_por_ia);
        const planSources = plan.sources || [];
        const entregaveis = plan.entregaveis || []; // Declaração local dentro do escopo do render

        // Get market data sources for this pillar
        const mktCats = marketData?.categories || [];
        const mktCat = mktCats.find((c: any) => c.id === selectedPillar);
        const mktSources = mktCat?.fontes || [];
        const allSources = [...new Set([...planSources, ...mktSources])];

        return (
            <div className="h-screen bg-[#09090b] flex">
                {/* Left Column - Header and Sources */}
                <div className="w-1/2 border-r border-zinc-800 flex flex-col">
                    <div className="p-6 pb-4">
                        <div className="flex justify-end mb-6 relative z-20">
                            <button onClick={() => setSelectedPillar(null)}
                                className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 transition-colors text-sm">
                                <ArrowLeft className="w-4 h-4" /> Voltar aos pilares
                            </button>
                        </div>

                        {/* Header */}
                        <div className="flex items-start gap-4 mb-6">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: `${meta.color}12` }}>
                                <Icon className="w-4 h-4" style={{ color: meta.color, width: 22, height: 22 }} />
                            </div>
                            <div className="flex-1">
                                <h1 className="text-xl font-bold text-white">{plan.titulo_plano || meta.label}</h1>
                                <p className="text-zinc-500 text-xs mt-0.5">
                                    {specialists[selectedPillar]?.cargo || meta.label}
                                </p>
                                <p className="text-zinc-400 text-sm mt-1">{safeRender(plan.objetivo)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Sources Section */}
                    {allSources.length > 0 && (
                        <div className="flex-1 px-6 pb-6 overflow-y-auto">
                            <div className="p-4 rounded-xl">
                                <div className="flex items-center gap-2 mb-3">
                                    <img src="/google.png" alt="Fontes" className="w-4 h-4" />
                                    <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Fontes Pesquisadas</span>
                                    <span className="text-[9px] text-zinc-600 ml-auto">{allSources.length} fontes</span>
                                </div>
                                <SourceBadgeList sources={allSources} maxVisible={4} />

                            </div>

                            {/* Entregáveis Checklist */}
                            {entregaveis.length > 0 && (
                                <div className="mt-4">
                                    <div className="flex items-center gap-2 mb-3 px-4">
                                        <Target className="w-4 h-4" style={{ color: meta.color }} />
                                        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Entregáveis</span>
                                        <span className="text-[9px] text-zinc-600 ml-auto">
                                            {entregaveis.filter((e: any) =>
                                                e.status === 'concluido' ||
                                                (e.tarefa_origem && (done.has(e.tarefa_origem) || done.has(`${selectedPillar}_${e.tarefa_origem}`)))
                                            ).length}/{entregaveis.length}
                                        </span>
                                    </div>

                                    {/* Cards em leque com perspectiva */}
                                    <div className="relative h-64 flex items-center justify-center">
                                        {entregaveisOrder.map((originalIndex, displayIndex) => {
                                            const entregavel = entregaveis[originalIndex];
                                            if (!entregavel) return null;

                                            const isCompleted = entregavel.status === 'concluido' ||
                                                (entregavel.tarefa_origem && (done.has(entregavel.tarefa_origem) || done.has(`${selectedPillar}_${entregavel.tarefa_origem}`)));

                                            const totalCards = entregaveisOrder.length;
                                            const middleIndex = Math.floor(totalCards / 2);

                                            // Detectar ferramenta para este entregável
                                            const toolInfo = getToolInfo({
                                                entregavel_titulo: entregavel.titulo,
                                                conteudo: entregavel.descricao,
                                                entregavel_tipo: ''
                                            });

                                            // Ângulos fixos para arranjo em leque
                                            let angle = 0;
                                            let translateX = 0;
                                            if (displayIndex < middleIndex) {
                                                // Cards à esquerda: inclinação para a esquerda (-15°, -30°, -45°...)
                                                angle = -(middleIndex - displayIndex) * 15;
                                                translateX = -(middleIndex - displayIndex) * 120; // Move mais para a esquerda
                                            } else if (displayIndex > middleIndex) {
                                                // Cards à direita: inclinação para a direita (15°, 30°, 45°...)
                                                angle = (displayIndex - middleIndex) * 15;
                                                translateX = (displayIndex - middleIndex) * 120; // Move mais para a direita
                                            }
                                            // Card do meio fica reto (angle = 0, translateX = 0)

                                            // O card do meio (reto) fica na frente
                                            const isMiddleCard = displayIndex === middleIndex;
                                            const zIndex = isMiddleCard ? 100 : (totalCards - Math.abs(displayIndex - middleIndex));

                                            const cardBgClass = isMiddleCard
                                                ? 'bg-zinc-800 shadow-2xl shadow-black/80'
                                                : 'bg-zinc-900 hover:bg-[#202024] shadow-xl shadow-black/50';

                                            const titleClass = isCompleted
                                                ? 'text-zinc-500 line-through'
                                                : (isMiddleCard ? 'text-white' : 'text-zinc-400');

                                            return (
                                                <div
                                                    key={entregavel.id || originalIndex}
                                                    className={`absolute w-96 p-3 rounded-xl overflow-hidden cursor-pointer transition-all duration-150 hover:scale-105 ${cardBgClass}`}
                                                    style={{
                                                        transform: `translateX(${translateX}px) rotate(${angle}deg) translateY(${Math.abs(angle) * 0.5}px) translateZ(${zIndex * 10}px)`,
                                                        zIndex: zIndex,
                                                    }}
                                                    onClick={() => handleReorderEntregaveis(originalIndex)}
                                                >
                                                    {/* Header com ícone da ferramenta */}
                                                    <div className="flex items-center gap-2.5 mb-2">
                                                        <div className="relative">
                                                            <img src={toolInfo.icon} alt={toolInfo.name} className={`w-7 h-7 rounded object-contain shrink-0 ${isMiddleCard ? '' : 'opacity-60 grayscale'}`} />
                                                            {isCompleted && (
                                                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                                                                    <Check className="w-2.5 h-2.5 text-white" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex-1 flex items-center gap-2 text-left min-w-0 whitespace-nowrap">
                                                            <span className={`text-[13px] font-medium ${titleClass}`}>
                                                                {safeRender(entregavel.titulo)}
                                                            </span>
                                                            <span className={`text-[11px] ${toolInfo.color} ${isMiddleCard ? '' : 'opacity-70'}`}>
                                                                {toolInfo.name}
                                                            </span>
                                                        </div>
                                                        {isCompleted && (
                                                            <Check className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                                                        )}
                                                    </div>

                                                    {/* Descrição */}
                                                    {entregavel.descricao && (
                                                        <p className="text-[11px] text-zinc-600 leading-tight mb-2">
                                                            {safeRender(entregavel.descricao)}
                                                        </p>
                                                    )}

                                                    {/* Footer */}
                                                    <div className="flex items-center justify-between pt-2 border-t border-white/[0.05]">
                                                        {entregavel.tarefa_origem && (
                                                            <span className="text-[9px] text-zinc-600">
                                                                T{entregavel.tarefa_origem}
                                                            </span>
                                                        )}
                                                        {displayIndex !== 0 && (
                                                            <span className="text-[8px] text-zinc-600 italic">
                                                                Clique para mover
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Right Column - Tasks */}
                <div className="w-1/2 flex flex-col">
                    <div className="p-6 pb-4">
                        {/* Dependencies */}
                        {(deps.blockers?.length > 0 || deps.warnings?.length > 0) && (
                            <div className={`mb-4 p-3 rounded-lg ${deps.blockers?.length > 0
                                ? 'bg-red-500/[0.04]' : 'bg-amber-500/[0.04]'}`}>
                                <div className="flex items-center gap-2 mb-2">
                                    <Link2 className="w-4 h-4 text-amber-400" />
                                    <span className="text-xs font-semibold text-amber-400">Dependências</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {(deps.blockers || []).map((b: any) => <DepBadge key={b.pillar} dep={b} />)}
                                    {(deps.warnings || []).map((w: any) => <DepBadge key={w.pillar} dep={w} />)}
                                </div>
                            </div>
                        )}

                        {/* Progress Bar */}
                        {totalTasks > 0 && (
                            <div className="mb-4 p-3 rounded-lg bg-[#111113]">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs text-zinc-500">Progresso das Tarefas</span>
                                    <span className="text-xs font-mono text-zinc-400">{completedCount}/{totalTasks}</span>
                                </div>
                                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-500"
                                        style={{ width: `${(completedCount / totalTasks) * 100}%`, backgroundColor: meta.color }} />
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="mb-4 p-3 rounded-xl bg-red-950/30 text-red-200 text-sm">
                                {error}
                                <button onClick={() => setError('')} className="ml-2 text-red-400 underline text-xs">Fechar</button>
                            </div>
                        )}
                    </div>

                    {/* Tasks List */}
                    <div className="flex-1 px-6 pb-6 overflow-y-auto">
                        <p className="text-xs font-semibold text-zinc-600 uppercase tracking-[0.2em] mb-3">Tarefas</p>
                        <section className="space-y-3">
                            {tarefas.map((task, i) => {
                                const tid = `${selectedPillar}_${task.id}`;
                                const isDone = done.has(task.id) || done.has(tid);
                                const isAI = task.executavel_por_ia;
                                const isExpanded = expandedTaskIds.has(tid);

                                const toggleExpand = () => {
                                    setExpandedTaskIds(prev => {
                                        const next = new Set(prev);
                                        if (next.has(tid)) {
                                            next.delete(tid);
                                        } else {
                                            next.add(tid);
                                        }
                                        return next;
                                    });
                                };

                                const deliverable = taskDeliverables[tid];
                                const subtasksList = taskSubtasks[tid]?.subtarefas || autoExecSubtasks[tid] || [];
                                const subtasksCount = subtasksList.length;

                                return (
                                    <div key={task.id} className={`rounded-xl transition-all ${isDone
                                        ? 'bg-[#111113]'
                                        : 'bg-[#111113]'}`}>
                                        <div className="flex items-start gap-3 p-4">
                                            {isAI ? (
                                                isDone ? <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                                                    : <Bot className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: meta.color }} />
                                            ) : (
                                                <button onClick={() => !isDone && handleUserComplete(selectedPillar, task)} className="mt-0.5 flex-shrink-0">
                                                    {isDone ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                                        : <Circle className="w-5 h-5 text-zinc-700 hover:text-zinc-500 transition-colors" />}
                                                </button>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2 mb-1 cursor-pointer group" onClick={toggleExpand}>
                                                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                                                        <span className="text-[10px] font-mono text-zinc-700">{i + 1}</span>
                                                        <p className={`text-sm font-medium ${isDone ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>
                                                            {task.titulo}
                                                        </p>
                                                        <span className={`text-[9px] px-1.5 py-0.5 rounded-md ${isAI
                                                            ? 'bg-violet-500/10 text-violet-400'
                                                            : 'bg-blue-500/10 text-blue-400'
                                                            }`}>{isAI ? 'IA' : 'Você'}</span>
                                                        {task.prioridade && (
                                                            <span className={`text-[9px] px-1.5 py-0.5 rounded-md ${task.prioridade === 'critica'
                                                                ? 'bg-red-500/10 text-red-400'
                                                                : task.prioridade === 'alta'
                                                                    ? 'bg-amber-500/10 text-amber-400'
                                                                    : 'bg-zinc-500/10 text-zinc-400'
                                                                }`}>{task.prioridade}</span>
                                                        )}
                                                    </div>
                                                    <button className="text-zinc-500 group-hover:text-zinc-300 transition-colors p-1" title={!isExpanded ? "Expandir" : "Recolher"}>
                                                        {!isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                                                    </button>
                                                </div>

                                                {!isExpanded && (deliverable || subtasksCount > 0) && (
                                                    <div className="flex flex-wrap items-center gap-3 mt-1.5 mb-2">
                                                        {deliverable && (
                                                            <button onClick={(e) => { e.stopPropagation(); openInGoogleDocs(deliverable, plan.titulo_plano || meta.label, session, setLoadingDoc, task.id); }} disabled={loadingDoc === (deliverable.id || task.id || 'export')}
                                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${!session?.accessToken ? 'bg-blue-500/10 text-blue-400' : 'text-zinc-400 hover:text-zinc-200 cursor-pointer'}`}>
                                                                {(() => {
                                                                    const toolInfo = getToolInfo(deliverable);
                                                                    return loadingDoc === (deliverable.id || task.id || 'export') ?
                                                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" /> :
                                                                        <img src={toolInfo.icon} alt="" className="w-4 h-4 opacity-60 grayscale" />;
                                                                })()}
                                                                {(() => {
                                                                    const toolInfo = getToolInfo(deliverable);
                                                                    return loadingDoc === (deliverable.id || task.id || 'export') ?
                                                                        'Gerando...' :
                                                                        (!session?.accessToken ? 'Login c/ Google' : `Abrir no ${toolInfo.name}`);
                                                                })()}
                                                                {isDone && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-0.5" />}
                                                            </button>
                                                        )}
                                                        {subtasksCount > 0 && (
                                                            <span className="flex items-center gap-1 text-[10px] font-medium text-zinc-500 bg-black/20 px-2 py-1 rounded-md">
                                                                <ListTree className="w-3 h-3" /> {subtasksCount} subtarefas
                                                            </span>
                                                        )}
                                                    </div>
                                                )}

                                                {isExpanded && (
                                                    <>
                                                        {task.descricao && <p className="text-zinc-500 text-xs leading-relaxed mb-1">{safeRender(task.descricao)}</p>}

                                                        {/* AI task entregável preview */}
                                                        {isAI && task.entregavel_ia && !isDone && !taskDeliverables[task.id] && (
                                                            <p className="text-[11px] text-violet-400/70 italic mb-1">
                                                                <Sparkles className="w-3 h-3 inline mr-1" />Entregável: {safeRender(task.entregavel_ia)}
                                                            </p>
                                                        )}

                                                        {/* User task instructions */}
                                                        {!isAI && task.instrucoes_usuario && !taskDeliverables[task.id] && (
                                                            <div className="mt-1 p-3 rounded-lg bg-blue-500/5">
                                                                <p className="text-[11px] text-blue-300/80 whitespace-pre-wrap leading-relaxed">{safeRender(task.instrucoes_usuario)}</p>
                                                            </div>
                                                        )}

                                                        {/* Meta info */}
                                                        <div className="flex flex-wrap items-center gap-3 mt-1 text-[10px] text-zinc-600">
                                                            {task.tempo_estimado && <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{task.tempo_estimado}</span>}
                                                            {task.ferramenta && (
                                                                <span className="flex items-center gap-0.5">
                                                                    {task.ferramenta}
                                                                    {task.ferramenta_url && (
                                                                        <a href={task.ferramenta_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 ml-0.5">
                                                                            <ExternalLink className="w-2.5 h-2.5" />
                                                                        </a>
                                                                    )}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Action buttons + deliverables + subtasks */}
                                                        <TaskActions task={task} pillarKey={selectedPillar} tid={tid} isDone={isDone} />
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </section>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#09090b]">
            <div className="max-w-4xl mx-auto px-6 py-12">

                {/* Header with score + business info */}
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-white tracking-tight">{userProfile.name}</h1>
                    <p className="text-zinc-500 text-sm mt-1">{userProfile.segment}</p>
                    <div className="mt-4 flex justify-center">
                        <ScoreRing score={scoreGeral} size={72} color={scoreGeral >= 70 ? '#10b981' : scoreGeral >= 40 ? '#f59e0b' : '#ef4444'} />
                    </div>
                    {classificacao && (
                        <span className={`inline-block mt-3 text-xs font-medium px-3 py-1 rounded-full ${scoreGeral >= 70
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : scoreGeral >= 40 ? 'text-amber-400 bg-amber-500/10'
                                : 'text-red-400 bg-red-500/10'}`}>
                            {safeRender(classificacao)}
                        </span>
                    )}
                    {resumo && (
                        <p className="text-zinc-400 text-sm mt-3 max-w-xl mx-auto leading-relaxed">{safeRender(resumo)}</p>
                    )}
                </div>

                {/* Action bar */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xs font-semibold text-zinc-600 uppercase tracking-[0.2em]">
                        Seus 7 Especialistas
                    </h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => exportFullAnalysis(session, setLoadingFullExport, {
                                profile, score, specialists, marketData, taskPlan: pillarStates
                            }, userProfile.name)}
                            disabled={loadingFullExport}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${!session?.accessToken ? 'bg-blue-500/10 text-blue-400' : 'text-zinc-400 hover:text-zinc-200'}`}>
                            {loadingFullExport ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                                    Gerando Doc...
                                </>
                            ) : (
                                <>
                                    <img src="/docs.png" alt="" className="w-5 h-5" />
                                    {!session?.accessToken ? 'Login c/ Google' : 'Abrir no Docs'}
                                </>
                            )}
                        </button>
                        <button onClick={onRedo}
                            className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg bg-zinc-800/40 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors">
                            <RefreshCw className="w-3 h-3" /> Reanalisar
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="mb-4 p-3 rounded-xl bg-red-950/30 text-red-200 text-sm">
                        {error}
                        <button onClick={() => setError('')} className="ml-2 text-red-400 underline text-xs">Fechar</button>
                    </div>
                )}

                {/* Pillar Cards with diagnostic info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {PILLAR_ORDER.map((key) => {
                        const meta = PILLAR_META[key];
                        const Icon = meta.icon;
                        const dim = dims[key] || {};
                        const s = typeof dim.score === 'number' ? dim.score : 0;
                        const spec = specialists[key] || {};
                        const isLoading = loadingPillar === key;
                        const statusBadge = s >= 70 ? { text: 'Forte', cls: 'text-emerald-400 bg-emerald-500/10' }
                            : s >= 40 ? { text: 'Atenção', cls: 'text-amber-400 bg-amber-500/10' }
                                : s > 0 ? { text: 'Crítico', cls: 'text-red-400 bg-red-500/10' }
                                    : { text: 'Sem dados', cls: 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20' };
                        const cached = pillarStates[key];
                        const hasPlan = cached?.plan?.plan_data;
                        const progress = cached?.progress;

                        return (
                            <div key={key}
                                className="flex flex-col text-left p-5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] transition-all duration-200 group cursor-pointer relative"
                                onClick={() => !isLoading && handleSelectPillar(key)}>

                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="p-2 rounded-lg" style={{ backgroundColor: `${meta.color}12` }}>
                                            <Icon className="w-4 h-4" style={{ color: meta.color }} />
                                        </div>
                                        {isLoading
                                            ? <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />
                                            : <ChevronRight className="w-4 h-4 text-zinc-800 group-hover:text-zinc-500 transition-colors" />}
                                    </div>

                                    <h3 className="text-white text-sm font-semibold mb-0.5">{meta.label}</h3>
                                    <p className="text-zinc-600 text-[11px] mb-2">{spec.cargo || ''}</p>

                                    <div className="flex items-center gap-2.5 mb-2">
                                        <ScoreRing score={s} size={36} color={meta.color} />
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${statusBadge.cls}`}>
                                            {statusBadge.text}
                                        </span>
                                    </div>

                                    {/* Diagnostic justificativa inline */}
                                    {dim.justificativa && (
                                        <p className="text-zinc-600 text-[10px] leading-relaxed line-clamp-2 mb-1">
                                            {safeRender(dim.justificativa)}
                                        </p>
                                    )}

                                    {hasPlan && progress && (
                                        <div className="mt-1">
                                            <div className="flex items-center justify-between text-[10px] text-zinc-600 mb-1">
                                                <span>{progress.completed || 0}/{progress.total || 0} tarefas</span>
                                            </div>
                                            <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                                                <div className="h-full rounded-full transition-all"
                                                    style={{ width: `${progress.total > 0 ? ((progress.completed || 0) / progress.total) * 100 : 0}%`, backgroundColor: meta.color }} />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Actions Footer */}
                                <div className="mt-4 pt-3 border-t border-white/[0.05] flex justify-end">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();

                                            // Format the context for export
                                            const mktCat = marketData?.categories?.find((c: any) => c.id === key);
                                            const mktInsights = mktCat?.resumo?.visao_geral ? `\n\n**Visão de Mercado:**\n${safeRender(mktCat.resumo.visao_geral)}\n${(mktCat.resumo.pontos_chave || []).map((p: any) => `• ${safeRender(p)}`).join('\n')}` : '';

                                            // Format the context to look like a deliverable
                                            const contextDeliverable = {
                                                id: `context_${key}`,
                                                entregavel_titulo: `Contexto de Análise: ${meta.label}`,
                                                conteudo_completo: `**Diagnóstico da IA:**\n${safeRender(dim.justificativa || 'Sem dados diagnósticos.')}\n\n**Meta do Pilar:**\n${safeRender(dim.meta_pilar || 'Não definida.')}\n\n**Principal Desafio/Oportunidade:**\n${safeRender(dim.dado_chave || 'Não identificado.')}${mktInsights}`,
                                                fontes_consultadas: mktCat?.fontes || []
                                            };

                                            openInGoogleDocs(contextDeliverable, meta.label, session, setLoadingDoc, `ctx_${key}`);
                                        }}
                                        disabled={loadingDoc === `ctx_${key}`}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${!session?.accessToken ? 'bg-blue-500/10 text-blue-400' : 'bg-white/[0.03] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'}`}
                                    >
                                        {loadingDoc === `ctx_${key}` ? <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" /> : <img src="/docs.png" alt="" className="w-4 h-4" />}
                                        {loadingDoc === `ctx_${key}` ? 'Gerando Doc...' : !session?.accessToken ? 'Login c/ Google' : 'Abrir no Docs'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}