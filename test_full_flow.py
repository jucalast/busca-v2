"""
Test completo do fluxo do sistema - Debug estruturado
Simula exatamente o que o frontend faz, mostrando cada raciocínio da IA
"""

import requests
import json
import time
from datetime import datetime
from typing import Dict, Any, List

# Configuração
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
    """Imprime seção formatada"""
    print(f"\n{color}{Colors.BOLD}{'='*80}")
    print(f"  {title}")
    print(f"{'='*80}{Colors.END}\n")

def print_subsection(title: str):
    """Imprime subseção"""
    print(f"\n{Colors.YELLOW}{'─'*80}")
    print(f"  {title}")
    print(f"{'─'*80}{Colors.END}\n")

def print_data(label: str, data: Any, indent: int = 0):
    """Imprime dados formatados"""
    prefix = "  " * indent
    if isinstance(data, (dict, list)):
        print(f"{prefix}{Colors.BLUE}{label}:{Colors.END}")
        print(f"{prefix}{json.dumps(data, indent=2, ensure_ascii=False)}")
    else:
        print(f"{prefix}{Colors.BLUE}{label}:{Colors.END} {data}")

def simulate_chat_message(messages: List[Dict], user_message: str, extracted_profile: Dict) -> Dict:
    """Simula envio de mensagem no chat (exatamente como o frontend faz)"""
    print_subsection(f"🗨️  Enviando mensagem do usuário")
    print_data("Mensagem", user_message)
    
    payload = {
        "action": "chat",
        "messages": messages,
        "user_message": user_message,
        "extracted_profile": extracted_profile
    }
    
    print_data("\n📤 Payload enviado", payload, indent=1)
    
    print(f"\n{Colors.YELLOW}⏳ Aguardando resposta da IA...{Colors.END}")
    start = time.time()
    
    try:
        response = requests.post(API_ENDPOINT, json=payload, timeout=120)
        elapsed = time.time() - start
        
        print(f"{Colors.GREEN}✓ Resposta recebida em {elapsed:.2f}s{Colors.END}")
        
        if response.status_code == 200:
            data = response.json()
            
            print_subsection("🤖 Resposta da IA")
            print_data("Reply", data.get('reply', ''))
            
            if data.get('search_performed'):
                print(f"\n{Colors.CYAN}🔍 Busca realizada:{Colors.END}")
                print_data("Query", data.get('search_query', ''))
            
            print_subsection("📊 Estado do Perfil Extraído")
            print_data("Perfil atual", data.get('extracted_profile', {}), indent=1)
            print_data("Campos coletados", data.get('fields_collected', []), indent=1)
            print_data("Campos faltando", data.get('fields_missing', []), indent=1)
            print_data("Pronto para análise?", data.get('ready_for_analysis', False), indent=1)
            
            return data
        else:
            print(f"{Colors.RED}✗ Erro: {response.status_code}{Colors.END}")
            print_data("Response", response.text)
            return {}
            
    except Exception as e:
        print(f"{Colors.RED}✗ Erro na requisição: {str(e)}{Colors.END}")
        return {}

def generate_analysis(profile: Dict) -> Dict:
    """Gera análise completa (exatamente como o frontend faz)"""
    print_section("GERANDO ANALISE COMPLETA", Colors.GREEN)
    
    print_subsection("📋 Perfil para Análise")
    print_data("Perfil estruturado", profile, indent=1)
    
    payload = {
        "action": "analyze",
        "profile": profile
    }
    
    print(f"\n{Colors.YELLOW}⏳ Aguardando análise completa (pode demorar)...{Colors.END}")
    start = time.time()
    
    try:
        response = requests.post(API_ENDPOINT, json=payload, timeout=300)
        elapsed = time.time() - start
        
        print(f"{Colors.GREEN}✓ Análise concluída em {elapsed:.2f}s{Colors.END}")
        
        if response.status_code == 200:
            data = response.json()
            
            # DEBUG: Mostrar JSON completo SEMPRE
            print(f"\n{Colors.CYAN}[DEBUG] Response completo:{Colors.END}")
            print(json.dumps(data, indent=2, ensure_ascii=False)[:3000])
            print()
            
            if data.get('success'):
                # Os dados estão em 'score', 'taskPlan' e 'marketData'
                analysis = data.get('score', {})
                tasks_data = data.get('taskPlan', {})
                market_data = data.get('marketData', {})
                
                print_section("RESULTADO DA ANALISE", Colors.GREEN)
                
                # Score geral
                print_subsection("📈 Score Geral")
                print_data("Score", analysis.get('score_geral', 0))
                print_data("Classificação", analysis.get('classificacao', ''))
                print_data("Resumo", analysis.get('resumo_executivo', ''))
                
                # Dimensões
                print_subsection("🎯 Dimensões Analisadas")
                dimensoes = analysis.get('dimensoes', {})
                for dim_name, dim_data in dimensoes.items():
                    print(f"\n{Colors.BOLD}{dim_name.upper()}{Colors.END}")
                    print_data("Score", dim_data.get('score', 0), indent=1)
                    print_data("Justificativa", dim_data.get('justificativa', ''), indent=1)
                    if dim_data.get('problemas'):
                        print_data("Problemas", dim_data['problemas'], indent=1)
                
                # Tasks - agora de taskPlan.categorias
                print_subsection("📝 Tarefas Geradas")
                tasks = []
                if tasks_data and 'categorias' in tasks_data:
                    for cat_name, cat_tasks in tasks_data.get('categorias', {}).items():
                        tasks.extend(cat_tasks if isinstance(cat_tasks, list) else [])
                
                print(f"Total de tarefas: {len(tasks)}")
                for i, task in enumerate(tasks[:5], 1):  # Mostra primeiras 5
                    print(f"\n{Colors.CYAN}Task {i}:{Colors.END}")
                    print_data("Categoria", task.get('categoria', ''), indent=1)
                    print_data("Ação", task.get('acao', ''), indent=1)
                    print_data("Impacto esperado", task.get('impacto_esperado', ''), indent=1)
                    print_data("Dificuldade", task.get('dificuldade', ''), indent=1)
                
                if len(tasks) > 5:
                    print(f"\n{Colors.YELLOW}... e mais {len(tasks) - 5} tarefas{Colors.END}")
                
                # Sources - agora de marketData.allSources
                print_subsection("📚 Fontes Utilizadas")
                sources = market_data.get('allSources', [])
                print(f"Total de fontes: {len(sources)}")
                for i, source in enumerate(sources[:3], 1):  # Mostra primeiras 3
                    print(f"\n{Colors.CYAN}Fonte {i}:{Colors.END}")
                    print_data("URL", source.get('url', ''), indent=1)
                    print_data("Título", source.get('title', ''), indent=1)
                
                if len(sources) > 3:
                    print(f"\n{Colors.YELLOW}... e mais {len(sources) - 3} fontes{Colors.END}")
                
                return data
            else:
                print(f"{Colors.RED}✗ Erro na análise: {data.get('error')}{Colors.END}")
                return {}
        else:
            print(f"{Colors.RED}✗ Erro HTTP: {response.status_code}{Colors.END}")
            print_data("Response", response.text)
            return {}
            
    except Exception as e:
        print(f"{Colors.RED}✗ Erro na requisição: {str(e)}{Colors.END}")
        return {}

def main():
    """Fluxo completo de teste"""
    print_section("TESTE COMPLETO DO SISTEMA - DEBUG ESTRUTURADO", Colors.HEADER)
    print(f"{Colors.BOLD}Timestamp:{Colors.END} {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{Colors.BOLD}Endpoint:{Colors.END} {API_ENDPOINT}")
    
    # Estado inicial
    messages = []
    extracted_profile = {}
    
    # 1. Inicialização do chat
    print_section("FASE 1: INICIALIZAÇÃO DO CHAT", Colors.CYAN)
    result = simulate_chat_message(messages, "", extracted_profile)
    
    if result.get('reply'):
        messages.append({"role": "assistant", "content": result['reply']})
        extracted_profile = result.get('extracted_profile', {})
    
    time.sleep(2)  # Rate limit
    
    # 2. Primeira mensagem do usuário
    print_section("FASE 2: PRIMEIRA INTERAÇÃO", Colors.CYAN)
    user_msg_1 = "Olá! Tenho uma cafeteria em São Paulo chamada Café Aroma"
    messages.append({"role": "user", "content": user_msg_1})
    
    result = simulate_chat_message(messages, user_msg_1, extracted_profile)
    
    if result.get('reply'):
        messages.append({"role": "assistant", "content": result['reply']})
        extracted_profile = result.get('extracted_profile', {})
    
    time.sleep(2)  # Rate limit
    
    # 3. Segunda mensagem - incluindo modelo B2C
    print_section("FASE 3: CONTINUAÇÃO DO DIÁLOGO", Colors.CYAN)
    user_msg_2 = "Atendo pessoas físicas (B2C), trabalho sozinho há 2 anos. Meu principal desafio é atrair mais clientes"
    messages.append({"role": "user", "content": user_msg_2})
    
    result = simulate_chat_message(messages, user_msg_2, extracted_profile)
    
    if result.get('reply'):
        messages.append({"role": "assistant", "content": result['reply']})
        extracted_profile = result.get('extracted_profile', {})
    
    time.sleep(2)  # Rate limit
    
    # 4. Terceira mensagem - objetivo
    print_section("FASE 4: OBJETIVO", Colors.CYAN)
    user_msg_3 = "Meu objetivo é aumentar o faturamento em 30% nos próximos 6 meses"
    messages.append({"role": "user", "content": user_msg_3})
    
    result = simulate_chat_message(messages, user_msg_3, extracted_profile)
    
    if result.get('reply'):
        messages.append({"role": "assistant", "content": result['reply']})
        extracted_profile = result.get('extracted_profile', {})
    
    time.sleep(2)  # Rate limit
    
    # 5. Quarta mensagem - capital disponível
    print_section("FASE 5: ORÇAMENTO", Colors.CYAN)
    user_msg_4 = "Posso investir até R$ 500 por mês em marketing"
    messages.append({"role": "user", "content": user_msg_4})
    
    result = simulate_chat_message(messages, user_msg_4, extracted_profile)
    
    if result.get('reply'):
        messages.append({"role": "assistant", "content": result['reply']})
        extracted_profile = result.get('extracted_profile', {})
    
    time.sleep(2)  # Rate limit
    
    # 6. Quinta mensagem - canais de venda
    print_section("FASE 6: CANAIS DE VENDA", Colors.CYAN)
    user_msg_5 = "Vendo na loja física e uso WhatsApp para pedidos"
    messages.append({"role": "user", "content": user_msg_5})
    
    result = simulate_chat_message(messages, user_msg_5, extracted_profile)
    
    if result.get('reply'):
        messages.append({"role": "assistant", "content": result['reply']})
        extracted_profile = result.get('extracted_profile', {})
    
    time.sleep(2)  # Rate limit
    
    # 7. Sexta mensagem - cliente ideal
    print_section("FASE 7: CLIENTE IDEAL", Colors.CYAN)
    user_msg_6 = "Meus clientes são principalmente profissionais de 25-40 anos que trabalham na região"
    messages.append({"role": "user", "content": user_msg_6})
    
    result = simulate_chat_message(messages, user_msg_6, extracted_profile)
    
    if result.get('reply'):
        messages.append({"role": "assistant", "content": result['reply']})
        extracted_profile = result.get('extracted_profile', {})
    
    time.sleep(2)  # Rate limit
    
    # 8. Sétima mensagem - ticket médio
    print_section("FASE 8: TICKET MÉDIO", Colors.CYAN)
    user_msg_7 = "O valor médio por venda é cerca de R$ 25"
    messages.append({"role": "user", "content": user_msg_7})
    
    result = simulate_chat_message(messages, user_msg_7, extracted_profile)
    
    if result.get('reply'):
        messages.append({"role": "assistant", "content": result['reply']})
        extracted_profile = result.get('extracted_profile', {})
    
    time.sleep(2)  # Rate limit
    
    # 9. Oitava mensagem - modelo operacional
    print_section("FASE 9: MODELO OPERACIONAL", Colors.CYAN)
    user_msg_8 = "Tenho estoque próprio de grãos e produtos, tudo pronto para vender"
    messages.append({"role": "user", "content": user_msg_8})
    
    result = simulate_chat_message(messages, user_msg_8, extracted_profile)
    
    if result.get('reply'):
        messages.append({"role": "assistant", "content": result['reply']})
        extracted_profile = result.get('extracted_profile', {})
    
    time.sleep(2)  # Rate limit
    
    # 10. Nona mensagem - faturamento mensal (primeira tentativa)
    print_section("FASE 10: FATURAMENTO (1ª tentativa)", Colors.CYAN)
    user_msg_9 = "Faturamento atual está entre R$ 15 mil e R$ 20 mil por mês"
    messages.append({"role": "user", "content": user_msg_9})
    
    result = simulate_chat_message(messages, user_msg_9, extracted_profile)
    
    if result.get('reply'):
        messages.append({"role": "assistant", "content": result['reply']})
        extracted_profile = result.get('extracted_profile', {})
    
    time.sleep(2)  # Rate limit
    
    # 11. Décima mensagem - faturamento mensal (resposta direta se IA perguntar novamente)
    if not result.get('ready_for_analysis'):
        print_section("FASE 11: FATURAMENTO (2ª tentativa - resposta direta)", Colors.CYAN)
        user_msg_10 = "Meu faturamento mensal é cerca de R$ 17 mil"
        messages.append({"role": "user", "content": user_msg_10})
        
        result = simulate_chat_message(messages, user_msg_10, extracted_profile)
        
        if result.get('reply'):
            messages.append({"role": "assistant", "content": result['reply']})
            extracted_profile = result.get('extracted_profile', {})
    
    # 12. Verificar se está pronto para análise
    if result.get('ready_for_analysis'):
        print(f"\n{Colors.GREEN}{Colors.BOLD}✓ Perfil completo! Pronto para gerar análise.{Colors.END}")
        
        # DEBUG: Mostrar todos os campos coletados
        print(f"\n{Colors.CYAN}[DEBUG] extracted_profile completo:{Colors.END}")
        print(json.dumps(extracted_profile, indent=2, ensure_ascii=False))
        print()
        
        time.sleep(3)  # Rate limit antes da análise pesada
        
        # 6. Construir perfil estruturado (como o frontend faz)
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
                "equipe_solo": extracted_profile.get('num_funcionarios') in ['1', 'solo', 'só eu', 'sozinho'],
                "canais_existentes": extracted_profile.get('canais_venda', []),
                "principal_gargalo": extracted_profile.get('principal_gargalo'),
                "maior_objecao": extracted_profile.get('maior_objecao'),
            },
            "diagnostico_inicial": {
                "problemas_identificados": [{
                    "area": "geral",
                    "problema": extracted_profile.get('dificuldades', ''),
                    "severidade": 3,
                    "evidencia": "Relatado pelo usuário na conversa",
                    "restricao_afetada": extracted_profile.get('modelo_operacional')
                }],
                "pontos_fortes": [extracted_profile.get('diferencial', 'A definir')],
            },
            "categorias_relevantes": ["marketing digital", "vendas", "atendimento"],  # Categorias padrão para análise
            "queries_sugeridas": {},
            "objetivos_parseados": [{
                "objetivo": extracted_profile.get('objetivos', ''),
                "prazo": "médio prazo",
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
            }
        }
        
        # 7. Gerar análise
        analysis = generate_analysis(profile_for_analysis)
        
        if analysis:
            print_section("TESTE CONCLUIDO COM SUCESSO!", Colors.GREEN)
        else:
            print_section("TESTE CONCLUIDO COM AVISOS", Colors.YELLOW)
    else:
        print(f"\n{Colors.YELLOW}⚠️  Perfil ainda não está completo para análise.{Colors.END}")
        print_data("Campos faltando", result.get('fields_missing', []))
    
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
