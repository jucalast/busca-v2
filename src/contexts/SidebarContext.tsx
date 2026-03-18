'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface SidebarContextType {
    rightSidebarContent: ReactNode | null;
    setRightSidebarContent: (content: ReactNode | null) => void;
    isDark: boolean;
    setIsDark: (isDark: boolean) => void;
    isPinned: boolean;
    setIsPinned: (isPinned: boolean) => void;
    rightSidebarPersistent: boolean;
    setRightSidebarPersistent: (persistent: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
    const [rightSidebarContent, setRightSidebarContent] = useState<ReactNode | null>(null);
    const [isDark, setIsDark] = useState(true);
    const [isPinned, setIsPinned] = useState(false);
    const [rightSidebarPersistent, setRightSidebarPersistent] = useState(false);

    // Load theme from localStorage on mount
    React.useEffect(() => {
        const savedTheme = localStorage.getItem('theme-preference');
        if (savedTheme) {
            setIsDark(savedTheme === 'dark');
        } else {
            // Default to dark mode as requested
            setIsDark(true);
        }
    }, []);
    
    // Sync theme with HTML class and localStorage
    React.useEffect(() => {
        if (isDark) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme-preference', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme-preference', 'light');
        }
    }, [isDark]);

    return (
        <SidebarContext.Provider value={{ 
            rightSidebarContent, 
            setRightSidebarContent,
            isDark,
            setIsDark,
            isPinned,
            setIsPinned,
            rightSidebarPersistent,
            setRightSidebarPersistent
        }}>
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
