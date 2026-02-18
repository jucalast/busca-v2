# Sistema de Persistência - Multi-Business

## Visão Geral

Sistema de banco de dados SQLite para gerenciar múltiplos negócios por usuário, com histórico completo de análises e chats por dimensão.

## Estrutura do Banco de Dados

### Localização
- **Arquivo**: `data/growth_platform.db`
- **Tipo**: SQLite3 com suporte a JSON

### Tabelas

#### 1. **users** - Usuários da plataforma
```sql
- id (TEXT, PK): Identificador único do usuário
- email (TEXT, UNIQUE): Email do usuário
- name (TEXT): Nome do usuário
- created_at (TEXT): Data de criação (ISO 8601)
- metadata (TEXT/JSON): Dados adicionais flexíveis
```

#### 2. **businesses** - Negócios gerenciados
```sql
- id (TEXT, PK): UUID do negócio
- user_id (TEXT, FK): Proprietário do negócio
- name (TEXT): Nome do negócio
- segment (TEXT): Segmento de atuação
- model (TEXT): Modelo de negócio (B2B/B2C/D2C)
- location (TEXT): Localização
- profile_data (TEXT/JSON): Perfil completo do negócio
- status (TEXT): Estado (active/deleted)
- created_at (TEXT): Data de criação
- updated_at (TEXT): Última atualização
```

#### 3. **analyses** - Análises de crescimento
```sql
- id (TEXT, PK): UUID da análise
- business_id (TEXT, FK): Negócio analisado
- score_data (TEXT/JSON): Dados de score e dimensões
- task_data (TEXT/JSON): Plano de tarefas
- market_data (TEXT/JSON): Dados de mercado pesquisados
- score_geral (INTEGER): Score geral (0-100)
- classificacao (TEXT): Classificação (Crítico/Fraco/Médio/Forte/Excelente)
- created_at (TEXT): Data da análise
```

#### 4. **dimension_chats** - Histórico de conversas por dimensão
```sql
- id (TEXT, PK): UUID do chat
- analysis_id (TEXT, FK): Análise relacionada
- dimension (TEXT): Dimensão específica
- messages (TEXT/JSON): Array de mensagens
- created_at (TEXT): Criação do chat
- updated_at (TEXT): Última mensagem
```

## Fluxo de Dados

### 1. Novo Usuário / Primeiro Acesso
```
Usuário → BusinessSelector (lista vazia)
        → Criar Novo Negócio
        → GrowthChat (onboarding)
        → Análise completa
        → Criar: user + business + analysis
```

### 2. Usuário Retornando
```
Usuário → BusinessSelector (lista negócios)
        → Selecionar negócio existente
        → Carregar última análise
        → GrowthHub (resultados)
```

### 3. Nova Análise para Negócio Existente
```
Negócio existente → Onboarding atualizado
                  → Nova análise (histórico preservado)
                  → Atualiza business.updated_at
```

## API Endpoints

### Gerenciamento de Negócios

#### `list-businesses`
```json
Request: { "action": "list-businesses", "user_id": "xxx" }
Response: {
  "success": true,
  "businesses": [
    {
      "id": "uuid",
      "name": "Nome do Negócio",
      "segment": "Segmento",
      "latest_analysis": { "score_geral": 85, ... }
    }
  ]
}
```

#### `get-business`
```json
Request: { "action": "get-business", "business_id": "uuid" }
Response: {
  "success": true,
  "business": {
    "id": "uuid",
    "profile_data": { ... },
    "latest_analysis": { ... }
  }
}
```

#### `create-business`  
```json
Request: { "action": "create-business", "user_id": "xxx", "profile": {...} }
Response: {
  "success": true,
  "business": { "id": "uuid", ... }
}
```

### Análises

#### `analyze` (modificada)
Agora aceita `business_id` e `user_id` opcionais:
- Se `business_id` fornecido: atualiza negócio existente
- Se não fornecido: cria novo negócio automaticamente

```json
Request: {
  "action": "analyze",
  "profile": {...},
  "business_id": "uuid",  // opcional
  "user_id": "xxx"        // opcional
}
Response: {
  "success": true,
  "business_id": "uuid",
  "analysis_id": "uuid",
  "score": {...},
  "taskPlan": {...},
  "marketData": {...}
}
```

#### `save-analysis`
Salva análise manualmente (caso precise):
```json
Request: {
  "action": "save-analysis",
  "business_id": "uuid",
  "score": {...},
  "taskPlan": {...},
  "marketData": {...}
}
```

## Módulo Python: database.py

### Principais Funções

#### Usuários
- `create_user(user_id, email, name, metadata)` → Dict
- `get_user(user_id)` → Optional[Dict]
- `get_or_create_user(user_id, email, name)` → Dict

#### Negócios
- `create_business(user_id, name, profile_data)` → Dict
- `get_business(business_id)` → Optional[Dict]
- `list_user_businesses(user_id, status='active')` → List[Dict]
- `update_business(business_id, profile_data)` → bool
- `delete_business(business_id)` → bool (soft delete)

#### Anális
- `create_analysis(business_id, score_data, task_data, market_data)` → Dict
- `get_latest_analysis(business_id)` → Optional[Dict]
- `list_business_analyses(business_id, limit=10)` → List[Dict]

#### Chats de Dimensões
- `save_dimension_chat(analysis_id, dimension, messages)` → Dict
- `get_dimension_chat(analysis_id, dimension)` → Optional[Dict]

## Integração com Frontend

### Componentes

#### `BusinessSelector`
- Lista todos os negócios do usuário
- Mostra score da última análise
- Botão para criar novo negócio
- Clique em negócio carrega análise

#### `page.tsx` (modificado)
```typescript
// Novos estados
const [userId] = useState('default_user');
const [currentBusinessId, setCurrentBusinessId] = useState<string | null>(null);
const [growthStage, setGrowthStage] = useState<'selector' | 'onboarding' | 'analyzing' | 'results'>('selector');

// Novos handlers
handleSelectBusiness(businessId)     // Carrega negócio e análise
handleCreateNewBusiness()            // Inicia novo negócio
handleBackToBusinessSelector()       // Volta ao seletor
```

## Migrações Futuras

### Possíveis Melhorias
1. **Autenticação Real**: Substituir `default_user` por auth verdadeiro
2. **Compartilhamento**: Negócios compartilhados entre usuários
3. **Versioning**: Manter histórico completo de mudanças no perfil
4. **Analytics**: Dashboard de evolução do score ao longo do tempo
5. **Export/Import**: Backup e restauração de negócios
6. **Tags/Categories**: Organização de negócios por categorias

## Notas de Implementação

### Características
- ✅ Schema flexível (JSONs para dados complexos)
- ✅ Soft delete (preserva histórico)
- ✅ Indexação para queries comuns
- ✅ Auto-inicialização do banco
- ✅ Suporte a múltiplos negócios por usuário
- ✅ Histórico completo de análises
- ✅ Persistência de chats por dimensão

### Limitações Atuais
- Usuário hardcoded como "default_user" (precisa auth)
- Sem controle de acesso/permissões
- Sem limite de negócios por usuário
- Sem paginação na listagem

### Segurança
- SQLite local (sem exposição de rede)
- Row_factory para prevenir SQL injection
- Validação de tipos Python
- UUIDs aleatórios para IDs

## Exemplo de Uso Completo

```python
from database import *

# 1. Criar/obter usuário
user = get_or_create_user("user123", "user@example.com", "João")

# 2. Criar negócio
profile = {
    "perfil": {
        "nome": "Loja X",
        "segmento": "E-commerce",
        "modelo_negocio": "B2C",
        "localizacao": "São Paulo"
    }
}
business = create_business(user["id"], "Loja X", profile)

# 3. Salvar análise
score = {"score_geral": 75, "dimensoes": {...}}
tasks = {"tasks": [...]}
market = {"categories": [...]}
analysis = create_analysis(business["id"], score, tasks, market)

# 4. Listar negócios do usuário
businesses = list_user_businesses(user["id"])

# 5. Carregar última análise
latest = get_latest_analysis(business["id"])
```
