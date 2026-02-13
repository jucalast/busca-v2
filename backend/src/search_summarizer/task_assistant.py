"""
Task Assistant — Provides AI-powered execution support for individual tasks.
Generates contextual content (copy, scripts, lead lists, etc.) based on task + business profile.
"""

import json
import os
import sys
import time
from groq import Groq
from dotenv import load_dotenv

load_dotenv()


def call_groq(api_key: str, prompt: str, temperature: float = 0.4, max_retries: int = 3) -> dict:
    """Generic Groq API call with retry + exponential backoff + model fallback."""
    client = Groq(api_key=api_key)
    models = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]

    for model in models:
        for attempt in range(max_retries):
            try:
                completion = client.chat.completions.create(
                    messages=[{"role": "user", "content": prompt}],
                    model=model,
                    temperature=temperature,
                    response_format={"type": "json_object"},
                )
                if model != models[0]:
                    print(f"  ⚡ Usando modelo fallback: {model}", file=sys.stderr)
                return json.loads(completion.choices[0].message.content)
            except Exception as e:
                error_msg = str(e)
                if "429" in error_msg and attempt < max_retries - 1:
                    wait_time = (attempt + 1) * 3
                    print(f"  ⏳ Rate limit ({model}). Aguardando {wait_time}s... ({attempt+1}/{max_retries})", file=sys.stderr)
                    time.sleep(wait_time)
                    continue
                elif "429" in error_msg and model != models[-1]:
                    print(f"  🔄 Rate limit esgotado em {model}. Tentando modelo menor...", file=sys.stderr)
                    break
                raise


# ─────────────────────────────────────────────
# Assist type prompts
# ─────────────────────────────────────────────

ASSIST_PROMPTS = {
    "copywriting": """Você é um copywriter especialista em {segmento} no Brasil.

TAREFA: {titulo}
CONTEXTO DO NEGÓCIO: {perfil_resumo}
DADOS DE MERCADO: {dados_suporte}

Gere textos prontos para uso baseados nos dados reais. Retorne JSON:
{{
    "tipo": "copywriting",
    "entregas": [
        {{
            "titulo": "nome do texto (ex: Post Instagram, Landing Page, Email)",
            "conteudo": "texto completo pronto para copiar e usar",
            "onde_usar": "onde publicar/enviar",
            "dicas": "dica de como maximizar resultados"
        }}
    ],
    "estrategia": "por que esses textos vão funcionar para este negócio"
}}""",

    "analise_concorrente": """Você é um analista de inteligência competitiva B2B.

TAREFA: {titulo}
NEGÓCIO DO CLIENTE: {perfil_resumo}
DADOS DE MERCADO/CONCORRÊNCIA: {dados_suporte}

Faça uma análise detalhada dos concorrentes identificados. Retorne JSON:
{{
    "tipo": "analise_concorrente",
    "concorrentes": [
        {{
            "nome": "nome do concorrente",
            "pontos_fortes": ["força 1", "força 2"],
            "pontos_fracos": ["fraqueza 1", "fraqueza 2"],
            "como_superar": "estratégia específica para superá-lo",
            "diferencial_explorar": "gap que o cliente pode explorar"
        }}
    ],
    "posicionamento_recomendado": "como o cliente deve se posicionar vs concorrentes",
    "acoes_imediatas": ["ação 1", "ação 2"]
}}""",

    "lista_leads": """Você é um especialista em prospecção B2B no Brasil.

TAREFA: {titulo}
NEGÓCIO: {perfil_resumo}
DADOS DE MERCADO: {dados_suporte}

Gere uma lista de perfis de empresas prospectáveis. Retorne JSON:
{{
    "tipo": "lista_leads",
    "perfil_ideal_cliente": {{
        "segmentos": ["segmento que compra do cliente"],
        "porte": "micro / pequena / média / grande",
        "localizacao": "região ideal",
        "sinais_compra": ["indicativo de que a empresa precisa do produto"]
    }},
    "onde_encontrar": [
        {{
            "canal": "nome do canal ou plataforma",
            "como_buscar": "passo a passo para encontrar leads",
            "filtros_sugeridos": "filtros a usar na busca"
        }}
    ],
    "exemplos_abordagem": [
        {{
            "canal": "LinkedIn / Email / Telefone",
            "mensagem": "texto de abordagem pronto para usar"
        }}
    ],
    "meta_semanal": "quantos leads prospectar por semana"
}}""",

    "script_abordagem": """Você é um especialista em vendas consultivas B2B.

TAREFA: {titulo}
NEGÓCIO: {perfil_resumo}
DADOS: {dados_suporte}

Crie scripts de abordagem prontos para uso. Retorne JSON:
{{
    "tipo": "script_abordagem",
    "scripts": [
        {{
            "canal": "Cold Call / Email / LinkedIn / WhatsApp",
            "objetivo": "o que se espera desta abordagem",
            "script": "texto completo do script com [variáveis] a preencher",
            "objecoes_comuns": [
                {{
                    "objecao": "o que o prospect pode dizer",
                    "resposta": "como contornar"
                }}
            ]
        }}
    ],
    "sequencia_ideal": "ordem recomendada de abordagens (ex: LinkedIn → Email → Cold Call)"
}}""",

    "plano_conteudo": """Você é um estrategista de conteúdo para negócios {segmento}.

TAREFA: {titulo}
NEGÓCIO: {perfil_resumo}
DADOS DE MERCADO: {dados_suporte}

Crie um plano de conteúdo baseado nas keywords encontradas. Retorne JSON:
{{
    "tipo": "plano_conteudo",
    "estrategia": "visão geral da estratégia de conteúdo",
    "calendario_semanal": [
        {{
            "dia": "Segunda / Terça / etc",
            "plataforma": "Instagram / LinkedIn / Blog / etc",
            "tipo_conteudo": "post / carrossel / artigo / vídeo / story",
            "tema": "assunto do conteúdo",
            "exemplo_titulo": "título ou headline do post",
            "objetivo": "gerar leads / educar / engajar"
        }}
    ],
    "pilares_conteudo": ["pilar 1", "pilar 2", "pilar 3"],
    "keywords_foco": ["keyword 1", "keyword 2"]
}}""",

    "precificacao": """Você é um consultor de precificação estratégica.

TAREFA: {titulo}
NEGÓCIO: {perfil_resumo}
DADOS DE MERCADO/PREÇOS: {dados_suporte}

Analise a precificação e sugira cenários. Retorne JSON:
{{
    "tipo": "precificacao",
    "analise_atual": "como o preço atual se compara ao mercado",
    "cenarios": [
        {{
            "nome": "nome do cenário (ex: Competitivo, Premium, etc)",
            "preco_sugerido": "faixa de preço",
            "margem_estimada": "% de margem",
            "posicionamento": "como esse preço te posiciona",
            "risco": "principal risco desse cenário",
            "para_quem": "perfil de cliente ideal para esse preço"
        }}
    ],
    "recomendacao": "qual cenário é melhor e por quê",
    "acoes": ["ação concreta para implementar"]
}}"""
}


def generate_assist(task: dict, profile: dict, assist_type: str, api_key: str) -> dict:
    """Generate AI assistance output for a specific task."""

    prompt_template = ASSIST_PROMPTS.get(assist_type)
    if not prompt_template:
        return {"erro": f"Tipo de assistência '{assist_type}' não suportado."}

    perfil = profile.get("perfil", {})
    perfil_resumo = f"{perfil.get('nome', 'N/A')} — {perfil.get('segmento', 'N/A')} — {perfil.get('modelo_negocio', 'N/A')} — {perfil.get('localizacao', 'N/A')}"
    segmento = perfil.get("segmento", "negócios")

    dados_suporte = json.dumps(task.get("dados_suporte", {}), ensure_ascii=False)

    prompt = prompt_template.format(
        titulo=task.get("titulo", ""),
        perfil_resumo=perfil_resumo,
        segmento=segmento,
        dados_suporte=dados_suporte,
    )

    return call_groq(api_key, prompt, temperature=0.4)


def run_assistant(task: dict, profile: dict) -> dict:
    """Main entry point. Takes a task + profile, returns AI-generated assistance."""
    api_key = os.environ.get("GROQ_API_KEY")

    if not api_key:
        return {"success": False, "erro": "Chave da API Groq não configurada."}

    assist_type = task.get("suporte_ia", {}).get("tipo", "copywriting")

    try:
        print(f"🤖 Gerando assistência ({assist_type})...", file=sys.stderr)
        result = generate_assist(task, profile, assist_type, api_key)
        print(f"  ✅ Assistência gerada.", file=sys.stderr)

        return {
            "success": True,
            "assist_type": assist_type,
            "output": result
        }

    except Exception as e:
        print(f"❌ Erro no assistente: {e}", file=sys.stderr)
        return {
            "success": False,
            "erro": f"Erro ao gerar assistência: {str(e)[:200]}"
        }
