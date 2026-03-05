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
        <div className="mt-3 p-4 rounded-xl" style={{ backgroundColor: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center gap-2 mb-3">
                <ListTree className="w-4 h-4" style={{ color: 'var(--color-accent)' }} />
                <span className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>Subtarefas ({items.length})</span>
            </div>
            <div className="space-y-2">
                {items.map((st: any, i: number) => (
                    <div key={st.id || i} className="flex items-start gap-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-surface-hover)' }}>
                        <span className="text-[10px] font-mono mt-1 w-4" style={{ color: 'var(--color-text-ghost)' }}>{i + 1}</span>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                                <p className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>{safeRender(st.titulo)}</p>
                                <span
                                    className="text-[8px] px-1 py-0.5 rounded-md"
                                    style={{
                                        backgroundColor: st.executavel_por_ia ? 'var(--color-accent-muted)' : 'var(--color-surface-active)',
                                        color: st.executavel_por_ia ? 'var(--color-accent)' : 'var(--color-text-tertiary)'
                                    }}
                                >
                                    {st.executavel_por_ia ? 'IA' : 'Você'}
                                </span>
                            </div>
                            {st.descricao && <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>{safeRender(st.descricao)}</p>}
                            {st.tempo_estimado && (
                                <span className="text-[10px] flex items-center gap-0.5 mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                                    <Clock className="w-2.5 h-2.5" />{safeRender(st.tempo_estimado)}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            {subtasks.resultado_combinado && (
                <p className="text-[10px] mt-3 italic" style={{ color: 'var(--color-text-tertiary)' }}>
                    <Target className="w-3 h-3 inline mr-1" />{safeRender(subtasks.resultado_combinado)}
                </p>
            )}
        </div>
    );
}
