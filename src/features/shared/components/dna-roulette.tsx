'use client';

import React from 'react';
import { useSidebar } from '@/contexts/SidebarContext';

interface DNARouletteProps {
    profile: any;
    progress: number;
    isReady: boolean;
}

export const DNARoulette: React.FC<DNARouletteProps> = ({ profile, progress, isReady }) => {
    const { isDark } = useSidebar();

    const fields = React.useMemo(() => [
        { key: 'cnpj',               label: 'CNPJ',          altKeys: [] as string[] },
        { key: 'nome_negocio',        label: 'Empresa',       altKeys: ['nome'] },
        { key: 'segmento',            label: 'Segmento',      altKeys: [] as string[] },
        { key: 'localizacao',         label: 'Localização',   altKeys: ['cidade_estado'] },
        { key: 'modelo',              label: 'Modelo',        altKeys: ['modelo_negocio'] },
        { key: 'dificuldades',        label: 'Desafios',      altKeys: ['problemas'] },
        { key: 'objetivos',           label: 'Metas',         altKeys: ['metas', 'objetivo'] },
        { key: 'ticket_medio',        label: 'Ticket',        altKeys: ['ticket_medio_estimado'] },
        { key: 'equipe',              label: 'Equipe',        altKeys: ['num_funcionarios'] },
        { key: 'faturamento',         label: 'Faturamento',   altKeys: ['faturamento_mensal', 'faturamento_faixa'] },
        { key: 'tipo_produto',        label: 'Produtos',      altKeys: ['tipo_oferta'] },
        { key: 'site',                label: 'Website',       altKeys: ['site_url'] },
        { key: 'instagram',           label: 'Instagram',     altKeys: ['instagram_handle'] },
        { key: 'whatsapp',            label: 'WhatsApp',      altKeys: ['whatsapp_numero'] },
        { key: 'linkedin',            label: 'LinkedIn',      altKeys: ['linkedin_url'] },
        { key: 'google_maps',         label: 'Google Maps',   altKeys: ['google_maps_url'] },
        { key: 'email_contato',       label: 'E-mail',        altKeys: [] as string[] },
        { key: 'diferencial',         label: 'Diferencial',   altKeys: [] as string[] },
        { key: 'concorrentes',        label: 'Concorrência',  altKeys: [] as string[] },
        { key: 'canais',              label: 'Canais',        altKeys: ['canais_venda'] },
        { key: 'investimento',        label: 'Investimento',  altKeys: ['investimento_marketing'] },
        { key: 'margem',              label: 'Margem',        altKeys: ['margem_lucro'] },
        { key: 'capital_disponivel',  label: 'Capital',       altKeys: [] as string[] },
        { key: 'fornecedores',        label: 'Fornecedores',  altKeys: [] as string[] },
        { key: 'tipo_cliente',        label: 'Público',       altKeys: ['perfil_cliente'] },
        { key: 'regiao_atendimento',  label: 'Região',        altKeys: [] as string[] },
        { key: 'origem_clientes',     label: 'Origem Leads',  altKeys: [] as string[] },
        { key: 'maior_objecao',       label: 'Objeções',      altKeys: [] as string[] },
        { key: 'gargalos',            label: 'Gargalos',      altKeys: [] as string[] },
        { key: 'clientes',            label: 'Cliente Ideal', altKeys: [] as string[] },
        { key: 'capacidade_produtiva',label: 'Capacidade',    altKeys: [] as string[] },
        { key: 'tempo_operacao',      label: 'Tempo',         altKeys: ['tempo_mercado'] },
        { key: 'tempo_entrega',       label: 'Prazo',         altKeys: ['lead_time'] },
        { key: 'modelo_operacional',  label: 'Operação',      altKeys: [] as string[] },
    ], []);

    /** Check if a value is "real" (not junk) */
    const isRealValue = (v: any): boolean => {
        if (!v) return false;
        const s = String(v).trim().toLowerCase();
        return s.length > 0 && !['null','none','n/a','.','..','...','?'].includes(s);
    };

    /** Resolve a value from the flat profile */
    const getFieldValue = React.useCallback((field: typeof fields[0]): string | null => {
        const flat = profile || {};
        // Check main key
        if (flat[field.key] && isRealValue(flat[field.key])) return String(flat[field.key]);
        // Check alt keys
        for (const ak of field.altKeys) {
            if (flat[ak] && isRealValue(flat[ak])) return String(flat[ak]);
        }
        // Check nested perfil
        const perfil = flat.perfil;
        if (perfil) {
            if (perfil[field.key] && isRealValue(perfil[field.key])) return String(perfil[field.key]);
            for (const ak of field.altKeys) {
                if (perfil[ak] && isRealValue(perfil[ak])) return String(perfil[ak]);
            }
        }
        return null;
    }, [profile, fields]);

    // ── Scroll / Arc ────────────────────────────────────────────────────────
    const ITEM_SPACING = 38;
    const SUB_TICKS = 6;
    const TOTAL_STEPS = fields.length * SUB_TICKS;
    const STEP_SPACING = ITEM_SPACING / SUB_TICKS;
    const RADIUS = -160;
    const CENTER_X = 230;

    const [scrollPos, setScrollPos] = React.useState(0);
    const scrollTarget = React.useRef(0);
    const lastWheelTime = React.useRef(0);
    const [containerHeight, setContainerHeight] = React.useState(800);
    const containerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (!containerRef.current) return;
        const ro = new ResizeObserver(([e]) => setContainerHeight(e.contentRect.height));
        ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, []);

    const handleWheel = React.useCallback((e: React.WheelEvent) => {
        if (Math.abs(e.deltaY) < 2) return;
        scrollTarget.current = Math.max(0, Math.min(
            scrollTarget.current + e.deltaY * 0.36,
            (fields.length - 1) * ITEM_SPACING
        ));
        lastWheelTime.current = Date.now();
    }, [fields.length, ITEM_SPACING]);

    React.useEffect(() => {
        let id: number;
        const tick = () => {
            if (Date.now() - lastWheelTime.current > 120) {
                const snap = Math.round(scrollTarget.current / ITEM_SPACING) * ITEM_SPACING;
                scrollTarget.current += (snap - scrollTarget.current) * 0.22;
            }
            setScrollPos(prev => {
                const d = scrollTarget.current - prev;
                return Math.abs(d) < 0.02 ? scrollTarget.current : prev + d * 0.75;
            });
            id = requestAnimationFrame(tick);
        };
        id = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(id);
    }, [ITEM_SPACING]);

    const selectedIndex = Math.round(scrollPos / ITEM_SPACING);

    // ── Track which fields are filled (snapshot) ────────────────────────────
    /** Build a set of field indices that currently have values */
    const buildFilledSet = React.useCallback((): Set<number> => {
        const set = new Set<number>();
        for (let i = 0; i < fields.length; i++) {
            if (getFieldValue(fields[i])) set.add(i);
        }
        return set;
    }, [fields, getFieldValue]);

    // ── Auto-scroll to newly discovered field ───────────────────────────────
    const [flashIdx, setFlashIdx] = React.useState<number | null>(null);
    const prevFilledRef = React.useRef<Set<number> | null>(null);
    const isFirstRender = React.useRef(true);

    React.useEffect(() => {
        const currentFilled = buildFilledSet();

        // On first render, just store the snapshot — don't animate
        if (isFirstRender.current || prevFilledRef.current === null) {
            prevFilledRef.current = currentFilled;
            isFirstRender.current = false;
            return;
        }

        // Find the FIRST field that is NOW filled but WASN'T before
        let newFieldIdx = -1;
        for (const idx of currentFilled) {
            if (!prevFilledRef.current.has(idx)) {
                newFieldIdx = idx;
                break;
            }
        }

        // Update snapshot for next comparison
        prevFilledRef.current = currentFilled;

        if (newFieldIdx >= 0) {
            // Scroll to the new field
            scrollTarget.current = newFieldIdx * ITEM_SPACING;
            lastWheelTime.current = 0;

            // Flash animation
            setFlashIdx(newFieldIdx);
            const t = setTimeout(() => setFlashIdx(null), 2500);
            return () => clearTimeout(t);
        }
    }, [profile, buildFilledSet, ITEM_SPACING]);

    return (
        <div
            ref={containerRef}
            className={`relative w-[340px] h-full flex flex-col overflow-hidden select-none backdrop-blur-xl border-r ${
                isDark ? 'border-white/10' : 'border-black/8'
            }`}
            onWheel={handleWheel}
        >
            {/* Fade edges */}
            <div className="absolute inset-0 z-20 pointer-events-none">
                <div className={`absolute top-0 left-0 right-0 h-28 ${isDark ? 'bg-gradient-to-b from-zinc-950/80' : 'bg-gradient-to-b from-white/80'} to-transparent`} />
                <div className={`absolute bottom-0 left-0 right-0 h-28 ${isDark ? 'bg-gradient-to-t from-zinc-950/80' : 'bg-gradient-to-t from-white/80'} to-transparent`} />
            </div>

            {/* Arc items */}
            <div className="flex-1 relative overflow-hidden">
                <div className="absolute inset-0 z-10 pointer-events-none">
                    {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
                        const pos = i * STEP_SPACING;
                        const isTick = i % SUB_TICKS === 0;
                        const fieldIdx = Math.floor(i / SUB_TICKS);
                        const field = isTick ? fields[fieldIdx] : null;

                        const offset = pos - scrollPos;
                        if (Math.abs(offset) > 480) return null;

                        const angle = offset / 140;
                        const isFocused = isTick && fieldIdx === selectedIndex;
                        const isFlashing = isTick && fieldIdx === flashIdx;
                        const isFilled = isTick && field ? !!getFieldValue(field) : false;

                        const baseOpacity = Math.max(0.07, 1 - Math.abs(angle) * 0.55);
                        const finalOpacity = isFocused ? 1 : isFilled ? Math.min(baseOpacity * 1.4, 0.75) : Math.min(baseOpacity, 0.45);

                        const x = CENTER_X + Math.cos(angle) * RADIUS;
                        const y = (containerHeight / 2) + Math.sin(angle) * RADIUS;

                        const tickColor = isFilled
                            ? (isFocused ? 'rgba(139,92,246,1)' : 'rgba(139,92,246,0.5)')
                            : (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)');
                        const tickWidth = isFocused ? 34 : (isFilled ? 20 : (isTick ? 14 : 6));
                        const tickGlow = isFocused && isFilled ? '0 0 14px rgba(139,92,246,0.9)' : 'none';

                        return (
                            <div
                                key={i}
                                className="absolute flex items-center will-change-transform"
                                style={{
                                    width: 280,
                                    transform: `translate3d(${x}px,${y}px,0) translateY(-50%) rotate(${isFocused ? 0 : angle * 0.6}rad)`,
                                    opacity: Math.max(0, finalOpacity),
                                    zIndex: isFocused ? 30 : 10,
                                    animation: isFlashing ? 'dna-pop 0.7s cubic-bezier(.175,.885,.32,1.275) 2' : undefined,
                                }}
                            >
                                {/* Tick */}
                                <div
                                    className="shrink-0 rounded-full transition-all duration-300"
                                    style={{
                                        width: tickWidth,
                                        height: 1.5,
                                        backgroundColor: tickColor,
                                        boxShadow: tickGlow,
                                    }}
                                />

                                {/* Label + value */}
                                {isTick && field && (
                                    <div className="flex items-baseline gap-2 ml-3 min-w-0 overflow-hidden">
                                        <p
                                            className="tracking-tight truncate transition-all duration-300 leading-none"
                                            style={{
                                                fontSize: isFocused ? 19 : 16,
                                                fontWeight: isFocused ? 700 : (isFilled ? 500 : 400),
                                                color: isFocused
                                                    ? (isDark ? '#f1f5f9' : '#0f172a')
                                                    : isFilled
                                                        ? (isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.6)')
                                                        : (isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.28)'),
                                            }}
                                        >
                                            {field.label}
                                        </p>

                                        {/* Filled dot (non-focused) */}
                                        {isFilled && !isFocused && (
                                            <div
                                                className="shrink-0 rounded-full"
                                                style={{ width: 5, height: 5, backgroundColor: 'rgba(139,92,246,0.6)', marginBottom: 1 }}
                                            />
                                        )}

                                        {/* Value preview (focused) */}
                                        {isFocused && isFilled && (
                                            <p
                                                className="text-[10px] truncate font-medium animate-in fade-in slide-in-from-left-1 duration-200"
                                                style={{ color: 'rgba(139,92,246,0.7)', maxWidth: 130 }}
                                            >
                                                {(() => {
                                                    const v = getFieldValue(field)!;
                                                    return v.length > 55 ? v.slice(0, 52) + '…' : v;
                                                })()}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Center guide */}
            <div
                className="absolute left-0 right-0 pointer-events-none z-[15]"
                style={{ top: '50%', transform: 'translateY(-50%)' }}
            >
                <div
                    className="mx-auto"
                    style={{
                        height: 1,
                        width: '85%',
                        background: isDark
                            ? 'linear-gradient(90deg, transparent, rgba(139,92,246,0.15) 30%, rgba(139,92,246,0.15) 70%, transparent)'
                            : 'linear-gradient(90deg, transparent, rgba(139,92,246,0.1) 30%, rgba(139,92,246,0.1) 70%, transparent)',
                    }}
                />
            </div>

            <style jsx global>{`
                @keyframes dna-pop {
                    0%   { filter: brightness(1)   drop-shadow(0 0 0px rgba(139,92,246,0)); }
                    45%  { filter: brightness(1.4)  drop-shadow(0 0 18px rgba(139,92,246,0.5)); }
                    100% { filter: brightness(1)   drop-shadow(0 0 0px rgba(139,92,246,0)); }
                }
            `}</style>
        </div>
    );
};
