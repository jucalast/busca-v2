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
            <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" style={{ color: 'var(--color-text-muted)' }} />
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Pesquisando especialistas e gerando checklist...</p>
                    <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>Buscando dados reais na internet</p>
                </div>
            </div>
        );
    }

    const subtarefas = detail.subtarefas || [];
    const completedCount = subtarefas.filter(st => completedSubtasks.has(st.id)).length;
    const progress = subtarefas.length > 0 ? (completedCount / subtarefas.length) * 100 : 0;

    return (
        <div className="min-h-screen overflow-hidden" style={{ backgroundColor: 'var(--color-bg)' }}>
            <div className="max-w-5xl mx-auto px-6 py-8 relative">

                {/* Back */}
                <div className="mb-6">
                    <button
                        onClick={onBack}
                        className="p-2 rounded-lg transition-all hover:scale-105 active:scale-95 border"
                        style={{ 
                            backgroundColor: 'var(--color-surface-1)', 
                            borderColor: 'var(--color-border)',
                            color: 'var(--color-text-secondary)'
                        }}
                    >
                        <ArrowLeft size={16} />
                    </button>
                </div>

                {/* Header */}
                <div className="mb-6">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] mb-1" style={{ color: 'var(--color-text-muted)' }}>{phaseTitle}</p>
                    <h1 className="text-xl font-bold leading-tight" style={{ color: 'var(--color-text-primary)' }}>{detail.titulo || taskTitle}</h1>
                    {detail.descricao && (
                        <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{detail.descricao}</p>
                    )}
                </div>

                {/* Progress Bar */}
                <div className="mb-6 p-4 rounded-xl" style={{ backgroundColor: 'var(--color-surface-1)' }}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Progresso</span>
                        <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>{completedCount}/{subtarefas.length}</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-surface-hover)' }}>
                        <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${progress}%`, backgroundColor: 'var(--color-success)' }}
                        />
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
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
                    <div className="mb-6 p-4 rounded-xl" style={{ backgroundColor: 'var(--color-warning-muted)' }}>
                        <div className="flex items-start gap-2.5">
                            <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-warning)' }} />
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--color-warning)' }}>Dica do especialista</p>
                                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>{detail.dica_principal}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Sub-tasks Checklist */}
                <section className="mb-6">
                    <h2 className="text-xs font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: 'var(--color-text-muted)' }}>
                        Checklist de execução
                    </h2>
                    <div className="space-y-2">
                        {subtarefas.map((st, i) => {
                            const isDone = completedSubtasks.has(st.id);
                            return (
                                <button
                                    key={st.id}
                                    onClick={() => onToggleSubtask(st.id)}
                                    className={`w-full flex items-start gap-3 p-4 rounded-xl transition-all text-left`}
                                    style={{
                                        backgroundColor: isDone ? 'var(--color-success-muted)' : 'var(--color-surface-1)',
                                    }}
                                    onMouseEnter={e => {
                                        if (!isDone) e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
                                    }}
                                    onMouseLeave={e => {
                                        if (!isDone) e.currentTarget.style.backgroundColor = 'var(--color-surface-1)';
                                    }}
                                >
                                    {isDone
                                        ? <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-success)' }} />
                                        : <Circle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }} />
                                    }
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium" style={{ color: isDone ? 'var(--color-text-muted)' : 'var(--color-text-primary)' }}>
                                            {st.titulo}
                                        </p>
                                        {st.descricao && (
                                            <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{st.descricao}</p>
                                        )}
                                        <div className="flex items-center gap-3 mt-2">
                                            {st.tempo_estimado && (
                                                <span className="text-[10px] flex items-center gap-0.5" style={{ color: 'var(--color-text-muted)' }}>
                                                    <Clock className="w-2.5 h-2.5" /> {st.tempo_estimado}
                                                </span>
                                            )}
                                            {st.ferramenta && (
                                                <span className="text-[10px] flex items-center gap-0.5" style={{ color: 'var(--color-text-muted)' }}>
                                                    <Wrench className="w-2.5 h-2.5" /> {st.ferramenta}
                                                </span>
                                            )}
                                        </div>
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
                            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] mb-3 transition-colors"
                            style={{ color: 'var(--color-text-muted)' }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--color-text-secondary)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-muted)'}
                        >
                            <Wrench className="w-3.5 h-3.5" />
                            Ferramentas necessárias ({detail.ferramentas_necessarias.length})
                            {showTools ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                        {showTools && (
                            <div className="space-y-2">
                                {detail.ferramentas_necessarias.map((tool, i) => (
                                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl" style={{ backgroundColor: 'var(--color-surface-1)' }}>
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--color-accent-muted)' }}>
                                            <Wrench className="w-3.5 h-3.5" style={{ color: 'var(--color-accent)' }} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{tool.nome}</p>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ backgroundColor: 'var(--color-success-muted)', color: 'var(--color-success)' }}>
                                                    {tool.custo}
                                                </span>
                                            </div>
                                            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{tool.para_que}</p>
                                            {tool.url && (
                                                <a href={tool.url} target="_blank" rel="noopener noreferrer"
                                                    className="text-[10px] flex items-center gap-1 mt-1 transition-colors"
                                                    style={{ color: 'var(--color-accent)' }}
                                                >
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
                        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: 'var(--color-text-muted)' }}>
                            <ExternalLink className="w-3.5 h-3.5" />
                            Fontes consultadas
                        </h2>
                        <div className="flex flex-wrap gap-1.5">
                            {(detail.sources ?? []).map((url, i) => {
                                let display = url;
                                try { display = new URL(url).hostname; } catch { }
                                return (
                                    <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg transition-colors"
                                        style={{ backgroundColor: 'var(--color-surface-hover)', color: 'var(--color-text-secondary)' }}
                                    >
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
                    <div className="mb-6 p-4 rounded-xl" style={{ backgroundColor: 'var(--color-success-muted)' }}>
                        <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--color-success)' }}>Resultado esperado</p>
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>{detail.resultado_esperado}</p>
                    </div>
                )}

                {/* ── Task Chat ── */}
                <section>
                    <button
                        onClick={() => { setShowChat(!showChat); }}
                        className="flex items-center gap-2 w-full text-left text-xs font-semibold uppercase tracking-[0.2em] mb-3 transition-colors"
                        style={{ color: 'var(--color-text-muted)' }}
                    >
                        <MessageCircle className="w-3.5 h-3.5" />
                        Pedir ajuda ({chatHistory.length > 0 ? `${chatHistory.length} msgs` : 'Chat da tarefa'})
                        {showChat ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    {showChat && (
                        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--color-surface-1)' }}>
                            {/* Messages */}
                            <div className="max-h-[400px] overflow-y-auto p-5 space-y-4">
                                {/* Welcome */}
                                <div className="flex gap-3">
                                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--color-accent-muted)' }}>
                                        <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--color-accent)' }} />
                                    </div>
                                    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                                        Sou seu assistente para esta tarefa. Posso ajudar com dúvidas específicas,
                                        sugerir alternativas ou explicar qualquer passo do checklist.
                                    </p>
                                </div>

                                {chatHistory.map((msg, i) => (
                                    <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                        {msg.role === 'assistant' ? (
                                            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--color-accent-muted)' }}>
                                                <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--color-accent)' }} />
                                            </div>
                                        ) : (
                                            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--color-surface-hover)' }}>
                                                <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>V</span>
                                            </div>
                                        )}
                                        <div className={`flex-1 ${msg.role === 'user' ? 'text-right' : ''}`}>
                                            <div className={`inline-block text-left max-w-full ${msg.role === 'user' ? 'rounded-2xl rounded-tr-md px-4 py-2.5' : ''}`}
                                                style={msg.role === 'user' ? { backgroundColor: 'var(--color-surface-hover)' } : {}}>
                                                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--color-text-primary)' }}>
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
                                                                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg transition-colors"
                                                                style={{ backgroundColor: 'var(--color-surface-hover)', color: 'var(--color-text-secondary)' }}
                                                            >
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
                                        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--color-accent-muted)' }}>
                                            <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--color-accent)' }} />
                                        </div>
                                        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            Pesquisando e analisando...
                                        </div>
                                    </div>
                                )}
                                <div ref={chatEndRef} />
                            </div>

                            {/* Input */}
                            <form onSubmit={handleSubmit} className="p-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                                <div className="flex gap-2">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        placeholder="Pergunte sobre esta tarefa..."
                                        disabled={chatLoading}
                                        className="flex-1 rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-all disabled:opacity-50"
                                        style={{ backgroundColor: 'var(--color-surface-hover)', color: 'var(--color-text-primary)' }}
                                    />
                                    <button
                                        type="submit"
                                        disabled={chatLoading || !inputValue.trim()}
                                        className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-30"
                                        style={{ backgroundColor: 'var(--color-accent-muted)', color: 'var(--color-accent)' }}
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
