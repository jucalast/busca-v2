'use client';

import React, { useState, useMemo } from 'react';
import type { TreeNodeData, SidebarTab, TagItem } from '../types';
import { SearchBox } from './SearchBox';
import { TabSwitcher } from './TabSwitcher';
import { TreeNode } from './TreeNode';

interface KnowledgeBaseSidebarProps {
    tree: TreeNodeData[];
    tags: TagItem[];
    activeNodeId?: string;
    onNodeSelect?: (node: TreeNodeData) => void;
}

function filterTree(nodes: TreeNodeData[], query: string): TreeNodeData[] {
    if (!query.trim()) return nodes;
    const q = query.toLowerCase();
    return nodes.reduce<TreeNodeData[]>((acc, node) => {
        const childMatches = node.children ? filterTree(node.children, query) : [];
        if (node.label.toLowerCase().includes(q) || childMatches.length > 0) {
            acc.push({ ...node, children: childMatches.length > 0 ? childMatches : node.children });
        }
        return acc;
    }, []);
}

export function KnowledgeBaseSidebar({ tree, tags, activeNodeId, onNodeSelect }: KnowledgeBaseSidebarProps) {
    const [activeTab, setActiveTab] = useState<SidebarTab>('folders');
    const [searchQuery, setSearchQuery] = useState('');

    const filteredTree = useMemo(() => filterTree(tree, searchQuery), [tree, searchQuery]);
    const filteredTags = useMemo(() => {
        if (!searchQuery.trim()) return tags;
        const q = searchQuery.toLowerCase();
        return tags.filter(t => t.label.toLowerCase().includes(q));
    }, [tags, searchQuery]);

    return (
        <div
            className="flex flex-col h-full overflow-hidden flex-shrink-0"
            style={{
                width: 280,
                background: '#111111',
                borderRight: '1px solid #1f1f1f',
                fontFamily: "'Inter', sans-serif",
            }}
        >
            {/* Header + controls */}
            <div className="shrink-0 flex flex-col" style={{ padding: 16, gap: 16 }}>
                {/* Title row */}
                <div className="flex items-center justify-between">
                    <span style={{ fontSize: 15, fontWeight: 500, color: '#ffffff' }}>
                        Knowledge Base
                    </span>
                    <div className="flex items-center" style={{ gap: 8 }}>
                        {/* Add icon */}
                        <button className="flex items-center justify-center cursor-pointer" style={{ background: 'none', border: 'none', padding: 0 }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#88888e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 5v14M5 12h14" />
                            </svg>
                        </button>
                        {/* Layout icon */}
                        <button className="flex items-center justify-center cursor-pointer" style={{ background: 'none', border: 'none', padding: 0 }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#88888e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                <line x1="9" y1="3" x2="9" y2="21" />
                                <line x1="9" y1="9" x2="21" y2="9" />
                            </svg>
                        </button>
                    </div>
                </div>

                <SearchBox
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Search..."
                />

                <TabSwitcher activeTab={activeTab} onChange={setActiveTab} />
            </div>

            {/* Tree / tags content */}
            <div
                className="flex-1 overflow-y-auto"
                style={{
                    padding: '0 16px 16px 16px',
                    scrollbarWidth: 'none',
                }}
            >
                {activeTab === 'folders' ? (
                    filteredTree.length > 0 ? (
                        <div>
                            {filteredTree.map((node, i) => (
                                <TreeNode
                                    key={node.id}
                                    node={node}
                                    isLast={i === filteredTree.length - 1}
                                    activeId={activeNodeId}
                                    onSelect={onNodeSelect}
                                    isRoot
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12" style={{ color: '#88888e' }}>
                            <span style={{ fontSize: 13 }}>Nenhum resultado</span>
                        </div>
                    )
                ) : (
                    filteredTags.length > 0 ? (
                        <div>
                            {filteredTags.map((tag) => (
                                <div
                                    key={tag.id}
                                    className="cursor-pointer"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10,
                                        padding: '6px 10px',
                                        borderRadius: 8,
                                        fontSize: 14,
                                        color: '#a0a0a5',
                                        marginBottom: 2,
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                >
                                    <span style={{ flex: 1 }}>{tag.label}</span>
                                    <span style={{
                                        background: 'rgba(255,255,255,0.08)',
                                        padding: '2px 6px',
                                        borderRadius: 4,
                                        fontSize: 11,
                                        fontWeight: 500,
                                    }}>
                                        {tag.count}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12" style={{ color: '#88888e' }}>
                            <span style={{ fontSize: 13 }}>Nenhuma tag encontrada</span>
                        </div>
                    )
                )}
            </div>
        </div>
    );
}
