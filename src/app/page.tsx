'use client';

import React, { useState } from 'react';
import StructuredSummary from '@/components/StructuredSummary';
import BusinessReport from '@/components/BusinessReport';

type AppMode = 'search' | 'business';

export default function Home() {
  const [mode, setMode] = useState<AppMode>('business');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [brazilOnly, setBrazilOnly] = useState(true);
  const [progress, setProgress] = useState('');

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

  return (
    <div className="min-h-screen p-6 md:p-12 lg:p-24 max-w-7xl mx-auto flex flex-col gap-12">
      {/* Header */}
      <header className="space-y-6 text-center max-w-2xl mx-auto">
        <div className="inline-block px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800">
          <span className="tracking-widest text-xs text-zinc-400 uppercase">
            {mode === 'business' ? '🧠 Inteligência de Negócios' : '🔍 Buscador Resumido'}
          </span>
        </div>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-500">
          {mode === 'business'
            ? 'Descubra como vender mais com dados reais.'
            : 'Resuma em segundos qualquer assunto.'}
        </h1>
        <p className="text-zinc-400 text-lg md:text-xl leading-relaxed">
          {mode === 'business'
            ? 'Descreva seu negócio e receba uma análise completa: mercado, concorrentes, público-alvo, vendas, marketing e precificação.'
            : 'Uma ferramenta minimalista que navega na web e gera insights estruturados instantaneamente.'}
        </p>
      </header>

      {/* Mode Toggle */}
      <div className="flex justify-center">
        <div className="inline-flex bg-zinc-900 rounded-2xl p-1 border border-zinc-800">
          <button
            onClick={() => { setMode('search'); setData(null); setError(''); }}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${mode === 'search'
              ? 'bg-zinc-800 text-white shadow-lg'
              : 'text-zinc-500 hover:text-zinc-300'
              }`}
          >
            🔍 Busca Simples
          </button>
          <button
            onClick={() => { setMode('business'); setData(null); setError(''); }}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${mode === 'business'
              ? 'bg-gradient-to-r from-emerald-600 to-lime-600 text-black shadow-lg shadow-emerald-500/20'
              : 'text-zinc-500 hover:text-zinc-300'
              }`}
          >
            🧠 Análise de Negócio
          </button>
        </div>
      </div>

      {/* Input Section */}
      <section className="w-full max-w-3xl mx-auto">
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
              /* Business Mode - Textarea */
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Descreva seu negócio aqui...&#10;&#10;Exemplo: Tenho uma loja online de roupas femininas plus size, vendo pelo Instagram e Shopee, meu público são mulheres de 25 a 45 anos classe B e C, quero aumentar minhas vendas e entender melhor o mercado."
                className="w-full bg-zinc-900/50 hover:bg-zinc-900 focus:bg-zinc-900 rounded-2xl px-6 py-4 text-white placeholder-zinc-600 outline-none transition-colors text-base leading-relaxed resize-none min-h-[140px]"
                disabled={loading}
                rows={5}
              />
            ) : (
              /* Simple Mode - Input */
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
              {/* Brazil Filter */}
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

              {/* Submit */}
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

        {/* Loading Progress — 3 Phases */}
        {loading && mode === 'business' && (
          <div className="mt-6 space-y-5 max-w-xl mx-auto">
            <div className="flex items-center justify-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-zinc-400 text-sm animate-pulse">{progress}</p>
            </div>

            {/* Phase indicators */}
            <div className="space-y-3">
              {[
                { icon: '🧠', phase: 'Fase 1', name: 'Expansão Semântica', desc: 'Entendendo seu mercado e vocabulário', delay: '0s' },
                { icon: '🔍', phase: 'Fase 2', name: 'Busca Multi-Dimensional', desc: 'Mercado · Dores · Criativos · Preços', delay: '1s' },
                { icon: '✨', phase: 'Fase 3', name: 'Síntese Agêntica', desc: 'Persona · Posicionamento · Hooks · Plano', delay: '2s' },
              ].map((p, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800 animate-pulse"
                  style={{ animationDelay: p.delay }}
                >
                  <span className="text-2xl">{p.icon}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">{p.phase}</span>
                      <span className="text-sm text-zinc-300 font-medium">{p.name}</span>
                    </div>
                    <p className="text-xs text-zinc-600 mt-0.5">{p.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mt-8 p-4 rounded-xl bg-red-950/30 border border-red-900/50 text-red-200 text-center">
            {error}
          </div>
        )}
      </section>

      {/* Results Section */}
      {data && (
        <section className="animate-in fade-in slide-in-from-bottom-8 duration-700">
          {data.businessMode ? (
            /* Business Report */
            <BusinessReport data={data} />
          ) : (
            /* Simple Search Results */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Main Summary */}
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

              {/* Sources Sidebar */}
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
    </div>
  );
}
