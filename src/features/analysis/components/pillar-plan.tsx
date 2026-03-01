'use client';

import React, { useState } from 'react';
import {
    ArrowLeft, Check, Circle, Clock, ExternalLink, Loader2,
    Lightbulb, Target, TrendingUp, CheckCircle2, AlertTriangle,
    ChevronDown, ChevronUp, MessageSquare, BarChart3, Send
} from 'lucide-react';

interface PlanAction {
    id: string;
    titulo: string;
    descricao: string;
    ferramenta: string;
    ferramenta_url?: string;
    tempo_estimado: string;
    resultado_esperado: string;
    kpi: string;
    prioridade: string;
    depende_de?: string | null;
}

interface PillarKPI {
    nome: string;
    valor_atual: string;
    meta: string;
    como_medir: string;
}

interface PlanData {
    titulo_plano: string;
    objetivo: string;
    prazo_total: string;
    acoes: PlanAction[];
    kpis_pilar: PillarKPI[];
    resultado_final: string;
    conexao_proximos_pilares: string;
    sources?: string[];
}

interface ExecutionResult {
    task_id: string;
    action_title: string;
    status: string;
    outcome: string;
    business_impact: string;
    completed_at?: string;
}

interface PillarPlanProps {
    pillarKey: string;
    pillarLabel: string;
    pillarColor: string;
    score: number;
    planData: PlanData | null;
    planStatus: string; // 'pending' | 'approved' | null
    executionResults: ExecutionResult[];
    isLoading: boolean;
    onBack: () => void;
    onApprove: (notes: string) => void;
    onCompleteAction: (actionId: string, actionTitle: string) => void;
    onTrackResult: (taskId: string, actionTitle: string, outcome: string, impact: string) => void;
    approving: boolean;
}

function PriorityBadge({ priority }: { priority: string }) {
    const cfg = {
        critica: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20', label: 'Crítica' },
        alta: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', label: 'Alta' },
        media: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', label: 'Média' },
    }[priority] || { bg: 'bg-zinc-500/10', text: 'text-zinc-400', border: 'border-zinc-500/20', label: priority };

    return (
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.text} border ${cfg.border} font-medium`}>
            {cfg.label}
        </span>
    );
}

export default function PillarPlan({
    pillarKey,
    pillarLabel,
    pillarColor,
    score,
    planData,
    planStatus,
    executionResults,
    isLoading,
    onBack,
    onApprove,
    onCompleteAction,
    onTrackResult,
    approving,
}: PillarPlanProps) {
    const [approveNotes, setApproveNotes] = useState('');
    const [showKPIs, setShowKPIs] = useState(false);
    const [trackingAction, setTrackingAction] = useState<string | null>(null);
    const [outcomeText, setOutcomeText] = useState('');
    const [impactText, setImpactText] = useState('');

    const completedIds = new Set(
        executionResults.filter(r => r.status === 'completed').map(r => r.task_id)
    );
    const totalActions = planData?.acoes?.length || 0;
    const completedCount = planData?.acoes?.filter(a => completedIds.has(a.id)).length || 0;
    const progress = totalActions > 0 ? (completedCount / totalActions) * 100 : 0;

    // Loading state
    if (isLoading || !planData) {
        return (
            <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 text-zinc-500 animate-spin mx-auto mb-4" />
                    <p className="text-zinc-400 text-sm">O especialista está criando seu plano...</p>
                    <p className="text-zinc-600 text-xs mt-2">Pesquisando dados reais e gerando ações</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#09090b]">
            <div className="max-w-3xl mx-auto px-6 py-8">

                {/* Back */}
                <button onClick={onBack}
                    className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 transition-colors text-sm mb-6">
                    <ArrowLeft className="w-4 h-4" /> Voltar aos especialistas
                </button>

                {/* Header */}
                <div className="flex items-start gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${pillarColor}15`, border: `1px solid ${pillarColor}30` }}>
                        <Target style={{ color: pillarColor, width: 18, height: 18 }} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white">{planData.titulo_plano || pillarLabel}</h1>
                        <p className="text-zinc-400 text-sm mt-1">{planData.objetivo}</p>
                        <div className="flex items-center gap-3 mt-2 text-[11px] text-zinc-600">
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {planData.prazo_total}</span>
                            <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3" /> {totalActions} ações</span>
                            <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Score: {score}/100</span>
                        </div>
                    </div>
                </div>

                {/* Progress */}
                {planStatus === 'approved' && (
                    <div className="mb-6 p-4 rounded-xl bg-[#111113]">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-zinc-500">Progresso de execução</span>
                            <span className="text-xs font-mono text-zinc-400">{completedCount}/{totalActions}</span>
                        </div>
                        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${progress}%`, backgroundColor: pillarColor }} />
                        </div>
                    </div>
                )}

                {/* Approval Section (if plan is pending) */}
                {planStatus !== 'approved' && (
                    <div className="mb-6 p-5 rounded-2xl border-2 border-dashed border-amber-500/20 bg-amber-500/[0.03]">
                        <div className="flex items-start gap-3 mb-3">
                            <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-amber-400 text-sm font-semibold mb-1">Revisar e aprovar plano</p>
                                <p className="text-zinc-400 text-xs leading-relaxed">
                                    O especialista criou este plano para você. Revise as ações abaixo e aprove
                                    quando estiver satisfeito. Você pode adicionar observações.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                            <input
                                type="text"
                                value={approveNotes}
                                onChange={(e) => setApproveNotes(e.target.value)}
                                placeholder="Observações opcionais..."
                                className="flex-1 bg-zinc-800/40 rounded-xl px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 transition-all"
                            />
                            <button
                                onClick={() => onApprove(approveNotes)}
                                disabled={approving}
                                className="px-5 py-2 rounded-xl text-sm font-medium bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-all disabled:opacity-50"
                            >
                                {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Aprovar Plano'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Actions List */}
                <section className="mb-6">
                    <h2 className="text-xs font-semibold text-zinc-600 uppercase tracking-[0.2em] mb-3">
                        Plano de ação
                    </h2>
                    <div className="space-y-2">
                        {(planData.acoes || []).map((action, i) => {
                            const isDone = completedIds.has(action.id);
                            const isTracking = trackingAction === action.id;

                            return (
                                <div key={action.id}
                                    className={`rounded-xl border transition-all ${isDone
                                        ? 'bg-emerald-500/5 border-emerald-500/15'
                                        : 'bg-[#111113] border-white/[0.06]'
                                        }`}>
                                    <div className="flex items-start gap-3 p-4">
                                        {/* Completion toggle */}
                                        {planStatus === 'approved' ? (
                                            <button
                                                onClick={() => {
                                                    if (!isDone) {
                                                        setTrackingAction(isTracking ? null : action.id);
                                                    }
                                                }}
                                                className="mt-0.5 flex-shrink-0"
                                            >
                                                {isDone
                                                    ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                                    : <Circle className="w-5 h-5 text-zinc-700 hover:text-zinc-500 transition-colors" />
                                                }
                                            </button>
                                        ) : (
                                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5 flex-shrink-0"
                                                style={{ backgroundColor: `${pillarColor}15`, color: pillarColor, border: `1px solid ${pillarColor}30` }}>
                                                {i + 1}
                                            </div>
                                        )}

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className={`text-sm font-medium ${isDone ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>
                                                    {action.titulo}
                                                </p>
                                                <PriorityBadge priority={action.prioridade} />
                                            </div>
                                            {action.descricao && (
                                                <p className="text-zinc-500 text-xs leading-relaxed mb-2">{action.descricao}</p>
                                            )}
                                            <div className="flex flex-wrap items-center gap-3 text-[10px] text-zinc-600">
                                                {action.tempo_estimado && (
                                                    <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" /> {action.tempo_estimado}</span>
                                                )}
                                                {action.ferramenta && (
                                                    <span className="flex items-center gap-0.5">
                                                        {action.ferramenta}
                                                        {action.ferramenta_url && (
                                                            <a href={action.ferramenta_url} target="_blank" rel="noopener noreferrer"
                                                                className="text-blue-400 hover:text-blue-300 ml-0.5">
                                                                <ExternalLink className="w-2.5 h-2.5" />
                                                            </a>
                                                        )}
                                                    </span>
                                                )}
                                                {action.kpi && (
                                                    <span className="flex items-center gap-0.5 text-emerald-500/70">
                                                        <TrendingUp className="w-2.5 h-2.5" /> {action.kpi}
                                                    </span>
                                                )}
                                            </div>
                                            {action.resultado_esperado && !isDone && (
                                                <p className="text-[11px] text-zinc-500/80 mt-2 pl-0 border-l-2 border-emerald-500/20 leading-relaxed italic">
                                                    &nbsp;Resultado: {action.resultado_esperado}
                                                </p>
                                            )}

                                            {/* Outcome from execution */}
                                            {isDone && executionResults.find(r => r.task_id === action.id) && (
                                                <div className="mt-2 p-2 rounded-lg bg-emerald-500/5">
                                                    <p className="text-[11px] text-emerald-400">
                                                        {executionResults.find(r => r.task_id === action.id)?.outcome || 'Concluído'}
                                                    </p>
                                                    {executionResults.find(r => r.task_id === action.id)?.business_impact && (
                                                        <p className="text-[10px] text-emerald-500/60 mt-0.5">
                                                            Impacto: {executionResults.find(r => r.task_id === action.id)?.business_impact}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Tracking form (when marking as done) */}
                                    {isTracking && !isDone && planStatus === 'approved' && (
                                        <div className="px-4 pb-4 border-t border-white/[0.04] pt-3 ml-8">
                                            <p className="text-[11px] text-zinc-500 mb-2">O que aconteceu ao executar esta ação?</p>
                                            <input
                                                type="text"
                                                value={outcomeText}
                                                onChange={(e) => setOutcomeText(e.target.value)}
                                                placeholder="Ex: Criei o perfil no Google Meu Negócio"
                                                className="w-full bg-zinc-800/40 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 mb-2"
                                            />
                                            <input
                                                type="text"
                                                value={impactText}
                                                onChange={(e) => setImpactText(e.target.value)}
                                                placeholder="Impacto no negócio (opcional): Ex: +15 visualizações/dia"
                                                className="w-full bg-zinc-800/40 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 mb-2"
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        onTrackResult(action.id, action.titulo, outcomeText, impactText);
                                                        setTrackingAction(null);
                                                        setOutcomeText('');
                                                        setImpactText('');
                                                    }}
                                                    className="px-4 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-all"
                                                >
                                                    Marcar como feito
                                                </button>
                                                <button
                                                    onClick={() => { setTrackingAction(null); setOutcomeText(''); setImpactText(''); }}
                                                    className="px-3 py-1.5 rounded-lg text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                                                >
                                                    Cancelar
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* KPIs Section */}
                {(planData.kpis_pilar?.length ?? 0) > 0 && (
                    <section className="mb-6">
                        <button
                            onClick={() => setShowKPIs(!showKPIs)}
                            className="flex items-center gap-2 text-xs font-semibold text-zinc-600 uppercase tracking-[0.2em] mb-3 hover:text-zinc-400 transition-colors"
                        >
                            <TrendingUp className="w-3.5 h-3.5" />
                            KPIs para acompanhar ({planData.kpis_pilar.length})
                            {showKPIs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                        {showKPIs && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {planData.kpis_pilar.map((kpi, i) => (
                                    <div key={i} className="p-3 rounded-xl bg-[#111113]">
                                        <p className="text-zinc-300 text-sm font-medium">{kpi.nome}</p>
                                        <div className="flex items-center justify-between mt-1.5">
                                            <span className="text-[11px] text-zinc-600">Atual: {kpi.valor_atual}</span>
                                            <span className="text-[11px] text-emerald-400/80">Meta: {kpi.meta}</span>
                                        </div>
                                        {kpi.como_medir && (
                                            <p className="text-[10px] text-zinc-600 mt-1">{kpi.como_medir}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {/* Expected Result */}
                {planData.resultado_final && (
                    <div className="mb-6 p-4 rounded-xl bg-emerald-500/5">
                        <p className="text-[10px] font-semibold text-emerald-500/80 uppercase tracking-wide mb-1">Resultado final esperado</p>
                        <p className="text-sm text-zinc-300 leading-relaxed">{planData.resultado_final}</p>
                    </div>
                )}

                {/* Connection to next pillars */}
                {planData.conexao_proximos_pilares && (
                    <div className="mb-6 p-4 rounded-xl bg-violet-500/5">
                        <p className="text-[10px] font-semibold text-violet-500/80 uppercase tracking-wide mb-1">Conexão com outros pilares</p>
                        <p className="text-sm text-zinc-300 leading-relaxed">{planData.conexao_proximos_pilares}</p>
                    </div>
                )}

                {/* Sources */}
                {(planData.sources?.length ?? 0) > 0 && (
                    <section className="mb-6">
                        <h2 className="flex items-center gap-2 text-xs font-semibold text-zinc-600 uppercase tracking-[0.2em] mb-3">
                            <ExternalLink className="w-3.5 h-3.5" /> Fontes consultadas
                        </h2>
                        <div className="flex flex-wrap gap-1.5">
                            {(planData.sources ?? []).map((url, i) => {
                                let display = url;
                                try { display = new URL(url).hostname; } catch { }
                                return (
                                    <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg bg-zinc-800/40 text-zinc-500 hover:text-zinc-300 transition-colors">
                                        <ExternalLink className="w-2.5 h-2.5" /> {display}
                                    </a>
                                );
                            })}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}
