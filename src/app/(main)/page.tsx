'use client';

import React, { useState } from 'react';
import ParticleLoader from '@/features/shared/components/particle-loader';
import AnalysisExecutionLoader from '@/features/shared/components/analysis-execution-loader';
import GrowthChat from '@/features/shared/components/growth-chat';
import { DNARoulette } from '@/features/shared/components/dna-roulette';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useSidebar } from '@/contexts/SidebarContext';
import { useAuth } from '@/contexts/AuthContext';

import {
  Building2, Target, Users, Landmark, MapPin,
  Globe as GlobeIcon, AlertCircle, Rocket, BarChart3,
  CheckCircle2, Info, Share2, Wallet, Briefcase,
  Search, ShieldCheck, Truck, Headphones, MessageSquare,
  Instagram, Linkedin, Mail, Map, Phone, Timer,
  Activity, Factory, Layers, HelpCircle, TrendingUp, Zap, Sparkles, Check, Loader2
} from 'lucide-react';

// DNA Profile Preview Component - Strict SaaS Pattern (Sidebar & TaskCard consistent)


export default function Home() {
  const { user, isLoading: authLoading, isAuthenticated, logout, aiModel } = useAuth();
  const router = useRouter();
  const { 
    isDark,
    setRightSidebarContent, 
    setIsDark, 
    setIsPinned, 
    setRightSidebarPersistent 
  } = useSidebar();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // Growth mode state (Onboarding -> Analyzing -> redirect)
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<any>({});
  const [growthProgress, setGrowthProgress] = useState('');
  const [agentThoughts, setAgentThoughts] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [growthLoading, setGrowthLoading] = useState(false);
  const [analysisSubtasks, setAnalysisSubtasks] = useState<any[]>([]);
  const [analysisStatuses, setAnalysisStatuses] = useState<Record<number, 'waiting' | 'running' | 'done' | 'error'>>({});
  const [analysisResults, setAnalysisResults] = useState<Record<number, any>>({});
  const [analysisStep, setAnalysisStep] = useState(0);
  const [businessName, setBusinessName] = useState('Seu Negócio');
  const [isDNAReady, setIsDNAReady] = useState(false);

  // Replicate progress calculation for the sidebar
  const profileFieldsCount = Object.keys(currentProfile || {}).filter(k => !k.startsWith('_')).length;
  const dnaProgressCount = isDNAReady 
    ? 100 
    : Math.min(10 + (profileFieldsCount * 2.5), 90);

  // --- Sidebar Persistence Setup ---
  useEffect(() => {
    setRightSidebarPersistent(true);
    
    // Cleanup on unmount
    return () => {
      setRightSidebarPersistent(false);
      setRightSidebarContent(null);
    };
  }, [setRightSidebarPersistent, setRightSidebarContent]);

  // Update DNARoulette content whenever related state changes
  useEffect(() => {
    setRightSidebarContent(
      <DNARoulette 
        profile={currentProfile} 
        progress={dnaProgressCount}
        isReady={isDNAReady}
      />
    );
  }, [currentProfile, dnaProgressCount, isDNAReady, setRightSidebarContent]);

  // ─── Growth mode: Chat profile ready → Run Analysis ───
  const handleChatProfileReady = async (chatProfile: any) => {
    setIsAnalyzing(true);
    setBusinessName(chatProfile.nome_negocio || chatProfile.nome || 'Seu Negócio');
    setGrowthProgress('Gerando perfil completo e pesquisando mercado...');
    setError('');

    try {
      const profileRes = await fetch('/api/growth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'profile', aiModel, onboardingData: chatProfile }),
      });

      const profileResult = await profileRes.json();

      if (!profileRes.ok || !profileResult.success) {
        throw new Error(profileResult.error || profileResult.erro || 'Falha ao gerar perfil');
      }

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

      setGrowthProgress('Pesquisando dados de mercado...');
      await runAnalysis(profileResult);

    } catch (err: any) {
      setError(err.message || 'Erro ao processar dados do chat.');
      setIsAnalyzing(false);
      setGrowthProgress('');
    }
  };

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
              if (event.text.includes('Iniciando') || event.text.includes('Pesquisando') || event.text.includes('Calculando') || event.text.includes('Analisando')) {
                currentSubtaskIdx++;
                const newSubtask = { titulo: event.text.replace('Iniciando ', '').replace('Pesquisando ', '').replace('Calculating ', '').replace('...', '') };
                setAnalysisSubtasks(prev => [...prev, newSubtask]);
                setAnalysisStatuses(prev => ({ ...prev, [currentSubtaskIdx]: 'running' }));
                setAnalysisStep(currentSubtaskIdx + 1);
              }
              if (currentSubtaskIdx >= 0) {
                setAnalysisResults(prev => {
                  if (prev[currentSubtaskIdx]?.opiniao) return prev;
                  return {
                    ...prev,
                    [currentSubtaskIdx]: { ...(prev[currentSubtaskIdx] || {}), opiniao: event.text }
                  };
                });
              }
            } else if (event.type === 'tool') {
              if (currentSubtaskIdx >= 0) {
                setAnalysisResults(prev => {
                  const res = prev[currentSubtaskIdx] || { intelligence_tools_used: [] };
                  const tools = [...(res.intelligence_tools_used || [])];
                  const existingIdx = tools.findIndex((t: any) => t.tool === event.tool);
                  if (existingIdx >= 0) tools[existingIdx] = event;
                  else tools.push(event);
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

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-2 mx-auto"
          style={{ borderColor: 'var(--color-border-strong)', borderTopColor: 'transparent' }}></div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col w-full h-full bg-transparent overflow-hidden">
        {isAnalyzing ? (
          <div className="flex-1 min-w-0 h-full relative overflow-hidden bg-transparent">
            <div className="h-full animate-in fade-in slide-in-from-right-4 duration-700">
              <AnalysisExecutionLoader
                subtasks={analysisSubtasks}
                statuses={analysisStatuses}
                results={analysisResults}
                businessName={businessName}
                isExecuting={isAnalyzing}
                currentStep={analysisStep}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-stretch overflow-hidden h-full bg-transparent relative">
            
            {/* Background Glows (Enhanced for vibrant glass feel) */}
            <div className={`absolute top-[-15%] left-1/2 -translate-x-1/2 w-[1200px] h-[800px] blur-[140px] -z-10 transition-all duration-1000 ${
                isDark ? 'opacity-0' : 'bg-gradient-to-b from-indigo-300/40 via-violet-200/30 to-transparent'
            }`} />
            
            {/* Full Height Vertical Right-Side Gradient */}
            <div className={`absolute top-0 right-0 bottom-0 w-[400px] blur-[120px] -z-10 transition-all duration-1000 ${
                isDark ? 'opacity-0' : 'bg-gradient-to-b from-violet-600/50 via-purple-500/30 to-transparent'
            }`} />
            <div className={`absolute top-0 right-[-100px] bottom-0 w-[200px] blur-[100px] -z-11 transition-all duration-1000 ${
                isDark ? 'opacity-0' : 'bg-violet-600/40'
            }`} />
            
            <div className={`absolute bottom-[20%] left-[-15%] w-[600px] h-[600px] rounded-full blur-[120px] -z-10 transition-all duration-1000 ${
                isDark ? 'opacity-0' : 'bg-purple-400/30'
            }`} />

            {/* Centered Chat Component - Now takes full width and height */}
            <div className="flex-1 w-full h-full flex flex-col items-center overflow-hidden">
              <GrowthChat
                onProfileReady={handleChatProfileReady}
                onProfileUpdate={(profile) => {
                  setCurrentProfile(profile);
                }}
                onReadyStateChange={setIsDNAReady}
                loading={isAnalyzing}
              />
              {!isAnalyzing && (
                <div className={`mt-auto py-4 text-center text-[10px] font-bold uppercase tracking-widest transition-colors duration-300 ${isDark ? 'text-zinc-700' : 'text-gray-300'}`}>
                  Mastermind Growth Architect • v3.5
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error Message Float */}
        {error && (
          <div className={`absolute top-6 left-1/2 -translate-x-1/2 z-50 p-4 rounded-xl text-center shadow-lg border backdrop-blur-md transition-colors duration-300`}
            style={{ 
              backgroundColor: isDark ? 'rgba(127, 29, 29, 0.4)' : '#FEF2F2', 
              borderColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FCA5A5', 
              color: isDark ? '#fca5a5' : '#B91C1C',
              animation: 'fade-in-up 0.2s ease-out' 
            }}>
            <p className="text-[13px] font-semibold">{error}</p>
            <button onClick={() => setError('')} className={`block mx-auto mt-2 text-[11px] font-bold uppercase transition-colors ${isDark ? 'text-red-400 hover:text-red-300' : 'text-red-600/70 hover:text-red-600'}`}>FECHAR</button>
          </div>
        )}
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'};
          border-radius: 10px;
        }
      `}</style>
    </>
  );
}
