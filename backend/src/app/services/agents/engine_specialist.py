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
# SPECIALIST PERSONAS — DINÂMICAS por modelo de negócio
# ═══════════════════════════════════════════════════════════════════
# Cada pilar tem variantes por modelo (b2b, b2c, servico, default).
# get_specialist() retorna a persona correta baseada no perfil.

_SPECIALISTS_BY_MODEL = {
    # ── B2B ──────────────────────────────────────────────────────────
    "b2b": {
        "publico_alvo": {
            "cargo": "Analista de Clientes B2B",
            "persona": "Você é um analista especializado em mapeamento de compradores B2B. Identifica decision makers (diretores, gerentes de compra, engenheiros), ciclos de compra, critérios de seleção de fornecedores e objeções corporativas.",
            "kpis": ["qualificacao_decision_makers", "ciclo_compra_medio", "taxa_conversao_b2b", "valor_medio_contrato"],
            "escopo": "Mapeamento de compradores B2B: personas (cargo, setor, decisões), jornada de compra corporativa, critérios de seleção de fornecedores, processo de aprovação, objeções típicas.",
            "entregaveis_obrigatorios": [
                "Persona de Comprador B2B (cargo, dores, KPIs, processo decisório, objeções)",
                "Mapa de Jornada de Compra B2B (identificação → pesquisa → amostra → negociação → contrato)",
                "Matriz de Critérios de Fornecedor (preço, qualidade, prazo, certificações, relacionamento)",
                "Análise de Objeções B2B ('fornecedor homologado', 'guerra de preços', 'risco de mudança')"
            ],
            "nao_fazer": "NÃO crie personas de consumidor final B2C, NÃO pense em compras impulsivas. Foque em compradores corporativos.",
        },
        "branding": {
            "cargo": "Estrategista de Posicionamento B2B",
            "persona": "Você é um estrategista de posicionamento B2B. Define como a empresa deve ser percebida por compradores corporativos e gestores. Foca em diferenciação técnica, confiabilidade e proposta de valor quantificável.",
            "kpis": ["percepcao_tecnica", "confiabilidade_mercado", "diferencial_competitivo"],
            "escopo": "Posicionamento B2B, proposta de valor técnica, mensagem para decision makers, análise competitiva, brand story corporativo.",
            "entregaveis_obrigatorios": [
                "Declaração de Posicionamento B2B (para compradores X, somos o fornecedor que Y porque Z)",
                "Proposta de Valor B2B (benefícios quantificáveis vs concorrentes)",
                "Mensagem para Decision Makers (redução de custo, agilidade, qualidade)",
                "Análise Competitiva (pontos fortes vs concorrentes em preço, qualidade, atendimento)"
            ],
            "nao_fazer": "NÃO crie slogans emocionais de varejo, NÃO foque em impulso. Posicionamento racional e técnico.",
        },
        "identidade_visual": {
            "cargo": "Diretor de Comunicação Visual Corporativa",
            "persona": "Você é diretor de comunicação visual B2B. Cria identidade que transmite profissionalismo, confiança e capacidade técnica para compradores corporativos.",
            "kpis": ["profissionalismo_visual", "confianca_corporativa", "clareza_materiais"],
            "escopo": "Identidade visual corporativa: paleta profissional, tipografia, templates para propostas comerciais, catálogos técnicos, apresentações.",
            "entregaveis_obrigatorios": [
                "Guia de Identidade Visual Corporativa (cores, tipografia, uso de logos)",
                "Templates para Propostas Comerciais (layout profissional, seções técnicas)",
                "Padrões para Materiais (catálogos, fichas técnicas, apresentações)",
                "Regras de Comunicação Visual (credibilidade, o que evitar)"
            ],
            "nao_fazer": "NÃO crie arte para Instagram, NÃO foque em tendências visuais de varejo. Comunicação profissional.",
        },
        "canais_venda": {
            "cargo": "Diretor de Canais Comerciais B2B",
            "persona": "Você é Diretor Comercial B2B. Foca em canais de alto valor: representantes, parcerias estratégicas, vendas consultivas, marketplaces B2B, licitações.",
            "kpis": ["receita_por_canal", "ciclo_venda_medio", "ticket_medio_contrato", "taxa_fechamento"],
            "escopo": "Canais B2B: vendas diretas, representantes regionais, parcerias, marketplace B2B, vendas consultivas, contratos anuais.",
            "entregaveis_obrigatorios": [
                "Matriz de Canais B2B (potencial, ciclo, ticket, esforço por canal)",
                "Plano de Expansão Comercial (representantes, regiões, comissão)",
                "Estratégia de Parcerias (integradores, acordos, co-marketing)"
            ],
            "nao_fazer": "NÃO foque em Instagram/TikTok para vendas. Canais corporativos e relacionamento.",
        },
        "trafego_organico": {
            "cargo": "Estrategista de Presença Digital B2B",
            "persona": "Você é estrategista digital B2B. SEO e conteúdo devem gerar LEADS QUALIFICADOS. Artigos, case studies e whitepapers para atrair compradores corporativos.",
            "kpis": ["leads_qualificados", "visitas_decision_makers", "downloads_tecnicos", "solicitacoes"],
            "escopo": "SEO técnico, white papers, case studies, artigos B2B, LinkedIn, presença em feiras virtuais.",
            "entregaveis_obrigatorios": [
                "Plano de Conteúdo B2B (white papers, case studies, artigos técnicos)",
                "Estratégia de SEO B2B (palavras-chave técnicas, long-tail, SEO local)",
                "Calendário de LinkedIn (posts para decision makers, cases de sucesso)"
            ],
            "nao_fazer": "NÃO crie posts de lifestyle, NÃO foque em viralidade. Conteúdo técnico para gerar leads.",
        },
        "trafego_pago": {
            "cargo": "Gerente de Prospecção B2B Paga",
            "persona": "Você usa mídia paga para identificar e qualificar compradores B2B. LinkedIn Ads por cargo, Google Ads por palavras técnicas, retargeting B2B.",
            "kpis": ["cpl_decision_maker", "taxa_qualificacao", "reunioes_agendadas", "roi_prospeccao"],
            "escopo": "LinkedIn Ads, Google Ads B2B, portais do setor, webinars, retargeting para visitantes técnicos.",
            "entregaveis_obrigatorios": [
                "Plano de LinkedIn Ads (segmentação por cargo e indústria, copy técnico)",
                "Estratégia de Google Ads B2B (palavras industriais, landing pages, formulários)",
                "Orçamento de Prospecção (investimento → leads → reuniões → oportunidades)"
            ],
            "nao_fazer": "NÃO anuncie para consumidor final, NÃO use criativos de varejo. Prospecção B2B.",
        },
        "processo_vendas": {
            "cargo": "Diretor de Vendas Consultivas B2B",
            "persona": "Você é Diretor de Vendas B2B. Ciclos longos, vendas consultivas, contratos de fornecimento, gestão de contas-chave. Quebra objeções corporativas.",
            "kpis": ["ciclo_venda_medio", "taxa_conversao_proposta", "valor_medio_contrato", "taxa_renovacao"],
            "escopo": "Metodologia B2B: qualificação, diagnóstico, amostra, proposta técnica, negociação, contrato, expansão de conta.",
            "entregaveis_obrigatorios": [
                "Metodologia de Venda B2B (etapas, qualificação, gatilhos de avanço)",
                "Scripts de Negociação B2B (objeções corporativas, guerra de preços, especificações)",
                "Plano de Expansão de Contas (upsell, cross-sell, renovação)"
            ],
            "nao_fazer": "NÃO use vendas B2C, NÃO foque em impulso. Vendas consultivas com relacionamento.",
        },
    },

    # ── B2C ──────────────────────────────────────────────────────────
    "b2c": {
        "publico_alvo": {
            "cargo": "Analista de Comportamento do Consumidor",
            "persona": "Você é analista de comportamento do consumidor final. Mapeia personas de compra, jornada emocional, gatilhos de decisão, influências sociais e hábitos de consumo.",
            "kpis": ["conhecimento_persona", "taxa_conversao", "ltv_cliente", "nps"],
            "escopo": "Personas de consumidor: demografía, psicografia, dores, desejos, jornada de compra, influências, canais preferidos, objeções e gatilhos emocionais.",
            "entregaveis_obrigatorios": [
                "Persona de Consumidor (idade, renda, estilo de vida, dores, desejos, onde busca, o que compara)",
                "Mapa de Jornada do Consumidor (gatilho → pesquisa → comparação → decisão → pós-compra)",
                "Gatilhos e Objeções (o que faz comprar, o que faz desistir, objeções mais comuns)",
                "Análise de Influências (redes sociais, indicações, reviews, preço vs valor percebido)"
            ],
            "nao_fazer": "NÃO crie personas corporativas/B2B. Foque no consumidor final, decisão emocional + racional.",
        },
        "branding": {
            "cargo": "Estrategista de Marca e Posicionamento",
            "persona": "Você é estrategista de marca para o consumidor final. Cria posicionamento emocional + racional, tom de voz, storytelling e diferenciação para se destacar no mercado.",
            "kpis": ["reconhecimento_marca", "diferenciacao_percebida", "conexao_emocional", "share_of_voice"],
            "escopo": "Posicionamento de marca, tom de voz, storytelling, proposta de valor para consumidor, análise de concorrentes, brand persona.",
            "entregaveis_obrigatorios": [
                "Declaração de Posicionamento (para [público], somos a marca que [promessa] porque [razão])",
                "Tom de Voz e Personalidade da Marca (como fala, o que evita, exemplos)",
                "Proposta de Valor para o Consumidor (benefícios emocionais + racionais)",
                "Análise Competitiva de Marca (posicionamento vs concorrentes diretos)"
            ],
            "nao_fazer": "NÃO use linguagem corporativa/técnica. Marca conectada ao consumidor, emocional e aspiracional.",
        },
        "identidade_visual": {
            "cargo": "Diretor Criativo de Marca",
            "persona": "Você é diretor criativo focado em marcas B2C. Cria identidade visual atraente, moderna, que conecta emocionalmente com o consumidor e se destaca nas redes sociais.",
            "kpis": ["atratividade_visual", "reconhecimento_marca", "engajamento_visual", "conversao_visual"],
            "escopo": "Identidade visual para consumidor: paleta vibrante, tipografia moderna, templates para redes sociais, stories, posts, embalagens, PDV.",
            "entregaveis_obrigatorios": [
                "Guia de Identidade Visual (cores, fontes, logo, aplicações em redes sociais)",
                "Templates para Redes Sociais (Instagram, stories, reels, posts, destaques)",
                "Padrões para Embalagens e PDV (se aplicável)",
                "Diretrizes de Conteúdo Visual (fotos, vídeos, estilo de imagem)"
            ],
            "nao_fazer": "NÃO use estética corporativa/industrial. Visual moderno, atraente, digno de compartilhar.",
        },
        "canais_venda": {
            "cargo": "Gerente de Canais de Venda",
            "persona": "Você é gerente de canais focado no consumidor final. Otimiza e-commerce, loja física, Instagram Shopping, WhatsApp Business, marketplaces e delivery.",
            "kpis": ["receita_por_canal", "taxa_conversao_canal", "ticket_medio", "custo_aquisicao"],
            "escopo": "Canais de venda B2C: e-commerce, Instagram Shopping, WhatsApp Business, marketplaces (Mercado Livre, Shopee), loja física, delivery, iFood.",
            "entregaveis_obrigatorios": [
                "Matriz de Canais B2C (potencial, conversão, custo, facilidade de implementação)",
                "Estratégia de WhatsApp Business (catálogo, automação, atendimento rápido)",
                "Plano de Marketplace (onde listar, precificação, logística, reviews)"
            ],
            "nao_fazer": "NÃO foque em canais corporativos/licitações. Canais onde o consumidor final compra.",
        },
        "trafego_organico": {
            "cargo": "Estrategista de Conteúdo e Redes Sociais",
            "persona": "Você é estrategista de conteúdo para redes sociais e SEO para consumidor final. Reels, stories, posts, SEO local, Google Meu Negócio — tudo para atrair e engajar clientes.",
            "kpis": ["seguidores_qualificados", "engajamento_medio", "alcance_organico", "visitas_perfil"],
            "escopo": "Instagram (reels, stories, carrossel), TikTok, YouTube Shorts, blog/SEO, Google Meu Negócio, estratégias de engajamento e viralização.",
            "entregaveis_obrigatorios": [
                "Calendário de Conteúdo (30 dias: reels, carrosséis, stories, posts)",
                "Estratégia de SEO Local (Google Meu Negócio, palavras-chave locais, reviews)",
                "Guia de Reels e TikTok (formatos que convertem, tendências do segmento)"
            ],
            "nao_fazer": "NÃO crie conteúdo técnico/corporativo. Conteúdo leve, visual, compartilhável.",
        },
        "trafego_pago": {
            "cargo": "Gerente de Performance e Mídia Paga",
            "persona": "Você é gerente de performance para e-commerce e negócios locais. Meta Ads, Google Ads, remarketing, campanhas de conversão para consumidor final.",
            "kpis": ["roas", "cpa", "ctr", "taxa_conversao_anuncio", "custo_por_lead"],
            "escopo": "Meta Ads (Instagram/Facebook), Google Ads (Search, Shopping, Display), remarketing, lookalike audiences, criativos de conversão.",
            "entregaveis_obrigatorios": [
                "Plano de Meta Ads (públicos, criativos, copy, orçamento diário)",
                "Estratégia de Google Ads (Search + Shopping, palavras-chave, landing pages)",
                "Funil de Remarketing (visitantes → carrinho → compra, sequência de criativos)"
            ],
            "nao_fazer": "NÃO use segmentação corporativa/LinkedIn. Foque em Meta Ads e Google para consumidor.",
        },
        "processo_vendas": {
            "cargo": "Gerente de Conversão e Experiência do Cliente",
            "persona": "Você é gerente de conversão e experiência do cliente. Otimiza funil de vendas, atendimento, follow-up por WhatsApp, contorno de objeções, pós-venda e fidelização.",
            "kpis": ["taxa_conversao_funil", "tempo_resposta", "ticket_medio", "taxa_recompra", "nps"],
            "escopo": "Funil de vendas B2C, scripts de WhatsApp, contorno de objeções (preço, frete, confiança), pós-venda, fidelização, programa de indicação.",
            "entregaveis_obrigatorios": [
                "Funil de Vendas B2C (etapas: interesse → contato → proposta → fechamento → pós)",
                "Scripts de WhatsApp (abordagem, follow-up, contorno de objeções, fechamento)",
                "Programa de Fidelização e Indicação (recompra, indicação, reviews)"
            ],
            "nao_fazer": "NÃO use vendas consultivas longas. Funil rápido, atendimento ágil, experiência encantadora.",
        },
    },

    # ── SERVIÇOS ─────────────────────────────────────────────────────
    "servico": {
        "publico_alvo": {
            "cargo": "Analista de Clientes de Serviços",
            "persona": "Você mapeia clientes que buscam serviços especializados. Identifica quem contrata, o que valoriza (expertise, confiança, resultado), e como decide.",
            "kpis": ["perfil_cliente_ideal", "taxa_conversao_consulta", "ltv", "indicacoes"],
            "escopo": "Persona do contratante: perfil, dores, expectativas, processo decisório, objeções ('posso fazer sozinho', 'está caro'), valorização de expertise.",
            "entregaveis_obrigatorios": [
                "Persona do Contratante (quem busca o serviço, por quê, o que compara)",
                "Jornada de Contratação (problema → pesquisa → orçamento → decisão → indicação)",
                "Gatilhos de Decisão e Objeções (preço vs valor, confiança, 'faço sozinho')",
                "Análise de Influências (indicações, portfólio, presença online, autoridade)"
            ],
            "nao_fazer": "NÃO crie personas de compra impulsiva. Foque no cliente que busca solução especializada.",
        },
        "branding": {
            "cargo": "Estrategista de Autoridade e Posicionamento",
            "persona": "Você posiciona prestadores de serviço como autoridade no segmento. Foca em credibilidade, portfólio, cases de sucesso e prova social.",
            "kpis": ["autoridade_percebida", "taxa_indicacao", "diferenciacao"],
            "escopo": "Posicionamento de autoridade, portfólio, cases de sucesso, prova social, diferenciação vs freelancers e concorrentes.",
            "entregaveis_obrigatorios": [
                "Declaração de Posicionamento (sou o especialista que X para quem precisa de Y)",
                "Estratégia de Prova Social (cases, depoimentos, antes/depois, resultados)",
                "Proposta de Valor (por que contratar em vez de fazer sozinho)",
                "Análise Competitiva (diferenciação vs outros prestadores)"
            ],
            "nao_fazer": "NÃO use linguagem de produto. Foque em expertise, resultado e confiança.",
        },
        "identidade_visual": {
            "cargo": "Diretor de Imagem Profissional",
            "persona": "Você cria identidade visual que transmite profissionalismo, expertise e confiança para prestadores de serviço.",
            "kpis": ["profissionalismo_visual", "confianca_transmitida", "consistencia"],
            "escopo": "Identidade visual profissional: logo, cartão, proposta comercial, apresentação, redes sociais com tom de autoridade.",
            "entregaveis_obrigatorios": [
                "Guia Visual Profissional (cores, tipografia, logo, aplicações)",
                "Templates de Proposta e Orçamento (layout profissional)",
                "Padrões para Redes Sociais (posts de autoridade, cases, dicas)",
                "Diretrizes de Imagem (o que transmite confiança, o que evitar)"
            ],
            "nao_fazer": "NÃO use estética de varejo. Visual profissional que transmite competência.",
        },
        "canais_venda": {
            "cargo": "Gerente de Aquisição de Clientes",
            "persona": "Você gera clientes para serviços via indicações, networking, presença online, parcerias estratégicas e prospecção ativa.",
            "kpis": ["clientes_por_canal", "custo_aquisicao", "taxa_indicacao", "lifetime_value"],
            "escopo": "Canais para serviços: indicações, networking, LinkedIn, Google Meu Negócio, parcerias, prospecção ativa, eventos.",
            "entregaveis_obrigatorios": [
                "Matriz de Canais de Serviço (indicação, Google, LinkedIn, parcerias, prospecção)",
                "Programa de Indicações (incentivos, processo, follow-up)",
                "Estratégia de Prospecção (como abordar, sequência, follow-up)"
            ],
            "nao_fazer": "NÃO foque em marketplace de produtos. Canais de serviço e relacionamento.",
        },
        "trafego_organico": {
            "cargo": "Estrategista de Autoridade Digital",
            "persona": "Você constrói autoridade online para prestadores de serviço. Conteúdo educativo, cases, dicas práticas que posicionam como especialista.",
            "kpis": ["autoridade_online", "leads_organicos", "engajamento_educativo"],
            "escopo": "Conteúdo de autoridade: blog/SEO, LinkedIn, Instagram educativo, YouTube, cases, Google Meu Negócio.",
            "entregaveis_obrigatorios": [
                "Plano de Conteúdo de Autoridade (artigos, vídeos educativos, cases)",
                "Estratégia de SEO para Serviços (palavras-chave locais, Google Meu Negócio)",
                "Calendário de Conteúdo (mix: educativo, cases, bastidores, dicas)"
            ],
            "nao_fazer": "NÃO foque em conteúdo de entretenimento puro. Conteúdo que gera autoridade e leads.",
        },
        "trafego_pago": {
            "cargo": "Gerente de Captação Paga",
            "persona": "Você usa anúncios para gerar leads qualificados para serviços. Google Ads local, Meta Ads, remarketing para quem visitou o site/perfil.",
            "kpis": ["custo_por_lead", "taxa_agendamento", "roi_campanhas"],
            "escopo": "Google Ads (serviços locais), Meta Ads (social proof), remarketing, geradores de lead (diagnóstico grátis, consultoria grátis).",
            "entregaveis_obrigatorios": [
                "Plano de Google Ads para Serviços (palavras-chave locais, extensões, landing page)",
                "Estratégia de Meta Ads (prova social, cases, oferta de diagnóstico)",
                "Funil de Captação (anúncio → landing → formulário → contato → agendamento)"
            ],
            "nao_fazer": "NÃO otimize para vendas diretas de produto. Foque em gerar agendamentos e leads.",
        },
        "processo_vendas": {
            "cargo": "Gerente de Vendas Consultivas",
            "persona": "Você fecha contratos de serviço com vendas consultivas. Diagnóstico, proposta personalizada, contorno de objeções ('posso fazer sozinho', 'está caro'), follow-up e fidelização.",
            "kpis": ["taxa_conversao_proposta", "ticket_medio_servico", "taxa_recontratacao"],
            "escopo": "Vendas consultivas para serviços: diagnóstico, proposta, negociação, objeções, follow-up, pós-venda, indicação.",
            "entregaveis_obrigatorios": [
                "Metodologia de Venda de Serviço (diagnóstico → proposta → negociação → fechamento)",
                "Scripts de Contorno de Objeções ('está caro', 'vou pensar', 'consigo sozinho')",
                "Programa de Pós-Venda e Indicação (acompanhamento, recontratação, referral)"
            ],
            "nao_fazer": "NÃO use funil impulsivo. Venda consultiva focada em valor e resultado.",
        },
    },
}


def _detect_business_model(profile: dict) -> str:
    """Detect business model from profile data. Returns 'b2b', 'b2c', or 'servico'."""
    perfil = profile.get("perfil", profile)
    modelo = (perfil.get("modelo_negocio") or perfil.get("modelo") or "").lower()
    segmento = (perfil.get("segmento") or "").lower()
    tipo = (perfil.get("tipo_oferta") or perfil.get("tipo_produto") or "").lower()

    if "b2b" in modelo:
        return "b2b"
    if "b2c" in modelo or "varejo" in segmento or "loja" in segmento:
        return "b2c"
    if any(kw in segmento for kw in ("serviço", "servico", "consultoria", "agência", "agencia", "freelancer")):
        return "servico"
    if any(kw in tipo for kw in ("serviço", "servico")):
        return "servico"
    # Default: B2C is the safer fallback for unknown small businesses
    return "b2c"


def get_specialist(pillar_key: str, profile: dict) -> dict:
    """Return the correct specialist persona based on pillar + business model."""
    model_key = _detect_business_model(profile)
    specialists_for_model = _SPECIALISTS_BY_MODEL.get(model_key, _SPECIALISTS_BY_MODEL["b2c"])
    return specialists_for_model.get(pillar_key, _SPECIALISTS_BY_MODEL["b2c"].get(pillar_key, {}))


# Legacy compat: SPECIALISTS dict — returns B2C defaults for code that reads SPECIALISTS[key]
SPECIALISTS = _SPECIALISTS_BY_MODEL["b2c"]


def _get_specialist_from_brief(pillar_key: str, brief: dict) -> dict:
    """Extract business model from brief's DNA and return the right specialist."""
    modelo = brief.get("dna", {}).get("modelo", "").lower() if brief else ""
    if "b2b" in modelo:
        model_key = "b2b"
    elif any(kw in modelo for kw in ("serviço", "servico", "consultoria", "agência", "agencia")):
        model_key = "servico"
    else:
        model_key = "b2c"
    specs = _SPECIALISTS_BY_MODEL.get(model_key, _SPECIALISTS_BY_MODEL["b2c"])
    return specs.get(pillar_key, SPECIALISTS.get(pillar_key, {}))


# ═══════════════════════════════════════════════════════════════════
# DYNAMIC CONTEXT ADAPTER - Camaleão Business Intelligence
# ═══════════════════════════════════════════════════════════════════

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


# ═══════════════════════════════════════════════════════════════════
# LAYER 0: Compact Business Brief (CBB)
# ═══════════════════════════════════════════════════════════════════

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


# Module-level cache for supply chain detection (computed once per business)
_SUPPLY_CHAIN_CACHE: dict = {}


def _detect_supply_chain_context(dna: dict) -> str:
    """
    Use the LLM to dynamically classify the business's position in its supply chain.
    Prevents LLM from confusing suppliers with competitors in downstream analysis.
    
    Uses prefer_small=True for speed and caches the result in a module-level dict
    keyed by (nome, segmento) so it's only computed once per business.
    
    NEW: Also incorporates user-provided fornecedores data from the chat profile.
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
    
    prompt = f"""Classifique a posição deste negócio na cadeia produtiva do setor.

NEGÓCIO: {nome}
SEGMENTO: {segmento}
MODELO: {modelo}
CONCORRENTES INFORMADOS: {concorrentes if concorrentes and concorrentes != '?' else 'não informados'}
DIFERENCIAL: {diferencial if diferencial and diferencial != '?' else 'não informado'}{fornecedores_info}{clientes_info}

Responda APENAS com este JSON:
{{
    "posicao": "FABRICANTE_MATERIA_PRIMA | TRANSFORMADOR | DISTRIBUIDOR | VAREJISTA | SERVICO | OUTRO",
    "descricao_curta": "O que este negócio faz na cadeia (1 frase)",
    "fornecedores_tipicos": "Quem fornece insumos/matéria-prima para este negócio (NÃO são concorrentes)",
    "concorrentes_reais": "Quem compete diretamente com este negócio (vendem o MESMO produto/serviço para os MESMOS clientes)",
    "clientes_tipicos": "Quem compra o produto/serviço deste negócio",
    "risco_confusao": true ou false (se há risco de confundir fornecedores com concorrentes neste segmento)
}}

REGRAS:
- Baseie-se no segmento real do negócio, não invente.
- Se o negócio TRANSFORMA matéria-prima em produto (ex: cartonagem compra chapa e faz caixa), marque risco_confusao=true.
- Se o negócio é varejista ou serviço puro, risco_confusao geralmente é false.
- Seja específico para o segmento "{segmento}" no Brasil."""

    try:
        result = call_llm(
            provider="groq",
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
    """Convert business brief to compact text for LLM injection.
    Now includes sales_brief so every specialist gets the '3 alavancas + riscos' synthesis."""
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

        score = diag.get("score", 0)
        status = diag.get("status", "sem_dados")
        estado = diag.get("estado_atual", {})
        gaps = diag.get("gaps", [])

        part = f"📋 {label} ({cargo}) — {score}/100 ({status})\n"

        # Extract key variables from diagnostic
        if isinstance(estado, dict):
            justif = estado.get("justificativa", "")
            if justif:
                part += f"  Situação: {justif[:1000]}\n"
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
    model_provider: str = "groq",
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
    # Removed GROQ_API_KEY check since call_llm handles keys per provider
    
    spec = _get_specialist_from_brief(pillar_key, brief)
    if not spec:
        return {"success": False, "error": f"Unknown pillar: {pillar_key}"}

    from app.services.analysis.analyzer_business_scorer import DIMENSIONS
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

    # ── RAG: search via unified_research (with cache) ──
    dna = brief.get("dna", {})
    segmento = dna.get("segmento", "")
    nome = dna.get("nome", "")

    specialist_research = ""
    sources = []
    try:
        from app.services.research.unified_research import research_engine
        research_data = research_engine.search_tasks(
            pillar_key=pillar_key,
            score=score,
            diagnostic={"justificativa": diag_text[:200]},
            segmento=segmento,
            force_refresh=False
        )
        specialist_research = research_data.get("content", "")
        sources = research_data.get("sources", [])
        print(f"  📦 Plan search via unified_research: {len(sources)} sources", file=sys.stderr)
    except Exception as e:
        print(f"  ⚠️ Unified research failed for plan: {e}", file=sys.stderr)

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
        result = call_llm(
            provider=model_provider,
            prompt=prompt,
            temperature=0.3,
            json_mode=True
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
            result = call_llm(
                provider=model_provider,
                prompt=prompt,
                temperature=0.3,
                json_mode=True,
                prefer_small=True
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
    from app.services.analysis.analyzer_business_scorer import DIMENSIONS

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
    "pesquisar", "analisar", "benchmarking", "comparar", "descrever", "identificar",
    "calendário", "cronograma", "agenda", "segmentação", "mapear",
    "persona", "perfil de cliente", "público", "documento", "script",
    "precificação", "preço", "margem", "ticket",
    "funil", "jornada", "pipeline", "roteiro",
    "template", "modelo", "proposta",
    "otimizar texto", "seo", "palavras-chave", "hashtag",
    "email", "mensagem", "abordagem", "pitch",
    "criar o documento", "criar a segmentação", "descrever o mapa"
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


def _should_search_for_task(task_title: str, task_desc: str, market_context: str) -> bool:
    """
    Intelligent decision: when to search for specific task data.
    Combines context length with task specificity analysis.
    """
    # Rule 1: Always search if context is thin (original logic)
    if len(market_context) < 500:
        return True
    
    # Rule 2: Search for specific task types that need fresh data
    specific_keywords = [
        "pesquisar", "analisar", "benchmark", "concorrência", "tendências",
        "estatísticas", "dados", "mercado", "estudo", "pesquisa de mercado",
        "análise competitiva", "oportunidades", "cenário", "perfil", "persona"
    ]
    
    title_lower = task_title.lower()
    desc_lower = task_desc.lower()
    
    # Check if task contains specific research keywords
    for keyword in specific_keywords:
        if keyword in title_lower or keyword in desc_lower:
            return True
    
    # Rule 3: Search for tasks mentioning specific industries, tools, or methodologies
    industry_keywords = [
        "indústria", "setor", "segmento", "nichos", "público-alvo",
        "ferramentas", "plataformas", "software", "tecnologia", "métodos"
    ]
    
    for keyword in industry_keywords:
        if keyword in title_lower or keyword in desc_lower:
            return True
    
    # Rule 4: Search for tasks asking for current/trending information
    time_keywords = [
        "2025", "atual", "recente", "tendências", "futuro", "próximos",
        "hoje", "agora", "moderno", "inovação"
    ]
    
    for keyword in time_keywords:
        if keyword in title_lower or keyword in desc_lower:
            return True
    
    return False


def _build_smart_search_query(task_title: str, task_desc: str, segmento: str, pillar_key: str) -> str:
    """
    Builds intelligent search queries based on task characteristics.
    Focuses on the SUBJECT of the task + business segment, NOT generic action verbs.
    """
    # Remove action verbs and stop words to focus on the actual subject
    stop_words = {
        "o", "a", "os", "as", "de", "do", "da", "dos", "das", "em", "para",
        "com", "sem", "um", "uma", "que", "por", "no", "na", "nos", "nas",
        "ao", "à", "pelo", "pela", "se", "e", "ou", "mas", "como",
        "criar", "desenvolver", "implementar", "definir", "analisar",
        "pesquisar", "coletar", "identificar", "elaborar", "estabelecer",
        "mapear", "levantar", "realizar", "executar", "gerar", "produzir",
    }
    
    all_text = f"{task_title} {task_desc}".lower()
    words = all_text.split()
    keywords = []
    seen = set()
    for w in words:
        if w not in stop_words and len(w) > 2 and w not in seen:
            seen.add(w)
            keywords.append(w)
    
    # Build contextual query based on pillar
    pillar_contexts = {
        "publico_alvo": "público-alvo persona comprador",
        "branding": "branding marca posicionamento",
        "identidade_visual": "identidade visual design",
        "canais_venda": "canais vendas e-commerce",
        "trafego_organico": "SEO tráfego orgânico conteúdo",
        "trafego_pago": "anúncios tráfego pago",
        "processo_vendas": "processo vendas funil",
    }
    
    pillar_term = pillar_contexts.get(pillar_key, "").split()[0] if pillar_key in pillar_contexts else ""
    
    # Assemble: segmento + subject keywords + pillar context + year
    parts = []
    if segmento:
        parts.append(segmento)
    parts.extend(keywords[:4])
    if pillar_term and pillar_term not in seen:
        parts.append(pillar_term)
    parts.append("2025")
    
    return " ".join(parts)


def _extract_market_for_pillar(pillar_key: str, market_data: dict) -> str:
    """Extract relevant market research data for a specific pillar.
    Reuses the same relevance scoring as the scorer to ensure consistency."""
    if not market_data:
        return ""
    
    # Robustness: handle cases where market_data might be passed as a string
    import json
    if isinstance(market_data, str):
        try:
            market_data = json.loads(market_data)
        except (json.JSONDecodeError, TypeError):
            return ""

    if not isinstance(market_data, dict):
        return ""

    categories = market_data.get("categories", [])
    if not categories:
        return ""

    from app.services.analysis.analyzer_business_scorer import _score_category_relevance

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
    model_provider: str = "groq",
) -> dict:
    """
    The specialist creates TASKS for their pillar using context-aware generation.
    
    NEW: Uses context-aware generation based on scores and diagnostics.
    FALLBACK: Maintains backward compatibility with original system.
    """
    print(f"DEBUG: generate_specialist_tasks(analysis_id={analysis_id}, pillar_key={pillar_key})", file=sys.stderr)
    
    # Comprehensive normalization (convert all hyphens to underscores)
    pillar_key = pillar_key.replace("-", "_")

    spec = _get_specialist_from_brief(pillar_key, brief)
    if not spec:
        print(f"DEBUG: Specialist not found for {pillar_key}", file=sys.stderr)
        return {"success": False, "error": f"Pilar desconhecido: {pillar_key}"}

    # Try NEW context-aware generation first
    try:
        from app.services.analysis.generator_task_context_aware import generate_context_aware_tasks, has_context_aware_tasks
        
        # Check if we already have context-aware tasks
        if has_context_aware_tasks(analysis_id, pillar_key):
            print(f"  ✅ Context-aware tasks already exist for {pillar_key}", file=sys.stderr)
            plan = db.get_pillar_plan(analysis_id, pillar_key)
            return {"success": True, "plan": plan}
        
        # Load score data for context-aware generation
        analysis_data = db.get_analysis(analysis_id)
        if not analysis_data:
            print(f"  ⚠️ No analysis data found for {pillar_key}, falling back to original method", file=sys.stderr)
            return _fallback_to_original_generation(analysis_id, pillar_key, brief, model_provider, market_data=market_data)
        
        score_data = analysis_data.get("score_data", {})
        discovery_data = analysis_data.get("discovery_data", {})
        analysis_market_data = market_data or analysis_data.get("market_data", {})
        
        if not score_data:
            print(f"  ⚠️ No score data found for {pillar_key}, falling back to original method", file=sys.stderr)
            return _fallback_to_original_generation(analysis_id, pillar_key, brief, model_provider, market_data=analysis_market_data)
        
        # Generate context-aware tasks
        print(f"  🎯 Using context-aware generation for {pillar_key}", file=sys.stderr)
        result = generate_context_aware_tasks(
            analysis_id=analysis_id,
            pillar_key=pillar_key,
            profile=brief,
            score_data=score_data,
            market_data=analysis_market_data,
            discovery_data=discovery_data,
            model_provider=model_provider
        )
        
        if result.get("success"):
            print(f"  ✅ Context-aware generation successful for {pillar_key}", file=sys.stderr)
            return result
        else:
            print(f"  ⚠️ Context-aware generation failed for {pillar_key}: {result.get('error')}", file=sys.stderr)
            return _fallback_to_original_generation(analysis_id, pillar_key, brief, model_provider, market_data=analysis_market_data)
            
    except ImportError as e:
        print(f"  ⚠️ Context-aware module not available for {pillar_key}: {e}", file=sys.stderr)
        return _fallback_to_original_generation(analysis_id, pillar_key, brief, model_provider, market_data=market_data)
    except Exception as e:
        print(f"  ❌ Context-aware generation error for {pillar_key}: {e}", file=sys.stderr)
        return _fallback_to_original_generation(analysis_id, pillar_key, brief, model_provider, market_data=market_data)


def _fallback_to_original_generation(
    analysis_id: str,
    pillar_key: str,
    brief: dict,
    model_provider: str,
    market_data: dict | None = None,
) -> dict:
    """Fallback to original generation method for backward compatibility."""
    print(f"  🔄 Using original generation method for {pillar_key}", file=sys.stderr)
    
    from app.services.analysis.analyzer_business_scorer import DIMENSIONS
    dim_cfg = DIMENSIONS.get(pillar_key, {})
    spec = _get_specialist_from_brief(pillar_key, brief)
    if not spec:
        return {"success": False, "error": f"Especialista desconhecido: {pillar_key}"}

    # Load all diagnostics for cross-pillar context
    all_diags_list = db.get_all_diagnostics(analysis_id)
    all_diagnostics = {d["pillar_key"].replace("-", "_"): d for d in all_diags_list}
    print(f"DEBUG: Found {len(all_diagnostics)} diagnostics for analysis {analysis_id}", file=sys.stderr)
    print(f"DEBUG: Available diagnostics: {list(all_diagnostics.keys())}", file=sys.stderr)
    print(f"DEBUG: Looking for pillar: {pillar_key}", file=sys.stderr)
    
    # Load diagnostic for this pillar
    diagnostic = db.get_pillar_diagnostic(analysis_id, pillar_key)
    print(f"DEBUG: Direct diagnostic lookup result: {diagnostic is not None}", file=sys.stderr)
    
    if not diagnostic:
        print(f"DEBUG: Attempting to find diagnostic with different key formats...", file=sys.stderr)
        # Try different key formats
        alternative_keys = [
            pillar_key,
            pillar_key.replace("_", "-"),
            pillar_key.replace("-", "_")
        ]
        for alt_key in alternative_keys:
            if alt_key in all_diagnostics:
                print(f"DEBUG: Found diagnostic with alternative key: {alt_key}", file=sys.stderr)
                diagnostic = all_diagnostics[alt_key]
                break
        
        if not diagnostic:
            print(f"DEBUG: No diagnostic found for any key format", file=sys.stderr)
            # Last resort: reconstruct from analysis score_data
            analysis_record = db.get_analysis(analysis_id)
            if analysis_record and analysis_record.get("score_data", {}).get("dimensoes", {}).get(pillar_key):
                pd = analysis_record["score_data"]["dimensoes"][pillar_key]
                diagnostic = {
                    "score": pd.get("score", 0),
                    "status": pd.get("status", "unknown"),
                    "justificativa": pd.get("justificativa", ""),
                    "estado_atual": {"justificativa": pd.get("justificativa", ""), "meta_pilar": pd.get("meta_pilar", "")},
                    "gaps": [a.get("acao", str(a)) for a in pd.get("acoes_imediatas", []) if isinstance(a, dict)][:3],
                    "dado_chave": pd.get("dado_chave", ""),
                    "meta_pilar": pd.get("meta_pilar", ""),
                    "acoes_imediatas": pd.get("acoes_imediatas", []),
                }
                # Save it to avoid repeated recovery on next call
                db.save_pillar_diagnostic(analysis_id, pillar_key, diagnostic)
                print(f"DEBUG: Reconstructed diagnostic for {pillar_key} from score_data", file=sys.stderr)
            else:
                return {"success": False, "error": f"Diagnostic not found for pillar {pillar_key}"}

    # ... (rest of the code remains the same)
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
    market_context = _extract_market_for_pillar(pillar_key, market_data or {})
    sources = []
    if market_data:
        for cat in market_data.get("categories", []):
            sources.extend(cat.get("fontes", [])[:2])
        sources = list(dict.fromkeys(sources))  # dedup

    # ── Supplemental RAG: Only search web via unified_research if context is thin ──
    total_context_len = len(market_context) + len(cross_pillar)
    research = ""
    dna = brief.get("dna", {})
    segmento = dna.get("segmento", "")

    pillar_label = dim_cfg.get('label', pillar_key)
    if _should_search_for_task(pillar_label, f"Plano de ação para o pilar de {pillar_label}", market_context + cross_pillar):
        try:
            from app.services.research.unified_research import research_engine
            research_data = research_engine.search_tasks(
                pillar_key=pillar_key,
                score=score,
                diagnostic={"justificativa": diag_text[:200] if 'diag_text' in dir() else ""},
                segmento=segmento,
                force_refresh=False
            )
            research = research_data.get("content", "")
            sources.extend(research_data.get("sources", []))
            print(f"  📦 Smart plan gen via unified_research: {len(research_data.get('sources', []))} sources", file=sys.stderr)
        except Exception as e:
            print(f"  ⚠️ Unified research failed: {e}", file=sys.stderr)
    else:
        print(f"  ✅ Contexto de planejamento rico ({total_context_len} chars: market={len(market_context)}, upstream={len(cross_pillar)}) — sem busca web", file=sys.stderr)

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

COMO {spec['cargo'].upper()}, crie TAREFAS FOCADAS EM CRIAR E PRODUZIR OS ENTREGÁVEIS OBRIGATÓRIOS acima.

⛔ PROIBIÇÃO ABSOLUTA DE TAREFAS DE PESQUISA ⛔
NÃO CRIE tarefas cujo título ou descrição contenha:
- "Pesquisar", "Identificar", "Mapear", "Coletar dados", "Analisar mercado", "Levantar informações", "Explorar", "Investigar"
A IA JÁ FEZ TODA A PESQUISA. Os dados estão nos contextos acima (DADOS DE MERCADO, PESQUISA COMPLEMENTAR).
TODAS as suas tarefas devem ser de CRIAÇÃO e PRODUÇÃO de entregáveis concretos:
✅ "Criar documento de Persona B2B detalhado"
✅ "Escrever Script de Vendas para indústrias"
✅ "Descrever Mapa de Jornada de Compra"
❌ NÃO: "Pesquisar perfil do cliente ideal"
❌ NÃO: "Identificar dores do público"
❌ NÃO: "Mapear concorrentes" (já está nos dados!)

REGRA DE CASCATA: É OBRIGATÓRIO (CRÍTICO) usar os dados fornecidos. Se a Persona, Tom de Voz ou Posicionamento já foram definidos pelos pilares anteriores (upstream), USE esses dados exatos e NÃO INVENTE NADA NOVO que concorra. No entanto, se o seu pilar é o responsável por CRIAR esse dado pela primeira vez (ex: Publico-Alvo criando a Persona), então VOCÊ DEVE INVENTAR E CRIAR o documento profundamente do zero usando a inteligência da pesquisa!

CLASSIFICAÇÃO OBRIGATÓRIA para cada tarefa:
- "executavel_por_ia": true → A IA CONSEGUE FAZER ISSO SOZINHA! (Ex: gerar textos, escrever roteiros, mapear jornadas, descrever personas, criar planos, sugerir ideias, dar dicas técnicas, estruturar scripts). MARQUE COMO TRUE SEMPRE QUE ENVOLVER PENSAMENTO OU ESCRITA.
- "executavel_por_ia": false → O USUÁRIO TEM QUE FAZER ISSO COM AS MÃOS NO MUNDO REAL (Ex: cadastrar em um site, pagar um boleto, criar senha, gravar vídeos, ligar pro cliente, imprimir).

REGRAS:
1. 4-8 tarefas CONCRETAS e SEQUENCIAIS — TODAS dentro do escopo deste pilar
2. Use "Google Docs" para tarefas de documentos, textos, planos e análises (A IA VAI ESCREVER ISSO, marque true)
3. Para tarefas IA: descreva exatamente o entregável (ex: "documento de persona completo")
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
        result = call_llm(
            provider=model_provider,
            prompt=prompt,
            temperature=0.3,
            json_mode=True
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
            result = call_llm(
                provider=model_provider,
                prompt=prompt,
                temperature=0.3,
                json_mode=True,
                prefer_small=True
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

def _format_previous_results(previous_results: list = None, max_chars_per_item: int = 6000) -> str:
    """Format previous subtask results into context for the next subtask."""
    if not previous_results:
        return ""
    
    text = "═══ RESULTADOS EXATOS DAS SUBTAREFAS ANTERIORES ═══\n"
    text += "É OBRIGATÓRIO (CRÍTICO) manter exatamente os mesmos dados descritos abaixo (mesmo nome de persona, mesma idade, mesmos canais). NÃO re-invente coisas que já descrevemos!\n\n"
    
    # Collect titles for anti-repetition summary
    covered_topics = []
    
    for i, pr in enumerate(previous_results):
        if not pr or not isinstance(pr, dict):
            continue
        titulo = pr.get("titulo", pr.get("entregavel_titulo", f"Subtarefa {i+1}"))
        covered_topics.append(titulo)
        conteudo = pr.get("conteudo", "")
        mode = pr.get("execution_mode", "pesquisa")
        mode_label = "🏭 PRODUZIDO" if mode == "producao" else "📚 PESQUISA"
        # Truncate long content to avoid token overflow
        if isinstance(conteudo, dict):
            import json
            conteudo = json.dumps(conteudo, ensure_ascii=False)
        if isinstance(conteudo, str) and len(conteudo) > max_chars_per_item:
            conteudo = conteudo[:max_chars_per_item] + "..."
        text += f"── Subtarefa {i+1} [{mode_label}]: {titulo} ──\n{conteudo}\n\n"
    
    # Add strong anti-repetition block
    if covered_topics:
        text += "\n⛔ REGRA ANTI-REPETIÇÃO (OBRIGATÓRIO):\n"
        text += "As subtarefas anteriores JÁ cobriram os seguintes temas:\n"
        for t in covered_topics:
            text += f"  - {t}\n"
        text += "Você DEVE:\n"
        text += "  1. NÃO repetir análises, dados ou conclusões já apresentadas acima\n"
        text += "  2. REFERENCIAR os resultados anteriores quando relevante (ex: 'conforme identificado na subtarefa 1...')\n"
        text += "  3. COMPLEMENTAR com informações NOVAS e DIFERENTES\n"
        text += "  4. Se precisar citar algo já dito, faça uma referência breve — não copie parágrafos\n"
        text += "═══════════════════════════════════════════════════\n\n"
    
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
    model_provider: str = "groq",
    subtask_index: int = 0,
) -> dict:
    """
    The AI specialist EXECUTES a task — generates the actual deliverable.
    
    This is called when the user approves an AI-executable task.
    The specialist generates the full deliverable (text, strategy, plan, etc.)
    and returns it for user review before marking as complete.
    
    Uses saved market research + targeted RAG search for task-specific details.
    """
    # Check for cancellation at the start
    from app.core import database as db
    from app.core.cancellation_watchdog import CancellationWatchdog
    
    def check_cancelled():
        """Helper function to check if task was cancelled"""
        current_status = db.get_background_task_progress(analysis_id, task_id)
        if current_status and current_status.get("status") == "cancelled":
            print(f"  🛑 CANCELLATION DETECTED for task {task_id}", file=sys.stderr)
            return True
        return False
    
    # Aggressive cancellation check - check every few operations
    def check_cancelled_aggressive():
        """More aggressive cancellation check with immediate return"""
        if check_cancelled():
            raise Exception("Task cancelled by user")
    
    # Ultra-aggressive cancellation check with database polling
    def check_cancelled_ultra():
        """Ultra aggressive cancellation that polls database frequently"""
        current_status = db.get_background_task_progress(analysis_id, task_id)
        if current_status and current_status.get("status") == "cancelled":
            print(f"  🛑 ULTRA CANCELLATION DETECTED for task {task_id}", file=sys.stderr)
            raise Exception("Task cancelled by user")
    
    # Create watchdog for continuous monitoring
    watchdog = CancellationWatchdog(check_cancelled, interval=0.3)
    
    # Check at the very beginning
    if check_cancelled():
        print(f"  🛑 Task {task_id} was cancelled before execution started.", file=sys.stderr)
        return {"success": False, "error": "Task cancelled by user"}
    
    # Start watchdog for continuous monitoring
    watchdog.start()
    print(f"  🐕 Watchdog started for task {task_id}", file=sys.stderr)
    
    try:
        # Removed GROQ_API_KEY check since call_llm handles keys per provider

        spec = _get_specialist_from_brief(pillar_key, brief)
        if not spec:
            return {"success": False, "error": f"Unknown pillar: {pillar_key}"}

        from app.services.analysis.analyzer_business_scorer import DIMENSIONS
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

        # ── Task-specific RAG search via unified_research (cached) ──
        dna = brief.get("dna", {})
        # Fallback: if brief was passed as raw profile (no dna key), try to extract segmento directly
        if not dna:
            # Unwrap nested profile_data: { "profile": { "perfil": {...} } } → { "perfil": {...} }
            _brief_inner = brief
            if "profile" in _brief_inner and "perfil" not in _brief_inner:
                _brief_inner = _brief_inner["profile"]
            perfil = _brief_inner.get("perfil", _brief_inner)
            dna = {
                "segmento": perfil.get("segmento", ""),
                "nome": perfil.get("nome", perfil.get("nome_negocio", "")),
            }
        task_title = task_data.get("titulo", "")
        segmento = dna.get("segmento", "")

        print(f"  🤖 Agent executing: {task_title[:60]}...", file=sys.stderr)
        
        # Check for cancellation before search
        check_cancelled_ultra()
        
        research = ""
        task_sources = []
        intelligence_tools_used = []
        try:
            from app.services.research.unified_research import research_engine
            research_data = research_engine.search_subtasks(
                task_title=task_title,
                task_desc=task_data.get("descricao", ""),
                pillar_key=pillar_key,
                segmento=segmento,
                task_context=task_data,
                force_refresh=False,
                subtask_index=subtask_index
            )
            research = research_data.get("content", "")
            task_sources = research_data.get("sources", [])
            intelligence_tools_used = research_data.get("intelligence_tools_used", [])
            sources.extend(task_sources)
            # Add web_search as tool used (always runs)
            intelligence_tools_used.insert(0, {"tool": "web_search", "status": "success" if task_sources else "no_data", "detail": f"{len(task_sources)} fontes"})
            # Add web_extractor if we got content
            if research:
                intelligence_tools_used.insert(1, {"tool": "web_extractor", "status": "success", "detail": f"{len(research)} chars extraídos"})
            print(f"  📦 Task execute via unified_research: {len(task_sources)} sources | tools: {[t['tool'] for t in intelligence_tools_used]}", file=sys.stderr)
        except Exception as e:
            print(f"  ⚠️ Unified research failed for task exec: {e}", file=sys.stderr)
            intelligence_tools_used.append({"tool": "web_search", "status": "error", "detail": str(e)[:80]})

        # Combine all research with clear structure
        # Finalization tasks get more research context for richer documents
        is_finalization = "finalization" in task_id or "editor_final" in task_data.get("ferramenta", "")
        max_research_chars = 20000 if is_finalization else 10000
        all_research = ""
        if market_context:
            all_research += f"═══ DADOS DE MERCADO DO SETOR ═══\n{market_context}\n\n"
        if research:
            all_research += f"═══ DADOS COLETADOS ═══\n"
            all_research += f"{research[:max_research_chars]}\n"
        if not all_research:
            all_research = "Nenhuma pesquisa web disponível. Baseie-se no contexto do negócio fornecido e na sua expertise do setor.\n"

        entregavel = task_data.get("entregavel_ia", task_data.get("descricao", ""))
        restr = brief.get("restricoes", [])
        restr_text = ""
        if "capital_zero" in restr:
            restr_text += "\n⚠️ Capital ZERO: apenas ferramentas gratuitas."
        if "equipe_solo" in restr:
            restr_text += "\n⚠️ Equipe de 1 pessoa."

        # ════════════════════════════════════════════════════════════════
        # TOOL SYSTEM: Try specialized production tool before generic exec
        # ════════════════════════════════════════════════════════════════
        try:
            from app.services.tools.registry import tool_registry
            from app.services.tools.base import ToolContext, ExecutionMode
            
            exec_mode = tool_registry.classify_execution_mode(task_data)
            
            if exec_mode == ExecutionMode.PRODUCAO:
                tool = tool_registry.match_tool(task_data)
                if tool:
                    print(f"  🏭 PRODUCTION MODE: {tool.name} matched for '{task_title[:50]}'", file=sys.stderr)
                    
                    # Build ToolContext with all available data
                    tool_ctx = ToolContext(
                        analysis_id=analysis_id,
                        pillar_key=pillar_key,
                        task_id=task_id,
                        task_data=task_data,
                        business_profile=brief,
                        specialist=spec,
                        research_content=all_research,
                        previous_results=previous_results or [],
                        market_data=market_data or {},
                        cross_pillar_context=cross_pillar,
                        execution_history=exec_history,
                        restrictions=restr_text,
                        all_diagnostics=all_diagnostics or {},
                        dim_label=dim_cfg.get('label', pillar_key),
                    )
                    
                    # Execute with the matched tool
                    tool_result = tool_registry.execute_with_tool(tool_ctx, model_provider=model_provider)
                    
                    if tool_result and tool_result.success:
                        result = tool_result.to_execution_dict()
                        
                        # Add standard metadata
                        result["task_id"] = task_id
                        result["sources"] = sources
                        result["intelligence_tools_used"] = intelligence_tools_used
                        # Propagate research data so finalization can use it
                        result["_research_context"] = all_research
                        
                        # Save to DB
                        db.save_execution_result(
                            analysis_id, pillar_key, task_id, task_title,
                            status="ai_executed", outcome=result.get("entregavel_titulo", "Entregável produzido"),
                            business_impact=result.get("impacto_estimado", ""),
                            result_data=result
                        )
                        
                        print(f"  ✅ PRODUCTION delivered: {result.get('entregavel_titulo', 'OK')} ({tool.name})", file=sys.stderr)
                        watchdog.stop()
                        return {"success": True, "execution": result}
                    else:
                        print(f"  ⚠️ Tool {tool.name} failed, falling back to generic execution", file=sys.stderr)
            else:
                print(f"  📚 RESEARCH MODE: generic execution for '{task_title[:50]}'", file=sys.stderr)
                        
        except Exception as tool_err:
            print(f"  ⚠️ Tool system error (non-fatal, using generic): {tool_err}", file=sys.stderr)

    # Scope boundaries for execution (generic fallback)
        escopo = spec.get("escopo", "")
        nao_fazer = spec.get("nao_fazer", "")

        # ═══ MELHORIA: Contexto ESPECÍFICO da empresa (dados reais) ═══
        empresa_context = ""
        if dna:
            empresa_context = f"""
═══ DADOS ESPECÍFICOS DA EMPRESA (USE OBRIGATORIAMENTE) ═══
Empresa: {dna.get('nome', 'N/A')}
Segmento: {dna.get('segmento', 'N/A')}
Modelo de Negócio: {dna.get('modelo', 'N/A')}
Localização: {dna.get('localizacao', 'N/A')}
Clientes atuais: {dna.get('tipo_cliente', dna.get('cliente_ideal', 'N/A'))}
Concorrentes DIRETOS (mesmos clientes, mesmo produto): {dna.get('concorrentes', 'N/A')}
Fornecedores (matéria-prima/insumos - NÃO são concorrentes): {dna.get('fornecedores', 'N/A')}
Diferencial declarado: {dna.get('diferencial', 'N/A')}
Ticket Médio: {dna.get('ticket_medio', 'N/A')}
Dificuldade principal: {dna.get('dificuldade_principal', 'N/A')}
Objeção mais comum dos clientes: {dna.get('maior_objecao', 'não informada')}
Capacidade produtiva: {dna.get('capacidade_produtiva', 'N/A')}
Região de atendimento: {dna.get('regiao_atendimento', 'N/A')}

⚠️ CRÍTICO: A persona e análise DEVEM referenciar estes dados reais.
NÃO invente nomes de empresas genéricos. USE os concorrentes e fornecedores acima.
"""

        prompt = f"""{spec['persona']}

Cargo: {spec['cargo']}
Pilar: {dim_cfg.get('label', pillar_key)}

═══ SEU ESCOPO ═══
{escopo}
🚫 PROIBIDO: {nao_fazer}

{empresa_context}

═══ CONTEXTO DO NEGÓCIO ═══
{brief_text}

{cross_pillar}

{exec_history}
{restr_text}

═══ TAREFA ═══
TAREFA: {task_title}
DESCRIÇÃO: {task_data.get('descricao', '')}
ENTREGÁVEL ESPERADO: {entregavel}

{_format_previous_results(previous_results)}

{all_research}

═══ REGRAS ═══
1. Use os dados coletados como base factual. EXTRAIA e CITE: empresas, tendências, números, dores reais.
2. Se os dados estiverem fragmentados ou incompletos, use o que há e complemente com expertise. NÃO INVENTE estatísticas.
3. PROIBIDO comentar sobre qualidade ou formato dos dados. NUNCA escreva "dados corrompidos", "seção incompleta", "não foi possível extrair" etc. Apenas execute a tarefa.
4. USE resultados das subtarefas anteriores. NÃO contradiga o que já foi definido.
5. Ultra-específico para {segmento}. PROIBIDO conteúdo genérico.
6. Se houver informação de CADEIA PRODUTIVA no contexto, RESPEITE: NÃO confunda FORNECEDORES de matéria-prima com CONCORRENTES. Fornecedores são quem vende insumos para o negócio. Concorrentes são empresas que vendem o MESMO tipo de produto/serviço para os MESMOS clientes.
7. O campo "conteudo" DEVE conter o ENTREGÁVEL COMPLETO com MÍNIMO 800 palavras. Inclua: análise detalhada, dados extraídos da pesquisa, recomendações práticas, exemplos concretos do setor. INCORPORE os dados da pesquisa NO CORPO do texto — não apenas mencione que existem, ESCREVA-OS.

EXECUTE a tarefa AGORA. Produza o ENTREGÁVEL COMPLETO, profissional, específico para {segmento} e pronto para uso.
O "conteudo" deve ser um documento EXTENSO e DETALHADO em markdown com seções (##), dados reais, e recomendações acionáveis.

JSON:
{{
    "entregavel_titulo": "Título do entregável",
    "entregavel_tipo": "texto|estrategia|analise|calendario|script|template|plano",
    "opiniao": "Seu pensamento analítico sobre os dados e o entregável produzido. Tom conversacional natural. CITE SEMPRE dados concretos da pesquisa (empresas, números, tendências reais encontradas). Mínimo 4 linhas. ⛔ ABSOLUTAMENTE PROIBIDO: NÃO escreva NADA sobre qualidade, formato ou ausência de dados ('corrompidos', 'incompletos', 'seção inválida', 'não foi possível extrair', 'baseio-me em minha expertise', 'dados insuficientes'). Se os dados estão fragmentados, use-os e complemente com análise — sem citar essa limitação.",
    "conteudo": "O ENTREGÁVEL COMPLETO em markdown (##seções). MÍNIMO 800 palavras. INCORPORE todos os dados da pesquisa: nomes de empresas, números, tendências, análises. Documento profissional pronto para uso.",
    "como_aplicar": "Instruções de como aplicar este entregável",
    "proximos_passos": "Próximos passos após aplicar",
    "fontes_consultadas": ["urls das fontes reais usadas"],
    "impacto_estimado": "Impacto esperado no negócio"
}}

Retorne APENAS o JSON."""

        try:
            # DEBUG: Log prompt length and research size
            print(f"  📝 Prompt length: {len(prompt)} chars | Research length: {len(all_research)} chars", file=sys.stderr)
            print(f"  📄 Research preview: {all_research[:300]}...", file=sys.stderr)
            
            # Check for cancellation before LLM call
            check_cancelled_ultra()
            watchdog.check_or_raise()  # Verificação adicional do watchdog
            
            result = call_llm(
                provider=model_provider,
                prompt=prompt,
                temperature=0.4,
                json_mode=True
            )
            
            # Handle raw_response fallback (when JSON constraint was relaxed by LLM router)
            if isinstance(result, dict) and "raw_response" in result and not result.get("conteudo"):
                result["conteudo"] = result["raw_response"][:8000]
                result.setdefault("entregavel_titulo", "Resultado gerado")
                result.setdefault("entregavel_tipo", "documento")
            
            # Validate result has minimum required content
            content = result.get("conteudo", "")
            # Normalize content early: LLM sometimes returns dict/list instead of string
            if isinstance(content, dict):
                import json as _json
                content = _json.dumps(content, ensure_ascii=False)
                result["conteudo"] = content
            elif isinstance(content, list):
                content = "\n".join(str(i) for i in content)
                result["conteudo"] = content
            elif not isinstance(content, str):
                content = str(content) if content else ""
                result["conteudo"] = content
            
            content_len = len(content)
            print(f"  📤 Generated content length: {content_len} chars", file=sys.stderr)
            
            # Determine minimum acceptable content length based on task type
            task_tipo = task_data.get("tipo", "").lower()
            has_ferramenta = bool(task_data.get("ferramenta", "").strip())
            is_production_task = task_tipo == "producao" or has_ferramenta or "finalization" in task_id
            min_content_len = 1500 if is_production_task else 300
            
            if content_len < min_content_len:
                print(f"  ⚠️ Content too short ({content_len} chars)! Retrying with explicit length requirement...", file=sys.stderr)
                
                # Check for cancellation before retry
                check_cancelled_ultra()
                
                # Retry with explicit length requirement prepended
                retry_prompt = prompt + "\n\n⚠️ ATENÇÃO: Sua resposta anterior tinha apenas " + str(content_len) + " caracteres. ISSO É INACEITÁVEL. O campo 'conteudo' DEVE ter MÍNIMO 800 palavras com dados reais da pesquisa. Reescreva AGORA com o documento COMPLETO."
                
                # Try with fallback model (don't use prefer_small — it's too weak for complex JSON)
                result = call_llm(
                    provider=model_provider,
                    prompt=retry_prompt,
                    temperature=0.3,
                    json_mode=True,
                    prefer_small=False
                )
                # Handle raw_response on retry too
                if isinstance(result, dict) and "raw_response" in result and not result.get("conteudo"):
                    result["conteudo"] = result["raw_response"][:8000]
                    result.setdefault("entregavel_titulo", "Resultado gerado")
                content = result.get("conteudo", "")
                if isinstance(content, dict):
                    import json as _json
                    content = _json.dumps(content, ensure_ascii=False)
                    result["conteudo"] = content
                elif isinstance(content, list):
                    content = "\n".join(str(i) for i in content)
                    result["conteudo"] = content
                elif not isinstance(content, str):
                    content = str(content) if content else ""
                    result["conteudo"] = content
                content_len = len(content)
                print(f"  📤 Fallback content length: {content_len} chars", file=sys.stderr)
            
            if content_len < 200:
                # Ensure content is string before slicing
                content_str = str(content) if content is not None else ""
                print(f"  ⚠️ Content seems short! Preview: {content_str[:200]}", file=sys.stderr)

            # Normalizar campos de texto: o LLM às vezes retorna dicts aninhados
            # em vez de strings — convertemos tudo pra garantir serialização correta.
            def _to_str(v):
                if v is None:
                    return ""
                if isinstance(v, str):
                    return v
                if isinstance(v, dict):
                    import json as _json
                    return _json.dumps(v, ensure_ascii=False)
                if isinstance(v, list):
                    return "\n".join(str(i) for i in v)
                return str(v)

            for _field in ("conteudo", "opiniao", "como_aplicar", "proximos_passos",
                           "entregavel_titulo", "entregavel_tipo", "impacto_estimado"):
                if _field in result:
                    result[_field] = _to_str(result[_field])

            # Normalizar fontes_consultadas: garante lista de strings
            if "fontes_consultadas" in result:
                raw_fontes = result["fontes_consultadas"]
                if isinstance(raw_fontes, list):
                    result["fontes_consultadas"] = [
                        f.get("url", f.get("link", str(f))) if isinstance(f, dict) else str(f)
                        for f in raw_fontes if f
                    ]
                elif raw_fontes:
                    result["fontes_consultadas"] = [str(raw_fontes)]
                else:
                    result["fontes_consultadas"] = []

            # Mark as PESQUISA (research/instructional) — PRODUCAO is already set by tool system
            if "execution_mode" not in result:
                result["execution_mode"] = "pesquisa"

            # Add required metadata
            result["task_id"] = task_id
            result["sources"] = sources
            result["intelligence_tools_used"] = intelligence_tools_used
            # Propagate research data so finalization can use it
            result["_research_context"] = all_research

            # Auto-record as executed (pending user confirmation)
            db.save_execution_result(
                analysis_id, pillar_key, task_id, task_title,
                status="ai_executed", outcome=result.get("entregavel_titulo", "Entregável gerado"),
                business_impact=result.get("impacto_estimado", ""),
                result_data=result
            )

            print(f"  ✅ Agent delivered: {result.get('entregavel_titulo', 'OK')}", file=sys.stderr)
            return {"success": True, "execution": result}

        except Exception as e:
            error_msg = str(e)
            print(f"  ❌ Agent execution error: {e}", file=sys.stderr)
            
            # Check for cancellation exception
            if "Task cancelled by user" in error_msg:
                print(f"  🛑 Task {task_id} was cancelled during execution.", file=sys.stderr)
                return {"success": False, "error": "Task cancelled by user"}
            
            # Check for rate limit errors
            if any(keyword in error_msg.lower() for keyword in ['rate limit', 'tpd', '429', 'limit exceeded', 'quota']):
                return {
                    "success": False, 
                    "error": f"Rate limit atingido. Tente outro modelo: {error_msg[:200]}"
                }
            
            try:
                result = call_llm(
                    provider=model_provider,
                    prompt=prompt,
                    temperature=0.4,
                    json_mode=True,
                    prefer_small=True
                )
                result["task_id"] = task_id
                result["sources"] = sources
                db.save_execution_result(
                    analysis_id, pillar_key, task_id, task_title,
                    status="ai_executed", outcome=result.get("entregavel_titulo", "Entregável gerado"),
                    business_impact=result.get("impacto_estimado", ""),
                    result_data=result
                )
                return {"success": True, "execution": result}
            except Exception as e2:
                return {"success": False, "error": f"Erro na execução: {str(e2)[:200]}"}
    
    except Exception as e:
        # Handle any errors from the outer try block
        print(f"  ❌ Outer execution error: {e}", file=sys.stderr)
        return {"success": False, "error": f"Erro geral na execução: {str(e)[:200]}"}
    
    finally:
        # Always stop the watchdog
        watchdog.stop()
        print(f"  🐕 Watchdog stopped for task {task_id}", file=sys.stderr)


def get_all_pillars_state(analysis_id: str) -> dict:
    """Get the state of ALL 7 pillars at once — for the unified dashboard."""
    from app.services.analysis.analyzer_business_scorer import DIMENSIONS, DIMENSION_ORDER

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
    model_provider: str = "groq",
) -> dict:
    """
    Break a single task into 3-6 concrete subtasks.
    Each subtask is small enough for the AI to execute in one shot.
    This is the 'macro plan' concept applied at task level.
    
    NEW: Uses unified_research for intelligent subtask research.
    """
    spec = SPECIALISTS.get(pillar_key)
    if not spec:
        return {"success": False, "error": f"Unknown pillar: {pillar_key}"}

    from app.services.analysis.analyzer_business_scorer import DIMENSIONS
    dim_cfg = DIMENSIONS.get(pillar_key, {})

    # Load market data from DB if not passed
    if not market_data:
        market_data = db.get_analysis_market_data(analysis_id)

    # Extract segmento with fallback for raw profile data
    _dna = brief.get("dna", {})
    if not _dna:
        # Unwrap nested profile_data: { "profile": { "perfil": {...} } } → { "perfil": {...} }
        _brief_unwrapped = brief
        if "profile" in _brief_unwrapped and "perfil" not in _brief_unwrapped:
            _brief_unwrapped = _brief_unwrapped["profile"]
        _perfil = _brief_unwrapped.get("perfil", _brief_unwrapped)
        _dna = {"segmento": _perfil.get("segmento", ""), "nome": _perfil.get("nome", _perfil.get("nome_negocio", ""))}
    _segmento = _dna.get("segmento", "")

    # ── Load sibling tasks from the pillar plan to avoid overlap ──
    sibling_tasks_text = ""
    try:
        plan = db.get_pillar_plan(analysis_id, pillar_key)
        if plan and plan.get("plan_data"):
            plan_data = plan["plan_data"]
            # plan_data may be nested: { "tarefas": [...] } or { pillar_key: { "tarefas": [...] } }
            tarefas = plan_data.get("tarefas", [])
            if not tarefas and isinstance(plan_data, dict):
                for v in plan_data.values():
                    if isinstance(v, dict) and "tarefas" in v:
                        tarefas = v["tarefas"]
                        break
                    elif isinstance(v, list):
                        tarefas = v
                        break
            
            current_id = task_data.get("id", "")
            siblings = []
            current_idx = 0
            for idx, t in enumerate(tarefas, 1):
                t_id = t.get("id", "")
                t_titulo = t.get("titulo", "")
                if t_id == current_id or t_titulo == task_data.get("titulo", ""):
                    current_idx = idx
                else:
                    siblings.append(f"  #{idx}: {t_titulo}")
            
            if siblings:
                sibling_tasks_text = f"""
═══ OUTRAS TAREFAS DO PILAR (JÁ EXISTEM — NÃO REPITA) ═══
Esta é a tarefa #{current_idx} de {len(tarefas)} neste pilar.
As outras tarefas são:
""" + "\n".join(siblings) + """

⚠️ REGRA ANTI-SOBREPOSIÇÃO (CRÍTICO):
As tarefas acima serão executadas SEPARADAMENTE. Suas subtarefas NÃO DEVEM:
- Repetir o escopo das tarefas acima (cada tarefa cuida do SEU tema)
- Criar personas se outra tarefa já é "Criar personas"
- Analisar concorrentes se outra tarefa já é "Analisar concorrentes"
- Pesquisar perfil se outra tarefa já é "Pesquisar perfil"
FOQUE EXCLUSIVAMENTE no escopo desta tarefa: "{task_data.get('titulo', '')}".
"""
    except Exception as e:
        print(f"  ⚠️ Could not load sibling tasks: {e}", file=sys.stderr)

    # Use unified research ONLY — no duplicate fallback searches
    try:
        from app.services.research.unified_research import research_engine
        
        research_data = research_engine.search_subtasks(
            task_title=task_data.get("titulo", ""),
            task_desc=task_data.get("descricao", ""),
            pillar_key=pillar_key,
            segmento=_segmento,
            task_context=task_data,
            force_refresh=False,
            subtask_index=0
        )
        
        research_text = research_data.get("content", "")
        research_sources = research_data.get("sources", [])
        
        print(f"  📦 Subtask expansion via unified_research: {len(research_sources)} sources", file=sys.stderr)
        
    except Exception as e:
        print(f"  ⚠️ Unified research failed for subtasks: {e}", file=sys.stderr)
        research_text = ""
        research_sources = []

    brief_text = brief_to_text(brief)
    exec_history = build_execution_context(analysis_id, pillar_key)

    task_title = task_data.get("titulo", "")
    task_desc = task_data.get("descricao", "")
    is_ai = task_data.get("executavel_por_ia", True)

    # Primary: saved market research
    market_context = _extract_market_for_pillar(pillar_key, market_data)
    sources = list(research_sources)  # Start with unified_research sources

    # Combine all research — no additional web search needed
    all_research = ""
    if market_context:
        all_research += f"DADOS DE MERCADO:\n{market_context}\n\n"
    if research_text:
        all_research += f"PESQUISA ESPECIALIZADA:\n{research_text[:3000]}\n"
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

{sibling_tasks_text}

TAREFA PRINCIPAL: {task_title}
DESCRIÇÃO: {task_desc}
ENTREGÁVEL FINAL: {task_data.get('entregavel_ia', 'N/A')}

{all_research}

═══ QUEBRE ESTA TAREFA EM 3-6 SUBTAREFAS EXECUTÁVEIS ═══

⛔ REGRA CRÍTICA DE DIFERENCIAÇÃO — CADA SUBTAREFA PRODUZ ENTREGÁVEL ÚNICO:
Cada subtarefa DEVE produzir um documento/artefato DIFERENTE. NÃO repita conteúdo entre subtarefas!

📋 DISTRIBUIÇÃO OBRIGATÓRIA DE CONTEÚDO:
- Subtarefa 1 (PESQUISA): Coleta APENAS dados brutos (números, estatísticas, nomes de empresas, fontes)
- Subtarefa 2 (ANÁLISE): INTERPRETAÇÃO dos dados (tendências, padrões, insights) — NÃO repita os dados brutos
- Subtarefa 3 (PERSONA/PERFIL): Documento de persona COMPLETO (nome fictício, cargo, dores, desejos, jornada)
- Subtarefa 4 (RECOMENDAÇÕES): APENAS ações práticas e estratégicas — NÃO repita análises ou personas
- Subtarefa FINAL: Consolidação em documento profissional ÚNICO integrando tudo

⚠️ VALIDAÇÃO ANTI-REPETIÇÃO:
Antes de criar cada subtarefa, pergunte: "Isso já foi coberto por outra subtarefa?"
→ SIM → Remova ou reformule com escopo DIFERENTE
→ NÃO → Inclua

PRINCÍPIO FUNDAMENTAL — TESTE DE FACTIBILIDADE:
Antes de incluir qualquer subtarefa, pergunte: "A IA consegue executar isso com dados da web + perfil do negócio?"
→ SIM → inclua como subtarefa
→ NÃO → remova. Não existe essa subtarefa.

DOIS TIPOS DE SUBTAREFA (use ambos, nesta proporção):

📚 TIPO PESQUISA (máximo 2 subtarefas):
- A IA faz busca web real e extrai dados concretos do setor
- Produz análise/insights baseada no que foi encontrado na internet
- Exemplos VÁLIDOS: "Pesquisar perfil e comportamento de compradores de {_segmento}", "Analisar concorrentes de {_segmento} com dados reais", "Levantar benchmarks e tendências do mercado de {_segmento}"
- Exemplos INVÁLIDOS (⛔ PROIBIDO ABSOLUTO): "Realizar pesquisa com clientes" (requer humanos reais), "Coletar respostas do formulário" (impossível — exige ação humana), "Analisar dados coletados" sem dados reais, "Aplicar questionário com participantes", "Aguardar respostas dos clientes", "Enviar pesquisa e coletar feedback", "Tabular respostas recebidas"
⚠️ REGRA ESPECIAL: Se a tarefa-pai envolve 'entender necessidades/dores dos clientes via pesquisa', a subtarefa PESQUISA deve ser: buscar estudos setoriais, artigos, LinkedIn, fóruns do setor que JÁ revelam essas necessidades — NÃO criar a etapa de aplicação/coleta que exige clientes reais.

🏭 TIPO PRODUCAO (mínimo 2 subtarefas, máximo 4):
- A IA cria um artefato REAL e COMPLETO usando os dados da pesquisa
- Cada subtarefa produz algo utilizável imediatamente
- Exemplos: "Criar Persona detalhada de {_segmento}", "Elaborar formulário de pesquisa", "Criar relatório de análise de mercado", "Escrever script de vendas", "Montar plano de ação"

REGRAS OBRIGATÓRIAS:
1. ANTI-SOBREPOSIÇÃO (PRIORIDADE MÁXIMA): NÃO crie subtarefas que repetem o trabalho das OUTRAS TAREFAS do pilar listadas acima. Cada tarefa tem seu escopo ÚNICO. Se outra tarefa já "Cria Persona", você NÃO cria persona. Se outra já "Pesquisa perfil", você NÃO pesquisa perfil.
2. CASCATA: Use personas, tom de voz e estratégias já definidos pelos pilares anteriores.
3. ENTREGÁVEL FINAL: A última subtarefa DEVE criar o artefato final: "{task_data.get('entregavel_ia', 'entregável da tarefa')}".
4. SEQUÊNCIA LÓGICA: subtarefas PESQUISA primeiro, subtarefas PRODUCAO depois.

JSON OBRIGATÓRIO:
{{
    "task_id": "{task_data.get('id', '')}",
    "titulo_tarefa": "{task_title}",
    "subtarefas": [
        {{
            "id": "st1",
            "titulo": "Nome concreto e específico da subtarefa",
            "descricao": "Exatamente o que será feito, com detalhes do setor",
            "tipo": "pesquisa",
            "executavel_por_ia": true,
            "entregavel_ia": "O que a IA vai produzir (ex: análise de perfil de compradores de {_segmento})",
            "ferramenta": "nome_ferramenta_se_houver",
            "tempo_estimado": "30min"
        }},
        {{
            "id": "st2",
            "titulo": "Nome do artefato a ser criado",
            "descricao": "O que o artefato conterá, usando os dados da pesquisa anterior",
            "tipo": "producao",
            "executavel_por_ia": true,
            "entregavel_ia": "Artefato completo pronto para usar (ex: Formulário de Pesquisa de Satisfação)",
            "ferramenta": "formulario|documento|planilha|analise|estrategia|conteudo",
            "tempo_estimado": "1h"
        }}
    ],
    "ordem_execucao": "Pesquisa web primeiro → produção de artefatos com base nos dados",
    "resultado_combinado": "O que teremos ao completar todas as subtarefas"
}}

VALORES VÁLIDOS para o campo "ferramenta":
- "formulario" → pesquisas, questionários, surveys
- "documento" → relatórios, personas, planos, guias
- "planilha" → tabelas, comparativos, métricas, cronogramas
- "analise" → análises de mercado, SWOT, benchmarks, diagnósticos
- "estrategia" → planos de ação, estratégias, roadmaps
- "conteudo" → posts, emails, scripts, copy, calendários
- "" → (vazio) se não se enquadra em nenhum

Retorne APENAS o JSON."""

    try:
        from app.core.llm_router import call_llm
        result = call_llm(
            provider=model_provider,
            prompt=prompt,
            temperature=0.3,
            json_mode=True
        )
        result["sources"] = sources
        
        # Annotate each subtask with its execution mode (pesquisa vs producao)
        # so the frontend can show appropriate badges and the engine can route correctly
        try:
            from app.services.tools.registry import tool_registry
            for st in result.get("subtarefas", []):
                mode = tool_registry.classify_execution_mode(st)
                st["modo_execucao"] = mode.value
        except Exception:
            pass  # Non-critical
        
        return {"success": True, "subtasks": result}
    except Exception as e:
        print(f"  ❌ Subtask expansion error: {e}", file=sys.stderr)
        return {"success": False, "error": f"Erro ao expandir subtarefas: {str(e)[:200]}"}


def ai_try_user_task(
    analysis_id: str,
    pillar_key: str,
    task_id: str,
    task_data: dict,
    brief: dict,
    all_diagnostics: dict = None,
    market_data: dict = None,
    model_provider: str = "groq",
) -> dict:
    """
    AI attempts a task that was classified as user-required.
    It generates the best possible deliverable it CAN produce,
    clearly stating what the user still needs to do manually.
    """
    spec = SPECIALISTS.get(pillar_key)
    if not spec:
        return {"success": False, "error": f"Unknown pillar: {pillar_key}"}

    from app.services.analysis.analyzer_business_scorer import DIMENSIONS
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

    # Smart task-specific RAG search via unified_research
    dna = brief.get("dna", {})
    segmento = dna.get("segmento", "")
    
    research = ""
    try:
        from app.services.research.unified_research import research_engine
        research_data = research_engine.search_subtasks(
            task_title=task_title,
            task_desc=task_desc,
            pillar_key=pillar_key,
            segmento=segmento,
            task_context=task_data,
            force_refresh=False,
            subtask_index=0
        )
        research = research_data.get("content", "")
        sources.extend(research_data.get("sources", []))
        print(f"  📦 AI user task via unified_research: {len(research_data.get('sources', []))} sources", file=sys.stderr)
    except Exception as e:
        print(f"  ⚠️ Unified research failed for AI user task: {e}", file=sys.stderr)

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
    "opiniao": "Seu pensamento analítico sobre o que foi extraído/gerado. Tom conversacional e pessoal. CITE dados concretos encontrados. Mínimo 4 linhas. ⛔ NUNCA comente sobre qualidade dos dados ('corrompidos', 'incompletos', 'não foi possível extrair'). Se incompletos, use-os e complemente — sem mencionar a limitação.",
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
        # DEBUG: Log prompt length and research size
        print(f"  📝 AI Try Prompt length: {len(prompt)} chars | Research length: {len(all_research)} chars", file=sys.stderr)
        print(f"  📄 AI Try Research preview: {all_research[:300]}...", file=sys.stderr)
        from app.core.llm_router import call_llm
        result = call_llm(
            provider=model_provider,
            prompt=prompt,
            temperature=0.4,
            json_mode=True
        )
        result["task_id"] = task_id
        result["sources"] = sources
        result["was_user_task"] = True

        # DEBUG: Log generated content length
        content = result.get("conteudo", "")
        content_len = len(content)
        print(f"  📤 AI Try Generated content length: {content_len} chars", file=sys.stderr)
        if content_len < 200:
            # Ensure content is string before slicing
            content_str = str(content) if content is not None else ""
            print(f"  ⚠️ AI Try Content seems short! Preview: {content_str[:200]}", file=sys.stderr)

        db.save_execution_result(
            analysis_id, pillar_key, task_id, task_title,
            status="ai_partial", outcome=result.get("entregavel_titulo", "IA tentou executar"),
            business_impact=result.get("impacto_estimado", ""),
            result_data=result
        )

        # Also save to specialist_executions for full content
        db.save_execution_result(
            analysis_id, pillar_key, task_id, task_title,
            status="ai_partial", outcome=result.get("entregavel_titulo", "IA tentou executar"),
            business_impact=result.get("impacto_estimado", ""),
            result_data=result
        )

        return {"success": True, "execution": result}

    except Exception as e:
        print(f"  ❌ AI try user task error: {e}", file=sys.stderr)
        return {"success": False, "error": f"Erro: {str(e)[:200]}"}
