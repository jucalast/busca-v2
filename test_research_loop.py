"""Test: research loop prevention + sources returned"""
import requests
import json
import time

url = 'http://localhost:3000/api/growth'

profile = {
    'nome_negocio': 'Troty',
    'segmento': 'brownies caseiros',
    'modelo': 'B2C',
    'localizacao': 'Indaiatuba',
    'dificuldades': 'poucas vendas',
    'objetivos': 'aumentar faturamento',
    'capital_disponivel': '500',
    'num_funcionarios': 'eu e meu filho',
    'canais_venda': 'Instagram e na rua',
}

# Test 1: user says 'nao sei' for cliente_ideal -> should search
msgs = [
    {'role': 'assistant', 'content': 'Descreva seu cliente ideal - idade, perfil, caracteristicas.'},
    {'role': 'user', 'content': 'nao sei'},
]
print('=== TEST 1: nao sei -> should search ===')
r = requests.post(url, json={
    'action': 'chat',
    'messages': msgs,
    'user_message': 'nao sei',
    'extracted_profile': profile
}, timeout=120)
d = r.json()
print('REPLY:', d.get('reply', '')[:300])
print('SEARCHED:', d.get('search_performed'))
sources = d.get('search_sources', [])
print(f'SOURCES: {len(sources)} found')
for s in sources[:3]:
    print(f'  - {s.get("title", "?")} | {s.get("url", "?")}')
pending = d.get('extracted_profile', {}).get('_research_pending')
print('PENDING:', bool(pending))
if pending:
    print(f'  field: {pending.get("field")}, value: {pending.get("suggested_value", "")[:80]}')
print()

# Test 2: user says 'nao sei' AGAIN while pending -> should auto-accept, NOT re-search
if pending:
    time.sleep(3)
    msgs2 = msgs + [
        {'role': 'assistant', 'content': d['reply']},
        {'role': 'user', 'content': 'nao sei'},
    ]
    print('=== TEST 2: nao sei AGAIN -> should auto-accept ===')
    r2 = requests.post(url, json={
        'action': 'chat',
        'messages': msgs2,
        'user_message': 'nao sei',
        'extracted_profile': d['extracted_profile']
    }, timeout=120)
    d2 = r2.json()
    print('REPLY:', d2.get('reply', '')[:300])
    print('SEARCHED:', d2.get('search_performed'))
    ep2 = d2.get('extracted_profile', {})
    print('RESEARCHED FIELDS:', ep2.get('_fields_researched', []))
    print('STILL PENDING:', bool(ep2.get('_research_pending')))
    print('cliente_ideal value:', ep2.get('cliente_ideal', 'NOT SET'))
    print()

print('=== DONE ===')
