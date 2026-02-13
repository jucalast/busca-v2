#!/usr/bin/env python3
"""Test capital_disponivel extraction and validation"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend', 'src', 'search_summarizer'))

from chat_consultant import _extract_number, _value_has_basis, _normalize, validate_extraction

# Simulate user's exact answers
test_cases = [
    {
        "user_text": "5 mil",
        "llm_extracted": {"capital_disponivel": "R$ 5.000"},
        "field": "capital_disponivel",
        "description": "User says '5 mil', LLM extracts 'R$ 5.000'"
    },
    {
        "user_text": "5 mil",
        "llm_extracted": {"capital_disponivel": "5000"},
        "field": "capital_disponivel",
        "description": "User says '5 mil', LLM extracts '5000'"
    },
    {
        "user_text": "5 mil",
        "llm_extracted": {"capital_disponivel": "5 mil"},
        "field": "capital_disponivel",
        "description": "User says '5 mil', LLM extracts '5 mil'"
    },
    {
        "user_text": "5 mil",
        "llm_extracted": {"investimento_marketing": "5000"},
        "field": "investimento_marketing",
        "description": "User says '5 mil', LLM saves to WRONG field (investimento_marketing)"
    }
]

print("=" * 70)
print("TESTE: capital_disponivel extraction & validation")
print("=" * 70)

for i, case in enumerate(test_cases, 1):
    print(f"\n[Caso {i}] {case['description']}")
    print(f"  User text: '{case['user_text']}'")
    
    # Test _extract_number
    user_number = _extract_number(case['user_text'])
    llm_value = list(case['llm_extracted'].values())[0]
    llm_number = _extract_number(str(llm_value))
    
    print(f"  User number extracted: {user_number}")
    print(f"  LLM value: '{llm_value}'")
    print(f"  LLM number extracted: {llm_number}")
    
    # Test _value_has_basis
    field = case['field']
    user_lower = case['user_text'].lower()
    has_basis = _value_has_basis(field, llm_value, user_lower)
    
    print(f"  _value_has_basis({field}, '{llm_value}', '{user_lower}') = {has_basis}")
    
    # Test validate_extraction
    all_user_text = case['user_text']
    previous_profile = {}
    validated = validate_extraction(case['llm_extracted'], all_user_text, previous_profile)
    
    print(f"  validate_extraction() result: {validated}")
    
    if validated.get(field):
        print(f"  ✅ PASSOU: Campo '{field}' foi validado com valor '{validated[field]}'")
    else:
        print(f"  ❌ FALHOU: Campo '{field}' foi REJEITADO pela validação")
    
print("\n" + "=" * 70)

# Special case: test with full conversation context
print("\n[TESTE COMPLETO] Simulação do fluxo real:\n")

conversation_context = """
j.ferres, cartonagem, b2b
indaiatuba
tenho poucas vendas, meta de fauramento 2 milhoes
5 mil
"""

previous_profile = {
    "nome_negocio": "J. Ferres",
    "segmento": "cartonagem",
    "modelo": "B2B",
    "localizacao": "Indaiatuba",
    "dificuldades": "poucas vendas",
    "objetivos": "meta de faturamento 2 milhões"
}

# Simulate LLM trying different variations
llm_attempts = [
    {"capital_disponivel": "R$ 5.000"},
    {"capital_disponivel": "5000"},
    {"capital_disponivel": "5 mil"},
    {"investimento_marketing": "5000"},
]

for attempt in llm_attempts:
    field_name = list(attempt.keys())[0]
    field_value = list(attempt.values())[0]
    
    print(f"Tentativa LLM: {attempt}")
    validated = validate_extraction(attempt, conversation_context, previous_profile)
    
    if validated.get(field_name):
        print(f"  ✅ VALIDADO: {validated}")
        break
    else:
        print(f"  ❌ REJEITADO")

print("\n" + "=" * 70)
