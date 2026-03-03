'use client';

import React, { useState } from 'react';
import type { TreeNodeData } from '../types';

// Folder SVG icons matching the HTML reference exactly
function FolderFilled({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
        </svg>
    );
}

function FolderOutline({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
    );
}

interface TreeNodeProps {
    node: TreeNodeData;
    depth?: number;
    isLast?: boolean;
    activeId?: string;
    onSelect?: (node: TreeNodeData) => void;
    isRoot?: boolean;
}

export function TreeNode({ node, depth = 0, isLast = false, activeId, onSelect, isRoot = false }: TreeNodeProps) {
    const [isOpen, setIsOpen] = useState(false);
    const hasChildren = node.children && node.children.length > 0;
    const isActive = activeId === node.id;

    const handleClick = () => {
        if (hasChildren) setIsOpen(prev => !prev);
        onSelect?.(node);
    };

    return (
        <div className="relative" style={{ position: 'relative' }}>
            {/* Tree connector lines (only for non-root nodes inside a tree-group) */}
            {!isRoot && (
                <>
                    {/* Vertical line (::before) */}
                    <div
                        style={{
                            position: 'absolute',
                            top: -12,
                            left: -12,
                            width: 1,
                            background: '#333333',
                            bottom: isLast ? 'auto' : 0,
                            height: isLast ? 28 : undefined,
                        }}
                    />
                    {/* Horizontal line (::after) */}
                    <div
                        style={{
                            position: 'absolute',
                            top: 15,
                            left: -12,
                            width: 12,
                            height: 1,
                            background: '#333333',
                        }}
                    />
                </>
            )}

            {/* Node content */}
            <div
                onClick={handleClick}
                className="cursor-pointer"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '6px 10px',
                    borderRadius: 8,
                    gap: 10,
                    marginBottom: 2,
                    fontSize: 14,
                    color: isActive ? '#ffffff' : '#a0a0a5',
                    background: isActive ? '#2c2c2e' : 'transparent',
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
                {/* Folder icon */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, flexShrink: 0 }}>
                    {isActive ? <FolderFilled /> : <FolderOutline />}
                </div>

                {/* Label */}
                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {node.label}
                </span>

                {/* Badge */}
                {node.badge != null && (
                    <span
                        style={{
                            background: isActive ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)',
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontSize: 11,
                            color: isActive ? '#ffffff' : '#a0a0a5',
                            fontWeight: 500,
                            flexShrink: 0,
                        }}
                    >
                        {node.badge}
                    </span>
                )}
            </div>

            {/* Children (tree-group) */}
            {hasChildren && isOpen && (
                <ul style={{ listStyle: 'none', paddingLeft: 24, margin: 0 }}>
                    {node.children!.map((child, i) => (
                        <li key={child.id}>
                            <TreeNode
                                node={child}
                                depth={depth + 1}
                                isLast={i === node.children!.length - 1}
                                activeId={activeId}
                                onSelect={onSelect}
                            />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
