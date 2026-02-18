"""
Growth Orchestrator — Coordinates the full growth analysis pipeline.
Called by the /api/growth route with --action and --input flags.

Actions:
    chat      → Conversational AI consultant with internet search
    profile   → Runs business_profiler on onboarding data
    analyze   → Runs market search + scorer + task generator
    assist    → Runs task assistant for a specific task
"""

import argparse
import json
import sys
import os
import time

# Ensure we can import sibling modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from business_profiler import run_profiler
from business_scorer import run_scorer
from task_generator import run_task_generator
from task_assistant import run_assistant
from chat_consultant import run_chat
import database as db

# Reuse search functions from cli.py
from cli import search_duckduckgo, scrape_page, call_groq, BUSINESS_CATEGORIES


import concurrent.futures

def process_category(cat, queries, perfil_data, description, restricoes, region, api_key):
    """Helper function to process a single category in a thread."""
    cat_id = cat.get("id", "")
    query = queries.get(cat_id, f"{cat.get('nome', '')} {perfil_data.get('segmento', '')}")
    
    print(f"  [{cat.get('icone', '📊')}] Buscando: {query}", file=sys.stderr)

    # Search (DuckDuckGo is fast, no rate limit usually)
    results = search_duckduckgo(query, max_results=5, region=region)

    if not results:
        return {
            "id": cat_id,
            "nome": cat.get("nome", ""),
            "icone": cat.get("icone", "📊"),
            "cor": cat.get("cor", "#71717a"),
            "query_usada": query,
            "resumo": {"info": "Nenhum resultado encontrado."},
            "fontes": []
        }

    aggregated_text = ""
    sources = []

    for i, result in enumerate(results):
        url = result.get('href', '')
        sources.append(url)
        snippet = result.get('body', '')
        title = result.get('title', '')
        aggregated_text += f"Fonte {i+1} ({title}): {snippet}\n"

        # Scrape only top 1 result to save time/tokens
        if i < 1:
            content = scrape_page(url, timeout=3)
            if content:
                aggregated_text += f"Conteúdo Fonte {i+1}: {content[:3000]}\n"

    foco = cat.get("foco", "análise geral")
    nao_falar = cat.get("nao_falar", "")
    
    # Build restriction-aware instructions
    restriction_instructions = ""
    if restricoes:
        modelo_op = restricoes.get("modelo_operacional", "")
        capital = restricoes.get("capital_disponivel", "")
        equipe = restricoes.get("equipe", "")
        canais = restricoes.get("canais_existentes", [])
        
        if modelo_op in ["sob_encomenda", "dropshipping"]:
            restriction_instructions += "\n- NÃO recomende ERP de estoque, gestão de inventário. O negócio opera sob encomenda."
        if capital in ["zero", "baixo"]:
            restriction_instructions += "\n- NÃO recomende ferramentas pagas caras. Apenas opções gratuitas ou de baixíssimo custo."
        if equipe in ["1", "solo", "sozinho"]:
            restriction_instructions += "\n- NÃO recomende estratégias que exijam equipe. Tudo deve ser executável por uma pessoa."
        if any("instagram" in str(c).lower() for c in canais):
            restriction_instructions += "\n- O negócio JÁ usa Instagram. Não sugira 'criar presença'. Sugira OTIMIZAÇÃO."

    try:
        prompt = f"""Você é um consultor sênior de negócios. Analise dados reais da internet e gere um relatório ÚTIL e VIÁVEL.

O CLIENTE: {description}
RESTRIÇÕES E CONTEXTO: {restricoes}

SEU FOCO NESTA SEÇÃO: {foco}

REGRAS DE VIABILIDADE (CRÍTICO):
1. Se o cliente tem "capital zero" ou pouco investimento, NÃO recomende ferramentas pagas caras. Sugira alternativas gratuitas ou manuais.
2. Se a equipe for pequena (1 pessoa), NÃO sugira estratégias complexas que exigem um time.
3. As recomendações DEVEM resolver as "Dificuldades" listadas nas restrições.
{restriction_instructions}

REGRAS CRÍTICAS:
1. Retorne APENAS JSON válido.
2. {nao_falar}
3. NÃO REPITA o que o cliente já disse sobre o próprio negócio.
4. Fale em SEGUNDA PESSOA.
5. Cite nomes reais, valores em R$, percentuais — dados CONCRETOS.
6. Se um dado não existir, simplesmente NÃO inclua esse campo.

REGRAS ANTI-GENÉRICO:
- PROIBIDO dizer "pesquise", "avalie", "considere", "analise opções".
- Cada recomendação deve ser uma frase completa com: a ação específica, a ferramenta/plataforma real, e o dado concreto que justifica.
- Cite nomes de ferramentas, fornecedores, plataformas REAIS encontrados nos dados.
- NUNCA use colchetes ou placeholders. Preencha com dados REAIS.

JSON:
{{
    "visao_geral": "2-3 frases com a principal conclusão baseada nos dados encontrados",
    "pontos_chave": ["fato concreto com número ou nome real encontrado na pesquisa"],
    "recomendacoes": ["frase completa com ação + ferramenta real + justificativa baseada em dados"],
    "dados_relevantes": {{"nome_da_metrica": "valor numerico ou textual real"}}
}}

DADOS DA INTERNET:
{aggregated_text[:12000]}"""

        # USE FASTER MODEL FOR SUMMARY
        resumo = call_groq(api_key, prompt, temperature=0.3, model="llama-3.1-8b-instant")
    except Exception as e:
        print(f"  ❌ Erro ao resumir {cat.get('nome', '')}: {e}", file=sys.stderr)
        resumo = {"erro": f"Não foi possível gerar resumo: {str(e)[:200]}"}

    return {
        "id": cat_id,
        "nome": cat.get("nome", ""),
        "icone": cat.get("icone", "📊"),
        "cor": cat.get("cor", "#71717a"),
        "query_usada": query,
        "resumo": resumo,
        "fontes": sources
    }

DIMENSION_LABELS = {
    "presenca_digital": "Presenca Digital",
    "competitividade": "Competitividade e Concorrencia",
    "diversificacao_canais": "Diversificacao de Canais de Venda",
    "precificacao": "Precificacao e Margem",
    "potencial_mercado": "Potencial de Mercado e Tendencias",
    "maturidade_operacional": "Maturidade Operacional e Processos",
}


def run_dimension_chat(input_data: dict) -> dict:
    """AI chat focused on a specific business dimension with internet search."""
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return {"reply": "Erro: chave da API nao configurada.", "sources": [], "searchQuery": ""}

    dimension = input_data.get("dimension", "")
    context = input_data.get("context", {})
    user_message = input_data.get("userMessage", "")
    messages = input_data.get("messages", [])

    dim_label = DIMENSION_LABELS.get(dimension, dimension)

    # Extract profile info
    profile = context.get("profile", {})
    perfil = profile.get("perfil", profile)
    segmento = perfil.get("segmento", "")
    nome = perfil.get("nome_negocio", perfil.get("nome", ""))
    localizacao = perfil.get("localizacao", "")
    modelo = perfil.get("modelo", perfil.get("modelo_negocio", ""))

    # Score data for this dimension
    score = context.get("score", {})
    dim_data = score.get("dimensoes", {}).get(dimension, {})

    # Build a targeted search query
    search_query = f"{dim_label} {segmento} {localizacao} {user_message}"
    print(f"  Dimension search: {search_query}", file=sys.stderr)

    results = search_duckduckgo(search_query, max_results=4, region='br-pt')
    search_context = ""
    sources = []

    for i, r in enumerate(results or []):
        url = r.get('href', '')
        sources.append(url)
        snippet = r.get('body', '')
        title = r.get('title', '')
        search_context += f"Fonte {i+1} ({title}): {snippet}\n"
        if i < 2:
            content = scrape_page(url, timeout=3)
            if content:
                search_context += f"  Detalhes: {content[:2000]}\n"

    # Build conversation history text
    history_text = ""
    for m in messages[-8:]:
        role = "Usuario" if m.get("role") == "user" else "Assistente"
        history_text += f"{role}: {m.get('content', '')}\n"

    prompt = f"""Voce e um consultor especialista em {dim_label} para pequenos e medios negocios.

CONTEXTO DO NEGOCIO:
- Nome: {nome}
- Segmento: {segmento}
- Modelo: {modelo}
- Localizacao: {localizacao}
- Score atual em {dim_label}: {dim_data.get('score', 'N/A')}/100
- Status: {dim_data.get('status', 'N/A')}
- Diagnostico: {dim_data.get('justificativa', 'N/A')}
- Acoes imediatas ja sugeridas: {json.dumps(dim_data.get('acoes_imediatas', []), ensure_ascii=False)}

PERFIL COMPLETO:
{json.dumps(perfil, ensure_ascii=False)[:3000]}

SCORE GERAL DO NEGOCIO:
{json.dumps(score, ensure_ascii=False)[:2000]}

DADOS DA PESQUISA NA INTERNET (use como base):
{search_context[:8000] if search_context else "Nenhum dado encontrado."}

HISTORICO DA CONVERSA:
{history_text if history_text else "Primeira mensagem."}

REGRAS:
1. Responda em portugues, de forma direta e acionavel.
2. SEMPRE cite dados concretos e fontes da pesquisa quando disponivel.
3. De recomendacoes ESPECIFICAS para este negocio, nao genericas.
4. Considere as limitacoes do negocio (capital, equipe, modelo).
5. NAO use emojis.
6. Foque em {dim_label}.
7. Se o usuario pedir algo fora do escopo de {dim_label}, responda brevemente e redirecione.
8. Seja conciso mas completo. Use paragrafos curtos.
9. Cite ferramentas, plataformas e valores REAIS encontrados na pesquisa.

PERGUNTA DO USUARIO: {user_message}

Responda de forma direta e util:"""

    try:
        reply = call_groq(api_key, prompt, temperature=0.4, model="llama-3.3-70b-versatile", force_json=False)
    except Exception as e:
        print(f"  Erro no LLM: {e}", file=sys.stderr)
        # Fallback to smaller model
        try:
            reply = call_groq(api_key, prompt, temperature=0.4, model="llama-3.1-8b-instant", force_json=False)
        except Exception as e2:
            reply = f"Desculpe, nao consegui gerar uma resposta. Erro: {str(e2)[:200]}"

    return {
        "success": True,
        "reply": reply,
        "sources": sources,
        "searchQuery": search_query,
    }


def run_market_search(profile: dict, region: str = 'br-pt') -> dict:
    """
    Run targeted market searches in PARALLEL to speed up analysis.
    NOW: Passes restrictions to category processing for context-aware results.
    """
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return {"categories": [], "allSources": [], "error": "No API key"}

    # Use queries from profile if available, otherwise generate from categories
    queries = profile.get("queries_sugeridas", profile.get("queries", {}))
    categories = profile.get("categorias_relevantes", profile.get("categories", BUSINESS_CATEGORIES))

    # Garantir que sempre temos categorias para buscar
    if not categories or (isinstance(categories, list) and len(categories) == 0):
        categories = BUSINESS_CATEGORIES
        print(f"  ⚠️ Nenhuma categoria fornecida, usando categorias padrão: {categories}", file=sys.stderr)

    perfil_data = profile.get("perfil", profile.get("profile", {}).get("perfil", {}))
    description = f"{perfil_data.get('nome', '')} - {perfil_data.get('segmento', '')} - {perfil_data.get('modelo_negocio', '')} - {perfil_data.get('localizacao', '')}"
    
    # Extract comprehensive restrictions
    restricoes_criticas = profile.get("restricoes_criticas", {})
    capital = restricoes_criticas.get("capital_disponivel", perfil_data.get('investimento_marketing', 'não informado'))
    equipe = restricoes_criticas.get("equipe_solo", False)
    if equipe:
        equipe_str = "solo"
    else:
        equipe_str = perfil_data.get('num_funcionarios', 'não informado')
    
    dificuldades = perfil_data.get('dificuldades', '')
    modelo_op = restricoes_criticas.get("modelo_operacional", "")
    canais_existentes = restricoes_criticas.get("canais_existentes", [])
    
    restricoes = {
        "capital_disponivel": capital,
        "equipe": equipe_str,
        "dificuldades": dificuldades,
        "modelo_operacional": modelo_op,
        "canais_existentes": canais_existentes,
        "texto": f"Capital: {capital}. Equipe: {equipe_str}. Dificuldades: {dificuldades}. Modelo: {modelo_op}."
    }

    categories_result = []
    all_sources = []

    # Parallel execution with max 3 workers to respect rate limits gently
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        future_to_cat = {
            executor.submit(process_category, cat, queries, perfil_data, description, restricoes, region, api_key): cat 
            for cat in categories
        }
        
        for future in concurrent.futures.as_completed(future_to_cat):
            try:
                result = future.result()
                categories_result.append(result)
                all_sources.extend(result.get("fontes", []))
            except Exception as exc:
                print(f"  ❌ Generated an exception: {exc}", file=sys.stderr)

    unique_sources = list(dict.fromkeys(all_sources))

    return {
        "businessMode": True,
        "categories": categories_result,
        "allSources": unique_sources,
        "restricoes_aplicadas": restricoes  # Include for downstream components
    }


def main():
    parser = argparse.ArgumentParser(description="Growth Orchestrator")
    parser.add_argument("--action", required=True, choices=[
        "profile", "analyze", "assist", "chat", "dimension-chat",
        "list-businesses", "get-business", "create-business", "save-analysis",
        "register", "login", "logout", "validate-session"
    ])
    parser.add_argument("--input-file", required=True, help="Path to JSON input file")
    args = parser.parse_args()

    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    # Read input from temp file (avoids Windows CLI character limits)
    input_file = getattr(args, 'input_file')
    with open(input_file, 'r', encoding='utf-8') as f:
        input_data = json.load(f)

    # ━━━ Profile Action ━━━
    if args.action == "profile":
        onboarding = input_data.get("onboarding", {})
        result = run_profiler(onboarding)
        print(json.dumps(result, ensure_ascii=False, indent=2))

    # ━━━ Analyze Action (full pipeline) ━━━
    elif args.action == "analyze":
        profile = input_data.get("profile", {})
        region = input_data.get("region", "br-pt")
        business_id = input_data.get("business_id")  # Optional: for persistence
        user_id = input_data.get("user_id", "default_user")

        # Step 1: Market search
        print("🔍 Executando pesquisa de mercado...", file=sys.stderr)
        market_data = run_market_search(profile, region)
        print(f"  ✅ Pesquisa completa: {len(market_data.get('categories', []))} categorias", file=sys.stderr)

        # Step 2: Business Score
        print("📊 Calculando score...", file=sys.stderr)
        score_result = run_scorer(profile, market_data)
        print(f"  ✅ Score calculado", file=sys.stderr)

        # Step 3: Task Generation
        score_data = score_result.get("score", {}) if score_result.get("success") else {}
        print("📋 Gerando tarefas...", file=sys.stderr)
        task_result = run_task_generator(profile, score_data, market_data)
        print(f"  ✅ Tarefas geradas", file=sys.stderr)

        # Step 4: Persist to database
        if business_id:
            print("💾 Salvando análise...", file=sys.stderr)
            analysis = db.create_analysis(business_id, score_data, task_result.get("taskPlan", {}), market_data)
            print(f"  ✅ Análise salva: {analysis['id']}", file=sys.stderr)
        else:
            # Create new business if no business_id provided
            print("💾 Criando novo negócio...", file=sys.stderr)
            db.get_or_create_user(user_id)
            perfil = profile.get("perfil", profile)
            name = perfil.get("nome", perfil.get("nome_negocio", "Novo Negocio"))
            business = db.create_business(user_id, name, profile)
            business_id = business["id"]
            print(f"  ✅ Negócio criado: {business_id}", file=sys.stderr)
            
            analysis = db.create_analysis(business_id, score_data, task_result.get("taskPlan", {}), market_data)
            print(f"  ✅ Análise salva: {analysis['id']}", file=sys.stderr)

        # Combine results
        output = {
            "success": True,
            "marketData": market_data,
            "score": score_result.get("score", {}),
            "taskPlan": task_result.get("taskPlan", {}),
            "business_id": business_id,
            "analysis_id": analysis.get("id") if 'analysis' in locals() else None
        }

        print("--- GROWTH_RESULT ---")
        print(json.dumps(output, ensure_ascii=False, indent=2))

    # ━━━ Assist Action ━━━
    elif args.action == "assist":
        task = input_data.get("task", {})
        profile = input_data.get("profile", {})
        result = run_assistant(task, profile)

        print("--- ASSIST_RESULT ---")
        print(json.dumps(result, ensure_ascii=False, indent=2))

    # ━━━ Chat Action (conversational consultant) ━━━
    elif args.action == "chat":
        result = run_chat(input_data)

        print("--- CHAT_RESULT ---")
        print(json.dumps(result, ensure_ascii=False, indent=2))

    # ━━━ Dimension Chat Action (per-dimension AI with search) ━━━
    elif args.action == "dimension-chat":
        result = run_dimension_chat(input_data)

        print("--- DIMENSION_CHAT_RESULT ---")
        print(json.dumps(result, ensure_ascii=False, indent=2))

    # ━━━ List Businesses Action ━━━
    elif args.action == "list-businesses":
        user_id = input_data.get("user_id", "default_user")
        businesses = db.list_user_businesses(user_id)
        
        # Add latest analysis info to each business
        for biz in businesses:
            latest = db.get_latest_analysis(biz["id"])
            if latest:
                biz["latest_analysis"] = {
                    "id": latest["id"],
                    "score_geral": latest["score_geral"],
                    "classificacao": latest["classificacao"],
                    "created_at": latest["created_at"]
                }
        
        print("--- LIST_BUSINESSES_RESULT ---")
        print(json.dumps({"success": True, "businesses": businesses}, ensure_ascii=False, indent=2))

    # ━━━ Get Business Action ━━━
    elif args.action == "get-business":
        business_id = input_data.get("business_id")
        business = db.get_business(business_id)
        
        if business:
            # Get latest analysis
            latest = db.get_latest_analysis(business_id)
            if latest:
                business["latest_analysis"] = latest
            
            print("--- GET_BUSINESS_RESULT ---")
            print(json.dumps({"success": True, "business": business}, ensure_ascii=False, indent=2))
        else:
            print("--- GET_BUSINESS_RESULT ---")
            print(json.dumps({"success": False, "error": "Business not found"}, ensure_ascii=False, indent=2))

    # ━━━ Create Business Action ━━━
    elif args.action == "create-business":
        user_id = input_data.get("user_id", "default_user")
        profile = input_data.get("profile", {})
        
        # Ensure user exists
        db.get_or_create_user(user_id)
        
        # Extract business name
        perfil = profile.get("perfil", profile)
        name = perfil.get("nome", perfil.get("nome_negocio", "Novo Negocio"))
        
        # Create business
        business = db.create_business(user_id, name, profile)
        
        print("--- CREATE_BUSINESS_RESULT ---")
        print(json.dumps({"success": True, "business": business}, ensure_ascii=False, indent=2))

    # ━━━ Save Analysis Action ━━━
    elif args.action == "save-analysis":
        business_id = input_data.get("business_id")
        score_data = input_data.get("score", {})
        task_data = input_data.get("taskPlan", {})
        market_data = input_data.get("marketData", {})
        
        analysis = db.create_analysis(business_id, score_data, task_data, market_data)
        
        print("--- SAVE_ANALYSIS_RESULT ---")
        print(json.dumps({"success": True, "analysis": analysis}, ensure_ascii=False, indent=2))

    # ━━━ Register Action ━━━
    elif args.action == "register":
        email = input_data.get("email")
        password = input_data.get("password")
        name = input_data.get("name")
        
        if not email or not password:
            print("--- REGISTER_RESULT ---")
            print(json.dumps({"success": False, "error": "Email e senha são obrigatórios"}, ensure_ascii=False, indent=2))
        else:
            try:
                user = db.register_user(email, password, name)
                # Auto-login after registration
                login_result = db.login_user(email, password)
                
                print("--- REGISTER_RESULT ---")
                print(json.dumps({"success": True, "user": user, "session": login_result["session"]}, ensure_ascii=False, indent=2))
            except ValueError as e:
                print("--- REGISTER_RESULT ---")
                print(json.dumps({"success": False, "error": str(e)}, ensure_ascii=False, indent=2))
            except Exception as e:
                print("--- REGISTER_RESULT ---")
                print(json.dumps({"success": False, "error": f"Erro ao registrar: {str(e)}"}, ensure_ascii=False, indent=2))

    # ━━━ Login Action ━━━
    elif args.action == "login":
        email = input_data.get("email")
        password = input_data.get("password")
        
        if not email or not password:
            print("--- LOGIN_RESULT ---")
            print(json.dumps({"success": False, "error": "Email e senha são obrigatórios"}, ensure_ascii=False, indent=2))
        else:
            result = db.login_user(email, password)
            
            if result:
                print("--- LOGIN_RESULT ---")
                print(json.dumps({"success": True, **result}, ensure_ascii=False, indent=2))
            else:
                print("--- LOGIN_RESULT ---")
                print(json.dumps({"success": False, "error": "Email ou senha inválidos"}, ensure_ascii=False, indent=2))

    # ━━━ Logout Action ━━━
    elif args.action == "logout":
        token = input_data.get("token")
        
        if token:
            db.delete_session(token)
        
        print("--- LOGOUT_RESULT ---")
        print(json.dumps({"success": True}, ensure_ascii=False, indent=2))

    # ━━━ Validate Session Action ━━━
    elif args.action == "validate-session":
        token = input_data.get("token")
        
        if not token:
            print("--- VALIDATE_SESSION_RESULT ---")
            print(json.dumps({"success": False, "error": "Token não fornecido"}, ensure_ascii=False, indent=2))
        else:
            session = db.validate_session(token)
            
            if session:
                print("--- VALIDATE_SESSION_RESULT ---")
                print(json.dumps({"success": True, "session": session}, ensure_ascii=False, indent=2))
            else:
                print("--- VALIDATE_SESSION_RESULT ---")
                print(json.dumps({"success": False, "error": "Sessão inválida ou expirada"}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
