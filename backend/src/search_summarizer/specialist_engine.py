"""
Specialist Engine — 7 Professionals, 1 Business.

Each of the 7 sales pillars is treated as an independent specialist professional
who diagnoses, plans, executes, and measures results.

Architecture: Token-Efficient Layered Context
─────────────────────────────────────────────
Layer 0: Compact Business Brief (CBB)  ~300 tokens — generated once, shared by all
Layer 1: Market Intel Digest           ~200 tokens — compressed from research
Layer 2: Digital Footprint             ~150 tokens — from discovery
Layer 3: Pillar States                 ~100 tokens each — from diagnosis
Layer 4: Cross-Pillar Insights         ~50 tokens each — only upstream
Layer 5: Execution History             ~100 tokens — what was done + results

Total per specialist call: ~800-1200 tokens context (very efficient!)

Key Innovation: "Resultado = Novo Dado"
After execution, results become NEW DATA that feeds back into the business profile.
"""

import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cli import call_groq, search_duckduckgo, scrape_page
import database as db

# ═══════════════════════════════════════════════════════════════════
# SPECIALIST PERSONAS — Each pillar is a real professional
# ═══════════════════════════════════════════════════════════════════

SPECIALISTS = {
    "publico_alvo": {
        "cargo": "Analista de Inteligência de Mercado",
        "persona": "Você é um analista sênior de inteligência de mercado. Sua obsessão é entender QUEM é o cliente ideal, onde ele está, o que ele pensa, e como chegar até ele. Você trabalha com dados e personas detalhadas.",
        "kpis": ["custo_aquisicao_cliente", "taxa_conversao_lead", "volume_leads_qualificados"],
        "escopo": "Pesquisa, segmentação e definição de público-alvo. Mapear personas, dores, desejos, demografia, comportamento de compra, jornada do cliente.",
        "entregaveis_obrigatorios": [
            "Documento de Persona detalhada (nome fictício, idade, cargo, dores, desejos, objeções, canais preferidos)",
            "Mapa da Jornada do Cliente (descoberta → consideração → decisão → pós-compra)",
            "Segmentação de mercado (primário, secundário, terciário)",
        ],
        "nao_fazer": "NÃO crie conteúdo, NÃO faça posts, NÃO crie perfis em redes sociais, NÃO monte funis de e-mail, NÃO defina identidade visual, NÃO configure canais de venda. Seu trabalho é APENAS pesquisar e definir QUEM é o cliente.",
    },
    "branding": {
        "cargo": "Estrategista de Marca",
        "persona": "Você é um estrategista de marca com 15 anos de experiência. Analisa posicionamento competitivo, proposta de valor e percepção do mercado. Pensa em diferenciação e mensagem central.",
        "kpis": ["clareza_proposta_valor", "diferenciacao_competitiva", "consistencia_mensagem"],
        "escopo": "Posicionamento de marca, proposta de valor, tom de voz, mensagem central, análise competitiva, diferenciação, brand story.",
        "entregaveis_obrigatorios": [
            "Declaração de Posicionamento (para [público], [marca] é a [categoria] que [diferencial] porque [razão])",
            "Proposta de Valor única (o que entrega, como, por que é diferente)",
            "Tom de Voz e Personalidade da marca (formal/informal, técnico/acessível, adjetivos-chave)",
            "Análise competitiva vs concorrentes (forças e fraquezas relativas)",
        ],
        "nao_fazer": "NÃO crie logos, NÃO faça posts em redes sociais, NÃO crie calendário de conteúdo, NÃO configure canais, NÃO monte campanhas de ads. Seu trabalho é APENAS definir a ESTRATÉGIA da marca.",
    },
    "identidade_visual": {
        "cargo": "Diretor de Criação",
        "persona": "Você é um diretor de criação que define a linguagem visual da marca. Cria sistemas visuais coerentes: paleta de cores, tipografia, estilo fotográfico, templates.",
        "kpis": ["consistencia_visual", "qualidade_conteudo", "profissionalismo_percebido"],
        "escopo": "Paleta de cores, tipografia, estilo visual, templates gráficos, guia de estilo visual, padrões para fotos e vídeos.",
        "entregaveis_obrigatorios": [
            "Guia de Estilo Visual (paleta de cores com códigos hex, tipografia primária e secundária, estilo fotográfico)",
            "Templates prontos para posts (feed, stories, carrossel — especificações de design)",
            "Regras de aplicação visual (o que fazer e não fazer com a marca visualmente)",
        ],
        "nao_fazer": "NÃO publique conteúdo, NÃO crie calendário editorial, NÃO configure redes sociais, NÃO faça SEO, NÃO monte campanhas. Seu trabalho é APENAS definir o SISTEMA VISUAL.",
    },
    "canais_venda": {
        "cargo": "Gerente de Canais de Venda",
        "persona": "Você é um gerente de canais que otimiza a distribuição do produto. Analisa cada canal existente, identifica gaps e oportunidades de novos canais. Foca em receita por canal.",
        "kpis": ["receita_por_canal", "diversificacao_canais", "taxa_conversao_canal"],
        "escopo": "Mapeamento e otimização de canais: e-commerce, marketplace, WhatsApp Business, loja física, Instagram Shopping, atacado, representantes. Configuração e integração entre canais.",
        "entregaveis_obrigatorios": [
            "Mapa de Canais (canais atuais vs ideais, receita estimada por canal, prioridade de ativação)",
            "Plano de ativação de novo canal (passo-a-passo para o canal mais promissor)",
            "Checklist de otimização dos canais existentes (bio, catálogo, resposta, horário, CTA)",
        ],
        "nao_fazer": "NÃO crie conteúdo/posts, NÃO faça SEO, NÃO monte campanhas pagas, NÃO defina personas, NÃO crie identidade visual. Seu trabalho é APENAS mapear, ativar e otimizar ONDE o produto é vendido.",
    },
    "trafego_organico": {
        "cargo": "Especialista em SEO e Conteúdo",
        "persona": "Você é um especialista em tráfego orgânico: SEO local, marketing de conteúdo, redes sociais orgânico. Cria estratégias de conteúdo que geram visibilidade e leads sem pagar por anúncios.",
        "kpis": ["trafego_organico_mensal", "engajamento_redes", "posicao_google_local"],
        "escopo": "SEO local, Google Meu Negócio, calendário editorial, estratégia de conteúdo (posts, reels, stories, blog, YouTube), hashtags, frequência, engajamento orgânico.",
        "entregaveis_obrigatorios": [
            "Calendário editorial mensal (temas, formatos, frequência por rede social)",
            "Estratégia de SEO local (Google Meu Negócio, palavras-chave locais, ficha otimizada)",
            "Plano de conteúdo por formato (reels, carrossel, stories — com temas específicos do negócio)",
        ],
        "nao_fazer": "NÃO defina personas (use a do Pilar 1), NÃO defina tom de voz (use o do Pilar 2), NÃO crie paleta visual (use a do Pilar 3), NÃO configure canais novos, NÃO monte campanhas pagas. Seu trabalho é APENAS gerar TRÁFEGO ORGÂNICO com conteúdo.",
    },
    "trafego_pago": {
        "cargo": "Gestor de Performance e Mídia Paga",
        "persona": "Você é um gestor de mídia paga focado em ROI. Projeta campanhas com orçamento real, segmentação precisa e metas mensuráveis. Analisa copy, criativos e funil de anúncio.",
        "kpis": ["roas", "custo_por_aquisicao", "ctr_anuncios"],
        "escopo": "Meta Ads, Google Ads, estrutura de campanhas, segmentação de público, copy de anúncios, orçamento de mídia, remarketing, funil de anúncio, A/B testing.",
        "entregaveis_obrigatorios": [
            "Estrutura de campanha (objetivo, público, posicionamento, orçamento diário)",
            "3-5 copies de anúncio prontos (headline, texto, CTA — adaptados ao público do Pilar 1)",
            "Plano de orçamento e metas (investimento → cliques → leads → vendas esperadas)",
        ],
        "nao_fazer": "NÃO crie conteúdo orgânico, NÃO faça SEO, NÃO defina identidade visual, NÃO reconfigure canais, NÃO defina personas do zero (use a do Pilar 1). Seu trabalho é APENAS MÍDIA PAGA.",
    },
    "processo_vendas": {
        "cargo": "Consultor de Processos Comerciais",
        "persona": "Você é um consultor comercial que otimiza o funil de vendas do zero ao pós-venda. Analisa precificação, ticket médio, objeções, scripts e fidelização. Foca em conversão e margem.",
        "kpis": ["taxa_conversao_venda", "ticket_medio", "margem_lucro", "taxa_recompra"],
        "escopo": "Funil de vendas, scripts de abordagem e fechamento, contorno de objeções, precificação, follow-up, pós-venda, fidelização, upsell/cross-sell.",
        "entregaveis_obrigatorios": [
            "Funil de vendas desenhado (etapas, taxas de conversão esperadas, gatilhos de avanço)",
            "Scripts de venda (abordagem, apresentação, contorno de objeção, fechamento)",
            "Estratégia de pós-venda e fidelização (follow-up, NPS, programa de recompra)",
        ],
        "nao_fazer": "NÃO crie conteúdo para redes, NÃO faça SEO, NÃO monte campanhas de ads, NÃO defina identidade visual, NÃO configure canais novos. Seu trabalho é APENAS o PROCESSO COMERCIAL de conversão.",
    },
}


# ═══════════════════════════════════════════════════════════════════
# LAYER 0: Compact Business Brief (CBB)
# ═══════════════════════════════════════════════════════════════════

def generate_business_brief(profile: dict, discovery_data: dict = None, market_data: dict = None) -> dict:
    """
    Generate a Compact Business Brief (~300 tokens) from all data sources.
    This is generated ONCE and shared by all 7 specialists.
    
    Data fusion: profile + discovery + market → compressed brief
    """
    perfil = profile.get("perfil", profile)
    restricoes = profile.get("restricoes_criticas", {})

    # ── Business DNA (from user) ──
    dna = {
        "nome": perfil.get("nome", perfil.get("nome_negocio", "?")),
        "segmento": perfil.get("segmento", "?"),
        "modelo": perfil.get("modelo_negocio", perfil.get("modelo", "?")),
        "localizacao": perfil.get("localizacao", "?"),
        "equipe": perfil.get("num_funcionarios", "?"),
        "capital": restricoes.get("capital_disponivel", perfil.get("capital_disponivel", "?")),
        "faturamento": perfil.get("faturamento_mensal", perfil.get("faturamento_faixa", "?")),
        "ticket_medio": perfil.get("ticket_medio", perfil.get("ticket_medio_estimado", "?")),
        "diferencial": perfil.get("diferencial", "?"),
        "cliente_ideal": perfil.get("cliente_ideal", perfil.get("publico_alvo", "?")),
        "dificuldade_principal": perfil.get("dificuldades", "?"),
        "canais_atuais": perfil.get("canais_venda", "?"),
        "concorrentes": perfil.get("concorrentes", "?"),
        "origem_clientes": perfil.get("origem_clientes", "?"),
        "maior_objecao": perfil.get("maior_objecao", "?"),
    }

    # ── Digital Footprint (from discovery) ──
    footprint = {}
    if discovery_data and discovery_data.get("found"):
        pd = discovery_data.get("presenca_digital", {})
        for canal, info in pd.items():
            if isinstance(info, dict) and info.get("encontrado"):
                summary_parts = []
                if info.get("handle"): summary_parts.append(f"@{info['handle']}")
                if info.get("seguidores"): summary_parts.append(f"{info['seguidores']} seg")
                if info.get("url"): summary_parts.append(info["url"][:60])
                if info.get("engajamento_estimado"): summary_parts.append(f"eng: {info['engajamento_estimado']}")
                if info.get("qualidade_seo"): summary_parts.append(f"SEO: {info['qualidade_seo']}")
                footprint[canal] = " | ".join(summary_parts) if summary_parts else "presente"

    # ── Market Intel Digest (from research) ──
    # Include visao_geral + top pontos_chave for richer specialist context
    market_digest = {}
    if market_data:
        categories = market_data.get("categories", [])
        for cat in categories[:7]:
            cat_id = cat.get("id", "")
            resumo = cat.get("resumo", {})
            if isinstance(resumo, dict):
                parts = []
                visao = resumo.get("visao_geral", "")
                if visao:
                    parts.append(visao[:200])
                for p in (resumo.get("pontos_chave") or [])[:3]:
                    pt = p if isinstance(p, str) else str(p)
                    parts.append(f"• {pt[:120]}")
                if parts:
                    market_digest[cat_id] = "\n".join(parts)

    # ── Restrictions ──
    restricao_flags = []
    if dna["capital"] in ("zero", "baixo", "nenhum", "0"):
        restricao_flags.append("capital_zero")
    equipe = str(dna["equipe"]).lower()
    if equipe in ("1", "solo", "só eu", "sozinho"):
        restricao_flags.append("equipe_solo")

    brief = {
        "dna": dna,
        "footprint": footprint,
        "market_digest": market_digest,
        "restricoes": restricao_flags,
    }

    return brief


def brief_to_text(brief: dict, max_tokens: int = 600) -> str:
    """Convert business brief to compact text for LLM injection."""
    dna = brief.get("dna", {})
    fp = brief.get("footprint", {})
    md = brief.get("market_digest", {})
    restr = brief.get("restricoes", [])

    lines = [
        f"NEGÓCIO: {dna.get('nome','?')} | {dna.get('segmento','?')} | {dna.get('modelo','?')} | {dna.get('localizacao','?')}",
        f"Equipe: {dna.get('equipe','?')} | Capital: {dna.get('capital','?')} | Faturamento: {dna.get('faturamento','?')} | Ticket: {dna.get('ticket_medio','?')}",
        f"Diferencial: {dna.get('diferencial','?')}",
        f"Cliente ideal: {dna.get('cliente_ideal','?')}",
        f"Canais atuais: {dna.get('canais_atuais','?')}",
        f"Dificuldade: {dna.get('dificuldade_principal','?')}",
        f"Concorrentes: {dna.get('concorrentes','?')}",
        f"Objeção: {dna.get('maior_objecao','?')}",
    ]

    if fp:
        lines.append("PRESENÇA DIGITAL REAL:")
        for canal, info in fp.items():
            lines.append(f"  {canal}: {info}")

    if md:
        lines.append("MERCADO:")
        for cat_id, visao in list(md.items())[:4]:
            lines.append(f"  {cat_id}: {visao}")

    if restr:
        lines.append(f"RESTRIÇÕES: {', '.join(restr)}")

    text = "\n".join(lines)
    return text[:max_tokens * 4]  # rough char→token estimate


# ═══════════════════════════════════════════════════════════════════
# LAYER 3+4: UPSTREAM CASCADE — Assembly Line Data Injection
# ═══════════════════════════════════════════════════════════════════
# Each downstream specialist reads the FULL REPORT from upstream
# specialists. No re-searching — pure data reuse from the DB.
#
# Cascade:
#   1. publico_alvo    → foundation (no deps)
#   2. branding        → reads publico_alvo outputs
#   3. identidade_visual → reads publico_alvo + branding
#   4. canais_venda    → reads 1+2+3
#   5. trafego_organico → reads 1+2+3+4
#   6. trafego_pago    → reads 1+2+3+4
#   7. processo_vendas → reads ALL above
# ═══════════════════════════════════════════════════════════════════

def build_cross_pillar_context(analysis_id: str, target_pillar: str, all_diagnostics: dict = None) -> str:
    """Build rich context from upstream pillar outputs for this specialist.
    
    Queries the DB for each upstream pillar's:
    - Diagnostic (score, gaps, key data, meta)
    - Plan (tasks, KPIs, objectives)
    - Execution results (deliverables produced)
    
    This is the ASSEMBLY LINE: downstream specialists read upstream reports
    instead of re-searching the web. Token-efficient and hyper-coherent.
    """
    from business_scorer import DIMENSIONS

    upstream_keys = DIMENSIONS.get(target_pillar, {}).get("upstream", [])
    if not upstream_keys:
        return ""

    sections = []

    for uk in upstream_keys:
        label = DIMENSIONS.get(uk, {}).get("label", uk)
        up_spec = SPECIALISTS.get(uk, {})
        cargo = up_spec.get("cargo", "Especialista")

        # ── 1. Diagnostic data (always available after analysis) ──
        diag = None
        if all_diagnostics and uk in all_diagnostics:
            diag = all_diagnostics[uk]
        else:
            diag = db.get_pillar_diagnostic(analysis_id, uk)

        if not diag:
            sections.append(f"📋 {label} ({cargo}): Sem dados ainda.")
            continue

        score = diag.get("score", 0)
        status = diag.get("status", "sem_dados")
        estado = diag.get("estado_atual", {})
        gaps = diag.get("gaps", [])

        part = f"📋 {label} ({cargo}) — {score}/100 ({status})\n"

        # Extract key variables from diagnostic
        if isinstance(estado, dict):
            justif = estado.get("justificativa", "")
            if justif:
                part += f"  Situação: {justif[:200]}\n"
            dado_chave = estado.get("dado_chave", "")
            if dado_chave:
                part += f"  Dado-chave: {dado_chave[:150]}\n"
            meta = estado.get("meta_pilar", "")
            if meta:
                part += f"  Meta: {meta[:150]}\n"

        if gaps and isinstance(gaps, list):
            part += "  Gaps: " + "; ".join(str(g)[:80] for g in gaps[:3]) + "\n"

        # ── 2. Plan data (available if user opened this pillar) ──
        plan = db.get_pillar_plan(analysis_id, uk)
        if plan and plan.get("plan_data"):
            pd = plan["plan_data"]
            obj = pd.get("objetivo", "")
            if obj:
                part += f"  Objetivo do plano: {obj[:150]}\n"

            # Extract key deliverables from task list
            tarefas = pd.get("tarefas", pd.get("acoes", []))
            if tarefas:
                titles = [t.get("titulo", "")[:60] for t in tarefas[:5]]
                part += f"  Tarefas planejadas: {' → '.join(titles)}\n"

            # KPIs defined
            kpis = pd.get("kpis_pilar", [])
            if kpis:
                kpi_strs = [f"{k.get('nome','')}: {k.get('meta','')}" for k in kpis[:3]]
                part += f"  KPIs: {'; '.join(kpi_strs)}\n"

            resultado = pd.get("resultado_final", "")
            if resultado:
                part += f"  Resultado esperado: {resultado[:150]}\n"

        # ── 3. Execution results (available if tasks were executed) ──
        results = db.get_pillar_results(analysis_id, uk)
        executed = [r for r in (results or []) if r.get("status") in ("completed", "ai_executed", "ai_partial")]
        if executed:
            part += "  Entregáveis produzidos:\n"
            for r in executed[:4]:
                outcome = r.get("outcome", "")[:100]
                impact = r.get("business_impact", "")[:80]
                part += f"    ✅ {r.get('action_title', '')[:60]}: {outcome}"
                if impact:
                    part += f" → {impact}"
                part += "\n"

        sections.append(part)

    if not sections:
        return ""

    header = "═══ RELATÓRIOS DOS ESPECIALISTAS ANTERIORES (use como base — NÃO pesquise novamente) ═══"
    return header + "\n" + "\n".join(sections)


# ═══════════════════════════════════════════════════════════════════
# LAYER 5: Execution History Context
# ═══════════════════════════════════════════════════════════════════

def build_execution_context(analysis_id: str, pillar_key: str) -> str:
    """Build context from completed actions and their outcomes."""
    results = db.get_pillar_results(analysis_id, pillar_key)
    if not results:
        return ""

    completed = [r for r in results if r["status"] == "completed"]
    if not completed:
        return ""

    lines = ["AÇÕES JÁ EXECUTADAS NESTE PILAR (resultados reais):"]
    for r in completed[:5]:
        outcome = r.get("outcome", "sem resultado registrado")
        impact = r.get("business_impact", "")
        lines.append(f"✅ {r['action_title']}: {outcome}" + (f" → Impacto: {impact}" if impact else ""))

    return "\n".join(lines)


# ═══════════════════════════════════════════════════════════════════
# SPECIALIST PLAN GENERATION (per-pillar, JIT)
# ═══════════════════════════════════════════════════════════════════

def generate_pillar_plan(
    analysis_id: str,
    pillar_key: str,
    brief: dict,
    diagnostic: dict = None,
    all_diagnostics: dict = None,
) -> dict:
    """
    A specialist creates a professional ACTION PLAN for their pillar.
    
    This is called JIT when the user clicks on a pillar to see its plan.
    The specialist uses:
    - Business Brief (Layer 0)
    - Their own diagnostic (Layer 3)
    - Cross-pillar insights (Layer 4)
    - Execution history (Layer 5)
    - Fresh web research (RAG)
    """
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return {"success": False, "error": "GROQ_API_KEY not configured"}

    spec = SPECIALISTS.get(pillar_key)
    if not spec:
        return {"success": False, "error": f"Unknown pillar: {pillar_key}"}

    from business_scorer import DIMENSIONS
    dim_cfg = DIMENSIONS.get(pillar_key, {})

    # Load diagnostic if not provided
    if not diagnostic:
        diagnostic = db.get_pillar_diagnostic(analysis_id, pillar_key)
    if not diagnostic:
        return {"success": False, "error": f"Diagnóstico não encontrado para {pillar_key}. Execute a análise primeiro."}

    # ── Build context layers ──
    brief_text = brief_to_text(brief)
    cross_pillar = build_cross_pillar_context(analysis_id, pillar_key, all_diagnostics)
    exec_history = build_execution_context(analysis_id, pillar_key)

    # ── Diagnostic summary ──
    estado = diagnostic.get("estado_atual", {})
    gaps = diagnostic.get("gaps", [])
    opps = diagnostic.get("oportunidades", [])
    score = diagnostic.get("score", 50)

    diag_text = f"DIAGNÓSTICO ATUAL ({score}/100):\n"
    if isinstance(estado, dict):
        for k, v in estado.items():
            diag_text += f"  {k}: {v}\n"
    elif isinstance(estado, str):
        diag_text += f"  {estado}\n"
    if gaps:
        diag_text += "GAPS:\n" + "\n".join(f"  ⚠️ {g}" for g in (gaps[:5] if isinstance(gaps, list) else [gaps]))
    if opps:
        diag_text += "\nOPORTUNIDADES:\n" + "\n".join(f"  💡 {o}" for o in (opps[:5] if isinstance(opps, list) else [opps]))

    # ── RAG: search for specialist content ──
    dna = brief.get("dna", {})
    segmento = dna.get("segmento", "")
    nome = dna.get("nome", "")
    search_query = f"{dim_cfg.get('label', pillar_key)} {segmento} como implementar passo a passo 2025"

    print(f"  🔍 Specialist plan search: {search_query[:80]}...", file=sys.stderr)
    search_results = search_duckduckgo(search_query, max_results=3, region='br-pt')

    specialist_research = ""
    sources = []
    for i, r in enumerate(search_results or []):
        url = r.get("href", "")
        sources.append(url)
        specialist_research += f"Fonte {i+1}: {r.get('body', '')}\n"
        if i < 1:
            content = scrape_page(url, timeout=4)
            if content:
                specialist_research += f"Detalhes: {content[:2500]}\n"

    # ── Restriction flags ──
    restr = brief.get("restricoes", [])
    restr_text = ""
    if "capital_zero" in restr:
        restr_text += "\n⚠️ Capital ZERO: APENAS ferramentas gratuitas."
    if "equipe_solo" in restr:
        restr_text += "\n⚠️ Equipe de 1 pessoa: tudo deve ser executável sozinho."

    kpis_list = spec["kpis"]
    entregaveis_list = spec["entregaveis"]

    prompt = f"""{spec['persona']}

Seu cargo: {spec['cargo']}
Pilar: {dim_cfg.get('label', pillar_key)}

{brief_text}

{diag_text}

{cross_pillar}

{exec_history}
{restr_text}

PESQUISA ESPECIALIZADA:
{specialist_research[:4000] if specialist_research else "Use seu conhecimento profissional."}

COMO {spec['cargo'].upper()}, crie um PLANO DE AÇÃO PROFISSIONAL para este pilar.

REGRAS:
1. O plano deve ter 3-6 ações CONCRETAS e SEQUENCIAIS
2. Cada ação deve ter: o que fazer, como fazer, ferramenta específica, tempo, resultado esperado
3. Inclua KPIs mensuráveis para cada ação
4. Considere o que JÁ FOI FEITO (não repita ações concluídas)
5. Conecte com insights dos outros especialistas
6. Se capital zero: apenas ferramentas gratuitas
7. Responda em português

JSON OBRIGATÓRIO:
{{
    "titulo_plano": "Nome profissional do plano",
    "objetivo": "O que este plano vai alcançar em 1 frase",
    "prazo_total": "X semanas",
    "acoes": [
        {{
            "id": "a1",
            "titulo": "Ação concreta e específica",
            "descricao": "Explicação detalhada de COMO fazer",
            "ferramenta": "Nome da ferramenta (grátis/pago)",
            "ferramenta_url": "URL da ferramenta",
            "tempo_estimado": "2-4h",
            "resultado_esperado": "O que muda ao completar",
            "kpi": "Métrica mensurável (ex: +30% engajamento)",
            "prioridade": "critica/alta/media",
            "depende_de": null
        }}
    ],
    "kpis_pilar": [
        {{
            "nome": "Nome do KPI",
            "valor_atual": "Estimativa baseada no diagnóstico",
            "meta": "Meta realista para 30 dias",
            "como_medir": "Como o usuário mede isso"
        }}
    ],
    "resultado_final": "O que o negócio terá de NOVO ao completar este plano",
    "conexao_proximos_pilares": "Como este plano alimenta os próximos pilares"
}}

Retorne APENAS o JSON."""

    try:
        result = call_groq(
            api_key, prompt,
            temperature=0.3,
            model="llama-3.3-70b-versatile",
            force_json=True
        )
        result["sources"] = sources
        result["pillar_key"] = pillar_key

        # Save to DB
        db.save_pillar_plan(analysis_id, pillar_key, result, status="pending")

        return {"success": True, "plan": result}

    except Exception as e:
        print(f"  ❌ Specialist plan error for {pillar_key}: {e}", file=sys.stderr)
        # Fallback to smaller model
        try:
            result = call_groq(
                api_key, prompt,
                temperature=0.3,
                model="llama-3.1-8b-instant",
                force_json=True
            )
            result["sources"] = sources
            result["pillar_key"] = pillar_key
            db.save_pillar_plan(analysis_id, pillar_key, result, status="pending")
            return {"success": True, "plan": result}
        except Exception as e2:
            return {"success": False, "error": f"Erro ao gerar plano: {str(e2)[:200]}"}


# ═══════════════════════════════════════════════════════════════════
# RESULTS TRACKING — Resultado = Novo Dado
# ═══════════════════════════════════════════════════════════════════

def record_action_result(
    analysis_id: str,
    pillar_key: str,
    task_id: str,
    action_title: str,
    outcome: str,
    business_impact: str = "",
) -> dict:
    """
    Record the result of a completed action.
    This creates NEW business data that feeds back into future specialist analysis.
    """
    # Save the result
    result = db.save_execution_result(
        analysis_id, pillar_key, task_id, action_title,
        status="completed", outcome=outcome, business_impact=business_impact
    )

    # Auto-generate KPI if impact is quantifiable
    if business_impact:
        db.save_pillar_kpi(
            analysis_id, pillar_key,
            kpi_name=f"resultado_{task_id}",
            kpi_value=business_impact,
            kpi_target=""
        )

    return {"success": True, "result": result}


def get_pillar_full_state(analysis_id: str, pillar_key: str) -> dict:
    """
    Get the complete current state of a pillar:
    diagnostic + plan + execution results + KPIs + dependencies.
    This is the full picture of WHERE the business IS for this pillar.
    """
    diagnostic = db.get_pillar_diagnostic(analysis_id, pillar_key)
    plan = db.get_pillar_plan(analysis_id, pillar_key)
    results = db.get_pillar_results(analysis_id, pillar_key)
    kpis = db.get_pillar_kpis(analysis_id, pillar_key)

    # Calculate execution progress
    total_actions = 0
    completed_actions = 0
    if plan and plan.get("plan_data"):
        acoes = plan["plan_data"].get("acoes", [])
        total_actions = len(acoes)
    if results:
        completed_actions = len([r for r in results if r["status"] == "completed"])

    # Check dependencies
    deps = check_pillar_dependencies(analysis_id, pillar_key)

    return {
        "pillar_key": pillar_key,
        "diagnostic": diagnostic,
        "plan": plan,
        "results": results,
        "kpis": kpis,
        "progress": {
            "total": total_actions,
            "completed": completed_actions,
            "pct": round((completed_actions / total_actions * 100) if total_actions > 0 else 0),
        },
        "dependencies": deps,
    }


# ═══════════════════════════════════════════════════════════════════
# CROSS-PILLAR DEPENDENCY SYSTEM
# ═══════════════════════════════════════════════════════════════════

DEPENDENCY_THRESHOLDS = {
    "critical": 25,   # Below this = pillar is critically weak, blocks downstream
    "warning": 45,    # Below this = pillar needs attention, warns downstream
}

def check_pillar_dependencies(analysis_id: str, pillar_key: str) -> dict:
    """
    Check if prerequisite pillars are ready for this specialist to work.
    Returns dependency status with actionable messages.
    """
    from business_scorer import DIMENSIONS

    dim_cfg = DIMENSIONS.get(pillar_key, {})
    upstream = dim_cfg.get("upstream", [])

    if not upstream:
        return {"ready": True, "blockers": [], "warnings": [], "upstream_states": {}}

    blockers = []
    warnings = []
    upstream_states = {}

    for up_key in upstream:
        up_label = DIMENSIONS.get(up_key, {}).get("label", up_key)
        diag = db.get_pillar_diagnostic(analysis_id, up_key)

        if not diag:
            # No diagnostic means analysis hasn't scored this pillar yet
            upstream_states[up_key] = {"score": 0, "status": "sem_dados", "label": up_label}
            continue

        up_score = diag.get("score", 50)
        up_status = diag.get("status", "atencao")
        upstream_states[up_key] = {"score": up_score, "status": up_status, "label": up_label}

        if up_score < DEPENDENCY_THRESHOLDS["critical"]:
            blockers.append({
                "pillar": up_key,
                "label": up_label,
                "score": up_score,
                "message": f"{up_label} está em estado crítico ({up_score}/100). Recomendo trabalhar nele antes."
            })
        elif up_score < DEPENDENCY_THRESHOLDS["warning"]:
            warnings.append({
                "pillar": up_key,
                "label": up_label,
                "score": up_score,
                "message": f"{up_label} precisa de atenção ({up_score}/100). Este pilar pode ser afetado."
            })

    return {
        "ready": len(blockers) == 0,
        "blockers": blockers,
        "warnings": warnings,
        "upstream_states": upstream_states,
    }


# ═══════════════════════════════════════════════════════════════════
# AI AGENT TASK GENERATION — Classify tasks as AI or USER
# ═══════════════════════════════════════════════════════════════════

AI_CAPABILITIES = [
    "escrever", "criar texto", "redigir", "elaborar", "gerar", "copy",
    "estratégia", "plano", "análise", "diagnóstico", "planejamento",
    "pesquisar", "analisar", "benchmarking", "comparar",
    "calendário", "cronograma", "agenda",
    "persona", "perfil de cliente", "público",
    "precificação", "preço", "margem", "ticket",
    "funil", "jornada", "pipeline", "script",
    "template", "modelo", "roteiro", "proposta",
    "otimizar texto", "seo", "palavras-chave", "hashtag",
    "email", "mensagem", "abordagem", "pitch",
]

REQUIRES_USER_ACTION = [
    "cadastrar", "configurar conta", "criar perfil em", "abrir conta",
    "criar logo", "design gráfico", "gravar vídeo", "fotografar",
    "imprimir", "fabricar", "instalar",
    "pagamento", "cartão", "gateway", "banco",
    "acessar painel", "login em", "conectar com",
    "publicar em", "postar em", "subir para",
    "comprar domínio", "hospedar", "contratar",
    "reunião", "visitar", "telefonar", "ligar para",
]


def _extract_market_for_pillar(pillar_key: str, market_data: dict) -> str:
    """Extract relevant market research data for a specific pillar.
    Reuses the same relevance scoring as the scorer to ensure consistency."""
    if not market_data:
        return ""
    categories = market_data.get("categories", [])
    if not categories:
        return ""

    from business_scorer import _score_category_relevance

    scored = []
    for cat in categories:
        rel_score = _score_category_relevance(pillar_key, cat)
        if rel_score >= 10:  # Lower threshold than scorer — we want more context
            scored.append((rel_score, cat))

    scored.sort(key=lambda x: x[0], reverse=True)
    relevant = [cat for _, cat in scored[:3]]

    if not relevant:
        return ""

    text = ""
    for cat in relevant:
        resumo = cat.get("resumo", {})
        fontes = cat.get("fontes", [])
        text += f"\n── {cat.get('nome', '')} ──\n"
        if isinstance(resumo, dict):
            if resumo.get("visao_geral"):
                text += f"{resumo['visao_geral']}\n"
            for p in (resumo.get("pontos_chave") or [])[:5]:
                pt = p if isinstance(p, str) else str(p)
                text += f"• {pt}\n"
            for r in (resumo.get("recomendacoes") or [])[:4]:
                rt = r if isinstance(r, str) else str(r)
                text += f"→ {rt}\n"
            dados = resumo.get("dados_relevantes", {})
            if isinstance(dados, dict):
                for k, v in list(dados.items())[:5]:
                    text += f"  {k}: {v}\n"
        if fontes:
            text += f"Fontes: {', '.join(str(f) for f in fontes[:3])}\n"

    return text[:4000]


def generate_specialist_tasks(
    analysis_id: str,
    pillar_key: str,
    brief: dict,
    diagnostic: dict = None,
    all_diagnostics: dict = None,
    market_data: dict = None,
) -> dict:
    """
    The specialist creates TASKS for their pillar, classifying each as:
    - executavel_por_ia: True → AI can generate the deliverable
    - executavel_por_ia: False → User must do it (instructions provided)

    Uses saved market research data from Phase 1 as primary context.
    RAG search is supplemental — only runs if market data is thin.
    """
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return {"success": False, "error": "GROQ_API_KEY not configured"}

    spec = SPECIALISTS.get(pillar_key)
    if not spec:
        return {"success": False, "error": f"Unknown pillar: {pillar_key}"}

    from business_scorer import DIMENSIONS
    dim_cfg = DIMENSIONS.get(pillar_key, {})

    if not diagnostic:
        diagnostic = db.get_pillar_diagnostic(analysis_id, pillar_key)
    if not diagnostic:
        return {"success": False, "error": f"Diagnóstico não encontrado para {pillar_key}. Execute a análise primeiro."}

    # Load market data from DB if not passed
    if not market_data:
        market_data = db.get_analysis_market_data(analysis_id)

    # Check dependencies first
    deps = check_pillar_dependencies(analysis_id, pillar_key)

    # Build context layers
    brief_text = brief_to_text(brief)
    cross_pillar = build_cross_pillar_context(analysis_id, pillar_key, all_diagnostics)
    exec_history = build_execution_context(analysis_id, pillar_key)

    # Diagnostic summary
    estado = diagnostic.get("estado_atual", {})
    gaps = diagnostic.get("gaps", [])
    score = diagnostic.get("score", 50)
    diag_text = f"DIAGNÓSTICO ATUAL ({score}/100):\n"
    if isinstance(estado, dict):
        for k, v in estado.items():
            diag_text += f"  {k}: {v}\n"
    if gaps:
        diag_text += "GAPS:\n" + "\n".join(f"  ⚠️ {g}" for g in (gaps[:5] if isinstance(gaps, list) else [gaps]))

    # Dependency context
    dep_text = ""
    if deps["blockers"]:
        dep_text = "⚠️ DEPENDÊNCIAS BLOQUEANTES:\n"
        for b in deps["blockers"]:
            dep_text += f"  - {b['label']} ({b['score']}/100): {b['message']}\n"
        dep_text += "Inclua tarefas preparatórias ou adapte o plano considerando estas limitações.\n"
    if deps["warnings"]:
        dep_text += "AVISOS DE DEPENDÊNCIA:\n"
        for w in deps["warnings"]:
            dep_text += f"  - {w['label']} ({w['score']}/100): {w['message']}\n"

    # ── Primary: Market research from Phase 1 (already collected) ──
    market_context = _extract_market_for_pillar(pillar_key, market_data)
    sources = []
    if market_data:
        for cat in market_data.get("categories", []):
            sources.extend(cat.get("fontes", [])[:2])
        sources = list(dict.fromkeys(sources))  # dedup

    # ── Supplemental RAG: Only search web if market + upstream data is thin ──
    # Assembly line logic: upstream reports + market data = primary source
    total_context_len = len(market_context) + len(cross_pillar)
    research = ""
    dna = brief.get("dna", {})
    segmento = dna.get("segmento", "")

    if total_context_len < 500:
        search_query = f"{dim_cfg.get('label', pillar_key)} {segmento} como implementar passo a passo 2025"
        print(f"  🔍 Supplemental search (thin context: {total_context_len} chars): {search_query[:80]}...", file=sys.stderr)
        search_results = search_duckduckgo(search_query, max_results=3, region='br-pt')
        for i, r in enumerate(search_results or []):
            url = r.get("href", "")
            sources.append(url)
            research += f"Fonte {i+1}: {r.get('body', '')}\n"
            if i < 1:
                content = scrape_page(url, timeout=4)
                if content:
                    research += f"Detalhes: {content[:2000]}\n"
    else:
        print(f"  ✅ Cascade context rico ({total_context_len} chars: market={len(market_context)}, upstream={len(cross_pillar)}) — sem busca web", file=sys.stderr)

    # Combine research context
    all_research = ""
    if market_context:
        all_research += f"DADOS DE MERCADO (coletados na análise):\n{market_context}\n\n"
    if research:
        all_research += f"PESQUISA COMPLEMENTAR:\n{research[:2000]}\n"
    if not all_research:
        all_research = "Use seu conhecimento profissional.\n"

    # Restriction flags
    restr = brief.get("restricoes", [])
    restr_text = ""
    if "capital_zero" in restr:
        restr_text += "\n⚠️ Capital ZERO: APENAS ferramentas gratuitas."
    if "equipe_solo" in restr:
        restr_text += "\n⚠️ Equipe de 1 pessoa: tudo deve ser executável sozinho."

    # Build scope section from SPECIALISTS config
    escopo = spec.get("escopo", "")
    entregaveis_obrig = spec.get("entregaveis_obrigatorios", [])
    nao_fazer = spec.get("nao_fazer", "")
    entregaveis_text = "\n".join(f"  {i+1}. {e}" for i, e in enumerate(entregaveis_obrig))

    prompt = f"""{spec['persona']}

Cargo: {spec['cargo']}
Pilar: {dim_cfg.get('label', pillar_key)}

═══ SEU ESCOPO (ESTRITAMENTE LIMITADO) ═══
{escopo}

ENTREGÁVEIS OBRIGATÓRIOS deste pilar (suas tarefas DEVEM produzir estes):
{entregaveis_text}

🚫 PROIBIDO — NÃO FAÇA NADA DISTO:
{nao_fazer}

═══ CONTEXTO DO NEGÓCIO ═══
{brief_text}

{diag_text}

{cross_pillar}

{exec_history}

{dep_text}
{restr_text}

{all_research}

COMO {spec['cargo'].upper()}, crie TAREFAS que produzam os ENTREGÁVEIS OBRIGATÓRIOS acima.

REGRA DE CASCATA: Use os dados dos especialistas anteriores (se houver). NÃO reinvente o que já foi definido upstream.

CLASSIFICAÇÃO OBRIGATÓRIA para cada tarefa:
- "executavel_por_ia": true → IA pode GERAR (textos, estratégias, planos, análises, scripts, calendários, templates)
- "executavel_por_ia": false → EXIGE ação humana (criar contas, publicar, fotografar, configurar ferramentas)

REGRAS:
1. 4-8 tarefas CONCRETAS e SEQUENCIAIS — TODAS dentro do escopo deste pilar
2. Cada tarefa deve contribuir para pelo menos 1 entregável obrigatório
3. Para tarefas IA: descreva exatamente o entregável (ex: "documento de persona completo com dados demográficos")
4. Para tarefas usuário: dê instruções passo-a-passo claras
5. NÃO repita ações já concluídas
6. Se capital zero: apenas ferramentas gratuitas
7. Responda em português

JSON OBRIGATÓRIO:
{{
    "titulo_plano": "Nome profissional do plano",
    "objetivo": "Objetivo em 1 frase",
    "prazo_total": "X semanas",
    "entregaveis": [
        {{
            "id": "e1",
            "titulo": "Nome do entregável específico para este negócio",
            "descricao": "O que este entregável contém e para que serve",
            "tarefa_origem": "t1",
            "status": "pendente"
        }}
    ],
    "tarefas": [
        {{
            "id": "t1",
            "titulo": "Ação concreta",
            "descricao": "O que fazer e como",
            "executavel_por_ia": true,
            "entregavel_ia": "Descreva o que a IA vai gerar (ex: documento de persona completo)",
            "instrucoes_usuario": null,
            "ferramenta": "Nome da ferramenta",
            "ferramenta_url": "URL",
            "tempo_estimado": "2-4h",
            "resultado_esperado": "O que muda ao completar",
            "kpi": "Métrica mensurável",
            "prioridade": "critica/alta/media",
            "depende_de": null,
            "depende_pilar": null
        }}
    ],
    "kpis_pilar": [
        {{
            "nome": "Nome do KPI",
            "valor_atual": "Estimativa",
            "meta": "Meta 30 dias",
            "como_medir": "Como medir"
        }}
    ],
    "resultado_final": "O que o negócio terá ao completar",
    "conexao_pilares": "Como alimenta outros pilares"
}}

Retorne APENAS o JSON."""

    try:
        result = call_groq(
            api_key, prompt,
            temperature=0.3,
            model="llama-3.3-70b-versatile",
            force_json=True
        )
        result["sources"] = sources
        result["pillar_key"] = pillar_key
        result["dependencies"] = deps

        # Ensure each task has the classification
        for t in result.get("tarefas", []):
            if "executavel_por_ia" not in t:
                # Auto-classify based on keywords
                t["executavel_por_ia"] = _classify_task_executability(t.get("titulo", "") + " " + t.get("descricao", ""))

        # Save as plan
        db.save_pillar_plan(analysis_id, pillar_key, result, status="generated")

        return {"success": True, "plan": result}

    except Exception as e:
        print(f"  ❌ Task generation error for {pillar_key}: {e}", file=sys.stderr)
        try:
            result = call_groq(
                api_key, prompt,
                temperature=0.3,
                model="llama-3.1-8b-instant",
                force_json=True
            )
            result["sources"] = sources
            result["pillar_key"] = pillar_key
            result["dependencies"] = deps
            for t in result.get("tarefas", []):
                if "executavel_por_ia" not in t:
                    t["executavel_por_ia"] = _classify_task_executability(t.get("titulo", "") + " " + t.get("descricao", ""))
            db.save_pillar_plan(analysis_id, pillar_key, result, status="generated")
            return {"success": True, "plan": result}
        except Exception as e2:
            return {"success": False, "error": f"Erro ao gerar tarefas: {str(e2)[:200]}"}


def _classify_task_executability(text: str) -> bool:
    """Fallback: classify a task as AI-executable or user-required based on keywords."""
    text_lower = text.lower()
    user_score = sum(1 for kw in REQUIRES_USER_ACTION if kw in text_lower)
    ai_score = sum(1 for kw in AI_CAPABILITIES if kw in text_lower)
    return ai_score > user_score


# ═══════════════════════════════════════════════════════════════════
# AI AGENT EXECUTION — The specialist generates deliverables
# ═══════════════════════════════════════════════════════════════════

def _format_previous_results(previous_results: list = None) -> str:
    """Format previous subtask results into context for the next subtask."""
    if not previous_results:
        return ""
    
    text = "═══ RESULTADOS DAS SUBTAREFAS ANTERIORES ═══\n"
    text += "Use estas informações como base. NÃO repita o que já foi produzido.\n\n"
    
    for i, pr in enumerate(previous_results):
        titulo = pr.get("titulo", pr.get("entregavel_titulo", f"Subtarefa {i+1}"))
        conteudo = pr.get("conteudo", "")
        # Truncate long content to avoid token overflow
        if isinstance(conteudo, dict):
            import json
            conteudo = json.dumps(conteudo, ensure_ascii=False)
        if isinstance(conteudo, str) and len(conteudo) > 1000:
            conteudo = conteudo[:1000] + "..."
        text += f"── Subtarefa {i+1}: {titulo} ──\n{conteudo}\n\n"
    
    return text

def agent_execute_task(
    analysis_id: str,
    pillar_key: str,
    task_id: str,
    task_data: dict,
    brief: dict,
    all_diagnostics: dict = None,
    market_data: dict = None,
    previous_results: list = None,
) -> dict:
    """
    The AI specialist EXECUTES a task — generates the actual deliverable.
    
    This is called when the user approves an AI-executable task.
    The specialist generates the full deliverable (text, strategy, plan, etc.)
    and returns it for user review before marking as complete.
    
    Uses saved market research + targeted RAG search for task-specific details.
    """
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return {"success": False, "error": "GROQ_API_KEY not configured"}

    spec = SPECIALISTS.get(pillar_key)
    if not spec:
        return {"success": False, "error": f"Unknown pillar: {pillar_key}"}

    from business_scorer import DIMENSIONS
    dim_cfg = DIMENSIONS.get(pillar_key, {})

    # Load market data from DB if not passed
    if not market_data:
        market_data = db.get_analysis_market_data(analysis_id)

    # Build context
    brief_text = brief_to_text(brief)
    cross_pillar = build_cross_pillar_context(analysis_id, pillar_key, all_diagnostics)
    exec_history = build_execution_context(analysis_id, pillar_key)

    # ── Primary: Market research from Phase 1 ──
    market_context = _extract_market_for_pillar(pillar_key, market_data)
    sources = []
    if market_data:
        for cat in market_data.get("categories", []):
            sources.extend(cat.get("fontes", [])[:2])
        sources = list(dict.fromkeys(sources))

    # ── Task-specific RAG search (always run for execution — need specific examples) ──
    dna = brief.get("dna", {})
    task_title = task_data.get("titulo", "")
    segmento = dna.get("segmento", "")
    search_query = f"{task_title} {segmento} como fazer exemplo prático 2025"

    print(f"  🤖 Agent executing: {task_title[:60]}...", file=sys.stderr)
    print(f"  🔍 Task-specific search: {search_query[:80]}...", file=sys.stderr)
    search_results = search_duckduckgo(search_query, max_results=3, region='br-pt')

    research = ""
    for i, r in enumerate(search_results or []):
        url = r.get("href", "")
        sources.append(url)
        research += f"Fonte {i+1}: {r.get('body', '')}\n"
        if i < 1:
            content = scrape_page(url, timeout=5)
            if content:
                research += f"Detalhes: {content[:3000]}\n"

    # Combine all research
    all_research = ""
    if market_context:
        all_research += f"DADOS DE MERCADO (da análise):\n{market_context}\n\n"
    if research:
        all_research += f"PESQUISA ESPECÍFICA DA TAREFA:\n{research[:4000]}\n"
    if not all_research:
        all_research = "Use seu conhecimento profissional.\n"

    entregavel = task_data.get("entregavel_ia", task_data.get("descricao", ""))
    restr = brief.get("restricoes", [])
    restr_text = ""
    if "capital_zero" in restr:
        restr_text += "\n⚠️ Capital ZERO: apenas ferramentas gratuitas."
    if "equipe_solo" in restr:
        restr_text += "\n⚠️ Equipe de 1 pessoa."

    # Scope boundaries for execution
    escopo = spec.get("escopo", "")
    nao_fazer = spec.get("nao_fazer", "")

    prompt = f"""{spec['persona']}

Cargo: {spec['cargo']}
Pilar: {dim_cfg.get('label', pillar_key)}

═══ SEU ESCOPO ═══
{escopo}
🚫 PROIBIDO: {nao_fazer}

═══ CONTEXTO ═══
{brief_text}

{cross_pillar}

{exec_history}
{restr_text}

TAREFA A EXECUTAR: {task_title}
DESCRIÇÃO: {task_data.get('descricao', '')}
ENTREGÁVEL ESPERADO: {entregavel}

{_format_previous_results(previous_results)}

{all_research}

REGRA DE CASCATA: Use os dados dos especialistas anteriores. Aplique variáveis já definidas (personas, tom de voz, paleta, canais) — NÃO reinvente.

COMO {spec['cargo'].upper()}, EXECUTE esta tarefa AGORA.
Gere o ENTREGÁVEL COMPLETO, pronto para uso imediato pelo negócio.
Mantenha-se ESTRITAMENTE dentro do escopo do seu pilar.

- Se é um texto/copy: escreva o texto final USANDO dados upstream
- Se é uma estratégia: detalhe cada ponto com ações concretas
- Se é uma análise: apresente dados, insights e recomendações
- Se é um calendário: crie o calendário completo com datas e temas
- Se é um script: escreva o script palavra por palavra
- Se é um template: crie o template preenchido

O resultado deve ser PROFISSIONAL, ESPECÍFICO para este negócio, e PRONTO PARA USO.

JSON:
{{
    "entregavel_titulo": "Título do entregável",
    "entregavel_tipo": "texto|estrategia|analise|calendario|script|template|plano",
    "conteudo": "O ENTREGÁVEL COMPLETO aqui — texto formatado, detalhado e pronto para uso",
    "como_aplicar": "Instruções de como o usuário deve aplicar este entregável",
    "proximos_passos": "O que fazer depois que aplicar",
    "fontes_consultadas": ["urls"],
    "impacto_estimado": "Impacto esperado no negócio"
}}

Retorne APENAS o JSON."""

    try:
        result = call_groq(
            api_key, prompt,
            temperature=0.4,
            model="llama-3.3-70b-versatile",
            force_json=True
        )
        result["task_id"] = task_id
        result["sources"] = sources

        # Auto-record as executed (pending user confirmation)
        db.save_execution_result(
            analysis_id, pillar_key, task_id, task_title,
            status="ai_executed", outcome=result.get("entregavel_titulo", "Entregável gerado"),
            business_impact=result.get("impacto_estimado", "")
        )

        print(f"  ✅ Agent delivered: {result.get('entregavel_titulo', 'OK')}", file=sys.stderr)
        return {"success": True, "execution": result}

    except Exception as e:
        print(f"  ❌ Agent execution error: {e}", file=sys.stderr)
        try:
            result = call_groq(
                api_key, prompt,
                temperature=0.4,
                model="llama-3.1-8b-instant",
                force_json=True
            )
            result["task_id"] = task_id
            result["sources"] = sources
            db.save_execution_result(
                analysis_id, pillar_key, task_id, task_title,
                status="ai_executed", outcome=result.get("entregavel_titulo", "Entregável gerado"),
                business_impact=result.get("impacto_estimado", "")
            )
            return {"success": True, "execution": result}
        except Exception as e2:
            return {"success": False, "error": f"Erro na execução: {str(e2)[:200]}"}


def get_all_pillars_state(analysis_id: str) -> dict:
    """Get the state of ALL 7 pillars at once — for the unified dashboard."""
    from business_scorer import DIMENSIONS, DIMENSION_ORDER

    pillars = {}
    for pk in DIMENSION_ORDER:
        dim_cfg = DIMENSIONS[pk]
        spec = SPECIALISTS.get(pk, {})
        diag = db.get_pillar_diagnostic(analysis_id, pk)
        plan = db.get_pillar_plan(analysis_id, pk)
        results = db.get_pillar_results(analysis_id, pk)

        total = 0
        completed = 0
        ai_tasks = 0
        user_tasks = 0
        if plan and plan.get("plan_data"):
            tarefas = plan["plan_data"].get("tarefas", plan["plan_data"].get("acoes", []))
            total = len(tarefas)
            for t in tarefas:
                if t.get("executavel_por_ia"):
                    ai_tasks += 1
                else:
                    user_tasks += 1
        if results:
            completed = len([r for r in results if r["status"] in ("completed", "ai_executed")])

        deps = check_pillar_dependencies(analysis_id, pk)

        pillars[pk] = {
            "key": pk,
            "label": dim_cfg["label"],
            "ordem": dim_cfg["ordem"],
            "cargo": spec.get("cargo", ""),
            "score": diag.get("score", 0) if diag else 0,
            "status": diag.get("status", "sem_dados") if diag else "sem_dados",
            "has_plan": plan is not None,
            "plan_status": plan.get("status", None) if plan else None,
            "progress": {"total": total, "completed": completed, "ai_tasks": ai_tasks, "user_tasks": user_tasks},
            "dependencies": deps,
            "meta_pilar": diag.get("estado_atual", {}).get("meta_pilar", "") if diag and isinstance(diag.get("estado_atual"), dict) else "",
        }

    return pillars


# ═══════════════════════════════════════════════════════════════════
# SUBTASK EXPANSION — Break a task into micro-steps the AI works through
# ═══════════════════════════════════════════════════════════════════

def expand_task_subtasks(
    analysis_id: str,
    pillar_key: str,
    task_data: dict,
    brief: dict,
    market_data: dict = None,
) -> dict:
    """
    Break a single task into 3-6 concrete subtasks.
    Each subtask is small enough for the AI to execute in one shot.
    This is the 'macro plan' concept applied at task level.
    """
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return {"success": False, "error": "GROQ_API_KEY not configured"}

    spec = SPECIALISTS.get(pillar_key)
    if not spec:
        return {"success": False, "error": f"Unknown pillar: {pillar_key}"}

    from business_scorer import DIMENSIONS
    dim_cfg = DIMENSIONS.get(pillar_key, {})

    # Load market data from DB if not passed
    if not market_data:
        market_data = db.get_analysis_market_data(analysis_id)

    brief_text = brief_to_text(brief)
    exec_history = build_execution_context(analysis_id, pillar_key)

    task_title = task_data.get("titulo", "")
    task_desc = task_data.get("descricao", "")
    is_ai = task_data.get("executavel_por_ia", True)

    # Primary: saved market research
    market_context = _extract_market_for_pillar(pillar_key, market_data)
    sources = []

    # Supplemental: only search if market data is thin
    research = ""
    dna = brief.get("dna", {})
    segmento = dna.get("segmento", "")
    if len(market_context) < 500:
        search_query = f"{task_title} {segmento} passo a passo detalhado 2025"
        print(f"  🔍 Subtask expansion search: {search_query[:80]}...", file=sys.stderr)
        search_results = search_duckduckgo(search_query, max_results=3, region='br-pt')
        for i, r in enumerate(search_results or []):
            url = r.get("href", "")
            sources.append(url)
            research += f"Fonte {i+1}: {r.get('body', '')}\n"
            if i < 1:
                content = scrape_page(url, timeout=4)
                if content:
                    research += f"Detalhes: {content[:2000]}\n"

    all_research = ""
    if market_context:
        all_research += f"DADOS DE MERCADO:\n{market_context}\n\n"
    if research:
        all_research += f"PESQUISA COMPLEMENTAR:\n{research[:2000]}\n"
    if not all_research:
        all_research = "Use seu conhecimento.\n"

    # Scope boundaries from specialist config
    escopo = spec.get("escopo", "")
    nao_fazer = spec.get("nao_fazer", "")

    prompt = f"""{spec['persona']}

{brief_text}

{exec_history}

═══ SEU ESCOPO (ESTRITAMENTE LIMITADO) ═══
{escopo}

🚫 PROIBIDO — NÃO FAÇA NADA DISTO:
{nao_fazer}

TAREFA PRINCIPAL: {task_title}
DESCRIÇÃO: {task_desc}
TIPO: {"Executável por IA" if is_ai else "Requer ação do usuário"}

{all_research}

Quebre esta tarefa em 3-6 SUBTAREFAS concretas e sequenciais.
Cada subtarefa deve ser pequena o suficiente para ser completada em uma sessão.
Para cada subtarefa, classifique se a IA pode executar ou se o usuário precisa fazer.

REGRA IMPORTANTE: Todas as subtarefas devem estar DENTRO do escopo acima.
NÃO crie subtarefas que envolvam ações listadas em 🚫 PROIBIDO.

JSON OBRIGATÓRIO:
{{
    "task_id": "{task_data.get('id', '')}",
    "titulo_tarefa": "{task_title}",
    "subtarefas": [
        {{
            "id": "st1",
            "titulo": "Ação concreta e específica",
            "descricao": "Detalhes do que fazer",
            "executavel_por_ia": true,
            "entregavel": "O que será produzido",
            "tempo_estimado": "30min-1h"
        }}
    ],
    "ordem_execucao": "Descrição da sequência lógica",
    "resultado_combinado": "O que teremos ao completar todas as subtarefas"
}}

Retorne APENAS o JSON."""

    try:
        result = call_groq(
            api_key, prompt,
            temperature=0.3,
            model="llama-3.3-70b-versatile",
            force_json=True
        )
        result["sources"] = sources
        return {"success": True, "subtasks": result}
    except Exception as e:
        print(f"  ❌ Subtask expansion error: {e}", file=sys.stderr)
        try:
            result = call_groq(api_key, prompt, temperature=0.3, model="llama-3.1-8b-instant", force_json=True)
            result["sources"] = sources
            return {"success": True, "subtasks": result}
        except Exception as e2:
            return {"success": False, "error": f"Erro ao expandir subtarefas: {str(e2)[:200]}"}


def ai_try_user_task(
    analysis_id: str,
    pillar_key: str,
    task_id: str,
    task_data: dict,
    brief: dict,
    all_diagnostics: dict = None,
    market_data: dict = None,
) -> dict:
    """
    AI attempts a task that was classified as user-required.
    It generates the best possible deliverable it CAN produce,
    clearly stating what the user still needs to do manually.
    """
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return {"success": False, "error": "GROQ_API_KEY not configured"}

    spec = SPECIALISTS.get(pillar_key)
    if not spec:
        return {"success": False, "error": f"Unknown pillar: {pillar_key}"}

    from business_scorer import DIMENSIONS
    dim_cfg = DIMENSIONS.get(pillar_key, {})

    # Load market data from DB if not passed
    if not market_data:
        market_data = db.get_analysis_market_data(analysis_id)

    brief_text = brief_to_text(brief)
    cross_pillar = build_cross_pillar_context(analysis_id, pillar_key, all_diagnostics)

    task_title = task_data.get("titulo", "")
    task_desc = task_data.get("descricao", "")
    instrucoes = task_data.get("instrucoes_usuario", "")

    # Primary: saved market research
    market_context = _extract_market_for_pillar(pillar_key, market_data)
    sources = []
    if market_data:
        for cat in market_data.get("categories", []):
            sources.extend(cat.get("fontes", [])[:2])
        sources = list(dict.fromkeys(sources))

    # Task-specific RAG search
    dna = brief.get("dna", {})
    segmento = dna.get("segmento", "")
    search_query = f"{task_title} {segmento} guia completo exemplo 2025"
    print(f"  🤖 AI trying user task: {task_title[:60]}...", file=sys.stderr)
    search_results = search_duckduckgo(search_query, max_results=3, region='br-pt')

    research = ""
    for i, r in enumerate(search_results or []):
        url = r.get("href", "")
        sources.append(url)
        research += f"Fonte {i+1}: {r.get('body', '')}\n"
        if i < 1:
            content = scrape_page(url, timeout=5)
            if content:
                research += f"Detalhes: {content[:3000]}\n"

    all_research = ""
    if market_context:
        all_research += f"DADOS DE MERCADO:\n{market_context}\n\n"
    if research:
        all_research += f"PESQUISA ESPECÍFICA:\n{research[:4000]}\n"
    if not all_research:
        all_research = "Use seu conhecimento.\n"

    prompt = f"""{spec['persona']}

{brief_text}
{cross_pillar}

TAREFA (originalmente marcada como ação do usuário): {task_title}
DESCRIÇÃO: {task_desc}
INSTRUÇÕES ORIGINAIS: {instrucoes}

{all_research}

O usuário pediu para a IA TENTAR realizar esta tarefa. Embora originalmente ela exija ação humana,
faça O MÁXIMO que puder:

1. Se a tarefa é "criar conteúdo para publicar" → crie o conteúdo completo, o usuário só publica
2. Se a tarefa é "configurar ferramenta" → gere um guia passo-a-passo com screenshots descritos
3. Se a tarefa é "pesquisar/analisar" → faça a pesquisa e apresente os resultados
4. Se a tarefa é "design" → descreva o briefing criativo completo e especificações técnicas

Seja claro sobre:
- O que a IA CONSEGUIU fazer (entregável)
- O que o usuário AINDA precisa fazer manualmente (passos restantes)

JSON:
{{
    "entregavel_titulo": "O que a IA produziu",
    "entregavel_tipo": "texto|guia|pesquisa|briefing|plano|template",
    "conteudo": "ENTREGÁVEL COMPLETO — o máximo que a IA consegue fazer",
    "passos_restantes_usuario": [
        "Passo 1 que o usuário precisa fazer manualmente",
        "Passo 2..."
    ],
    "como_aplicar": "Como usar o que a IA gerou + completar os passos restantes",
    "percentual_completado_ia": 70,
    "impacto_estimado": "Impacto no negócio"
}}

Retorne APENAS o JSON."""

    try:
        result = call_groq(
            api_key, prompt,
            temperature=0.4,
            model="llama-3.3-70b-versatile",
            force_json=True
        )
        result["task_id"] = task_id
        result["sources"] = sources
        result["was_user_task"] = True

        db.save_execution_result(
            analysis_id, pillar_key, task_id, task_title,
            status="ai_partial", outcome=result.get("entregavel_titulo", "IA tentou executar"),
            business_impact=result.get("impacto_estimado", "")
        )

        return {"success": True, "execution": result}

    except Exception as e:
        print(f"  ❌ AI try user task error: {e}", file=sys.stderr)
        try:
            result = call_groq(api_key, prompt, temperature=0.4, model="llama-3.1-8b-instant", force_json=True)
            result["task_id"] = task_id
            result["sources"] = sources
            result["was_user_task"] = True
            db.save_execution_result(
                analysis_id, pillar_key, task_id, task_title,
                status="ai_partial", outcome=result.get("entregavel_titulo", "IA tentou executar"),
                business_impact=result.get("impacto_estimado", "")
            )
            return {"success": True, "execution": result}
        except Exception as e2:
            return {"success": False, "error": f"Erro: {str(e2)[:200]}"}
