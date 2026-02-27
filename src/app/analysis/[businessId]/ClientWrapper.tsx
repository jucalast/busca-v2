'use client';

import React, { useState, useCallback, useEffect } from 'react';
import PillarWorkspace from '@/components/PillarWorkspace';
import BusinessMindMap from '@/components/BusinessMindMap';
import SidebarLayout from '@/components/SidebarLayout';
import ParticleLoader from '@/components/ParticleLoader';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useSidebar } from '@/contexts/SidebarContext';

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
    const { logout, aiModel } = useAuth();

    // Derived UI View from URL Match
    const viewMode = activeSlug === 'especialistas' ? 'hub' : 'workspace';
    const activePillarTarget = viewMode === 'workspace' ? activeSlug : null;

    // States that govern the heavy workspaces
    const [growthData, setGrowthData] = useState<any>(initialGrowthData);
    const [profile, setProfile] = useState<any>(initialProfile);
    const [mindMapPillarStates, setMindMapPillarStates] = useState<Record<string, any>>({});
    const [mindMapCompletedTasks, setMindMapCompletedTasks] = useState<Record<string, Set<string>>>({});
    const [pillarStatus, setPillarStatus] = useState<Record<string, any>>({});
    const [isReanalyzing, setIsReanalyzing] = useState(false);
    const [reanalyzeProgress, setReanalyzeProgress] = useState('');
    const [reanalyzeThoughts, setReanalyzeThoughts] = useState<string[]>([]);

    const { setRightSidebarContent } = useSidebar();

    // ─── Re-Analysis Handling ───
    const handleRedoAnalysis = useCallback(async () => {
        if (!profile || !growthData?.analysis_id) {
            router.push('/');
            return;
        }

        setIsReanalyzing(true);
        setReanalyzeProgress('Iniciando nova análise...');
        setReanalyzeThoughts([]);

        try {
            const res = await fetch('/api/growth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'analyze',
                    aiModel,
                    profile,
                    region: 'br-pt',
                    business_id: currentBusinessId,
                    user_id: userId,
                    analysis_id: growthData.analysis_id,
                }),
            });

            if (!res.ok || !res.body) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Falha na reanálise');
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const parts = buffer.split('\n\n');
                buffer = parts.pop() ?? '';

                for (const part of parts) {
                    const line = part.trim();
                    if (!line.startsWith('data: ')) continue;

                    const payload = JSON.parse(line.slice(6));
                    if (payload.type === 'thought') {
                        setReanalyzeThoughts(prev => [payload.text, ...prev].slice(0, 15));
                        setReanalyzeProgress(payload.text);
                    } else if (payload.type === 'result') {
                        const data = payload.data;
                        if (!data.success) throw new Error(data.error || 'Falha na reanálise');

                        // refresh state and route (reuse same page if business_id unchanged)
                        setGrowthData(data);
                        setProfile(data.profile);
                        setMindMapPillarStates({});
                        setMindMapCompletedTasks({});

                        if (data.business_id && data.business_id !== currentBusinessId) {
                            router.push(`/analysis/${data.business_id}`);
                        }
                    } else if (payload.type === 'error') {
                        throw new Error(payload.message || 'Erro na reanálise');
                    }
                }
            }
        } catch (err: any) {
            setReanalyzeProgress(err.message || 'Erro na reanálise');
        } finally {
            setIsReanalyzing(false);
        }
    }, [aiModel, currentBusinessId, growthData?.analysis_id, profile, router, userId]);

    const handlePillarStateChange = useCallback((states: Record<string, any>, completed: Record<string, Set<string>>) => {
        setMindMapPillarStates(states);
        setMindMapCompletedTasks(completed);
    }, []);

    // Update the persistent sidebar content (Mind Map)
    useEffect(() => {
        if (growthData) {
            setRightSidebarContent(
                <BusinessMindMap
                    score={growthData.score}
                    specialists={growthData.specialists || {}}
                    marketData={growthData.marketData || null}
                    pillarStates={mindMapPillarStates}
                    completedTasks={mindMapCompletedTasks}
                    userProfile={userProf}
                />
            );
        } else {
            setRightSidebarContent(null);
        }

        // Cleanup when unmounting or changing
        return () => setRightSidebarContent(null);
    }, [growthData, mindMapPillarStates, mindMapCompletedTasks, userProf, setRightSidebarContent]);

    return (
        <div className="relative h-full">
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
                aiModel={aiModel}
                reanalysisState={{ isReanalyzing, progress: reanalyzeProgress, thoughts: reanalyzeThoughts }}
            />

            {isReanalyzing && (
                <div className="absolute inset-0 z-50">
                    <ParticleLoader progress={reanalyzeProgress} thoughts={reanalyzeThoughts} />
                </div>
            )}
        </div>
    );
}
