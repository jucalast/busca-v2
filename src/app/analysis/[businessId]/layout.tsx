'use client';

import React, { use } from 'react';
import SidebarLayout from '@/components/SidebarLayout';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext';

function LayoutContent({
    children,
    businessId,
    userId
}: {
    children: React.ReactNode;
    businessId: string;
    userId: string;
}) {
    const router = useRouter();
    const { logout } = useAuth();
    const { rightSidebarContent } = useSidebar();

    const handleSelectBusiness = (id: string) => {
        router.push(`/analysis/${id}`);
    };

    const handleCreateNewBusiness = () => {
        router.push('/');
    };

    const handleDeleteBusiness = async (id: string) => {
        try {
            const res = await fetch('/api/growth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete-business', business_id: id }),
            });

            const result = await res.json();
            if (!result.success) throw new Error(result.error);

            if (id === businessId) {
                router.push('/');
            }
        } catch (err: any) {
            alert('Erro ao excluir negócio: ' + err.message);
        }
    };

    const handleLogout = async () => {
        await logout();
        router.push('/login');
    };

    return (
        <SidebarLayout
            userId={userId}
            currentBusinessId={businessId}
            onSelectBusiness={handleSelectBusiness}
            onCreateNew={handleCreateNewBusiness}
            onDeleteBusiness={handleDeleteBusiness}
            onLogout={handleLogout}
            rightSidebar={rightSidebarContent || undefined}
        >
            {children}
        </SidebarLayout>
    );
}

export default function AnalysisLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ businessId: string }>;
}) {
    const { businessId } = use(params);
    const { user } = useAuth(); // We need the user ID for the sidebar

    return (
        <SidebarProvider>
            <LayoutContent businessId={businessId} userId={user?.email || ''}>
                {children}
            </LayoutContent>
        </SidebarProvider>
    );
}
