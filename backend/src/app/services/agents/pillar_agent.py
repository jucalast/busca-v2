"""
Pillar Agent — Autonomous execution engine for each of the 7 sales pillars.

Architecture:
- Each pillar has its own agent that plans, researches, executes, and saves
- Chain context: each pillar reads structured output from its upstream pillars
- The user is the "Director" — gives commands, the agent does the work

Flow per pillar:
1. Trigger: User gives command (or clicks "Executar")
2. Context: Agent reads profile + upstream pillar data
3. Plan: Agent creates micro-tasks it will execute itself
4. Execute: Agent runs searches, processes data, generates insights
5. Save: Agent saves structured output in pillar-specific schema
"""

import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.core.web_utils import search_duckduckgo, scrape_page
import traceback
from app.core import database as db


# ═══════════════════════════════════════════════════════════════════
# Pillar Definitions — schemas, dependencies, and search strategies
# ═══════════════════════════════════════════════════════════════════

PILLARS = {
    "publico_alvo": {
        "label": "Público-Alvo e Personas",
        "ordem": 1,
        "upstream": [],
        "output_schema": {
            "personas": [
                {
                    "nome": "Nome da persona",
                    "idade_faixa": "25-35",
                    "genero": "F/M/Todos",
                    "profissao_papel": "Cargo ou papel",
                    "renda_faixa": "R$ X - R$ Y",
                    "dores_principais": ["dor 1", "dor 2"],
                    "desejos": ["desejo 1", "desejo 2"],
                    "objecoes_compra": ["objeção 1"],
                    "onde_encontrar": ["Instagram", "Google"],
                    "gatilhos_compra": ["gatilho 1"],
                    "como_decide": "Descrição do processo decisório",
                }
            ],
            "perfil_cliente_ideal": {
                "descricao": "Resumo do cliente ideal",
                "segmento_principal": "B2B/B2C/etc",
                "ticket_medio_ideal": "R$ X",
                "frequencia_compra": "mensal/trimestral/etc",
                "ltv_estimado": "R$ X",
            },
            "dados_demograficos": {
                "regioes_principais": ["região 1"],
                "faixa_etaria_dominante": "25-45",
                "poder_aquisitivo": "medio/alto",
            },
            "insights_mercado": ["insight 1", "insight 2"],
        },
        "search_queries_template": [
            "{segmento} perfil cliente ideal quem compra",
            "{segmento} {localizacao} público-alvo personas",
            "{segmento} comportamento consumidor tendências 2025",
        ],
    },
    "branding": {
        "label": "Branding e Posicionamento",
        "ordem": 2,
        "upstream": ["publico_alvo"],
        "output_schema": {
            "posicionamento": {
                "declaracao": "Frase de posicionamento",
                "proposta_valor": "Proposta de valor única",
                "diferencial_competitivo": "O que diferencia",
                "promessa_marca": "Promessa central",
            },
            "tom_de_voz": {
                "personalidade": ["adjetivo 1", "adjetivo 2"],
                "palavras_chave": ["palavra 1"],
                "evitar": ["palavra a evitar"],
                "exemplo_comunicacao": "Exemplo de texto na voz da marca",
            },
            "analise_concorrentes": [
                {
                    "nome": "Concorrente",
                    "pontos_fortes": ["ponto"],
                    "pontos_fracos": ["ponto"],
                    "como_superar": "Estratégia",
                }
            ],
            "territorio_marca": {
                "categoria": "Território principal",
                "associacoes_desejadas": ["associação"],
                "associacoes_evitar": ["associação"],
            },
        },
        "search_queries_template": [
            "{segmento} {localizacao} concorrentes principais",
            "{segmento} posicionamento marca diferencial",
            "{segmento} proposta de valor cases sucesso",
        ],
    },
    "identidade_visual": {
        "label": "Identidade Visual",
        "ordem": 3,
        "upstream": ["publico_alvo", "branding"],
        "output_schema": {
            "diretrizes_visuais": {
                "estilo_geral": "Minimalista/Bold/Elegante/etc",
                "paleta_cores_sugerida": ["#hex1", "#hex2"],
                "tipografia_sugerida": {"titulo": "Font", "corpo": "Font"},
                "referencias_visuais": ["referência 1"],
            },
            "diagnostico_atual": {
                "nota_coerencia": "1-10",
                "problemas_detectados": ["problema"],
                "oportunidades": ["oportunidade"],
            },
            "plano_melhoria": [
                {"item": "O que melhorar", "prioridade": "alta/media/baixa", "como": "Como fazer"}
            ],
        },
        "search_queries_template": [
            "{segmento} identidade visual tendências 2025",
            "{segmento} design marca exemplos",
        ],
    },
    "canais_venda": {
        "label": "Canais de Venda",
        "ordem": 4,
        "upstream": ["publico_alvo", "branding"],
        "output_schema": {
            "canais_atuais": [
                {"canal": "Nome", "status": "ativo/inativo", "performance": "descrição"}
            ],
            "canais_recomendados": [
                {
                    "canal": "Nome",
                    "motivo": "Por que esse canal",
                    "investimento_inicial": "R$ X",
                    "tempo_implementacao": "X semanas",
                    "roi_esperado": "descrição",
                }
            ],
            "estrategia_integracao": "Como integrar todos os canais",
            "prioridade_implementacao": ["canal 1", "canal 2"],
        },
        "search_queries_template": [
            "{segmento} canais de venda mais eficientes",
            "{segmento} {localizacao} como vender mais onde encontrar clientes",
            "{segmento} marketplace ecommerce canais digitais",
        ],
    },
    "trafego_organico": {
        "label": "Tráfego Orgânico",
        "ordem": 5,
        "upstream": ["publico_alvo", "branding", "identidade_visual"],
        "output_schema": {
            "estrategia_seo": {
                "palavras_chave_principais": ["keyword 1"],
                "google_meu_negocio": {"status": "ativo/inativo", "acoes": ["ação"]},
                "oportunidades_locais": ["oportunidade"],
            },
            "plano_conteudo": {
                "pilares_conteudo": ["pilar 1"],
                "formatos_prioritarios": ["Reels", "Blog", "Stories"],
                "frequencia_sugerida": "X posts/semana",
                "ideias_conteudo": [
                    {"titulo": "Ideia", "formato": "Reel/Post/Blog", "objetivo": "engajamento/conversao"}
                ],
            },
            "redes_sociais": {
                "canais_prioritarios": ["Instagram", "YouTube"],
                "estrategia_por_canal": {"Instagram": "estratégia específica"},
            },
            "metricas_acompanhar": ["métrica 1"],
        },
        "search_queries_template": [
            "{segmento} SEO local como aparecer Google",
            "{segmento} marketing conteúdo orgânico redes sociais estratégia",
            "{segmento} Google Meu Negócio otimização",
        ],
    },
    "trafego_pago": {
        "label": "Tráfego Pago",
        "ordem": 6,
        "upstream": ["publico_alvo", "branding", "identidade_visual", "canais_venda"],
        "output_schema": {
            "estrategia_ads": {
                "plataformas_recomendadas": ["Meta Ads", "Google Ads"],
                "orcamento_sugerido_mensal": "R$ X",
                "divisao_orcamento": {"Meta Ads": "60%", "Google Ads": "40%"},
            },
            "campanhas_sugeridas": [
                {
                    "nome": "Campanha",
                    "plataforma": "Meta Ads",
                    "objetivo": "conversão/alcance/tráfego",
                    "publico_alvo": "Segmentação",
                    "orcamento_diario": "R$ X",
                    "copy_sugerida": "Texto do anúncio",
                    "cta": "Call to action",
                }
            ],
            "metricas_meta": {"cpa_alvo": "R$ X", "roas_alvo": "X:1"},
        },
        "search_queries_template": [
            "{segmento} Meta Ads Google Ads estratégia anúncios",
            "{segmento} custo aquisição cliente anúncios pagos ROI",
        ],
    },
    "processo_vendas": {
        "label": "Processo de Vendas",
        "ordem": 7,
        "upstream": ["publico_alvo", "canais_venda", "trafego_organico", "trafego_pago"],
        "output_schema": {
            "funil_vendas": {
                "etapas": [
                    {"nome": "Etapa", "descricao": "O que acontece", "taxa_conversao_estimada": "X%"}
                ],
                "gargalos_identificados": ["gargalo"],
            },
            "scripts_venda": [
                {"situacao": "Primeiro contato", "script": "Texto do script", "objecao_coberta": "Objeção"}
            ],
            "precificacao": {
                "estrategia": "Valor percebido/Competitiva/Premium",
                "ticket_medio_sugerido": "R$ X",
                "margem_ideal": "X%",
                "modelo_recorrencia": "assinatura/pacote/avulso",
            },
            "pos_venda": {
                "estrategia_fidelizacao": "Descrição",
                "upsell_crosssell": ["oportunidade 1"],
            },
        },
        "search_queries_template": [
            "{segmento} processo vendas funil conversão",
            "{segmento} precificação margem lucro ticket médio",
            "{segmento} scripts vendas contorno objeções",
        ],
    },
}

PILLAR_ORDER = sorted(PILLARS.keys(), key=lambda k: PILLARS[k]["ordem"])


# ═══════════════════════════════════════════════════════════════════
# Agent Core — autonomous planning, research, execution
# ═══════════════════════════════════════════════════════════════════

def _extract_json(text: str) -> dict:
    """Extract JSON object from raw LLM text, handling markdown code blocks."""
    if not text:
        raise ValueError("Resposta vazia do modelo")

    # Strip markdown code fences
    import re
    text = text.strip()
    # Remove ```json ... ``` or ``` ... ```
    fence = re.search(r'```(?:json)?\s*([\s\S]*?)```', text)
    if fence:
        text = fence.group(1).strip()

    # Find first { and last }
    start = text.find('{')
    end = text.rfind('}')
    if start == -1 or end == -1:
        raise ValueError(f"Nenhum JSON encontrado na resposta: {text[:200]}")

    json_str = text[start:end + 1]
    return json.loads(json_str)


def _build_schema_description(schema: dict, depth: int = 0) -> str:
    """
    Convert a nested schema dict into a flat, readable field description
    that the LLM can reliably follow without triggering JSON validation errors.
    Returns a compact JSON skeleton with type hints as values.
    """
    def _simplify(val, d=0):
        if isinstance(val, dict):
            return {k: _simplify(v, d + 1) for k, v in val.items()}
        if isinstance(val, list):
            if not val:
                return []
            inner = _simplify(val[0], d + 1)
            return [inner]
        if isinstance(val, str):
            return val  # keep example strings as hints
        return val

    simplified = _simplify(schema)
    return json.dumps(simplified, ensure_ascii=False, indent=2)


def run_pillar_agent(
    pillar_key: str,
    business_id: str,
    profile: dict,
    user_command: str = "",
    emit_thought=None,
) -> dict:
    """
    Run the autonomous agent for a specific pillar.
    
    Flow:
    1. Load upstream pillar data (chain context)
    2. Research: search web for pillar-specific data
    3. Plan + Execute: LLM generates structured output using research + upstream data
    4. Save: persist structured output to database
    
    Args:
        pillar_key: One of the 7 pillar keys
        business_id: Business identifier for data persistence
        profile: Business profile from profiler
        user_command: Optional user directive (e.g. "Focus on B2B personas")
        emit_thought: Optional callback for streaming progress
    """
    if pillar_key not in PILLARS:
        return {"success": False, "error": f"Pilar '{pillar_key}' não existe."}

    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return {"success": False, "error": "GROQ_API_KEY não configurada."}

    pillar = PILLARS[pillar_key]
    perfil = profile.get("perfil", profile)
    restricoes = profile.get("restricoes_criticas", {})

    nome = perfil.get("nome", perfil.get("nome_negocio", "Negócio"))
    segmento = perfil.get("segmento", "")
    localizacao = perfil.get("localizacao", "")
    modelo = perfil.get("modelo_negocio", "")

    def thought(msg):
        print(f"  💭 [{pillar_key}] {msg}", file=sys.stderr)
        if emit_thought:
            emit_thought(msg)

    thought(f"Iniciando agente: {pillar['label']}")

    # ── Step 1: Load upstream pillar data ──
    thought("Carregando dados dos pilares anteriores...")
    upstream_data = {}
    for up_key in pillar["upstream"]:
        up_data = db.get_pillar_data(business_id, up_key)
        if up_data:
            upstream_data[up_key] = up_data.get("structured_output", {})
            thought(f"  ✅ Dados de '{up_key}' carregados")
        else:
            thought(f"  ⚠️ Pilar '{up_key}' ainda não foi executado")

    # Build compact upstream summary for the prompt
    upstream_summary = ""
    for up_key, up_output in upstream_data.items():
        up_label = PILLARS[up_key]["label"]
        compact = json.dumps(up_output, ensure_ascii=False)
        if len(compact) > 800:
            compact = compact[:800] + "..."
        upstream_summary += f"\n### {up_label}:\n{compact}\n"

    # ── Step 2: Research — search web for pillar-specific data ──
    thought("Pesquisando dados reais na internet...")
    research_text = ""
    research_sources = []

    queries = pillar["search_queries_template"]
    for qi, query_tpl in enumerate(queries):
        query = query_tpl.format(
            segmento=segmento,
            localizacao=localizacao,
            nome=nome,
        )
        thought(f"  🔍 Buscando: {query[:80]}...")

        results = search_duckduckgo(query, max_results=4, region='br-pt')
        for i, r in enumerate(results or []):
            url = r.get("href", "")
            research_sources.append(url)
            snippet = r.get("body", "")
            title = r.get("title", "")
            research_text += f"[Fonte {len(research_sources)}] {title}: {snippet}\n"

            if i < 1:  # Scrape top result per query
                content = scrape_page(url, timeout=4)
                if content:
                    research_text += f"Conteúdo: {content[:2500]}\n\n"

        time.sleep(1)  # Rate limit courtesy

    thought(f"Pesquisa concluída: {len(research_sources)} fontes encontradas")

    # ── Step 3: Plan + Execute — LLM generates structured output ──
    thought("IA analisando dados e gerando resultados...")

    # Build restriction context
    restriction_lines = []
    capital = restricoes.get("capital_disponivel", "")
    equipe_solo = restricoes.get("equipe_solo", False)
    if capital in ["zero", "baixo"]:
        restriction_lines.append("Capital ZERO ou baixo: apenas soluções gratuitas ou muito baratas")
    if equipe_solo:
        restriction_lines.append("Equipe de 1 pessoa: tudo deve ser executável solo")
    restriction_text = "\n".join(restriction_lines) if restriction_lines else "Sem restrições especiais"

    schema_description = _build_schema_description(pillar["output_schema"])

    prompt = f"""Você é especialista em {pillar['label']} para PMEs brasileiras.
Empresa: "{nome}" | {segmento} | {modelo} | {localizacao}
{f'Diretiva: {user_command}' if user_command else ''}
Funcionários: {perfil.get('num_funcionarios','?')} | Ticket: {perfil.get('ticket_medio', perfil.get('ticket_medio_estimado','?'))} | Restrições: {restriction_text}
{f'CONTEXTO UPSTREAM:{upstream_summary}' if upstream_summary else ''}
PESQUISA INTERNET:
{research_text[:5000] if research_text else 'Use seu conhecimento especializado.'}

Retorne SOMENTE um objeto JSON com exatamente estes campos (sem texto extra, sem markdown):
{schema_description}

Todos os valores devem ser específicos para "{nome}". Não use valores de exemplo."""

    try:
        raw = call_llm(
            api_key, prompt,
            temperature=0.2,
            model="llama-3.3-70b-versatile",
            force_json=False,
        )
        result = _extract_json(raw)
    except Exception as e:
        thought(f"Modelo principal falhou, tentando alternativo...")
        try:
            raw = call_llm(
                api_key, prompt,
                temperature=0.2,
                model="llama-3.1-8b-instant",
                force_json=False,
            )
            result = _extract_json(raw)
        except Exception as e2:
            return {
                "success": False,
                "error": f"Erro ao executar agente: {str(e2)[:200]}",
                "sources": research_sources,
            }

    thought("Resultado gerado com sucesso!")

    # ── Step 4: Save structured output ──
    thought("Salvando dados estruturados...")
    try:
        db.save_pillar_data(
            business_id=business_id,
            pillar_key=pillar_key,
            structured_output=result,
            sources=research_sources,
            user_command=user_command,
        )
        thought(f"✅ Dados de {pillar['label']} salvos com sucesso")
    except Exception as e:
        thought(f"⚠️ Erro ao salvar: {e}")

    return {
        "success": True,
        "pillar_key": pillar_key,
        "label": pillar["label"],
        "data": result,
        "sources": research_sources,
        "upstream_used": list(upstream_data.keys()),
    }


def get_pillar_status(business_id: str) -> dict:
    """
    Get the execution status of all pillars for a business.
    Returns which pillars have been executed and which are ready.
    """
    status = {}
    for key in PILLAR_ORDER:
        pillar = PILLARS[key]
        data = db.get_pillar_data(business_id, key)
        
        # Check if upstream pillars are completed
        upstream_ready = all(
            db.get_pillar_data(business_id, up) is not None
            for up in pillar["upstream"]
        )
        
        status[key] = {
            "label": pillar["label"],
            "ordem": pillar["ordem"],
            "completed": data is not None,
            "ready": upstream_ready or len(pillar["upstream"]) == 0,
            "upstream": pillar["upstream"],
            "updated_at": data.get("updated_at") if data else None,
        }
    
    return status
