'use client';

import React from 'react';
import { ArrowLeft, RefreshCw, BadgeCheck, Link2, MapPin, Calendar, Share2, MoreHorizontal, FileText, Globe, Brain } from 'lucide-react';
import { PILLAR_META } from '../constants';
import {
    safeRender,
    openInGoogleDocs,
    openInGoogleSheets,
    openInGoogleForms,
    exportAsCSV,
    savePendingDocAction
} from '../utils';
import { SourceBadgeList } from '@/features/shared/components/SourceBadgeList';
import { signIn } from 'next-auth/react';
import { DocumentsTab, DocItem } from './DocumentsTab';
import { DocumentsGrid } from './DocumentsGrid';
import { GaugeArc } from './ScoreGauge';
import { TaskItem, PillarWorkspaceProps } from '../types';
import { useSidebar } from '@/contexts/SidebarContext';

interface PillarHeaderProps {
    selectedPillar: string;
    plan: any;
    specialists: Record<string, any>;
    dims: Record<string, any>;
    allSources: string[];
    session: any;
    businessId: string | null;
    setLoadingDoc: (id: string | null) => void;
    setError: (err: string) => void;
    handleRedoPillar: (key: string) => void;
    onBack: () => void;
    docsForDropdown: DocItem[];
    visibleTasks: TaskItem[];
    openFolders: Set<string>;
    setOpenFolders: React.Dispatch<React.SetStateAction<Set<string>>>;
    loadingDoc: string | null;
    done: Set<string>;
    onVerPensamento: () => void;
}

function getHostname(src: any) {
    try {
        const urlStr = typeof src === 'string' ? src : (src?.url || src?.link || '');
        if (!urlStr) return '';
        const url = new URL(urlStr);
        return url.hostname.replace(/^www\./i, '');
    } catch (e) {
        return typeof src === 'string' ? src : (src?.url || src?.link || '');
    }
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    critico: { label: 'Crítico', color: 'var(--color-destructive)', bg: 'var(--color-destructive-muted)' },
    atencao: { label: 'Atenção', color: 'var(--color-warning)', bg: 'var(--color-warning-muted)' },
    bom: { label: 'Bom', color: 'var(--color-success)', bg: 'var(--color-success-muted)' },
    otimo: { label: 'Ótimo', color: '#818cf8', bg: 'rgba(129,140,248,0.10)' },
};

function ferramentaIcon(ferramenta: string): string {
    const f = (ferramenta || '').toLowerCase();
    if (f.includes('planilha') || f.includes('calendario') || f.includes('cronograma')) return '/sheets.png';
    if (f.includes('formulario') || f.includes('pesquisa') || f.includes('survey')) return '/forms.svg';
    if (f.includes('linkedin')) return '/linkedin.png';
    if (f.includes('instagram')) return '/instagram.png';
    if (f.includes('facebook') || f.includes('fb') || f.includes('library')) return '/facebook.png';
    if (f.includes('trends')) return '/trends.png';
    if (f.includes('google') || f.includes('ads')) return '/google.png';
    return '/docs.png';
}


export function PillarHeader({
    selectedPillar,
    plan,
    specialists,
    dims,
    allSources,
    session,
    setLoadingDoc,
    handleRedoPillar,
    onBack,
    docsForDropdown,
    visibleTasks,
    openFolders,
    setOpenFolders,
    loadingDoc,
    done,
    onVerPensamento,
}: PillarHeaderProps) {
    const { isDark } = useSidebar();
    const [showAllSources, setShowAllSources] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState<'arquivos' | 'feed'>('feed');
    const meta = PILLAR_META[selectedPillar];
    const specialist = specialists[selectedPillar] || {};

    const score: number = plan.score ?? dims[selectedPillar]?.score ?? 0;
    const status: string = (plan.status ?? dims[selectedPillar]?.status ?? '').toLowerCase();
    const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.otimo;

    const cargo = specialist.cargo || meta.label;
    const bio = specialist.persona || safeRender(plan.diagnostico || plan.objetivo || '');

    const totalTasks = visibleTasks.length;
    const doneCount = visibleTasks.filter(t => done.has(t.id)).length;
    const deliverables = plan.entregaveis || [];
    const hasDocs = docsForDropdown.length > 0;

    // Helper for specialist avatars (placeholder logic)
    const getAvatarUrl = (key: string) => {
        const colors: Record<string, string> = {
            publico_alvo: '8b5cf6',
            branding: 'f59e0b',
            identidade_visual: 'ec4899',
            canais_venda: '3b82f6'
        };
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(cargo)}&background=${colors[key] || '6366f1'}&color=fff&bold=true`;
    };

    const handleDocOpen = React.useCallback((doc: DocItem, fmt: string) => {
        // Not logged in or token expired — save action and redirect to OAuth
        if (!session?.accessToken || session?.error === 'RefreshAccessTokenError') {
            savePendingDocAction({
                type: fmt as any,
                tid: doc.tid,
                idx: doc.idx,
                result: doc.result,
                title: doc.title,
                fmt,
            });
            signIn('google', { callbackUrl: window.location.href });
            return;
        }

        if (fmt === 'csv' && doc.result.structured_data) {
            exportAsCSV(doc.result.structured_data, doc.title);
        } else if (fmt === 'google_sheets' && doc.result.structured_data?.abas?.length > 0) {
            openInGoogleSheets(doc.result, session, (id) => setLoadingDoc(id ? `${doc.tid}_${doc.idx}_${fmt}` : null), `${doc.tid}_st${doc.idx}`);
        } else if (fmt === 'google_forms' && doc.result.structured_data?.secoes?.length > 0) {
            openInGoogleForms(doc.result, session, (id) => setLoadingDoc(id ? `${doc.tid}_${doc.idx}_${fmt}` : null), `${doc.tid}_st${doc.idx}`);
        } else if (fmt === 'google_docs' || fmt === 'pdf') {
            openInGoogleDocs({ ...doc.result, conteudo_completo: doc.result.conteudo }, '', session, (id) => setLoadingDoc(id ? `${doc.tid}_${doc.idx}_${fmt}` : null), `${doc.tid}_st${doc.idx}`);
        }
    }, [session, setLoadingDoc]);

    return (
        <div className={`w-[45%] flex flex-col pt-0 relative z-10 overflow-y-auto hide-scrollbar border-r transition-all duration-300 ${isDark ? 'bg-zinc-900/50 backdrop-blur-3xl border-white/5' : 'bg-gray-50/50 border-gray-200'
            }`}>
            {/* ─── Profile SaaS Header ─── */}
            <div className="relative shrink-0 border-b border-transparent">
                {/* 1. Dashboard Banner (Replaces Cover) */}
                <div className={`h-24 w-full relative overflow-hidden ${isDark ? 'bg-zinc-800/50' : 'bg-zinc-100'
                    }`}>
                    <div className="absolute inset-0 opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/5 to-transparent" />
                    
                    {/* Top Floating Buttons */}
                    <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-20">
                        <button
                            onClick={onBack}
                            className={`p-2 rounded-lg backdrop-blur-md transition-all hover:scale-105 active:scale-95 border ${
                                isDark ? 'bg-zinc-900/50 border-white/10 text-zinc-400 hover:text-white' : 'bg-white border-zinc-200 text-zinc-600'
                            }`}
                        >
                            <ArrowLeft size={16} />
                        </button>
                        <div className="flex gap-2">
                             <button
                                onClick={onVerPensamento}
                                title="Ver pensamento da IA"
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg backdrop-blur-md transition-all hover:scale-105 active:scale-95 border ${isDark
                                    ? 'bg-zinc-900/50 border-white/10 text-zinc-400 hover:text-white'
                                    : 'bg-white border-zinc-200 text-zinc-600'
                                    }`}
                            >
                                <Brain size={14} />
                                <span className="text-[11px] font-bold uppercase tracking-wider">Lógica</span>
                            </button>
                            <button
                                className={`p-2 rounded-lg backdrop-blur-md transition-all hover:scale-105 active:scale-95 border ${
                                    isDark ? 'bg-zinc-900/50 border-white/10 text-zinc-400' : 'bg-white border-zinc-200 text-zinc-600'
                                }`}
                            >
                                <Share2 size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* 2. Professional Identity Area */}
                <div className="px-6 relative">
                    <div className="flex justify-between items-end -mt-8 mb-4">
                        <div className={`relative p-1 rounded-2xl ${isDark ? 'bg-zinc-900' : 'bg-white'} shadow-xl border ${isDark ? 'border-white/10' : 'border-zinc-200'}`}>
                            <div className="w-20 h-20 rounded-xl overflow-hidden relative">
                                <img src={getAvatarUrl(selectedPillar)} alt={cargo} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 ring-1 ring-inset ring-black/5" />
                            </div>
                        </div>
                        <button
                            onClick={() => handleRedoPillar(selectedPillar)}
                            className={`px-4 py-2 rounded-lg text-[12px] font-bold border transition-all active:scale-95 shadow-sm ${isDark
                                ? 'bg-zinc-800 border-white/10 text-white hover:bg-zinc-700'
                                : 'bg-white border-zinc-200 text-zinc-900 hover:bg-zinc-50'
                                }`}
                        >
                            Nova Análise
                        </button>
                    </div>

                    {/* 3. Typography & Info */}
                    <div className="space-y-1 mb-5">
                        <div className="flex items-center gap-2">
                            <h2 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                                {cargo}
                            </h2>
                            <BadgeCheck size={18} className="text-blue-500 fill-blue-500/10" />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`text-[11px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded ${isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-500'}`}>
                                {selectedPillar.replace(/_/g, ' ')}
                            </span>
                        </div>
                    </div>

                    {/* 4. Description / Bio */}
                    <div className={`text-[13px] leading-relaxed mb-6 font-normal ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                        {bio}
                    </div>

                    {/* 5. Metadata Bar (Location, Joined, etc) */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-zinc-500 text-[13px] font-medium">
                        <div className="flex items-center gap-1">
                            <MapPin size={14} />
                            <span>Mercado Real-time</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-4">
                            <button
                                onClick={() => setShowAllSources(!showAllSources)}
                                className="flex items-center gap-1 transition-colors text-blue-500 hover:text-blue-400 active:scale-95"
                            >
                                <Link2 size={13} />
                                <span className={`text-[13px] font-bold ${showAllSources ? 'underline' : ''}`}>
                                    {showAllSources ? 'Recolher' : `Ver Fontes (${allSources.length})`}
                                </span>
                            </button>

                            {showAllSources && allSources.map((src, idx) => {
                                const hostname = getHostname(src);
                                const favicon = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
                                return (
                                    <a
                                        key={idx}
                                        href={src}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 text-[13px] font-normal text-zinc-400 hover:text-white transition-colors"
                                    >
                                        <img src={favicon} alt="" className="w-3.5 h-3.5 rounded-sm shrink-0 object-contain" />
                                        <span>{hostname}</span>
                                    </a>
                                );
                            })}
                        </div>
                        <div className="flex items-center gap-1">
                            <Calendar size={14} />
                            <span>Cálculo Março 2026</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-6 py-6 shrink-0">
                <div className="flex items-center justify-between mb-4">
                    <h3 className={`text-[10px] font-bold uppercase tracking-[0.2em] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                        Entregáveis Estratégicos
                    </h3>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-2 hide-scrollbar">
                    {(() => {
                        // Resolve all items (Somente os planejados para não duplicar visualmente)
                        const allStories: Array<{ title: string; isDone: boolean; icon: string }> = [];
                        
                        deliverables.forEach((e: any) => {
                            const title = safeRender(e.titulo).trim();
                            
                            // A tarefa está pronta se a tarefa_origem estiver no set de done
                            // Consideramos variações possíveis de taskId (ex: task_1, publico_alvo_task_1)
                            const originId = e.tarefa_origem || '';
                            const isDone = done.has(originId) || 
                                           done.has(`${selectedPillar}_${originId}`) ||
                                           (originId && Array.from(done).some(d => d.endsWith(`_${originId.replace(/^task_/, '')}`)));

                            allStories.push({
                                title,
                                isDone: isDone,
                                icon: ferramentaIcon(e.ferramenta),
                            });
                        });

                        return allStories.map((story, i) => (
                            <div
                                key={`${story.title}_${i}`}
                                onClick={() => setActiveTab('feed')}
                                title={story.title}
                                className="flex flex-col items-center gap-2 shrink-0 transition-all cursor-pointer hover:scale-105 active:scale-95 group"
                            >
                                <div className="w-14 h-14 flex items-center justify-center transition-all">
                                    <img 
                                        src={story.icon} 
                                        alt="" 
                                        className={`w-8 h-8 object-contain transition-all ${
                                            story.isDone ? 'grayscale-0 opacity-100' : 'grayscale opacity-25'
                                        }`} 
                                    />
                                </div>
                                <span className={`text-[10px] text-center w-20 line-clamp-1 tracking-tight ${
                                    story.isDone 
                                        ? (isDark ? 'text-zinc-200' : 'text-zinc-800')
                                        : (isDark ? 'text-zinc-500' : 'text-zinc-400')
                                }`}>
                                    {story.title}
                                </span>
                            </div>
                        ));
                    })()}
                </div>
            </div>

            {/* ─── Content Area / Files (Directory View) ─── */}
            <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto pt-4 pb-20 hide-scrollbar px-2">
                    {hasDocs ? (
                        <DocumentsTab
                            docsForDropdown={docsForDropdown}
                            visibleTasks={visibleTasks}
                            selectedPillar={selectedPillar}
                            openFolders={openFolders}
                            setOpenFolders={setOpenFolders}
                            session={session}
                            loadingDoc={loadingDoc}
                            setLoadingDoc={setLoadingDoc}
                            isDark={isDark}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 opacity-50">
                            <FileText size={48} className="mb-4 text-zinc-600" />
                            <p className="text-sm font-bold uppercase tracking-widest text-zinc-500">
                                Nenhum arquivo disponível
                            </p>
                        </div>
                    )}
                </div>
            </div>
            <style jsx global>{`
                .hide-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                .hide-scrollbar::-webkit-scrollbar {
                    display: none;
                }
            `}</style>
        </div>
    );
}
