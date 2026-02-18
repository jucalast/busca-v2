"""
Teste focado em ANÁLISE - Debug detalhado da geração de análise completa
Use este quando o chat funciona mas quer debugar a análise em si
"""
import requests
import json
import time
from datetime import datetime
from typing import Dict, Any

BASE_URL = "http://localhost:3000"
API_ENDPOINT = f"{BASE_URL}/api/growth"

# Perfil de exemplo completo e realista
SAMPLE_PROFILE = {
    "perfil": {
        "nome": "Café Aroma",
        "segmento": "Alimentação",
        "localizacao": "São Paulo - SP",
        "modelo_negocio": "B2C",
        "tipo_oferta": "produto",
        "tempo_mercado": "2 anos",
        "ticket_medio_estimado": "R$ 25",
        "faturamento_faixa": "R$ 15.000 - R$ 30.000/mês",
        "num_funcionarios": "1",
        "investimento_marketing": "R$ 500/mês",
        "dificuldades": "Dificuldade em atrair novos clientes e competição com grandes redes",
        "modelo_operacional": "presencial",
    },
    "restricoes_criticas": {
        "modelo_operacional": "presencial",
        "capital_disponivel": "baixo",
        "equipe_solo": True,
        "canais_existentes": ["loja física"],
        "principal_gargalo": "marketing",
        "maior_objecao": "preço",
    },
    "diagnostico_inicial": {
        "problemas_identificados": [
            {
                "area": "marketing",
                "problema": "Baixa visibilidade online",
                "severidade": 4,
                "evidencia": "Relatado pelo usuário",
                "restricao_afetada": "presencial"
            },
            {
                "area": "vendas",
                "problema": "Competição com grandes redes",
                "severidade": 3,
                "evidencia": "Contexto de mercado",
                "restricao_afetada": None
            }
        ],
        "pontos_fortes": [
            "Localização em São Paulo",
            "2 anos de experiência no mercado"
        ],
    },
    "categorias_relevantes": ["marketing digital", "fidelização", "redes sociais"],
    "queries_sugeridas": {},
    "objetivos_parseados": [
        {
            "objetivo": "Aumentar faturamento em 30% nos próximos 6 meses",
            "prazo": "6 meses",
            "area_relacionada": "vendas"
        }
    ],
    "_chat_context": {
        "concorrentes": "Grandes redes de cafeteria e cafeterias locais",
        "cliente_ideal": "Jovens profissionais de 25-40 anos",
        "canais_venda": ["loja física"],
        "investimento_marketing": "R$ 500/mês",
        "margem_lucro": "35%",
        "tempo_entrega": None,
        "origem_clientes": "Passantes e indicação",
    }
}

def print_stage(stage: str, symbol: str = "🔄"):
    """Imprime estágio atual"""
    print(f"\n{'─'*80}")
    print(f"{symbol} {stage}")
    print(f"{'─'*80}")

def analyze_profile(profile: Dict[str, Any]) -> Dict[str, Any]:
    """Envia perfil para análise e monitora progresso"""
    
    print("="*80)
    print("🚀 ANÁLISE COMPLETA - TESTE DETALHADO")
    print("="*80)
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    # Mostra perfil que será analisado
    print_stage("PERFIL A SER ANALISADO", "📋")
    print(json.dumps(profile, indent=2, ensure_ascii=False))
    
    # Prepara requisição
    payload = {
        "action": "analyze",
        "profile": profile
    }
    
    print_stage("ENVIANDO REQUISIÇÃO", "📤")
    print(f"Endpoint: {API_ENDPOINT}")
    print(f"Tamanho do payload: {len(json.dumps(payload))} bytes")
    
    # Inicia análise
    print_stage("PROCESSANDO ANÁLISE (pode levar 60-180s)", "⏳")
    print("Etapas esperadas:")
    print("  1️⃣  Validação do perfil")
    print("  2️⃣  Busca de informações contextuais")
    print("  3️⃣  Análise preditiva por GPT")
    print("  4️⃣  Geração de scores e dimensões")
    print("  5️⃣  Criação de tarefas específicas")
    print("  6️⃣  Scoring final e classificação\n")
    
    start_time = time.time()
    dots = 0
    
    try:
        # Lista para armazenar status de progresso
        status_updates = []
        
        # Faz a requisição
        response = requests.post(
            API_ENDPOINT,
            json=payload,
            timeout=300,  # 5 minutos max
            stream=False
        )
        
        elapsed = time.time() - start_time
        
        print(f"\n✅ Resposta recebida em {elapsed:.1f} segundos")
        
        if response.status_code == 200:
            data = response.json()
            
            # DEBUG: Mostrar JSON completo
            print_stage("JSON COMPLETO DA RESPOSTA (DEBUG)", "🔍")
            print(json.dumps(data, indent=2, ensure_ascii=False)[:2000])  # Primeiros 2000 chars
            print()
            
            if data.get('success'):
                # Os dados estão em 'score', não 'analysis'
                analysis = data.get('score', {})
                
                # SCORES GERAIS
                print_stage("SCORES GERAIS", "📊")
                print(f"Score Geral: {analysis.get('score_geral', 0)}/100")
                print(f"Classificação: {analysis.get('classificacao', 'N/A')}")
                print(f"\nResumo Executivo:")
                print(f"  {analysis.get('resumo_executivo', 'N/A')}\n")
                
                # DIMENSÕES
                print_stage("DIMENSÕES DETALHADAS", "🎯")
                dimensoes = analysis.get('dimensoes', {})
                
                if dimensoes:
                    for dim_key, dim_data in dimensoes.items():
                        score = dim_data.get('score', 0)
                        emoji = "🟢" if score >= 70 else "🟡" if score >= 40 else "🔴"
                        
                        print(f"\n{emoji} {dim_key.upper()} - Score: {score}/100")
                        print(f"   Justificativa: {dim_data.get('justificativa', 'N/A')[:150]}...")
                        
                        if dim_data.get('problemas'):
                            print(f"   Problemas identificados: {len(dim_data['problemas'])}")
                        
                        if dim_data.get('oportunidades'):
                            print(f"   Oportunidades: {len(dim_data['oportunidades'])}")
                else:
                    print("⚠️  Nenhuma dimensão retornada")
                
                # TAREFAS
                print_stage("TAREFAS GERADAS", "📝")
                # Tarefas estão em data['taskPlan'], não em analysis
                tasks = data.get('taskPlan', {}).get('categorias', {})
                
                if tasks:
                    print(f"Total de tarefas: {len(tasks)}\n")
                    
                    # Agrupa por categoria
                    by_category = {}
                    for task in tasks:
                        cat = task.get('categoria', 'outros')
                        if cat not in by_category:
                            by_category[cat] = []
                        by_category[cat].append(task)
                    
                    for cat, cat_tasks in by_category.items():
                        print(f"📂 {cat.upper()}: {len(cat_tasks)} tarefas")
                        
                        # Mostra primeira tarefa como exemplo
                        if cat_tasks:
                            first_task = cat_tasks[0]
                            print(f"   └─ {first_task.get('acao', 'N/A')[:80]}...")
                            print(f"      Impacto: {first_task.get('impacto_esperado', 'N/A')[:60]}...")
                            print(f"      Dificuldade: {first_task.get('dificuldade', 'N/A')}")
                        print()
                else:
                    print("⚠️  Nenhuma tarefa gerada")
                
                # FONTES
                print_stage("FONTES DE INFORMAÇÃO", "📚")
                # Fontes estão em data['marketData']['allSources']
                sources = data.get('marketData', {}).get('allSources', [])
                
                if sources:
                    print(f"Total de fontes consultadas: {len(sources)}\n")
                    
                    for i, source in enumerate(sources[:5], 1):
                        print(f"{i}. {source.get('title', 'Sem título')}")
                        print(f"   🔗 {source.get('url', 'N/A')}")
                        print()
                    
                    if len(sources) > 5:
                        print(f"... e mais {len(sources) - 5} fontes")
                else:
                    print("⚠️  Nenhuma fonte retornada")
                
                # ESTATÍSTICAS FINAIS
                print_stage("ESTATÍSTICAS DA ANÁLISE", "📈")
                print(f"Tempo total: {elapsed:.1f}s")
                print(f"Dimensões analisadas: {len(dimensoes)}")
                print(f"Tarefas geradas: {len(tasks)}")
                print(f"Fontes consultadas: {len(sources)}")
                print(f"Tamanho da resposta: {len(json.dumps(analysis))} bytes")
                
                # VALIDAÇÃO
                print_stage("VALIDAÇÃO", "✅")
                
                validations = {
                    "Score geral presente": analysis.get('score_geral') is not None,
                    "Classificação presente": bool(analysis.get('classificacao')),
                    "Resumo executivo presente": bool(analysis.get('resumo_executivo')),
                    "Dimensões presentes": len(dimensoes) > 0,
                    "Tarefas geradas": len(tasks) > 0,
                    "Fontes consultadas": len(sources) > 0,
                }
                
                for check, passed in validations.items():
                    status = "✅" if passed else "❌"
                    print(f"{status} {check}")
                
                all_passed = all(validations.values())
                
                print("\n" + "="*80)
                if all_passed:
                    print("🎉 ANÁLISE COMPLETA E VÁLIDA!")
                else:
                    print("⚠️  ANÁLISE INCOMPLETA - Verifique os itens marcados com ❌")
                print("="*80)
                
                return analysis
                
            else:
                print_stage("ERRO NA ANÁLISE", "❌")
                print(f"Erro retornado: {data.get('error', 'Erro desconhecido')}")
                return {}
        else:
            print_stage("ERRO HTTP", "❌")
            print(f"Status code: {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return {}
            
    except requests.Timeout:
        print_stage("TIMEOUT", "⏱️")
        print("A requisição excedeu o tempo limite de 5 minutos")
        print("Isso pode indicar:")
        print("  - Problemas com a API do OpenAI")
        print("  - Problemas com busca web")
        print("  - Processamento muito lento no backend")
        return {}
        
    except Exception as e:
        print_stage("ERRO INESPERADO", "💥")
        print(f"Erro: {str(e)}")
        import traceback
        traceback.print_exc()
        return {}

def main():
    """Executa teste de análise"""
    print("\n🎯 TESTE FOCADO EM ANÁLISE")
    print("Este teste usa um perfil de exemplo pré-montado")
    print("para debugar especificamente a geração de análise.\n")
    
    input("Pressione ENTER para iniciar o teste...")
    
    result = analyze_profile(SAMPLE_PROFILE)
    
    if result:
        print("\n💾 Para salvar os resultados, copie o output acima")
    else:
        print("\n⚠️  Nenhum resultado obtido - verifique os erros acima")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Teste interrompido pelo usuário")
    except Exception as e:
        print(f"\n\n❌ Erro fatal: {str(e)}")
        import traceback
        traceback.print_exc()
