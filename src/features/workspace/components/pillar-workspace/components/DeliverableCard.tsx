import React, { useState } from 'react';
import { Loader2, ChevronUp, ChevronDown } from 'lucide-react';
import { openInGoogleDocs, getToolInfo, safeRender } from '../utils';
import { MarkdownContent } from '@/features/shared/components/MarkdownContent';

export function DeliverableCard({ deliverable, color, session, loadingState, setLoadingDoc }: { deliverable: any; color: string; session: any; loadingState: string | null; setLoadingDoc: (v: string | null) => void }) {
    const [expanded, setExpanded] = useState(true);
    const content = safeRender(deliverable.conteudo);
    const isPartial = deliverable.was_user_task;
    const pct = deliverable.percentual_completado_ia;
    const toolInfo = getToolInfo(deliverable);

    return (
        <div className="mt-4 overflow-hidden bg-white border border-gray-200 rounded-xl">
            {/* Header */}
            <div
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between p-4 transition-all duration-300 cursor-pointer hover:bg-white/40"
            >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-black/5 flex items-center justify-center shrink-0">
                        <img src={toolInfo.icon} alt={toolInfo.name} className="w-6 h-6 object-contain opacity-70 grayscale" />
                    </div>

                    <div className="flex flex-col gap-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-[14px] font-bold tracking-tight truncate" style={{ color: isPartial ? 'var(--color-warning)' : 'var(--color-text-primary)' }}>
                                {safeRender(deliverable.entregavel_titulo)}
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider bg-black/5 ${toolInfo.color}`}>
                                {toolInfo.name}
                            </span>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] font-medium" style={{ color: 'var(--color-text-tertiary)' }}>
                            {deliverable.entregavel_tipo && (
                                <span>{safeRender(deliverable.entregavel_tipo)}</span>
                            )}
                            {isPartial && pct && (
                                <>
                                    <div className="w-1 h-1 rounded-full bg-black/10" />
                                    <span style={{ color: 'var(--color-warning)' }}>IA completou {pct}%</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={(e) => { e.stopPropagation(); openInGoogleDocs(deliverable, '', session, setLoadingDoc); }}
                        disabled={loadingState === (deliverable.id || 'export')}
                        className="flex items-center gap-2.5 h-10 px-4 rounded-xl bg-black/5 text-[12px] font-bold transition-all hover:bg-black/10 disabled:opacity-50"
                        style={{ color: 'var(--color-text-primary)' }}
                    >
                        {loadingState === (deliverable.id || 'export') ? (
                            <Loader2 size={14} className="animate-spin" />
                        ) : (
                            <img src={toolInfo.icon} alt="" className="w-4 h-4 object-contain opacity-70" />
                        )}
                        <span>{loadingState === (deliverable.id || 'export') ? 'Gerando...' : `Abrir no ${toolInfo.name}`}</span>
                    </button>

                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-black/5 transition-transform duration-300" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                        <ChevronDown size={16} className="text-zinc-400" />
                    </div>
                </div>
            </div>

            {expanded && (
                <div className="px-6 pb-6 pt-2 border-t border-black/5">
                    <MarkdownContent content={content || 'Resumo final concluído.'} />
                </div>
            )}
        </div>
    );
}
