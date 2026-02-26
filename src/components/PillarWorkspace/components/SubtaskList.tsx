import React from 'react';
import { ListTree, Clock, Target } from 'lucide-react';
import { safeRender } from '../utils';

export function SubtaskList({ subtasks, color, onExecute, executingId }: {
    subtasks: any; color: string;
    onExecute: (st: any) => void; executingId: string | null;
}) {
    const items = subtasks?.subtarefas || [];
    if (!items.length) return null;

    return (
        <div className="mt-3 p-4 rounded-xl bg-[#0d0d0f]">
            <div className="flex items-center gap-2 mb-3">
                <ListTree className="w-4 h-4" style={{ color }} />
                <span className="text-xs font-semibold text-zinc-400">Subtarefas ({items.length})</span>
            </div>
            <div className="space-y-2">
                {items.map((st: any, i: number) => (
                    <div key={st.id || i} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02]">
                        <span className="text-[10px] font-mono text-zinc-600 mt-1 w-4">{i + 1}</span>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                                <p className="text-xs font-medium text-zinc-300">{safeRender(st.titulo)}</p>
                                <span className={`text-[8px] px-1 py-0.5 rounded-md ${st.executavel_por_ia
                                    ? 'bg-violet-500/10 text-violet-400'
                                    : 'bg-blue-500/10 text-blue-400'
                                    }`}>{st.executavel_por_ia ? 'IA' : 'Você'}</span>
                            </div>
                            {st.descricao && <p className="text-[11px] text-zinc-500 leading-relaxed">{safeRender(st.descricao)}</p>}
                            {st.tempo_estimado && (
                                <span className="text-[10px] text-zinc-600 flex items-center gap-0.5 mt-1">
                                    <Clock className="w-2.5 h-2.5" />{safeRender(st.tempo_estimado)}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            {subtasks.resultado_combinado && (
                <p className="text-[10px] text-zinc-600 mt-3 italic">
                    <Target className="w-3 h-3 inline mr-1" />{safeRender(subtasks.resultado_combinado)}
                </p>
            )}
        </div>
    );
}
