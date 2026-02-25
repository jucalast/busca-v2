'use client';

import React, { useState, useCallback } from 'react';
import ParticleLoader from '@/components/ParticleLoader';
import PillarWorkspace from '@/components/PillarWorkspace';
import GrowthChat from '@/components/GrowthChat';
import SidebarLayout from '@/components/SidebarLayout';
import BusinessMindMap from '@/components/BusinessMindMap';
import AuthForm from '@/components/AuthForm';
import { useAuth } from '@/contexts/AuthContext';

type GrowthStage = 'onboarding' | 'analyzing' | 'results';

export default function Home() {
  const { user, isLoading: authLoading, isAuthenticated, logout, aiModel } = useAuth();

  // User & Business management
  const [currentBusinessId, setCurrentBusinessId] = useState<string | null>(null);

  // Growth mode state
  const [growthStage, setGrowthStage] = useState<GrowthStage>('onboarding');
  const [profile, setProfile] = useState<any>(null);
  const [growthData, setGrowthData] = useState<any>(null);
  const [growthLoading, setGrowthLoading] = useState(false);
  const [growthProgress, setGrowthProgress] = useState('');
  const [agentThoughts, setAgentThoughts] = useState<string[]>([]);
  const [error, setError] = useState('');

  // Mind map state (fed from PillarWorkspace)
  const [mindMapPillarStates, setMindMapPillarStates] = useState<Record<string, any>>({});
  const [mindMapCompletedTasks, setMindMapCompletedTasks] = useState<Record<string, Set<string>>>({});

  // Pillar agent state
  const [pillarDataMap, setPillarDataMap] = useState<Record<string, any>>({});
  const [pillarStatus, setPillarStatus] = useState<Record<string, any>>({});
  const [agentRunning, setAgentRunning] = useState(false);

  // ─── Growth mode: Chat profile ready → Run Analysis ───
  const handleChatProfileReady = async (chatProfile: any) => {
    setGrowthLoading(true);
    setGrowthStage('analyzing');
    setGrowthProgress('Gerando perfil completo e pesquisando mercado...');
    setError('');

    try {
      // First generate formal profile from chat data
      const profileRes = await fetch('/api/growth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'profile', aiModel, onboardingData: chatProfile }),
      });

      const profileResult = await profileRes.json();

      if (!profileRes.ok || !profileResult.success) {
        throw new Error(profileResult.error || profileResult.erro || 'Falha ao gerar perfil');
      }

      // Merge chat context into profile for richer analysis
      if (chatProfile._chat_context) {
        profileResult.profile = {
          ...profileResult.profile,
          _chat_context: chatProfile._chat_context,
        };
      }

      // Merge raw chat fields into formal profile so scorer sees actual user data
      const rawFields = { ...chatProfile };
      delete rawFields._research_tasks;
      delete rawFields._fields_researched;
      delete rawFields._research_pending;
      delete rawFields._chat_context;

      if (profileResult.profile?.perfil) {
        // Chat perfil fields take precedence — they use correct key names and have richer data
        const chatPerfil = chatProfile.perfil || {};
        const chatCtx = chatProfile._chat_context || {};
        profileResult.profile.perfil = {
          ...profileResult.profile.perfil, // Formal profiler base
          ...chatPerfil,                   // Chat perfil fields override (correct key names)
          ...chatCtx,                      // _chat_context fields also promoted into perfil
        };
      }

      // Pass research tasks through for task plan
      if (chatProfile._research_tasks?.length) {
        profileResult.profile._research_tasks = chatProfile._research_tasks;
      }

      setProfile(profileResult);

      // Start analysis
      setGrowthProgress('Pesquisando dados de mercado...');
      await runAnalysis(profileResult);

    } catch (err: any) {
      setError(err.message || 'Erro ao processar dados do chat.');
      setGrowthLoading(false);
      setGrowthProgress('');
      setGrowthStage('onboarding');
    }
  };

  // ─── Growth mode: Run full analysis (SSE streaming) ───
  const runAnalysis = async (profileData: any, analysisId?: string) => {
    try {
      setGrowthProgress('Iniciando análise...');
      setAgentThoughts([]);

      const res = await fetch('/api/growth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze',
          aiModel,
          profile: profileData.profile || profileData,
          region: 'br-pt',
          business_id: currentBusinessId,
          user_id: user?.id || 'default_user',
          analysis_id: analysisId, // Pass existing analysis_id for reanalysis cleanup
        }),
      });

      if (!res.ok || !res.body) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Falha na análise');
      }

      // Consume SSE stream
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
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === 'thought') {
              setAgentThoughts(prev => [event.text, ...prev].slice(0, 20));
            } else if (event.type === 'result') {
              const result = event.data;
              if (!result.success) throw new Error(result.error || 'Falha na análise');
              if (result.business_id) setCurrentBusinessId(result.business_id);
              setGrowthData(result);
              setGrowthStage('results');
            } else if (event.type === 'error') {
              throw new Error(event.message || 'Erro na análise');
            }
          } catch (parseErr: any) {
            if (parseErr.message && !parseErr.message.includes('JSON')) throw parseErr;
          }
        }
      }

      // If stream ended but we never got a result, that's an error
      // (growthStage would have been set to 'results' inside the loop if we got one)

    } catch (err: any) {
      setError(err.message || 'Erro na análise.');
      // If we never got results, go back to onboarding so the screen isn't blank
      setGrowthStage(prev => prev === 'analyzing' ? 'onboarding' : prev);
    } finally {
      setGrowthLoading(false);
      setGrowthProgress('');
    }
  };

  // ─── Business Management ───
  const handleSelectBusiness = async (businessId: string) => {
    setCurrentBusinessId(businessId);
    setGrowthLoading(true);
    setError('');

    try {
      const res = await fetch('/api/growth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get-business',
          business_id: businessId,
        }),
      });

      const result = await res.json();

      if (result.success && result.business) {
        const business = result.business;

        // Load profile
        setProfile({ profile: business.profile_data });

        // Load latest analysis if exists
        if (business.latest_analysis) {
          setGrowthData({
            success: true,
            marketData: business.latest_analysis.market_data,
            score: business.latest_analysis.score_data,
            taskPlan: business.latest_analysis.task_data,
            business_id: businessId,
            analysis_id: business.latest_analysis.id,
          });
          setGrowthStage('results');

          // Fetch pillar agent status for this business
          try {
            const psRes = await fetch('/api/growth', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'pillar-status', business_id: businessId }),
            });
            const psResult = await psRes.json();
            if (psResult.success && psResult.pillars) {
              setPillarStatus(psResult.pillars);
            }
          } catch { /* silent */ }
        } else {
          // No analysis yet, go to onboarding to create one
          setGrowthStage('onboarding');
        }
      } else {
        throw new Error('Negócio não encontrado');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar negócio');
      setGrowthStage('onboarding');
    } finally {
      setGrowthLoading(false);
    }
  };

  const handleCreateNewBusiness = () => {
    setCurrentBusinessId(null);
    setProfile(null);
    setGrowthData(null);
    setGrowthStage('onboarding');
    setError('');
  };

  // ─── Redo Analysis: Re-run with same profile data ───
  const handleRedoAnalysis = async () => {
    if (!profile) {
      handleCreateNewBusiness();
      return;
    }

    // Clear all task-related state before reanalyzing
    const currentAnalysisId = growthData?.analysis_id;
    setMindMapPillarStates({});
    setMindMapCompletedTasks({});
    setGrowthData(null); // This will clear PillarWorkspace internal state on next render
    setAgentThoughts([]);
    // Clear persisted task state for this analysis
    if (currentAnalysisId) {
      localStorage.removeItem(`pillar_workspace_${currentAnalysisId}`);
    }

    setGrowthLoading(true);
    setGrowthStage('analyzing');
    setGrowthProgress('Refazendo análise com os mesmos dados...');
    setError('');

    try {
      await runAnalysis(profile, growthData?.analysis_id);
    } catch (err: any) {
      setError(err.message || 'Erro ao refazer análise.');
      setGrowthLoading(false);
      setGrowthProgress('');
      setGrowthStage('results');
    }
  };

  const handleDeleteBusiness = async (businessId: string) => {
    try {
      const res = await fetch('/api/growth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete-business',
          business_id: businessId,
        }),
      });

      const result = await res.json();

      if (!result.success) {
        throw new Error(result.error || 'Falha ao excluir negócio');
      }

      if (businessId === currentBusinessId) {
        handleCreateNewBusiness();
      }
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao excluir negócio');
    }
  };

  // ─── Profile summary for display ───
  const getProfileSummary = () => {
    const p = profile?.profile?.perfil || {};
    return `${p.nome || '?'} — ${p.segmento || '?'} — ${p.modelo_negocio || '?'} — ${p.localizacao || '?'}`;
  };

  const handlePillarStateChange = useCallback((states: Record<string, any>, completed: Record<string, Set<string>>) => {
    setMindMapPillarStates(states);
    setMindMapCompletedTasks(completed);
  }, []);

  // ─── Pillar Agent: run autonomous agent for a pillar ───
  const handleRunPillarAgent = async (pillarKey: string, userCommand: string) => {
    if (!growthData?.business_id) return;
    setAgentRunning(true);
    setError('');

    try {
      const res = await fetch('/api/growth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'run-pillar',
          pillar_key: pillarKey,
          business_id: growthData.business_id,
          profile: profile?.profile || profile,
          user_command: userCommand,
        }),
      });

      const result = await res.json();
      if (!result.success) throw new Error(result.error || 'Erro ao executar agente');

      // Save pillar data locally
      setPillarDataMap((prev: any) => ({
        ...prev,
        [pillarKey]: { structured_output: result.data, sources: result.sources },
      }));

      // Refresh pillar status
      await fetchPillarStatus();
    } catch (err: any) {
      setError(err.message || 'Erro ao executar agente do pilar.');
    } finally {
      setAgentRunning(false);
    }
  };

  // ─── Pillar Status: check which pillars are completed ───
  const fetchPillarStatus = async () => {
    if (!growthData?.business_id) return;
    try {
      const res = await fetch('/api/growth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pillar-status',
          business_id: growthData.business_id,
        }),
      });
      const result = await res.json();
      if (result.success && result.pillars) {
        setPillarStatus(result.pillars);
      }
    } catch { /* silent */ }
  };


  // Show loading while checking auth
  if (authLoading) {
    return <div className="min-h-screen bg-[#09090b]" />;
  }


  // Show auth form if not authenticated
  if (!isAuthenticated) {
    return <AuthForm />;
  }

  const userProf = {
    name: profile?.profile?.perfil?.nome || 'Seu Negócio',
    segment: profile?.profile?.perfil?.segmento || '',
  };

  return (
    <SidebarLayout
      userId={user?.id || 'default_user'}
      currentBusinessId={currentBusinessId}
      onSelectBusiness={handleSelectBusiness}
      onCreateNew={handleCreateNewBusiness}
      onDeleteBusiness={handleDeleteBusiness}
      onLogout={logout}
      rightSidebar={growthStage === 'results' && growthData ? (
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
      {/* Chat Onboarding Stage */}
      {growthStage === 'onboarding' && !growthLoading && (
        <div className="p-6 md:p-12 h-full flex items-center justify-center">
          <div className="w-full max-w-4xl flex flex-col" style={{ height: 'calc(100vh - 200px)', minHeight: '600px' }}>
            <GrowthChat
              onProfileReady={handleChatProfileReady}
              loading={growthLoading}
            />
          </div>
        </div>
      )}

      {/* Analyzing Stage */}
      {growthStage === 'analyzing' && growthLoading && (
        <ParticleLoader progress={growthProgress} thoughts={agentThoughts} />
      )}

      {/* Results Stage — Unified */}
      {growthStage === 'results' && growthData && (
        <PillarWorkspace
          score={growthData.score}
          specialists={growthData.specialists || {}}
          analysisId={growthData.analysis_id || null}
          businessId={growthData.business_id || currentBusinessId}
          profile={profile}
          marketData={growthData.marketData || null}
          userProfile={userProf}
          onRedo={handleRedoAnalysis}
          onStateChange={handlePillarStateChange}
        />
      )}

      {/* Error */}
      {error && (
        <div className="m-6 p-4 rounded-xl bg-red-950/30 border border-red-900/50 text-red-200 text-center">
          {error}
          <button
            onClick={() => {
              setError('');
              setGrowthStage('onboarding');
              setGrowthLoading(false);
            }}
            className="block mx-auto mt-3 text-sm text-red-400 hover:text-red-300 transition-colors"
          >
            ← Tentar novamente
          </button>
        </div>
      )}
    </SidebarLayout>
  );
}
