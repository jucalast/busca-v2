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
        <div className="grid grid-cols-3 gap-1 px-1">
            {docs.map((doc, i) => {
                const title = doc.title || 'Novo Entregável';
                
                return (
                    <div 
                        key={`${doc.tid}_${doc.idx}`}
                        onClick={() => onOpen(doc)}
                        className={`aspect-square relative flex flex-col items-center justify-center p-4 cursor-pointer group overflow-hidden transition-all duration-300 ${
                            isDark ? 'bg-zinc-900 border-white/5 hover:bg-zinc-800' : 'bg-zinc-50 border-zinc-200 hover:bg-zinc-100'
                        } border`}
                    >
                        {/* Background Document Icon */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                            <img src="/docs.png" alt="" className="w-20 h-20 object-contain grayscale" />
                        </div>

                        <div className="relative z-10 flex flex-col items-center text-center">
                             <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-transform group-hover:scale-110 ${
                                 isDark ? 'bg-zinc-800' : 'bg-white shadow-sm'
                             }`}>
                                <img src="/docs.png" alt="" className="w-5 h-5 object-contain" />
                             </div>
                             
                             <h3 className={`text-[11px] font-bold leading-tight px-1 line-clamp-2 ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
                                {title}
                             </h3>

                             <div className="absolute bottom-2 left-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <span className="text-[8px] font-black uppercase tracking-widest text-[#8b5cf6]">
                                     Ver Completo
                                 </span>
                             </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
