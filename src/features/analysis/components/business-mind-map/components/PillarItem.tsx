import React from 'react';
import { ChevronRight } from 'lucide-react';
import { scoreColor, scoreBg } from '../utils';

interface PillarItemProps {
    p: any;
    togglePillar: (key: string) => void;
    hoveredNode: string | null;
    setHoveredNode: (key: string | null) => void;
}

export function PillarItem({ p, togglePillar, hoveredNode, setHoveredNode }: PillarItemProps) {
    const Icon = p.meta.icon;
    const pillarScore = p.dim.score ?? 0;
    const isHovered = hoveredNode === p.key;

    return (
        <React.Fragment>
            {/* Pillar node */}
            <button
                className="mindmap-node absolute flex items-center gap-2.5 group"
                style={{
                    left: p.pos.side === 'left' ? p.pos.x - 220 : p.pos.x,
                    width: 220,
                    top: p.pos.y - 22,
                    justifyContent: p.pos.side === 'left' ? 'flex-end' : 'flex-start',
                    transition: 'transform 0.2s ease',
                    transform: isHovered ? 'scale(1.06)' : 'scale(1)',
                }}
                onClick={() => togglePillar(p.key)}
                onMouseEnter={() => setHoveredNode(p.key)}
                onMouseLeave={() => setHoveredNode(null)}
            >
                {/* For left-side pillars: label first, then icon */}
                {p.pos.side === 'left' && (
                    <div className="text-right min-w-0 flex-1">
                        <div className="flex items-center justify-between w-full gap-1.5">
                            <ChevronRight
                                className="w-3 h-3 flex-shrink-0 text-zinc-600 transition-transform duration-300"
                                style={{ transform: p.isExpanded ? 'rotate(180deg)' : 'rotate(180deg) scaleX(-1)' }}
                            />
                            <div className="flex items-center justify-end gap-1.5 min-w-0">
                                {pillarScore > 0 && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                                        style={{ color: scoreColor(pillarScore), backgroundColor: scoreBg(pillarScore) }}>
                                        {pillarScore}
                                    </span>
                                )}
                                <span className="text-[12px] font-semibold text-zinc-200 whitespace-nowrap overflow-hidden text-ellipsis">{p.meta.label}</span>
                            </div>
                        </div>
                        {p.tarefas.length > 0 && (
                            <div className="flex items-center justify-end gap-1.5 mt-0.5">
                                <span className="text-[9px] text-zinc-600">{p.done.size}/{p.tarefas.length}</span>
                                <div className="h-1 w-14 bg-zinc-800 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-700"
                                        style={{ width: `${(p.done.size / p.tarefas.length) * 100}%`, backgroundColor: p.meta.color }} />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Icon box */}
                <div className="w-11 h-11 flex items-center justify-center flex-shrink-0 transition-transform duration-300 relative z-10">
                    <Icon style={{ color: p.meta.color, width: 28, height: 28 }} />
                </div>

                {/* For right-side pillars: icon first, then label */}
                {p.pos.side === 'right' && (
                    <div className="text-left min-w-0 flex-1">
                        <div className="flex items-center justify-between w-full gap-1.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-[12px] font-semibold text-zinc-200 whitespace-nowrap overflow-hidden text-ellipsis">{p.meta.label}</span>
                                {pillarScore > 0 && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                                        style={{ color: scoreColor(pillarScore), backgroundColor: scoreBg(pillarScore) }}>
                                        {pillarScore}
                                    </span>
                                )}
                            </div>
                            <ChevronRight
                                className="w-3 h-3 flex-shrink-0 text-zinc-600 transition-transform duration-300"
                                style={{ transform: p.isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                            />
                        </div>
                        {p.tarefas.length > 0 && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <div className="h-1 w-14 bg-zinc-800 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-700"
                                        style={{ width: `${(p.done.size / p.tarefas.length) * 100}%`, backgroundColor: p.meta.color }} />
                                </div>
                                <span className="text-[9px] text-zinc-600">{p.done.size}/{p.tarefas.length}</span>
                            </div>
                        )}
                    </div>
                )}
            </button>

            {/* ─── Sub-items (vertical list extending outward) ─── */}
            {p.isExpanded && p.subItems.length > 0 && (() => {
                const subX = p.pos.side === 'left' ? p.pos.x - 300 : p.pos.x + 300;

                return (
                    <div
                        className="absolute"
                        style={{
                            left: p.pos.side === 'left' ? subX - 316 : subX + 16,
                            width: 300,
                            top: 0,
                            pointerEvents: 'none'
                        }}
                    >
                        {p.subItems.map((sub: any, si: number) => {
                            const subY = p.pos.y - ((p.subItems.length - 1) * 28) / 2 + si * 28;
                            const SubIcon = sub.icon;
                            return (
                                <div
                                    key={`${p.key}-s-${si}`}
                                    className="mindmap-node absolute flex items-center gap-1.5 opacity-0 animate-[fadeSlideIn_0.3s_ease_forwards]"
                                    style={{
                                        animationDelay: `${si * 40}ms`,
                                        justifyContent: p.pos.side === 'left' ? 'flex-end' : 'flex-start',
                                        top: subY - 10,
                                        width: '100%',
                                    }}
                                >
                                    {p.pos.side === 'left' && (
                                        <span className="text-[10px] leading-tight whitespace-nowrap" style={{ color: sub.color }}>
                                            {sub.label}
                                        </span>
                                    )}
                                    {SubIcon ? (
                                        <SubIcon className="w-3 h-3 flex-shrink-0" style={{ color: sub.color }} />
                                    ) : (
                                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: sub.color }} />
                                    )}
                                    {p.pos.side === 'right' && (
                                        <span className="text-[10px] leading-tight whitespace-nowrap" style={{ color: sub.color }}>
                                            {sub.label}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                );
            })()}
        </React.Fragment>
    );
}
