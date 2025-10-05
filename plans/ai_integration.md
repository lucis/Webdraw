# AI Integration - Webdraw Overview

## 🎯 Visão Geral

Este documento apresenta a visão geral para integração de IA no Webdraw, transformando-o em uma plataforma colaborativa entre humanos e IA para criação e manipulação de desenhos.

## 🌟 Objetivo Principal

Permitir que usuários e IA interajam de forma bidirecional com desenhos Excalidraw:
- **Humano → IA**: Enviar contexto (desenho atual ou seleção) para a IA processar
- **IA → Canvas**: IA retornar novos elementos ou modificações para serem aplicados ao desenho
- **Iteração contínua**: Ciclos de colaboração entre humano e IA

## 🏗️ Arquitetura Geral

```
┌─────────────────────────────────────────────────────────┐
│                    WEBDRAW CANVAS                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Excalidraw Elements                             │  │
│  │  - Shapes, Text, Arrows, Images                  │  │
│  │  - User Selection                                │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────┬────────────────────────────────────────┘
                 │
                 ├─── Selection Context Extraction
                 │    (Filter relevant properties)
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│              AI INTEGRATION LAYER (Frontend)            │
│  - aiStore (Zustand)                                    │
│  - Selection → Schema Conversion                        │
│  - AI Response → Elements Conversion                    │
│  - Widget Management                                    │
│  - App Embedding Logic                                  │
└────────────────┬────────────────────────────────────────┘
                 │
                 ├─── RPC Client (client.AI_COMPLETE_DRAWING)
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│              MCP SERVER (Backend)                        │
│  - AI_COMPLETE_DRAWING tool                             │
│  - AI_CREATE_APP tool                                   │
│  - AI_WIDGET_* tools                                    │
│  - Schema validation & filtering                        │
│  └─── env.DECO_CHAT_WORKSPACE_API.AI_GENERATE_OBJECT   │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│              DECO AI PLATFORM                            │
│  - AI_GENERATE_OBJECT (structured generation)           │
│  - Model selection (GPT-4, Claude, etc.)                │
│  - Token management                                     │
└─────────────────────────────────────────────────────────┘
```

## 🎨 Features Planejadas

### 1. 🎯 Drawing Completion (Prioridade ALTA)
**Status**: A implementar primeiro

Permite que a IA complete ou adicione elementos ao desenho atual com base no contexto.

**Casos de uso**:
- "Complete este diagrama de arquitetura"
- "Adicione legendas aos elementos selecionados"
- "Crie conectores entre estes elementos"
- "Gere um mockup de interface baseado nesta estrutura"

**Documentação**: `plans/ai/01-drawing-completion.md`

---

### 2. 📱 Inline Apps (Prioridade MÉDIA)
**Status**: Planejado

Permite criar mini-aplicativos HTML/JS que são renderizados como elementos no canvas.

**Casos de uso**:
- Calculadoras integradas ao desenho
- Timers/contadores
- Formulários interativos
- Visualizações de dados dinâmicas
- Integrações com APIs externas

**Documentação**: `plans/ai/02-inline-apps.md`

---

### 3. 🧩 Widgets e Abstrações (Prioridade MÉDIA)
**Status**: Planejado

Sistema de widgets que "escondem" informações complexas atrás de desenhos específicos, funcionando como prompts visuais.

**Casos de uso**:
- Templates reutilizáveis com parâmetros
- Componentes parametrizados (ex: "Button" widget com cor e texto configurável)
- Snippets visuais com configuração
- Abstrações de lógica complexa

**Documentação**: `plans/ai/03-widgets.md`

---

### 4. 🔧 Deco Tools as Widgets (Prioridade BAIXA)
**Status**: Planejado

Integração com o ecossistema Deco, permitindo que tools MCP sejam representados como widgets no canvas.

**Casos de uso**:
- Widget "Database Query" que executa SQL e retorna visualização
- Widget "API Call" que chama endpoints e mostra resultados
- Widget "Workflow Trigger" que inicia workflows e mostra status
- Widget "Analytics" que busca dados e gera gráficos

**Documentação**: `plans/ai/04-deco-tools-widgets.md`

---

## 🛠️ Stack Técnico

### Frontend
- **Zustand**: State management para AI state
- **TanStack Query**: RPC calls e cache management
- **Excalidraw API**: Manipulação de elementos
- **TypeScript**: Type safety end-to-end

### Backend
- **Deco MCP**: Infraestrutura de tools e workflows
- **Zod**: Schema validation
- **AI_GENERATE_OBJECT**: Structured AI generation
- **DECONFIG**: Persistência de configurações

### AI Layer
- **JSON Schema**: Definição de estruturas esperadas
- **Schema Filtering**: Remover propriedades irrelevantes para IA
- **Type Conversion**: Excalidraw ↔ AI Schema

## 📋 Princípios de Design

### 1. Type Safety First
- Todos os schemas devem ser validados com Zod
- TypeScript deve inferir tipos de RPC calls
- Conversões entre formatos devem ser tipadas

### 2. Zustand Integration
- Estado de AI separado em store próprio (`aiStore`)
- Integração limpa com `drawingStore`
- Actions bem definidas e testáveis

### 3. Progressive Enhancement
- Features devem funcionar independentemente
- Fallbacks graceful quando IA não disponível
- Não quebrar UX existente

### 4. Debuggability
- Logs estruturados de conversões
- Modo debug para visualizar schemas enviados/recebidos
- Ferramentas de desenvolvedor para inspecionar estado

### 5. Performance
- Debounce de operações de IA
- Cache de resultados quando apropriado
- Otimização de schemas (remover dados desnecessários)

## 🚀 Roadmap de Implementação

### Fase 1: Foundation (Sprint 1)
- [ ] Criar `aiStore` (Zustand)
- [ ] Implementar schema filtering utilities
- [ ] Criar hooks TanStack Query para AI tools
- [ ] Setup básico de UI para AI features

### Fase 2: Drawing Completion (Sprint 2)
- [ ] Implementar AI_COMPLETE_DRAWING tool
- [ ] UI para seleção e prompt
- [ ] Aplicação de elementos gerados no canvas
- [ ] Preview antes de aplicar
- [ ] Histórico de completions

### Fase 3: Inline Apps (Sprint 3)
- [ ] Implementar AI_CREATE_APP tool
- [ ] Sandbox seguro para apps HTML/JS
- [ ] SDK para apps interagirem com canvas
- [ ] Gallery de templates

### Fase 4: Widgets (Sprint 4)
- [ ] Sistema de widgets base
- [ ] Widget editor
- [ ] Widget library
- [ ] Widget marketplace

### Fase 5: Deco Integration (Sprint 5)
- [ ] Deco tools discovery
- [ ] Tool → Widget conversion
- [ ] Execution layer
- [ ] Monitoring e logging

## 🔒 Considerações de Segurança

### Inline Apps
- Sandbox com iframes e Content Security Policy
- Validação de código antes de execução
- Rate limiting de AI generation
- Sanitização de HTML/JS gerado

### Widgets
- Validação de schemas
- Permission system para widgets que executam tools
- Audit log de execuções

### API Keys
- Gerenciamento seguro de credenciais no backend
- Não expor keys no frontend
- Rate limiting por usuário

## 📊 Métricas de Sucesso

### Usabilidade
- Tempo médio para completar desenho com IA
- Taxa de aceitação de sugestões da IA
- Número de iterações até resultado desejado

### Performance
- Latência de geração de elementos
- Taxa de erro de AI_GENERATE_OBJECT
- Throughput de operações

### Adoção
- % de usuários que usam features de IA
- Número de completions por usuário
- Crescimento de widgets criados

## 🤔 Questões em Aberto

### Drawing Completion
1. Como lidar com seleções muito grandes (muitos elementos)?
   - Limit de elementos enviados para IA?
   - Estratégia de sampling/sumarização?

2. Preview de mudanças antes de aplicar?
   - Overlay temporário?
   - Modo "suggestion" com accept/reject?

3. Undo específico para AI operations?
   - Stack separado de undo para operações de IA?

### Inline Apps
1. Como garantir segurança de apps gerados por IA?
   - Review manual?
   - Automated security scanning?
   - Sandbox stricto?

2. Persistência de estado de apps?
   - Salvar no drawing ou separado?
   - Como sincronizar entre usuários?

### Widgets
1. Formato de parametrização de widgets?
   - JSON Schema?
   - Custom DSL?

2. Como versionar widgets?
   - Git-like versioning?
   - Immutable widgets com cloning?

### Performance
1. Caching strategy para AI results?
   - Cache baseado em hash de input?
   - TTL para cache?

2. Batching de múltiplas operações?
   - Queue de operações de IA?
   - Coalescência de requests similares?

## 📚 Próximos Passos

1. **Review deste documento** com o time
2. **Validar questões em aberto** e tomar decisões
3. **Começar com Drawing Completion** (feature mais simples e útil)
4. **Criar spike técnico** para provar conceitos principais
5. **Iterar baseado em feedback** de uso real

---

## 📎 Links Relacionados

- [Drawing Completion Plan](./ai/01-drawing-completion.md)
- [Inline Apps Plan](./ai/02-inline-apps.md)
- [Widgets Plan](./ai/03-widgets.md)
- [Deco Tools Integration Plan](./ai/04-deco-tools-widgets.md)
- [Excalidraw Schema Reference](./ai/excalidraw-schema-reference.md)
- [AI Usage Patterns (deco)](../../../.cursor/rules/ai-usage-patterns.md)
