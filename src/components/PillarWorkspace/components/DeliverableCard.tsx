import React, { useState } from 'react';
import { Loader2, ChevronUp, ChevronDown } from 'lucide-react';
import { openInGoogleDocs, getToolInfo, safeRender } from '../utils';
import { MarkdownContent } from './MarkdownContent';

export function DeliverableCard({ deliverable, color, session, loadingState, setLoadingDoc }: { deliverable: any; color: string; session: any; loadingState: string | null; setLoadingDoc: (v: string | null) => void }) {
    const [expanded, setExpanded] = useState(true);
    const content = safeRender(deliverable.conteudo);
    const isPartial = deliverable.was_user_task;
    const pct = deliverable.percentual_completado_ia;
    const toolInfo = getToolInfo(deliverable);

    return (
        <div className={`mt-3 p-3 bg-zinc-900 rounded-xl shadow-2xl shadow-black/70 overflow-hidden ${isPartial ? '' : ''}`}>
            {/* Header */}
            <div onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center gap-2.5 p-2.5 rounded-lg transition-all duration-150 cursor-pointer hover:bg-white/[0.04]">
                {/* Tool Icon */}
                <img src={toolInfo.icon} alt={toolInfo.name} className="w-7 h-7 rounded object-contain shrink-0 opacity-60 grayscale" />

                <div className="flex-1 flex items-center gap-2 text-left min-w-0">
                    <span className={`text-[13px] font-medium ${isPartial ? 'text-amber-300' : 'text-zinc-300'}`}>
                        {safeRender(deliverable.entregavel_titulo)}
                    </span>
                    <span className={`text-[11px] ${toolInfo.color}`}>
                        {toolInfo.name}
                    </span>
                    {deliverable.entregavel_tipo && (
                        <span className="text-[11px] text-zinc-600">
                            {safeRender(deliverable.entregavel_tipo)}
                        </span>
                    )}
                    {isPartial && pct && (
                        <span className="text-[11px] text-amber-400">
                            IA completou {pct}%
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <button onClick={(e) => { e.stopPropagation(); openInGoogleDocs(deliverable, '', session, setLoadingDoc); }} disabled={loadingState === (deliverable.id || 'export')}
                        className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg transition-all duration-150 text-[11px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] disabled:opacity-50">
                        {loadingState === (deliverable.id || 'export') ? <Loader2 className="w-4 h-4 animate-spin text-zinc-400" /> : <img src={toolInfo.icon} alt="" className="w-4 h-4 rounded object-contain opacity-60 grayscale" />}
                        {loadingState === (deliverable.id || 'export') ? 'Gerando...' : `Abrir no ${toolInfo.name}`}
                    </button>
                    {expanded ? <ChevronUp className="w-4 h-4 text-zinc-600" /> : <ChevronDown className="w-4 h-4 text-zinc-600" />}
                </div>
            </div>

            {expanded && (
                <div className="px-2.5 pb-2.5 pt-0">
                    <MarkdownContent content={content || 'Resumo final concluído.'} />
                </div>
            )}
        </div>
    );
}
