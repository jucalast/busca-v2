'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    Send, Loader2, Check, X, Globe, Search,
    ChevronDown, ChevronUp, User as UserIcon, Play, Zap, ArrowLeft
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import ModelSelector from '@/features/shared/components/model-selector';
import LLMUsageIndicator from '@/features/shared/components/llm-usage-indicator';
import { VoiceButton, VoiceInterimBadge } from '@/features/shared/components/voice-button';
import { useVoiceInput } from '@/features/shared/hooks/use-voice-input';
import { SourceBadgeList } from './SourceBadgeList';
import { MarkdownContent } from './MarkdownContent';
import { StreamingText } from './StreamingText';
import { IntelligenceToolsBadges } from '@/features/shared/components/intelligence-tools';
import { AutoScrollContainer } from './AutoScrollContainer';

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
    intelligence_tools_used?: any[];
    tokens?: number;
    actual_provider?: string;
}

interface ExtractedProfile {
    [key: string]: any;
    _research_tasks?: any[];
    _fields_researched?: string[];
    _research_pending?: boolean;
    _chat_context?: any;
    perfil?: any;
}

interface GrowthChatProps {
    onProfileReady: (profile: ExtractedProfile) => void;
    loading?: boolean;
}

const ShimmerRow: React.FC<{ label?: string }> = ({ label }) => (
    <div className="flex gap-3 animate-pulse opacity-60">
        <div className="w-7 h-7 rounded-full bg-slate-100 flex-shrink-0" />
        <div className="flex-1 space-y-2 py-1">
            <div className="h-3 w-40 bg-slate-100 rounded" />
            <div className="h-2 w-full bg-slate-50 rounded" />
        </div>
    </div>
);

const GrowthChat: React.FC<GrowthChatProps> = ({ onProfileReady, loading = false }) => {
    const { aiModel, setAiModel } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [extractedProfile, setExtractedProfile] = useState<ExtractedProfile>({});
    const [readyForAnalysis, setReadyForAnalysis] = useState(false);
    const [hasPendingResearch, setHasPendingResearch] = useState(false);
    const [streamingIdx, setStreamingIdx] = useState<number | null>(null);

    const abortControllerRef = useRef<AbortController | null>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Initial message
    useEffect(() => {
        if (messages.length === 0) {
            setMessages([{
                role: 'assistant',
                content: 'Olá! Sou seu estrategista de negócios. Para começarmos sua análise de forma automática, **poderia me informar o CNPJ da sua empresa?** (Se não tiver, não tem problema, podemos ir conversando!)'
            }]);
        }
    }, [messages.length]);

    const finalizeStreaming = useCallback((idx: number) => {
        setMessages(prev => {
            if (!prev[idx]) return prev;
            const next = [...prev];
            next[idx] = {
                ...next[idx],
                content: next[idx].streamTarget || next[idx].content,
                streamTarget: undefined
            };
            return next;
        });
        setStreamingIdx(null);
    }, []);

    const sendMessage = async (overrideContent?: string) => {
        const text = (overrideContent ?? input).trim();
        if (!text || sending) return;

        if (!overrideContent) setInput('');
        setSending(true);

        const newUserMsg: Message = { role: 'user', content: text };
        setMessages(prev => [...prev, newUserMsg]);

        try {
            abortControllerRef.current = new AbortController();

            // Initial AI message placeholder
            const initialAiMsg: Message = { role: 'assistant', content: '', intelligence_tools_used: [] };
            setMessages(prev => [...prev, initialAiMsg]);
            const aiMsgIdx = messages.length + 1;

            const res = await fetch('/api/growth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'chat',
                    user_message: text,
                    extracted_profile: extractedProfile,
                    aiModel,
                    messages: messages.map(m => ({ role: m.role, content: m.content || m.streamTarget })).slice(-8),
                }),
                signal: abortControllerRef.current.signal,
            });

            if (!res.ok) throw new Error('Falha na comunicação');
            if (!res.body) throw new Error('Corpo da resposta vazio');

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedContent = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine.startsWith('data: ')) {
                        try {
                            const event = JSON.parse(trimmedLine.slice(6));

                            if (event.type === 'tool') {
                                setMessages(prev => {
                                    const next = [...prev];
                                    const lastIdx = next.length - 1;
                                    const lastMsg = next[lastIdx];
                                    if (!lastMsg || lastMsg.role !== 'assistant') return prev;

                                    const currentTools = lastMsg.intelligence_tools_used || [];
                                    const existingIdx = currentTools.findIndex((t: any) => t.tool === event.tool);

                                    const newTools = [...currentTools];
                                    if (existingIdx >= 0) {
                                        newTools[existingIdx] = event;
                                    } else {
                                        newTools.push(event);
                                    }

                                    next[lastIdx] = { ...lastMsg, intelligence_tools_used: newTools };
                                    return next;
                                });
                            }
                            else if (event.type === 'discovery') {
                                setExtractedProfile(prev => ({ ...prev, [event.field]: event.value }));
                            }
                            else if (event.type === 'content') {
                                accumulatedContent = event.text;
                                setMessages(prev => {
                                    const next = [...prev];
                                    const lastIdx = next.length - 1;
                                    const lastMsg = next[lastIdx];
                                    if (!lastMsg || lastMsg.role !== 'assistant') return prev;
                                    next[lastIdx] = { ...lastMsg, streamTarget: accumulatedContent };
                                    return next;
                                });
                                setStreamingIdx(prev => prev === null ? (messages.length + 1) : prev);
                            }
                            else if (event.type === 'result') {
                                const data = event.data;
                                if (data?.ready_for_analysis) setReadyForAnalysis(true);
                                if (data?.extracted_profile) setExtractedProfile(prev => ({ ...prev, ...data.extracted_profile }));
                            }
                        } catch (e) {
                            console.error('Error parsing SSE event', e);
                        }
                    }
                }
            }

            // Finalize streaming
            setMessages(prev => {
                const lastIdx = prev.length - 1;
                if (prev[lastIdx]?.role === 'assistant') {
                    const next = [...prev];
                    next[lastIdx] = {
                        ...next[lastIdx],
                        content: next[lastIdx].streamTarget || next[lastIdx].content,
                        streamTarget: undefined
                    };
                    return next;
                }
                return prev;
            });
            setStreamingIdx(null);

        } catch (err: any) {
            if (err.name === 'AbortError') return;
            setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: 'Ops, tive um problema. Poderia repetir?' }]);
        } finally {
            setSending(false);
        }
    };

    const handleConfirmResearch = () => {
        setHasPendingResearch(false);
        sendMessage('Sim, pode realizar a pesquisa detalhada agora para avançarmos.');
    };

    const handleRejectResearch = () => {
        setHasPendingResearch(false);
        sendMessage('Prefiro definir os detalhes eu mesmo por enquanto.');
    };

    const startAnalysis = () => {
        onProfileReady(extractedProfile);
    };

    const onVoiceSuccess = useCallback((text: string) => {
        setInput(text);
        if (inputRef.current) {
            inputRef.current.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }, []);

    const {
        state: voiceState,
        interimText,
        isSupported: voiceSupported,
        toggle: toggleVoice
    } = useVoiceInput({ onTranscript: onVoiceSuccess });

    // Real progress calculation based on extracted fields
    const profileFields = Object.keys(extractedProfile).filter(k => !k.startsWith('_')).length;
    const progressValue = readyForAnalysis
        ? 100
        : Math.min(10 + (profileFields * 2.5), 90);
    const currentBusinessName = extractedProfile.nome_negocio || 'Seu Negócio';

    return (
        <div className="w-full h-full flex flex-col pt-0 relative z-10 overflow-hidden bg-white rounded-3xl p-6 border border-gray-200">
            {/* Standard Header - Matches Task Chat */}

            {/* Progress bar */}
            <div className="w-full h-[2px] shrink-0" style={{ backgroundColor: 'var(--color-border)' }}>
                <div
                    className="h-full transition-all duration-700 ease-out"
                    style={{ width: `${Math.min(progressValue, 100)}%`, backgroundColor: 'var(--color-accent)' }}
                />
            </div>



            {/* Content Area - Using AutoScrollContainer */}
            <div className="flex-1 relative overflow-hidden w-full">
                <AutoScrollContainer>
                    <div className="w-full space-y-8 px-8 pt-8 pb-64 max-w-4xl mx-auto text-start">
                        {messages.map((msg, i) => {
                            const isThinking = msg.content === '...' && !msg.streamTarget;
                            const isStreaming = streamingIdx === i && !!msg.streamTarget;

                            if (isThinking) {
                                return <ShimmerRow key={i} label="Analisando contexto..." />;
                            }

                            if (msg.role === 'user') {
                                return (
                                    <div key={i} className="flex gap-3 flex-row-reverse" style={{ animation: 'fade-in-up 0.15s ease-out' }}>
                                        <div className="flex-1 text-right">
                                            <div
                                                className="inline-block text-left rounded-2xl rounded-tr-md px-4 py-2"
                                                style={{
                                                    backgroundColor: '#f3f4f6',
                                                }}
                                            >
                                                <p className="text-[14px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--color-text-secondary)' }}>{msg.content}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }

                            const hasSources = (msg.searchSources?.length ?? 0) > 0;
                            const contentToRender = isStreaming ? (msg.streamTarget || '') : (msg.content || msg.streamTarget || '');

                            return (
                                <div key={i} className="w-full space-y-4 pt-4 first:pt-0" style={{ animation: 'fade-in-up 0.5s ease-out forwards' }}>
                                    {hasSources && (
                                        <div className="mb-2">
                                            <SourceBadgeList
                                                sources={msg.searchSources || []}
                                                maxVisible={4}
                                                animated={isStreaming}
                                            />
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between gap-2">
                                        {((msg.tokens ?? 0) > 0 || msg.actual_provider) && (
                                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100/50 backdrop-blur-sm border border-slate-200 font-sans">
                                                {msg.actual_provider && (
                                                    <div className="flex items-center gap-1.5 mr-1 border-r border-slate-200 pr-2">
                                                        <img
                                                            src={
                                                                msg.actual_provider === 'gemini' ? '/gemini.png' :
                                                                    msg.actual_provider === 'groq' ? '/groq llama.svg' :
                                                                        msg.actual_provider === 'sambanova' ? '/sambanova.png' :
                                                                            msg.actual_provider === 'deepseek' ? '/deepseek.png' :
                                                                                msg.actual_provider === 'cerebras' ? '/cerebras.png' :
                                                                                    '/openrouter.png'
                                                            }
                                                            className="w-3.5 h-3.5 rounded-sm object-contain"
                                                            alt={msg.actual_provider}
                                                            style={{ filter: 'none' }}
                                                        />
                                                        <span className="text-[10px] font-bold text-slate-700 capitalize">{msg.actual_provider}</span>
                                                    </div>
                                                )}
                                                <Zap className="w-3 h-3 text-amber-500" />
                                                <span className="text-[10px] font-mono font-bold text-slate-500">{msg.tokens || 0} unit</span>
                                            </div>
                                        )}
                                    </div>

                                    <IntelligenceToolsBadges
                                        tools={msg.intelligence_tools_used}
                                        isRunning={isStreaming}
                                    />

                                    <div className="space-y-3">
                                        {isStreaming ? (
                                            <StreamingText
                                                text={contentToRender}
                                                speed={6}
                                                className="text-[14px] leading-relaxed"
                                                onDone={() => finalizeStreaming(i)}
                                            />
                                        ) : (
                                            <div className="text-[14px] leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>
                                                <MarkdownContent content={msg.content} />
                                            </div>
                                        )}
                                    </div>

                                    {!isStreaming && i === messages.length - 1 && hasPendingResearch && !sending && (
                                        <div className="flex flex-wrap items-center gap-2 mt-4">
                                            <button
                                                onClick={handleConfirmResearch}
                                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold transition-all duration-150 active:scale-95 shadow-sm"
                                                style={{ backgroundColor: 'var(--color-accent)', color: 'white' }}
                                            >
                                                <Check className="w-3.5 h-3.5" />Concordo, pesquisar
                                            </button>
                                            <button
                                                onClick={handleRejectResearch}
                                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold transition-all duration-150 active:scale-95 border border-slate-200"
                                                style={{ backgroundColor: 'white', color: 'var(--color-text-secondary)' }}
                                            >
                                                <X className="w-3.5 h-3.5" />Definir eu mesmo
                                            </button>
                                        </div>
                                    )}

                                    {i < messages.length - 1 && (
                                        <div className="h-px w-full bg-slate-100 mt-8" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </AutoScrollContainer>
            </div>

            {/* Simplified Floating Input Card - Matches Task Card style */}
            <div
                className="absolute bottom-6 left-6 right-6 flex flex-col gap-0 backdrop-blur-3xl rounded-[32px] overflow-hidden z-[100] border-2 border-gray-200 shadow-xl"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.98)' }}
            >
                <div className="w-full p-4 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-3 w-full">
                        <div className="flex flex-col gap-1 flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <h1 className="text-[14px] font-bold tracking-tight leading-tight line-clamp-1" style={{ color: 'var(--color-text-primary)' }}>
                                    {sending ? 'IA Processando...' : currentBusinessName}
                                </h1>
                                {readyForAnalysis && <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0"><Check size={9} className="text-white" strokeWidth={4} /></div>}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-medium" style={{ color: 'var(--color-text-tertiary)' }}>
                                <span className="opacity-40">#{messages.length} Passos</span>
                                <div className="w-1 h-1 rounded-full bg-black/10" />
                                <span>Agente Estratégico</span>
                            </div>
                        </div>

                        {/* Right side icons/actions */}
                        <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center gap-1.5 bg-black/5 hover:bg-black/10 transition-colors px-1.5 py-1.5 rounded-xl border border-black/5 group cursor-pointer">
                                <Search size={15} className="text-gray-400 group-hover:text-gray-600 transition" />
                                <Zap size={15} className="text-gray-400 group-hover:text-gray-600 transition" />
                                <X size={15} className="text-gray-400 group-hover:text-gray-600 transition" />
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 pt-2 border-t border-black/5">
                        {readyForAnalysis ? (
                            <div className="flex flex-col gap-3">
                                <p className="text-[12px] text-gray-500 font-medium">Todos os dados necessários foram coletados. Deseja iniciar a análise profunda?</p>
                                <button
                                    onClick={startAnalysis}
                                    className="flex items-center justify-center gap-2 h-11 px-6 rounded-2xl bg-black text-white text-[14px] font-bold shadow-xl shadow-black/20 hover:-translate-y-0.5 transition-all active:scale-95 group"
                                >
                                    <Zap className="w-4 h-4 fill-amber-400 text-amber-400 group-hover:scale-125 transition-transform" />
                                    <span>Iniciar Análise Estratégica</span>
                                </button>
                            </div>
                        ) : (
                            <div className="relative group">
                                <textarea
                                    ref={inputRef}
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            sendMessage();
                                        }
                                    }}
                                    placeholder="Descreva seu negócio ou responda à pergunta acima..."
                                    className="w-full bg-transparent border-0 ring-0 focus:ring-0 focus:ring-transparent focus:ring-offset-0 outline-none focus:outline-none text-[14px] placeholder:text-gray-400 text-gray-700 min-h-[44px] max-h-32 py-2 resize-none transition-all pr-24 shadow-none border-transparent focus:border-transparent appearance-none"
                                    style={{ outline: 'none !important', boxShadow: 'none !important' } as any}
                                    rows={1}
                                />
                                <div className="absolute right-0 bottom-0 flex items-center gap-1 p-1">
                                    <VoiceButton
                                        state={voiceState}
                                        interimText={interimText}
                                        isSupported={voiceSupported}
                                        onToggle={toggleVoice}
                                    />
                                    <button
                                        onClick={() => sendMessage()}
                                        disabled={!input.trim() || sending}
                                        className="w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 disabled:opacity-30 shadow-sm"
                                        style={{
                                            backgroundColor: input.trim() ? 'var(--color-accent)' : 'var(--color-surface-hover)',
                                            color: input.trim() ? 'white' : 'var(--color-text-muted)',
                                        }}
                                    >
                                        {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} className={input.trim() ? 'translate-x-0.5 -translate-y-0.5' : ''} />}
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-between mt-1">
                            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200 scale-90 origin-left shadow-sm">
                                <ModelSelector value={aiModel} onChange={setAiModel} />
                                <div className="w-[1px] h-3 bg-black/10" />
                                <LLMUsageIndicator provider={aiModel} />
                            </div>
                            <div className="flex items-center gap-2">
                                <VoiceInterimBadge text={interimText} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx global>{`
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                @keyframes fade-in-up {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                /* Global focus ring removal */
                *:focus, *:active, *:focus-visible, [data-focus], .focus-ring {
                    outline: none !important;
                    box-shadow: none !important;
                    --tw-ring-offset-width: 0px !important;
                    --tw-ring-width: 0px !important;
                    --tw-ring-color: transparent !important;
                    border-color: transparent !important;
                }
                textarea:focus, input:focus {
                    background-color: transparent !important;
                }
            `}</style>
        </div>
    );
};

export default GrowthChat;
