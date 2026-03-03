'use client';

import React, { useState } from 'react';
import type { TreeNodeData } from '../types';
import { SAMPLE_TREE, SAMPLE_TAGS } from '../constants';
import { KnowledgeBaseSidebar } from './KnowledgeBaseSidebar';
import { FolderCanvas } from './FolderCanvas';

interface KnowledgeBaseLayoutProps {
    tree?: TreeNodeData[];
    className?: string;
}

export function KnowledgeBaseLayout({ tree, className = '' }: KnowledgeBaseLayoutProps) {
    const [activeNodeId, setActiveNodeId] = useState<string | undefined>();

    const handleNodeSelect = (node: TreeNodeData) => {
        setActiveNodeId(node.id);
    };

    return (
        <div className={`flex h-full overflow-hidden ${className}`} style={{ fontFamily: "'Inter', sans-serif" }}>
            {/* Sidebar */}
            <KnowledgeBaseSidebar
                tree={tree || SAMPLE_TREE}
                tags={SAMPLE_TAGS}
                activeNodeId={activeNodeId}
                onNodeSelect={handleNodeSelect}
            />

            {/* Canvas area */}
            <div
                className="flex-1 flex items-center justify-center min-w-0"
                style={{ background: '#050505' }}
            >
                <FolderCanvas />
            </div>
        </div>
    );
}
