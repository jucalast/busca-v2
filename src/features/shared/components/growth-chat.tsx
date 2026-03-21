'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    Send, Loader2, Check, X, Globe, Search,
    ChevronDown, ChevronUp, User as UserIcon, Play, Zap, ArrowLeft,
    Building2, Target, Landmark, Users, Sparkles, ArrowUp
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
import LoadingDots from './LoadingDots';
import { useSidebar } from '@/contexts/SidebarContext';

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
    onReadyStateChange?: (ready: boolean) => void;
    loading?: boolean;
}

const ShimmerRow: React.FC<{ label?: string; isDark?: boolean }> = ({ label, isDark }) => (
    <div className="flex gap-3 animate-pulse opacity-60">
        <div className={`w-7 h-7 rounded-full flex-shrink-0 ${isDark ? 'bg-white/10' : 'bg-slate-100'}`} />
        <div className="flex-1 space-y-2 py-1">
            <div className={`h-3 w-40 rounded ${isDark ? 'bg-white/10' : 'bg-slate-100'}`} />
            <div className={`h-2 w-full rounded ${isDark ? 'bg-white/5' : 'bg-slate-50'}`} />
        </div>
    </div>
);

const GrowthChat: React.FC<GrowthChatProps> = ({ onProfileReady, onProfileUpdate, onReadyStateChange, loading = false }) => {
    const { aiModel, setAiModel } = useAuth();
    const { isDark } = useSidebar();
    const [hasInteracted, setHasInteracted] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [streamingIdx, setStreamingIdx] = useState<number | null>(null);

    // Initialize AI greeting with streaming
    useEffect(() => {
        if (hasInteracted && messages.length === 0) {
            const greeting = 'Olá! Sou seu estrategista de negócios. Para começarmos sua análise de forma automática, **poderia me informar o CNPJ da sua empresa?** (Se não tiver, não tem problema, podemos ir conversando!)';
            setMessages([
                {
                    role: 'assistant',
                    content: '',
                    streamTarget: greeting
                }
            ]);
            setStreamingIdx(0);
        }
    }, [hasInteracted, messages.length]);

    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [extractedProfile, setExtractedProfile] = useState<ExtractedProfile>({});
    const [readyForAnalysis, setReadyForAnalysis] = useState(false);
    const [hasPendingResearch, setHasPendingResearch] = useState(false);

    // Sync state with parent
    useEffect(() => {
        onReadyStateChange?.(readyForAnalysis);
    }, [readyForAnalysis, onReadyStateChange]);

    useEffect(() => {
        onProfileUpdate?.(extractedProfile);
    }, [extractedProfile, onProfileUpdate]);

    const abortControllerRef = useRef<AbortController | null>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Notify parent of profile updates
    useEffect(() => {
        if (onProfileUpdate) {
            onProfileUpdate(extractedProfile);
        }
    }, [extractedProfile, onProfileUpdate]);

    // Notify parent of readiness
    useEffect(() => {
        if (onReadyStateChange) {
            onReadyStateChange(readyForAnalysis);
        }
    }, [readyForAnalysis, onReadyStateChange]);

    // Focus input only when actually chatting
    useEffect(() => {
        if (hasInteracted && inputRef.current) {
            inputRef.current.focus();
        }
    }, [hasInteracted]);

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
        if (!hasInteracted) setHasInteracted(true);
        setSending(true);

        const newUserMsg: Message = { role: 'user', content: text };
        const initialAiMsg: Message = { role: 'assistant', content: '', intelligence_tools_used: [] };
        const aiMsgIdx = messages.length + 1;
        setMessages(prev => [...prev, newUserMsg, initialAiMsg]);

        try {
            abortControllerRef.current = new AbortController();

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
                                accumulatedContent += event.text; // Accumulate content
                                setMessages(prev => {
                                    const next = [...prev];
                                    const lastMsg = next[aiMsgIdx];
                                    if (!lastMsg || lastMsg.role !== 'assistant') return prev;
                                    next[aiMsgIdx] = { ...lastMsg, streamTarget: accumulatedContent };
                                    return next;
                                });
                                setStreamingIdx(aiMsgIdx);
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

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }, [messages, sending]);

    // Real progress calculation based on extracted fields
    const profileFields = Object.keys(extractedProfile).filter(k => !k.startsWith('_')).length;
    const progressValue = readyForAnalysis
        ? 100
        : Math.min(10 + (profileFields * 2.5), 90);
    const currentBusinessName = extractedProfile.nome_negocio || 'Seu Negócio';


    return (
        <div className={`w-full max-w-4xl flex-1 h-full flex flex-col relative pt-0 transition-all duration-1000 ease-in-out ${!hasInteracted ? 'justify-center pt-24' : 'justify-start'}`}>

            {!hasInteracted && (
                <div className="text-center max-w-4xl mb-16 animate-in fade-in slide-in-from-bottom-12 duration-1000 mx-auto px-4 relative">
                    <h1 className={`text-6xl md:text-[5.5rem] font-black tracking-tighter italic leading-[0.85] uppercase py-2 transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        VAMOS ENTENDER <br />
                        <span className="text-[#8b5cf6] pr-10">
                            O SEU NEGÓCIO
                        </span>
                    </h1>
                    <p className={`mt-8 text-xl md:text-2xl font-medium max-w-2xl mx-auto leading-relaxed opacity-90 tracking-tight transition-colors duration-300 ${isDark ? 'text-zinc-400' : 'text-gray-400'}`}>
                        Mapeamos o DNA da sua empresa para gerar o seu <span className={`font-bold ${isDark ? 'text-zinc-200' : 'text-gray-900'}`}>diagnóstico completo</span> em segundos.
                    </p>
                </div>
            )}
            {/* Standard Header - Matches Task Chat */}




            {/* Content Area - Scrollable message list */}
            {hasInteracted && (
                <div className="flex-1 w-full overflow-y-auto scrollbar-hide space-y-8 px-6 pt-12 pb-10 max-w-3xl mx-auto text-start">
                    {messages.map((msg, i) => {
                        const isThinking = msg.content === '...' && !msg.streamTarget;
                        const isStreaming = streamingIdx === i && !!msg.streamTarget;

                        if (isThinking) {
                            return <ShimmerRow key={i} label="Analisando contexto..." isDark={isDark} />;
                        }

                        if (msg.role === 'user') {
                            return (
                                <div key={i} className="flex gap-3 flex-row-reverse" style={{ animation: 'fade-in-up 0.15s ease-out' }}>
                                    <div className="flex-1 text-right">
                                        <div
                                            className="inline-block text-left rounded-2xl px-6 py-4 shadow-sm backdrop-blur-md bg-white/5 border-0"
                                        >
                                            <p className="text-[18px] font-medium leading-relaxed whitespace-pre-wrap text-zinc-100">{msg.content}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        const hasSources = (msg.searchSources?.length ?? 0) > 0;
                        const contentToRender = isStreaming ? (msg.streamTarget || '') : (msg.content || msg.streamTarget || '');

                        return (
                            <div key={i} className="w-full space-y-5 pt-8 first:pt-0" style={{ animation: 'fade-in-up 0.5s ease-out forwards' }}>
                                {hasSources && (
                                    <div className="mb-3">
                                        <SourceBadgeList
                                            sources={msg.searchSources || []}
                                            maxVisible={4}
                                            animated={isStreaming}
                                        />
                                    </div>
                                )}

                                <div className="flex items-center justify-between gap-2">
                                    {((msg.tokens ?? 0) > 0 || msg.actual_provider) && (
                                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded font-sans shadow-sm border transition-colors duration-300 ${isDark ? 'bg-white/5 border-white/10' : 'border-gray-100 bg-white'
                                            }`}>
                                            {msg.actual_provider && (
                                                <div className={`flex items-center gap-1.5 mr-1 pr-2 border-r transition-colors duration-300 ${isDark ? 'border-white/10' : 'border-gray-100'}`}>
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
                                                    <span className={`text-[9px] font-bold capitalize tracking-tight ${isDark ? 'text-white/60' : 'text-gray-600'}`}>{msg.actual_provider}</span>
                                                </div>
                                            )}
                                            <Zap className="w-3 h-3 text-amber-500" />
                                            <span className={`text-[9px] font-mono font-bold ${isDark ? 'text-white/40' : 'text-gray-400'}`}>{msg.tokens || 0}</span>
                                        </div>
                                    )}
                                </div>

                                <IntelligenceToolsBadges
                                    tools={msg.intelligence_tools_used}
                                    isRunning={isStreaming || (sending && i === messages.length - 1)}
                                />

                                <div className="space-y-4">
                                    {isStreaming ? (
                                        <StreamingText
                                            text={contentToRender}
                                            speed={6}
                                            className={`text-[18px] md:text-[20px] leading-relaxed transition-colors duration-300 ${isDark ? 'text-zinc-200' : 'text-gray-800'}`}
                                            onDone={() => finalizeStreaming(i)}
                                        />
                                    ) : (
                                        <div className={`text-[18px] md:text-[20px] leading-relaxed font-medium transition-colors duration-300 ${isDark ? 'text-zinc-200' : 'text-gray-800'}`}>
                                            <MarkdownContent content={msg.content} />
                                        </div>
                                    )}
                                </div>
                                {!isStreaming && i === messages.length - 1 && hasPendingResearch && !sending && (
                                    <div className="flex flex-wrap items-center gap-2.5 mt-6">
                                        <button
                                            onClick={handleConfirmResearch}
                                            className={`flex items-center gap-1.5 h-7 px-4 rounded-lg text-[11px] font-bold transition-all duration-150 active:scale-95 shadow-sm ${
                                                isDark ? 'bg-white text-black hover:bg-zinc-200' : 'bg-black text-white hover:bg-zinc-800'
                                            }`}
                                        >
                                            <Check className="w-3.5 h-3.5" />Concordar, pesquisar
                                        </button>
                                        <button
                                            onClick={handleRejectResearch}
                                            className={`flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] font-medium transition-all duration-150 active:scale-95 border ${
                                                isDark
                                                ? 'bg-zinc-800/50 border-white/5 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                                                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-black'
                                            }`}
                                        >
                                            <X className="w-3.5 h-3.5" />Definir eu mesmo
                                        </button>
                                    </div>
                                )}

                                 {/* Removed divider for cleaner look */}
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} className="h-4" />
                </div>
            )}

            {/* Bottom Floating Input Area - Fixed at bottom */}
            <div className={`${hasInteracted ? 'pb-6 pt-2 bg-transparent' : 'relative'} w-full max-w-3xl mx-auto z-[100] px-4 transition-all duration-1000 cubic-bezier(0.4, 0, 0.2, 1)`}>
                <div
                    className={`flex flex-col gap-0 backdrop-blur-3xl rounded-[24px] overflow-hidden border transition-all duration-300 ${
                        isDark ? 'bg-zinc-900/90 border-white/10 shadow-2xl' : 'bg-gray-200/98 border-gray-300 shadow-xl'
                    }`}
                >
                    {/* Input Header Section (Matches FocusedTaskView sub header style) */}
                    <div className={`w-full px-5 py-2 flex items-center justify-between relative border-b ${
                        isDark ? 'bg-white/5 border-white/5' : 'bg-white/20 border-black/5'
                    }`}>
                        {/* Integrated Progress Bar at the very top of the bar */}
                        <div className={`absolute top-0 left-0 right-0 h-[2px] overflow-hidden ${isDark ? 'bg-white/5' : 'bg-black/5'
                            }`}>
                            <div
                                className="h-full bg-[#8b5cf6] transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(139,92,246,0.5)]"
                                style={{ width: `${Math.min(progressValue, 100)}%` }}
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${sending ? (isDark ? 'bg-white' : 'bg-zinc-900') : (isDark ? 'bg-white/10' : 'bg-black/10')} ${sending ? 'animate-pulse' : ''}`} />
                            <h1 className={`text-[11px] font-bold uppercase tracking-[0.15em] leading-none ${isDark ? 'text-white/60' : 'text-gray-500'
                                }`}>
                                {sending ? 'Processando resposta...' : currentBusinessName}
                            </h1>
                        </div>
                        <div className="flex items-center gap-3">
                            {readyForAnalysis && (
                                <div className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 uppercase tracking-tighter">
                                    DNA Pronto
                                </div>
                            )}
                            <div className="flex items-center gap-1.5 opacity-80">
                                <span className={`text-[10px] font-bold uppercase tracking-[0.1em] leading-none ${isDark ? 'text-white/50' : 'text-gray-400'
                                    }`}>DNA Progress</span>
                                <span className="text-[10px] font-bold text-[#8b5cf6]">{Math.round(progressValue)}%</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col p-5 pb-4 gap-5">
                        {readyForAnalysis ? (
                            <div className={`flex items-center justify-between gap-3 rounded-2xl p-2 border transition-colors duration-300 ${isDark ? 'bg-purple-500/10 border-purple-500/20' : 'bg-purple-50/50 border-purple-100/50'
                                }`}>
                                <p className={`text-[12px] font-medium px-2 ${isDark ? 'text-purple-300/70' : 'text-purple-800/70'}`}>Perfil estratégico completo. Pronto para iniciar análise profunda?</p>
                                <button
                                    onClick={startAnalysis}
                                    className={`flex items-center justify-center gap-1.5 h-9 px-5 rounded-xl text-[12px] font-bold shadow-sm transition-all active:scale-95 ${isDark ? 'bg-[#8b5cf6] text-white hover:bg-[#7c3aed]' : 'bg-white text-black hover:bg-gray-100'
                                        }`}
                                >
                                    <Zap className={`w-4 h-4 ${isDark ? 'text-amber-400 fill-amber-400' : 'text-amber-300 fill-amber-300'}`} />
                                    <span className="uppercase tracking-tight">Iniciar Agora</span>
                                </button>
                            </div>
                        ) : (
                            <div className="relative group">
                                <textarea
                                    ref={inputRef}
                                    value={input}
                                    onFocus={() => {
                                        if (!hasInteracted) setHasInteracted(true);
                                    }}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            sendMessage();
                                        }
                                    }}
                                    placeholder="Descreva seu negócio ou responda à pergunta..."
                                    className={`w-full bg-transparent border-0 ring-0 focus:ring-0 focus:ring-transparent focus:ring-offset-0 outline-none focus:outline-none text-[16px] font-medium min-h-[48px] max-h-32 py-3 resize-none transition-all pr-24 shadow-none border-transparent focus:border-transparent appearance-none ${isDark ? 'placeholder:text-white/40 text-slate-100' : 'placeholder:text-gray-400 text-gray-900'
                                        }`}
                                    style={{ outline: 'none !important', boxShadow: 'none !important' } as any}
                                    rows={1}
                                />
                                <div className="absolute right-0 bottom-0 top-0 flex items-center gap-2.5 p-2">
                                    <VoiceButton
                                        state={voiceState}
                                        interimText={interimText}
                                        isSupported={voiceSupported}
                                        onToggle={toggleVoice}
                                    />
                                    <button
                                        onClick={() => sendMessage()}
                                        disabled={!input.trim() || sending}
                                        className="w-11 h-11 flex items-center justify-center rounded-full transition-all duration-300 shadow-xl group/send"
                                        style={{
                                            backgroundColor: input.trim() ? '#8b5cf6' : (isDark ? '#27272a' : '#f4f4f5'),
                                            color: input.trim() ? '#ffffff' : (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'),
                                            border: 'none',
                                        }}
                                    >
                                        {sending ? (
                                            <LoadingDots
                                                color="white"
                                                dotClassName="w-1 h-1"
                                                className="flex items-center gap-1"
                                            />
                                        ) : (
                                            <ArrowUp size={22} strokeWidth={3} className="transition-transform" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}

                        {!readyForAnalysis && (
                            <div className={`flex items-center justify-between pt-3 border-t ${isDark ? 'border-white/5' : 'border-gray-100'
                                }`}>
                                <div className={`flex items-center gap-2.5 px-2.5 py-1 rounded-xl border scale-[0.9] origin-left backdrop-blur-md ${isDark ? 'bg-white/5 border-white/5' : 'bg-gray-100/50 border-gray-100'
                                    }`}>
                                    <ModelSelector value={aiModel} onChange={setAiModel} darkMode={isDark} />
                                    <div className={`w-px h-3 ${isDark ? 'bg-white/10' : 'bg-gray-200'}`} />
                                    <LLMUsageIndicator provider={aiModel} />
                                </div>
                                <div className="flex items-center gap-2 pr-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                                    <span className={`text-[10px] font-black uppercase tracking-[0.15em] ${isDark ? 'text-white/50' : 'text-gray-400'
                                        }`}>Growth Engine Active</span>
                                </div>
                            </div>
                        )}
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
