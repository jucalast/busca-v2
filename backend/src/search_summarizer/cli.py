import argparse
import json
import sys
import os
import time
import requests
from bs4 import BeautifulSoup
from ddgs import DDGS
from groq import Groq
from dotenv import load_dotenv
from concurrent.futures import ThreadPoolExecutor, as_completed

# Load environment variables from .env file
load_dotenv()

# ==============================================================================
# Utility Functions
# ==============================================================================

def mock_summarize(query, error_message="Chave da API Groq não detectada."):
    return {
        "aviso": f"Resumo simulado para '{query}'. Motivo: {error_message}",
        "detalhes": [
            "A funcionalidade de busca está operando.",
            "Verifique os logs do servidor para mais detalhes sobre o erro."
        ],
    }

def search_duckduckgo(query, max_results=8, region='br-pt'):
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=max_results, region=region))
        return results
    except Exception as e:
        print(f"Erro na busca DuckDuckGo: {e}", file=sys.stderr)
        return []

def scrape_page(url, timeout=5):
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
        response = requests.get(url, headers=headers, timeout=timeout)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        for script in soup(["script", "style", "nav", "footer", "header"]):
            script.decompose()
            
        text = soup.get_text()
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = '\n'.join(chunk for chunk in chunks if chunk)
        
        return text[:5000]
    except Exception:
        return ""

def call_groq(api_key, prompt, temperature=0.5, max_retries=3):
    """Generic Groq API call with retry + exponential backoff."""
    client = Groq(api_key=api_key)
    
    for attempt in range(max_retries):
        try:
            completion = client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model="llama-3.3-70b-versatile",
                temperature=temperature,
                response_format={"type": "json_object"},
            )
            return json.loads(completion.choices[0].message.content)
        except Exception as e:
            error_msg = str(e)
            if "429" in error_msg and attempt < max_retries - 1:
                wait_time = (attempt + 1) * 5
                print(f"  ⏳ Rate limit (429). Aguardando {wait_time}s... ({attempt+1}/{max_retries})", file=sys.stderr)
                time.sleep(wait_time)
                continue
            raise

def call_groq_text(api_key, prompt, temperature=0.7, max_retries=3):
    """Groq API call that returns plain text (no JSON mode)."""
    client = Groq(api_key=api_key)
    
    for attempt in range(max_retries):
        try:
            completion = client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model="llama-3.3-70b-versatile",
                temperature=temperature,
            )
            return completion.choices[0].message.content
        except Exception as e:
            error_msg = str(e)
            if "429" in error_msg and attempt < max_retries - 1:
                wait_time = (attempt + 1) * 5
                print(f"  ⏳ Rate limit (429). Aguardando {wait_time}s... ({attempt+1}/{max_retries})", file=sys.stderr)
                time.sleep(wait_time)
                continue
            raise

# ==============================================================================
# Simple Search Mode (original)
# ==============================================================================

def summarize_with_groq(text, query, api_key):
    if not api_key:
        return mock_summarize(query, "Chave da API não fornecida.")

    try:
        prompt = f"""
        Você é um assistente de pesquisa avançado. Seu objetivo é criar um resumo estruturado e abrangente sobre "{query}" com base no texto fornecido abaixo.
        
        Regras de Resposta:
        1. Retorne APENAS um JSON válido. Não use blocos de código markdown.
        2. A estrutura do JSON deve ser hierárquica e semântica.
        3. Use chaves em Português.
        4. O JSON deve conter uma visão geral, principais pontos, detalhes técnicos (se aplicável), e controvérsias ou opiniões diversas (se houver).
        5. Seja direto e informativo.
        
        Texto Base:
        {text[:25000]} 
        """
        return call_groq(api_key, prompt)
    except Exception as e:
        error_msg = str(e)
        print(f"Erro na API Groq: {error_msg}", file=sys.stderr)
        if "401" in error_msg:
            return mock_summarize(query, "Chave da API inválida (401).")
        if "400" in error_msg:
            return mock_summarize(query, "Requisição inválida (400).")
        if "429" in error_msg:
            return mock_summarize(query, "Muitas requisições (429). Aguarde.")
        return mock_summarize(query, f"Erro na API: {error_msg}")

def run_simple_search(args):
    """Original simple search mode."""
    results = search_duckduckgo(args.query, args.max_results, args.region)
    
    if not results:
        return {"structured": {"erro": "Nenhum resultado encontrado"}, "sources": []}

    aggregated_text = ""
    sources = []
    
    for i, result in enumerate(results):
        sources.append(result.get('href'))
        snippet = result.get('body', '')
        aggregated_text += f"Fonte {i+1} ({result.get('title')}): {snippet}\n"
        
        if i < args.max_pages and not args.no_groq:
            content = scrape_page(result.get('href'))
            if content:
                aggregated_text += f"Conteúdo extra da Fonte {i+1}: {content}\n"
    
    groq_api_key = os.environ.get("GROQ_API_KEY")
    
    if args.no_groq:
        summary_data = {"aviso": "Resumo via Groq desativado."}
    else:
        summary_data = summarize_with_groq(aggregated_text, args.query, groq_api_key)

    return {"structured": summary_data, "sources": sources}

# ==============================================================================
# Business Intelligence Mode — 3-Phase Agentic Architecture
# ==============================================================================

# ─────────────────────────────────────────────────────────────────────────────
# FASE 1: Expansão Semântica
# ─────────────────────────────────────────────────────────────────────────────

def semantic_expansion(description, api_key):
    """
    Phase 1: Use LLM to expand user's business description into market-ready
    research terms. Fixes vocabulary gaps and identifies key search angles.
    """
    prompt = f"""Você é um analista de inteligência de mercado sênior brasileiro.

Leia a descrição do negócio abaixo e produza uma EXPANSÃO SEMÂNTICA completa para pesquisa de mercado.

NEGÓCIO:
"{description}"

Gere um JSON com:

1. "termos_tecnicos": lista de 5-8 termos que o MERCADO usa para esse produto/serviço (não o que o usuário escreveu, mas o que compradores e o mercado usam). Ex: se o usuário diz "faço caixas", você coloca ["cartonagem", "papelão ondulado onda C", "embalagem industrial", "caixa de transporte"]

2. "concorrentes_provaveis": lista de 3-5 nomes de empresas reais que provavelmente competem nesse segmento e região (chute educado baseado no mercado brasileiro)

3. "quem_compra": lista de 3-5 tipos de empresa/pessoa que COMPRAM esse produto (o cliente do cliente), com descrição curta de cada. Ex: ["Indústrias de autopeças que despacham peças frágeis", "E-commerces da região que precisam de caixa para envio"]

4. "dores_provaveis": lista de 4-6 problemas/frustrações que os COMPRADORES provavelmente têm com esse tipo de produto/serviço. Ex: ["caixa amassa no transporte", "fornecedor atrasa entrega", "mínimo de compra muito alto"]

5. "jtbd": objeto com 3 campos descrevendo os "Jobs to be Done" do comprador:
   - "funcional": o que o produto resolve mecanicamente
   - "emocional": como o comprador quer se SENTIR ao usar/comprar
   - "social": como o comprador quer ser VISTO por chefes/colegas

6. "queries_busca": objeto com 4 queries de busca otimizadas para DuckDuckGo (5-10 palavras cada):
   - "mercado": query para encontrar dados de mercado, tamanho, CAGR, tendências
   - "dores_consumidor": query para encontrar reclamações reais (Reddit, fóruns, Reclame Aqui) sobre esse tipo de produto
   - "criativos_concorrentes": query para encontrar anúncios e estratégias de marketing dos concorrentes
   - "precos_b2b": query para encontrar tabelas de preço, margens e modelos de contrato B2B

JSON:"""

    return call_groq(api_key, prompt, temperature=0.3)


# ─────────────────────────────────────────────────────────────────────────────
# FASE 2: Busca Multi-Dimensional
# ─────────────────────────────────────────────────────────────────────────────

DIMENSIONS = [
    {
        "id": "mercado",
        "nome": "Mercado & Tendências",
        "icone": "📊",
        "queries_extra": [
            "{termo_principal} mercado brasil crescimento",
            "{termo_principal} tendências 2025 setor"
        ]
    },
    {
        "id": "dores",
        "nome": "Dores do Consumidor",
        "icone": "😤",
        "queries_extra": [
            "site:reddit.com {termo_principal} problema reclamação",
            "{termo_principal} reclame aqui reclamação",
            "{termo_principal} defeito problema forum"
        ]
    },
    {
        "id": "criativos",
        "nome": "Criativos & Concorrência",
        "icone": "🎨",
        "queries_extra": [
            "{concorrente_1} anúncio marketing estratégia",
            "{termo_principal} anúncios facebook instagram ads"
        ]
    },
    {
        "id": "precos",
        "nome": "Preços & Margens B2B",
        "icone": "💰",
        "queries_extra": [
            "{termo_principal} preço atacado B2B tabela",
            "{termo_principal} margem lucro setor industrial"
        ]
    }
]

def search_dimension(dim_id, queries, region, max_results=6, max_pages=2):
    """
    Phase 2: Execute multiple searches for a single dimension and aggregate
    all scraped content into one text blob.
    """
    all_text = ""
    all_sources = []
    
    for q in queries:
        results = search_duckduckgo(q, max_results=max_results, region=region)
        
        for i, result in enumerate(results):
            url = result.get('href', '')
            if url not in all_sources:
                all_sources.append(url)
            title = result.get('title', '')
            snippet = result.get('body', '')
            all_text += f"[{dim_id}] Fonte: {title} ({url})\n{snippet}\n"
            
            if i < max_pages:
                content = scrape_page(url)
                if content:
                    all_text += f"Conteúdo completo: {content}\n\n"
    
    return {
        "id": dim_id,
        "text": all_text,
        "sources": all_sources,
        "query_count": len(queries)
    }


# ─────────────────────────────────────────────────────────────────────────────
# FASE 3: Síntese Agêntica
# ─────────────────────────────────────────────────────────────────────────────

def synthesize_intelligence(description, expansion, dim_results, api_key):
    """
    Phase 3: Feed ALL collected data into one massive LLM call to produce
    an integrated intelligence report: Persona + Pain Map + Positioning +
    Ad Hooks + Action Plan.
    """
    # Build context from expansion
    exp = expansion
    termos = ", ".join(exp.get("termos_tecnicos", []))
    concorrentes = ", ".join(exp.get("concorrentes_provaveis", []))
    quem_compra = "\n".join([f"  - {c}" for c in exp.get("quem_compra", [])])
    dores_provaveis = "\n".join([f"  - {d}" for d in exp.get("dores_provaveis", [])])
    jtbd = exp.get("jtbd", {})
    
    # Build dimension data blocks (truncated to fit context)
    dim_blocks = ""
    for dim in dim_results:
        dim_blocks += f"\n===== DADOS: {dim['id'].upper()} ({len(dim['sources'])} fontes) =====\n"
        dim_blocks += dim["text"][:6000] + "\n"
    
    prompt = f"""Você é um Estrategista de Marca e Consultor de Marketing sênior, contratado para analisar um negócio e entregar um relatório de inteligência completo. Você fala diretamente com o dono do negócio (segunda pessoa: "você", "seu").

═══════════════════════════════════════════
O NEGÓCIO DO CLIENTE
═══════════════════════════════════════════
{description}

═══════════════════════════════════════════
ANÁLISE SEMÂNTICA PRÉVIA (Fase 1)
═══════════════════════════════════════════
Termos técnicos do mercado: {termos}
Concorrentes identificados: {concorrentes}
Quem compra esse produto:
{quem_compra}
Dores prováveis:
{dores_provaveis}
Jobs to be Done:
  Funcional: {jtbd.get('funcional', 'N/A')}
  Emocional: {jtbd.get('emocional', 'N/A')}
  Social: {jtbd.get('social', 'N/A')}

═══════════════════════════════════════════
DADOS BRUTOS COLETADOS DA INTERNET (Fase 2)
═══════════════════════════════════════════
{dim_blocks[:20000]}

═══════════════════════════════════════════
SUA MISSÃO
═══════════════════════════════════════════

Analise TODOS os dados acima e gere um relatório JSON integrado. NÃO repita o que o cliente já sabe sobre seu próprio negócio. Traga apenas insights NOVOS, dados CONCRETOS e ações EXECUTÁVEIS.

REGRAS:
- Fale em segunda pessoa (você, seu, sua)
- Cite nomes reais, preços em R$, percentuais quando estiverem nos dados
- NÃO invente dados. Se não encontrou, omita o campo
- CNPJ (XX.XXX.XXX/XXXX-XX) NÃO é faturamento. Ignore
- Cada seção deve trazer VALOR ÚNICO — zero redundância entre seções
- A persona deve ter um NOME, ROTINA DIÁRIA, e falar em primeira pessoa
- Os hooks de anúncio devem ser COPIES PRONTOS para usar, não sugestões vagas

JSON (siga esta estrutura exata):
{{
  "persona": {{
    "nome": "Nome fictício realista (ex: Carlos Mendes)",
    "cargo": "Cargo real do decisor de compra",
    "empresa_tipo": "Tipo e porte da empresa onde trabalha",
    "idade": "Faixa etária",
    "narrativa": "Texto em PRIMEIRA PESSOA (3-5 parágrafos): 'Eu sou o Carlos, trabalho como gerente de logística em uma autopeças de médio porte em Campinas. Todo mês preciso...' — Incluir: rotina, frustrações com fornecedores atuais, o que busca, como decide, o que o faria trocar de fornecedor. Usar linguagem informal e realista."
  }},

  "mapa_dores": [
    {{
      "dor": "A frustração específica em uma frase curta",
      "evidencia": "Trecho real ou paráfrase de um comentário/post encontrado nos dados",
      "fonte_tipo": "Reddit/Fórum/Reclame Aqui/Site",
      "oportunidade": "Como o cliente pode resolver isso melhor que a concorrência"
    }}
  ],

  "inteligencia_criativa": {{
    "o_que_concorrentes_fazem": ["O que cada concorrente faz de destaque (cite nomes)"],
    "lacunas": ["O que NENHUM concorrente faz bem — oportunidades de oceano azul"],
    "formatos_que_funcionam": ["Tipos de anúncio/conteúdo que parecem funcionar no setor (ex: vídeo mostrando fábrica, depoimento de cliente)"]
  }},

  "posicionamento": {{
    "frase": "Uma frase de posicionamento de marca clara e memorável (ex: 'A embalagem que protege seu produto e seu lucro')",
    "diferencial_central": "O que torna esse negócio ÚNICO vs. concorrência, baseado nos dados",
    "angulo_ataque": "A fraqueza específica dos concorrentes que o cliente deve atacar"
  }},

  "hooks_anuncio": [
    {{
      "titulo": "Headline do anúncio (máx. 10 palavras, impactante)",
      "copy": "O texto completo do anúncio (3-5 linhas, pronto para usar no Facebook/Instagram)",
      "angulo": "Qual dor/JTBD esse hook ataca",
      "formato_sugerido": "Vídeo UGC / Carrossel / Imagem estática / etc."
    }}
  ],

  "plano_acao": [
    {{
      "prioridade": 1,
      "acao": "Ação concreta e específica",
      "como": "Passo a passo para executar (ferramentas, canais, scripts)",
      "prazo": "Esta semana / Próximas 2 semanas / Este mês",
      "impacto_esperado": "O que o cliente pode esperar como resultado"
    }}
  ]
}}"""

    time.sleep(3)  # Backoff before the big call
    return call_groq(api_key, prompt, temperature=0.4)


# ─────────────────────────────────────────────────────────────────────────────
# Orquestrador Principal
# ─────────────────────────────────────────────────────────────────────────────

def run_business_analysis(args):
    """Run 3-phase agentic business intelligence analysis."""
    description = args.query
    api_key = os.environ.get("GROQ_API_KEY")
    
    if not api_key:
        return {
            "businessMode": True,
            "erro": "Chave da API Groq não configurada. Adicione GROQ_API_KEY no arquivo .env."
        }
    
    all_sources = []
    
    # ═══════════════════════════════════════════════════════════════════════
    # FASE 1: Expansão Semântica
    # ═══════════════════════════════════════════════════════════════════════
    print("🧠 FASE 1/3: Expansão Semântica — entendendo o mercado...", file=sys.stderr)
    try:
        expansion = semantic_expansion(description, api_key)
        print(f"  ✅ Termos: {expansion.get('termos_tecnicos', [])}", file=sys.stderr)
        print(f"  ✅ Concorrentes: {expansion.get('concorrentes_provaveis', [])}", file=sys.stderr)
        print(f"  ✅ Queries: {json.dumps(expansion.get('queries_busca', {}), ensure_ascii=False)}", file=sys.stderr)
    except Exception as e:
        print(f"❌ Erro na Fase 1: {e}", file=sys.stderr)
        return {
            "businessMode": True,
            "erro": f"Erro na expansão semântica: {str(e)[:200]}"
        }
    
    # ═══════════════════════════════════════════════════════════════════════
    # FASE 2: Busca Multi-Dimensional (sequential to avoid rate limits)
    # ═══════════════════════════════════════════════════════════════════════
    print("🔍 FASE 2/3: Busca Multi-Dimensional — coletando dados...", file=sys.stderr)
    
    queries_busca = expansion.get("queries_busca", {})
    termos = expansion.get("termos_tecnicos", [])
    concorrentes = expansion.get("concorrentes_provaveis", [])
    
    termo_principal = termos[0] if termos else description[:30]
    concorrente_1 = concorrentes[0] if concorrentes else "concorrente"
    
    # Build query lists for each dimension
    dim_queries = {
        "mercado": [
            queries_busca.get("mercado", f"{termo_principal} mercado brasil"),
            f"{termo_principal} crescimento mercado tendências 2025",
        ],
        "dores": [
            queries_busca.get("dores_consumidor", f"{termo_principal} reclamação problema"),
            f"site:reddit.com {termo_principal} reclamação",
            f"{termo_principal} reclame aqui defeito atraso",
        ],
        "criativos": [
            queries_busca.get("criativos_concorrentes", f"{termo_principal} anúncio marketing"),
            f"{concorrente_1} anúncio facebook instagram estratégia",
            f"{termo_principal} propaganda marketing digital case",
        ],
        "precos": [
            queries_busca.get("precos_b2b", f"{termo_principal} preço B2B atacado"),
            f"{termo_principal} tabela preço industrial margem lucro",
        ],
    }
    
    dim_results = []
    for dim_id, queries in dim_queries.items():
        dim_name = next((d["nome"] for d in DIMENSIONS if d["id"] == dim_id), dim_id)
        dim_icon = next((d["icone"] for d in DIMENSIONS if d["id"] == dim_id), "🔍")
        print(f"  [{dim_icon}] Buscando: {dim_name} ({len(queries)} queries)...", file=sys.stderr)
        
        try:
            result = search_dimension(dim_id, queries, args.region, max_results=6, max_pages=2)
            dim_results.append(result)
            all_sources.extend(result["sources"])
            print(f"    ✅ {len(result['sources'])} fontes coletadas", file=sys.stderr)
        except Exception as e:
            print(f"    ❌ Erro: {e}", file=sys.stderr)
            dim_results.append({"id": dim_id, "text": "", "sources": [], "query_count": 0})
    
    # ═══════════════════════════════════════════════════════════════════════
    # FASE 3: Síntese Agêntica
    # ═══════════════════════════════════════════════════════════════════════
    print("✨ FASE 3/3: Síntese Agêntica — gerando inteligência integrada...", file=sys.stderr)
    try:
        synthesis = synthesize_intelligence(description, expansion, dim_results, api_key)
        print("  ✅ Relatório gerado com sucesso!", file=sys.stderr)
    except Exception as e:
        print(f"❌ Erro na Fase 3: {e}", file=sys.stderr)
        synthesis = {"erro": f"Falha na síntese: {str(e)[:200]}"}
    
    # Remove duplicate sources preserving order
    unique_sources = list(dict.fromkeys(all_sources))
    
    total_fontes = len(unique_sources)
    print(f"🏁 Análise completa! {total_fontes} fontes consultadas.", file=sys.stderr)
    
    return {
        "businessMode": True,
        "descricao": description,
        "expansao": {
            "termos_tecnicos": expansion.get("termos_tecnicos", []),
            "concorrentes": expansion.get("concorrentes_provaveis", []),
            "quem_compra": expansion.get("quem_compra", []),
            "dores_provaveis": expansion.get("dores_provaveis", []),
            "jtbd": expansion.get("jtbd", {})
        },
        "persona": synthesis.get("persona", {}),
        "mapa_dores": synthesis.get("mapa_dores", []),
        "inteligencia_criativa": synthesis.get("inteligencia_criativa", {}),
        "posicionamento": synthesis.get("posicionamento", {}),
        "hooks_anuncio": synthesis.get("hooks_anuncio", []),
        "plano_acao": synthesis.get("plano_acao", []),
        "allSources": unique_sources,
        "meta": {
            "total_fontes": total_fontes,
            "dimensoes_buscadas": len(dim_results),
            "fases_completadas": 3 if "erro" not in synthesis else 2
        }
    }

# ==============================================================================
# Main
# ==============================================================================

def main():
    parser = argparse.ArgumentParser(description="Search and Summarize CLI")
    parser.add_argument("query", help="Search query or business description")
    parser.add_argument("--max-results", type=int, default=8)
    parser.add_argument("--max-pages", type=int, default=3)
    parser.add_argument("--max-sentences", type=int, default=5)
    parser.add_argument("--region", type=str, default="br-pt")
    parser.add_argument("--business", action="store_true", help="Enable business intelligence mode")
    parser.add_argument("--list-sources", action="store_true")
    parser.add_argument("--no-groq", action="store_true")
    parser.add_argument("--verbose", action="store_true")

    args = parser.parse_args()

    # Configure stdout encoding
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    # Route to appropriate mode
    if args.business:
        output = run_business_analysis(args)
    else:
        output = run_simple_search(args)

    # Output
    print("--- Resumo ---")
    print(json.dumps(output, indent=2, ensure_ascii=False))
    
    # Print sources
    sources = output.get("sources", output.get("allSources", []))
    print("Fontes utilizadas:")
    if sources:
        for url in sources:
            print(url)

if __name__ == "__main__":
    main()
