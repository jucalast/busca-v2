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
    onProfileUpdate?: (profile: ExtractedProfile) => void;
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

const GrowthChat: React.FC<GrowthChatProps> = ({ onProfileReady, onProfileUpdate, loading = false }) => {
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

    // Notify parent of profile updates
    useEffect(() => {
        if (onProfileUpdate) {
            onProfileUpdate(extractedProfile);
        }
    }, [extractedProfile, onProfileUpdate]);

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
        <div className="w-full h-full flex flex-col pt-0 relative z-10 overflow-hidden bg-transparent">
            {/* Standard Header - Matches Task Chat */}

            {/* Progress bar */}
            <div className="w-full h-[1px] shrink-0" style={{ backgroundColor: 'var(--color-border)' }}>
                <div
                    className="h-full transition-all duration-700 ease-out"
                    style={{ width: `${Math.min(progressValue, 100)}%`, backgroundColor: 'var(--color-accent)' }}
                />
            </div>



            {/* Content Area - Using AutoScrollContainer */}
            <div className="flex-1 relative overflow-hidden w-full">
                <AutoScrollContainer>
                    <div className="w-full space-y-8 px-6 pt-8 pb-48 max-w-3xl mx-auto text-start">
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
                                                className="inline-block text-left rounded-xl rounded-tr-sm px-4 py-2 shadow-sm border border-gray-100"
                                                style={{
                                                    backgroundColor: '#ffffff',
                                                }}
                                            >
                                                <p className="text-[13px] font-medium leading-relaxed whitespace-pre-wrap text-gray-700">{msg.content}</p>
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
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-gray-100 bg-white font-sans shadow-sm">
                                                {msg.actual_provider && (
                                                    <div className="flex items-center gap-1.5 mr-1 border-r border-gray-100 pr-2">
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
                                                        <span className="text-[9px] font-bold text-gray-600 capitalize tracking-tight">{msg.actual_provider}</span>
                                                    </div>
                                                )}
                                                <Zap className="w-3 h-3 text-amber-500" />
                                                <span className="text-[9px] font-mono font-bold text-gray-400">{msg.tokens || 0}</span>
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
                                                className="text-[13px] leading-relaxed text-gray-800"
                                                onDone={() => finalizeStreaming(i)}
                                            />
                                        ) : (
                                            <div className="text-[13px] leading-relaxed text-gray-800 font-medium">
                                                <MarkdownContent content={msg.content} />
                                            </div>
                                        )}
                                    </div>

                                    {!isStreaming && i === messages.length - 1 && hasPendingResearch && !sending && (
                                        <div className="flex flex-wrap items-center gap-2 mt-4">
                                            <button
                                                onClick={handleConfirmResearch}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all duration-150 active:scale-95 shadow-sm bg-blue-600 text-white hover:bg-blue-700"
                                            >
                                                <Check className="w-3.5 h-3.5" />Concordo, pesquisar
                                            </button>
                                            <button
                                                onClick={handleRejectResearch}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all duration-150 active:scale-95 border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                                            >
                                                <X className="w-3.5 h-3.5" />Definir eu mesmo
                                            </button>
                                        </div>
                                    )}

                                    {i < messages.length - 1 && (
                                        <div className="h-px w-full bg-gray-100 mt-8" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </AutoScrollContainer>
            </div>

            {/* Sticky Input Area - SaaS minimal */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#fdfdfd] via-[#fdfdfd] to-transparent pt-12">
                <div className="max-w-3xl mx-auto flex flex-col gap-2 bg-white rounded-2xl shadow-sm border border-gray-200 p-3">
                    <div className="flex items-center justify-between gap-3 px-1 mb-1">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                            <h1 className="text-[12px] font-bold text-gray-700 tracking-tight leading-none">
                                {sending ? 'Processando resposta...' : currentBusinessName}
                            </h1>
                        </div>
                        {readyForAnalysis && <div className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">Pronto</div>}
                    </div>

                    {readyForAnalysis ? (
                        <div className="flex items-center justify-between gap-3 bg-gray-50 rounded-xl p-2 border border-gray-100">
                            <p className="text-[11px] text-gray-500 font-medium px-2">DNA mapeado. Inicie a análise estratégica profunda.</p>
                            <button
                                onClick={startAnalysis}
                                className="flex items-center justify-center gap-1.5 h-8 px-4 rounded-lg bg-gray-900 text-white text-[11px] font-bold shadow-sm hover:bg-black transition-all active:scale-95"
                            >
                                <Zap className="w-3.5 h-3.5 text-amber-400" />
                                <span>Iniciar</span>
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
                                placeholder="Descreva seu negócio ou responda à pergunta..."
                                className="w-full bg-transparent border-0 ring-0 focus:ring-0 focus:ring-transparent focus:ring-offset-0 outline-none focus:outline-none text-[13px] font-medium placeholder:text-gray-400 text-gray-800 min-h-[40px] max-h-32 py-2 resize-none transition-all pr-20 shadow-none border-transparent focus:border-transparent appearance-none"
                                style={{ outline: 'none !important', boxShadow: 'none !important' } as any}
                                rows={1}
                            />
                            <div className="absolute right-0 bottom-0 top-0 flex items-center gap-1 p-1">
                                <VoiceButton
                                    state={voiceState}
                                    interimText={interimText}
                                    isSupported={voiceSupported}
                                    onToggle={toggleVoice}
                                />
                                <button
                                    onClick={() => sendMessage()}
                                    disabled={!input.trim() || sending}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 disabled:opacity-40"
                                    style={{
                                        backgroundColor: input.trim() ? '#2563eb' : '#f1f5f9',
                                        color: input.trim() ? 'white' : '#94a3b8',
                                    }}
                                >
                                    {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between px-1 mt-1">
                        <div className="flex items-center gap-2 bg-gray-50 px-2 py-1 rounded border border-gray-100 scale-[0.85] origin-left">
                            <ModelSelector value={aiModel} onChange={setAiModel} />
                            <div className="w-px h-3 bg-gray-300" />
                            <LLMUsageIndicator provider={aiModel} />
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
