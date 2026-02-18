# 🧪 Sistema de Testes - Debug Estruturado

## 📋 Visão Geral

Suite completa de testes que simula **exatamente** o fluxo que o frontend executa, mostrando cada raciocínio da IA em tempo real de forma estruturada.

## 🎯 Scripts Disponíveis

### 1. `test_quick.py` - Teste Rápido ⚡
**Quando usar:** Validação básica, verificar se tudo está funcionando

**O que faz:**
- ✅ Testa se o servidor está respondendo
- ✅ Inicia uma conversa
- ✅ Envia uma mensagem de teste
- ⏱️ Leva ~10-15 segundos

```bash
python test_quick.py
```

### 2. `test_analysis.py` - Teste de Análise 🎯
**Quando usar:** Debugar especificamente a geração de análise completa

**O que faz:**
- 📋 Usa um perfil de exemplo pré-montado
- 🔍 Mostra cada etapa da análise
- 📊 Valida scores, dimensões, tarefas
- 📚 Lista fontes consultadas
- ⏱️ Leva ~60-180 segundos

```bash
python test_analysis.py
```

### 3. `test_full_flow.py` - Fluxo Completo 🚀
**Quando usar:** Testar todo o sistema end-to-end, debugar interação completa

**O que faz:**
- 💬 Simula conversa completa (3-4 mensagens)
- 📈 Mostra extração progressiva do perfil
- 🤖 Exibe cada resposta da IA
- 🔍 Mostra buscas realizadas
- 📊 Gera análise completa no final
- ⏱️ Leva ~3-5 minutos

```bash
python test_full_flow.py
```

## 📦 Pré-requisitos

```bash
# 1. Certifique-se que o servidor Next.js está rodando
npm run dev

# 2. Instale a biblioteca requests (se não tiver)
pip install requests

# 3. Verifique que as variáveis de ambiente estão configuradas
# (.env com OpenAI API key, etc)
```

## 🎨 Output Visual

Todos os scripts usam cores para facilitar leitura:

- 🔵 **Azul** - Labels e estruturas de dados
- 🟢 **Verde** - Sucessos e conclusões
- 🟡 **Amarelo** - Avisos e seções em progresso
- 🔴 **Vermelho** - Erros e problemas
- 🟣 **Roxo** - Headers principais
- 🟠 **Ciano** - Subseções e detalhes

## 📊 Informações Exibidas

### Em todos os testes:

- ⏱️ Timestamps de início e fim
- 📤 Payloads enviados (JSON completo)
- ⏳ Tempo de resposta de cada operação
- ✅ Status de sucesso/falha
- 📋 Dados retornados estruturados

### No teste completo (`test_full_flow.py`):

- 🗨️ Cada mensagem do chat
- 🤖 Respostas da IA
- 🔍 Queries de busca realizadas
- 📊 Estado do perfil em cada etapa
- 📝 Campos coletados vs faltando
- 🎯 Análise final com scores
- 📈 Dimensões detalhadas
- ✅ Tarefas geradas
- 📚 Fontes consultadas

### No teste de análise (`test_analysis.py`):

- 📋 Perfil usado (pré-montado)
- 🚀 Etapas da análise em tempo real
- 📊 Scores por dimensão
- 🎯 Validações automáticas
- 📈 Estatísticas (tempo, tamanho)
- ✅ Checklist de validação

## ⚙️ Configuração Avançada

### Modificar mensagens de teste (test_full_flow.py):

```python
# Linha ~180
user_msg_1 = "Sua mensagem aqui"
user_msg_2 = "Próxima mensagem"
user_msg_3 = "Última mensagem"
```

### Modificar perfil de teste (test_analysis.py):

```python
# Linha ~12 - Edite o objeto SAMPLE_PROFILE
SAMPLE_PROFILE = {
    "perfil": {
        "nome": "Seu Negócio",
        # ... outros campos
    }
}
```

### Mudar endpoint:

```python
# Em qualquer script
BASE_URL = "http://localhost:3001"  # Se rodando em porta diferente
```

### Ajustar timeouts:

```python
# Para análises mais demoradas
response = requests.post(API_ENDPOINT, json=payload, timeout=600)  # 10 minutos
```

## 🐛 Troubleshooting

### ❌ Erro: "Connection refused"
**Problema:** Servidor não está rodando

**Solução:**
```bash
# Inicie o servidor
npm run dev

# Ou se tiver erro de porta:
npx kill-port 3000
npm run dev
```

### ❌ Erro: "Timeout" 
**Problema:** Análise demorou muito

**Possíveis causas:**
- API do OpenAI está lenta
- Busca web está travando
- Rate limit atingido

**Soluções:**
```python
# Aumente o timeout no script
timeout=600  # 10 minutos

# Ou adicione mais delay entre requests
time.sleep(5)
```

### ❌ Erro: "Rate limit exceeded"
**Problema:** Muitas requisições à API

**Solução:**
```python
# Aumente delays entre mensagens
time.sleep(5)  # Ou mais

# Use teste rápido ao invés do completo
python test_quick.py
```

### ❌ Erro: "ModuleNotFoundError: No module named 'requests'"
**Problema:** Biblioteca não instalada

**Solução:**
```bash
pip install requests
# ou
pip3 install requests
```

### ⚠️ Servidor na porta errada (3001 ao invés de 3000)
**Problema:** Outra aplicação está usando porta 3000

**Solução:**
```python
# Altere no script:
BASE_URL = "http://localhost:3001"
```

## 💡 Dicas de Uso

### Para desenvolvimento:
1. Use `test_quick.py` para validar mudanças rápidas
2. Use `test_analysis.py` quando alterar lógica de scoring
3. Use `test_full_flow.py` para validação completa antes de deploy

### Para debugging:
- Copie o JSON de payload/response para análise offline
- Use `> output.txt` para salvar output completo:
  ```bash
  python test_full_flow.py > output.txt
  ```
- Compare outputs entre versões para ver o que mudou

### Para economizar tokens:
- Use `test_quick.py` ao invés do completo
- Comente a parte de análise se quiser testar só o chat
- Reduza número de mensagens em `test_full_flow.py`

## ⚡ Rate Limiting

Os scripts respeitam limites da API com delays automáticos:

- **Entre mensagens:** 2 segundos
- **Antes da análise:** 3 segundos

Se ainda encontrar rate limits:

```python
# Aumente os delays globalmente
DELAY_BETWEEN_MESSAGES = 5
DELAY_BEFORE_ANALYSIS = 10
```

## 📝 Exemplo de Output Esperado

### test_quick.py:
```
============================================================
  🧪 TESTE RÁPIDO - VALIDAÇÃO BÁSICA
============================================================
Timestamp: 2026-02-18 15:30:45
Endpoint: http://localhost:3000/api/growth

🏥 Testando saúde do servidor...
✅ Servidor respondendo - Status: 200

💬 Testando inicialização do chat...
✅ Chat inicializado
   Resposta: Olá! Vou te ajudar a fazer uma análise completa...

📨 Testando envio de mensagem...
✅ Mensagem processada
   Resposta: Ótimo! Uma cafeteria é um negócio com muito potencial...
   Campos coletados: 2
   Busca realizada: False

============================================================
📊 RESULTADO: 3/3 testes passaram
✅ Todos os testes passaram!
============================================================
```

### test_analysis.py:
```
================================================================================
🚀 ANÁLISE COMPLETA - TESTE DETALHADO
================================================================================
Timestamp: 2026-02-18 15:32:10

────────────────────────────────────────────────────────────────────────────────
📋 PERFIL A SER ANALISADO
────────────────────────────────────────────────────────────────────────────────
{
  "perfil": {
    "nome": "Café Aroma",
    "segmento": "Alimentação",
    ...
  }
}

────────────────────────────────────────────────────────────────────────────────
⏳ PROCESSANDO ANÁLISE (pode levar 60-180s)
────────────────────────────────────────────────────────────────────────────────
Etapas esperadas:
  1️⃣  Validação do perfil
  2️⃣  Busca de informações contextuais
  3️⃣  Análise preditiva por GPT
  4️⃣  Geração de scores e dimensões
  5️⃣  Criação de tarefas específicas
  6️⃣  Scoring final e classificação

✅ Resposta recebida em 87.3 segundos

────────────────────────────────────────────────────────────────────────────────
📊 SCORES GERAIS
────────────────────────────────────────────────────────────────────────────────
Score Geral: 62/100
Classificação: Potencial Médio

Resumo Executivo:
  O Café Aroma tem boa base operacional mas precisa melhorar...

────────────────────────────────────────────────────────────────────────────────
🎯 DIMENSÕES DETALHADAS
────────────────────────────────────────────────────────────────────────────────

🟡 MARKETING - Score: 45/100
   Justificativa: Presença digital limitada, baixo investimento...
   Problemas identificados: 3
   Oportunidades: 5

🟢 PRODUTO - Score: 75/100
   Justificativa: Produto de qualidade com boa aceitação...
   Problemas identificados: 1
   Oportunidades: 3

...

────────────────────────────────────────────────────────────────────────────────
✅ VALIDAÇÃO
────────────────────────────────────────────────────────────────────────────────
✅ Score geral presente
✅ Classificação presente
✅ Resumo executivo presente
✅ Dimensões presentes
✅ Tarefas geradas
✅ Fontes consultadas

================================================================================
🎉 ANÁLISE COMPLETA E VÁLIDA!
================================================================================
```

## 📚 Estrutura dos Scripts

```
test_quick.py           # ~100 linhas - Validação básica
test_analysis.py        # ~300 linhas - Debug de análise
test_full_flow.py       # ~400 linhas - Fluxo end-to-end completo
TEST_README.md          # Este arquivo - Documentação
```

## ⚠️ Notas Importantes

- ✅ **Nada é mockado** - Todas as chamadas são reais à API
- ✅ **Tempo real** - Você vê tudo acontecendo ao vivo
- ✅ **Idêntico ao frontend** - Usa as mesmas APIs e payloads
- ⚠️ **Consome créditos da API** - Use com moderação
- ⚠️ **Rate limits aplicam** - Respeite os delays automáticos
- 🔒 **Ambiente local** - Certifique-se que .env está configurado
- 📊 **Output extenso** - O teste completo pode gerar MB de texto
- ⏱️ **Pode demorar** - Análise completa leva 1-3 minutos

## 🚀 Quick Start

```bash
# 1. Inicie o servidor
npm run dev

# 2. Teste básico (10 segundos)
python test_quick.py

# 3. Se tudo OK, teste completo (3-5 minutos)
python test_full_flow.py

# 4. Para debugar apenas análise (1-2 minutos)
python test_analysis.py
```

## 🤝 Contribuindo

Para adicionar novos testes:

1. Copie um dos scripts existentes como template
2. Modifique os payloads conforme necessário
3. Adicione validações específicas
4. Documente no README

## 📞 Suporte

Se encontrar problemas:

1. Verifique se o servidor está rodando
2. Confira variáveis de ambiente (.env)
3. Tente o teste rápido primeiro
4. Verifique logs do servidor Next.js
5. Aumente timeouts se necessário
