'use client';

import React, { useState } from 'react';
import { FileText, Search, ListChecks, Phone, Calendar, DollarSign, Copy, Check, X, Sparkles, MapPin, Lightbulb, Target, Zap, Bookmark, User, Filter, Mail, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface TaskAssistantProps {
    task: {
        id: string;
        titulo: string;
        categoria: string;
        suporte_ia: {
            tipo: string;
            descricao: string;
        };
        dados_suporte?: Record<string, string>;
    };
    profileSummary: string;
    onClose: () => void;
    onGenerate: (taskId: string) => Promise<any>;
}

const ASSIST_TYPE_META: Record<string, { icon: React.ComponentType<any>; title: string; color: string }> = {
    copywriting: { icon: FileText, title: 'Textos Gerados por IA', color: '#f59e0b' },
    analise_concorrente: { icon: Search, title: 'Análise de Concorrentes', color: '#ef4444' },
    lista_leads: { icon: ListChecks, title: 'Lista de Prospecção', color: '#8b5cf6' },
    script_abordagem: { icon: Phone, title: 'Scripts de Abordagem', color: '#3b82f6' },
    plano_conteudo: { icon: Calendar, title: 'Plano de Conteúdo', color: '#10b981' },
    precificacao: { icon: DollarSign, title: 'Simulação de Preços', color: '#ec4899' },
};

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback
            const el = document.createElement('textarea');
            el.value = text;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <button
            onClick={handleCopy}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${copied
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 border border-zinc-700'
                }`}
        >
            {copied ? (
                <><Check className="w-3 h-3" />Copiado!</>
            ) : (
                <><Copy className="w-3 h-3" />Copiar</>
            )}
        </button>
    );
}

function RenderAssistOutput({ data }: { data: any }) {
    if (!data) return null;

    const tipo = data.tipo;

    // ─── Copywriting ────
    if (tipo === 'copywriting' && data.entregas) {
        return (
            <div className="space-y-4">
                {data.estrategia && (
                    <p className="text-zinc-400 text-sm bg-zinc-900/50 rounded-xl p-3 border-l-4 border-amber-500">{data.estrategia}</p>
                )}
                {data.entregas.map((e: any, i: number) => (
                    <div key={i} className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800/50">
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-semibold text-white">{e.titulo}</h4>
                            <CopyButton text={e.conteudo} />
                        </div>
                        <div className="bg-zinc-950 rounded-xl p-4 text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap font-mono">
                            {e.conteudo}
                        </div>
                        <div className="flex gap-4 mt-2 text-xs text-zinc-500">
                            {e.onde_usar && <div className="flex items-center gap-1"><MapPin className="w-3 h-3" />{e.onde_usar}</div>}
                            {e.dicas && <div className="flex items-center gap-1"><Lightbulb className="w-3 h-3" />{e.dicas}</div>}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    // ─── Competitor Analysis ────
    if (tipo === 'analise_concorrente' && data.concorrentes) {
        return (
            <div className="space-y-4">
                {data.concorrentes.map((c: any, i: number) => (
                    <div key={i} className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800/50">
                        <div className="flex items-center gap-2 mb-3">
                            <Target className="w-4 h-4 text-red-400" />
                            <h4 className="text-sm font-bold text-white">{c.nome}</h4>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                            <div>
                                <p className="text-[10px] text-emerald-400 uppercase font-semibold mb-1">Pontos Fortes</p>
                                <ul className="space-y-1">
                                    {c.pontos_fortes?.map((p: string, j: number) => (
                                        <li key={j} className="text-xs text-zinc-300 flex gap-1.5">
                                            <span className="text-emerald-500">+</span> {p}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div>
                                <p className="text-[10px] text-red-400 uppercase font-semibold mb-1">Pontos Fracos</p>
                                <ul className="space-y-1">
                                    {c.pontos_fracos?.map((p: string, j: number) => (
                                        <li key={j} className="text-xs text-zinc-300 flex gap-1.5">
                                            <span className="text-red-500">−</span> {p}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                        {c.como_superar && (
                            <p className="text-xs text-amber-300 bg-amber-500/10 rounded-lg p-2 flex items-start gap-1.5">
                                <Zap className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                {c.como_superar}
                            </p>
                        )}
                    </div>
                ))}
                {data.posicionamento_recomendado && (
                    <div className="bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/20 text-sm text-emerald-300 flex items-start gap-2">
                        <Bookmark className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        {data.posicionamento_recomendado}
                    </div>
                )}
            </div>
        );
    }

    // ─── Lead List ────
    if (tipo === 'lista_leads') {
        return (
            <div className="space-y-4">
                {data.perfil_ideal_cliente && (
                    <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800/50">
                        <div className="flex items-center gap-2 mb-2">
                            <User className="w-4 h-4 text-white" />
                            <h4 className="text-sm font-semibold text-white">Perfil Ideal de Cliente</h4>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-zinc-300">
                            {data.perfil_ideal_cliente.segmentos && (
                                <div><span className="text-zinc-500">Segmentos:</span> {data.perfil_ideal_cliente.segmentos.join(', ')}</div>
                            )}
                            {data.perfil_ideal_cliente.porte && (
                                <div><span className="text-zinc-500">Porte:</span> {data.perfil_ideal_cliente.porte}</div>
                            )}
                            {data.perfil_ideal_cliente.localizacao && (
                                <div><span className="text-zinc-500">Região:</span> {data.perfil_ideal_cliente.localizacao}</div>
                            )}
                        </div>
                        {data.perfil_ideal_cliente.sinais_compra && (
                            <div className="mt-2">
                                <p className="text-[10px] text-zinc-500 uppercase mb-1">Sinais de Compra</p>
                                <ul className="space-y-1">
                                    {data.perfil_ideal_cliente.sinais_compra.map((s: string, i: number) => (
                                        <li key={i} className="text-xs text-zinc-300 flex gap-1.5">
                                            <span className="text-violet-400">▸</span> {s}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
                {data.onde_encontrar && (
                    <div className="space-y-2">
                        <p className="text-xs text-zinc-500 uppercase font-semibold">Onde Encontrar Leads</p>
                        {data.onde_encontrar.map((item: any, i: number) => (
                            <div key={i} className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800/50">
                                <div className="flex items-center gap-2 mb-1">
                                    <MapPin className="w-4 h-4 text-white" />
                                    <p className="text-sm font-semibold text-white">{item.canal}</p>
                                </div>
                                <p className="text-xs text-zinc-400">{item.como_buscar}</p>
                                {item.filtros_sugeridos && (
                                    <div className="flex items-center gap-1 text-xs text-violet-300 mt-1">
                                        <Filter className="w-3 h-3" />
                                        Filtros: {item.filtros_sugeridos}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
                {data.exemplos_abordagem && (
                    <div className="space-y-2">
                        <p className="text-xs text-zinc-500 uppercase font-semibold">Exemplos de Abordagem</p>
                        {data.exemplos_abordagem.map((ex: any, i: number) => (
                            <div key={i} className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800/50">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                                        <Mail className="w-3 h-3" />
                                        {ex.canal}
                                    </div>
                                    <CopyButton text={ex.mensagem} />
                                </div>
                                <p className="text-sm text-zinc-300 whitespace-pre-wrap font-mono bg-zinc-950 rounded-lg p-3">
                                    {ex.mensagem}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // ─── Scripts ────
    if (tipo === 'script_abordagem' && data.scripts) {
        return (
            <div className="space-y-4">
                {data.sequencia_ideal && (
                    <div className="flex items-start gap-2 text-sm text-blue-300 bg-blue-500/10 rounded-xl p-3 border border-blue-500/20">
                        <Bookmark className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>Sequência ideal: {data.sequencia_ideal}</span>
                    </div>
                )}
                {data.scripts.map((script: any, i: number) => (
                    <div key={i} className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800/50">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Phone className="w-4 h-4 text-white" />
                                <h4 className="text-sm font-semibold text-white">{script.canal}</h4>
                            </div>
                            <CopyButton text={script.script} />
                        </div>
                        <p className="text-xs text-zinc-500 mb-2">Objetivo: {script.objetivo}</p>
                        <div className="bg-zinc-950 rounded-xl p-4 text-zinc-300 text-sm whitespace-pre-wrap font-mono leading-relaxed mb-3">
                            {script.script}
                        </div>
                        {script.objecoes_comuns && (
                            <div>
                                <p className="text-[10px] text-zinc-500 uppercase font-semibold mb-1.5">Objeções Comuns</p>
                                {script.objecoes_comuns.map((obj: any, j: number) => (
                                    <div key={j} className="flex gap-3 mb-2 text-xs">
                                        <div className="flex items-center gap-1 text-red-400 flex-shrink-0">
                                            <X className="w-3 h-3" />
                                            {obj.objecao}
                                        </div>
                                        <span className="text-emerald-400">→ {obj.resposta}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        );
    }

    // ─── Content Plan ────
    if (tipo === 'plano_conteudo') {
        return (
            <div className="space-y-4">
                {data.estrategia && (
                    <p className="text-sm text-zinc-300 bg-zinc-900/50 rounded-xl p-3 border-l-4 border-emerald-500">{data.estrategia}</p>
                )}
                {data.pilares_conteudo && (
                    <div className="flex flex-wrap gap-2">
                        {data.pilares_conteudo.map((p: string, i: number) => (
                            <span key={i} className="text-xs px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                {p}
                            </span>
                        ))}
                    </div>
                )}
                {data.calendario_semanal && (
                    <div className="space-y-2">
                        {data.calendario_semanal.map((item: any, i: number) => (
                            <div key={i} className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800/50 flex items-center gap-3">
                                <div className="text-center min-w-[60px]">
                                    <p className="text-xs font-bold text-white">{item.dia}</p>
                                    <p className="text-[10px] text-zinc-500">{item.plataforma}</p>
                                </div>
                                <div className="h-8 w-px bg-zinc-800" />
                                <div className="flex-1">
                                    <p className="text-sm text-white">{item.tema}</p>
                                    <p className="text-xs text-zinc-500">{item.tipo_conteudo} · {item.objetivo}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // ─── Pricing ────
    if (tipo === 'precificacao') {
        return (
            <div className="space-y-4">
                {data.analise_atual && (
                    <p className="text-sm text-zinc-300 bg-zinc-900/50 rounded-xl p-3 border-l-4 border-pink-500">{data.analise_atual}</p>
                )}
                {data.cenarios && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {data.cenarios.map((c: any, i: number) => (
                            <div key={i} className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800/50">
                                <h4 className="text-sm font-bold text-white mb-2">{c.nome}</h4>
                                <div className="space-y-1.5 text-xs">
                                    <div className="flex justify-between"><span className="text-zinc-500">Preço</span><span className="text-white font-semibold">{c.preco_sugerido}</span></div>
                                    <div className="flex justify-between"><span className="text-zinc-500">Margem</span><span className="text-emerald-400">{c.margem_estimada}</span></div>
                                    <div className="flex justify-between"><span className="text-zinc-500">Posição</span><span className="text-zinc-300">{c.posicionamento}</span></div>
                                </div>
                                {c.risco && (
                                    <div className="flex items-start gap-1.5 text-[10px] text-amber-400 mt-2">
                                        <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                        {c.risco}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
                {data.recomendacao && (
                    <div className="bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/20 text-sm text-emerald-300 flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        {data.recomendacao}
                    </div>
                )}
            </div>
        );
    }

    // ─── Fallback: generic JSON display ────
    return (
        <div className="bg-zinc-900/50 rounded-xl p-4">
            <pre className="text-xs text-zinc-400 whitespace-pre-wrap overflow-auto max-h-96">
                {JSON.stringify(data, null, 2)}
            </pre>
        </div>
    );
}

const TaskAssistant: React.FC<TaskAssistantProps> = ({ task, profileSummary, onClose, onGenerate }) => {
    const [output, setOutput] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const meta = ASSIST_TYPE_META[task.suporte_ia?.tipo] || { icon: Sparkles, title: 'Assistente IA', color: '#8b5cf6' };
    const IconComponent = meta.icon;

    const handleGenerate = async () => {
        setLoading(true);
        setError('');
        try {
            const result = await onGenerate(task.id);
            if (result.success) {
                setOutput(result.output);
            } else {
                setError(result.erro || 'Erro ao gerar assistência.');
            }
        } catch (err: any) {
            setError(err.message || 'Erro inesperado.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-3xl max-h-[85vh] bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden flex flex-col shadow-2xl">
                {/* Color bar */}
                <div className="h-1.5" style={{ background: meta.color }} />

                {/* Header */}
                <div className="px-6 py-5 border-b border-zinc-800/50 flex items-center justify-between flex-shrink-0">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${meta.color}20` }}>
                                <IconComponent className="w-5 h-5" style={{ color: meta.color }} />
                            </div>
                            <h2 className="text-lg font-bold text-white">{meta.title}</h2>
                        </div>
                        <p className="text-sm text-zinc-500">{task.titulo}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-all"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {/* Context */}
                    <div className="bg-zinc-900/50 rounded-xl p-3 text-xs text-zinc-500 space-y-1">
                        <p><span className="text-zinc-400 font-medium">Negócio:</span> {profileSummary}</p>
                        <p><span className="text-zinc-400 font-medium">IA:</span> {task.suporte_ia?.descricao}</p>
                    </div>

                    {!output && !loading && !error && (
                        <div className="text-center py-12">
                            <div className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: `${meta.color}20` }}>
                                <IconComponent className="w-10 h-10" style={{ color: meta.color }} />
                            </div>
                            <p className="text-zinc-300 mb-2 font-medium">Pronto para gerar</p>
                            <p className="text-zinc-500 text-sm mb-6 max-w-md mx-auto">
                                A IA vai analisar seu negócio e os dados de mercado para gerar conteúdo personalizado.
                            </p>
                            <button
                                onClick={handleGenerate}
                                className="px-8 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-white font-bold text-sm hover:shadow-lg hover:shadow-violet-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all inline-flex items-center gap-2"
                            >
                                <Sparkles className="w-5 h-5" />
                                Gerar com IA
                            </button>
                        </div>
                    )}

                    {loading && (
                        <div className="text-center py-12">
                            <div className="w-12 h-12 rounded-full border-2 border-violet-500 border-t-transparent animate-spin mx-auto mb-4" />
                            <p className="text-zinc-400 text-sm animate-pulse">Gerando conteúdo personalizado...</p>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-950/30 border border-red-900/50 rounded-xl p-4 text-red-300 text-sm text-center">
                            {error}
                            <button
                                onClick={handleGenerate}
                                className="block mx-auto mt-3 px-4 py-1.5 rounded-lg bg-red-500/20 text-red-300 text-xs hover:bg-red-500/30 transition-all"
                            >
                                Tentar novamente
                            </button>
                        </div>
                    )}

                    {output && <RenderAssistOutput data={output} />}
                </div>
            </div>
        </div>
    );
};

export default TaskAssistant;
