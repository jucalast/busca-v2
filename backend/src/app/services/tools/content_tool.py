"""
ContentTool — Produces ready-to-publish marketing content.

Social media posts, email campaigns, ad copy, blog posts, landing page text.
The LLM writes the FINAL copy, not "tips on how to write good copy".
"""
from __future__ import annotations
import json
from app.services.tools.base import (
    ToolPlugin, ToolContext, ToolResult, ArtifactType,
    PRODUCTION_PREAMBLE, ANTI_GENERIC_RULES, CASCADE_RULES,
)


class ContentTool(ToolPlugin):
    name = "content_tool"
    description = "Produces ready-to-publish marketing content (posts, emails, ads, copies)"
    artifact_types = [ArtifactType.CONTEUDO, ArtifactType.SCRIPT]
    
    match_keywords = [
        "conteúdo", "post", "publicação", "email", "e-mail",
        "copy", "copywriting", "anúncio", "ad", "landing page",
        "blog", "artigo", "newsletter", "texto", "redação",
        "campanha", "mensagem", "whatsapp", "instagram",
        "facebook", "linkedin", "tiktok", "youtube",
        "script", "roteiro", "pitch", "abordagem",
        "headline", "cta", "call to action", "legenda",
    ]
    match_ferramentas = [
        "conteudo",
        "copywriting", "conteudo", "email_marketing", "social_media",
        "anuncios", "redacao", "script_vendas", "script_abordagem",
        "plano_conteudo",
    ]
    
    def match_score(self, task_data: dict) -> float:
        base = self._keyword_match_score(task_data)
        title = task_data.get("titulo", "").lower()
        if any(kw in title for kw in ["criar conteúdo", "escrever", "redigir",
                                       "criar post", "criar email", "criar anúncio",
                                       "criar script", "script de"]):
            base = max(base, 0.85)
        return base
    
    def _get_export_formats(self):
        return ["google_docs"]
    
    def build_production_prompt(self, ctx: ToolContext) -> str:
        context_block = self._build_context_block(ctx)
        task = ctx.task_data
        title = task.get("titulo", "")
        desc = task.get("descricao", "")
        entregavel = task.get("entregavel_ia", task.get("entregavel", desc))
        
        return f"""{context_block}

{PRODUCTION_PREAMBLE}

═══ TAREFA DE PRODUÇÃO: CRIAR CONTEÚDO/COPY ═══
TAREFA: {title}
DESCRIÇÃO: {desc}
ENTREGÁVEL: {entregavel}

{ANTI_GENERIC_RULES}
{CASCADE_RULES}

INSTRUÇÕES DE PRODUÇÃO — CONTEÚDO DE MARKETING:
Você é um COPYWRITER SÊNIOR executando esta tarefa AGORA.
NÃO explique "como escrever bons posts". ESCREVA os posts.

PRODUZA o conteúdo FINAL e PUBLICÁVEL:

Se for POSTS para redes sociais:
- Crie CADA POST completo com texto, hashtags, CTA
- Adapte o tom para cada plataforma (Instagram vs LinkedIn vs TikTok)
- Inclua sugestão de visual/imagem para cada post
- Mínimo 6 posts variados

Se for EMAILS/NEWSLETTER:
- Assunto que gera abertura (teste A/B com 2 opções)
- Corpo completo com personalização, storytelling
- CTA claro e urgente
- Sequência de follow-up (2-3 emails)

Se for ANÚNCIOS:
- Headlines (3 variações A/B)
- Descrições (3 variações)
- CTAs específicos
- Público-alvo detalhado para configuração
- Sugestões de criativo/imagem

Se for SCRIPT DE VENDAS:
- Script PALAVRA POR PALAVRA
- Abertura, desenvolvimento, objeções, fechamento
- Variações para cada objeção comum
- Tom de voz alinhado à marca

Se for LANDING PAGE:
- Headline poderosa
- Sub-headline
- Seções de benefícios, prova social, FAQ
- CTA principal e secundário
- Textos completos para cada bloco

Use SEMPRE a persona, tom de voz e posicionamento já definidos upstream.

JSON OBRIGATÓRIO:
{{
    "entregavel_titulo": "Título do pacote de conteúdo",
    "entregavel_tipo": "conteudo",
    "opiniao": "Sua análise pessoal sobre o conteúdo criado (tom conversacional, min 4 linhas)",
    "conteudo": "TODO O CONTEÚDO PRODUZIDO — formatado e pronto para publicar. Com separadores claros entre cada peça.",
    "structured_data": {{
        "tipo_conteudo": "posts_social|email_sequence|anuncios|script|landing_page|misto",
        "plataformas": ["instagram", "linkedin", "email"],
        "pecas": [
            {{
                "id": "p1",
                "tipo": "post|email|anuncio|script|pagina",
                "plataforma": "instagram",
                "titulo": "Título/Assunto",
                "conteudo_completo": "O texto completo da peça",
                "cta": "Call to action",
                "hashtags": ["#tag1", "#tag2"],
                "sugestao_visual": "Descrição da imagem/criativo sugerido",
                "tom": "profissional|casual|urgente|inspirador"
            }}
        ],
        "total_pecas": 6,
        "tom_geral": "Profissional e acessível",
        "persona_alvo": "Nome da persona-alvo"
    }},
    "como_aplicar": "Cronograma de publicação e como usar cada peça",
    "proximos_passos": "O que fazer depois de publicar",
    "fontes_consultadas": ["urls"],
    "impacto_estimado": "Impacto esperado"
}}

REGRAS:
- Mínimo 4 peças de conteúdo se for posts/emails
- Script deve ter mínimo 500 palavras
- Cada peça deve ser COMPLETA e PUBLICÁVEL sem edição
- Use a voz da marca já definida (não invente uma nova)
- Inclua dados/números específicos do negócio

Retorne APENAS o JSON."""
    
    def post_process(self, llm_result: dict, ctx: ToolContext) -> ToolResult:
        structured = llm_result.get("structured_data", {})
        if isinstance(structured, str):
            try:
                structured = json.loads(structured)
            except (json.JSONDecodeError, TypeError):
                structured = {}
        
        # Count total pieces
        pecas = structured.get("pecas", [])
        structured["total_pecas"] = len(pecas)
        
        # Detect artifact type
        artifact = ArtifactType.CONTEUDO
        if any(p.get("tipo") == "script" for p in pecas):
            artifact = ArtifactType.SCRIPT
        
        return ToolResult(
            success=True,
            artifact_type=artifact,
            content=llm_result.get("conteudo", ""),
            structured_data=structured,
            export_formats=self._get_export_formats(),
            opiniao=llm_result.get("opiniao", ""),
            como_aplicar=llm_result.get("como_aplicar", ""),
            proximos_passos=llm_result.get("proximos_passos", ""),
            fontes_consultadas=llm_result.get("fontes_consultadas", []),
            impacto_estimado=llm_result.get("impacto_estimado", ""),
            entregavel_titulo=llm_result.get("entregavel_titulo", ""),
            entregavel_tipo="conteudo",
        )
