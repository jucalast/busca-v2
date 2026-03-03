'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

// ─── Local Speech Recognition types (Web Speech API) ─────────────────────
// Defined locally so the hook compiles regardless of tsconfig "types" overrides.
interface ISpeechAlternative { readonly transcript: string; readonly confidence: number; }
interface ISpeechResult {
    readonly isFinal: boolean; readonly length: number;
    item(i: number): ISpeechAlternative; [i: number]: ISpeechAlternative;
}
interface ISpeechResultList {
    readonly length: number;
    item(i: number): ISpeechResult; [i: number]: ISpeechResult;
}
interface ISpeechEvent extends Event { readonly resultIndex: number; readonly results: ISpeechResultList; }
interface ISpeechErrorEvent extends Event { readonly error: string; }
interface ISpeechRecognition extends EventTarget {
    lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
    onstart: ((ev: Event) => void) | null;
    onend: ((ev: Event) => void) | null;
    onspeechend: ((ev: Event) => void) | null;
    onresult: ((ev: ISpeechEvent) => void) | null;
    onerror: ((ev: ISpeechErrorEvent) => void) | null;
    start(): void; stop(): void; abort(): void;
}
type ISpeechRecognitionCtor = new () => ISpeechRecognition;
declare global {
    interface Window {
        SpeechRecognition?: ISpeechRecognitionCtor;
        webkitSpeechRecognition?: ISpeechRecognitionCtor;
    }
}

// ─── Public types ─────────────────────────────────────────────────────────
export type VoiceState = 'idle' | 'listening' | 'processing' | 'error' | 'unsupported';

interface UseVoiceInputOptions {
    /** Called with the final transcript when speech ends */
    onTranscript: (text: string) => void;
    /** Language for recognition — defaults to pt-BR */
    lang?: string;
    /** Max silence after last speech before auto-stop (ms) — defaults to 2000 */
    silenceTimeout?: number;
}

interface UseVoiceInputReturn {
    state: VoiceState;
    interimText: string;
    start: () => void;
    stop: () => void;
    toggle: () => void;
    isSupported: boolean;
}

export function useVoiceInput({
    onTranscript,
    lang = 'pt-BR',
    silenceTimeout = 2000,
}: UseVoiceInputOptions): UseVoiceInputReturn {
    const [state, setState] = useState<VoiceState>('idle');
    const [interimText, setInterimText] = useState('');
    const recognitionRef = useRef<ISpeechRecognition | null>(null);
    const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const finalTranscriptRef = useRef('');
    const isSupported = typeof window !== 'undefined' &&
        ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

    const clearSilenceTimer = () => {
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }
    };

    const stop = useCallback(() => {
        clearSilenceTimer();
        recognitionRef.current?.stop();
    }, []);

    const start = useCallback(() => {
        if (!isSupported) {
            setState('unsupported');
            return;
        }

        const SpeechRecognitionAPI =
            window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognitionAPI) { setState('unsupported'); return; }

        const recognition = new SpeechRecognitionAPI();
        recognition.lang = lang;
        recognition.interimResults = true;
        recognition.continuous = true;
        recognition.maxAlternatives = 1;

        finalTranscriptRef.current = '';

        recognition.onstart = () => {
            setState('listening');
            setInterimText('');
        };

        recognition.onresult = (event: ISpeechEvent) => {
            clearSilenceTimer();

            let interim = '';
            let final = finalTranscriptRef.current;

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    final += result[0].transcript;
                } else {
                    interim += result[0].transcript;
                }
            }

            finalTranscriptRef.current = final;
            setInterimText(interim);

            // Auto-stop after silence
            silenceTimerRef.current = setTimeout(() => {
                recognition.stop();
            }, silenceTimeout);
        };

        recognition.onspeechend = () => {
            clearSilenceTimer();
        };

        recognition.onend = () => {
            clearSilenceTimer();
            setState('processing');
            setInterimText('');
            const transcript = finalTranscriptRef.current.trim();
            if (transcript) {
                onTranscript(transcript);
            }
            setState('idle');
            recognitionRef.current = null;
        };

        recognition.onerror = (event: ISpeechErrorEvent) => {
            clearSilenceTimer();
            if (event.error === 'aborted' || event.error === 'no-speech') {
                setState('idle');
            } else {
                setState('error');
                setTimeout(() => setState('idle'), 2500);
            }
            recognitionRef.current = null;
        };

        recognitionRef.current = recognition;
        try {
            recognition.start();
        } catch {
            setState('error');
            setTimeout(() => setState('idle'), 2500);
        }
    }, [isSupported, lang, onTranscript, silenceTimeout]);

    const toggle = useCallback(() => {
        if (state === 'listening') {
            stop();
        } else if (state === 'idle') {
            start();
        }
    }, [state, start, stop]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            clearSilenceTimer();
            recognitionRef.current?.abort();
        };
    }, []);

    return { state, interimText, start, stop, toggle, isSupported };
}
