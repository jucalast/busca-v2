'use client';

import React, { useState } from 'react';
import {
    Search, Activity, Cpu, Database,
    Layers, Zap, ShieldCheck, Terminal,
    BookOpen, ChevronRight, Network, Scale
} from 'lucide-react';
import Link from 'next/link';

type TabType = 'overview' | 'discovery' | 'scoring' | 'engine' | 'resilience';

export default function DocsPage() {
    const [activeTab, setActiveTab] = useState<TabType>('overview');

    const tabs = [
        { id: 'overview', label: 'Visão Geral', icon: <Layers size={16} /> },
        { id: 'discovery', label: 'Busca & DNA', icon: <Search size={16} /> },
        { id: 'scoring', label: 'Estratégia & Scoring', icon: <Activity size={16} /> },
        { id: 'engine', label: 'Motor Especialista', icon: <Cpu size={16} /> },
        { id: 'resilience', label: 'Resiliência', icon: <ShieldCheck size={16} /> },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'overview':
                return (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <section>
                            <h2 className="text-3xl font-black mb-6 text-gray-900 flex items-center gap-3">
                                <Network className="text-violet-600" /> Arquitetura de Orquestração
                            </h2>
                            <div className="prose prose-slate max-w-none text-gray-600 leading-relaxed space-y-4">
                                <p>
                                    O sistema opera sob um modelo de <strong>Orquestração de Análise Multicamadas</strong>. Ao contrário de ferramentas convencionais que realizam buscas lineares ou dependem de prompts únicos, nossa arquitetura coordena uma sequência de micro-serviços especializados que extraem, validam e processam informações de forma assíncrona e persistente.
                                </p>
                                <p>
                                    O fluxo centralizado no <code>AnalysisOrchestrator</code> gerencia o ciclo de vida completo de um diagnóstico de negócio. Esse processo é dividido em quatro fases fundamentais: Discovery de Presença Digital, Pesquisa de Mercado Setorial, Pontuação Híbrida dos 7 Pilares de Vendas e Geração do Plano de Ação Estratégico.
                                </p>
                                <p>
                                    Cada etapa alimenta a próxima através de um sistema de <strong>Persistência em Tempo Real</strong>, garantindo que mesmo em processos de longa duração, os dados coletados sejam salvos em cada pilar concluído. Isso permite a retomada imediata de análises interrompidas ou a reanálise parcial de pilares específicos sem a necessidade de reprocessar todo o negócio.
                                </p>
                            </div>
                        </section>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="p-8 rounded-3xl bg-white border border-gray-100 shadow-sm">
                                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <Terminal className="w-5 h-5 text-violet-500" /> Fluxo de Dados Estruturado
                                </h3>
                                <ul className="space-y-4 text-sm text-gray-500">
                                    <li className="flex items-start gap-3">
                                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center font-bold text-xs font-mono">1</span>
                                        <span><strong>Discovery:</strong> Validação da existência real do negócio através de <code>BrasilAPI</code>, busca em mapas e análise de reviews para confirmar a legitimidade.</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center font-bold text-xs font-mono">2</span>
                                        <span><strong>Market Search:</strong> Pesquisa macro-setorial paralela que identifica tendências, competidores e benchmarks do setor em tempo real.</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center font-bold text-xs font-mono">3</span>
                                        <span><strong>Hybrid Scoring:</strong> Cálculo de maturidade cruzando auditoria qualitativa do LLM com métricas objetivas de integridade de dados.</span>
                                    </li>
                                </ul>
                            </div>
                            <div className="p-8 rounded-3xl bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-100">
                                <h3 className="text-xl font-bold text-violet-900 mb-4">Filosofia do Sistema</h3>
                                <p className="text-sm text-violet-700/80 leading-relaxed mb-4">
                                    Nossa filosofia principal é a construção de um <strong>DNA Empresarial Digital</strong>. Em vez de tratar cada interação como isolada, o sistema acumula conhecimento sobre o modelo de negócio, restrições de capital, tamanho de equipe e diferenciais.
                                </p>
                                <p className="text-sm text-violet-700/80 leading-relaxed">
                                    Este DNA é o que permite ao sistema sugerir ações extremamente personalizadas. Não sugerimos "faça tráfego pago" se o DNA indicar orçamento zero; em vez disso, o sistema pivota para estratégias de indicação ou orgânico local automaticamente.
                                </p>
                            </div>
                        </div>
                    </div>
                );
            case 'discovery':
                return (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <section>
                            <h2 className="text-3xl font-black mb-6 text-gray-900 flex items-center gap-3">
                                <Search className="text-blue-600" /> Engenharia de Pesquisa Unificada
                            </h2>
                            <div className="prose prose-slate max-w-none text-gray-600 leading-relaxed space-y-4">
                                <p>
                                    O <code>UnifiedResearchEngine</code> é o motor responsável pela aquisição de inteligência externa. Ele implementa um sistema de <strong>Cache Hierárquico Multi-Nível</strong> (Memória + PostgreSQL), garantindo economia de recursos e performance excepcional para consultas repetitivas.
                                </p>
                                <p>
                                    A inteligência é coletada através de quatro níveis de profundidade, cada um com sua política de expiração controlada:
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
                                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                        <span className="text-[10px] font-black uppercase text-gray-400">Nível macro</span>
                                        <h4 className="font-bold text-gray-900">Pesquisa de Mercado</h4>
                                        <p className="text-xs text-gray-500 mt-1">Validade: 6 horas. Foca em tendências setoriais e concorrência ampla.</p>
                                    </div>
                                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                        <span className="text-[10px] font-black uppercase text-gray-400">Nível identificação</span>
                                        <h4 className="font-bold text-gray-900">Discovery do Negócio</h4>
                                        <p className="text-xs text-gray-500 mt-1">Validade: 4 horas. Valida site oficial, redes sociais e reviews.</p>
                                    </div>
                                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                        <span className="text-[10px] font-black uppercase text-gray-400">Nível tático</span>
                                        <h4 className="font-bold text-gray-900">Research de Tarefas</h4>
                                        <p className="text-xs text-gray-500 mt-1">Validade: 2 horas. Busca benchmarks reais para cada tarefa sugerida.</p>
                                    </div>
                                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                        <span className="text-[10px] font-black uppercase text-gray-400">Nível atômico</span>
                                        <h4 className="font-bold text-gray-900">Micro-Research</h4>
                                        <p className="text-xs text-gray-500 mt-1">Validade: 30 min. Busca dados técnicos para execução imediata.</p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <div className="p-8 rounded-[2.5rem] bg-gray-900 text-white relative overflow-hidden">
                            <h3 className="text-xl font-bold mb-6 flex items-center gap-2 relative z-10">
                                <Database className="w-5 h-5 text-blue-400" /> Extração & Inteligência
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                                <div className="space-y-4">
                                    <h4 className="font-bold text-blue-300">Hub de Inteligência</h4>
                                    <p className="text-sm text-gray-400 leading-relaxed">
                                        O <code>IntelligenceHub</code> coordena extratores via Trafilatura para conteúdo web limpo e APIs de CNPJ. Ele realiza o que chamamos de <strong>Selective Scraping</strong>: apenas o conteúdo relevante (sem propagandas ou menus) é enviado para o LLM, economizando até 80% do consumo de tokens.
                                    </p>
                                </div>
                                <div className="space-y-4">
                                    <h4 className="font-bold text-blue-300">Enriquecimento em Tempo Real</h4>
                                    <p className="text-sm text-gray-400 leading-relaxed">
                                        Integramos gatilhos de notícias (News) e volume de busca (Trends) para cada diagnóstico. Se o sistema detecta uma queda no interesse por um pilar (ex: SEO), o scoring alerta o usuário sobre a mudança na dinâmica do mercado antes mesmo da execução começar.
                                    </p>
                                </div>
                            </div>
                            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-3xl -mr-32 -mt-32"></div>
                        </div>
                    </div>
                );
            case 'scoring':
                return (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <section>
                            <h2 className="text-3xl font-black mb-6 text-gray-900 flex items-center gap-3">
                                <Scale className="text-emerald-600" /> Os 7 Pilares de Vendas
                            </h2>
                            <div className="prose prose-slate max-w-none text-gray-600 leading-relaxed space-y-4">
                                <p>
                                    Diferente de diagnósticos genéricos, nosso modelo avalia o negócio através de <strong>7 Pilares Estratégicos</strong> em uma sequência lógica de alimentação de contexto: <em>Público-Alvo → Branding → Visual → Canais → Orgânico → Pago → Processo de Vendas</em>.
                                </p>
                                <p>
                                    Esta sequência permite o uso de <strong>Cadeia de Contexto Upstream</strong>: o que é decidido no pilar de Público-Alvo (upstream) é injetado como restrição técnica no pilar de Tráfego Pago (downstream), garantindo que as sugestões de anúncios nunca fiquem desconectadas do perfil do cliente ideal.
                                </p>
                            </div>
                        </section>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Scoring Híbrido</h4>
                                <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100">
                                    <div className="mb-4">
                                        <h5 className="font-bold text-emerald-900">Auditoria Cualitativa (60%)</h5>
                                        <p className="text-xs text-emerald-700/70">O LLM avalia se a resposta é superficial ("Vou vender no Insta") ou profissional ("Estratégia de Reels diários para nicho pet").</p>
                                    </div>
                                    <div>
                                        <h5 className="font-bold text-emerald-900">Métricas Objetivas (40%)</h5>
                                        <p className="text-xs text-emerald-700/70">Cálculo determinístico baseado na presença de links válidos, handles sociais verificados e completitude de dados críticos.</p>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Configuração Dinâmica</h4>
                                <div className="p-6 bg-amber-50 rounded-3xl border border-amber-100">
                                    <p className="text-sm text-amber-900/80 leading-relaxed italic">
                                        "O pilar de Processo de Vendas para um negócio B2B tem peso 25% na nota final, enquanto para um pequeno varejo local (B2C), o peso cai para 10% em favor dos Canais de Distribuição."
                                    </p>
                                    <p className="text-xs text-amber-700/60 mt-4 leading-relaxed">
                                        O sistema ajusta os pesos (Dynamic Weights) conforme o modelo de negócio detectado pelo Profiler, garantindo justiça na nota de acordo com a realidade do setor.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'engine':
                return (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <section>
                            <h2 className="text-3xl font-black mb-6 text-gray-900 flex items-center gap-3">
                                <Cpu className="text-indigo-600" /> Motor Especialista (Specialist Engine)
                            </h2>
                            <div className="prose prose-slate max-w-none text-gray-600 leading-relaxed space-y-4">
                                <p>
                                    O Motor Especialista é a última camada da jornada, onde o diagnóstico se torna execução. Ele opera sob o conceito de <strong>Deep Context Maintenance</strong>, garantindo que a IA nunca sugira algo incompatível com as restrições do cliente (ex: sugerir contratar agência para quem opera "solo").
                                </p>
                                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
                                    <div className="flex gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                            <Zap size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-900 text-lg">Elite Tool Hint</h4>
                                            <p className="text-sm text-gray-500 leading-relaxed">
                                                Para cada tarefa, o motor identifica a melhor ferramenta técnica (Meta Library, Google Trends, LinkedIn Sales Nav). A IA recebe estas ferramentas como "hints" de navegação, direcionando a pesquisa para os locais onde estão os melhores benchmarks do mercado.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                            <Layers size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-900 text-lg">Context Compaction (CBB)</h4>
                                            <p className="text-sm text-gray-500 leading-relaxed">
                                                Geramos um <em>Compact Business Brief</em> de ~800 tokens que contém todo o DNA do negócio. Isso permite que a IA "carregue" todo o conhecimento do negócio em cada execução de tarefa sem estourar os limites de contexto ou degradar a atenção do modelo.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                );
            case 'resilience':
                return (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <section>
                            <h2 className="text-3xl font-black mb-6 text-gray-900 flex items-center gap-3">
                                <ShieldCheck className="text-red-600" /> Resiliência & Estabilidade
                            </h2>
                            <div className="prose prose-slate max-w-none text-gray-600 leading-relaxed space-y-4">
                                <p>
                                    Para operar em larga escala com múltiplas APIs, o sistema implementa camadas defensivas que garantem continuidade operacional mesmo em condições adversas:
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-8">
                                    <div className="p-6 bg-red-50 rounded-3xl border border-red-100">
                                        <h4 className="font-bold text-red-900 mb-2">Soberania do Usuário</h4>
                                        <p className="text-xs text-red-700/70 leading-relaxed">
                                            Em caso de falha de APIs externas (como pesquisa ou IA), o sistema aciona um fallback estruturado. Ele prioriza as informações declaradas pelo usuário no chat, gerando um diagnóstico básico via heurísticas determinísticas, impedindo o travamento do sistema.
                                        </p>
                                    </div>
                                    <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100">
                                        <h4 className="font-bold text-gray-900 mb-2">Auto-Throttle Control</h4>
                                        <p className="text-xs text-gray-500 leading-relaxed">
                                            Controle automático de cadência entre buscas (1.0 seg interval) para evitar bloqueios por IP. O sistema monitora as quotas de TPD (Tokens Per Day) e alterna entre modelos de fallback para garantir que o usuário nunca receba um erro de "Serviço Indisponível".
                                        </p>
                                    </div>
                                </div>
                                <div className="p-8 bg-gray-900 rounded-[2rem] text-center">
                                    <div className="text-5xl font-black text-white mb-2 italic">100%</div>
                                    <div className="text-[10px] uppercase font-black tracking-widest text-gray-500">Persistência Ponto-a-Ponto</div>
                                    <p className="mt-4 text-xs text-gray-500 leading-relaxed max-w-md mx-auto">
                                        Cada pilar do diagnóstico é salvo no PostgreSQL no momento exato da conclusão. Se o usuário fechar o navegador, o progresso estará lá quando ele voltar.
                                    </p>
                                </div>
                            </div>
                        </section>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-transparent p-4 md:p-12 pb-24 text-gray-800 overflow-y-auto custom-scrollbar">
            <div className="max-w-6xl mx-auto space-y-12">
                {/* Header Premium */}
                <header className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 bg-violet-100 text-violet-600 text-[10px] font-black uppercase tracking-wider rounded-md">Arquiteto v3.5</span>
                        <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                        <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Documentação Técnica</span>
                    </div>
                    <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-gray-900 italic">
                        TECHNICAL <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600">INSIGHTS</span>
                    </h1>
                    <p className="text-lg text-gray-500 max-w-2xl leading-relaxed">
                        Mergulhe fundo na nossa arquitetura de orquestração assíncrona, motores de busca unificados e modelos de scoring híbrido.
                    </p>
                </header>

                {/* Navigation Tabs Multi-State */}
                <nav className="flex flex-wrap gap-2 p-1.5 bg-white/40 backdrop-blur-md border border-white/60 rounded-2xl shadow-sm mb-12 w-fit">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as TabType)}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === tab.id
                                    ? 'bg-gray-900 text-white shadow-xl scale-[1.02]'
                                    : 'text-gray-500 hover:bg-white/60 hover:text-gray-900'
                                }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </nav>

                {/* Content Area */}
                <main className="min-h-[500px]">
                    {renderContent()}
                </main>

                {/* Footer */}
                <footer className="pt-12 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    <p>© 2026 Mastermind Growth Architect. Todos os direitos reservados.</p>
                    <div className="flex gap-8">
                        <Link href="/" className="hover:text-violet-600 transition-colors">Voltar ao Workspace</Link>
                        <Link href="#" className="hover:text-violet-600 transition-colors">API Endpoint History</Link>
                    </div>
                </footer>
            </div>
        </div>
    );
}
