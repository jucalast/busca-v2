'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
    Globe, Target, Share2, DollarSign, TrendingUp, Settings,
    ArrowLeft, Send, Loader2, ExternalLink, Check, Circle,
    Sparkles, BookOpen, Lightbulb, Search
} from 'lucide-react';

const DIMENSIONS: Record<string, { icon: React.ComponentType<any>; label: string; color: string }> = {
    presenca_digital: { icon: Globe, label: 'Presença Digital', color: '#3b82f6' },
    competitividade: { icon: Target, label: 'Competitividade', color: '#f59e0b' },
    diversificacao_canais: { icon: Share2, label: 'Canais de Venda', color: '#8b5cf6' },
    precificacao: { icon: DollarSign, label: 'Precificação', color: '#ec4899' },
    potencial_mercado: { icon: TrendingUp, label: 'Potencial de Mercado', color: '#10b981' },
    maturidade_operacional: { icon: Settings, label: 'Operação', color: '#6366f1' },
};

const TASK_TO_DIMENSION: Record<string, string> = {
    presenca_digital: 'presenca_digital',
    competitividade: 'competitividade',
    canais: 'diversificacao_canais',
    precificacao: 'precificacao',
    mercado: 'potencial_mercado',
    operacional: 'maturidade_operacional',
    credibilidade: 'presenca_digital',
    conversao: 'competitividade',
};

const CATEGORY_TO_DIMENSION: Record<string, string> = {
    credibilidade: 'presenca_digital',
    marketing: 'presenca_digital',
    marketing_organico: 'presenca_digital',
    concorrentes: 'competitividade',
    precificacao: 'precificacao',
    canais: 'diversificacao_canais',
    mercado: 'potencial_mercado',
    tendencias: 'potencial_mercado',
    operacional: 'maturidade_operacional',
};

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    sources?: string[];
    searchQuery?: string;
}

interface DimensionDetailProps {
    dimensionKey: string;
    data: any;
    userProfile: { name: string; segment: string };
    chatHistory: ChatMessage[];
    onBack: () => void;
    onSendMessage: (message: string) => Promise<void>;
    isLoading: boolean;
}

export default function DimensionDetail({
    dimensionKey,
    data,
    userProfile,
    chatHistory,
    onBack,
    onSendMessage,
    isLoading,
}: DimensionDetailProps) {
    const [inputValue, setInputValue] = useState('');
    const [actionStates, setActionStates] = useState<Record<string, boolean>>({});
    const chatEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const meta = DIMENSIONS[dimensionKey] || { icon: Globe, label: dimensionKey, color: '#71717a' };
    const Icon = meta.icon;

    const score = data.score || {};
    const dim = score.dimensoes?.[dimensionKey] || {};
    const dimScore = typeof dim.score === 'number' ? dim.score : 50;
    const tasks = (data.taskPlan?.tasks || []).filter((t: any) =>
        t.categoria === dimensionKey || TASK_TO_DIMENSION[t.categoria] === dimensionKey
    );
    const opportunities = (score.oportunidades || []).filter((op: any) => {
        const text = `${op.titulo} ${op.descricao}`.toLowerCase();
        const dimWords = meta.label.toLowerCase().split(' ');
        return dimWords.some((w: string) => w.length > 3 && text.includes(w));
    });

    // Find related market categories
    const marketCategories = (data.marketData?.categories || []).filter((cat: any) => {
        if (CATEGORY_TO_DIMENSION[cat.id] === dimensionKey) return true;
        // Fuzzy match by name
        const catName = (cat.nome || '').toLowerCase();
        const dimLabel = meta.label.toLowerCase();
        return dimLabel.split(' ').some((w: string) => w.length > 3 && catName.includes(w));
    });

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory, isLoading]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const msg = inputValue.trim();
        if (!msg || isLoading) return;
        setInputValue('');
        await onSendMessage(msg);
    };

    const toggleAction = (id: string) => {
        setActionStates(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const scoreColor = dimScore >= 70 ? '#10b981' : dimScore >= 40 ? '#f59e0b' : '#ef4444';
    const statusLabel = dim.status === 'forte' ? 'Forte' : dim.status === 'atencao' ? 'Atenção' : 'Crítico';

    return (
        <div className="min-h-screen bg-[#09090b] text-zinc-300">
            <div className="max-w-3xl mx-auto px-6 py-8">

                {/* Back Button */}
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 transition-colors text-sm mb-8"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar ao painel
                </button>

                {/* Header */}
                <div className="flex items-start gap-5 mb-10">
                    {/* Mini Score Ring */}
                    <div className="relative flex-shrink-0" style={{ width: 72, height: 72 }}>
                        <svg width={72} height={72} className="-rotate-90">
                            <circle cx={36} cy={36} r={30} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="5" />
                            <circle cx={36} cy={36} r={30} fill="none" stroke={scoreColor} strokeWidth="5"
                                strokeDasharray={2 * Math.PI * 30}
                                strokeDashoffset={2 * Math.PI * 30 - (dimScore / 100) * 2 * Math.PI * 30}
                                strokeLinecap="round"
                                className="transition-all duration-700"
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-lg font-bold text-white">{dimScore}</span>
                        </div>
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                            <Icon className="w-5 h-5" style={{ color: meta.color }} />
                            <h1 className="text-xl font-bold text-white">{meta.label}</h1>
                        </div>
                        <span
                            className="inline-block text-xs font-medium px-2.5 py-0.5 rounded-full border mb-3"
                            style={{
                                color: scoreColor,
                                borderColor: `${scoreColor}33`,
                                backgroundColor: `${scoreColor}15`,
                            }}
                        >
                            {statusLabel}
                        </span>
                        {dim.justificativa && (
                            <p className="text-zinc-400 text-sm leading-relaxed">{dim.justificativa}</p>
                        )}
                    </div>
                </div>

                {/* Key Finding */}
                {dim.dado_chave && (
                    <div className="mb-8 p-4 rounded-xl bg-amber-500/5 border border-amber-500/15">
                        <div className="flex items-start gap-2.5">
                            <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-[10px] font-semibold text-amber-500/80 uppercase tracking-wide mb-1">Dado-chave</p>
                                <p className="text-sm text-zinc-300 leading-relaxed">{dim.dado_chave}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Actions Section — only show tasks (flattened from scorer) to avoid duplicates */}
                {tasks.length > 0 && (
                    <section className="mb-8">
                        <h2 className="flex items-center gap-2 text-xs font-semibold text-zinc-600 uppercase tracking-[0.2em] mb-4">
                            <Lightbulb className="w-3.5 h-3.5" />
                            Ações recomendadas
                        </h2>
                        <div className="space-y-2">
                            {tasks.map((task: any) => (
                                <button
                                    key={task.id}
                                    onClick={() => toggleAction(task.id)}
                                    className={`w-full flex items-start gap-3 p-3.5 rounded-xl border transition-all text-left ${actionStates[task.id]
                                        ? 'bg-emerald-500/5 border-emerald-500/20'
                                        : 'bg-[#111113] border-white/[0.06] hover:border-white/[0.12]'
                                        }`}
                                >
                                    {actionStates[task.id]
                                        ? <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                                        : <Circle className="w-4 h-4 text-zinc-700 mt-0.5 flex-shrink-0" />
                                    }
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-medium ${actionStates[task.id] ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>
                                            {task.titulo}
                                        </p>
                                        {task.descricao && (
                                            <p className="text-zinc-600 text-xs mt-1 line-clamp-2">{task.descricao}</p>
                                        )}
                                        <div className="flex gap-2 mt-1.5">
                                            {task.prazo_sugerido && (
                                                <span className="text-[10px] px-2 py-0.5 rounded bg-white/[0.04] text-zinc-600">{task.prazo_sugerido}</span>
                                            )}
                                            {task.custo_estimado && (
                                                <span className="text-[10px] px-2 py-0.5 rounded bg-white/[0.04] text-zinc-600">{task.custo_estimado}</span>
                                            )}
                                        </div>
                                        {task.fonte_referencia && (
                                            <p className="text-[10px] text-zinc-700 mt-1.5 flex items-center gap-1">
                                                <BookOpen className="w-2.5 h-2.5" />
                                                {task.fonte_referencia}
                                            </p>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </section>
                )}

                {/* Sources Used */}
                {dim.fontes_utilizadas?.length > 0 && (
                    <section className="mb-8">
                        <h2 className="flex items-center gap-2 text-xs font-semibold text-zinc-600 uppercase tracking-[0.2em] mb-4">
                            <ExternalLink className="w-3.5 h-3.5" />
                            Fontes utilizadas
                        </h2>
                        <div className="flex flex-wrap gap-1.5">
                            {dim.fontes_utilizadas.map((fonte: string, i: number) => {
                                let display = fonte;
                                try { display = new URL(fonte).hostname; } catch { /* keep original */ }
                                return (
                                    <a
                                        key={i}
                                        href={fonte.startsWith('http') ? fonte : undefined}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-md bg-white/[0.03] text-zinc-500 hover:text-zinc-300 border border-white/[0.04] transition-colors"
                                    >
                                        <ExternalLink className="w-2.5 h-2.5" />
                                        {display}
                                    </a>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* Market Research Section */}
                {marketCategories.length > 0 && (
                    <section className="mb-8">
                        <h2 className="flex items-center gap-2 text-xs font-semibold text-zinc-600 uppercase tracking-[0.2em] mb-4">
                            <BookOpen className="w-3.5 h-3.5" />
                            Dados de mercado
                        </h2>
                        <div className="space-y-3">
                            {marketCategories.map((cat: any) => {
                                const resumo = cat.resumo || {};
                                return (
                                    <div key={cat.id} className="p-4 rounded-xl bg-[#111113] border border-white/[0.06]">
                                        <h3 className="text-sm font-semibold text-white mb-2">{cat.nome}</h3>
                                        {resumo.visao_geral && (
                                            <p className="text-zinc-400 text-sm leading-relaxed mb-3">{resumo.visao_geral}</p>
                                        )}
                                        {resumo.pontos_chave && Array.isArray(resumo.pontos_chave) && (
                                            <ul className="space-y-1.5 mb-3">
                                                {resumo.pontos_chave.slice(0, 3).map((p: any, i: number) => {
                                                    const text = typeof p === 'string' ? p : p.dado || p.texto || JSON.stringify(p);
                                                    return (
                                                        <li key={i} className="flex items-start gap-2 text-xs text-zinc-500">
                                                            <span className="w-1 h-1 rounded-full bg-zinc-700 mt-1.5 flex-shrink-0" />
                                                            {text}
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        )}
                                        {cat.fontes?.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/[0.04]">
                                                {cat.fontes.slice(0, 3).map((url: string, i: number) => {
                                                    let hostname = url;
                                                    try { hostname = new URL(url).hostname; } catch { }
                                                    return (
                                                        <a
                                                            key={i}
                                                            href={url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
                                                        >
                                                            <ExternalLink className="w-2.5 h-2.5" />
                                                            {hostname}
                                                        </a>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* AI Chat Section */}
                <section>
                    <h2 className="flex items-center gap-2 text-xs font-semibold text-zinc-600 uppercase tracking-[0.2em] mb-4">
                        <Sparkles className="w-3.5 h-3.5" />
                        Assistente de {meta.label}
                    </h2>
                    <div className="rounded-2xl bg-[#111113] border border-white/[0.06] overflow-hidden">
                        {/* Messages */}
                        <div className="max-h-[420px] overflow-y-auto p-5 space-y-5">
                            {/* Welcome message */}
                            <div className="flex gap-3">
                                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                                    style={{ backgroundColor: `${meta.color}20` }}>
                                    <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-zinc-400 text-sm leading-relaxed">
                                        Sou especialista em {meta.label} para {userProfile.name}.
                                        Score atual: {dimScore}/100 ({statusLabel}).
                                        Posso pesquisar informacoes, sugerir acoes concretas
                                        e responder duvidas. Todas as respostas sao baseadas em dados reais.
                                    </p>
                                </div>
                            </div>

                            {/* Chat history */}
                            {chatHistory.map((msg, i) => (
                                <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                    {msg.role === 'assistant' ? (
                                        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                                            style={{ backgroundColor: `${meta.color}20` }}>
                                            <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
                                        </div>
                                    ) : (
                                        <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0">
                                            <span className="text-zinc-400 text-xs font-medium">
                                                {userProfile.name.charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                    )}
                                    <div className={`flex-1 ${msg.role === 'user' ? 'text-right' : ''}`}>
                                        <div className={`inline-block text-left max-w-full ${msg.role === 'user'
                                            ? 'bg-white/[0.06] rounded-2xl rounded-tr-md px-4 py-2.5'
                                            : ''
                                            }`}>
                                            <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">
                                                {msg.content}
                                            </p>
                                        </div>
                                        {msg.sources && msg.sources.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mt-2">
                                                {msg.sources.map((url, si) => {
                                                    let hostname = url;
                                                    try { hostname = new URL(url).hostname; } catch { }
                                                    return (
                                                        <a
                                                            key={si}
                                                            href={url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-white/[0.03] text-zinc-600 hover:text-zinc-400 border border-white/[0.04] transition-colors"
                                                        >
                                                            <ExternalLink className="w-2.5 h-2.5" />
                                                            {hostname}
                                                        </a>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        {msg.searchQuery && (
                                            <p className="text-[10px] text-zinc-700 mt-1.5 flex items-center gap-1">
                                                <Search className="w-2.5 h-2.5" />
                                                Pesquisou: &ldquo;{msg.searchQuery}&rdquo;
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {/* Loading */}
                            {isLoading && (
                                <div className="flex gap-3">
                                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                                        style={{ backgroundColor: `${meta.color}20` }}>
                                        <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
                                    </div>
                                    <div className="flex items-center gap-2 text-zinc-500 text-sm">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        Pesquisando e analisando...
                                    </div>
                                </div>
                            )}

                            <div ref={chatEndRef} />
                        </div>

                        {/* Input */}
                        <form onSubmit={handleSubmit} className="p-4 border-t border-white/[0.04]">
                            <div className="flex gap-2">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder={`Pergunte sobre ${meta.label.toLowerCase()}...`}
                                    disabled={isLoading}
                                    className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-white/[0.15] transition-colors disabled:opacity-50"
                                />
                                <button
                                    type="submit"
                                    disabled={isLoading || !inputValue.trim()}
                                    className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-30"
                                    style={{
                                        backgroundColor: `${meta.color}20`,
                                        color: meta.color,
                                    }}
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                        </form>
                    </div>
                </section>
            </div>
        </div>
    );
}
