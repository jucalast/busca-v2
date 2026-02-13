'use client';

import React, { useState } from 'react';
import StructuredSummary from '@/components/StructuredSummary';
import BusinessReport from '@/components/BusinessReport';
import GrowthChat from '@/components/GrowthChat';
import GrowthHub from '@/components/GrowthHub';
import DimensionDetail from '@/components/DimensionDetail';
import TaskAssistant from '@/components/TaskAssistant';

type AppMode = 'search' | 'business' | 'growth';
type GrowthStage = 'onboarding' | 'analyzing' | 'results';

export default function Home() {
  const [mode, setMode] = useState<AppMode>('growth');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [brazilOnly, setBrazilOnly] = useState(true);
  const [progress, setProgress] = useState('');

  // Growth mode state
  const [growthStage, setGrowthStage] = useState<GrowthStage>('onboarding');
  const [profile, setProfile] = useState<any>(null);
  const [growthData, setGrowthData] = useState<any>(null);
  const [growthLoading, setGrowthLoading] = useState(false);
  const [growthProgress, setGrowthProgress] = useState('');
  const [activeTab, setActiveTab] = useState<'score' | 'tasks' | 'report'>('score');

  // Task Assistant state
  const [assistTask, setAssistTask] = useState<any>(null);

  // Dimension detail state
  const [selectedDimension, setSelectedDimension] = useState<string | null>(null);
  const [dimensionChats, setDimensionChats] = useState<Record<string, Array<{ role: 'user' | 'assistant'; content: string; sources?: string[]; searchQuery?: string }>>>({});
  const [dimensionLoading, setDimensionLoading] = useState(false);

  // ─── Search / Business mode handler (unchanged) ───
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError('');
    setData(null);
    setProgress(mode === 'business' ? 'Gerando queries estratégicas...' : 'Buscando...');

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          region: brazilOnly ? 'br-pt' : undefined,
          businessMode: mode === 'business',
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Falha na busca');
      }

      setData(result);
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro ao processar sua busca.');
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  // ─── Growth mode: Chat profile ready → Run Analysis ───
  const handleChatProfileReady = async (chatProfile: any) => {
    setGrowthLoading(true);
    setGrowthProgress('🧠 Gerando perfil completo e pesquisando mercado...');
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

      setProfile(profileResult);

      // Start analysis
      setGrowthProgress('🔍 Pesquisando dados de mercado...');
      await runAnalysis(profileResult);

    } catch (err: any) {
      setError(err.message || 'Erro ao processar dados do chat.');
      setGrowthLoading(false);
      setGrowthProgress('');
    }
  };

  // ─── Growth mode: Run full analysis ───
  const runAnalysis = async (profileData: any) => {
    try {
      setGrowthProgress('📊 Analisando mercado, calculando score e gerando tarefas...');

      const res = await fetch('/api/growth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze',
          profile: profileData.profile || profileData,
          region: brazilOnly ? 'br-pt' : undefined,
        }),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || result.erro || 'Falha na análise');
      }

      setGrowthData(result);
      setGrowthStage('results');

    } catch (err: any) {
      setError(err.message || 'Erro na análise.');
    } finally {
      setGrowthLoading(false);
      setGrowthProgress('');
    }
  };

  // ─── Growth mode: Task AI Assist ───
  const handleRequestAssist = (task: any) => {
    setAssistTask(task);
  };

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

  // ─── Mode switch handler ───
  const switchMode = (newMode: AppMode) => {
    setMode(newMode);
    setData(null);
    setError('');
    setGrowthData(null);
    setProfile(null);
    setGrowthStage('onboarding');
    setActiveTab('score');
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
            content: result.reply || 'Desculpe, nao consegui gerar uma resposta.',
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

  // If in Growth Results mode — show Hub or Dimension Detail
  if (mode === 'growth' && growthStage === 'results' && growthData) {
    const userProf = {
      name: profile?.profile?.perfil?.nome || 'Seu Negocio',
      segment: profile?.profile?.perfil?.segmento || '',
    };

    // Dimension Detail view
    if (selectedDimension) {
      return (
        <DimensionDetail
          dimensionKey={selectedDimension}
          data={growthData}
          userProfile={userProf}
          chatHistory={dimensionChats[selectedDimension] || []}
          onBack={() => setSelectedDimension(null)}
          onSendMessage={handleDimensionMessage}
          isLoading={dimensionLoading}
        />
      );
    }

    // Hub view
    return (
      <GrowthHub
        data={growthData}
        userProfile={userProf}
        onSelectDimension={(key) => setSelectedDimension(key)}
        onRedo={() => {
          setGrowthStage('onboarding');
          setGrowthData(null);
          setProfile(null);
          setSelectedDimension(null);
          setDimensionChats({});
          setError('');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-12 lg:p-24 max-w-7xl mx-auto flex flex-col gap-12 transition-all duration-500">
      {/* Header */}
      <header className="space-y-6 text-center max-w-2xl mx-auto animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="inline-block px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800">
          <span className="tracking-widest text-xs text-zinc-400 uppercase">
            {mode === 'growth'
              ? '🚀 Plataforma de Crescimento'
              : mode === 'business'
                ? '🧠 Inteligência de Negócios'
                : '🔍 Buscador Resumido'}
          </span>
        </div>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-500">
          {mode === 'growth'
            ? 'Desbloqueie o potencial máximo do seu negócio.'
            : mode === 'business'
              ? 'Descubra como vender mais com dados reais.'
              : 'Resuma em segundos qualquer assunto.'}
        </h1>
        <p className="text-zinc-400 text-lg md:text-xl leading-relaxed">
          {mode === 'growth'
            ? 'Diagnóstico completo + score de saúde + tarefas de crescimento geradas por IA — tudo baseado em dados reais do seu mercado.'
            : mode === 'business'
              ? 'Descreva seu negócio e receba uma análise completa: mercado, concorrentes, público-alvo, vendas, marketing e precificação.'
              : 'Uma ferramenta minimalista que navega na web e gera insights estruturados instantaneamente.'}
        </p>
      </header>

      {/* Mode Toggle */}
      <div className="flex justify-center animate-in fade-in zoom-in duration-500 delay-100">
        <div className="inline-flex bg-zinc-900 rounded-2xl p-1 border border-zinc-800">
          <button
            onClick={() => switchMode('search')}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${mode === 'search'
              ? 'bg-zinc-800 text-white shadow-lg'
              : 'text-zinc-500 hover:text-zinc-300'
              }`}
          >
            🔍 Busca
          </button>
          <button
            onClick={() => switchMode('business')}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${mode === 'business'
              ? 'bg-gradient-to-r from-emerald-600 to-lime-600 text-black shadow-lg shadow-emerald-500/20'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
              }`}
          >
            🧠 Análise
          </button>
          <button
            onClick={() => switchMode('growth')}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${mode === 'growth'
              ? 'bg-gradient-to-r from-violet-600 via-blue-600 to-cyan-600 text-white shadow-lg shadow-violet-500/20'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
              }`}
          >
            🚀 Crescimento
          </button>
        </div>
      </div>

      {/* ━━━━━ GROWTH MODE ━━━━━ */}
      {mode === 'growth' && (
        <>
          {/* Chat Onboarding Stage */}
          {growthStage === 'onboarding' && !growthLoading && (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
              <GrowthChat
                onProfileReady={handleChatProfileReady}
                loading={growthLoading}
              />
            </div>
          )}

          {/* Loading / Analyzing */}
          {growthLoading && (
            <div className="max-w-2xl mx-auto text-center py-16 space-y-6 animate-in fade-in duration-1000">
              <div className="relative w-24 h-24 mx-auto">
                <div className="absolute inset-0 rounded-full border-2 border-violet-500/30 animate-ping" />
                <div className="absolute inset-2 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                <div className="absolute inset-4 rounded-full border-2 border-cyan-500/50 border-b-transparent animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
                <div className="absolute inset-0 flex items-center justify-center text-2xl animate-pulse">🧠</div>
              </div>
              <p className="text-zinc-300 text-lg font-medium animate-pulse">{growthProgress}</p>
              <p className="text-zinc-600 text-sm">
                Isso pode levar de 1 a 3 minutos. A IA está pesquisando dados reais do seu mercado.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-xl mx-auto mt-6">
                {[
                  { icon: '🧠', name: 'Perfil', delay: '0s' },
                  { icon: '🔍', name: 'Mercado', delay: '0.5s' },
                  { icon: '📊', name: 'Score', delay: '1s' },
                  { icon: '📋', name: 'Tarefas', delay: '1.5s' },
                ].map((step, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 p-3 rounded-xl bg-zinc-900/50 border border-zinc-800 animate-pulse"
                    style={{ animationDelay: step.delay }}
                  >
                    <span className="text-lg">{step.icon}</span>
                    <span className="text-xs text-zinc-500">{step.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ━━━━━ SEARCH / BUSINESS MODE (unchanged) ━━━━━ */}
      {(mode === 'search' || mode === 'business') && (
        <>
          {/* Input Section */}
          <section className="w-full max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
            <div className="relative group">
              <div className={`absolute -inset-1 rounded-3xl blur transition duration-1000 group-hover:duration-200 ${mode === 'business'
                ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-lime-500 opacity-30 group-hover:opacity-50'
                : 'bg-gradient-to-r from-emerald-500 to-lime-500 opacity-25 group-hover:opacity-50'
                }`} />

              <form
                onSubmit={handleSearch}
                className="relative bg-zinc-950 rounded-3xl p-4 md:p-5 border border-zinc-800 flex flex-col gap-3 shadow-2xl"
              >
                {mode === 'business' ? (
                  <textarea
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Descreva seu negócio aqui...&#10;&#10;Exemplo: Tenho uma loja online de roupas femininas plus size, vendo pelo Instagram e Shopee, meu público são mulheres de 25 a 45 anos classe B e C, quero aumentar minhas vendas e entender melhor o mercado."
                    className="w-full bg-zinc-900/50 hover:bg-zinc-900 focus:bg-zinc-900 rounded-2xl px-6 py-4 text-white placeholder-zinc-600 outline-none transition-colors text-base leading-relaxed resize-none min-h-[140px]"
                    disabled={loading}
                    rows={5}
                  />
                ) : (
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Sobre o que você quer saber hoje?"
                    className="w-full bg-zinc-900/50 hover:bg-zinc-900 focus:bg-zinc-900 rounded-2xl px-6 py-4 text-white placeholder-zinc-500 outline-none transition-colors text-lg"
                    disabled={loading}
                  />
                )}

                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                  <label className="flex items-center gap-2 cursor-pointer group px-2">
                    <input
                      type="checkbox"
                      checked={brazilOnly}
                      onChange={(e) => setBrazilOnly(e.target.checked)}
                      className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-0 cursor-pointer accent-emerald-500"
                    />
                    <span className="text-sm text-zinc-500 group-hover:text-zinc-300 transition-colors whitespace-nowrap">
                      Sites brasileiros 🇧🇷
                    </span>
                  </label>

                  <div className="flex-1" />

                  <button
                    type="submit"
                    disabled={loading}
                    className={`
                      px-8 py-3.5 rounded-2xl font-bold tracking-wide uppercase transition-all duration-300
                      ${loading
                        ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                        : mode === 'business'
                          ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-lime-500 text-black hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] hover:scale-[1.02] active:scale-[0.98]'
                          : 'bg-gradient-to-r from-emerald-500 to-lime-500 text-black hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:scale-[1.02] active:scale-[0.98]'
                      }
                    `}
                  >
                    {loading
                      ? mode === 'business' ? '🧠 Analisando...' : 'Processando...'
                      : mode === 'business' ? '🚀 Analisar Negócio' : 'Pesquisar'}
                  </button>
                </div>
              </form>
            </div>

            {/* Loading Progress (business mode) */}
            {loading && mode === 'business' && (
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <p className="text-zinc-400 text-sm animate-pulse">{progress}</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-2xl mx-auto">
                  {[
                    { icon: '📊', name: 'Mercado', delay: '0s' },
                    { icon: '🎯', name: 'Concorrentes', delay: '0.5s' },
                    { icon: '👥', name: 'Compradores', delay: '1s' },
                    { icon: '💰', name: 'Prospecção', delay: '1.5s' },
                    { icon: '📱', name: 'Online', delay: '2s' },
                    { icon: '💎', name: 'Preços', delay: '2.5s' },
                  ].map((cat, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 p-3 rounded-xl bg-zinc-900/50 border border-zinc-800 animate-pulse"
                      style={{ animationDelay: cat.delay }}
                    >
                      <span className="text-lg">{cat.icon}</span>
                      <span className="text-xs text-zinc-500">{cat.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Error Message */}
          {error && (
            <div className="max-w-3xl mx-auto p-4 rounded-xl bg-red-950/30 border border-red-900/50 text-red-200 text-center animate-in fade-in slide-in-from-bottom-2">
              {error}
            </div>
          )}

          {/* Results Section */}
          {data && (
            <section className="animate-in fade-in slide-in-from-bottom-8 duration-700">
              {data.businessMode ? (
                <BusinessReport data={data} />
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-8">
                    <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 md:p-8 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-lime-500" />
                      <div className="flex items-center gap-4 mb-8">
                        <h2 className="text-2xl font-bold text-white tracking-wide">RESUMO ESTRUTURADO</h2>
                        <div className="h-px flex-1 bg-zinc-800" />
                      </div>
                      <StructuredSummary data={data.structured} />
                    </div>
                  </div>
                  <div className="lg:col-span-1">
                    <div className="bg-zinc-950/50 border border-zinc-800 rounded-3xl p-6 sticky top-8">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold text-white tracking-wide">FONTES</h3>
                        <span className="bg-zinc-900 text-zinc-400 px-2 py-1 rounded text-xs font-mono">
                          {data.sources?.length || 0} LINKS
                        </span>
                      </div>
                      <ul className="space-y-3">
                        {data.sources?.map((source: string, idx: number) => (
                          <li key={idx}>
                            <a
                              href={source}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block p-3 rounded-xl bg-zinc-900/50 hover:bg-zinc-800 border border-transparent hover:border-emerald-500/30 transition-all group"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 group-hover:animate-pulse" />
                                <span className="text-xs text-zinc-500 font-mono truncate max-w-full">
                                  {new URL(source).hostname}
                                </span>
                              </div>
                              <p className="text-sm text-zinc-300 truncate group-hover:text-emerald-300 transition-colors">
                                {source}
                              </p>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}
        </>
      )}

      {/* Growth mode error */}
      {mode === 'growth' && error && (
        <div className="max-w-3xl mx-auto p-4 rounded-xl bg-red-950/30 border border-red-900/50 text-red-200 text-center">
          {error}
          <button
            onClick={() => { setError(''); setGrowthStage('onboarding'); setGrowthLoading(false); }}
            className="block mx-auto mt-3 text-sm text-red-400 hover:text-red-300"
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
    </div>
  );
}
