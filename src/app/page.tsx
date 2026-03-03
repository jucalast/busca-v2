'use client';

import React, { useState } from 'react';
import ParticleLoader from '@/features/shared/components/particle-loader';
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
  // ─── Growth mode: Chat profile ready → Run Analysis ───
  const handleChatProfileReady = async (chatProfile: any) => {
    setIsAnalyzing(true);
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

              // SUCCESS! NOW ROUTE TO APP ROUTER DYNAMIC ROUTE
              if (result.business_id) {
                // Instantly teleport the user out of the single-page state into the clean Next.JS Rote
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
    // Already in creation mode at Home route
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

      // If we are making a new business, we stay here.
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao excluir negócio');
    }
  };

  if (authLoading || !isAuthenticated) {
    return <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-zinc-600 border-t-transparent mx-auto"></div>
    </div>;
  }

  return (
    <SidebarLayout
      userId={user?.id || 'default_user'}
      currentBusinessId={null}
      onSelectBusiness={() => { }} // Navigated purely via `<Link>` out-of-the-box now inside SidebarLayout
      onCreateNew={handleCreateNewBusiness}
      onDeleteBusiness={handleDeleteBusiness}
      onLogout={logout}
      rightSidebar={undefined}
    >
      {/* Analyzing Stage / Loading Particle */}
      {isAnalyzing ? (
        <ParticleLoader progress={growthProgress} thoughts={agentThoughts} />
      ) : (
        /* Chat Onboarding Stage */
        <div className="p-6 h-full flex items-center justify-center relative">
          <div className="w-full max-w-2xl flex flex-col" style={{ height: 'calc(100vh - 130px)', minHeight: '560px' }}>
            <GrowthChat
              onProfileReady={handleChatProfileReady}
              loading={false}
            />
          </div>

          {/* Error Message Float */}
          {error && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 p-4 rounded-xl bg-red-950/80 border border-red-900/50 text-red-200 text-center shadow-xl backdrop-blur-sm">
              <p className="text-sm font-medium">{error}</p>
              <button
                onClick={() => {
                  setError('');
                }}
                className="block mx-auto mt-2 text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                Fechar
              </button>
            </div>
          )}
        </div>
      )}
    </SidebarLayout>
  );
}
