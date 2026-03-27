'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import { useSidebar } from '@/contexts/SidebarContext';

interface KnowledgeHubProps {
    profile: any;
    score: any;
    taskDeliverables: Record<string, any>;
    completedTasks: Record<string, Set<string>>;
    marketData: any;
    pillarPlan?: Record<string, any>;
    specialists?: Record<string, any>;
}

export function StrategicKnowledgeHub({
    profile,
    score,
    taskDeliverables,
    completedTasks,
    marketData,
    pillarPlan = {},
    specialists = {}
}: KnowledgeHubProps) {
    const { isDark } = useSidebar();
    
    // Motor de extração de contexto
    const getField = (keys: string[]) => {
        const targets = [
            score?.perfil_analisado?.dna,
            score?.perfil_analisado,
            profile?.structured_data,
            profile?.profile_data?.dna,
            profile?.profile_data?.perfil,
            profile?.profile_data,
            profile?.profile?.perfil,
            profile?.profile?.dna,
            profile?.perfil,
            profile?.dna,
            profile?.metadata,
            profile
        ];

        for (const t of targets) {
            if (!t || typeof t !== 'object') continue;
            for (const k of keys) {
                const val = t[k];
                if (val !== undefined && val !== null && val !== 'N/A' && val !== '' && val !== '?' && val !== 'PENDENTE') {
                    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return String(val).trim();
                    if (Array.isArray(val)) return val.join(', ');
                }
            }
        }
        return null;
    };

    const dna = {
        nome: getField(['nome_negocio', 'nome', 'business_name', 'businessName']) || 'Negócio',
        segmento: getField(['segmento_identificado', 'segmento', 'area_atuacao', 'setor']) || 'Segmento não informado',
        modelo: getField(['modelo_identificado', 'modelo', 'modelo_negocio', 'tipo_negocio']) || 'Modelo não informado',
        equipe: getField(['tamanho_equipe', 'num_funcionarios', 'equipe', 'tamanho_do_time']) || 'Não informado',
        faturamento: getField(['faixa_faturamento', 'faturamento_mensal', 'faturamento']) || 'Não informado',
        desafios: getField(['principal_gargalo', 'desafio_principal', 'dificuldades', 'problemas']) || 'Não informado',
        objetivos: getField(['objetivo_principal', 'objetivos', 'metas']) || 'Não informado',
    };

    const dimensoes = score?.dimensoes || score?.dims || {};
    const totalDeliverables = Object.values(taskDeliverables || {}).length;

    // Componentes Markdown
    const markdownComponents = {
        h1: ({node, ...props}: any) => <h1 className="text-2xl font-black tracking-tight mb-4 mt-8 uppercase border-b border-zinc-800 pb-2 text-indigo-500" {...props} />,
        h2: ({node, ...props}: any) => <h2 className="text-xl font-bold tracking-tight mb-3 mt-8 uppercase text-indigo-400" {...props} />,
        h3: ({node, ...props}: any) => <h3 className="text-sm font-black tracking-[0.1em] mb-2 mt-6 uppercase text-zinc-400" {...props} />,
        p: ({node, ...props}: any) => <p className="text-[13px] leading-relaxed mb-4 font-sans opacity-90" {...props} />,
        ul: ({node, ...props}: any) => <ul className="list-disc list-inside mb-4 space-y-2 opacity-80" {...props} />,
        li: ({node, ...props}: any) => <li className="text-[12.5px] leading-relaxed ml-4" {...props} />,
        strong: ({node, ...props}: any) => <strong className="font-black text-zinc-100" {...props} />,
        em: ({node, ...props}: any) => <em className="italic opacity-80" {...props} />,
        hr: () => <hr className="my-8 border-zinc-800/30" />,
        blockquote: ({node, ...props}: any) => (
            <blockquote className="border-l-2 border-indigo-500 pl-4 my-6 italic text-zinc-400 bg-indigo-500/5 py-3 rounded-r-md" {...props} />
        )
    };

    const extractDeepContent = (obj: any): string => {
        if (!obj) return "";
        if (typeof obj === 'string') {
            if (obj.trim().startsWith('{')) {
                try { return extractDeepContent(JSON.parse(obj)); } catch (e) { return obj; }
            }
            return obj;
        }
        const priorityFields = ['conteudo', 'content', 'deliverable', 'outcome', 'result', 'text', 'message', 'data'];
        for (const field of priorityFields) {
            if (obj[field]) {
                if (typeof obj[field] === 'string') return obj[field];
                if (typeof obj[field] === 'object') return extractDeepContent(obj[field]);
            }
        }
        if (typeof obj === 'object') {
            const strings = Object.values(obj).filter(v => typeof v === 'string') as string[];
            if (strings.length > 0) return strings.reduce((a, b) => a.length > b.length ? a : b);
        }
        return JSON.stringify(obj, null, 2);
    };

    return (
        <div className={`flex flex-col gap-12 py-10 px-8 font-sans max-w-5xl mx-auto animate-in fade-in duration-700 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
            
            <header className="border-l-2 border-indigo-500 pl-8 py-2">
                <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-500">Relatório Estratégico Master</span>
                    <h1 className={`text-5xl font-bold tracking-tighter ${isDark ? 'text-white' : 'text-zinc-900'}`}>{dna.nome}</h1>
                    <div className="flex items-center gap-4 text-[9px] font-mono mt-1 opacity-50 uppercase tracking-widest leading-none">
                        <span>Status: Live_Neural_Synch</span>
                        <span>•</span>
                        <span>ID: {score?.analysis_id || 'ALFA-V3'}</span>
                        <span>•</span>
                        <span>Context_Version: 3.1</span>
                    </div>
                </div>
            </header>

            {/* 01. IDENTIDADE E CONTEXTO */}
            <section className="space-y-6">
                <div className="flex items-center gap-4">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 whitespace-nowrap">01. Identidade e Contexto</h2>
                    <div className="h-[1px] w-full bg-zinc-800/50" />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-8 gap-x-16">
                    <div>
                        <span className="text-[9px] uppercase font-bold text-indigo-500 block mb-2 tracking-widest">Base Operacional</span>
                        <div className="space-y-4">
                            {[
                                { key: 'Segmento', val: dna.segmento },
                                { key: 'Modelo de Negócio', val: dna.modelo },
                                { key: 'Estrutura de Equipe', val: dna.equipe },
                                { key: 'Estimativa de Receita', val: dna.faturamento }
                            ].map((item, i) => (
                                <div key={i} className="flex flex-col pb-2 border-b border-zinc-800/10">
                                    <span className="text-[10px] uppercase font-bold text-zinc-500 mb-0.5">{item.key}</span>
                                    <span className={`text-sm font-medium ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>{item.val}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <span className="text-[9px] uppercase font-bold text-indigo-500 block mb-2 tracking-widest">Direcionamento Estratégico</span>
                        <div className="space-y-6">
                            <div className="flex flex-col">
                                <span className="text-[10px] uppercase font-bold text-zinc-500 mb-1">Diagnóstico de Gargalos</span>
                                <p className={`text-sm leading-relaxed italic ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>"{dna.desafios}"</p>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] uppercase font-bold text-zinc-500 mb-1">Visão de Crescimento</span>
                                <p className={`text-sm leading-relaxed ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>{dna.objetivos}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 02. SINCRONIA DE PILARES */}
            <section className="space-y-6">
                <div className="flex items-center gap-4">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 whitespace-nowrap">02. Fluxo de Sincronia de IA</h2>
                    <div className="h-[1px] w-full bg-zinc-800/50" />
                </div>

                <div className={`grid grid-cols-1 gap-1 border rounded-xl overflow-hidden transition-all duration-300 ${isDark ? 'bg-zinc-900 border-white/10 shadow-[rgba(0,0,0,0.2)_0px_4px_30px]' : 'bg-gray-50 border-zinc-200 shadow-sm'}`}>
                    <div className="grid grid-cols-12 px-6 py-3 bg-zinc-950/40 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">
                        <div className="col-span-2">Pilar</div>
                        <div className="col-span-3">Audit_Trails & Score</div>
                        <div className="col-span-3">Meta Definida</div>
                        <div className="col-span-4">Diagnóstico Crítico</div>
                    </div>
                    
                    {Object.entries(dimensoes).map(([key, pillar]: [string, any]) => {
                        const mktCat = (marketData?.categories || []).find((c: any) => c.id === key);
                        const mktSources = mktCat?.fontes || [];
                        const planSources = 
                                pillarPlan[key]?.sources || 
                                pillarPlan[key]?.plan?.plan_data?.sources ||
                                pillarPlan[key]?.plan?.plan_data?.context_sources ||
                                pillarPlan[key]?.plan_data?.sources ||
                                specialists[key]?.plan?.plan_data?.sources || 
                                specialists[key]?.plan?.plan_data?.fontes_consultadas || [];
                        
                        const liveSources = Object.values(taskDeliverables[key] || {}).flatMap((r: any) => r?.sources || []);

                        const pillarSources = [...new Set([
                            ...mktSources.map((s: any) => typeof s === 'string' ? s : (s.url || s.link)),
                            ...planSources.map((s: any) => typeof s === 'string' ? s : (s.url || s.link)),
                            ...liveSources.map((s: any) => typeof s === 'string' ? s : (s.url || s.link))
                        ])].filter(Boolean);

                        const displaySources = pillarSources.slice(0, 3);
                        const hasMore = pillarSources.length > 3;

                        return (
                            <div key={key} className={`grid grid-cols-12 px-6 py-6 border-t items-start gap-4 transition-colors ${isDark ? 'border-white/5 hover:bg-white/5' : 'border-zinc-200 hover:bg-zinc-100/50'}`}>
                                <div className="col-span-2 flex flex-col">
                                    <span className={`text-xs font-bold uppercase ${isDark ? 'text-white' : 'text-zinc-900'}`}>{pillar.label || key}</span>
                                    <span className="text-[8px] font-mono text-zinc-600 mt-1 uppercase tracking-tighter">Status_Active</span>
                                </div>
                                
                                {/* NOVO DESIGN: COLUNA DEDICADA PARA SCORE E FONTES */}
                                <div className="col-span-3 flex items-center gap-3">
                                    {/* SCORE CHIP */}
                                    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md transition-colors duration-300 ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
                                        <span className="text-[9px] font-bold uppercase tracking-widest opacity-60 text-indigo-400">Score</span>
                                        <span className="text-[10px] font-black text-indigo-500">{pillar.score}%</span>
                                    </div>
                                    
                                    {/* STACKED SOURCES */}
                                    <div className="flex items-center">
                                        <div className="flex items-center -space-x-1.5">
                                            {pillarSources.length > 0 ? displaySources.map((src: any, i: number) => {
                                                const urlStr = typeof src === 'string' ? src : (src.url || src.link);
                                                try {
                                                    const domain = new URL(urlStr).hostname;
                                                    return (
                                                        <div key={i} className={`rounded-full flex items-center justify-center overflow-hidden transition-all duration-200 hover:-translate-y-0.5 ${isDark ? 'bg-zinc-900 border-white/10' : 'bg-white border-zinc-200'} border shadow-sm shadow-black/20`} 
                                                             style={{ width: '20px', height: '20px', zIndex: 10 - i }}
                                                             title={urlStr}>
                                                            <img 
                                                                src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} 
                                                                alt="source" 
                                                                className="w-3.5 h-3.5 object-contain"
                                                            />
                                                        </div>
                                                    );
                                                } catch (e) { return null; }
                                            }) : (
                                                <div className="w-1.5 h-1.5 rounded-full bg-zinc-800 animate-pulse" />
                                            )}
                                        </div>
                                        {hasMore && (
                                            <span className="text-[9px] font-bold ml-1.5 text-zinc-600">
                                                +{pillarSources.length - 3}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="col-span-3">
                                    <span className="text-[10px] font-bold text-zinc-400 bg-zinc-800/10 px-2 py-1 border border-zinc-800/50 rounded uppercase block whitespace-normal break-words leading-snug">
                                        {pillar.meta_pilar || 'DEFININDO...'}
                                    </span>
                                </div>
                                <div className="col-span-4">
                                    <p className={`text-[11px] leading-relaxed italic ${isDark ? 'text-zinc-500' : 'text-zinc-600'}`}>"{pillar.justificativa || 'Aguardando diagnóstico técnico do especialista...'}"</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* 03. REPOSITÓRIO DE INTELIGÊNCIA */}
            <section className="space-y-6">
                <div className="flex items-center gap-4">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 whitespace-nowrap">03. Repositório de Inteligência (Log)</h2>
                    <div className="h-[1px] w-full bg-zinc-800/50" />
                </div>

                <div className="space-y-8">
                    {totalDeliverables === 0 ? (
                        <div className="py-12 text-center text-[10px] uppercase font-bold text-zinc-700 tracking-[0.2em] border-2 border-dashed border-zinc-800/20 rounded-2xl">
                            Nenhum entregável consolidado até o momento.
                        </div>
                    ) : (
                        Object.entries(taskDeliverables).reverse().map(([id, item]: [string, any]) => {
                            const contentToRender = extractDeepContent(item);
                            let displayTitle = item.task_title || "Documento Estratégico";
                            if (displayTitle.startsWith('task_') || displayTitle === 'Documento Técnico' || displayTitle === 'Documento Estratégico') {
                                const lines = contentToRender.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('{'));
                                const titleFromContent = lines.find(l => l.startsWith('#'))?.replace(/#+\s*/, '') || lines[0];
                                if (titleFromContent && titleFromContent.length < 100) displayTitle = titleFromContent;
                            }

                            return (
                                <div key={id} className={`p-10 rounded-2xl border transition-all duration-300 ${isDark ? 'bg-zinc-900 border-white/10 shadow-[rgba(0,0,0,0.2)_0px_4px_30px] hover:border-white/20' : 'bg-white border-zinc-200 shadow-sm'}`}>
                                    <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
                                        <div className="flex flex-col max-w-[70%]">
                                            <span className="text-[8px] font-mono text-indigo-500 font-bold uppercase tracking-[0.3em] mb-1">CÉLULA_CORTICAL • ESTRATÉGIA</span>
                                            <h4 className={`text-xl font-bold tracking-tight uppercase truncate ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>{displayTitle}</h4>
                                        </div>
                                        <div className="flex items-center gap-2">
                                             <span className="text-[9px] font-black uppercase px-4 py-1.5 bg-zinc-950/60 rounded-full border border-white/10 text-zinc-500 tracking-widest leading-none">
                                                ORIGEM_{String(item.pillar_key || item.pillar || 'DIAGNÓSTICO').toUpperCase()}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className={`prose prose-sm ${isDark ? 'prose-invert text-zinc-400' : 'text-zinc-700'} max-w-none`}>
                                        <ReactMarkdown components={markdownComponents as any}>{contentToRender}</ReactMarkdown>
                                    </div>

                                    <div className="mt-12 pt-6 border-t border-white/5 flex justify-between items-center opacity-40">
                                        <div className="flex items-center gap-2 text-[8px] font-mono uppercase tracking-widest">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                            Neural_Handshake_ID: <span className="text-zinc-500">{id.replace('task_', '')}</span>
                                        </div>
                                        <span className="text-[8px] font-mono uppercase">© {new Date().getFullYear()} Hub_Inteligência</span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </section>

            <footer className="mt-20 pt-10 border-t border-zinc-800/30 text-center opacity-20 select-none pb-20">
                <div className="flex flex-col gap-2 font-mono text-[8px] uppercase tracking-[0.5em] font-bold">
                    <span>Alpha Growth Monitor • 3.1 • Cross-Pillar Validation Service</span>
                    <span>Evidence-Based Strategy Hub Ativo</span>
                </div>
            </footer>
        </div>
    );
}
