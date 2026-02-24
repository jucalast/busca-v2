'use client';

import React from 'react';
import {
    Users, Award, Palette, ShoppingBag, Search, Megaphone, HandCoins,
    ChevronRight, Loader2, BarChart3, CheckCircle2, Clock,
    AlertTriangle, ArrowRight, Shield, Zap
} from 'lucide-react';

const PILLARS: Record<string, {
    icon: React.ComponentType<any>;
    label: string;
    cargo: string;
    color: string;
}> = {
    publico_alvo:      { icon: Users,      label: 'Público-Alvo',       cargo: 'Analista de Inteligência',  color: '#8b5cf6' },
    branding:          { icon: Award,      label: 'Branding',           cargo: 'Estrategista de Marca',     color: '#f59e0b' },
    identidade_visual: { icon: Palette,    label: 'Identidade Visual',  cargo: 'Diretor de Criação',        color: '#ec4899' },
    canais_venda:      { icon: ShoppingBag, label: 'Canais de Venda',   cargo: 'Gerente de Canais',         color: '#3b82f6' },
    trafego_organico:  { icon: Search,     label: 'Tráfego Orgânico',   cargo: 'Especialista SEO',          color: '#10b981' },
    trafego_pago:      { icon: Megaphone,  label: 'Tráfego Pago',       cargo: 'Gestor de Performance',     color: '#f97316' },
    processo_vendas:   { icon: HandCoins,  label: 'Processo de Vendas',  cargo: 'Consultor Comercial',       color: '#6366f1' },
};

const PILLAR_ORDER = [
    'publico_alvo', 'branding', 'identidade_visual', 'canais_venda',
    'trafego_organico', 'trafego_pago', 'processo_vendas',
];

interface SpecialistDiag {
    score: number;
    status: string;
    meta_pilar: string;
    dado_chave: string;
}

interface PlanStatus {
    pillar_key: string;
    status: string; // 'pending' | 'approved'
    approved_at?: string;
}

interface SpecialistDashboardProps {
    score: any;
    specialists: Record<string, SpecialistDiag>;
    pillarPlans: Record<string, PlanStatus>;
    userProfile: { name: string; segment: string };
    analysisId: string | null;
    onSelectPillar: (pillarKey: string) => void;
    onViewDiagnostic: () => void;
    onRedo: () => void;
    loadingPillar: string | null;
}

function MiniScoreRing({ score, size = 40 }: { score: number; size?: number }) {
    const r = (size - 5) / 2;
    const c = 2 * Math.PI * r;
    const s = Math.max(0, Math.min(100, score));
    const offset = c - (s / 100) * c;
    const color = s >= 70 ? '#10b981' : s >= 40 ? '#f59e0b' : '#ef4444';
    return (
        <div className="relative inline-flex" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="3"
                    strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
                    className="transition-all duration-700" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[11px] font-bold text-white">{s}</span>
            </div>
        </div>
    );
}

function StatusBadge({ status, planStatus }: { status: string; planStatus?: string }) {
    if (planStatus === 'approved') {
        return (
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-2.5 h-2.5" /> Aprovado
            </span>
        );
    }
    if (planStatus === 'pending') {
        return (
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Clock className="w-2.5 h-2.5" /> Plano gerado
            </span>
        );
    }
    if (status === 'critico') {
        return (
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                <AlertTriangle className="w-2.5 h-2.5" /> Crítico
            </span>
        );
    }
    if (status === 'atencao') {
        return (
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <AlertTriangle className="w-2.5 h-2.5" /> Atenção
            </span>
        );
    }
    return (
        <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Shield className="w-2.5 h-2.5" /> Forte
        </span>
    );
}

export default function SpecialistDashboard({
    score,
    specialists,
    pillarPlans,
    userProfile,
    analysisId,
    onSelectPillar,
    onViewDiagnostic,
    onRedo,
    loadingPillar,
}: SpecialistDashboardProps) {
    const scoreGeral = score?.score_geral || 0;

    return (
        <div className="min-h-screen bg-[#09090b]">
            <div className="w-full max-w-5xl mx-auto px-6 py-10">

                {/* Header */}
                <div className="flex items-start justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">{userProfile.name}</h1>
                        <p className="text-zinc-500 mt-1 text-sm">{userProfile.segment}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onViewDiagnostic}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl text-zinc-500 hover:text-zinc-300 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-all text-xs"
                        >
                            <BarChart3 className="w-3.5 h-3.5" />
                            Score Detalhado
                        </button>
                        <MiniScoreRing score={scoreGeral} />
                    </div>
                </div>

                {/* Intro Card */}
                <div className="p-5 rounded-2xl bg-[#111113] border border-white/[0.06] mb-6">
                    <div className="flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20 flex-shrink-0">
                            <Zap className="w-4 h-4 text-violet-400" />
                        </div>
                        <div>
                            <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.15em] mb-1">7 Especialistas trabalhando para você</p>
                            <p className="text-zinc-400 text-sm leading-relaxed">
                                Cada pilar do seu negócio tem um especialista dedicado. Clique em um pilar para ver o
                                plano profissional e começar a executar com acompanhamento de resultados.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Section Label */}
                <p className="text-xs font-semibold text-zinc-600 uppercase tracking-[0.2em] mb-4">
                    Seus especialistas
                </p>

                {/* Pillar Cards */}
                <div className="space-y-3">
                    {PILLAR_ORDER.map((key) => {
                        const meta = PILLARS[key];
                        if (!meta) return null;
                        const Icon = meta.icon;
                        const diag = specialists[key];
                        const pillarScore = diag?.score ?? (score?.dimensoes?.[key]?.score ?? 0);
                        const status = diag?.status ?? (score?.dimensoes?.[key]?.status ?? 'atencao');
                        const dadoChave = diag?.dado_chave ?? (score?.dimensoes?.[key]?.dado_chave ?? '');
                        const metaPilar = diag?.meta_pilar ?? (score?.dimensoes?.[key]?.meta_pilar ?? '');
                        const planInfo = pillarPlans[key];
                        const isLoading = loadingPillar === key;

                        return (
                            <button
                                key={key}
                                onClick={() => !isLoading && onSelectPillar(key)}
                                disabled={isLoading}
                                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[#111113] border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.02] transition-all text-left group disabled:opacity-60"
                            >
                                {/* Icon */}
                                <div
                                    className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                                    style={{ backgroundColor: `${meta.color}12`, border: `1px solid ${meta.color}22` }}
                                >
                                    <Icon style={{ color: meta.color, width: 18, height: 18 }} />
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <p className="text-white text-sm font-semibold">{meta.label}</p>
                                        <StatusBadge status={status} planStatus={planInfo?.status} />
                                    </div>
                                    <p className="text-zinc-600 text-[11px] mb-1">{meta.cargo}</p>
                                    {dadoChave && (
                                        <p className="text-zinc-500 text-xs leading-relaxed truncate">{dadoChave}</p>
                                    )}
                                    {metaPilar && !dadoChave && (
                                        <p className="text-zinc-500 text-xs leading-relaxed truncate">Meta: {metaPilar}</p>
                                    )}
                                </div>

                                {/* Score + Arrow */}
                                <div className="flex items-center gap-3 flex-shrink-0">
                                    <MiniScoreRing score={pillarScore} size={36} />
                                    {isLoading ? (
                                        <Loader2 className="w-4 h-4 text-zinc-600 animate-spin" />
                                    ) : (
                                        <ArrowRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400 transition-colors" />
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
