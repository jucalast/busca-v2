'use client';

import React, { useState, useRef, useEffect } from 'react';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    searching?: boolean;
    searchQuery?: string;
}

interface ExtractedProfile {
    [key: string]: any;
}

interface GrowthChatProps {
    onProfileReady: (profile: ExtractedProfile) => void;
    loading?: boolean;
}

const FIELD_LABELS: Record<string, string> = {
    nome_negocio: 'Nome',
    segmento: 'Segmento',
    modelo: 'Modelo',
    localizacao: 'Local',
    dificuldades: 'Desafios',
    objetivos: 'Objetivos',
    tempo_operacao: 'Tempo',
    num_funcionarios: 'Equipe',
    tipo_produto: 'Oferta',
    ticket_medio: 'Ticket',
    faturamento_mensal: 'Faturamento',
    canais_venda: 'Canais',
    concorrentes: 'Concorrentes',
    diferencial: 'Diferencial',
    cliente_ideal: 'Cliente Ideal',
    investimento_marketing: 'Invest. Mkt',
    // Context fields (critical for recommendations)
    modelo_operacional: 'Modelo Op.',
    capital_disponivel: 'Capital',
    principal_gargalo: 'Gargalo',
    margem_lucro: 'Margem',
    tempo_entrega: 'Prazo',
    origem_clientes: 'Origem',
    maior_objecao: 'Objeção',
};

const REQUIRED_FIELDS = ['nome_negocio', 'segmento', 'modelo', 'localizacao', 'dificuldades', 'objetivos'];

const GrowthChat: React.FC<GrowthChatProps> = ({ onProfileReady, loading = false }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [extractedProfile, setExtractedProfile] = useState<ExtractedProfile>({});
    const [readyForAnalysis, setReadyForAnalysis] = useState(false);
    const [fieldsCollected, setFieldsCollected] = useState<string[]>([]);
    const [fieldsMissing, setFieldsMissing] = useState<string[]>(REQUIRED_FIELDS);
    const [initialized, setInitialized] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Initialize: get greeting
    useEffect(() => {
        if (!initialized) {
            setInitialized(true);
            initChat();
        }
    }, [initialized]);

    const initChat = async () => {
        try {
            const res = await fetch('/api/growth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'chat',
                    messages: [],
                    user_message: '',
                    extracted_profile: {},
                }),
            });
            const data = await res.json();
            if (data.reply) {
                setMessages([{ role: 'assistant', content: data.reply }]);
            }
        } catch {
            setMessages([{
                role: 'assistant',
                content: 'Oi! 👋 Sou sua consultora de crescimento. Me conta: qual o nome do seu negócio e o que vocês fazem?'
            }]);
        }
    };

    const sendMessage = async () => {
        const text = input.trim();
        if (!text || sending) return;

        const userMsg: Message = { role: 'user', content: text };
        const updatedMessages = [...messages, userMsg];
        setMessages(updatedMessages);
        setInput('');
        setSending(true);

        // Add "thinking" indicator
        const thinkingMsg: Message = { role: 'assistant', content: '...', searching: false };
        setMessages(prev => [...prev, thinkingMsg]);

        try {
            const res = await fetch('/api/growth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'chat',
                    messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
                    user_message: text,
                    extracted_profile: extractedProfile,
                }),
            });

            const data = await res.json();

            // Replace thinking indicator with actual reply
            const aiMsg: Message = {
                role: 'assistant',
                content: data.reply || 'Desculpe, não consegui processar. Pode tentar de novo?',
                searching: data.search_performed,
                searchQuery: data.search_query,
            };

            setMessages(prev => [...prev.slice(0, -1), aiMsg]);

            // Update profile state
            if (data.extracted_profile) {
                setExtractedProfile(data.extracted_profile);
            }
            if (data.fields_collected) {
                setFieldsCollected(data.fields_collected);
            }
            if (data.fields_missing) {
                setFieldsMissing(data.fields_missing);
            }
            if (data.ready_for_analysis) {
                setReadyForAnalysis(true);
            }

        } catch (err: any) {
            setMessages(prev => [
                ...prev.slice(0, -1),
                { role: 'assistant', content: '❌ Erro de conexão. Tente novamente.' }
            ]);
        } finally {
            setSending(false);
            inputRef.current?.focus();
        }
    };

    const handleGenerateAnalysis = () => {
        // Build a structured profile from the chat extraction with context fields
        const profileForAnalysis = {
            perfil: {
                nome: extractedProfile.nome_negocio || '',
                segmento: extractedProfile.segmento || '',
                localizacao: extractedProfile.localizacao || '',
                modelo_negocio: extractedProfile.modelo || '',
                tipo_oferta: extractedProfile.tipo_produto || 'ambos',
                tempo_mercado: extractedProfile.tempo_operacao || '',
                ticket_medio_estimado: extractedProfile.ticket_medio || '',
                faturamento_faixa: extractedProfile.faturamento_mensal || '',
                num_funcionarios: extractedProfile.num_funcionarios || '',
                investimento_marketing: extractedProfile.investimento_marketing || '',
                dificuldades: extractedProfile.dificuldades || '',
                // Include context fields in perfil for downstream components
                modelo_operacional: extractedProfile.modelo_operacional || '',
            },
            // Critical restrictions extracted from conversation
            restricoes_criticas: {
                modelo_operacional: extractedProfile.modelo_operacional || null,
                capital_disponivel: extractedProfile.capital_disponivel || null,
                equipe_solo: extractedProfile.num_funcionarios === '1' || 
                             extractedProfile.num_funcionarios === 'solo' ||
                             extractedProfile.num_funcionarios === 'só eu' ||
                             extractedProfile.num_funcionarios === 'sozinho' ||
                             (extractedProfile.num_funcionarios || '').toLowerCase().includes('sozinho'),
                canais_existentes: extractedProfile.canais_venda || [],
                principal_gargalo: extractedProfile.principal_gargalo || null,
                maior_objecao: extractedProfile.maior_objecao || null,
            },
            diagnostico_inicial: {
                problemas_identificados: [{
                    area: 'geral',
                    problema: extractedProfile.dificuldades || '',
                    severidade: 3,
                    evidencia: 'Relatado pelo usuário na conversa',
                    restricao_afetada: extractedProfile.modelo_operacional || null
                }],
                pontos_fortes: [extractedProfile.diferencial || 'A definir'],
            },
            categorias_relevantes: [],
            queries_sugeridas: {},
            objetivos_parseados: [{
                objetivo: extractedProfile.objetivos || '',
                prazo: 'médio prazo',
                area_relacionada: 'crescimento'
            }],
            _chat_context: {
                concorrentes: extractedProfile.concorrentes || null,
                cliente_ideal: extractedProfile.cliente_ideal || null,
                canais_venda: extractedProfile.canais_venda || [],
                investimento_marketing: extractedProfile.investimento_marketing || null,
                margem_lucro: extractedProfile.margem_lucro || null,
                tempo_entrega: extractedProfile.tempo_entrega || null,
                origem_clientes: extractedProfile.origem_clientes || null,
            }
        };

        onProfileReady(profileForAnalysis);
    };

    const progressPercent = Math.round((fieldsCollected.length / Object.keys(FIELD_LABELS).length) * 100);
    const requiredDone = REQUIRED_FIELDS.filter(f => fieldsCollected.includes(f)).length;

    return (
        <div className="w-full max-w-3xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 300px)', minHeight: '500px' }}>

            {/* Header with progress */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-t-2xl px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-lg">
                            🧠
                        </div>
                        <div>
                            <h3 className="text-white font-bold text-sm">Consultora de Crescimento</h3>
                            <p className="text-emerald-400 text-xs">
                                {sending ? '💬 Pensando...' : readyForAnalysis ? '✅ Pronta para análise!' : '🟢 Online'}
                            </p>
                        </div>
                    </div>

                    {/* Fields progress */}
                    <div className="text-right">
                        <p className="text-xs text-zinc-500">{requiredDone}/{REQUIRED_FIELDS.length} obrigatórios</p>
                        <div className="w-24 h-1.5 bg-zinc-800 rounded-full mt-1 overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-emerald-500 to-lime-500 rounded-full transition-all duration-500"
                                style={{ width: `${Math.round((requiredDone / REQUIRED_FIELDS.length) * 100)}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Collected fields badges */}
                {fieldsCollected.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {fieldsCollected.map(f => (
                            <span key={f} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                ✓ {FIELD_LABELS[f] || f}
                            </span>
                        ))}
                        {fieldsMissing.map(f => (
                            <span key={f} className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-600">
                                {FIELD_LABELS[f] || f}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto bg-zinc-950/50 border-x border-zinc-800 px-4 py-4 space-y-4">
                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-2' : 'order-1'}`}>
                            {/* Search indicator */}
                            {msg.searching && msg.searchQuery && (
                                <div className="flex items-center gap-2 text-[11px] text-amber-400/80 mb-1.5 px-1">
                                    <span className="animate-pulse">🔍</span>
                                    <span>Buscou: &quot;{msg.searchQuery}&quot;</span>
                                </div>
                            )}

                            <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === 'user'
                                ? 'bg-emerald-500/15 text-emerald-50 border border-emerald-500/20 rounded-br-md'
                                : msg.content === '...'
                                    ? 'bg-zinc-900 text-zinc-400 border border-zinc-800 rounded-bl-md'
                                    : 'bg-zinc-900 text-zinc-200 border border-zinc-800 rounded-bl-md'
                                }`}>
                                {msg.content === '...' ? (
                                    <div className="flex items-center gap-2">
                                        <div className="flex gap-1">
                                            <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </div>
                                        <span className="text-xs text-zinc-600">
                                            {sending ? 'Pensando...' : 'Digitando...'}
                                        </span>
                                    </div>
                                ) : (
                                    msg.content.split('\n').map((line, j) => (
                                        <React.Fragment key={j}>
                                            {line}
                                            {j < msg.content.split('\n').length - 1 && <br />}
                                        </React.Fragment>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-b-2xl px-4 py-3">
                {readyForAnalysis && !loading && (
                    <button
                        onClick={handleGenerateAnalysis}
                        className="w-full mb-3 px-5 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 via-teal-500 to-lime-500 text-black hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] hover:scale-[1.01] active:scale-[0.99] transition-all"
                    >
                        🚀 Gerar Análise Completa de Crescimento
                    </button>
                )}

                {loading ? (
                    <div className="flex items-center justify-center gap-3 py-2 text-sm text-emerald-400">
                        <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                        Gerando análise completa...
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                            placeholder="Escreva sua resposta..."
                            disabled={sending}
                            className="flex-1 bg-zinc-900/50 hover:bg-zinc-900 focus:bg-zinc-900 rounded-xl px-4 py-3 text-white placeholder-zinc-600 outline-none transition-all text-sm border border-zinc-800 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 disabled:opacity-50"
                        />
                        <button
                            onClick={sendMessage}
                            disabled={!input.trim() || sending}
                            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${input.trim() && !sending
                                ? 'bg-emerald-500 text-black hover:bg-emerald-400 active:scale-95'
                                : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                                }`}
                        >
                            {sending ? (
                                <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="22" y1="2" x2="11" y2="13" />
                                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                                </svg>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GrowthChat;
