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
        <div className={`w-[45%] flex flex-col pt-0 relative z-10 overflow-y-auto hide-scrollbar border-r transition-all duration-300 ${
            isDark ? 'bg-[--color-bg]/90 backdrop-blur-3xl border-white/10' : 'bg-white border-gray-100'
        }`}>
            {/* ─── Social Profile Header ─── */}
            <div className="relative shrink-0">
                {/* 1. Cover Image */}
                <div className={`h-32 w-full relative overflow-hidden ${
                    isDark ? 'bg-gradient-to-br from-zinc-800 to-zinc-900' : 'bg-gradient-to-br from-slate-100 to-slate-200'
                }`}>
                    {/* Decorative pattern/blur for cover */}
                    <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
                    
                    {/* Pillar colored shadows/glows */}
                    <div className="absolute -bottom-16 -right-16 w-64 h-64 blur-3xl rounded-full opacity-30" style={{ backgroundColor: meta.color }} />
                    <div className="absolute -top-16 -left-16 w-48 h-48 blur-3xl rounded-full opacity-10" style={{ backgroundColor: meta.color }} />
                    
                    {/* Top Floating Buttons */}
                    <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-20">
                        <button 
                            onClick={onBack} 
                            className="p-2 rounded-full bg-black/20 backdrop-blur-md text-white hover:bg-black/40 hover:scale-110 active:scale-95 transition-all"
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <div className="flex gap-2">
                            <button 
                                onClick={onVerPensamento}
                                title="Ver pensamento da IA"
                                className="p-2 rounded-full bg-black/20 backdrop-blur-md text-white hover:bg-black/40 hover:scale-110 active:scale-95 transition-all"
                            >
                                <Brain size={16} />
                            </button>
                            <button 
                                className="p-2 rounded-full bg-black/20 backdrop-blur-md text-white hover:bg-black/40 hover:scale-110 active:scale-95 transition-all"
                            >
                                <Share2 size={16} />
                            </button>
                            <button 
                                className="p-2 rounded-full bg-black/20 backdrop-blur-md text-white hover:bg-black/40 hover:scale-110 active:scale-95 transition-all"
                            >
                                <MoreHorizontal size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* 2. Avatar & Action Button */}
                <div className="px-6 relative">
                    <div className="flex justify-between items-end -mt-10 mb-4">
                        <div className={`relative p-1 rounded-full ${isDark ? 'bg-[--color-bg]' : 'bg-white'}`}>
                            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-transparent relative">
                                <img src={getAvatarUrl(selectedPillar)} alt={cargo} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 ring-4 ring-inset ring-black/5" />
                            </div>
                        </div>
                        <button 
                            onClick={() => handleRedoPillar(selectedPillar)}
                            className={`px-5 py-2 rounded-full text-[13px] font-bold border transition-all active:scale-95 ${
                                isDark 
                                ? 'bg-white text-black border-white hover:bg-zinc-200' 
                                : 'bg-black text-white border-black hover:bg-zinc-800'
                            }`}
                        >
                            Refazer Análise
                        </button>
                    </div>

                    {/* 3. Identity Info */}
                    <div className="space-y-1 mb-4">
                        <div className="flex items-center gap-1.5">
                            <h2 className={`text-2xl font-black italic tracking-tighter ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                                {cargo}
                            </h2>
                            <BadgeCheck size={20} className="fill-blue-500 text-white" />
                        </div>
                        <p className="text-[14px] text-zinc-500 font-medium">@{selectedPillar}</p>
                    </div>

                    {/* 4. Bio */}
                    <div className={`text-[14px] leading-relaxed mb-4 line-clamp-3 ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>
                        {bio}
                    </div>

                    {/* 5. Metadata Bar (Location, Joined, etc) */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-6 text-zinc-500 text-[13px] font-medium">
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
                            <span>Entrou em Março de 2026</span>
                        </div>
                    </div>

                    {/* 6. Social Stats */}
                    <div className={`flex gap-6 py-4 border-y ${isDark ? 'border-white/5' : 'border-zinc-100'}`}>
                        <div className="flex gap-1.5 items-center">
                            <span className={`text-[15px] font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>{score}</span>
                            <span className="text-[13px] text-zinc-500 font-medium">Pontos</span>
                        </div>
                        <div className="flex gap-1.5 items-center">
                            <span className={`text-[15px] font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>{doneCount}</span>
                            <span className="text-[13px] text-zinc-500 font-medium">Tasks</span>
                        </div>
                        <div className="flex gap-1.5 items-center">
                            <span className={`text-[15px] font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>{deliverables.length}</span>
                            <span className="text-[13px] text-zinc-500 font-medium">Destaques</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── Highlights (Destaques) Section ─── */}
            <div className="p-6 shrink-0">
                <p className={`text-[11px] font-black uppercase tracking-widest mb-4 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    Destaques da Estratégia
                </p>
                <div className="flex gap-5 overflow-x-auto pb-4 hide-scrollbar">
                    {/* Dummy "Novo" Highlight */}
                    <div className="flex flex-col items-center gap-2 shrink-0 group cursor-pointer" onClick={onVerPensamento}>
                        <div className={`w-16 h-16 rounded-full border-2 border-dashed flex items-center justify-center transition-all ${
                            isDark ? 'border-zinc-800 text-zinc-600 group-hover:border-zinc-600' : 'border-zinc-200 text-zinc-400 group-hover:border-zinc-400'
                        }`}>
                            <RefreshCw size={20} className="group-hover:rotate-180 transition-transform duration-700" />
                        </div>
                        <span className="text-[10px] font-bold text-zinc-500">Scan</span>
                    </div>

                    {/* Deliverables (Finished) */}
                    {[...docsForDropdown].reverse().map((doc, i) => (
                        <div 
                            key={`${doc.tid}_${doc.idx}`} 
                            onClick={() => setActiveTab('feed')}
                            className="flex flex-col items-center gap-2 shrink-0 group cursor-pointer scale-100 hover:scale-105 transition-transform"
                        >
                            <div className="w-16 h-16 rounded-full p-[2px] transition-all bg-gradient-to-tr from-yellow-400 via-fuchsia-600 to-purple-600 group-hover:scale-110">
                                <div className={`w-full h-full rounded-full p-[2px] ${isDark ? 'bg-black' : 'bg-white'}`}>
                                    <div className={`w-full h-full rounded-full flex items-center justify-center ${
                                        isDark ? 'bg-zinc-900 border border-white/5' : 'bg-zinc-50 border border-black/5'
                                    }`}>
                                        <img src={ferramentaIcon(doc.result?.ferramenta || 'documento')} alt="" className="w-6 h-6 object-contain opacity-70" />
                                    </div>
                                </div>
                            </div>
                            <span className={`text-[10px] font-bold text-center w-16 line-clamp-1 ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
                                {doc.title}
                            </span>
                        </div>
                    ))}

                    {/* Planned Fallback (Upcoming) */}
                    {deliverables.map((e: any, i: number) => {
                        // Avoid showing if it's already in finished (by title matching)
                        const isDone = docsForDropdown.some(d => d.title === safeRender(e.titulo));
                        if (isDone) return null;
                        
                        return (
                            <div key={`pl-${i}`} className="flex flex-col items-center gap-2 shrink-0 group cursor-pointer scale-100 hover:scale-105 transition-transform">
                                <div className={`w-16 h-16 rounded-full border-2 p-1 transition-all ${
                                    isDark ? 'border-zinc-800' : 'border-zinc-100'
                                }`}>
                                    <div className={`w-full h-full rounded-full flex items-center justify-center ${
                                        isDark ? 'bg-zinc-900 border border-white/10' : 'bg-zinc-50 border border-black/10'
                                    }`}>
                                        <img src={ferramentaIcon(e.ferramenta)} alt="" className="w-6 h-6 object-contain opacity-70" />
                                    </div>
                                </div>
                                <span className={`text-[10px] font-bold text-center w-16 line-clamp-1 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                                    {safeRender(e.titulo)}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ─── Content Feed / Documents ─── */}
            <div className="flex-1 flex flex-col min-h-0">
                <div className={`flex border-b transition-all duration-300 overflow-x-auto hide-scrollbar shrink-0 ${isDark ? 'border-white/5' : 'border-zinc-100'}`}>
                    <button 
                        onClick={() => setActiveTab('feed')}
                        className={`px-8 py-4 text-[12px] font-black uppercase tracking-widest border-b-2 transition-all shrink-0 ${
                            activeTab === 'feed'
                            ? (isDark ? 'text-white border-white' : 'text-zinc-900 border-black')
                            : 'text-zinc-500 border-transparent hover:text-zinc-400'
                        }`}
                    >
                        Feed
                    </button>
                    <button 
                        onClick={() => setActiveTab('arquivos')}
                        className={`px-8 py-4 text-[12px] font-black uppercase tracking-widest border-b-2 transition-all shrink-0 ${
                            activeTab === 'arquivos'
                            ? (isDark ? 'text-white border-white' : 'text-zinc-900 border-black')
                            : 'text-zinc-500 border-transparent hover:text-zinc-400'
                        }`}
                    >
                        Arquivos
                    </button>
                    <button className="px-8 py-4 text-[12px] font-black uppercase tracking-widest text-zinc-500 opacity-30 cursor-not-allowed shrink-0">
                        Insights
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto pt-6 pb-20 hide-scrollbar">
                    {activeTab === 'feed' ? (
                        hasDocs ? (
                            <DocumentsGrid 
                                docs={[...docsForDropdown].reverse()}
                                isDark={isDark}
                                getAvatarUrl={getAvatarUrl}
                                selectedPillar={selectedPillar}
                                cargo={cargo}
                                onOpen={(doc) => {
                                    const formats = doc.result?.export_formats || (doc.result?.conteudo ? ['google_docs'] : []);
                                    handleDocOpen(doc, formats[0] || 'google_docs');
                                }}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 opacity-50">
                                <FileText size={48} className="mb-4 text-zinc-600" />
                                <p className="text-sm font-bold uppercase tracking-widest text-zinc-500">
                                    Nenhum entregável disponível
                                </p>
                            </div>
                        )
                    ) : hasDocs ? (
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
                                Nenhum entregável disponível
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
