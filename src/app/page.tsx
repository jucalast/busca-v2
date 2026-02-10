'use client';

import React, { useState } from 'react';
import StructuredSummary from '@/components/StructuredSummary';

export default function Home() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError('');
    setData(null);

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
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
    }
  };

  return (
    <div className="min-h-screen p-6 md:p-12 lg:p-24 max-w-7xl mx-auto flex flex-col gap-12">
      {/* Header */}
      <header className="space-y-6 text-center max-w-2xl mx-auto">
        <div className="inline-block px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800">
          <span className="tracking-wide-label text-zinc-400">BUSCADOR RESUMIDO</span>
        </div>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-500">
          Resuma em segundos qualquer assunto com DuckDuckGo + Groq.
        </h1>
        <p className="text-zinc-400 text-lg md:text-xl leading-relaxed">
          Uma ferramenta minimalista que navega na web e gera insights estruturados instantaneamente.
        </p>
      </header>

      {/* Search Form */}
      <section className="w-full max-w-3xl mx-auto">
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-lime-500 rounded-3xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
          <form
            onSubmit={handleSearch}
            className="relative bg-zinc-950 rounded-3xl p-2 md:p-3 border border-zinc-800 flex flex-col md:flex-row gap-2 shadow-2xl"
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Sobre o que você quer saber hoje?"
              className="flex-1 bg-zinc-900/50 hover:bg-zinc-900 focus:bg-zinc-900 rounded-2xl px-6 py-4 text-white placeholder-zinc-500 outline-none transition-colors text-lg"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading}
              className={`
                px-8 py-4 rounded-2xl font-bold tracking-wide uppercase transition-all duration-300
                ${loading
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-emerald-500 to-lime-500 text-black hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:scale-[1.02] active:scale-[0.98]'
                }
              `}
            >
              {loading ? 'Processando...' : 'Pesquisar'}
            </button>
          </form>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-8 p-4 rounded-xl bg-red-950/30 border border-red-900/50 text-red-200 text-center">
            {error}
          </div>
        )}
      </section>

      {/* Results Section */}
      {data && (
        <main className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700">

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

            {/* Raw Output for Debug (Optional, can be removed or hidden) */}
            {/* <details className="text-xs text-zinc-600">
                <summary>Raw Output</summary>
                <pre>{data.rawOutput}</pre>
             </details> */}
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
        </main>
      )}
    </div>
  );
}
