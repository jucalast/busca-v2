"""
Test completo do fluxo do sistema - Debug estruturado
Simula exatamente o que o frontend faz, mostrando cada raciocinio da IA.

Agora testa:
- Coleta sistematica de TODOS os campos
- Pesquisa assistida (quando usuario diz "nao sei")
- Fluxo de confirmacao (usuario concorda/rejeita pesquisa)
- Geracao de tarefas de pesquisa
"""

import requests
import json
import time
from datetime import datetime
from typing import Dict, Any, List

# Configuracao
BASE_URL = "http://localhost:3000"
API_ENDPOINT = f"{BASE_URL}/api/growth"

# Cores para output
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    END = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

def print_section(title: str, color: str = Colors.CYAN):
    print(f"\n{color}{Colors.BOLD}{'='*80}")
    print(f"  {title}")
    print(f"{'='*80}{Colors.END}\n")

def print_subsection(title: str):
    print(f"\n{Colors.YELLOW}{'_'*80}")
    print(f"  {title}")
    print(f"{'_'*80}{Colors.END}\n")

def print_data(label: str, data: Any, indent: int = 0):
    prefix = "  " * indent
    if isinstance(data, (dict, list)):
        print(f"{prefix}{Colors.BLUE}{label}:{Colors.END}")
        print(f"{prefix}{json.dumps(data, indent=2, ensure_ascii=False)}")
    else:
        print(f"{prefix}{Colors.BLUE}{label}:{Colors.END} {data}")

def simulate_chat_message(messages: List[Dict], user_message: str, extracted_profile: Dict) -> Dict:
    """Simula envio de mensagem no chat (exatamente como o frontend faz)"""
    print_subsection(f"Enviando mensagem do usuario")
    print_data("Mensagem", user_message if user_message else "(init)")
    
    payload = {
        "action": "chat",
        "messages": messages,
        "user_message": user_message,
        "extracted_profile": extracted_profile
    }
    
    print(f"\n{Colors.YELLOW}Aguardando resposta da IA...{Colors.END}")
    start = time.time()
    
    try:
        response = requests.post(API_ENDPOINT, json=payload, timeout=120)
        elapsed = time.time() - start
        
        print(f"{Colors.GREEN}Resposta recebida em {elapsed:.2f}s{Colors.END}")
        
        if response.status_code == 200:
            data = response.json()
            
            print_subsection("Resposta da IA")
            print_data("Reply", data.get('reply', ''))
            
            if data.get('search_performed'):
                print(f"\n{Colors.CYAN}BUSCA realizada:{Colors.END}")
                print_data("Query", data.get('search_query', ''))
            
            ep = data.get('extracted_profile', {})
            if ep.get('_research_pending'):
                rp = ep['_research_pending']
                print(f"\n{Colors.YELLOW}PESQUISA PENDENTE DE CONFIRMACAO:{Colors.END}")
                print_data("Campo", rp.get('field', ''))
                print_data("Valor sugerido", str(rp.get('suggested_value', ''))[:100])
                print_data("Tarefa", rp.get('task_description', ''))
            
            if ep.get('_research_tasks'):
                print(f"\n{Colors.GREEN}TAREFAS DE PESQUISA CRIADAS: {len(ep['_research_tasks'])}{Colors.END}")
                for t in ep['_research_tasks']:
                    print(f"  - {t.get('titulo', '')}: {t.get('descricao', '')[:80]}")
            
            print_subsection("Estado do Perfil")
            display_profile = {k: v for k, v in ep.items() if not str(k).startswith('_') and v}
            print_data("Campos preenchidos", list(display_profile.keys()), indent=1)
            print_data("Total campos", len(display_profile), indent=1)
            print_data("Campos faltando (obrig)", data.get('fields_missing', []), indent=1)
            print_data("Pronto para analise?", data.get('ready_for_analysis', False), indent=1)
            
            return data
        else:
            print(f"{Colors.RED}Erro: {response.status_code}{Colors.END}")
            return {}
            
    except Exception as e:
        print(f"{Colors.RED}Erro na requisicao: {str(e)}{Colors.END}")
        return {}

def generate_analysis(profile: Dict) -> Dict:
    """Gera analise completa"""
    print_section("GERANDO ANALISE COMPLETA", Colors.GREEN)
    
    payload = {
        "action": "analyze",
        "profile": profile
    }
    
    print(f"\n{Colors.YELLOW}Aguardando analise completa (pode demorar)...{Colors.END}")
    start = time.time()
    
    try:
        response = requests.post(API_ENDPOINT, json=payload, timeout=300)
        elapsed = time.time() - start
        
        print(f"{Colors.GREEN}Analise concluida em {elapsed:.2f}s{Colors.END}")
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('success'):
                analysis = data.get('score', {})
                tasks_data = data.get('taskPlan', {})
                market_data = data.get('marketData', {})
                
                print_section("RESULTADO DA ANALISE", Colors.GREEN)
                
                print_subsection("Score Geral")
                print_data("Score", analysis.get('score_geral', 0))
                print_data("Classificacao", analysis.get('classificacao', ''))
                print_data("Resumo", analysis.get('resumo_executivo', ''))
                
                print_subsection("Dimensoes Analisadas")
                dimensoes = analysis.get('dimensoes', {})
                for dim_name, dim_data in dimensoes.items():
                    print(f"\n{Colors.BOLD}{dim_name.upper()}{Colors.END}")
                    print_data("Score", dim_data.get('score', 0), indent=1)
                
                print_subsection("Tarefas Geradas")
                tasks = tasks_data.get('tasks', []) if tasks_data else []
                print(f"Total de tarefas: {len(tasks)}")
                for i, task in enumerate(tasks[:5], 1):
                    print(f"\n{Colors.CYAN}Task {i}:{Colors.END}")
                    print_data("Titulo", task.get('titulo', ''), indent=1)
                    print_data("Categoria", task.get('categoria', ''), indent=1)
                
                print_subsection("Fontes Utilizadas")
                sources = market_data.get('allSources', [])
                print(f"Total de fontes: {len(sources)}")
                for i, source in enumerate(sources[:5], 1):
                    if isinstance(source, str):
                        print(f"  Fonte {i}: {source}")
                
                return data
            else:
                print(f"{Colors.RED}Erro na analise: {data.get('error')}{Colors.END}")
                return {}
        else:
            print(f"{Colors.RED}Erro HTTP: {response.status_code}{Colors.END}")
            return {}
            
    except Exception as e:
        print(f"{Colors.RED}Erro na requisicao: {str(e)}{Colors.END}")
        return {}

def main():
    """Fluxo completo de teste - inclui pesquisa assistida e confirmacao"""
    print_section("TESTE COMPLETO - PESQUISA ASSISTIDA + COLETA SISTEMATICA", Colors.HEADER)
    print(f"{Colors.BOLD}Timestamp:{Colors.END} {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{Colors.BOLD}Endpoint:{Colors.END} {API_ENDPOINT}")
    
    messages = []
    extracted_profile = {}
    
    # ---- FASE 1: Inicializacao ----
    print_section("FASE 1: INICIALIZACAO DO CHAT", Colors.CYAN)
    result = simulate_chat_message(messages, "", extracted_profile)
    if result.get('reply'):
        messages.append({"role": "assistant", "content": result['reply']})
        extracted_profile = result.get('extracted_profile', {})
    time.sleep(2)
    
    # ---- FASE 2: Nome + Segmento ----
    print_section("FASE 2: NOME + SEGMENTO", Colors.CYAN)
    user_msg = "Ola! Tenho uma cafeteria em Sao Paulo chamada Cafe Aroma"
    messages.append({"role": "user", "content": user_msg})
    result = simulate_chat_message(messages, user_msg, extracted_profile)
    if result.get('reply'):
        messages.append({"role": "assistant", "content": result['reply']})
        extracted_profile = result.get('extracted_profile', {})
    time.sleep(2)
    
    # ---- FASE 3: Modelo + Equipe + Tempo ----
    print_section("FASE 3: MODELO + EQUIPE + TEMPO", Colors.CYAN)
    user_msg = "Atendo pessoas fisicas (B2C), trabalho sozinho ha 2 anos"
    messages.append({"role": "user", "content": user_msg})
    result = simulate_chat_message(messages, user_msg, extracted_profile)
    if result.get('reply'):
        messages.append({"role": "assistant", "content": result['reply']})
        extracted_profile = result.get('extracted_profile', {})
    time.sleep(2)
    
    # ---- FASE 4: Dificuldades + Objetivos ----
    print_section("FASE 4: DIFICULDADES + OBJETIVOS", Colors.CYAN)
    user_msg = "Meu maior desafio e atrair mais clientes. Quero aumentar o faturamento em 30% nos proximos 6 meses"
    messages.append({"role": "user", "content": user_msg})
    result = simulate_chat_message(messages, user_msg, extracted_profile)
    if result.get('reply'):
        messages.append({"role": "assistant", "content": result['reply']})
        extracted_profile = result.get('extracted_profile', {})
    time.sleep(2)
    
    # ---- FASE 5: Capital ----
    print_section("FASE 5: CAPITAL DISPONIVEL", Colors.CYAN)
    user_msg = "Posso investir ate R$ 500 por mes em marketing"
    messages.append({"role": "user", "content": user_msg})
    result = simulate_chat_message(messages, user_msg, extracted_profile)
    if result.get('reply'):
        messages.append({"role": "assistant", "content": result['reply']})
        extracted_profile = result.get('extracted_profile', {})
    time.sleep(2)
    
    # ---- FASE 6: Canais de venda ----
    print_section("FASE 6: CANAIS DE VENDA", Colors.CYAN)
    user_msg = "Vendo na loja fisica e uso WhatsApp para pedidos"
    messages.append({"role": "user", "content": user_msg})
    result = simulate_chat_message(messages, user_msg, extracted_profile)
    if result.get('reply'):
        messages.append({"role": "assistant", "content": result['reply']})
        extracted_profile = result.get('extracted_profile', {})
    time.sleep(2)
    
    # ---- FASE 7: Cliente ideal ----
    print_section("FASE 7: CLIENTE IDEAL", Colors.CYAN)
    user_msg = "Meus clientes sao profissionais de 25-40 anos que trabalham na regiao"
    messages.append({"role": "user", "content": user_msg})
    result = simulate_chat_message(messages, user_msg, extracted_profile)
    if result.get('reply'):
        messages.append({"role": "assistant", "content": result['reply']})
        extracted_profile = result.get('extracted_profile', {})
    time.sleep(2)
    
    # ---- FASE 8: Ticket medio + Modelo operacional ----
    print_section("FASE 8: TICKET + MODELO OPERACIONAL", Colors.CYAN)
    user_msg = "O valor medio por venda e R$ 25. Tenho estoque proprio de graos e produtos"
    messages.append({"role": "user", "content": user_msg})
    result = simulate_chat_message(messages, user_msg, extracted_profile)
    if result.get('reply'):
        messages.append({"role": "assistant", "content": result['reply']})
        extracted_profile = result.get('extracted_profile', {})
    time.sleep(2)
    
    # ---- FASE 9: Faturamento ----
    print_section("FASE 9: FATURAMENTO", Colors.CYAN)
    user_msg = "Meu faturamento mensal e cerca de R$ 17 mil por mes"
    messages.append({"role": "user", "content": user_msg})
    result = simulate_chat_message(messages, user_msg, extracted_profile)
    if result.get('reply'):
        messages.append({"role": "assistant", "content": result['reply']})
        extracted_profile = result.get('extracted_profile', {})
    time.sleep(2)
    
    # ---- FASE 10: PESQUISA ASSISTIDA - "nao sei" ----
    # O sistema deve estar perguntando sobre concorrentes ou outro campo restante
    print_section("FASE 10: PESQUISA ASSISTIDA - NAO SEI", Colors.YELLOW)
    user_msg = "nao sei, pode pesquisar pra mim?"
    messages.append({"role": "user", "content": user_msg})
    result = simulate_chat_message(messages, user_msg, extracted_profile)
    if result.get('reply'):
        messages.append({"role": "assistant", "content": result['reply']})
        extracted_profile = result.get('extracted_profile', {})
    
    search_done = result.get('search_performed', False)
    has_pending = bool(extracted_profile.get('_research_pending'))
    print(f"\n{Colors.BOLD}VERIFICACAO FASE 10:{Colors.END}")
    print(f"  Pesquisa realizada: {Colors.GREEN if search_done else Colors.RED}{search_done}{Colors.END}")
    print(f"  _research_pending ativo: {Colors.GREEN if has_pending else Colors.RED}{has_pending}{Colors.END}")
    if has_pending:
        rp = extracted_profile['_research_pending']
        print(f"  Campo pesquisado: {rp.get('field', '?')}")
        print(f"  Valor sugerido: {str(rp.get('suggested_value', '?'))[:100]}")
    
    time.sleep(3)
    
    # ---- FASE 11: CONFIRMACAO DA PESQUISA ----
    print_section("FASE 11: CONFIRMACAO DA PESQUISA", Colors.YELLOW)
    user_msg = "sim, concordo"
    messages.append({"role": "user", "content": user_msg})
    result = simulate_chat_message(messages, user_msg, extracted_profile)
    if result.get('reply'):
        messages.append({"role": "assistant", "content": result['reply']})
        extracted_profile = result.get('extracted_profile', {})
    
    has_pending_after = bool(extracted_profile.get('_research_pending'))
    has_tasks = bool(extracted_profile.get('_research_tasks'))
    
    print(f"\n{Colors.BOLD}VERIFICACAO FASE 11:{Colors.END}")
    print(f"  _research_pending limpo: {Colors.GREEN if not has_pending_after else Colors.RED}{not has_pending_after}{Colors.END}")
    print(f"  _research_tasks criada: {Colors.GREEN if has_tasks else Colors.RED}{has_tasks}{Colors.END}")
    if has_tasks:
        for t in extracted_profile.get('_research_tasks', []):
            print(f"    - {t.get('titulo', '')}")
    
    time.sleep(2)
    
    # ---- FASE 12: Campo direto ----
    print_section("FASE 12: CAMPO DIRETO (diferencial ou proximo)", Colors.CYAN)
    user_msg = "Meu diferencial e o cafe especial de torra artesanal com graos selecionados"
    messages.append({"role": "user", "content": user_msg})
    result = simulate_chat_message(messages, user_msg, extracted_profile)
    if result.get('reply'):
        messages.append({"role": "assistant", "content": result['reply']})
        extracted_profile = result.get('extracted_profile', {})
    time.sleep(2)
    
    # ---- FASE 13: Outro "nao sei" ----
    print_section("FASE 13: PESQUISA ASSISTIDA 2 - NAO SEI", Colors.YELLOW)
    user_msg = "nao sei, pesquisa ai"
    messages.append({"role": "user", "content": user_msg})
    result = simulate_chat_message(messages, user_msg, extracted_profile)
    if result.get('reply'):
        messages.append({"role": "assistant", "content": result['reply']})
        extracted_profile = result.get('extracted_profile', {})
    
    search_done_2 = result.get('search_performed', False)
    has_pending_2 = bool(extracted_profile.get('_research_pending'))
    print(f"\n{Colors.BOLD}VERIFICACAO FASE 13:{Colors.END}")
    print(f"  Pesquisa realizada: {Colors.GREEN if search_done_2 else Colors.RED}{search_done_2}{Colors.END}")
    print(f"  _research_pending ativo: {Colors.GREEN if has_pending_2 else Colors.RED}{has_pending_2}{Colors.END}")
    
    time.sleep(3)
    
    # ---- FASE 14: Confirmar segunda pesquisa ----
    print_section("FASE 14: CONFIRMAR SEGUNDA PESQUISA", Colors.YELLOW)
    user_msg = "faz sentido, pode ser"
    messages.append({"role": "user", "content": user_msg})
    result = simulate_chat_message(messages, user_msg, extracted_profile)
    if result.get('reply'):
        messages.append({"role": "assistant", "content": result['reply']})
        extracted_profile = result.get('extracted_profile', {})
    time.sleep(2)
    
    # ---- FASE 15: Campos restantes rapidos ----
    print_section("FASE 15: CAMPOS RESTANTES RAPIDOS", Colors.CYAN)
    user_msg = "Os clientes me encontram pelo Google Maps e indicacao. Meu maior gargalo e falta de tempo"
    messages.append({"role": "user", "content": user_msg})
    result = simulate_chat_message(messages, user_msg, extracted_profile)
    if result.get('reply'):
        messages.append({"role": "assistant", "content": result['reply']})
        extracted_profile = result.get('extracted_profile', {})
    time.sleep(2)
    
    # ---- FASE 16: Forcar analise se nao pronto ----
    if not result.get('ready_for_analysis'):
        print_section("FASE 16: FORCAR ANALISE", Colors.CYAN)
        user_msg = "pode gerar a analise"
        messages.append({"role": "user", "content": user_msg})
        result = simulate_chat_message(messages, user_msg, extracted_profile)
        if result.get('reply'):
            messages.append({"role": "assistant", "content": result['reply']})
            extracted_profile = result.get('extracted_profile', {})
        time.sleep(2)
    
    # ---- RESUMO FINAL ----
    print_section("RESUMO FINAL DO PERFIL COLETADO", Colors.GREEN)
    display_profile = {k: v for k, v in extracted_profile.items() if not str(k).startswith('_') and v}
    print_data("Perfil completo", display_profile)
    print(f"\n{Colors.BOLD}Total de campos preenchidos: {len(display_profile)}{Colors.END}")
    
    research_tasks = extracted_profile.get('_research_tasks', [])
    if research_tasks:
        print(f"\n{Colors.CYAN}Tarefas de pesquisa criadas: {len(research_tasks)}{Colors.END}")
        for t in research_tasks:
            print(f"  - {t.get('titulo', '')}: {t.get('descricao', '')[:100]}")
    
    # ---- GERAR ANALISE ----
    print(f"\n{Colors.GREEN}{Colors.BOLD}Gerando analise...{Colors.END}")
    time.sleep(3)
    
    profile_for_analysis = {
        "perfil": {
            "nome": extracted_profile.get('nome_negocio', ''),
            "segmento": extracted_profile.get('segmento', ''),
            "localizacao": extracted_profile.get('localizacao', ''),
            "modelo_negocio": extracted_profile.get('modelo', ''),
            "tipo_oferta": extracted_profile.get('tipo_produto', 'ambos'),
            "tempo_mercado": extracted_profile.get('tempo_operacao', ''),
            "ticket_medio_estimado": extracted_profile.get('ticket_medio', ''),
            "faturamento_faixa": extracted_profile.get('faturamento_mensal', ''),
            "num_funcionarios": extracted_profile.get('num_funcionarios', ''),
            "investimento_marketing": extracted_profile.get('investimento_marketing', ''),
            "dificuldades": extracted_profile.get('dificuldades', ''),
            "modelo_operacional": extracted_profile.get('modelo_operacional', ''),
        },
        "restricoes_criticas": {
            "modelo_operacional": extracted_profile.get('modelo_operacional'),
            "capital_disponivel": extracted_profile.get('capital_disponivel'),
            "equipe_solo": (lambda n: n in ['1', 'solo', 'so eu', 'sozinho'] or 'sozinho' in str(n).lower())(extracted_profile.get('num_funcionarios', '')),
            "canais_existentes": extracted_profile.get('canais_venda', []),
            "principal_gargalo": extracted_profile.get('principal_gargalo'),
            "maior_objecao": extracted_profile.get('maior_objecao'),
        },
        "diagnostico_inicial": {
            "problemas_identificados": [{
                "area": "geral",
                "problema": extracted_profile.get('dificuldades', ''),
                "severidade": 3,
                "evidencia": "Relatado pelo usuario na conversa",
                "restricao_afetada": extracted_profile.get('modelo_operacional')
            }],
            "pontos_fortes": [extracted_profile.get('diferencial', 'A definir')],
        },
        "categorias_relevantes": ["marketing digital", "vendas", "atendimento"],
        "queries_sugeridas": {},
        "objetivos_parseados": [{
            "objetivo": extracted_profile.get('objetivos', ''),
            "prazo": "medio prazo",
            "area_relacionada": "crescimento"
        }],
        "_chat_context": {
            "concorrentes": extracted_profile.get('concorrentes'),
            "cliente_ideal": extracted_profile.get('cliente_ideal'),
            "canais_venda": extracted_profile.get('canais_venda', []),
            "investimento_marketing": extracted_profile.get('investimento_marketing'),
            "margem_lucro": extracted_profile.get('margem_lucro'),
            "tempo_entrega": extracted_profile.get('tempo_entrega'),
            "origem_clientes": extracted_profile.get('origem_clientes'),
            "maior_objecao": extracted_profile.get('maior_objecao'),
        },
        "_research_tasks": extracted_profile.get('_research_tasks', []),
    }
    
    analysis = generate_analysis(profile_for_analysis)
    
    if analysis:
        print_section("TESTE CONCLUIDO COM SUCESSO!", Colors.GREEN)
    else:
        print_section("TESTE CONCLUIDO COM AVISOS", Colors.YELLOW)
    
    print(f"\n{Colors.BOLD}Teste finalizado em: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}{Colors.END}\n")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}Teste interrompido pelo usuário.{Colors.END}")
    except Exception as e:
        print(f"\n{Colors.RED}Erro inesperado: {str(e)}{Colors.END}")
        import traceback
        traceback.print_exc()
