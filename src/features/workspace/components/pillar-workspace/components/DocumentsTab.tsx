'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { signIn } from 'next-auth/react';
import {
    openInGoogleDocs,
    openInGoogleSheets,
    openInGoogleForms,
    exportAsCSV,
    savePendingDocAction,
    getPendingDocAction,
    clearPendingDocAction,
} from '../utils';
import { TaskItem } from '../types';
import { SearchBox } from '@/features/knowledge-base/components';

export interface DocItem {
    tid: string;
    idx: number;
    result: any;
    title: string;
}

interface DocumentsTabProps {
    docsForDropdown: DocItem[];
    visibleTasks: TaskItem[];
    selectedPillar: string;
    openFolders: Set<string>;
    setOpenFolders: React.Dispatch<React.SetStateAction<Set<string>>>;
    session: any;
    loadingDoc: string | null;
    setLoadingDoc: (id: string | null) => void;
}

// ── SVG folder icons ──────────────────────────────────────────────────────────
function FolderFilled() {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
        </svg>
    );
}
function FolderOutline() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
    );
}
function FileIcon({ color }: { color: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
            <rect x="4" y="2" width="12" height="16" rx="2" fill={color} opacity="0.15" />
            <path d="M4 4a2 2 0 0 1 2-2h8l4 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4z" stroke={color} strokeWidth="1.5" fill="none" />
            <path d="M14 2v4h4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

// ── Format helpers ────────────────────────────────────────────────────────────
function fmtIcon(fmt: string) {
    if (fmt === 'google_sheets' || fmt === 'csv') return '/sheets.png';
    if (fmt === 'google_forms') return '/forms.svg';
    return '/docs.png';
}
function fmtLabel(fmt: string) {
    if (fmt === 'google_docs') return 'Google Docs';
    if (fmt === 'google_sheets') return 'Planilha';
    if (fmt === 'google_forms') return 'Formulário';
    if (fmt === 'csv') return 'CSV';
    if (fmt === 'pdf') return 'PDF';
    return fmt;
}
function fmtColor(fmt: string) {
    if (fmt === 'google_docs') return '#4285F4';
    if (fmt === 'google_sheets') return '#34A853';
    if (fmt === 'google_forms') return '#7B68EE';
    if (fmt === 'csv') return '#F59E0B';
    if (fmt === 'pdf') return '#EF4444';
    return '#88888e';
}

// ── Shared folder SVG illustration ───────────────────────────────────────────
// Clean papers (no PDF badge), tool logos from group docs instead of Drive/Notion.
let _folderSvgCounter = 0;
function FolderSVG({ width = 260, height = 215, toolIcons }: { width?: number; height?: number; toolIcons?: string[] }) {
    const uid = React.useRef(`fs${++_folderSvgCounter}`).current;
    const fg = `${uid}-fg`;
    const ps = `${uid}-ps`;
    const fs = `${uid}-fs`;
    // Up to 3 unique tool icons
    const icons = toolIcons?.slice(0, 3) ?? [];
    return (
        <svg
            viewBox="-130 -115 260 215"
            width={width}
            height={height}
            style={{ overflow: 'visible' }}
        >
            <defs>
                <linearGradient id={fg} x1="0" y1="-75" x2="0" y2="95" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#4a4a4d" />
                    <stop offset="100%" stopColor="#3a3a3c" />
                </linearGradient>
                <filter id={ps} x="-30%" y="-20%" width="160%" height="160%">
                    <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="black" floodOpacity="0.3" />
                </filter>
                <filter id={fs} x="-10%" y="-20%" width="120%" height="150%">
                    <feDropShadow dx="0" dy="-2" stdDeviation="7.5" floodColor="black" floodOpacity="0.4" />
                </filter>
            </defs>

            <rect x="-130" y="-110" width="260" height="200" rx="20" fill="rgba(255,255,255,0.03)" />

            {/* Traseira da pasta */}
            <path
                d="M-120,60 L-120,-100 Q-120,-115 -105,-115 L-40,-115 Q-30,-115 -20,-100 L-15,-95 Q-5,-85 10,-85 L105,-85 Q120,-85 120,-70 L120,60 Z"
                fill="#38383a"
            />

            {/* Papel esquerdo */}
            <g transform="translate(-50,-50) rotate(-8)">
                <rect x="-45" y="-60" width="90" height="130" rx="8" fill="#f0f0f0" filter={`url(#${ps})`} />
            </g>

            {/* Papel central com dobra */}
            <g transform="translate(0,-60) rotate(-2)">
                <path
                    d="M-37,-65 L20,-65 L45,-40 L45,57 Q45,65 37,65 L-37,65 Q-45,65 -45,57 L-45,-57 Q-45,-65 -37,-65 Z"
                    fill="white"
                    filter={`url(#${ps})`}
                />
                <path d="M20,-65 L20,-45 Q20,-40 25,-40 L45,-40 Z" fill="#e0e0e0" />
            </g>

            {/* Papel direito (limpo, sem badge) */}
            <g transform="translate(65,-45) rotate(12)">
                <rect x="-45" y="-60" width="90" height="130" rx="8" fill="#e8e8e8" filter={`url(#${ps})`} />
            </g>

            {/* Frente da pasta */}
            <g filter={`url(#${fs})`}>
                <path
                    d="M-130,-75 L-25,-75 C5,-75 15,-15 45,-15 L130,-15 L130,75 Q130,95 110,95 L-110,95 Q-130,95 -130,75 Z"
                    fill={`url(#${fg})`}
                />
                <path
                    d="M-128,-74 L-25,-74 C5,-74 15,-14 45,-14 L128,-14"
                    fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5"
                />
            </g>

            {/* Tool icons from the actual documents */}
            {icons.map((src, i) => {
                const spacing = 46;
                const startX = -((icons.length - 1) * spacing) / 2;
                return (
                    <g key={i} transform={`translate(${startX + i * spacing}, 60)`}>
                        <circle r="25" fill="#1c1c1e" />
                        <image href={src} x="-16" y="-16" width="32" height="32" />
                    </g>
                );
            })}
        </svg>
    );
}

// ── Empty state ──────────────────────────────────────────────────────────────
function EmptyState() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, flex: 1 }}>
            <FolderSVG width={220} height={180} />
            <div style={{ textAlign: 'center' }}>
                <p className="text-sm font-medium" style={{ marginBottom: 4, color: 'var(--color-text-muted)' }}>
                    Nenhuma pasta selecionada
                </p>
                <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                    Execute uma tarefa para gerar documentos
                </p>
            </div>
        </div>
    );
}

// ── Folder card for main panel grid ──────────────────────────────────────────
function TaskFolderCard({
    group,
    onClick,
}: {
    group: { tid: string; taskTitle: string; docs: DocItem[] };
    onClick: () => void;
}) {
    // Collect unique tool icons from this group's docs
    const toolIcons = useMemo(() => {
        const seen = new Set<string>();
        const icons: string[] = [];
        for (const doc of group.docs) {
            const fmts: string[] = doc.result.export_formats || (doc.result.conteudo ? ['google_docs'] : []);
            const icon = fmtIcon(fmts[0] || 'google_docs');
            if (!seen.has(icon)) { seen.add(icon); icons.push(icon); }
        }
        return icons;
    }, [group.docs]);

    return (
        <div
            onClick={onClick}
            className="cursor-pointer group flex flex-col items-center justify-between rounded-lg transition-all duration-150 ease-out"
            style={{ userSelect: 'none', height: 130, width: '100%', padding: '10px 8px 8px' }}
        >
            <FolderSVG width={72} height={60} toolIcons={toolIcons} />
            <div style={{ width: '100%', textAlign: 'center' }}>
                <p className="text-[11px] font-medium transition-colors" title={group.taskTitle} style={{
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2, color: 'var(--color-text-tertiary)',
                }}>
                    {group.taskTitle}
                </p>
                <span className="text-[10px] font-medium" style={{ color: 'var(--color-text-muted)' }}>
                    {group.docs.length} {group.docs.length === 1 ? 'doc' : 'docs'}
                </span>
            </div>
        </div>
    );
}

// ── Document card (looks like a real document page with tool icon overlay) ───
function DocCard({
    doc,
    onOpen,
    loadingDocId,
}: {
    doc: DocItem;
    onOpen: (doc: DocItem, fmt: string) => void;
    loadingDocId: string | null;
}) {
    const formats: string[] = doc.result.export_formats || (doc.result.conteudo ? ['google_docs'] : []);
    const primaryFmt = formats[0] || 'google_docs';
    const isLoading = loadingDocId === `${doc.tid}_${doc.idx}_${primaryFmt}`;

    return (
        <div
            onClick={() => onOpen(doc, primaryFmt)}
            className="cursor-pointer group relative flex flex-col rounded-lg bg-transparent hover:bg-white/[0.04] transition-all duration-300 ease-out"
            style={{ padding: '8px 8px 8px', gap: 6 }}
        >
            {/* Document page visual */}
            <div style={{ position: 'relative', width: '100%', aspectRatio: '3/4' }}>
                <svg viewBox="0 0 90 120" width="100%" height="100%" style={{ display: 'block' }}>
                    {/* Page shape with dog-ear */}
                    <path
                        d="M4,4 L60,4 L86,28 L86,112 Q86,116 82,116 L8,116 Q4,116 4,112 Z"
                        fill="#1c1c1e" stroke="#2a2a2e" strokeWidth="1"
                    />
                    {/* Dog-ear fold */}
                    <path d="M60,4 L60,24 Q60,28 64,28 L86,28 Z" fill="#28282c" />
                    {/* Text lines placeholder */}
                    <rect x="14" y="38" width="40" height="3" rx="1.5" fill="#333" />
                    <rect x="14" y="48" width="58" height="3" rx="1.5" fill="#2a2a2e" />
                    <rect x="14" y="56" width="50" height="3" rx="1.5" fill="#2a2a2e" />
                    <rect x="14" y="64" width="55" height="3" rx="1.5" fill="#2a2a2e" />
                    <rect x="14" y="72" width="35" height="3" rx="1.5" fill="#2a2a2e" />
                </svg>
                {/* Tool icon badge in bottom-right corner */}
                <div style={{
                    position: 'absolute', bottom: 6, right: 6,
                    width: 24, height: 24, borderRadius: 6,
                    background: 'lab(8 0 0)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    {isLoading
                        ? <Loader2 style={{ width: 14, height: 14, color: '#71717a' }} className="animate-spin" />
                        : <img src={fmtIcon(primaryFmt)} alt="" style={{ width: 16, height: 16, objectFit: 'contain' }} />
                    }
                </div>
            </div>
            {/* Title */}
            <p className="text-[11px] font-medium text-zinc-400 group-hover:text-zinc-300 transition-colors" title={doc.title} style={{
                lineHeight: '1.3',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
            }}>
                {doc.title}
            </p>
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────
export function DocumentsTab({
    docsForDropdown,
    visibleTasks,
    selectedPillar,
    session,
    loadingDoc,
    setLoadingDoc,
}: DocumentsTabProps) {
    const [selectedTid, setSelectedTid] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // After OAuth redirect: if there's a pending doc action and we now have a session, execute it.
    useEffect(() => {
        if (!session?.accessToken || session?.error === 'RefreshAccessTokenError') return;
        const pending = getPendingDocAction();
        if (!pending) return;
        clearPendingDocAction();

        // Reconstruct a minimal DocItem to reuse handleDocOpen
        const doc: DocItem = {
            tid: pending.tid,
            idx: pending.idx,
            result: pending.result,
            title: pending.title,
        };
        // Small delay so the page/session is fully settled
        setTimeout(() => handleDocOpen(doc, pending.fmt), 300);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session]);

    const docsByTask = useMemo(() => {
        const groups: Array<{ tid: string; taskTitle: string; taskIndex: number; docs: DocItem[] }> = [];
        const taskMap: Record<string, number> = {};
        for (const doc of docsForDropdown) {
            const task = visibleTasks.find(t => doc.tid === `${selectedPillar}_${t.id}`);
            const taskTitle = task?.titulo || doc.tid;
            const taskIndex = task ? visibleTasks.indexOf(task) : 0;
            if (!(doc.tid in taskMap)) {
                taskMap[doc.tid] = groups.length;
                groups.push({ tid: doc.tid, taskTitle, taskIndex, docs: [] });
            }
            groups[taskMap[doc.tid]].docs.push(doc);
        }
        return groups;
    }, [docsForDropdown, visibleTasks, selectedPillar]);

    const filteredGroups = useMemo(() => {
        if (!searchQuery.trim()) return docsByTask;
        const q = searchQuery.toLowerCase();
        return docsByTask.filter(g => g.taskTitle.toLowerCase().includes(q));
    }, [docsByTask, searchQuery]);

    const selectedGroup = useMemo(
        () => docsByTask.find(g => g.tid === selectedTid) ?? null,
        [docsByTask, selectedTid]
    );

    const handleDocOpen = (doc: DocItem, fmt: string) => {
        // Not logged in or token expired — save action and redirect to OAuth
        if (!session?.accessToken || session?.error === 'RefreshAccessTokenError') {
            savePendingDocAction({
                type: fmt as any,
                tid: doc.tid,
                idx: doc.idx,
                result: doc.result,
                title: doc.title,
                fmt,
            });
            signIn('google', { callbackUrl: window.location.href });
            return;
        }

        if (fmt === 'csv' && doc.result.structured_data) {
            exportAsCSV(doc.result.structured_data, doc.title);
        } else if (fmt === 'google_sheets' && doc.result.structured_data?.abas?.length > 0) {
            openInGoogleSheets(doc.result, session, (id) => setLoadingDoc(id ? `${doc.tid}_${doc.idx}_${fmt}` : null), `${doc.tid}_st${doc.idx}`);
        } else if (fmt === 'google_forms' && doc.result.structured_data?.secoes?.length > 0) {
            openInGoogleForms(doc.result, session, (id) => setLoadingDoc(id ? `${doc.tid}_${doc.idx}_${fmt}` : null), `${doc.tid}_st${doc.idx}`);
        } else if (fmt === 'google_docs' || fmt === 'pdf') {
            openInGoogleDocs({ ...doc.result, conteudo_completo: doc.result.conteudo }, '', session, (id) => setLoadingDoc(id ? `${doc.tid}_${doc.idx}_${fmt}` : null), `${doc.tid}_st${doc.idx}`);
        }
    };

    return (
        <div className="flex-1 flex overflow-hidden" style={{ fontFamily: "'Inter', sans-serif", minHeight: 0 }}>

            {/* ── SIDEBAR ─────────────────────────────────────────────────── */}
            <div className="flex flex-col overflow-hidden flex-shrink-0" style={{ width: 240 }}>
                {/* Tree */}
                <div className="flex-1 overflow-y-auto px-3 py-4" style={{ scrollbarWidth: 'none' }}>
                    {filteredGroups.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12" style={{ color: 'var(--color-text-muted)' }}>
                            <span className="text-[13px]">Nenhum resultado</span>
                        </div>
                    )}
                    {filteredGroups.map((group) => {
                        const isActive = selectedTid === group.tid;
                        return (
                            <div key={group.tid}>
                                {/* Root node */}
                                <div
                                    onClick={() => setSelectedTid(isActive ? null : group.tid)}
                                    className="cursor-pointer group flex items-center gap-2.5 px-3 py-3 rounded-lg transition-all duration-150 ease-out"
                                    style={{ backgroundColor: isActive ? 'var(--color-surface-active)' : 'transparent', marginBottom: 2 }}
                                >
                                    <div className="flex items-center justify-center w-4.5 h-4.5 shrink-0">
                                        {isActive ? <FolderFilled /> : <FolderOutline />}
                                    </div>
                                    <span className="flex-1 text-[12px] font-medium truncate"
                                        style={{ color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)' }}
                                        title={group.taskTitle}>
                                        {group.taskTitle}
                                    </span>
                                    <span className="text-[11px] font-medium shrink-0" style={{ color: isActive ? 'var(--color-text-secondary)' : 'var(--color-text-muted)' }}>
                                        {group.docs.length}
                                    </span>
                                </div>

                                {/* Children — documents as subtree */}
                                {isActive && group.docs.length > 0 && (
                                    <ul style={{ listStyle: 'none', paddingLeft: 24, margin: 0 }}>
                                        {group.docs.map((doc, i) => {
                                            const isLast = i === group.docs.length - 1;
                                            const formats: string[] = doc.result.export_formats || (doc.result.conteudo ? ['google_docs'] : []);
                                            const primaryFmt = formats[0] || 'google_docs';
                                            return (
                                                <li key={`${doc.tid}_${doc.idx}`} style={{ position: 'relative' }}>
                                                    {/* Vertical connector */}
                                                    <div style={{ position: 'absolute', top: -12, left: -12, width: 1, background: '#27272a', ...(isLast ? { height: 28 } : { bottom: 0 }) }} />
                                                    {/* Horizontal connector */}
                                                    <div style={{ position: 'absolute', top: 15, left: -12, width: 12, height: 1, background: '#27272a' }} />
                                                    <div
                                                        onClick={(e) => { e.stopPropagation(); handleDocOpen(doc, primaryFmt); }}
                                                        className="cursor-pointer group flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-zinc-500 hover:bg-white/[0.04] group-hover:text-zinc-300 transition-all duration-300 ease-out"
                                                        style={{ marginBottom: 2 }}
                                                    >
                                                        <img src={fmtIcon(primaryFmt)} alt="" className="w-4 h-4 object-contain shrink-0" />
                                                        <span className="flex-1 text-[12px] truncate" title={doc.title}>
                                                            {doc.title}
                                                        </span>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── MAIN PANEL ──────────────────────────────────────────────── */}
            {/* vertical divider */}
            <div className="shrink-0 w-px" style={{ backgroundColor: 'var(--color-border)' }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: '10px 10px 10px 10px' }}>
                {selectedGroup ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, borderRadius: 12, overflow: 'hidden', background: 'var(--color-surface-1)', backdropFilter: 'blur(8px)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-lg)' }}>
                        {/* Folder header */}
                        <div className="shrink-0 flex items-center gap-3" style={{ padding: '14px 20px 12px' }}>
                            <div className="flex items-center justify-center w-8 h-8 rounded shrink-0" style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-tertiary)' }}>
                                <FolderFilled />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{selectedGroup.taskTitle}</p>
                                <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                                    {selectedGroup.docs.length} {selectedGroup.docs.length === 1 ? 'documento' : 'documentos'}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedTid(null)}
                                className="text-xs cursor-pointer transition-colors duration-150 px-2 py-1 rounded-lg"
                                style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none' }}
                            >
                                ← Voltar
                            </button>
                        </div>

                        {/* Document cards grid */}
                        <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none', padding: '6px 16px 16px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 100px)', justifyContent: 'start', gap: 6 }}>
                                {selectedGroup.docs.map((doc) => (
                                    <DocCard
                                        key={`${doc.tid}_${doc.idx}`}
                                        doc={doc}
                                        onOpen={handleDocOpen}
                                        loadingDocId={loadingDoc}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                ) : filteredGroups.length > 0 ? (
                    /* Grid of folder cards — one per task */
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, borderRadius: 12, overflow: 'hidden', background: 'var(--color-surface-1)', backdropFilter: 'blur(8px)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-lg)' }}>
                        <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none', padding: '10px 14px 14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 4, alignContent: 'start' }}>
                            {filteredGroups.map((group) => (
                                <TaskFolderCard
                                    key={group.tid}
                                    group={group}
                                    onClick={() => setSelectedTid(group.tid)}
                                />
                            ))}
                        </div>
                    </div>
                ) : (
                    <EmptyState />
                )}
            </div>
        </div>
    );
}
