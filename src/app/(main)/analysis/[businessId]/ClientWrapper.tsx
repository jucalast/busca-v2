'use client';

import React, { useState, useCallback, useEffect } from 'react';
import PillarWorkspace from '@/features/workspace/components/pillar-workspace';
import BusinessMindMap from '@/features/analysis/components/business-mind-map';
import AnalysisExecutionLoader from '@/features/shared/components/analysis-execution-loader';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
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
    const { aiModel } = useAuth();
    const params = useParams();
    const activeSlugFromUrl = (params?.slug as string) || 'especialistas';

    // UI View logic
    const viewMode = activeSlugFromUrl === 'especialistas' ? 'hub' : 'workspace';
    const activePillarTarget = viewMode === 'workspace' ? activeSlugFromUrl : null;

    // States
    const [growthData, setGrowthData] = useState<any>(initialGrowthData);
    const [profile, setProfile] = useState<any>(initialProfile);
    const [mindMapPillarStates, setMindMapPillarStates] = useState<Record<string, any>>({});
    const [mindMapCompletedTasks, setMindMapCompletedTasks] = useState<Record<string, Set<string>>>({});
    const [isReanalyzing, setIsReanalyzing] = useState(false);
    const [showReanalyzeModal, setShowReanalyzeModal] = useState(false);
    const [reanalyzeProgress, setReanalyzeProgress] = useState('');
    const [reanalyzeThoughts, setReanalyzeThoughts] = useState<string[]>([]);
    const [reanalyzeEvents, setReanalyzeEvents] = useState<any[]>([]);
    const [reanalyzeSubtasks, setReanalyzeSubtasks] = useState<any[]>([]);
    const [reanalyzeStatuses, setReanalyzeStatuses] = useState<Record<number, 'waiting' | 'running' | 'done' | 'error'>>({});
    const [reanalyzeResults, setReanalyzeResults] = useState<Record<number, any>>({});
    const [reanalyzeStep, setReanalyzeStep] = useState(0);
    const [liveMarketData, setLiveMarketData] = useState<any>(null);
    const [hasLastExecutionData, setHasLastExecutionData] = useState(false);

    const { setRightSidebarContent } = useSidebar();

    // ─── Re-Analysis Handling ───
    const handleRedoAnalysis = useCallback(async () => {
        if (!profile || !growthData?.analysis_id) {
            router.push('/');
            return;
        }

        setIsReanalyzing(true);
        setShowReanalyzeModal(true);
        setReanalyzeProgress('Iniciando análise estratégica...');
        setReanalyzeThoughts([]);
        setReanalyzeEvents([]);
        setReanalyzeSubtasks([]);
        setReanalyzeStatuses({});
        setReanalyzeResults({});
        setReanalyzeStep(0);

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
            let currentSubtaskIdx = -1;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const parts = buffer.split('\n\n');
                buffer = parts.pop() ?? '';

                for (const part of parts) {
                    const line = part.trim();
                    if (!line.startsWith('data: ')) continue;

                    try {
                        const payload = JSON.parse(line.slice(6));

                        if (payload.type === 'thought' && typeof payload.text === 'string') {
                            setReanalyzeEvents(prev => [...prev, payload]);
                            setReanalyzeThoughts(prev => [payload.text, ...prev].slice(0, 15));
                            setReanalyzeProgress(payload.text);
                            
                            // Major steps detection
                            if (payload.text.includes('Iniciando') || payload.text.includes('Pesquisando') || payload.text.includes('Calculando') || payload.text.includes('Analisando')) {
                                currentSubtaskIdx++;
                                const cleanTitle = payload.text.replace('Iniciando ', '').replace('Pesquisando ', '').replace('Calculando ', '').replace('Analizando ', '').replace('...', '');
                                setReanalyzeSubtasks(prev => [...prev, { titulo: cleanTitle }]);
                                setReanalyzeStatuses(prev => ({ ...prev, [currentSubtaskIdx]: 'running' }));
                                setReanalyzeStep(currentSubtaskIdx + 1);
                            }

                             // Accumulate thoughts in current step
                             if (currentSubtaskIdx >= 0) {
                                 setReanalyzeResults(prev => {
                                     const currentResult = prev[currentSubtaskIdx] || {};
                                     const existingOpiniao = currentResult.opiniao || '';
                                     if (existingOpiniao.includes(payload.text)) return prev;
                                     return {
                                         ...prev,
                                         [currentSubtaskIdx]: {
                                             ...currentResult,
                                             opiniao: existingOpiniao ? `${existingOpiniao}\n\n${payload.text}` : payload.text
                                         }
                                     };
                                 });
                             }
                        } else if (payload.type === 'tool') {
                            setReanalyzeEvents(prev => [...prev, payload]);
                            if (currentSubtaskIdx >= 0) {
                                setReanalyzeResults(prev => {
                                    const resData = prev[currentSubtaskIdx] || { intelligence_tools_used: [] };
                                    const tools = [...(resData.intelligence_tools_used || [])];
                                    const existingIdx = tools.findIndex(t => t.tool === payload.tool);
                                    if (existingIdx >= 0) tools[existingIdx] = payload;
                                    else tools.push(payload);
                                    return { ...prev, [currentSubtaskIdx]: { ...resData, intelligence_tools_used: tools } };
                                });
                            }
                        } else if (payload.type === 'step_result') {
                            setReanalyzeEvents(prev => [...prev, payload]);
                            const idx = currentSubtaskIdx >= 0 ? currentSubtaskIdx : 0;
                            setReanalyzeSubtasks(prev => {
                                const copy = [...prev];
                                if (copy[idx]) copy[idx].titulo = payload.title || copy[idx].titulo;
                                else copy[idx] = { titulo: payload.title };
                                return copy;
                            });
                            setReanalyzeResults(prev => ({
                                ...prev,
                                [idx]: {
                                    ...(prev[idx] || {}),
                                    opiniao: payload.opiniao || payload.opinion,
                                    sources: payload.sources || []
                                }
                            }));

                            if (payload.step === 'market' && payload.categories) {
                                setLiveMarketData({
                                    categories: payload.categories,
                                    allSources: payload.sources || []
                                });
                            }
                            setReanalyzeStatuses(prev => ({ ...prev, [idx]: 'done' }));
                        } else if (payload.type === 'result') {
                            const data = payload.data;
                            if (!data.success) throw new Error(data.error || 'Falha na reanálise');

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
                    } catch (e) {
                        console.error("Error parsing analysis stream payload:", e);
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

    const toggleAuditLog = useCallback(() => {
        setShowReanalyzeModal(prev => !prev);
    }, []);

    // Sidebar Update
    useEffect(() => {
        if (growthData) {
            setRightSidebarContent(
                <BusinessMindMap
                    score={growthData.score}
                    specialists={growthData.specialists || {}}
                    marketData={liveMarketData || growthData.marketData || null}
                    pillarStates={mindMapPillarStates}
                    completedTasks={mindMapCompletedTasks}
                    userProfile={userProf}
                />
            );
        }
        return () => setRightSidebarContent(null);
    }, [growthData, mindMapPillarStates, mindMapCompletedTasks, liveMarketData, userProf, setRightSidebarContent]);

    return (
        <div className="relative h-full">
            <PillarWorkspace
                score={growthData.score}
                specialists={growthData.specialists || {}}
                analysisId={growthData.analysis_id || null}
                businessId={currentBusinessId}
                profile={profile}
                marketData={liveMarketData || growthData.marketData || null}
                userProfile={userProf}
                onRedo={handleRedoAnalysis}
                onStateChange={handlePillarStateChange}
                onShowHistory={toggleAuditLog}
                hasHistory={reanalyzeSubtasks.length > 0}
                initialActivePillar={activePillarTarget}
                aiModel={aiModel}
                reanalysisState={{ isReanalyzing, progress: reanalyzeProgress, thoughts: reanalyzeThoughts }}
            />

            {showReanalyzeModal && (
                <div className="absolute inset-0 z-50">
                    <AnalysisExecutionLoader
                        subtasks={reanalyzeSubtasks}
                        statuses={reanalyzeStatuses}
                        results={reanalyzeResults}
                        businessName={profile?.nome_negocio || profile?.nome || 'Seu Negócio'}
                        isExecuting={isReanalyzing}
                        currentStep={reanalyzeStep}
                        onComplete={() => setShowReanalyzeModal(false)}
                    />
                </div>
            )}
        </div>
    );
}
