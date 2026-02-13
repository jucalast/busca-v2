'use client';

import React from 'react';
import StructuredSummary from './StructuredSummary';

interface CategoryData {
    id: string;
    nome: string;
    icone: string;
    cor: string;
    query_usada: string;
    resumo: any;
    fontes: string[];
}

interface BusinessReportProps {
    data: {
        businessMode: boolean;
        descricao?: string;
        categories: CategoryData[];
        allSources: string[];
        erro?: string;
    };
}

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
        <div className="space-y-10">
            {/* Report Header */}
            <div className="text-center space-y-3">
                <div className="inline-block px-4 py-1.5 rounded-full bg-emerald-950/50 border border-emerald-800/50">
                    <span className="text-emerald-400 text-sm font-semibold tracking-wider uppercase">
                        Relatório de Inteligência
                    </span>
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-white">
                    Análise Completa do Seu Negócio
                </h2>
                <p className="text-zinc-500 text-sm max-w-2xl mx-auto">
                    {data.categories.length} categorias analisadas · {data.allSources?.length || 0} fontes consultadas
                </p>
            </div>

            {/* Categories */}
            <div className="space-y-6">
                {data.categories.map((category) => (
                    <CategoryCard key={category.id} category={category} />
                ))}
            </div>

            {/* All Sources */}
            <div className="bg-zinc-950/50 border border-zinc-800 rounded-3xl p-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-white tracking-wide">
                        TODAS AS FONTES
                    </h3>
                    <span className="bg-zinc-900 text-zinc-400 px-3 py-1 rounded-full text-xs font-mono">
                        {data.allSources?.length || 0} LINKS
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {data.allSources?.map((source: string, idx: number) => {
                        let hostname = source;
                        try { hostname = new URL(source).hostname; } catch { }
                        return (
                            <a
                                key={idx}
                                href={source}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-900/50 hover:bg-zinc-800 border border-transparent hover:border-emerald-500/30 transition-all group text-sm"
                            >
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 group-hover:animate-pulse flex-shrink-0" />
                                <span className="text-zinc-400 truncate group-hover:text-emerald-300 transition-colors">
                                    {hostname}
                                </span>
                            </a>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────
// Category Card Component — Full Width
// ─────────────────────────────────────────────

const CategoryCard: React.FC<{ category: CategoryData }> = ({ category }) => {
    const [expanded, setExpanded] = React.useState(true);
    const resumo = category.resumo || {};

    const hasError = resumo.erro;

    // Filter out template placeholders that the LLM may have copied literally
    const isTemplatePlaceholder = (text: string): boolean => {
        if (typeof text !== 'string') return false;
        const lower = text.toLowerCase().trim();
        // Matches patterns like "[ação]", "[ferramenta]", "chave", "valor concreto"
        if (/\[.+\]/.test(lower)) return true;
        if (lower === 'chave' || lower === 'valor concreto' || lower === 'valor') return true;
        if (lower.startsWith('faça [') || lower.startsWith('fato com dado')) return true;
        return false;
    };

    const filteredRecomendacoes = (resumo.recomendacoes || []).filter((r: any) => {
        const text = typeof r === 'string' ? r : r?.dado || r?.texto || '';
        return !isTemplatePlaceholder(text);
    });

    const filteredDadosRelevantes = resumo.dados_relevantes
        ? Object.fromEntries(
            Object.entries(resumo.dados_relevantes).filter(([key, value]) => {
                return !isTemplatePlaceholder(key) && !isTemplatePlaceholder(String(value));
            })
        )
        : {};

    return (
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden transition-all duration-300 hover:border-zinc-700">
            {/* Color Bar */}
            <div className="h-1.5" style={{ background: category.cor }} />

            {/* Header — clickable to toggle */}
            <div
                className="p-6 pb-0 cursor-pointer flex items-start justify-between"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-4">
                    <span className="text-3xl">{category.icone}</span>
                    <div>
                        <h3 className="text-xl font-bold text-white">{category.nome}</h3>
                        <p className="text-xs text-zinc-500 mt-1">
                            Busca: &ldquo;{category.query_usada}&rdquo; · {category.fontes?.length || 0} fontes
                        </p>
                    </div>
                </div>
                <button className="text-zinc-500 hover:text-zinc-300 transition-colors mt-1 text-lg">
                    {expanded ? '▲' : '▼'}
                </button>
            </div>

            {/* Expandable Content */}
            {expanded && (
                <div className="p-6 pt-5 space-y-5">
                    {hasError ? (
                        <div className="p-4 rounded-xl bg-red-950/20 border border-red-900/30 text-red-300 text-sm">
                            {resumo.erro}
                        </div>
                    ) : (
                        <>
                            {/* Visão Geral */}
                            {resumo.visao_geral && (
                                <div className="p-4 rounded-2xl bg-zinc-900/50 border-l-4" style={{ borderColor: category.cor }}>
                                    <p className="text-zinc-300 leading-relaxed text-[15px]">
                                        {resumo.visao_geral}
                                    </p>
                                </div>
                            )}

                            {/* Pontos Chave */}
                            {resumo.pontos_chave && Array.isArray(resumo.pontos_chave) && (
                                <div>
                                    <h4 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <span className="w-1 h-4 rounded-sm" style={{ background: category.cor }} />
                                        Pontos-Chave
                                    </h4>
                                    <ul className="space-y-2">
                                        {resumo.pontos_chave.map((ponto: any, idx: number) => {
                                            const content = typeof ponto === 'object'
                                                ? (ponto.dado || ponto.texto || ponto.nome || JSON.stringify(ponto))
                                                : ponto;

                                            // Optional: if object has 'nome' and 'dado', format nicely
                                            const formatted = (typeof ponto === 'object' && ponto.nome && ponto.dado)
                                                ? <><strong className="text-zinc-200">{ponto.nome}:</strong> {ponto.dado}</>
                                                : content;

                                            return (
                                                <li key={idx} className="flex gap-3 items-start group">
                                                    <span className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0 opacity-60" style={{ background: category.cor }} />
                                                    <span className="text-zinc-300 text-[15px] leading-relaxed">{formatted}</span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            )}

                            {/* Recomendações */}
                            {filteredRecomendacoes.length > 0 && (
                                <div className="bg-zinc-900/30 rounded-2xl p-5">
                                    <h4 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        💡 Recomendações para Você
                                    </h4>
                                    <ol className="space-y-3">
                                        {filteredRecomendacoes.map((rec: any, idx: number) => {
                                            const content = typeof rec === 'object'
                                                ? (rec.dado || rec.texto || rec.nome || JSON.stringify(rec))
                                                : rec;

                                            const formatted = (typeof rec === 'object' && rec.nome && rec.dado)
                                                ? <><strong className="text-emerald-300">{rec.nome}:</strong> {rec.dado}</>
                                                : content;

                                            return (
                                                <li key={idx} className="flex gap-3 items-start">
                                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center mt-0.5">
                                                        {idx + 1}
                                                    </span>
                                                    <span className="text-zinc-300 text-[15px] leading-relaxed">{formatted}</span>
                                                </li>
                                            );
                                        })}
                                    </ol>
                                </div>
                            )}

                            {/* Dados Relevantes */}
                            {Object.keys(filteredDadosRelevantes).length > 0 && (
                                <div>
                                    <h4 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <span className="w-1 h-4 rounded-sm" style={{ background: category.cor }} />
                                        Dados Relevantes
                                    </h4>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        {Object.entries(filteredDadosRelevantes).map(([key, value]) => {
                                            if (!value && value !== 0) return null;
                                            if (typeof value === 'object') return null;
                                            const strVal = String(value).toLowerCase();
                                            if (strVal.includes('dado não disponível') || strVal.includes('não disponível') || strVal.includes('n/a') || strVal.trim() === '') return null;

                                            const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                                            return (
                                                <div key={key} className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800/50">
                                                    <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1">{label}</p>
                                                    <p className="text-white font-semibold text-sm">{String(value)}</p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Fallback for non-standard JSON structure */}
                            {!resumo.visao_geral && !resumo.pontos_chave && !filteredRecomendacoes.length && !resumo.info && (
                                <StructuredSummary data={resumo} depth={0} />
                            )}

                            {resumo.info && (
                                <p className="text-zinc-400 italic">{resumo.info}</p>
                            )}
                        </>
                    )}

                    {/* Category Sources */}
                    {category.fontes && category.fontes.length > 0 && (
                        <div className="pt-4 border-t border-zinc-800/50">
                            <div className="flex flex-wrap gap-2">
                                {category.fontes.map((url, idx) => {
                                    let hostname = url;
                                    try { hostname = new URL(url).hostname; } catch { }
                                    return (
                                        <a
                                            key={idx}
                                            href={url}
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
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default BusinessReport;
