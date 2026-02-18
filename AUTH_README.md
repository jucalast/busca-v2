# Sistema de Autenticação

## Visão Geral

Sistema completo de autenticação implementado com:
- Backend: SQLite com hash SHA-256 para senhas
- Frontend: React Context API para gerenciamento de estado
- Sessões: Token-based com expiração de 30 dias
- Persistência: localStorage para manter usuário logado

## Estrutura do Backend

### Tabelas do Banco de Dados

#### `users`
- `id` (TEXT, PK): UUID do usuário
- `email` (TEXT, UNIQUE): Email único
- `password_hash` (TEXT): Hash SHA-256 da senha
- `name` (TEXT): Nome do usuário
- `created_at` (TEXT): Data de criação
- `last_login` (TEXT): Último login
- `metadata` (TEXT): JSON com metadados adicionais

#### `sessions`
- `token` (TEXT, PK): Token único de sessão
- `user_id` (TEXT, FK): Referência ao usuário
- `created_at` (TEXT): Data de criação
- `expires_at` (TEXT): Data de expiração (30 dias)
- `last_used` (TEXT): Último uso

### Funções Principais

**`database.py`**:
- `register_user(email, password, name)` - Registra novo usuário
- `login_user(email, password)` - Autentica e cria sessão
- `validate_session(token)` - Valida token de sessão
- `delete_session(token)` - Remove sessão (logout)
- `cleanup_expired_sessions()` - Limpa sessões expiradas

**`growth_orchestrator.py`** - Ações:
- `register` - Criar novo usuário
- `login` - Autenticar usuário
- `logout` - Encerrar sessão
- `validate-session` - Validar token

## API Endpoints

### POST `/api/growth`

#### Registro
```json
{
  "action": "register",
  "email": "user@example.com",
  "password": "senha123",
  "name": "Nome do Usuário"
}
```

**Resposta**:
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "Nome do Usuário"
  },
  "session": {
    "token": "token_aleatorio",
    "expires_at": "2026-03-15T12:00:00"
  }
}
```

#### Login
```json
{
  "action": "login",
  "email": "user@example.com",
  "password": "senha123"
}
```

**Resposta**: Mesma do registro

#### Logout
```json
{
  "action": "logout",
  "token": "token_da_sessao"
}
```

#### Validar Sessão
```json
{
  "action": "validate-session",
  "token": "token_da_sessao"
}
```

**Resposta**:
```json
{
  "success": true,
  "session": {
    "token": "token",
    "user_id": "uuid",
    "email": "user@example.com",
    "name": "Nome",
    "expires_at": "2026-03-15T12:00:00"
  }
}
```

## Frontend

### AuthContext

**`src/contexts/AuthContext.tsx`**

Provê:
- `user`: Dados do usuário autenticado
- `session`: Token e expiração
- `isLoading`: Estado de carregamento
- `isAuthenticated`: Boolean de autenticação
- `login(email, password)`: Função de login
- `register(email, password, name)`: Função de registro
- `logout()`: Função de logout
- `validateSession()`: Valida sessão atual

### AuthForm Component

**`src/components/AuthForm.tsx`**

Componente de UI com:
- Alternância entre login/registro
- Validação de campos
- Mostrar/ocultar senha
- Tratamento de erros
- Design responsivo

### Uso no App

```tsx
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { user, isAuthenticated, logout } = useAuth();
  
  if (!isAuthenticated) {
    return <AuthForm />;
  }
  
  return (
    <div>
      <p>Olá, {user.name}!</p>
      <button onClick={logout}>Sair</button>
    </div>
  );
}
```

## Fluxo de Autenticação

1. **Primeiro Acesso**:
   - Usuário vê `AuthForm`
   - Escolhe "Registrar"
   - Preenche email, senha, nome
   - Sistema cria conta e faz login automático
   - Token salvo no localStorage
   - Redirecionado para seletor de negócios

2. **Login Subsequente**:
   - App verifica localStorage
   - Se há token, valida com backend
   - Se válido, restaura sessão
   - Usuário vai direto para o app

3. **Logout**:
   - Remove token do backend
   - Limpa localStorage
   - Reseta estado do contexto
   - Volta para tela de login

## Segurança

- ✅ Senhas nunca armazenadas em texto puro
- ✅ Hash SHA-256 para senhas
- ✅ Tokens aleatórios seguros (32 bytes URL-safe)
- ✅ Validação de email único
- ✅ Sessões com expiração (30 dias)
- ✅ Limpeza automática de sessões expiradas
- ✅ Senha mínima de 6 caracteres (frontend)

## Melhorias Futuras Sugeridas

1. **Segurança Avançada**:
   - Migrar SHA-256 para bcrypt/argon2 (mais seguro)
   - Rate limiting para prevenir brute force
   - Verificação de email (envio de link de confirmação)
   - Reset de senha por email
   - Two-factor authentication (2FA)

2. **UX**:
   - "Lembrar-me" com opção de não salvar token
   - OAuth (Google, GitHub, etc.)
   - Força da senha em tempo real
   - Recuperação de conta

3. **Funcionalidades**:
   - Gerenciamento de sessões (ver dispositivos conectados)
   - Histórico de acessos
   - Perfil de usuário editável
   - Foto de perfil

## Testando

### Criar Conta
1. Acesse o app
2. Clique em "Registre-se"
3. Preencha email, senha (min 6 chars), nome
4. Clique "Criar Conta"
5. Você será logado automaticamente

### Fazer Login
1. Acesse o app
2. Preencha email e senha
3. Clique "Entrar"

### Verificar Persistência
1. Faça login
2. Feche o navegador
3. Abra novamente
4. Você ainda estará logado

### Logout
1. Clique no botão "Sair" (canto superior direito)
2. Você volta para tela de login
