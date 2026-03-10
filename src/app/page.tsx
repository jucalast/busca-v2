'use client';

import React, { useState } from 'react';
import ParticleLoader from '@/features/shared/components/particle-loader';
import AnalysisExecutionLoader from '@/features/shared/components/analysis-execution-loader';
import GrowthChat from '@/features/shared/components/growth-chat';
import SidebarLayout from '@/components/layout/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { 
  Building2, Target, Users, Landmark, MapPin, 
  Globe as GlobeIcon, AlertCircle, Rocket, BarChart3,
  CheckCircle2, Info, Share2, Wallet, Briefcase, 
  Search, ShieldCheck, Truck, Headphones, MessageSquare,
  Instagram, Linkedin, Mail, Map, Phone, Timer,
  Activity, Factory, Layers, HelpCircle, TrendingUp, Zap, Sparkles, Check, Loader2
} from 'lucide-react';

// DNA Profile Preview Component - Strict SaaS Pattern (Sidebar & TaskCard consistent)
const DNAProfilePreview = ({ profile }: { profile: any }) => {
  const groups = [
    {
      name: "Identidade Digital",
      icon: <GlobeIcon size={14} />,
      fields: [
        { key: 'site', label: 'Website', icon: <GlobeIcon size={14} /> },
        { key: 'instagram', label: 'Instagram', icon: <Instagram size={14} /> },
        { key: 'whatsapp', label: 'WhatsApp', icon: <Phone size={14} /> },
        { key: 'linkedin', label: 'LinkedIn', icon: <Linkedin size={14} /> },
        { key: 'google_maps', label: 'Google Maps', icon: <Map size={14} /> },
        { key: 'email_contato', label: 'E-mail', icon: <Mail size={14} /> },
        { key: 'canais', label: 'Canais Atuais', icon: <Share2 size={14} /> },
      ]
    },
    {
      name: "Saúde Financeira",
      icon: <Wallet size={14} />,
      fields: [
        { key: 'faturamento', label: 'Faturamento', icon: <Landmark size={14} /> },
        { key: 'ticket_medio', label: 'Ticket Médio', icon: <Activity size={14} /> },
        { key: 'margem', label: 'Margem %', icon: <TrendingUp size={14} /> },
        { key: 'capital_disponivel', label: 'Capital Inv.', icon: <Wallet size={14} /> },
        { key: 'investimento', label: 'Invest. Mkt', icon: <Rocket size={14} /> },
      ]
    },
    {
      name: "Estrutura e Operação",
      icon: <Briefcase size={14} />,
      fields: [
        { key: 'equipe', label: 'Equipe', icon: <Users size={14} /> },
        { key: 'tipo_produto', label: 'Oferta', icon: <Layers size={14} /> },
        { key: 'tempo_operacao', label: 'Tempo Op.', icon: <Timer size={14} /> },
        { key: 'modelo_operacional', label: 'Operação', icon: <Factory size={14} /> },
        { key: 'capacidade_produtiva', label: 'Capacidade', icon: <Activity size={14} /> },
        { key: 'tempo_entrega', label: 'Entrega', icon: <Timer size={14} /> },
        { key: 'fornecedores', label: 'Fornecedores', icon: <Truck size={14} /> },
      ]
    },
    {
      name: "Inteligência de Mercado",
      icon: <Search size={14} />,
      fields: [
        { key: 'nome_negocio', label: 'Nome', icon: <Building2 size={14} /> },
        { key: 'segmento', label: 'Segmento', icon: <Target size={14} /> },
        { key: 'modelo', label: 'Modelo', icon: <BarChart3 size={14} /> },
        { key: 'localizacao', label: 'Localização', icon: <MapPin size={14} /> },
        { key: 'concorrentes', label: 'Concorrentes', icon: <ShieldCheck size={14} /> },
        { key: 'diferencial', label: 'Diferencial', icon: <Rocket size={14} /> },
        { key: 'tipo_cliente', label: 'Tipo Cliente', icon: <Users size={14} /> },
        { key: 'regiao_atendimento', label: 'Região', icon: <Map size={14} /> },
        { key: 'origem_clientes', label: 'Origem Clientes', icon: <MessageSquare size={14} /> },
        { key: 'maior_objecao', label: 'Objeção', icon: <HelpCircle size={14} /> },
        { key: 'problemas', label: 'Dificuldades', icon: <AlertCircle size={14} /> },
        { key: 'objetivos', label: 'Objetivos', icon: <Rocket size={14} /> },
      ]
    }
  ];

  const isFilled = (val: any) => {
    if (!val) return false;
    const v = String(val).toLowerCase().trim();
    return v !== 'null' && v !== '?' && v !== '' && v !== 'nao informado' && v !== 'não informado';
  };

  const allPossibleFields = groups.flatMap(g => g.fields);
  const filledFieldsCount = allPossibleFields.filter(f => isFilled(profile[f.key])).length;
  const totalFieldsCount = allPossibleFields.length;
  const totalProgress = Math.round((filledFieldsCount / totalFieldsCount) * 100);

  return (
    <div className="flex flex-col h-full bg-white/40 backdrop-blur-3xl overflow-hidden">
      {/* Header - Minimal SaaS */}
      <div className="px-6 py-5 border-b border-black/[0.03]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-200">
              <Sparkles size={16} />
            </div>
            <div>
              <h2 className="text-[14px] font-bold text-gray-900 leading-none">DNA do Negócio</h2>
              <p className="text-[11px] text-gray-500 font-medium mt-1 uppercase tracking-wider">Status da Coleta</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[16px] font-black text-blue-600 leading-none">{totalProgress}%</span>
          </div>
        </div>

        {/* Linear Progress Bar - Task Style */}
        <div className="w-full h-1 bg-black/[0.05] rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-600 transition-all duration-1000 ease-out"
            style={{ width: `${totalProgress}%` }}
          />
        </div>
      </div>

      {/* Content - Sidebar Vertical List Style */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-4">
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.name} className="flex flex-col gap-1">
              {/* Group Header - Sidebar Section Style */}
              <div className="px-3 pb-1.5 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-700/60">{group.name}</span>
                <span className="text-[9px] font-bold text-blue-600/60 bg-blue-50/50 px-1.5 py-0.5 rounded border border-blue-100/30">
                  {group.fields.filter(f => isFilled(profile[f.key])).length}/{group.fields.length}
                </span>
              </div>

              {/* Fields - TaskCard Style */}
              <div className="flex flex-col gap-0.5">
                {group.fields.map((field) => {
                  const value = profile[field.key];
                  const filled = isFilled(value);
                  
                  return (
                    <div 
                      key={field.key}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl border transition-all duration-150 ${
                        filled 
                          ? 'bg-white/60 border-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]' 
                          : 'border-transparent opacity-40 grayscale'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                        filled ? 'bg-blue-50 text-blue-600' : 'bg-black/5 text-gray-400'
                      }`}>
                        {field.icon}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-gray-800 truncate leading-tight">
                          {filled ? value : field.label}
                        </div>
                        {filled && (
                          <div className="text-[10px] text-gray-400 font-medium uppercase tracking-tight mt-0.5">
                            {field.label}
                          </div>
                        )}
                      </div>

                      {filled && (
                        <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm">
                          <Check size={10} className="text-white" strokeWidth={4} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Footer - Consistent primary action */}
      <div className="p-5 border-t border-black/[0.03] bg-white/20 backdrop-blur-xl">
        {totalProgress === 100 ? (
          <button className="w-full h-10 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-[13px] shadow-[0_4px_12px_rgba(37,99,235,0.2)] transition-all active:scale-95 group">
            <Rocket size={16} />
            <span>Iniciar Análise Estratégica</span>
          </button>
        ) : (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/40 border border-white/60">
            <div className="w-8 h-8 rounded-lg bg-black/5 flex items-center justify-center text-gray-400 shrink-0">
              <Loader2 size={16} className="animate-spin" />
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-bold text-gray-800 leading-tight">Aguardando Coleta</div>
              <p className="text-[11px] text-gray-500 leading-tight mt-0.5">
                Faltam {totalFieldsCount - filledFieldsCount} indicadores estratégicos.
              </p>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.1);
        }
      `}</style>
    </div>
  );
};

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

  // Determine if we have at least some data to show the DNA preview
  const hasSomeData = Object.keys(currentProfile).filter(k => !k.startsWith('_')).length > 0;

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
      <div className="flex w-full h-full bg-white overflow-hidden rounded-tl-2xl shadow-sm border border-gray-200/60">
        {/* Chat Onboarding Stage - Two-pane MacOS/SaaS style */}
        <div 
          className="h-full flex flex-col transition-all duration-500 ease-in-out border-r border-gray-100" 
          style={{ 
            flex: isAnalyzing ? '0 0 35%' : '0 0 50%', 
            maxWidth: isAnalyzing ? '35%' : '50%',
            backgroundColor: '#fdfdfd'
          }}
        >
          <GrowthChat
            onProfileReady={handleChatProfileReady}
            onProfileUpdate={setCurrentProfile}
            loading={isAnalyzing}
          />
        </div>

        {/* Dynamic Right Side: Loader or Profile Preview */}
        <div className="flex-1 min-w-0 h-full relative overflow-hidden bg-white/50">
          {isAnalyzing ? (
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
          ) : hasSomeData ? (
            <DNAProfilePreview profile={currentProfile} />
          ) : (
            <div className="h-full flex items-center justify-center bg-[#fafafa]">
              <div className="text-center max-w-sm p-8">
                <div className="w-12 h-12 bg-white text-gray-400 rounded-xl flex items-center justify-center mx-auto mb-4 border border-gray-200 shadow-sm">
                  <Sparkles size={20} />
                </div>
                <h2 className="text-[15px] font-semibold text-gray-800 mb-2">Construindo seu DNA</h2>
                <p className="text-[13px] text-gray-500 leading-relaxed font-medium">
                  Converse com o consultor ao lado. À medida que mapeamos seu negócio, o painel estratégico será montado aqui em tempo real.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error Message Float */}
      {error && (
        <div
          className="absolute top-6 left-1/2 -translate-x-1/2 z-50 p-4 rounded-xl text-center shadow-lg"
          style={{
            backgroundColor: '#FEF2F2',
            border: '1px solid #FCA5A5',
            color: '#B91C1C',
            backdropFilter: 'blur(8px)',
            animation: 'fade-in-up 0.2s ease-out',
          }}
        >
          <p className="text-[13px] font-semibold">{error}</p>
          <button
            onClick={() => setError('')}
            className="block mx-auto mt-2 text-[11px] font-bold transition-colors duration-150 text-red-600/70 hover:text-red-600"
          >
            FECHAR
          </button>
        </div>
      )}
    </SidebarLayout>
  )
}
