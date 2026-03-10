import React from 'react';
import { bezierPath } from '../utils';

export function SvgMapLines({ pillarNodes }: { pillarNodes: any[] }) {
    const svgLines: React.ReactNode[] = [];

    pillarNodes.forEach(p => {
        const direction = p.pos.side === 'left' ? -1 : 1;
        const targetX = p.pos.x - (direction * 30);
        const targetY = p.pos.y;

        svgLines.push(
            <path
                key={`line-${p.key}`}
                d={bezierPath(0, 0, targetX, targetY)}
                stroke={p.meta.color}
                strokeWidth={2}
                fill="none"
                markerEnd={`url(#arrow-${p.key})`}
            />
        );

        if (p.isExpanded && p.subItems.length > 0) {
            const subXBase = p.pos.side === 'left' ? p.pos.x - 300 : p.pos.x + 300;
            const startSubX = p.pos.side === 'left' ? p.pos.x - 230 : p.pos.x + 230;

            p.subItems.forEach((sub: any, si: number) => {
                const subY = p.pos.y - ((p.subItems.length - 1) * 28) / 2 + si * 28;
                const targetSubX = subXBase;

                svgLines.push(
                    <path
                        key={`sub-${p.key}-${si}`}
                        d={bezierPath(startSubX, p.pos.y, targetSubX, subY)}
                        stroke={sub.color}
                        strokeWidth={1.2}
                        fill="none"
                        markerEnd={`url(#sub-arrow-${p.key}-${si})`}
                    />
                );
            });
        }
    });

    return (
        <svg className="absolute inset-0 pointer-events-none" style={{ overflow: 'visible', width: '100%', height: '100%', zIndex: 0 }}>
            <defs>
                {pillarNodes.map(p => {
                    const direction = p.pos.side === 'left' ? -1 : 1;
                    return (
                        <React.Fragment key={`defs-${p.key}`}>
                            <marker
                                id={`arrow-${p.key}`}
                                markerWidth="16"
                                markerHeight="16"
                                refX="8"
                                refY="8"
                                orient="auto"
                            >
                                <circle cx="8" cy="8" r="3.5" fill="#ffffff" stroke={p.meta.color} strokeWidth="1.5" />
                            </marker>
                            {p.isExpanded && p.subItems.map((sub: any, si: number) => (
                                <marker
                                    key={`defs-sub-${p.key}-${si}`}
                                    id={`sub-arrow-${p.key}-${si}`}
                                    markerWidth="12"
                                    markerHeight="12"
                                    refX="6"
                                    refY="6"
                                    orient="auto"
                                >
                                    <circle cx="6" cy="6" r="2.5" fill="#ffffff" stroke={sub.color} strokeWidth="1.2" />
                                </marker>
                            ))}
                        </React.Fragment>
                    );
                })}
            </defs>

            {/* Move the origin to center to match the absolutely positioned HTML nodes */}
            <g transform={`translate(0, 0)`}>
                {/* Subtle orbit ring */}
                <circle cx={0} cy={0} r={340} fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth={1} strokeDasharray="6 12" />
                {svgLines}
            </g>
        </svg>
    );
}
