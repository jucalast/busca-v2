'use client';

import React from 'react';

// ==============================================================================
// Types
// ==============================================================================

interface PersonaData {
    nome: string;
    cargo: string;
    empresa_tipo: string;
    idade: string;
    narrativa: string;
}

interface DorData {
    dor: string;
    evidencia: string;
    fonte_tipo: string;
    oportunidade: string;
}

interface InteligenciaCriativaData {
    o_que_concorrentes_fazem: string[];
    lacunas: string[];
    formatos_que_funcionam: string[];
}

interface PosicionamentoData {
    frase: string;
    diferencial_central: string;
    angulo_ataque: string;
}

interface HookData {
    titulo: string;
    copy: string;
    angulo: string;
    formato_sugerido: string;
}

interface AcaoData {
    prioridade: number;
    acao: string;
    como: string;
    prazo: string;
    impacto_esperado: string;
}

interface BusinessReportProps {
    data: {
        businessMode: boolean;
        expansao?: {
            termos_tecnicos: string[];
            concorrentes: string[];
            quem_compra: string[];
            dores_provaveis: string[];
            jtbd: { funcional: string; emocional: string; social: string };
        };
        persona?: PersonaData;
        mapa_dores?: DorData[];
        inteligencia_criativa?: InteligenciaCriativaData;
        posicionamento?: PosicionamentoData;
        hooks_anuncio?: HookData[];
        plano_acao?: AcaoData[];
        allSources?: string[];
        meta?: { total_fontes: number; dimensoes_buscadas: number; fases_completadas: number };
        erro?: string;
    };
}

// ==============================================================================
// Main Component
// ==============================================================================

const BusinessReport: React.FC<BusinessReportProps> = ({ data }) => {
    if (data.erro) {
        return (
            <div className="p-6 rounded-2xl bg-red-950/30 border border-red-900/50 text-red-200 text-center">
                <p className="text-lg font-semibold mb-2">Erro na Análise</p>
                <p>{data.erro}</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Report Header */}
            <div className="text-center space-y-3">
                <div className="inline-block px-4 py-1.5 rounded-full bg-emerald-950/50 border border-emerald-800/50">
                    <span className="text-emerald-400 text-sm font-semibold tracking-wider uppercase">
                        Inteligência de Mercado Agêntica
                    </span>
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-white">
                    Relatório Estratégico Integrado
                </h2>
                <p className="text-zinc-500 text-sm">
                    {data.meta?.total_fontes || 0} fontes · {data.meta?.dimensoes_buscadas || 0} dimensões · {data.meta?.fases_completadas || 0} fases de análise
                </p>
            </div>

            {/* Persona Section */}
            {data.persona && data.persona.nome && (
                <PersonaCard persona={data.persona} />
            )}

            {/* Posicionamento Section */}
            {data.posicionamento && data.posicionamento.frase && (
                <PosicionamentoCard pos={data.posicionamento} />
            )}

            {/* Pain Map Section */}
            {data.mapa_dores && data.mapa_dores.length > 0 && (
                <DoresSection dores={data.mapa_dores} />
            )}

            {/* Creative Intelligence Section */}
            {data.inteligencia_criativa && (
                <CriativosSection ic={data.inteligencia_criativa} />
            )}

            {/* Ad Hooks Section */}
            {data.hooks_anuncio && data.hooks_anuncio.length > 0 && (
                <HooksSection hooks={data.hooks_anuncio} />
            )}

            {/* Action Plan Section */}
            {data.plano_acao && data.plano_acao.length > 0 && (
                <PlanoSection acoes={data.plano_acao} />
            )}

            {/* Sources */}
            {data.allSources && data.allSources.length > 0 && (
                <SourcesSection sources={data.allSources} />
            )}
        </div>
    );
};

// ==============================================================================
// Persona Card — "Avatar" do comprador
// ==============================================================================

const PersonaCard: React.FC<{ persona: PersonaData }> = ({ persona }) => {
    const [expanded, setExpanded] = React.useState(false);

    return (
        <div className="bg-gradient-to-br from-violet-950/40 to-zinc-950 border border-violet-800/30 rounded-3xl overflow-hidden">
            <div className="p-6 md:p-8">
                <div className="flex items-start gap-5 mb-5">
                    {/* Avatar */}
                    <div className="w-16 h-16 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-3xl flex-shrink-0">
                        🧑‍💼
                    </div>
                    <div>
                        <p className="text-xs text-violet-400 uppercase tracking-wider font-semibold mb-1">Persona Sintética — Seu Cliente Ideal</p>
                        <h3 className="text-xl font-bold text-white">{persona.nome}</h3>
                        <p className="text-zinc-400 text-sm mt-1">
                            {persona.cargo} · {persona.empresa_tipo} · {persona.idade}
                        </p>
                    </div>
                </div>

                {/* Narrative */}
                <div className="relative">
                    <div className={`bg-zinc-900/60 rounded-2xl p-5 border-l-4 border-violet-500/50 transition-all duration-500 ${expanded ? '' : 'max-h-40 overflow-hidden'}`}>
                        <p className="text-zinc-300 leading-relaxed text-[15px] whitespace-pre-line italic">
                            &ldquo;{persona.narrativa}&rdquo;
                        </p>
                    </div>
                    {!expanded && (
                        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-zinc-950 to-transparent rounded-b-2xl" />
                    )}
                </div>
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="mt-3 text-violet-400 hover:text-violet-300 text-sm font-medium transition-colors"
                >
                    {expanded ? '▲ Recolher' : '▼ Ler narrativa completa'}
                </button>
            </div>
        </div>
    );
};

// ==============================================================================
// Posicionamento Card
// ==============================================================================

const PosicionamentoCard: React.FC<{ pos: PosicionamentoData }> = ({ pos }) => {
    return (
        <div className="bg-gradient-to-r from-emerald-950/40 to-zinc-950 border border-emerald-800/30 rounded-3xl p-6 md:p-8">
            <p className="text-xs text-emerald-400 uppercase tracking-wider font-semibold mb-4">🎯 Posicionamento de Marca</p>

            {/* Main phrase */}
            <div className="bg-zinc-900/60 rounded-2xl p-6 mb-5 border border-emerald-800/20">
                <p className="text-xl md:text-2xl font-bold text-white text-center leading-snug">
                    &ldquo;{pos.frase}&rdquo;
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-zinc-900/40 rounded-xl p-4">
                    <p className="text-[11px] text-emerald-400/70 uppercase tracking-wider mb-2 font-semibold">Diferencial Central</p>
                    <p className="text-zinc-300 text-sm leading-relaxed">{pos.diferencial_central}</p>
                </div>
                <div className="bg-zinc-900/40 rounded-xl p-4">
                    <p className="text-[11px] text-red-400/70 uppercase tracking-wider mb-2 font-semibold">Ângulo de Ataque</p>
                    <p className="text-zinc-300 text-sm leading-relaxed">{pos.angulo_ataque}</p>
                </div>
            </div>
        </div>
    );
};

// ==============================================================================
// Dores Section — Pain Map
// ==============================================================================

const DoresSection: React.FC<{ dores: DorData[] }> = ({ dores }) => {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">😤</span>
                <div>
                    <h3 className="text-lg font-bold text-white">Mapa de Dores do Consumidor</h3>
                    <p className="text-xs text-zinc-500">Frustrações reais encontradas na internet — oportunidades para você</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dores.map((dor, idx) => (
                    <div key={idx} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 hover:border-red-900/40 transition-colors">
                        <div className="flex items-start justify-between mb-3">
                            <p className="text-white font-semibold text-[15px] flex-1">{dor.dor}</p>
                            <span className="text-[10px] bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full ml-2 flex-shrink-0">
                                {dor.fonte_tipo}
                            </span>
                        </div>
                        <div className="bg-zinc-900/60 rounded-xl p-3 mb-3 border-l-2 border-red-500/40">
                            <p className="text-zinc-400 text-sm italic">&ldquo;{dor.evidencia}&rdquo;</p>
                        </div>
                        <div className="flex items-start gap-2">
                            <span className="text-emerald-400 text-xs mt-0.5">💡</span>
                            <p className="text-emerald-300/80 text-sm">{dor.oportunidade}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ==============================================================================
// Creative Intelligence Section
// ==============================================================================

const CriativosSection: React.FC<{ ic: InteligenciaCriativaData }> = ({ ic }) => {
    return (
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 md:p-8 space-y-6">
            <div className="flex items-center gap-3">
                <span className="text-2xl">🎨</span>
                <div>
                    <h3 className="text-lg font-bold text-white">Inteligência Criativa</h3>
                    <p className="text-xs text-zinc-500">O que seus concorrentes fazem e onde estão as oportunidades</p>
                </div>
            </div>

            {/* What competitors do */}
            {ic.o_que_concorrentes_fazem && ic.o_que_concorrentes_fazem.length > 0 && (
                <div>
                    <p className="text-[11px] text-amber-400 uppercase tracking-wider font-semibold mb-2">O que a concorrência faz</p>
                    <ul className="space-y-2">
                        {ic.o_que_concorrentes_fazem.map((item, idx) => (
                            <li key={idx} className="flex gap-3 items-start">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500/60 mt-2 flex-shrink-0" />
                                <span className="text-zinc-300 text-sm">{item}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Gaps / Blue Ocean  */}
            {ic.lacunas && ic.lacunas.length > 0 && (
                <div className="bg-emerald-950/20 rounded-2xl p-5 border border-emerald-800/20">
                    <p className="text-[11px] text-emerald-400 uppercase tracking-wider font-semibold mb-2">🌊 Oceano Azul — Ninguém faz isso bem</p>
                    <ul className="space-y-2">
                        {ic.lacunas.map((item, idx) => (
                            <li key={idx} className="flex gap-3 items-start">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/60 mt-2 flex-shrink-0" />
                                <span className="text-emerald-200 text-sm font-medium">{item}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Formats that work */}
            {ic.formatos_que_funcionam && ic.formatos_que_funcionam.length > 0 && (
                <div>
                    <p className="text-[11px] text-blue-400 uppercase tracking-wider font-semibold mb-2">Formatos que funcionam no setor</p>
                    <div className="flex flex-wrap gap-2">
                        {ic.formatos_que_funcionam.map((f, idx) => (
                            <span key={idx} className="px-3 py-1.5 rounded-full bg-blue-950/30 border border-blue-800/30 text-blue-300 text-xs">
                                {f}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ==============================================================================
// Ad Hooks Section — Ready-to-use copies
// ==============================================================================

const HooksSection: React.FC<{ hooks: HookData[] }> = ({ hooks }) => {
    const [copiedIdx, setCopiedIdx] = React.useState<number | null>(null);

    const copyToClipboard = (text: string, idx: number) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedIdx(idx);
            setTimeout(() => setCopiedIdx(null), 2000);
        });
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">✍️</span>
                <div>
                    <h3 className="text-lg font-bold text-white">Hooks de Anúncio Prontos</h3>
                    <p className="text-xs text-zinc-500">Copies prontos para testar no Facebook/Instagram — clique para copiar</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {hooks.map((hook, idx) => (
                    <div
                        key={idx}
                        className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 hover:border-orange-900/40 transition-all cursor-pointer group"
                        onClick={() => copyToClipboard(`${hook.titulo}\n\n${hook.copy}`, idx)}
                    >
                        <div className="flex items-start justify-between mb-3">
                            <span className="text-[10px] bg-orange-950/50 text-orange-400 px-2 py-0.5 rounded-full">
                                {hook.formato_sugerido}
                            </span>
                            <span className="text-xs text-zinc-600 group-hover:text-orange-400 transition-colors">
                                {copiedIdx === idx ? '✅ Copiado!' : '📋 Copiar'}
                            </span>
                        </div>

                        <h4 className="text-white font-bold text-lg mb-2 leading-tight">{hook.titulo}</h4>
                        <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-line mb-3">{hook.copy}</p>

                        <p className="text-[11px] text-zinc-600">
                            Ângulo: <span className="text-zinc-400">{hook.angulo}</span>
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ==============================================================================
// Action Plan Section
// ==============================================================================

const PlanoSection: React.FC<{ acoes: AcaoData[] }> = ({ acoes }) => {
    // Sort by priority
    const sorted = [...acoes].sort((a, b) => (a.prioridade || 99) - (b.prioridade || 99));

    const prazoColor = (prazo: string) => {
        const p = prazo.toLowerCase();
        if (p.includes('semana')) return 'text-emerald-400 bg-emerald-950/30 border-emerald-800/30';
        if (p.includes('2 sem') || p.includes('quinzena')) return 'text-amber-400 bg-amber-950/30 border-amber-800/30';
        return 'text-blue-400 bg-blue-950/30 border-blue-800/30';
    };

    return (
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
                <span className="text-2xl">📋</span>
                <div>
                    <h3 className="text-lg font-bold text-white">Plano de Ação</h3>
                    <p className="text-xs text-zinc-500">Próximos passos priorizados — comece por cima</p>
                </div>
            </div>

            <div className="space-y-4">
                {sorted.map((acao, idx) => (
                    <div key={idx} className="flex gap-4 items-start">
                        {/* Priority badge */}
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-1">
                            {acao.prioridade || idx + 1}
                        </div>

                        <div className="flex-1 bg-zinc-900/40 rounded-xl p-4">
                            <div className="flex items-start justify-between gap-3 mb-2">
                                <p className="text-white font-semibold text-[15px]">{acao.acao}</p>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full border flex-shrink-0 ${prazoColor(acao.prazo)}`}>
                                    {acao.prazo}
                                </span>
                            </div>
                            <p className="text-zinc-400 text-sm mb-2">{acao.como}</p>
                            <p className="text-emerald-400/70 text-xs">
                                📈 {acao.impacto_esperado}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ==============================================================================
// Sources Section
// ==============================================================================

const SourcesSection: React.FC<{ sources: string[] }> = ({ sources }) => {
    const [showAll, setShowAll] = React.useState(false);
    const visible = showAll ? sources : sources.slice(0, 12);

    return (
        <div className="bg-zinc-950/50 border border-zinc-800 rounded-3xl p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
                    Fontes Consultadas
                </h3>
                <span className="bg-zinc-900 text-zinc-500 px-3 py-1 rounded-full text-xs font-mono">
                    {sources.length}
                </span>
            </div>

            <div className="flex flex-wrap gap-2">
                {visible.map((source, idx) => {
                    let hostname = source;
                    try { hostname = new URL(source).hostname; } catch { /* ignore */ }
                    return (
                        <a
                            key={idx}
                            href={source}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900/80 text-xs text-zinc-500 hover:text-emerald-400 hover:bg-zinc-800 transition-all border border-zinc-800/50"
                        >
                            <span className="w-1 h-1 rounded-full bg-current" />
                            {hostname}
                        </a>
                    );
                })}
            </div>

            {sources.length > 12 && (
                <button
                    onClick={() => setShowAll(!showAll)}
                    className="mt-3 text-zinc-500 hover:text-zinc-300 text-xs transition-colors"
                >
                    {showAll ? '▲ Mostrar menos' : `▼ Ver todas (${sources.length})`}
                </button>
            )}
        </div>
    );
};

export default BusinessReport;
