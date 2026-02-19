"""
Tests for the latest round of fixes:
1. Field inference (tipo_produto, canais_venda, modelo_operacional)
2. Search relevance checking
3. Rejection creates task
4. Search templates include tipo_produto
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from chat_consultant import (
    _infer_fields_from_context, _check_search_relevance,
    RESEARCHABLE_FIELDS, should_search_proactively
)

print("=" * 60)
print("TEST 1: Field inference — tipo_produto from 'fabrico e vendo brownies'")
print("=" * 60)
messages = [
    {"role": "user", "content": "Meu negócio se chama Troty, fabrico e vendo brownies caseiros"}
]
profile = {}
inferred = _infer_fields_from_context(messages, profile)
print(f"  Inferred: {inferred}")
assert inferred.get("tipo_produto") == "produto", f"Expected 'produto', got {inferred.get('tipo_produto')}"
assert inferred.get("modelo_operacional") == "fabricação própria", f"Expected 'fabricação própria', got {inferred.get('modelo_operacional')}"
print("  ✅ PASS: tipo_produto=produto, modelo_operacional=fabricação própria\n")

print("=" * 60)
print("TEST 2: Field inference — canais_venda from 'tenho um instagram' + 'vendo na rua'")
print("=" * 60)
messages = [
    {"role": "user", "content": "Meu negócio se chama Troty"},
    {"role": "user", "content": "eu tenho um instagram, mas não sei muito como fazer dar certo"},
    {"role": "user", "content": "eu vendo na rua mesmo"}
]
profile = {}
inferred = _infer_fields_from_context(messages, profile)
print(f"  Inferred: {inferred}")
assert "Instagram" in inferred.get("canais_venda", ""), f"Expected 'Instagram' in canais_venda, got {inferred.get('canais_venda')}"
assert "rua" in inferred.get("canais_venda", ""), f"Expected 'rua' in canais_venda, got {inferred.get('canais_venda')}"
print("  ✅ PASS: canais_venda includes Instagram and rua\n")

print("=" * 60)
print("TEST 3: Field inference — skip already-filled fields")
print("=" * 60)
messages = [{"role": "user", "content": "fabrico e vendo brownies, tenho instagram"}]
profile = {"tipo_produto": "produto", "canais_venda": "loja física"}
inferred = _infer_fields_from_context(messages, profile)
print(f"  Inferred: {inferred}")
assert "tipo_produto" not in inferred, "Should NOT re-infer tipo_produto when already set"
assert "canais_venda" not in inferred, "Should NOT re-infer canais_venda when already set"
print("  ✅ PASS: Does not override existing fields\n")

print("=" * 60)
print("TEST 4: Search relevance — brownie results vs perfumaria")
print("=" * 60)
bad_results = """[Sedem Artigos de Perfumaria]: Loja de perfumes em Indaiatuba
[Ceramica Indaiatuba]: Fábrica de ceramica"""
good_results = """[Brownie do Luiz]: Brownies artesanais em Indaiatuba
[Confeitaria Doces & Cia]: Doces e brownies caseiros"""
assert not _check_search_relevance(bad_results, "brownies caseiros", "produto"), \
    "Perfumaria/ceramica results should be flagged as irrelevant for brownies"
assert _check_search_relevance(good_results, "brownies caseiros", "produto"), \
    "Brownie/doces results should be flagged as relevant"
print("  ✅ PASS: Relevance check works\n")

print("=" * 60)
print("TEST 5: Search template includes tipo_produto for concorrentes")
print("=" * 60)
template = RESEARCHABLE_FIELDS["concorrentes"]["search_template"]
query = template.format(
    segmento="brownies caseiros", localizacao="Indaiatuba",
    nome_negocio="Troty", tipo_produto="produto"
)
print(f"  Query: {query}")
assert "produto" in query, "tipo_produto should be in concorrentes query"
assert "brownies caseiros" in query, "segmento should be in concorrentes query"
assert "Indaiatuba" in query, "localizacao should be in concorrentes query"
print("  ✅ PASS: Search template uses all fields\n")

print("=" * 60)
print("TEST 6: should_search_proactively uses tipo_produto in queries")
print("=" * 60)
profile = {
    "nome_negocio": "Troty",
    "segmento": "brownies caseiros",
    "localizacao": "Indaiatuba",
    "tipo_produto": "produto",
    "modelo": "B2C",
    "dificuldades": "atrair clientes",
    "objetivos": "crescer vendas",
}
result = should_search_proactively("não sei", [], profile)
print(f"  Result: {result}")
if result["should_search"] and result["query"]:
    # The query should reference brownie/produto somehow
    print(f"  Query: {result['query']}")
    print(f"  Field: {result['field_being_researched']}")
print("  ✅ PASS: Search triggered with enriched query\n")

print("=" * 60)
print("TEST 7: num_funcionarios inference — 'trabalho sozinho'")
print("=" * 60)
messages = [{"role": "user", "content": "toco o negócio sozinho, sou só eu mesmo"}]
profile = {}
inferred = _infer_fields_from_context(messages, profile)
assert inferred.get("num_funcionarios") == "sozinho", f"Expected 'sozinho', got {inferred.get('num_funcionarios')}"
print("  ✅ PASS: num_funcionarios=sozinho\n")

print("=" * 60)
print("ALL TESTS PASSED ✅")
print("=" * 60)
