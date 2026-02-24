'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
    ArrowLeft, Check, Circle, Clock, ExternalLink, Send,
    Loader2, Wrench, Lightbulb, MessageCircle, ChevronDown,
    ChevronUp, Search, Sparkles
} from 'lucide-react';

interface SubTask {
    id: string;
    titulo: string;
    descricao: string;
    tempo_estimado: string;
    ferramenta: string;
    dica_especialista?: string;
}

interface Tool {
    nome: string;
    url?: string;
    custo: string;
    para_que: string;
}

interface TaskDetailData {
    titulo: string;
    descricao: string;
    subtarefas: SubTask[];
    ferramentas_necessarias: Tool[];
    tempo_total_estimado: string;
    resultado_esperado: string;
    dica_principal: string;
    sources?: string[];
    search_query?: string;
}

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    sources?: string[];
}

interface TaskDetailProps {
    taskId: string;
    taskTitle: string;
    phaseTitle: string;
    detail: TaskDetailData | null;
    isLoading: boolean;
    chatHistory: ChatMessage[];
    chatLoading: boolean;
    onBack: () => void;
    onSendMessage: (message: string) => void;
    onToggleSubtask: (subtaskId: string) => void;
    completedSubtasks: Set<string>;
}

export default function TaskDetail({
    taskId,
    taskTitle,
    phaseTitle,
    detail,
    isLoading,
    chatHistory,
    chatLoading,
    onBack,
    onSendMessage,
    onToggleSubtask,
    completedSubtasks,
}: TaskDetailProps) {
    const [inputValue, setInputValue] = useState('');
    const [showChat, setShowChat] = useState(false);
    const [showTools, setShowTools] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory, chatLoading]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const msg = inputValue.trim();
        if (!msg || chatLoading) return;
        setInputValue('');
        onSendMessage(msg);
    };

    // Loading state
    if (isLoading || !detail) {
        return (
            <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 text-zinc-500 animate-spin mx-auto mb-4" />
                    <p className="text-zinc-400 text-sm">Pesquisando especialistas e gerando checklist...</p>
                    <p className="text-zinc-600 text-xs mt-2">Buscando dados reais na internet</p>
                </div>
            </div>
        );
    }

    const subtarefas = detail.subtarefas || [];
    const completedCount = subtarefas.filter(st => completedSubtasks.has(st.id)).length;
    const progress = subtarefas.length > 0 ? (completedCount / subtarefas.length) * 100 : 0;

    return (
        <div className="min-h-screen bg-[#09090b]">
            <div className="max-w-3xl mx-auto px-6 py-8">

                {/* Back */}
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 transition-colors text-sm mb-6"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar ao plano
                </button>

                {/* Header */}
                <div className="mb-6">
                    <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.15em] mb-1">{phaseTitle}</p>
                    <h1 className="text-xl font-bold text-white leading-tight">{detail.titulo || taskTitle}</h1>
                    {detail.descricao && (
                        <p className="text-zinc-400 text-sm mt-2 leading-relaxed">{detail.descricao}</p>
                    )}
                </div>

                {/* Progress Bar */}
                <div className="mb-6 p-4 rounded-xl bg-[#111113] border border-white/[0.06]">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-zinc-500">Progresso</span>
                        <span className="text-xs font-mono text-zinc-400">{completedCount}/{subtarefas.length}</span>
                    </div>
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-500 bg-emerald-500"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-[11px] text-zinc-600">
                        {detail.tempo_total_estimado && (
                            <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {detail.tempo_total_estimado}
                            </span>
                        )}
                    </div>
                </div>

                {/* Expert Tip */}
                {detail.dica_principal && (
                    <div className="mb-6 p-4 rounded-xl bg-amber-500/5 border border-amber-500/15">
                        <div className="flex items-start gap-2.5">
                            <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-[10px] font-semibold text-amber-500/80 uppercase tracking-wide mb-1">Dica do especialista</p>
                                <p className="text-sm text-zinc-300 leading-relaxed">{detail.dica_principal}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Sub-tasks Checklist */}
                <section className="mb-6">
                    <h2 className="text-xs font-semibold text-zinc-600 uppercase tracking-[0.2em] mb-3">
                        Checklist de execução
                    </h2>
                    <div className="space-y-2">
                        {subtarefas.map((st, i) => {
                            const isDone = completedSubtasks.has(st.id);
                            return (
                                <button
                                    key={st.id}
                                    onClick={() => onToggleSubtask(st.id)}
                                    className={`w-full flex items-start gap-3 p-4 rounded-xl border transition-all text-left ${isDone
                                        ? 'bg-emerald-500/5 border-emerald-500/15'
                                        : 'bg-[#111113] border-white/[0.06] hover:border-white/[0.12]'
                                        }`}
                                >
                                    {isDone
                                        ? <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                                        : <Circle className="w-4 h-4 text-zinc-700 mt-0.5 flex-shrink-0" />
                                    }
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-medium ${isDone ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>
                                            {st.titulo}
                                        </p>
                                        {st.descricao && (
                                            <p className="text-zinc-600 text-xs mt-1 leading-relaxed">{st.descricao}</p>
                                        )}
                                        <div className="flex items-center gap-3 mt-2">
                                            {st.tempo_estimado && (
                                                <span className="text-[10px] text-zinc-600 flex items-center gap-0.5">
                                                    <Clock className="w-2.5 h-2.5" /> {st.tempo_estimado}
                                                </span>
                                            )}
                                            {st.ferramenta && (
                                                <span className="text-[10px] text-zinc-600 flex items-center gap-0.5">
                                                    <Wrench className="w-2.5 h-2.5" /> {st.ferramenta}
                                                </span>
                                            )}
                                        </div>
                                        {st.dica_especialista && !isDone && (
                                            <p className="text-[11px] text-zinc-500 mt-2 pl-0 border-l-2 border-amber-500/20 leading-relaxed italic">
                                                &nbsp;{st.dica_especialista}
                                            </p>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </section>

                {/* Tools Section */}
                {detail.ferramentas_necessarias?.length > 0 && (
                    <section className="mb-6">
                        <button
                            onClick={() => setShowTools(!showTools)}
                            className="flex items-center gap-2 text-xs font-semibold text-zinc-600 uppercase tracking-[0.2em] mb-3 hover:text-zinc-400 transition-colors"
                        >
                            <Wrench className="w-3.5 h-3.5" />
                            Ferramentas necessárias ({detail.ferramentas_necessarias.length})
                            {showTools ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                        {showTools && (
                            <div className="space-y-2">
                                {detail.ferramentas_necessarias.map((tool, i) => (
                                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-[#111113] border border-white/[0.06]">
                                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                                            <Wrench className="w-3.5 h-3.5 text-blue-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-medium text-zinc-200">{tool.nome}</p>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                    {tool.custo}
                                                </span>
                                            </div>
                                            <p className="text-zinc-500 text-xs mt-0.5">{tool.para_que}</p>
                                            {tool.url && (
                                                <a href={tool.url} target="_blank" rel="noopener noreferrer"
                                                    className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-1">
                                                    <ExternalLink className="w-2.5 h-2.5" /> {tool.url}
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {/* Sources */}
                {(detail.sources?.length ?? 0) > 0 && (
                    <section className="mb-6">
                        <h2 className="flex items-center gap-2 text-xs font-semibold text-zinc-600 uppercase tracking-[0.2em] mb-3">
                            <ExternalLink className="w-3.5 h-3.5" />
                            Fontes consultadas
                        </h2>
                        <div className="flex flex-wrap gap-1.5">
                            {(detail.sources ?? []).map((url, i) => {
                                let display = url;
                                try { display = new URL(url).hostname; } catch { }
                                return (
                                    <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-md bg-white/[0.03] text-zinc-500 hover:text-zinc-300 border border-white/[0.04] transition-colors">
                                        <ExternalLink className="w-2.5 h-2.5" />
                                        {display}
                                    </a>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* Expected Result */}
                {detail.resultado_esperado && (
                    <div className="mb-6 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                        <p className="text-[10px] font-semibold text-emerald-500/80 uppercase tracking-wide mb-1">Resultado esperado</p>
                        <p className="text-sm text-zinc-300 leading-relaxed">{detail.resultado_esperado}</p>
                    </div>
                )}

                {/* ── Task Chat ── */}
                <section>
                    <button
                        onClick={() => { setShowChat(!showChat); }}
                        className="flex items-center gap-2 w-full text-left text-xs font-semibold text-zinc-600 uppercase tracking-[0.2em] mb-3 hover:text-zinc-400 transition-colors"
                    >
                        <MessageCircle className="w-3.5 h-3.5" />
                        Pedir ajuda ({chatHistory.length > 0 ? `${chatHistory.length} msgs` : 'Chat da tarefa'})
                        {showChat ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    {showChat && (
                        <div className="rounded-2xl bg-[#111113] border border-white/[0.06] overflow-hidden">
                            {/* Messages */}
                            <div className="max-h-[400px] overflow-y-auto p-5 space-y-4">
                                {/* Welcome */}
                                <div className="flex gap-3">
                                    <div className="w-7 h-7 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                                        <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                                    </div>
                                    <p className="text-zinc-500 text-sm leading-relaxed">
                                        Sou seu assistente para esta tarefa. Posso ajudar com dúvidas específicas, 
                                        sugerir alternativas ou explicar qualquer passo do checklist.
                                    </p>
                                </div>

                                {chatHistory.map((msg, i) => (
                                    <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                        {msg.role === 'assistant' ? (
                                            <div className="w-7 h-7 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                                                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                                            </div>
                                        ) : (
                                            <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0">
                                                <span className="text-zinc-400 text-xs font-medium">V</span>
                                            </div>
                                        )}
                                        <div className={`flex-1 ${msg.role === 'user' ? 'text-right' : ''}`}>
                                            <div className={`inline-block text-left max-w-full ${msg.role === 'user'
                                                ? 'bg-white/[0.06] rounded-2xl rounded-tr-md px-4 py-2.5'
                                                : ''}`}>
                                                <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">
                                                    {msg.content}
                                                </p>
                                            </div>
                                            {msg.sources && msg.sources.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 mt-2">
                                                    {msg.sources.map((url, si) => {
                                                        let host = url;
                                                        try { host = new URL(url).hostname; } catch { }
                                                        return (
                                                            <a key={si} href={url} target="_blank" rel="noopener noreferrer"
                                                                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-white/[0.03] text-zinc-600 hover:text-zinc-400 border border-white/[0.04] transition-colors">
                                                                <ExternalLink className="w-2.5 h-2.5" /> {host}
                                                            </a>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {chatLoading && (
                                    <div className="flex gap-3">
                                        <div className="w-7 h-7 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                                            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
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
                                        placeholder="Pergunte sobre esta tarefa..."
                                        disabled={chatLoading}
                                        className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-white/[0.15] transition-colors disabled:opacity-50"
                                    />
                                    <button
                                        type="submit"
                                        disabled={chatLoading || !inputValue.trim()}
                                        className="px-4 py-2.5 rounded-xl text-sm font-medium bg-violet-500/20 text-violet-400 transition-all disabled:opacity-30"
                                    >
                                        <Send className="w-4 h-4" />
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
