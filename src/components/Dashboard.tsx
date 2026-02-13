'use client';

import React, { useState } from 'react';
import {
    LayoutDashboard,
    PieChart,
    TrendingUp,
    Users,
    ShoppingBag,
    Target,
    BarChart3,
    Settings,
    Bell,
    Search,
    ChevronDown,
    ArrowUpRight,
    ArrowDownRight,
    Briefcase,
    Zap,
    CheckCircle2,
    AlertCircle,
    Copy,
    ExternalLink
} from 'lucide-react';
import BusinessReport from './BusinessReport';
import ScoreCard from './ScoreCard';
import TaskBoard from './TaskBoard';

interface DashboardProps {
    data: any;
    onRedo: () => void;
    onRequestAssist: (task: any) => void;
    userProfile: {
        name: string;
        segment: string;
    };
}

export default function Dashboard({ data, onRedo, onRequestAssist, userProfile }: DashboardProps) {
    const [activeView, setActiveView] = useState<'overview' | 'market' | 'strategy' | 'tasks'>('overview');

    const score = data.score || {};
    const tasks = data.taskPlan?.tasks || [];
    const market = data.marketData || {};
    const profile = userProfile;

    // Calculate quick stats
    const healthScore = score.score_geral || 0;
    const tasksTotal = tasks.length;
    const tasksHighPriority = tasks.filter((t: any) => t.prioridade_calculada > 7).length;
    const marketSources = market.allSources?.length || 0;

    const renderContent = () => {
        switch (activeView) {
            case 'overview':
                return (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        {/* KPI Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <StatCard
                                title="Saúde do Negócio"
                                value={`${healthScore}/100`}
                                trend={healthScore > 70 ? '+5%' : healthScore < 50 ? '-2%' : '0%'}
                                trendUp={healthScore > 50}
                                icon={<Zap className="w-5 h-5 text-purple-400" />}
                                color="purple"
                            />
                            <StatCard
                                title="Tarefas Prioritárias"
                                value={tasksHighPriority.toString()}
                                subtitle={`de ${tasksTotal} totais`}
                                icon={<CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                                color="emerald"
                            />
                            <StatCard
                                title="Fontes Analisadas"
                                value={marketSources.toString()}
                                subtitle="Dados de mercado"
                                icon={<Search className="w-5 h-5 text-blue-400" />}
                                color="blue"
                            />
                            <StatCard
                                title="Potencial de Mercado"
                                value={score.dimensoes?.potencial_mercado?.score ? `${score.dimensoes.potencial_mercado.score}%` : 'N/A'}
                                trend="Estável"
                                icon={<TrendingUp className="w-5 h-5 text-amber-400" />}
                                color="amber"
                            />
                        </div>

                        {/* Main Grid: Score Map & Top Tasks */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Left: Score Card (reused but styled) */}
                            <div className="lg:col-span-2 bg-[#111113] border border-white/5 rounded-3xl p-6 overflow-hidden relative group">
                                <div className="absolute top-0 right-0 p-6 opacity-50 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => setActiveView('market')} className="text-xs text-zinc-500 hover:text-white flex items-center gap-1">
                                        Ver detalhes <ArrowUpRight className="w-3 h-3" />
                                    </button>
                                </div>
                                <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                                    <PieChart className="w-5 h-5 text-purple-500" />
                                    Diagnóstico Geral
                                </h3>
                                {/* Embedding existing ScoreCard logic but visually simplified */}
                                <ScoreCard data={score} compact />
                            </div>

                            {/* Right: Quick Actions / Top Opportunities */}
                            <div className="bg-[#111113] border border-white/5 rounded-3xl p-6 flex flex-col">
                                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                    <Target className="w-5 h-5 text-emerald-500" />
                                    Oportunidades
                                </h3>
                                <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                                    {tasks.slice(0, 4).map((task: any, i: number) => (
                                        <div key={i} className="p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5 group cursor-pointer" onClick={() => setActiveView('tasks')}>
                                            <div className="flex justify-between items-start mb-1">
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold ${task.prioridade_calculada > 8 ? 'bg-red-500/20 text-red-300' :
                                                        task.prioridade_calculada > 5 ? 'bg-amber-500/20 text-amber-300' :
                                                            'bg-blue-500/20 text-blue-300'
                                                    }`}>
                                                    {task.prioridade_calculada > 8 ? 'Alta' : 'Média'}
                                                </span>
                                                <ArrowUpRight className="w-3 h-3 text-zinc-600 group-hover:text-white transition-colors" />
                                            </div>
                                            <p className="text-sm text-zinc-200 line-clamp-2 font-medium">
                                                {task.titulo}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                                <button onClick={() => setActiveView('tasks')} className="mt-4 w-full py-2.5 rounded-xl bg-purple-600/10 text-purple-400 hover:bg-purple-600/20 transition-colors text-sm font-medium">
                                    Ver Plano Completo
                                </button>
                            </div>
                        </div>

                        {/* Bottom: Market Insights Preview */}
                        <div className="bg-[#111113] border border-white/5 rounded-3xl p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                    <BarChart3 className="w-5 h-5 text-blue-500" />
                                    Insights de Mercado
                                </h3>
                                <div className="flex gap-2">
                                    {market.categories?.slice(0, 3).map((cat: any) => (
                                        <span key={cat.id} className="text-xs px-2 py-1 rounded bg-zinc-900 text-zinc-500 border border-zinc-800">
                                            {cat.nome}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Simple Visual for Market Categories */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {market.categories?.slice(0, 3).map((cat: any, i: number) => (
                                    <div key={i} className="relative p-4 rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-950 border border-white/5 overflow-hidden">
                                        <div className="absolute top-0 right-0 p-3 opacity-20 text-4xl grayscale">
                                            {cat.icone}
                                        </div>
                                        <h4 className="text-zinc-400 text-xs uppercase tracking-widest mb-1">{cat.nome}</h4>
                                        <p className="text-white text-sm line-clamp-3 leading-relaxed">
                                            {cat.resumo?.visao_geral || "Análise detalhada disponível na aba de Mercado."}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );

            case 'tasks':
                return (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <TaskBoard data={data.taskPlan} onRequestAssist={onRequestAssist} />
                    </div>
                );

            case 'market':
                return (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <BusinessReport data={market} />
                    </div>
                );

            case 'strategy':
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Strategy Header */}
                        <div className="bg-[#111113] border border-white/5 rounded-3xl p-6 md:p-8 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500" />
                            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                                <Target className="w-5 h-5 text-amber-500" />
                                Estratégia de Crescimento
                            </h2>
                            {score.resumo_executivo && (
                                <p className="text-zinc-300 leading-relaxed">{score.resumo_executivo}</p>
                            )}
                            {score.classificacao && (
                                <div className="mt-4 inline-block px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
                                    <span className="text-amber-400 text-sm font-semibold">
                                        Classificação: {score.classificacao}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Opportunities */}
                        {score.oportunidades && score.oportunidades.length > 0 && (
                            <div className="bg-[#111113] border border-white/5 rounded-3xl p-6">
                                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                    <Zap className="w-5 h-5 text-emerald-500" />
                                    Oportunidades Identificadas
                                </h3>
                                <div className="space-y-4">
                                    {score.oportunidades.map((op: any, i: number) => (
                                        <div key={i} className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-emerald-500/20 transition-colors">
                                            <div className="flex items-start justify-between mb-2">
                                                <h4 className="text-white font-semibold">{op.titulo}</h4>
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold ${
                                                    op.impacto_potencial === 'alto' ? 'bg-emerald-500/20 text-emerald-300' :
                                                    op.impacto_potencial === 'medio' ? 'bg-amber-500/20 text-amber-300' :
                                                    'bg-blue-500/20 text-blue-300'
                                                }`}>
                                                    Impacto {op.impacto_potencial}
                                                </span>
                                            </div>
                                            <p className="text-zinc-400 text-sm mb-3">{op.descricao}</p>
                                            {op.acao_imediata && (
                                                <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                                                    <p className="text-emerald-300 text-sm">{op.acao_imediata}</p>
                                                </div>
                                            )}
                                            <div className="flex gap-3 mt-3 text-xs text-zinc-500">
                                                {op.esforco && <span>Esforço: {op.esforco}</span>}
                                                {op.custo_estimado && <span>Custo: {op.custo_estimado}</span>}
                                                {op.urgencia && <span>Urgência: {op.urgencia}</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Dimension Details */}
                        {score.dimensoes && (
                            <div className="bg-[#111113] border border-white/5 rounded-3xl p-6">
                                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                    <BarChart3 className="w-5 h-5 text-blue-500" />
                                    Análise por Dimensão
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {Object.entries(score.dimensoes).map(([key, dim]: [string, any]) => (
                                        <div key={key} className="p-4 rounded-2xl bg-white/5 border border-white/5">
                                            <div className="flex items-center justify-between mb-2">
                                                <h4 className="text-zinc-200 font-medium text-sm capitalize">
                                                    {key.replace(/_/g, ' ')}
                                                </h4>
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                                                    dim.status === 'forte' ? 'bg-emerald-500/20 text-emerald-300' :
                                                    dim.status === 'atencao' ? 'bg-amber-500/20 text-amber-300' :
                                                    'bg-red-500/20 text-red-300'
                                                }`}>
                                                    {dim.score}/100
                                                </span>
                                            </div>
                                            <div className="w-full h-1.5 bg-zinc-800 rounded-full mb-2">
                                                <div className={`h-full rounded-full ${
                                                    dim.score >= 70 ? 'bg-emerald-500' :
                                                    dim.score >= 40 ? 'bg-amber-500' :
                                                    'bg-red-500'
                                                }`} style={{ width: `${dim.score}%` }} />
                                            </div>
                                            <p className="text-zinc-500 text-xs">{dim.justificativa}</p>
                                            {dim.acoes_imediatas?.[0] && (
                                                <p className="text-zinc-400 text-xs mt-2 flex items-start gap-1">
                                                    <span className="text-emerald-400">→</span> {dim.acoes_imediatas[0]}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Fallback if no data */}
                        {!score.resumo_executivo && !score.oportunidades?.length && (
                            <div className="flex items-center justify-center h-48 text-zinc-500">
                                <div className="text-center">
                                    <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p>Dados de estratégia não disponíveis. Execute uma análise primeiro.</p>
                                </div>
                            </div>
                        )}
                    </div>
                );
        }
    };

    return (
        <div className="fixed inset-0 bg-[#09090b] text-zinc-300 font-sans flex overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 bg-[#0c0c0e] border-r border-white/5 flex flex-col hidden lg:flex">
                <div className="p-6 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white font-bold">
                        TG
                    </div>
                    <span className="text-white font-bold tracking-tight">Growth OS</span>
                </div>

                <div className="flex-1 px-4 space-y-1 py-4">
                    <p className="px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Principal</p>
                    <NavItem
                        icon={<LayoutDashboard className="w-4 h-4" />}
                        label="Visão Geral"
                        active={activeView === 'overview'}
                        onClick={() => setActiveView('overview')}
                    />
                    <NavItem
                        icon={<CheckCircle2 className="w-4 h-4" />}
                        label="Plano de Ação"
                        active={activeView === 'tasks'}
                        onClick={() => setActiveView('tasks')}
                        badge={tasksTotal > 0 ? tasksTotal : undefined}
                    />
                    <NavItem
                        icon={<BarChart3 className="w-4 h-4" />}
                        label="Mercado & Dados"
                        active={activeView === 'market'}
                        onClick={() => setActiveView('market')}
                    />
                    <NavItem
                        icon={<Target className="w-4 h-4" />}
                        label="Estratégia"
                        active={activeView === 'strategy'}
                        onClick={() => setActiveView('strategy')}
                    />

                    <div className="my-4 h-px bg-white/5 mx-4" />

                    <p className="px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Relatórios</p>
                    <NavItem
                        icon={<Users className="w-4 h-4" />}
                        label="Persona"
                        active={false}
                        onClick={() => { }}
                    />
                    <NavItem
                        icon={<ShoppingBag className="w-4 h-4" />}
                        label="Concorrentes"
                        active={false}
                        onClick={() => { }}
                    />
                </div>

                <div className="p-4 border-t border-white/5">
                    <button onClick={onRedo} className="w-full flex items-center gap-2 px-4 py-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-colors text-sm">
                        <Settings className="w-4 h-4" />
                        <span>Nova Análise</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 bg-[#09090b]">
                {/* Header */}
                <header className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-[#0c0c0e]/50 backdrop-blur-xl sticky top-0 z-10">
                    <div className="flex items-center gap-4">
                        <div className="lg:hidden w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white font-bold text-xs">TG</div>
                        <h2 className="text-white font-semibold capitalize">{activeView === 'overview' ? 'Visão Geral do Negócio' : activeView}</h2>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="text-xs font-medium text-emerald-400">Análise em Tempo Real</span>
                        </div>
                        <div className="w-px h-6 bg-white/10 mx-2" />
                        <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/5 text-zinc-400 hover:text-white transition-colors">
                            <Bell className="w-4 h-4" />
                        </button>
                        <div className="flex items-center gap-3 pl-2">
                            <div className="text-right hidden md:block">
                                <p className="text-sm text-white font-medium leading-none">{profile.name}</p>
                                <p className="text-xs text-zinc-500 mt-0.5">{profile.segment}</p>
                            </div>
                            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-zinc-700 to-zinc-600 border border-white/10" />
                        </div>
                    </div>
                </header>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    <div className="max-w-7xl mx-auto">
                        {renderContent()}
                    </div>
                </div>
            </main>
        </div>
    );
}

function NavItem({ icon, label, active, onClick, badge }: any) {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-200 group ${active
                    ? 'bg-purple-500/10 text-purple-400 font-medium'
                    : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/5'
                }`}
        >
            <div className="flex items-center gap-3">
                <span className={active ? 'text-purple-400' : 'group-hover:text-white transition-colors'}>
                    {icon}
                </span>
                <span>{label}</span>
            </div>
            {badge && (
                <span className="bg-purple-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                    {badge}
                </span>
            )}
        </button>
    );
}

function StatCard({ title, value, subtitle, trend, trendUp, icon, color }: any) {
    return (
        <div className="bg-[#111113] border border-white/5 p-5 rounded-2xl hover:border-white/10 transition-colors group">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-2 rounded-xl bg-${color}-500/10 text-${color}-500 group-hover:bg-${color}-500/20 transition-colors`}>
                    {icon}
                </div>
                {trend && (
                    <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${trendUp ? 'bg-emerald-500/10 text-emerald-400' :
                            trend === 'Estável' ? 'bg-blue-500/10 text-blue-400' :
                                'bg-red-500/10 text-red-400'
                        }`}>
                        {trendUp ? <ArrowUpRight className="w-3 h-3" /> : trend === 'Estável' ? null : <ArrowDownRight className="w-3 h-3" />}
                        {trend}
                    </div>
                )}
            </div>
            <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-1">{title}</p>
            <h4 className="text-2xl font-bold text-white tracking-tight">{value}</h4>
            {subtitle && <p className="text-zinc-500 text-xs mt-1">{subtitle}</p>}
        </div>
    );
}
