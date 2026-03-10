'use client';

import React, { useState } from 'react';
import ParticleLoader from '@/features/shared/components/particle-loader';
import AnalysisExecutionLoader from '@/features/shared/components/analysis-execution-loader';
import GrowthChat from '@/features/shared/components/growth-chat';
import SidebarLayout from '@/components/layout/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const { user, isLoading: authLoading, isAuthenticated, logout, aiModel } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // Growth mode state (Onboarding -> Analyzing -> redirect)
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [growthProgress, setGrowthProgress] = useState('');
  const [agentThoughts, setAgentThoughts] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [growthLoading, setGrowthLoading] = useState(false);
  const [analysisSubtasks, setAnalysisSubtasks] = useState<any[]>([]);
  const [analysisStatuses, setAnalysisStatuses] = useState<Record<number, 'waiting' | 'running' | 'done' | 'error'>>({});
  const [analysisResults, setAnalysisResults] = useState<Record<number, any>>({});
  const [analysisStep, setAnalysisStep] = useState(0);
  const [businessName, setBusinessName] = useState('Seu Negócio');
  // ─── Growth mode: Chat profile ready → Run Analysis ───
  const handleChatProfileReady = async (chatProfile: any) => {
    setIsAnalyzing(true);
    setBusinessName(chatProfile.nome_negocio || chatProfile.nome || 'Seu Negócio');
    setGrowthProgress('Gerando perfil completo e pesquisando mercado...');
    setError('');

    // Debug: log do perfil recebido do chat
    console.log('🔍 Chat profile received:', JSON.stringify(chatProfile, null, 2));

    try {
      // First generate formal profile from chat data
      const profileRes = await fetch('/api/growth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'profile', aiModel, onboardingData: chatProfile }),
      });

      const profileResult = await profileRes.json();

      // Debug: log do perfil gerado
      console.log('🔍 Generated profile:', JSON.stringify(profileResult, null, 2));

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
        const chatPerfil = chatProfile.perfil || {};
        const chatCtx = chatProfile._chat_context || {};
        profileResult.profile.perfil = {
          ...profileResult.profile.perfil,
          ...chatPerfil,
          ...chatCtx,
        };
      }

      if (chatProfile._research_tasks?.length) {
        profileResult.profile._research_tasks = chatProfile._research_tasks;
      }

      // Start analysis
      setGrowthProgress('Pesquisando dados de mercado...');
      await runAnalysis(profileResult);

    } catch (err: any) {
      setError(err.message || 'Erro ao processar dados do chat.');
      setIsAnalyzing(false);
      setGrowthProgress('');
    }
  };

  // ─── Growth mode: Run full analysis (SSE streaming) ───
  const runAnalysis = async (profileData: any) => {
    try {
      setGrowthProgress('Iniciando análise...');
      setAgentThoughts([]);
      setAnalysisSubtasks([]);
      setAnalysisStatuses({});
      setAnalysisResults({});
      setAnalysisStep(0);

      const res = await fetch('/api/growth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze',
          aiModel,
          profile: profileData.profile || profileData,
          region: 'br-pt',
          business_id: null,
          user_id: user?.id || 'default_user',
          analysis_id: undefined,
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
            const event = JSON.parse(line.slice(6));

            if (event.type === 'thought') {
              setAgentThoughts(prev => [event.text, ...prev].slice(0, 20));
              setGrowthProgress(event.text);

              // If it sounds like a new major step, create a running subtask
              if (event.text.includes('Iniciando') || event.text.includes('Pesquisando') || event.text.includes('Calculando') || event.text.includes('Analisando')) {
                currentSubtaskIdx++;
                const newSubtask = { titulo: event.text.replace('Iniciando ', '').replace('Pesquisando ', '').replace('Calculating ', '').replace('...', '') };
                setAnalysisSubtasks(prev => [...prev, newSubtask]);
                setAnalysisStatuses(prev => ({ ...prev, [currentSubtaskIdx]: 'running' }));
                setAnalysisStep(currentSubtaskIdx + 1);
              }

              // Also put the current thought as a temporary opiniao for the active step if it's empty
              if (currentSubtaskIdx >= 0) {
                setAnalysisResults(prev => {
                  if (prev[currentSubtaskIdx]?.opiniao) return prev;
                  return {
                    ...prev,
                    [currentSubtaskIdx]: {
                      ...(prev[currentSubtaskIdx] || {}),
                      opiniao: event.text
                    }
                  };
                });
              }
            } else if (event.type === 'tool') {
              if (currentSubtaskIdx >= 0) {
                setAnalysisResults(prev => {
                  const res = prev[currentSubtaskIdx] || { intelligence_tools_used: [] };
                  const tools = [...(res.intelligence_tools_used || [])];
                  const existingIdx = tools.findIndex(t => t.tool === event.tool);
                  if (existingIdx >= 0) {
                    tools[existingIdx] = event;
                  } else {
                    tools.push(event);
                  }
                  return { ...prev, [currentSubtaskIdx]: { ...res, intelligence_tools_used: tools } };
                });
              }
            } else if (event.type === 'step_result') {
              const idx = currentSubtaskIdx >= 0 ? currentSubtaskIdx : 0;
              setAnalysisSubtasks(prev => {
                const copy = [...prev];
                if (copy[idx]) copy[idx].titulo = event.title || copy[idx].titulo;
                else copy[idx] = { titulo: event.title };
                return copy;
              });
              setAnalysisResults(prev => ({
                ...prev,
                [idx]: {
                  ...(prev[idx] || {}),
                  opiniao: event.opiniao || event.opinion,
                  sources: event.sources || []
                }
              }));
              setAnalysisStatuses(prev => ({ ...prev, [idx]: 'done' }));
            } else if (event.type === 'result') {
              const result = event.data;
              if (!result.success) throw new Error(result.error || 'Falha na análise');

              // SUCCESS! NOW ROUTE TO APP ROUTER DYNAMIC ROUTE
              if (result.business_id) {
                router.push(`/analysis/${result.business_id}`);
                return;
              }
            } else if (event.type === 'error') {
              throw new Error(event.message || 'Erro na análise');
            }
          } catch (parseErr: any) {
            if (parseErr.message && !parseErr.message.includes('JSON')) throw parseErr;
          }
        }
      }

    } catch (err: any) {
      setError(err.message || 'Erro na análise.');
      setIsAnalyzing(false);
      setGrowthProgress('');
    }
  };

  const handleCreateNewBusiness = () => {
    setError('');
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
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao excluir negócio');
    }
  };

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div
          className="animate-spin rounded-full h-8 w-8 border-2 mx-auto"
          style={{ borderColor: 'var(--color-border-strong)', borderTopColor: 'transparent' }}
        ></div>
      </div>
    );
  }

  return (
    <SidebarLayout
      userId={user?.id || 'default_user'}
      currentBusinessId={null}
      onSelectBusiness={() => { }}
      onCreateNew={handleCreateNewBusiness}
      onDeleteBusiness={handleDeleteBusiness}
      onLogout={logout}
      rightSidebar={undefined}
    >
      {/* Analyzing Stage / Loading Particle */}
      {isAnalyzing ? (
        <div className="flex-1 relative overflow-hidden rounded-3xl mb-8 mr-8 h-full bg-white/80 backdrop-blur-2xl border border-white/60 shadow-2xl">
          <AnalysisExecutionLoader
            subtasks={analysisSubtasks}
            statuses={analysisStatuses}
            results={analysisResults}
            businessName={businessName}
            isExecuting={isAnalyzing}
            currentStep={analysisStep}
          />
        </div>
      ) : (
        <div className="relative w-full h-full">
          {/* Chat Onboarding Stage - Fixed at 40% width to match task chat proportion */}
          <div className="w-[40%] min-w-0 h-full flex flex-col items-start pr-8 pb-8" style={{ flex: '0 0 40%', maxWidth: '40%' }}>
            <GrowthChat
              onProfileReady={handleChatProfileReady}
              loading={false}
            />
          </div>

          {/* Error Message Float */}
          {error && (
            <div
              className="absolute top-6 left-1/4 -translate-x-1/2 z-50 p-4 rounded-xl text-center"
              style={{
                backgroundColor: 'var(--color-destructive-muted)',
                border: '1px solid rgba(239,68,68,0.2)',
                color: 'var(--color-destructive)',
                boxShadow: 'var(--shadow-lg)',
                backdropFilter: 'blur(8px)',
                animation: 'fade-in-up 0.2s ease-out',
              }}
            >
              <p className="text-sm font-medium">{error}</p>
              <button
                onClick={() => setError('')}
                className="block mx-auto mt-2 text-xs transition-colors duration-150"
                style={{ color: 'var(--color-destructive)', opacity: 0.7 }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
              >
                Fechar
              </button>
            </div>
          )}
        </div>
      )}
    </SidebarLayout>
  )
}
