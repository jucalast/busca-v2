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

# ═══════════════════════════════════════════════════════════════════
# IMPORTS CENTRALIZADOS (ANTES: 5 imports duplicados)
# ═══════════════════════════════════════════════════════════════════

from app.services.common import (
    json, sys, os, time,  # Python basics
    call_llm,            # LLM
    db,                  # Database
    log_info, log_error, log_warning, log_success, log_debug,  # Logging
    safe_json_dumps, safe_json_loads,  # Serialization
    CommonConfig,    # Config
    get_timestamp, format_duration, safe_get, retry_with_delay  # Utils
)

# ═══════════════════════════════════════════════════════════════════
# SPECIALIST PERSONAS — imported from pillar_config.py
# ═══════════════════════════════════════════════════════════════════
from app.services.agents.pillar_config import (
    _SPECIALISTS_BY_MODEL,
    _detect_business_model,
    get_specialist,
    _get_specialist_from_brief,
    SPECIALISTS,
)


# ═══════════════════════════════════════════════════════════════════

from typing import Dict, List, Any, Optional
from app.core.prompt_loader import get_engine_prompt
import copy, concurrent.futures


_SUPPLY_CHAIN_CACHE: dict = {}


def get_dynamic_persona_context(profile: dict) -> str:
    """
    Gera contexto dinâmico baseado no modelo de negócio e ticket médio.
    Transforma a persona do agente para se adequar ao tipo de empresa.
    """
    
    # Extrair variáveis chave
    modelo = profile.get("modelo_negocio", profile.get("modelo", "")).lower()
    ticket_medio = profile.get("ticket_medio", profile.get("ticket_medio_estimado", ""))
    segmento = profile.get("segmento", "").lower()
    faturamento = profile.get("faturamento_mensal", profile.get("faturamento_faixa", ""))
    
    # Limpar e padronizar ticket médio
    ticket_valor = 0
    if ticket_medio:
        import re
        numeros = re.findall(r'\d+', ticket_medio.replace('.', '').replace(',', ''))
        if numeros:
            ticket_valor = int(numeros[0])
    
    # Determinar contexto baseado no modelo
    if "b2b" in modelo:
        if ticket_valor >= 1000:  # B2B High-ticket
            contexto = """
CONTEXTO B2B HIGH-TICKET (Acima de R$ 1.000):
• FOCO: Vendas consultivas, relacionamento longo prazo, contratos
• PÚBLICO: Decision makers, gestores, compradores corporativos
• CANAIS: LinkedIn, cold email, representantes, parcerias estratégicas
• CICLO: Longo (semanas/meses), múltiplos tomadores de decisão
• OBJEÇÕES: "Fornecedor homologado", "guerra de preços", "risco de mudança"
• ESTRATÉGIA: Amostra piloto, demonstração técnica, proposta personalizada
• PROIBIDO: Instagram, TikTok, Meta Ads, vendas impulsivas, conteúdo viral
"""
        else:  # B2B Low-ticket
            contexto = """
CONTEXTO B2B LOW-TICKET (Abaixo de R$ 1.000):
• FOCO: Vendas em volume, eficiência operacional, automação
• PÚBLICO: Compradores de pequeno/médio porte, decisões mais rápidas
• CANAIS: E-commerce B2B, WhatsApp Business, marketplace industrial
• CICLO: Médio (dias/semanas), menos aprovações
• OBJEÇÕES: Preço, prazo, conveniência vs fornecedor atual
• ESTRATÉGIA: Catálogo digital, preço competitivo, entrega rápida
• PROIBIDO: Vendas complexas, longos ciclos, reuniões desnecessárias
"""
    
    elif "b2c" in modelo or "varejo" in segmento or "loja" in segmento:
        if ticket_valor >= 500:  # B2C High-ticket
            contexto = """
CONTEXTO B2C HIGH-TICKET (Acima de R$ 500):
• FOCO: Conversão, confiança, prova social, experiência do cliente
• PÚBLICO: Consumidor final, decisão emocional + racional
• CANAIS: Instagram, Meta Ads, Google Shopping, influenciadores
• CICLO: Curto (horas/dias), decisão individual
• OBJEÇÕES: Preço, confiança, frete, "posso encontrar mais barato"
• ESTRATÉGIA: Tráfego pago, remarketing, reviews, atendimento rápido
• PROIBIDO: LinkedIn corporativo, ciclos longos, linguagem técnica
"""
        else:  # B2C Low-ticket
            contexto = """
CONTEXTO B2C LOW-TICKET (Abaixo de R$ 500):
• FOCO: Volume, escala, automação, conveniência
• PÚBLICO: Consumidor de massa, decisão rápida e impulsiva
• CANAIS: Instagram, TikTok, Meta Ads, pontos de venda físico
• CICLO: Imediato (minutos/horas), nenhuma barreira
• OBJEÇÕES: Preço, "não preciso agora", esquecimento
• ESTRATÉGIA: Impulsos, ofertas relâmpago, frete grátis, viralidade
• PROIBIDO: Processos complexos, reuniões, linguagem corporativa
"""
    
    elif "serviço" in segmento or "consultoria" in segmento:
        contexto = """
CONTEXTO SERVIÇOS/CONSULTORIA:
• FOCO: Autoridade, especialização, cases, relacionamento
• PÚBLICO: Clientes buscando solução específica, valorizar expertise
• CANAIS: LinkedIn, conteúdo técnico, webinars, indicações
• CICLO: Médio/Longo, baseado em confiança e credibilidade
• OBJEÇÕES: "Posso fazer eu mesmo", preço, "vale o investimento?"
• ESTRATÉGIA: Prova de autoridade, diagnóstico gratuito, cases de sucesso
• PROIBIDO: Abordagem de varejo, promoções agressivas, linguagem informal
"""
    
    elif "saas" in segmento.lower() or "software" in segmento.lower():
        contexto = """
CONTEXTO SAAS/TECH:
• FOCO: Trial, onboarding, retenção, escalabilidade
• PÚBLICO: Empresas, usuários técnicos, decisores de TI
• CANAIS: Content marketing, SEO técnico, integrações, marketplace
• CICLO: Longo, envolve teste técnico e aprovação múltipla
• OBJEÇÕES: "Não preciso disso", integração, segurança, preço recorrente
• ESTRATÉGIA: Freemium, demo personalizada, integrações fáceis, suporte
• PROIBIDO: Vendas one-time, promessas irreais, linguagem não técnica
"""
    
    else:  # Default/E-commerce
        contexto = """
CONTEXTO E-COMMERCE/DEFAULT:
• FOCO: Conversão, tráfego qualificado, otimização de taxa
• PÚBLICO: Consumidor online, comparação de preços, reviews
• CANAIS: Google Ads, Meta Ads, SEO, email marketing, redes sociais
• CICLO: Curto/médio, baseado em confiança e conveniência
• OBJEÇÕES: Preço, frete, confiança, "encontrei mais barato"
• ESTRATÉGIA: Tráfego pago, remarketing, otimização de checkout
• PROIBIDO: Abordagem corporativa excessiva, ciclos muito longos
"""
    
    # Adicionar informações específicas do negócio
    contexto_extra = f"""
INFORMAÇÕES ESPECÍFICAS:
• Nome: {profile.get('nome_negocio', profile.get('nome', 'Não informado'))}
• Segmento: {segmento}
• Modelo: {modelo}
• Ticket Médio: {ticket_medio}
• Faturamento: {faturamento}
• Localização: {profile.get('localizacao', 'Não informada')}
"""
    
    return contexto + contexto_extra


def get_adapted_specialist_persona(pillar_key: str, profile: dict) -> dict:
    """
    Adapta a persona do especialista baseada no contexto do negócio.
    Retorna a persona modificada com as instruções específicas.
    """
    
    base_persona = get_specialist(pillar_key, profile)
    contexto = get_dynamic_persona_context(profile)
    
    # Criar cópia da persona
    adapted_persona = base_persona.copy()
    
    # Adicionar contexto dinâmico à persona
    adapted_persona["contexto_dinamico"] = contexto
    adapted_persona["persona_adaptada"] = f"""
{base_persona.get('persona', '')}

{contexto}

IMPORTANTE: Adapte TODAS as suas sugestões e estratégias para este contexto específico.
Use as palavras-chave, canais e abordagens adequadas para este tipo de negócio.
"""
    
    return adapted_persona


def generate_business_brief(profile: dict, discovery_data: dict = None, market_data: dict = None) -> dict:
    """
    Generate a Compact Business Brief (~300 tokens) from all data sources.
    This is generated ONCE and shared by all 7 specialists.
    
    Data fusion: profile + discovery + market → compressed brief
    """
    # Unwrap nested profile_data structure: { "profile": { "perfil": {...} } } → { "perfil": {...} }
    # This happens when the frontend sends profile_data directly (which wraps the real profile)
    if isinstance(profile, dict) and "profile" in profile and "perfil" not in profile and "dna" not in profile:
        profile = profile["profile"]
    
    perfil = profile.get("perfil", profile)
    restricoes = profile.get("restricoes_criticas", {})

    # ── Business DNA (from user) ──
    dna = {
        "nome": perfil.get("nome", perfil.get("nome_negocio", "?")),
        "segmento": perfil.get("segmento", "?"),
        "modelo": perfil.get("modelo_negocio", perfil.get("modelo", "?")),
        "localizacao": perfil.get("localizacao", "?"),
        "equipe": perfil.get("num_funcionarios", perfil.get("equipe", "?")),
        "capital": restricoes.get("capital_disponivel", perfil.get("capital_disponivel", "?")),
        "faturamento": perfil.get("faturamento_mensal", perfil.get("faturamento_faixa", perfil.get("faturamento", "?"))),
        "ticket_medio": perfil.get("ticket_medio", perfil.get("ticket_medio_estimado", "?")),
        "diferencial": perfil.get("diferencial", "?"),
        "cliente_ideal": perfil.get("cliente_ideal", perfil.get("publico_alvo", perfil.get("clientes", "?"))),
        "dificuldade_principal": perfil.get("dificuldades", perfil.get("problemas", "?")),
        "canais_atuais": perfil.get("canais_venda", perfil.get("canais", "?")),
        "concorrentes": perfil.get("concorrentes", "?"),
        "fornecedores": perfil.get("fornecedores", "?"),
        "tipo_cliente": perfil.get("tipo_cliente", "?"),
        "capacidade_produtiva": perfil.get("capacidade_produtiva", "?"),
        "regiao_atendimento": perfil.get("regiao_atendimento", "?"),
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
                
                # ENRIQUECIMENTO AGRESSIVO: Se achamos algo no discovery, injetamos no DNA
                if canal == "site" and dna["site"] in ["?", "N/A", ""]:
                    dna["site"] = info.get("url")
                elif canal == "instagram" and dna["instagram"] in ["?", "N/A", ""]:
                    dna["instagram"] = info.get("handle") or info.get("url")
                elif canal == "whatsapp" and dna["whatsapp"] in ["?", "N/A", ""]:
                    dna["whatsapp"] = info.get("handle") or info.get("url")

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

    # ── Sales Brief (from scorer pipeline) ──
    sales_brief = profile.get("_sales_brief", "")

    # ── Supply Chain Context (cadeia produtiva) ──
    # Detect manufacturing/transformation businesses and clarify their position
    # in the supply chain so the LLM doesn't confuse suppliers with competitors
    cadeia_produtiva = _detect_supply_chain_context(dna)

    brief = {
        "dna": dna,
        "footprint": footprint,
        "market_digest": market_digest,
        "restricoes": restricao_flags,
        "sales_brief": sales_brief,
        "cadeia_produtiva": cadeia_produtiva,
    }

    return brief


def _detect_supply_chain_context(dna: dict) -> str:
    """
    Use the LLM to dynamically classify the business's position in its supply chain.
    Prevents LLM from confusing suppliers with competitors in downstream analysis.
    """
    segmento = str(dna.get("segmento", "")).strip()
    nome = str(dna.get("nome", dna.get("nome_negocio", ""))).strip()
    modelo = str(dna.get("modelo", "")).strip()
    concorrentes = str(dna.get("concorrentes", "")).strip()
    diferencial = str(dna.get("diferencial", "")).strip()
    fornecedores_user = str(dna.get("fornecedores", "")).strip()
    tipo_cliente = str(dna.get("tipo_cliente", "")).strip()
    
    if not segmento or segmento == "?":
        return ""
    
    # Cache key
    cache_key = f"{nome}|{segmento}".lower()
    if cache_key in _SUPPLY_CHAIN_CACHE:
        return _SUPPLY_CHAIN_CACHE[cache_key]
    
    # If user already provided fornecedores, use them directly without LLM
    fornecedores_info = ""
    if fornecedores_user and fornecedores_user != "?":
        fornecedores_info = f"\nFORNECEDORES INFORMADOS PELO USUÁRIO: {fornecedores_user}"
    
    clientes_info = ""
    if tipo_cliente and tipo_cliente != "?":
        clientes_info = f"\nCLIENTES INFORMADOS PELO USUÁRIO: {tipo_cliente}"
    
    # Load prompt from YAML
    prompt_config = get_engine_prompt("supply_chain_detection")
    if not prompt_config:
        return ""
        
    prompt = prompt_config.get("prompt", "").format(
        nome=nome,
        segmento=segmento,
        modelo=modelo,
        concorrentes=concorrentes if concorrentes and concorrentes != '?' else 'não informados',
        diferencial=diferencial if diferencial and diferencial != '?' else 'não informado',
        fornecedores_info=fornecedores_info,
        clientes_info=clientes_info
    )

    try:
        result = call_llm(
            provider="auto",
            prompt=prompt,
            temperature=0.1,
            json_mode=True,
            prefer_small=True,
        )
        
        if not isinstance(result, dict) or not result.get("posicao"):
            _SUPPLY_CHAIN_CACHE[cache_key] = ""
            return ""
        
        # Only inject context when there's real risk of confusion
        if not result.get("risco_confusao", False) and not fornecedores_user:
            _SUPPLY_CHAIN_CACHE[cache_key] = ""
            return ""
        
        # Build rich, structured text that the LLM MUST respect
        text = (
            f"⚠️ CADEIA PRODUTIVA — LEIA ANTES DE ANALISAR (OBRIGATÓRIO):\n"
            f"Posição na cadeia: {result.get('posicao', '')}\n"
            f"O que faz: {result.get('descricao_curta', '')}\n"
        )
        # Prioritize user-provided fornecedores over LLM-inferred ones
        if fornecedores_user and fornecedores_user != "?":
            text += f"🔴 FORNECEDORES DE MATÉRIA-PRIMA (INFORMADO PELO DONO): {fornecedores_user} — ESTES NÃO SÃO CONCORRENTES!\n"
        else:
            text += f"FORNECEDORES (NÃO confundir com concorrentes): {result.get('fornecedores_tipicos', '')}\n"
        text += (
            f"CONCORRENTES REAIS (vendem o MESMO produto final para os MESMOS clientes): {result.get('concorrentes_reais', '')}\n"
            f"CLIENTES-ALVO: {result.get('clientes_tipicos', '')}\n"
            f"⛔ REGRA: Se uma empresa aparece como FORNECEDOR acima, NUNCA a liste como concorrente."
        )
        
        _SUPPLY_CHAIN_CACHE[cache_key] = text
        log_info(f"📋 Cadeia produtiva detectada para {segmento}: {result.get('posicao', '?')}")
        return text
        
    except Exception as e:
        log_warning(f"Falha ao detectar cadeia produtiva: {e}")
        _SUPPLY_CHAIN_CACHE[cache_key] = ""
        return ""


def brief_to_text(brief: dict, max_tokens: int = 800) -> str:
    """Convert business brief to compact text for LLM injection."""
    dna = brief.get("dna", {})
    fp = brief.get("footprint", {})
    md = brief.get("market_digest", {})
    restr = brief.get("restricoes", [])
    sb = brief.get("sales_brief", "")
    cadeia = brief.get("cadeia_produtiva", "")

    lines = [
        f"NEGÓCIO: {dna.get('nome','?')} | {dna.get('segmento','?')} | {dna.get('modelo','?')} | {dna.get('localizacao','?')}",
        f"Equipe: {dna.get('equipe','?')} | Capital: {dna.get('capital','?')} | Faturamento: {dna.get('faturamento','?')} | Ticket: {dna.get('ticket_medio','?')}",
        f"Diferencial: {dna.get('diferencial','?')}",
        f"Cliente ideal: {dna.get('cliente_ideal','?')}",
        f"Tipos de clientes atendidos: {dna.get('tipo_cliente','?')}",
        f"Canais atuais: {dna.get('canais_atuais','?')}",
        f"Dificuldade: {dna.get('dificuldade_principal','?')}",
        f"Concorrentes (diretos): {dna.get('concorrentes','?')}",
        f"Fornecedores (matéria-prima/insumos): {dna.get('fornecedores','?')}",
        f"Capacidade produtiva: {dna.get('capacidade_produtiva','?')}",
        f"Região de atendimento: {dna.get('regiao_atendimento','?')}",
        f"Objeção: {dna.get('maior_objecao','?')}",
    ]

    if sb:
        lines.append("SÍNTESE DE VENDAS (o que bloqueia, 3 alavancas, riscos):")
        lines.append(f"  {sb[:600]}")

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

    if cadeia:
        lines.append(cadeia)

    text = "\n".join(lines)
    return text[:max_tokens * 4]  # rough char→token estimate


def build_cross_pillar_context(analysis_id: str, target_pillar: str, all_diagnostics: dict = None) -> str:
    """Build rich context from upstream pillar outputs for this specialist.
    
    Queries the DB for each upstream pillar's:
    - Diagnostic (score, gaps, key data, meta)
    - Plan (tasks, KPIs, objectives)
    - Execution results (deliverables produced)
    
    This is the ASSEMBLY LINE: downstream specialists read upstream reports
    instead of re-searching the web. Token-efficient and hyper-coherent.
    """
    from app.services.analysis.analyzer_business_scorer import DIMENSIONS

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

        # Normalize: if it's the DB row, extract the data field
        diag_data = diag.get("diagnostic_data", diag) if isinstance(diag, dict) else diag
        if not isinstance(diag_data, dict):
            diag_data = {}

        score = diag_data.get("score", 0)
        status = diag_data.get("status", "sem_dados")
        estado = diag_data.get("estado_atual", {})
        gaps = diag_data.get("gaps", [])

        part = f"📋 {label} ({cargo}) — {score}/100 ({status})\n"

        # Extract key variables from diagnostic
        if isinstance(estado, dict):
            justif = estado.get("justificativa", "")
            if justif:
                part += f"  Situação: {justif[:1000]}\n"
            
            # 🔄 NEW: Strategic Feedback Loop Notes
            feedback_note = diag_data.get("justificativa_feedback", "") if isinstance(diag_data, dict) else ""
            if feedback_note:
                part += f"  ⚠️ NOTA ESTRATÉGICA (DESCOBERTA REAL): {feedback_note}\n"

            dado_chave = estado.get("dado_chave", "")
            if dado_chave:
                part += f"  Dado-chave: {dado_chave[:500]}\n"
            meta = estado.get("meta_pilar", "")
            if meta:
                part += f"  Meta: {meta[:300]}\n"

        if gaps and isinstance(gaps, list):
            part += "  Gaps: " + "; ".join(str(g)[:200] for g in gaps[:3]) + "\n"

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
            part += "  Entregáveis produzidos (CONTEÚDO COMPLETO - USE ISTO):\n"
            for r in executed[:5]:
                outcome = r.get("outcome", "")[:2000] # Increased context limit for robust intelligence cascade
                impact = r.get("business_impact", "")[:500]
                part += f"    ✅ {r.get('action_title', '')[:100]}:\n      {outcome}"
                if impact:
                    part += f"\n      → Impacto Previsto: {impact}"
                part += "\n\n"

        sections.append(part)

    if not sections:
        return ""

    header = "═══ RELATÓRIOS DOS ESPECIALISTAS ANTERIORES (use como base — NÃO pesquise novamente) ═══"
    return header + "\n" + "\n".join(sections)


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
