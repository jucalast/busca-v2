'use client';

import React, { useState, useCallback, useEffect } from 'react';
import PillarWorkspace from '@/components/PillarWorkspace';
import BusinessMindMap from '@/components/BusinessMindMap';
import SidebarLayout from '@/components/SidebarLayout';
import GrowthHub from '@/components/GrowthHub';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface AnalysisClientWrapperProps {
    initialGrowthData: any;
    initialProfile: any;
    userProf: { name: string; segment: string };
    userId: string;
    currentBusinessId: string;
    activeSlug?: string;
}

export default function AnalysisClientWrapper({
    initialGrowthData,
    initialProfile,
    userProf,
    userId,
    currentBusinessId,
    activeSlug = 'especialistas'
}: AnalysisClientWrapperProps) {
    const router = useRouter();
    const { logout } = useAuth();

    // Derived UI View from URL Match
    const viewMode = activeSlug === 'especialistas' ? 'hub' : 'workspace';
    const activePillarTarget = viewMode === 'workspace' ? activeSlug : null;

    // States that govern the heavy workspaces
    const [growthData, setGrowthData] = useState<any>(initialGrowthData);
    const [profile, setProfile] = useState<any>(initialProfile);
    const [mindMapPillarStates, setMindMapPillarStates] = useState<Record<string, any>>({});
    const [mindMapCompletedTasks, setMindMapCompletedTasks] = useState<Record<string, Set<string>>>({});
    const [pillarStatus, setPillarStatus] = useState<Record<string, any>>({});

    // ─── Re-Analysis Handling ───
    const handleRedoAnalysis = async () => {
        // Here we'd typically trigger the same SSE stream for re-analysis, 
        // for now just redirecting back to home for re-onboarding if they want a full redo
        router.push('/');
    };

    const handlePillarStateChange = useCallback((states: Record<string, any>, completed: Record<string, Set<string>>) => {
        setMindMapPillarStates(states);
        setMindMapCompletedTasks(completed);
    }, []);

    // ─── Sidebar Handlers ───
    const handleSelectBusiness = (businessId: string) => {
        router.push(`/analysis/${businessId}`);
    };

    const handleCreateNewBusiness = () => {
        router.push('/');
    };

    const handleDeleteBusiness = async (businessId: string) => {
        try {
            const res = await fetch('/api/growth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete-business', business_id: businessId }),
            });

            const result = await res.json();
            if (!result.success) throw new Error(result.error);

            if (businessId === currentBusinessId) {
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
            currentBusinessId={currentBusinessId}
            onSelectBusiness={handleSelectBusiness}
            onCreateNew={handleCreateNewBusiness}
            onDeleteBusiness={handleDeleteBusiness}
            onLogout={handleLogout}
            rightSidebar={growthData ? (
                <BusinessMindMap
                    score={growthData.score}
                    specialists={growthData.specialists || {}}
                    marketData={growthData.marketData || null}
                    pillarStates={mindMapPillarStates}
                    completedTasks={mindMapCompletedTasks}
                    userProfile={userProf}
                />
            ) : undefined}
        >
            {viewMode === 'hub' ? (
                <GrowthHub
                    data={growthData}
                    userProfile={userProf}
                    onSelectDimension={(dim) => {
                        router.push(`/analysis/${currentBusinessId}/${dim}`);
                    }}
                    onRedo={handleRedoAnalysis}
                />
            ) : (
                <PillarWorkspace
                    score={growthData.score}
                    specialists={growthData.specialists || {}}
                    analysisId={growthData.analysis_id || null}
                    businessId={currentBusinessId}
                    profile={profile}
                    marketData={growthData.marketData || null}
                    userProfile={userProf}
                    onRedo={handleRedoAnalysis}
                    onStateChange={handlePillarStateChange}
                    initialActivePillar={activePillarTarget}
                />
            )}
        </SidebarLayout>
    );
}
