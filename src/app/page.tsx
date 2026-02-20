'use client';

import React, { useState } from 'react';
import { Bot, Search, BarChart3, ListTodo, Loader2 } from 'lucide-react';
import ParticleLoader from '@/components/ParticleLoader';
import GrowthHub from '@/components/GrowthHub';
import DimensionDetail from '@/components/DimensionDetail';
import TaskAssistant from '@/components/TaskAssistant';
import GrowthChat from '@/components/GrowthChat';
import SidebarLayout from '@/components/SidebarLayout';
import AuthForm from '@/components/AuthForm';
import { useAuth } from '@/contexts/AuthContext';

type GrowthStage = 'onboarding' | 'analyzing' | 'results';

export default function Home() {
  const { user, isLoading: authLoading, isAuthenticated, logout } = useAuth();

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

  // Task Assistant state
  const [assistTask, setAssistTask] = useState<any>(null);

  // Dimension detail state
  const [selectedDimension, setSelectedDimension] = useState<string | null>(null);
  const [dimensionChats, setDimensionChats] = useState<Record<string, Array<{ role: 'user' | 'assistant'; content: string; sources?: string[]; searchQuery?: string }>>>({});
  const [dimensionLoading, setDimensionLoading] = useState(false);

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
        body: JSON.stringify({ action: 'profile', onboardingData: chatProfile }),
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
  const runAnalysis = async (profileData: any) => {
    try {
      setGrowthProgress('Iniciando análise...');
      setAgentThoughts([]);

      const res = await fetch('/api/growth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze',
          profile: profileData.profile || profileData,
          region: 'br-pt',
          business_id: currentBusinessId,
          user_id: user?.id || 'default_user',
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

    } catch (err: any) {
      setError(err.message || 'Erro na análise.');
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
    setSelectedDimension(null);
    setDimensionChats({});
    setGrowthStage('onboarding');
    setError('');
  };

  // ─── Redo Analysis: Re-run with same profile data ───
  const handleRedoAnalysis = async () => {
    if (!profile) {
      // No profile data — fall back to creating new business
      handleCreateNewBusiness();
      return;
    }

    setGrowthLoading(true);
    setGrowthStage('analyzing');
    setGrowthProgress('Refazendo análise com os mesmos dados...');
    setError('');
    setSelectedDimension(null);
    setDimensionChats({});
    setAgentThoughts([]);

    try {
      await runAnalysis(profile);
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

      // If deleted business was current, reset to onboarding
      if (businessId === currentBusinessId) {
        handleCreateNewBusiness();
      }
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao excluir negócio');
    }
  };

  // ─── Task AI Assist ───
  const handleGenerateAssist = async (taskId: string) => {
    const task = growthData?.taskPlan?.tasks?.find((t: any) => t.id === taskId);
    if (!task) return { success: false, erro: 'Tarefa não encontrada.' };

    const res = await fetch('/api/growth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'assist',
        task,
        profile: profile?.profile || profile,
      }),
    });

    return await res.json();
  };

  // ─── Profile summary for display ───
  const getProfileSummary = () => {
    const p = profile?.profile?.perfil || {};
    return `${p.nome || '?'} — ${p.segmento || '?'} — ${p.modelo_negocio || '?'} — ${p.localizacao || '?'}`;
  };

  // ─── Dimension chat handler ───
  const handleDimensionMessage = async (message: string) => {
    if (!selectedDimension) return;

    const dimKey = selectedDimension;
    const currentChat = dimensionChats[dimKey] || [];
    const newChat = [...currentChat, { role: 'user' as const, content: message }];
    setDimensionChats(prev => ({ ...prev, [dimKey]: newChat }));
    setDimensionLoading(true);

    try {
      const res = await fetch('/api/growth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'dimension-chat',
          dimension: dimKey,
          userMessage: message,
          messages: newChat,
          context: {
            profile: profile?.profile || profile,
            score: growthData?.score || {},
            marketData: growthData?.marketData || {},
            taskPlan: growthData?.taskPlan || {},
          },
        }),
      });

      const result = await res.json();

      setDimensionChats(prev => ({
        ...prev,
        [dimKey]: [
          ...(prev[dimKey] || []),
          {
            role: 'assistant' as const,
            content: result.reply || 'Desculpe, não consegui gerar uma resposta.',
            sources: result.sources || [],
            searchQuery: result.searchQuery || '',
          },
        ],
      }));
    } catch (err: any) {
      setDimensionChats(prev => ({
        ...prev,
        [dimKey]: [
          ...(prev[dimKey] || []),
          { role: 'assistant' as const, content: 'Erro ao processar a mensagem. Tente novamente.' },
        ],
      }));
    } finally {
      setDimensionLoading(false);
    }
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-400 mx-auto mb-4"></div>
          <p className="text-zinc-400">Carregando...</p>
        </div>
      </div>
    );
  }

  // Show auth form if not authenticated
  if (!isAuthenticated) {
    return <AuthForm />;
  }

  // ━━━━━ GROWTH MODE WITH SIDEBAR LAYOUT ━━━━━
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
    >
      {/* Chat Onboarding Stage - Create New Business */}
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

      {/* Analyzing Stage - Particle Animation */}
      {growthStage === 'analyzing' && growthLoading && (
        <ParticleLoader progress={growthProgress} thoughts={agentThoughts} />
      )}

      {/* Results Stage - Hub or Dimension Detail */}
      {growthStage === 'results' && growthData && (
        <>
          {selectedDimension ? (
            <DimensionDetail
              dimensionKey={selectedDimension}
              data={growthData}
              userProfile={userProf}
              chatHistory={dimensionChats[selectedDimension] || []}
              onBack={() => setSelectedDimension(null)}
              onSendMessage={handleDimensionMessage}
              isLoading={dimensionLoading}
            />
          ) : (
            <GrowthHub
              data={growthData}
              userProfile={userProf}
              onSelectDimension={(key) => setSelectedDimension(key)}
              onRedo={handleRedoAnalysis}
            />
          )}
        </>
      )}

      {/* Error Message in Growth Mode */}
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

      {/* Task Assistant Modal */}
      {assistTask && (
        <TaskAssistant
          task={assistTask}
          profileSummary={getProfileSummary()}
          onClose={() => setAssistTask(null)}
          onGenerate={handleGenerateAssist}
        />
      )}
    </SidebarLayout>
  );
}
