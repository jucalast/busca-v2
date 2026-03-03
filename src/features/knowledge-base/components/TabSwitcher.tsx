'use client';

import React from 'react';
import type { SidebarTab } from '../types';

interface TabSwitcherProps {
    activeTab: SidebarTab;
    onChange: (tab: SidebarTab) => void;
}

export function TabSwitcher({ activeTab, onChange }: TabSwitcherProps) {
    const tabs: { id: SidebarTab; label: string }[] = [
        { id: 'folders', label: 'Folders' },
        { id: 'tags', label: 'Tags' },
    ];

    return (
        <div className="flex p-1 rounded-lg" style={{ background: '#000000' }}>
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => onChange(tab.id)}
                    className="flex-1 text-center py-1.5 text-[13px] font-medium rounded-md cursor-pointer transition-all duration-150"
                    style={{
                        background: activeTab === tab.id ? '#2c2c2e' : 'transparent',
                        color: activeTab === tab.id ? '#ffffff' : '#88888e',
                    }}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
}
