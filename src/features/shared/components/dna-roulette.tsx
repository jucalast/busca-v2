'use client';

import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useSidebar } from '@/contexts/SidebarContext';

interface DNARouletteProps {
    profile: any;
    progress: number;
    isReady: boolean;
}

export const DNARoulette: React.FC<DNARouletteProps> = ({ profile, progress, isReady }) => {
    const { isDark } = useSidebar();
    const fields = React.useMemo(() => [
        { key: 'cnpj', label: 'CNPJ', altKeys: ['CNPJ'] },
        { key: 'nome', label: 'Empresa', altKeys: ['nome_negocio', 'empresa'] },
        { key: 'segmento', label: 'Segmento' },
        { key: 'localizacao', label: 'Localização', altKeys: ['cidade_estado'] },
        { key: 'modelo_negocio', label: 'Modelo', altKeys: ['modelo'] },
        { key: 'tipo_oferta', label: 'Oferta', altKeys: ['tipo_produto'] },
        { key: 'porte', label: 'Porte' },
        { key: 'tempo_mercado', label: 'Tempo', altKeys: ['tempo_operacao'] },
        { key: 'ticket_medio_estimado', label: 'Ticket', altKeys: ['ticket_medio'] },
        { key: 'faturamento_faixa', label: 'Faturamento', altKeys: ['faturamento_mensal', 'faturamento'] },
        { key: 'num_funcionarios', label: 'Equipe', altKeys: ['equipe'] },
        { key: 'investimento_marketing', label: 'Investimento', altKeys: ['investimento'] },
        { key: 'site_url', label: 'Website', altKeys: ['site'] },
        { key: 'instagram_handle', label: 'Instagram', altKeys: ['instagram'] },
        { key: 'linkedin_url', label: 'LinkedIn', altKeys: ['linkedin'] },
        { key: 'whatsapp_numero', label: 'WhatsApp', altKeys: ['whatsapp'] },
        { key: 'google_maps_url', label: 'Google Maps', altKeys: ['google_maps'] },
        { key: 'email_contato', label: 'E-mail', altKeys: ['email'] },
        { key: 'dificuldades', label: 'Gargalos' },
        { key: 'concorrentes', label: 'Concorrência' },
    ], []);

    const getFieldValue = (field: any) => {
        if (profile[field.key]) return profile[field.key];
        if (field.altKeys) {
            for (const ak of field.altKeys) {
                if (profile[ak]) return profile[ak];
            }
        }
        if (profile.perfil) {
            if (profile.perfil[field.key]) return profile.perfil[field.key];
            if (field.altKeys) {
                for (const ak of field.altKeys) {
                    if (profile.perfil[ak]) return profile.perfil[ak];
                }
            }
        }
        return null;
    };

    const ITEM_SPACING = 36;
    const subTicksPerField = 8;
    const totalSteps = fields.length * subTicksPerField;
    const STEP_SPACING = ITEM_SPACING / subTicksPerField;
    const RADIUS = -150;  // Deep, intense curvature
    const CENTER_X = 220; // Pushed further left for better visibility
    const [scrollPos, setScrollPos] = React.useState(Math.floor(fields.length / 2) * ITEM_SPACING);
    const scrollTarget = React.useRef(scrollPos);
    const lastWheelTime = React.useRef(0);
    const [containerHeight, setContainerHeight] = React.useState(800);
    const containerRef = React.useRef<HTMLDivElement>(null);

    // Measure height to keep arc centered
    React.useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver((entries) => {
            if (entries[0]) setContainerHeight(entries[0].contentRect.height);
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    // Pro-Grade Continuous Scroll: High sensitivity and physical feel
    const handleWheel = React.useCallback((e: React.WheelEvent) => {
        if (Math.abs(e.deltaY) < 2) return; // ignore sub-pixel jitters

        // Calibrated for 36px spacing
        scrollTarget.current += e.deltaY * 0.36;

        // Clamp bounds
        const maxScroll = (fields.length - 1) * ITEM_SPACING;
        scrollTarget.current = Math.max(0, Math.min(scrollTarget.current, maxScroll));
        lastWheelTime.current = Date.now();
    }, [fields.length, ITEM_SPACING]);

    // Fast Snapping Engine
    React.useEffect(() => {
        let frameId: number;
        const animate = () => {
            const now = Date.now();

            // Auto-snap to closest item when inactive for 100ms
            if (now - lastWheelTime.current > 100) {
                const closestIdx = Math.round(scrollTarget.current / ITEM_SPACING);
                const snapTarget = closestIdx * ITEM_SPACING;
                scrollTarget.current += (snapTarget - scrollTarget.current) * 0.25;
            }

            setScrollPos(prev => {
                const diff = scrollTarget.current - prev;
                if (Math.abs(diff) < 0.01) return scrollTarget.current;
                // aggressive lerp for "instant" but animated feel
                return prev + diff * 0.8;
            });

            frameId = requestAnimationFrame(animate);
        };
        frameId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(frameId);
    }, []);

    const selectedIndex = Math.round(scrollPos / ITEM_SPACING);

    return (
        <div
            ref={containerRef}
            className={`relative w-[350px] h-full flex flex-col overflow-hidden select-none backdrop-blur-xl border-r ${
                isDark ? 'border-white/10' : 'border-gray-300'
            }`}
            onWheel={handleWheel}
        >
            {/* Premium Glass Effect - Overlays removed for requested clarity */}

            <div className="flex-1 relative overflow-hidden">
                <div className="absolute inset-0 z-10 pointer-events-none">
                    {Array.from({ length: totalSteps }).map((_, i) => {
                        const currentItemPos = i * STEP_SPACING;
                        const isMainField = i % subTicksPerField === 0;
                        const fieldIdx = i / subTicksPerField;
                        const field = isMainField ? fields[fieldIdx] : null;

                        const scrollOffset = currentItemPos - scrollPos;
                        // Performance Cull: Skip items far outside the arc
                        if (Math.abs(scrollOffset) > 500) return null;

                        const angle = (scrollOffset / 130);
                        const isFocused = isMainField && fieldIdx === selectedIndex;

                        const baseOpacity = Math.max(0.1, 1 - Math.abs(angle) * 0.5);
                        const finalOpacity = isFocused ? 1 : Math.min(baseOpacity, 0.6);

                        const x = CENTER_X + Math.cos(angle) * RADIUS;
                        const y = (containerHeight / 2) + Math.sin(angle) * RADIUS;

                        return (
                            <div
                                key={`tick-${i}`}
                                className="absolute flex items-center w-[260px] will-change-transform"
                                style={{
                                    transform: `translate3d(${x}px, ${y}px, 0) translateY(-50%) rotate(${isFocused ? 0 : angle}rad)`,
                                    opacity: Math.max(0, finalOpacity),
                                    zIndex: isFocused ? 30 : 10
                                }}
                            >
                                <div className="flex flex-row items-center justify-start gap-3 w-full">
                                    {/* Dash/Tick - Now leading on the left side of the word */}
                                    <div className="shrink-0 flex items-center">
                                        <div
                                            className={`h-[1.5px] transition-all duration-300 rounded-full ${
                                                isDark ? 'bg-white/40' : 'bg-black/40'
                                            } ${isMainField ? 'w-6 opacity-50' : 'w-2 opacity-30'
                                                } ${isFocused ? 'opacity-100' : ''}`}
                                        />
                                    </div>

                                    {/* Label logic - Following the dash to the right */}
                                    {isMainField && field && (
                                        <div className="flex flex-col items-start min-w-0">
                                            <p className={`tracking-[0.01em] truncate transition-all duration-300 ${
                                                isFocused 
                                                    ? (isDark ? 'text-slate-100 font-semibold text-[18px]' : 'text-gray-900 font-semibold text-[18px]') 
                                                    : (isDark ? 'text-white/40 text-[18px]' : 'text-gray-400 text-[18px]')
                                            }`}>
                                                {field.label}
                                            </p>
                                            {getFieldValue(field) && isFocused && (
                                                <p className={`text-[10px] -mt-0.5 animate-in fade-in slide-in-from-left-2 ${
                                                    isDark ? 'text-white/50' : 'text-gray-500'
                                                }`}>
                                                    {typeof getFieldValue(field) === 'string' ? getFieldValue(field) : 'Mapeado'}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
