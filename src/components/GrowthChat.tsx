'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, Sparkles, Send, Loader2, Check, X, Globe, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';

interface SearchSource {
    title: string;
    url: string;
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
    searching?: boolean;
    searchQuery?: string;
    searchSources?: SearchSource[];
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
    modelo_operacional: 'Modelo Op.',
    capital_disponivel: 'Capital',
    principal_gargalo: 'Gargalo',
    margem_lucro: 'Margem',
    tempo_entrega: 'Prazo',
    origem_clientes: 'Origem',
    maior_objecao: 'Objeção',
};

const REQUIRED_FIELDS = ['nome_negocio', 'segmento', 'modelo', 'localizacao', 'dificuldades', 'objetivos'];

// Collapsible sources list for search results
const SourcesList: React.FC<{ sources: SearchSource[] }> = ({ sources }) => {
    const [open, setOpen] = useState(false);
    if (!sources.length) return null;

    return (
        <div className="mt-1.5 px-1">
            <button
                onClick={() => setOpen(o => !o)}
                className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-400 transition-colors"
            >
                <ExternalLink className="w-3 h-3" />
                <span>{sources.length} fonte{sources.length > 1 ? 's' : ''}</span>
                {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {open && (
                <div className="mt-1.5 space-y-1">
                    {sources.map((s, idx) => (
                        <a
                            key={idx}
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-start gap-1.5 px-2 py-1 rounded-md bg-zinc-900/50 border border-white/[0.04] hover:border-zinc-600/30 transition-all group"
                        >
                            <ExternalLink className="w-3 h-3 text-zinc-600 mt-0.5 shrink-0 group-hover:text-zinc-400" />
                            <span className="text-[11px] text-zinc-500 group-hover:text-zinc-300 line-clamp-1 transition-colors">
                                {s.title || new URL(s.url).hostname}
                            </span>
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
};

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
        // Auto-focus input when a new message arrives
        if (messages.length > 0) {
            inputRef.current?.focus();
        }
    }, [messages]);

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
                content: 'Oi! 👋 Sou sua consultora de crescimento. Me conta: qual o nome da sua empresa e o que ela faz?'
            }]);
        }
    };

    const sendMessage = async (overrideText?: string) => {
        const text = overrideText || input.trim();
        if (!text || sending) return;

        const userMsg: Message = { role: 'user', content: text };
        const updatedMessages = [...messages, userMsg];
        setMessages(updatedMessages);
        if (!overrideText) setInput('');
        setSending(true);

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

            const aiMsg: Message = {
                role: 'assistant',
                content: data.reply || 'Desculpe, não consegui processar. Pode tentar de novo?',
                searching: data.search_performed,
                searchQuery: data.search_query,
                searchSources: data.search_sources || [],
            };

            setMessages(prev => [...prev.slice(0, -1), aiMsg]);

            if (data.extracted_profile) setExtractedProfile(data.extracted_profile);
            if (data.fields_collected) setFieldsCollected(data.fields_collected);
            if (data.fields_missing) setFieldsMissing(data.fields_missing);
            if (data.ready_for_analysis) setReadyForAnalysis(true);

        } catch {
            setMessages(prev => [
                ...prev.slice(0, -1),
                { role: 'assistant', content: 'Erro de conexão. Tente novamente.' }
            ]);
        } finally {
            setSending(false);
            inputRef.current?.focus();
        }
    };

    const handleConfirmResearch = () => sendMessage('sim, concordo');
    const handleRejectResearch = () => sendMessage('não concordo, quero definir eu mesmo');

    const handleGenerateAnalysis = () => {
        const profileForAnalysis = {
            perfil: {
                nome: extractedProfile.nome_negocio || '',
                nome_negocio: extractedProfile.nome_negocio || '',
                segmento: extractedProfile.segmento || '',
                localizacao: extractedProfile.localizacao || '',
                modelo: extractedProfile.modelo || '',
                modelo_negocio: extractedProfile.modelo || '',
                tipo_oferta: extractedProfile.tipo_produto || 'ambos',
                tipo_produto: extractedProfile.tipo_produto || '',
                tempo_mercado: extractedProfile.tempo_operacao || '',
                tempo_operacao: extractedProfile.tempo_operacao || '',
                ticket_medio: extractedProfile.ticket_medio || '',
                ticket_medio_estimado: extractedProfile.ticket_medio || '',
                faturamento_mensal: extractedProfile.faturamento_mensal || '',
                faturamento_faixa: extractedProfile.faturamento_mensal || '',
                num_funcionarios: extractedProfile.num_funcionarios || '',
                investimento_marketing: extractedProfile.investimento_marketing || '',
                capital_disponivel: extractedProfile.capital_disponivel || '',
                dificuldades: extractedProfile.dificuldades || '',
                objetivos: extractedProfile.objetivos || '',
                modelo_operacional: extractedProfile.modelo_operacional || '',
                canais_venda: extractedProfile.canais_venda || '',
                concorrentes: extractedProfile.concorrentes || '',
                diferencial: extractedProfile.diferencial || '',
                cliente_ideal: extractedProfile.cliente_ideal || '',
                margem_lucro: extractedProfile.margem_lucro || '',
                origem_clientes: extractedProfile.origem_clientes || '',
                maior_objecao: extractedProfile.maior_objecao || '',
                tempo_entrega: extractedProfile.tempo_entrega || '',
                principal_gargalo: extractedProfile.principal_gargalo || '',
                instagram_handle: extractedProfile.instagram_handle || '',
                linkedin_url: extractedProfile.linkedin_url || '',
                site_url: extractedProfile.site_url || '',
                email_contato: extractedProfile.email_contato || '',
                whatsapp_numero: extractedProfile.whatsapp_numero || '',
                google_maps_url: extractedProfile.google_maps_url || '',
            },
            restricoes_criticas: {
                modelo_operacional: extractedProfile.modelo_operacional || null,
                capital_disponivel: extractedProfile.capital_disponivel || null,
                equipe_solo: extractedProfile.num_funcionarios === '1' || 
                             extractedProfile.num_funcionarios === 'solo' ||
                             extractedProfile.num_funcionarios === 'só eu' ||
                             extractedProfile.num_funcionarios === 'sozinho' ||
                             (extractedProfile.num_funcionarios || '').toLowerCase().includes('sozinho') ||
                             (extractedProfile.num_funcionarios || '').toLowerCase().includes('só eu'),
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
                maior_objecao: extractedProfile.maior_objecao || null,
                instagram_handle: extractedProfile.instagram_handle || null,
                linkedin_url: extractedProfile.linkedin_url || null,
                site_url: extractedProfile.site_url || null,
                email_contato: extractedProfile.email_contato || null,
                whatsapp_numero: extractedProfile.whatsapp_numero || null,
                google_maps_url: extractedProfile.google_maps_url || null,
            },
            _research_tasks: extractedProfile._research_tasks || [],
        };

        onProfileReady(profileForAnalysis);
    };

    // Derived state
    const hasPendingResearch = !!extractedProfile._research_pending;
    const pendingField = extractedProfile._research_pending?.field;
    const researchTasks = extractedProfile._research_tasks || [];
    const progressPercent = Math.round((fieldsCollected.length / Object.keys(FIELD_LABELS).length) * 100);

    // Parse message content — strip 🔍 prefix if present (legacy)
    const cleanMessage = (content: string): string => {
        return content.replace(/^🔍\s*\n?Buscou:.*?\n/i, '').trim();
    };

    return (
        <div className="flex flex-col h-full">
            {/* Micro progress bar */}
            <div className="h-0.5 bg-zinc-900">
                <div
                    className="h-full bg-gradient-to-r from-zinc-600 to-zinc-400 transition-all duration-700 ease-out"
                    style={{ width: `${progressPercent}%` }}
                />
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-2' : 'order-1'}`}>
                            {/* Search badge — shown above the message */}
                            {msg.searching && msg.searchQuery && (
                                <div className="flex items-center gap-1.5 mb-2 px-1">
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
                                        <Globe className="w-3 h-3 text-amber-400" />
                                        <span className="text-[11px] text-amber-400/80 font-medium">
                                            Pesquisou na web
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div className={`rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
                                msg.role === 'user'
                                    ? 'bg-white/[0.06] text-white border border-white/[0.08]'
                                    : msg.content === '...'
                                    ? 'bg-zinc-900/50 text-zinc-500 border border-white/[0.04]'
                                    : 'bg-zinc-900/50 text-zinc-300 border border-white/[0.04]'
                            }`}>
                                {msg.content === '...' ? (
                                    <div className="flex items-center gap-2.5 py-0.5">
                                        <Loader2 className="w-3.5 h-3.5 text-zinc-500 animate-spin" />
                                        <span className="text-xs text-zinc-500">
                                            {sending && messages[messages.length - 2]?.content?.toLowerCase().includes('não sei')
                                                ? 'Pesquisando...'
                                                : 'Pensando...'}
                                        </span>
                                    </div>
                                ) : (
                                    cleanMessage(msg.content).split('\n').map((line, j, arr) => (
                                        <React.Fragment key={j}>
                                            {line}
                                            {j < arr.length - 1 && <br />}
                                        </React.Fragment>
                                    ))
                                )}
                            </div>

                            {/* Research confirm/reject buttons — appear after the LAST assistant message if pending */}
                            {msg.role === 'assistant' && i === messages.length - 1 && hasPendingResearch && !sending && (
                                <div className="flex items-center gap-2 mt-2 px-1">
                                    <button
                                        onClick={handleConfirmResearch}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                                            bg-emerald-500/10 text-emerald-400 border border-emerald-500/20
                                            hover:bg-emerald-500/20 transition-all active:scale-95"
                                    >
                                        <Check className="w-3.5 h-3.5" />
                                        Concordo
                                    </button>
                                    <button
                                        onClick={handleRejectResearch}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                                            bg-zinc-500/10 text-zinc-400 border border-zinc-500/20
                                            hover:bg-zinc-500/20 transition-all active:scale-95"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                        Definir eu mesmo
                                    </button>
                                </div>
                            )}

                            {/* Search sources — collapsible list */}
                            {msg.searching && msg.searchSources && msg.searchSources.length > 0 && (
                                <SourcesList sources={msg.searchSources} />
                            )}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="border-t border-white/[0.04] px-6 py-4">
                {readyForAnalysis && !loading && (
                    <button
                        onClick={handleGenerateAnalysis}
                        className="w-full mb-3 px-5 py-3.5 rounded-xl font-semibold text-sm bg-zinc-700 text-white hover:bg-zinc-600 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                    >
                        <Sparkles className="w-4 h-4" />
                        Gerar Análise Completa
                    </button>
                )}

                {loading ? (
                    <div className="flex items-center justify-center gap-3 py-3 text-sm text-zinc-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Gerando análise...</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                            placeholder="Digite sua mensagem..."
                            disabled={sending}
                            className="flex-1 bg-zinc-900/50 hover:bg-zinc-900 focus:bg-zinc-900 rounded-xl px-4 py-3 text-white text-sm placeholder-zinc-600 outline-none transition-all border border-white/[0.04] focus:border-zinc-500/30 disabled:opacity-50"
                        />
                        <button
                            onClick={() => sendMessage()}
                            disabled={!input.trim() || sending}
                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                                input.trim() && !sending
                                    ? 'bg-zinc-700 text-white hover:bg-zinc-600 active:scale-95'
                                    : 'bg-zinc-900 text-zinc-600 cursor-not-allowed border border-white/[0.04]'
                            }`}
                        >
                            {sending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GrowthChat;
