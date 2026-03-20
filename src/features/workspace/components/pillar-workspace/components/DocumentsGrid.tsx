'use client';

import React from 'react';
import { DocItem } from './DocumentsTab';
import { MarkdownContent } from '@/features/shared/components/MarkdownContent';
import { BadgeCheck, Heart, MessageCircle, Send, Bookmark, MoreHorizontal } from 'lucide-react';

interface DocumentsGridProps {
    docs: DocItem[];
    isDark: boolean;
    getAvatarUrl: (key: string) => string;
    selectedPillar: string;
    cargo: string;
    onOpen: (doc: DocItem) => void;
}

export function DocumentsGrid({ docs, isDark, getAvatarUrl, selectedPillar, cargo, onOpen }: DocumentsGridProps) {
    if (!docs.length) return null;

    return (
        <div className="grid grid-cols-1 gap-6 px-4">
            {docs.map((doc, i) => {
                const content = doc.result?.conteudo || '';
                const opinion = doc.result?.opiniao || '';
                const title = doc.title || 'Novo Entregável';
                
                return (
                    <div 
                        key={`${doc.tid}_${doc.idx}`}
                        className={`rounded-xl border overflow-hidden transition-all duration-300 ${
                            isDark ? 'bg-zinc-900/50 border-white/10' : 'bg-white border-zinc-200'
                        }`}
                    >
                        {/* Post Header */}
                        <div className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full overflow-hidden border border-zinc-700/50">
                                    <img src={getAvatarUrl(selectedPillar)} alt={cargo} className="w-full h-full object-cover" />
                                </div>
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-1">
                                        <span className={`text-[13px] font-black italic tracking-tight ${isDark ? 'text-white' : 'text-zinc-900'}`}>{cargo}</span>
                                        <BadgeCheck size={14} className="fill-blue-500 text-white" />
                                    </div>
                                    <span className="text-[11px] text-zinc-500 font-medium">@{selectedPillar} • IA Specialist</span>
                                </div>
                            </div>
                            <button className="text-zinc-500">
                                <MoreHorizontal size={18} />
                            </button>
                        </div>

                        {/* Post Content Area */}
                        <div 
                            onClick={() => onOpen(doc)}
                            className={`aspect-square relative flex flex-col p-8 cursor-pointer group overflow-hidden ${
                                isDark ? 'bg-gradient-to-br from-zinc-800 to-black' : 'bg-gradient-to-br from-zinc-50 to-zinc-100'
                            }`}
                        >
                            {/* Visual background element */}
                            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                                <img src="/docs.png" alt="" className="w-32 h-32 object-contain" />
                            </div>

                            <div className="relative z-10 flex flex-col h-full">
                                <h3 className={`text-xl font-black italic tracking-tight mb-4 ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                                    {title}
                                </h3>
                                <div className={`flex-1 overflow-hidden mask-fade-bottom text-[13px] leading-relaxed ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                                    {opinion || content.substring(0, 300) + '...'}
                                </div>
                                
                                <div className="mt-4">
                                    <span className="px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-500 text-[10px] font-bold uppercase tracking-widest border border-blue-500/20 group-hover:bg-blue-500 group-hover:text-white transition-all">
                                        Ver Documento Completo
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Post Actions */}
                        <div className="p-4 pb-2 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <Heart size={22} className={isDark ? 'text-white' : 'text-zinc-900'} />
                                <MessageCircle size={22} className={isDark ? 'text-white' : 'text-zinc-900'} />
                                <Send size={22} className={isDark ? 'text-white' : 'text-zinc-900'} />
                            </div>
                            <Bookmark size={22} className={isDark ? 'text-white' : 'text-zinc-900'} />
                        </div>

                        {/* Likes & Caption */}
                        <div className="p-4 pt-0 space-y-1.5">
                            <p className={`text-[13px] font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                                1.024 curtidas
                            </p>
                            <div className="text-[13px] leading-snug">
                                <span className={`font-bold mr-2 ${isDark ? 'text-white' : 'text-zinc-900'}`}>{cargo}</span>
                                <span className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>
                                    Novo entregável concluído no pilar de {cargo.toLowerCase()}. 
                                    Acesse para conferir a estratégia completa e os próximos passos.
                                </span>
                            </div>
                            <p className="text-[11px] text-zinc-500 uppercase font-bold tracking-widest pt-2">
                                HÁ 2 HORAS
                            </p>
                        </div>
                    </div>
                );
            })}
            <style jsx>{`
                .mask-fade-bottom {
                    mask-image: linear-gradient(to bottom, black 60%, transparent 100%);
                }
            `}</style>
        </div>
    );
}
