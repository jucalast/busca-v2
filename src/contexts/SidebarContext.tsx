'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface SidebarContextType {
    rightSidebarContent: ReactNode | null;
    setRightSidebarContent: (content: ReactNode | null) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
    const [rightSidebarContent, setRightSidebarContent] = useState<ReactNode | null>(null);

    return (
        <SidebarContext.Provider value={{ rightSidebarContent, setRightSidebarContent }}>
            {children}
        </SidebarContext.Provider>
    );
}

export function useSidebar() {
    const context = useContext(SidebarContext);
    if (context === undefined) {
        throw new Error('useSidebar must be used within a SidebarProvider');
    }
    return context;
}
