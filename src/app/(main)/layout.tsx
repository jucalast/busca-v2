'use client';

import React, { useState, useEffect } from 'react';
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext';
import SidebarLayout from '@/components/layout/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';

function GlobalSidebarLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { 
    rightSidebarContent, 
    isDark, 
    isPinned, 
    rightSidebarPersistent,
    setIsDark,
    setIsPinned,
    setRightSidebarPersistent
  } = useSidebar();

  // Reset or adjust sidebar state based on route if needed
  // For now, we'll let pages call setIsDark etc.

  const handleSelectBusiness = (id: string) => {
    router.push(`/analysis/${id}/especialistas`);
  };

  const handleCreateNewBusiness = () => {
    router.push('/');
  };

  const handleDeleteBusiness = async (id: string) => {
    // This is a global handler, can be customized or passed down
    try {
      const res = await fetch('/api/growth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-business', business_id: id }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      
      // If we are on the page of the deleted business, go home
      if (pathname.includes(`/analysis/${id}`)) {
        router.push('/');
      }
    } catch (err: any) {
      console.error('Failed to delete business:', err);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <SidebarLayout
      userId={user?.id || 'default_user'}
      currentBusinessId={pathname.startsWith('/analysis/') ? pathname.split('/')[2] : null}
      onSelectBusiness={handleSelectBusiness}
      onCreateNew={handleCreateNewBusiness}
      onDeleteBusiness={handleDeleteBusiness}
      onLogout={handleLogout}
      rightSidebar={rightSidebarContent || undefined}
      rightSidebarPersistent={rightSidebarPersistent}
      isDark={isDark}
      defaultPinned={isPinned}
    >
      {children}
    </SidebarLayout>
  );
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <GlobalSidebarLayout>
        {children}
      </GlobalSidebarLayout>
    </SidebarProvider>
  );
}
