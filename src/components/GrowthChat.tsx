'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Search, Sparkles, Send, Loader2 } from 'lucide-react';

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
                content: 'Olá! Vou te ajudar a fazer uma análise completa do seu negócio. Para começar, me conta: qual o nome da sua empresa e o que ela faz?'
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
                { role: 'assistant', content: 'Erro de conexão. Tente novamente.' }
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
        <div className="flex flex-col h-full">
            {/* Messages area - Minimal & Clean */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-2' : 'order-1'}`}>
                            {/* Search indicator */}
                            {msg.searching && msg.searchQuery && (
                                <div className="flex items-center gap-1.5 text-[10px] text-amber-400/60 mb-1.5 px-1">
                                    <Search className="w-3 h-3" />
                                    <span>Pesquisou: &quot;{msg.searchQuery}&quot;</span>
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
                                    <div className="flex items-center gap-2">
                                        <div className="flex gap-1">
                                            <span className="w-1.5 h-1.5 bg-zinc-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <span className="w-1.5 h-1.5 bg-zinc-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <span className="w-1.5 h-1.5 bg-zinc-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </div>
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

            {/* Input area - Minimal */}
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
                            onClick={sendMessage}
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
