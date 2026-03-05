'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    Send, Loader2, Check, X, Globe, ExternalLink,
    ChevronDown, ChevronUp, User as UserIcon, Play,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import ModelSelector from '@/features/shared/components/model-selector';
import { VoiceButton, VoiceInterimBadge } from '@/features/shared/components/voice-button';
import { useVoiceInput } from '@/features/shared/hooks/use-voice-input';

interface SearchSource {
    title: string;
    url: string;
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
    streamTarget?: string;
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

const TypingDots: React.FC = () => (
    <span className="inline-flex items-center gap-[3px]">
        {[0, 1, 2].map(i => (
            <span
                key={i}
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{
                    backgroundColor: 'var(--color-text-muted)',
                    animation: 'dot-pulse 1.2s ease-in-out infinite',
                    animationDelay: `${i * 0.2}s`,
                }}
            />
        ))}
    </span>
);

const ShimmerRow: React.FC<{ label?: string }> = ({ label = 'Pensando...' }) => (
    <div className="flex gap-3">
        <img src="/logo_icon.png" alt="Agent" className="w-7 h-7 object-contain flex-shrink-0 mt-0.5" />
        <div className="flex-1 py-1">
            <div
                className="relative overflow-hidden rounded-lg flex items-center gap-3 px-3 py-2"
                style={{
                    backgroundColor: 'var(--color-surface-hover)',
                    border: '1px solid var(--color-border)',
                }}
            >
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)', animation: 'shimmer-slide 1.6s ease-in-out infinite' }}
                />
                <TypingDots />
                <span className="text-xs relative" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
            </div>
        </div>
    </div>
);

function useStreamText(target: string | undefined, onDone?: () => void) {
    const [displayed, setDisplayed] = useState('');
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!target) { setDisplayed(''); return; }
        setDisplayed('');
        let idx = 0;
        const chunkSize = Math.max(3, Math.ceil(target.length / 80));
        const speed = Math.max(8, Math.round(6000 / target.length));

        const tick = () => {
            idx = Math.min(idx + chunkSize, target.length);
            setDisplayed(target.slice(0, idx));
            if (idx < target.length) {
                timerRef.current = setTimeout(tick, speed);
            } else {
                onDone?.();
            }
        };
        timerRef.current = setTimeout(tick, 30);
        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [target]);

    return displayed;
}

const StreamingBubble: React.FC<{ target: string; onDone: () => void }> = ({ target, onDone }) => {
    const text = useStreamText(target, onDone);
    return (
        <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--color-text-secondary)' }}>
            {text}
            {text.length < target.length && (
                <span
                    className="inline-block w-0.5 h-3.5 ml-0.5 animate-pulse align-middle"
                    style={{ backgroundColor: 'var(--color-accent)', opacity: 0.7 }}
                />
            )}
        </p>
    );
};

const SourcesList: React.FC<{ sources: SearchSource[] }> = ({ sources }) => {
    const [open, setOpen] = useState(false);
    if (!sources.length) return null;
    return (
        <div className="mt-2">
            <button
                onClick={() => setOpen(o => !o)}
                className="inline-flex items-center gap-1.5 text-[10px] transition-colors duration-150"
                style={{ color: 'var(--color-text-muted)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text-tertiary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}
            >
                <ExternalLink className="w-2.5 h-2.5" />
                {sources.length} fonte{sources.length > 1 ? 's' : ''}
                {open ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
            </button>
            {open && (
                <div className="mt-1.5 flex flex-wrap gap-1.5" style={{ animation: 'fade-in 0.15s ease-out' }}>
                    {sources.map((s, idx) => {
                        let display = s.title;
                        try { if (!display) display = new URL(s.url).hostname; } catch { display = s.url; }
                        return (
                            <a
                                key={idx}
                                href={s.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md transition-colors duration-150"
                                style={{
                                    backgroundColor: 'var(--color-surface-2)',
                                    color: 'var(--color-text-muted)',
                                    border: '1px solid var(--color-border)',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
                                onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}
                            >
                                <ExternalLink className="w-2.5 h-2.5" />{display}
                            </a>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const GrowthChat: React.FC<GrowthChatProps> = ({ onProfileReady, loading = false }) => {
    const { aiModel, setAiModel } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [extractedProfile, setExtractedProfile] = useState<ExtractedProfile>({});
    const [readyForAnalysis, setReadyForAnalysis] = useState(false);
    const [fieldsCollected, setFieldsCollected] = useState<string[]>([]);
    const [streamingIdx, setStreamingIdx] = useState<number | null>(null);
    const [initialized, setInitialized] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

    useEffect(() => { scrollToBottom(); }, [messages]);

    useEffect(() => {
        if (!initialized) { setInitialized(true); initChat(); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialized]);

    const cleanMessage = (c: string) => c.replace(/^🔍\s*\n?Buscou:.*?\n/i, '').trim();

    const finalizeStreaming = useCallback((idx: number, msg: Message) => {
        setMessages(prev => {
            const next = [...prev];
            next[idx] = { ...msg, content: msg.streamTarget || msg.content, streamTarget: undefined };
            return next;
        });
        setStreamingIdx(null);
        setTimeout(() => inputRef.current?.focus(), 50);
    }, []);

    const startStreaming = useCallback((idx: number) => setStreamingIdx(idx), []);

    const initChat = async () => {
        try {
            const res = await fetch('/api/growth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'chat', aiModel, messages: [], user_message: '', extracted_profile: {} }),
            });
            const data = await res.json();
            if (data.reply) {
                const cleaned = cleanMessage(data.reply);
                setMessages([{ role: 'assistant', content: '', streamTarget: cleaned }]);
                startStreaming(0);
            }
        } catch {
            setMessages([{ role: 'assistant', content: 'Oi! 👋 Me conta: qual o nome da sua empresa e o que ela faz?' }]);
        }
    };

    const sendMessage = async (overrideText?: string) => {
        const text = overrideText || input.trim();
        if (!text || sending) return;

        const userMsg: Message = { role: 'user', content: text };
        const updatedMessages = [...messages, userMsg];
        setMessages(prev => [...prev, userMsg, { role: 'assistant', content: '...' }]);
        if (!overrideText) setInput('');
        setSending(true);

        try {
            const res = await fetch('/api/growth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'chat', aiModel,
                    messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
                    user_message: text,
                    extracted_profile: extractedProfile,
                }),
            });
            const data = await res.json();
            const cleaned = cleanMessage(data.reply || 'Desculpe, não consegui processar. Pode tentar de novo?');
            const aiMsg: Message = {
                role: 'assistant',
                content: '',
                streamTarget: cleaned,
                searching: data.search_performed,
                searchQuery: data.search_query,
                searchSources: data.search_sources || [],
            };
            setMessages(prev => {
                const next = [...prev.slice(0, -1), aiMsg];
                startStreaming(next.length - 1);
                return next;
            });
            if (data.extracted_profile) setExtractedProfile(data.extracted_profile);
            if (data.fields_collected) setFieldsCollected(data.fields_collected);
            if (data.ready_for_analysis) setReadyForAnalysis(true);
        } catch {
            setMessages(prev => [
                ...prev.slice(0, -1),
                { role: 'assistant', content: 'Erro de conexão. Tente novamente.' },
            ]);
        } finally {
            setSending(false);
        }
    };

    const handleConfirmResearch = () => sendMessage('sim, concordo');
    const handleRejectResearch = () => sendMessage('não concordo, quero definir eu mesmo');

    const handleGenerateAnalysis = () => {
        const criticalCheck = ['nome_negocio', 'segmento'].every(
            f => extractedProfile[f] && String(extractedProfile[f]).trim() !== ''
        );
        if (!criticalCheck) {
            sendMessage('Preciso saber pelo menos o nome e o segmento do seu negócio para gerar a análise.');
            return;
        }
        const ep = extractedProfile;
        const backendProfile = {
            nome_negocio: ep.nome_negocio || '', segmento: ep.segmento || '', localizacao: ep.localizacao || '',
            modelo: ep.modelo || '', faturamento: ep.faturamento || '', equipe: ep.equipe || '',
            ticket_medio: ep.ticket_medio || '', problemas: ep.problemas || '', objetivos: ep.objetivos || '',
            investimento: ep.investimento || '', canais: ep.canais || '', clientes: ep.clientes || '',
            concorrentes: ep.concorrentes || '', diferencial: ep.diferencial || '', margem: ep.margem || '',
            gargalos: ep.gargalos || '', site: ep.site || '', instagram: ep.instagram || '', whatsapp: ep.whatsapp || '',
            perfil: {
                nome: ep.nome_negocio || '', nome_negocio: ep.nome_negocio || '', segmento: ep.segmento || '',
                localizacao: ep.localizacao || '', modelo: ep.modelo || '', modelo_negocio: ep.modelo || '',
                tipo_oferta: ep.tipo_produto || 'ambos', tipo_produto: ep.tipo_produto || '',
                tempo_mercado: ep.tempo_operacao || '', tempo_operacao: ep.tempo_operacao || '',
                ticket_medio: ep.ticket_medio || '', ticket_medio_estimado: ep.ticket_medio || '',
                faturamento_mensal: ep.faturamento || '', faturamento_faixa: ep.faturamento || '',
                num_funcionarios: ep.equipe || '', investimento_marketing: ep.investimento || '',
                capital_disponivel: ep.capital_disponivel || '',
                dificuldades: ep.dificuldades || ep.problemas || '', objetivos: ep.objetivos || '',
                modelo_operacional: ep.modelo_operacional || ep.operacao || '', canais_venda: ep.canais || '',
                concorrentes: ep.concorrentes || '', diferencial: ep.diferencial || '', cliente_ideal: ep.clientes || '',
                margem_lucro: ep.margem || '', origem_clientes: ep.origem_clientes || '',
                maior_objecao: ep.maior_objecao || '', tempo_entrega: ep.tempo_entrega || '',
                principal_gargalo: ep.gargalos || '', instagram_handle: ep.instagram || '',
                linkedin_url: ep.linkedin || '', site_url: ep.site || '', email_contato: ep.email || '',
                whatsapp_numero: ep.whatsapp || '', google_maps_url: ep.google_maps || '',
            },
            restricoes_criticas: {
                modelo_operacional: ep.operacao || null, capital_disponivel: ep.investimento || null,
                equipe_solo: ep.equipe === '1' || ep.equipe === 'solo' || ep.equipe === 'só eu' || ep.equipe === 'sozinho' ||
                    String(ep.equipe || '').toLowerCase().includes('sozinho') || String(ep.equipe || '').toLowerCase().includes('só eu'),
                canais_existentes: ep.canais || [], principal_gargalo: ep.gargalos || null, maior_objecao: ep.maior_objecao || null,
            },
            diagnostico_inicial: {
                problemas_identificados: [{ area: 'geral', problema: ep.problemas || '', severidade: 3, evidencia: 'Relatado pelo usuário', restricao_afetada: ep.operacao || null }],
                pontos_fortes: [ep.diferencial || 'A definir'],
            },
            categorias_relevantes: [], queries_sugeridas: {},
            objetivos_parseados: [{ objetivo: ep.objetivos || '', prazo: 'médio prazo', area_relacionada: 'crescimento' }],
            _chat_context: {
                concorrentes: ep.concorrentes || null, cliente_ideal: ep.clientes || null,
                canais_venda: ep.canais || [], investimento_marketing: ep.investimento || null,
                margem_lucro: ep.margem || null, tempo_entrega: ep.tempo_entrega || null,
                origem_clientes: ep.origem_clientes || null, maior_objecao: ep.maior_objecao || null,
                instagram_handle: ep.instagram || null, linkedin_url: ep.linkedin || null,
                site_url: ep.site || null, email_contato: ep.email || null,
                whatsapp_numero: ep.whatsapp || null, google_maps_url: ep.google_maps || null,
            },
            _research_tasks: ep._research_tasks || [],
        };
        onProfileReady(backendProfile);
    };

    const hasPendingResearch = !!extractedProfile._research_pending;
    const progressPercent = Math.round((fieldsCollected.length / Object.keys(FIELD_LABELS).length) * 100);

    const voice = useVoiceInput({
        onTranscript: (text) => {
            setInput(prev => (prev ? `${prev} ${text}` : text));
            setTimeout(() => inputRef.current?.focus(), 50);
        },
    });

    return (
        <div className="flex flex-col h-full">
            {/* Progress bar */}
            <div className="h-px" style={{ backgroundColor: 'var(--color-border)' }}>
                <div
                    className="h-full transition-all duration-700 ease-out"
                    style={{
                        width: `${progressPercent}%`,
                        background: `linear-gradient(90deg, var(--color-accent), rgba(59,130,246,0.4))`,
                    }}
                />
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
                {messages.map((msg, i) => {
                    const isThinking = msg.content === '...' && !msg.streamTarget;
                    const isStreaming = streamingIdx === i && !!msg.streamTarget;

                    if (isThinking) {
                        return <ShimmerRow key={i} label="Pensando..." />;
                    }

                    if (msg.role === 'user') {
                        return (
                            <div key={i} className="flex gap-3 flex-row-reverse" style={{ animation: 'fade-in-up 0.15s ease-out' }}>
                                <div
                                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                                    style={{ backgroundColor: 'var(--color-surface-2)' }}
                                >
                                    <UserIcon className="w-3.5 h-3.5" style={{ color: 'var(--color-text-tertiary)' }} />
                                </div>
                                <div className="flex-1 text-right">
                                    <div
                                        className="inline-block text-left rounded-2xl rounded-tr-md px-4 py-2.5 max-w-[85%]"
                                        style={{
                                            backgroundColor: 'var(--color-surface-active)',
                                            border: '1px solid var(--color-border)',
                                        }}
                                    >
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--color-text-secondary)' }}>{msg.content}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div key={i} className="flex gap-3" style={{ animation: 'fade-in-up 0.15s ease-out' }}>
                            <img src="/logo_icon.png" alt="Agent" className="w-7 h-7 object-contain flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                                {msg.searching && msg.searchQuery && (
                                    <div className="flex items-center gap-1.5 mb-2">
                                        <div
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                                            style={{
                                                backgroundColor: 'var(--color-warning-muted)',
                                                border: '1px solid rgba(234,179,8,0.15)',
                                            }}
                                        >
                                            <Globe className="w-3 h-3" style={{ color: 'var(--color-warning)' }} />
                                            <span className="text-[10px] font-medium" style={{ color: 'rgba(234,179,8,0.8)' }}>&ldquo;{msg.searchQuery}&rdquo;</span>
                                        </div>
                                    </div>
                                )}

                                {isStreaming && msg.streamTarget ? (
                                    <StreamingBubble target={msg.streamTarget} onDone={() => finalizeStreaming(i, msg)} />
                                ) : (
                                    <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--color-text-secondary)' }}>{msg.content}</p>
                                )}

                                {/* Research action buttons */}
                                {!isStreaming && i === messages.length - 1 && hasPendingResearch && !sending && (
                                    <div className="flex flex-wrap items-center gap-2 mt-3">
                                        <button
                                            onClick={handleConfirmResearch}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-150 active:scale-95"
                                            style={{
                                                backgroundColor: 'var(--color-success-muted)',
                                                color: 'var(--color-success)',
                                                border: '1px solid rgba(34,197,94,0.15)',
                                            }}
                                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(34,197,94,0.15)')}
                                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--color-success-muted)')}
                                        >
                                            <Check className="w-3 h-3" />Concordo, pesquisar
                                        </button>
                                        <button
                                            onClick={handleRejectResearch}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-150 active:scale-95"
                                            style={{
                                                backgroundColor: 'var(--color-surface-hover)',
                                                color: 'var(--color-text-tertiary)',
                                                border: '1px solid var(--color-border)',
                                            }}
                                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-active)')}
                                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
                                        >
                                            <X className="w-3 h-3" />Definir eu mesmo
                                        </button>
                                    </div>
                                )}

                                {msg.searching && msg.searchSources && msg.searchSources.length > 0 && (
                                    <SourcesList sources={msg.searchSources} />
                                )}
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input card */}
            <div className="px-4 pb-4 pt-3 flex-shrink-0" style={{ borderTop: '1px solid var(--color-border)' }}>
                <div
                    className="w-full rounded-xl p-3 flex flex-col gap-2"
                    style={{
                        backgroundColor: 'var(--color-surface-active)',
                        border: '1px solid var(--color-border)',
                    }}
                >
                    <VoiceInterimBadge text={voice.interimText} />

                    <div className="flex flex-col gap-2 flex-1 min-w-0 w-full mb-1">
                        {loading ? (
                            <div className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
                                <TypingDots />
                                <span>Gerando análise...</span>
                            </div>
                        ) : (
                            <input
                                ref={inputRef}
                                type="text"
                                value={voice.state === 'listening' && voice.interimText
                                    ? `${input}${input ? ' ' : ''}${voice.interimText}`
                                    : input}
                                onChange={e => {
                                    if (voice.state !== 'listening') setInput(e.target.value);
                                }}
                                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                                placeholder={
                                    voice.state === 'listening'
                                        ? 'Ouvindo...'
                                        : 'Digite ou fale sua mensagem...'
                                }
                                disabled={sending || streamingIdx !== null}
                                className="w-full bg-transparent text-[13px] font-medium focus:outline-none disabled:opacity-40 leading-snug"
                                style={{
                                    color: 'var(--color-text-primary)',
                                }}
                            />
                        )}

                        {/* Metadata badges */}
                        <div className="flex flex-wrap items-center gap-2 text-left text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                            <span className="font-mono" style={{ color: 'var(--color-text-tertiary)' }}>
                                {messages.filter(m => m.role === 'user').length > 0
                                    ? `#${messages.filter(m => m.role === 'user').length}`
                                    : '#0'}
                            </span>
                            {fieldsCollected.length > 0 && (
                                <>
                                    <span className="w-1 h-1 rounded-full" style={{ backgroundColor: 'var(--color-border-strong)' }} />
                                    <span style={{ color: 'var(--color-accent)', opacity: 0.7 }}>{progressPercent}% coletado</span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="w-full pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
                        <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                                <ModelSelector value={aiModel} onChange={setAiModel} direction="up" />
                            </div>

                            <div className="flex items-center gap-1">
                                {readyForAnalysis && !loading && !sending && (
                                    <button
                                        onClick={handleGenerateAnalysis}
                                        className="relative overflow-hidden flex items-center gap-2 h-7 px-3 rounded-lg transition-all duration-150 cursor-pointer"
                                        style={{ backgroundColor: 'transparent' }}
                                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-accent-muted)')}
                                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                                        title="Gerar análise completa"
                                    >
                                        <div
                                            className="absolute inset-0 pointer-events-none"
                                            style={{ background: 'linear-gradient(90deg, transparent, var(--color-accent-muted), transparent)', animation: 'shimmer-slide 2.4s ease-in-out infinite' }}
                                        />
                                        <Play className="w-3.5 h-3.5 fill-current relative z-10" style={{ color: 'var(--color-accent)' }} />
                                        <span className="text-[11px] font-medium relative z-10" style={{ color: 'var(--color-text-tertiary)' }}>Gerar Análise</span>
                                    </button>
                                )}

                                <VoiceButton
                                    state={voice.state}
                                    interimText={voice.interimText}
                                    isSupported={voice.isSupported}
                                    onToggle={voice.toggle}
                                />

                                <button
                                    onClick={() => sendMessage()}
                                    disabled={!input.trim() || sending || streamingIdx !== null || loading}
                                    className="flex items-center gap-2 h-7 px-3 rounded-lg transition-all duration-150 cursor-pointer disabled:opacity-50"
                                    style={{ backgroundColor: 'transparent' }}
                                    onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'; }}
                                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                                    title="Enviar mensagem"
                                >
                                    {sending
                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--color-text-tertiary)' }} />
                                        : <Send className="w-3.5 h-3.5" style={{ color: 'var(--color-text-tertiary)' }} />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GrowthChat;
