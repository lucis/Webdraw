# AI Integration - Getting Started

## 🎯 Bem-vindo à Documentação de AI Integration

Este conjunto de documentos descreve a estratégia completa para integração de IA no Webdraw, transformando-o em uma plataforma colaborativa entre humanos e inteligência artificial.

## 📚 Documentação Disponível

### 1. 📖 [AI Integration Overview](../ai_integration.md)
**Visão geral** de todas as features de IA, arquitetura, princípios de design e roadmap.

**Leia primeiro** para entender o contexto completo.

---

### 2. 🎯 [Drawing Completion](./01-drawing-completion.md)
**Prioridade: ALTA** | **Status: Próxima implementação**

Permite que a IA complete ou expanda desenhos baseado no contexto atual.

**Características**:
- Seleção de elementos como contexto
- Prompt natural para descrever o que deseja
- Preview antes de aplicar
- Histórico de completions

**Por que começar aqui?**
- Feature mais simples e útil
- Valida toda a infraestrutura de AI
- Feedback rápido de valor para o usuário

---

### 3. 📱 [Inline Apps](./02-inline-apps.md)
**Prioridade: MÉDIA** | **Status: Planejado**

Cria mini-aplicativos HTML/JS renderizados como elementos no canvas.

**Características**:
- Geração de apps via IA
- Sandbox seguro com iframes
- SDK para interação com canvas
- Templates pré-definidos

**Casos de uso**:
- Timers, calculadoras, formulários
- Visualizações de dados dinâmicas
- Integrações com APIs externas

---

### 4. 🧩 [Widgets](./03-widgets.md)
**Prioridade: MÉDIA** | **Status: Planejado**

Sistema de widgets que funcionam como abstrações visuais parametrizadas.

**Características**:
- Widgets customizáveis com config schema
- Expansão via IA baseada em prompt template
- Widget library compartilhável
- Visual compacto que esconde complexidade

**Casos de uso**:
- Templates reutilizáveis (Button, Card, Chart)
- Componentes parametrizados
- Snippets visuais configuráveis

---

### 5. 🔧 [Deco Tools as Widgets](./04-deco-tools-widgets.md)
**Prioridade: BAIXA** | **Status: Planejado**

Integração com ecossistema Deco, expondo tools MCP como widgets.

**Características**:
- Discovery automático de tools
- Tool widgets executáveis no canvas
- Tool chaining (output → input)
- Workflows visuais

**Casos de uso**:
- Database query widgets
- API call widgets
- Workflow trigger widgets
- Analytics widgets

---

### 6. 📐 [Excalidraw Schema Reference](./excalidraw-schema-reference.md)
**Referência técnica** para o schema de elementos Excalidraw.

**Conteúdo**:
- Tipos de elementos
- Propriedades de cada tipo
- Schema filtering para IA
- JSON schemas para AI_GENERATE_OBJECT
- Custom data patterns

**Essencial** para implementar qualquer feature de IA.

---

## 🚀 Roadmap Sugerido

### Sprint 1: Foundation (2-3 semanas)
**Objetivo**: Infraestrutura base e primeiro caso de uso

**Entregas**:
- [ ] Criar `aiStore` (Zustand) com actions básicas
- [ ] Implementar schema filtering utilities
- [ ] Criar TanStack Query hooks para AI tools
- [ ] Setup básico de UI (Dialog, botões)
- [ ] **Implementar Drawing Completion MVP**
  - [ ] Tool `AI_COMPLETE_DRAWING` no backend
  - [ ] UI para prompt e preview
  - [ ] Aplicação de elementos no canvas
  - [ ] Histórico básico

**Critério de sucesso**:
✅ Usuário pode selecionar elementos, dar prompt, e ver elementos gerados aplicados no canvas

---

### Sprint 2: Polish & Feedback (1-2 semanas)
**Objetivo**: Refinar Drawing Completion baseado em uso real

**Entregas**:
- [ ] Melhorar UX do dialog (suggestions, shortcuts)
- [ ] Adicionar preview overlay visual
- [ ] Implementar undo específico para AI operations
- [ ] Otimização de schemas (reduzir tokens)
- [ ] Error handling robusto
- [ ] Métricas e analytics

**Critério de sucesso**:
✅ Taxa de aceitação > 70%, latência < 5s, NPS positivo

---

### Sprint 3: Inline Apps (3-4 semanas)
**Objetivo**: Permitir criação de apps interativos

**Entregas**:
- [ ] Tool `AI_CREATE_INLINE_APP`
- [ ] Sistema de sanitização e sandbox
- [ ] WebdrawSDK para apps
- [ ] Templates básicos (timer, calculator)
- [ ] App gallery/library
- [ ] PostMessage bridge

**Critério de sucesso**:
✅ Usuário pode criar e usar app funcional em < 2 minutos

---

### Sprint 4: Widgets (3-4 semanas)
**Objetivo**: Sistema de widgets parametrizados

**Entregas**:
- [ ] Tools de gerenciamento de widgets
- [ ] Widget creation wizard
- [ ] Widget config dialog dinâmico
- [ ] Built-in widgets (Button, Card, Chart)
- [ ] Widget expansion via AI
- [ ] Widget sharing (import/export)

**Critério de sucesso**:
✅ Usuário pode criar, configurar e expandir widget em < 3 minutos

---

### Sprint 5: Deco Integration (4-5 semanas)
**Objetivo**: Integração com ecossistema Deco

**Entregas**:
- [ ] Tool discovery mechanism
- [ ] Tool widget creation
- [ ] Tool execution layer
- [ ] Tool chaining/connections
- [ ] Workflow widgets
- [ ] Monitoring e logging

**Critério de sucesso**:
✅ Usuário pode criar workflow visual com 3+ tools conectados

---

## 🎯 Como Começar

### Para Implementar Drawing Completion (Sprint 1):

#### Backend (server/)
1. Criar `server/tools/ai.ts` com `AI_COMPLETE_DRAWING`
2. Implementar helpers de schema filtering
3. Testar geração com AI_GENERATE_OBJECT
4. Adicionar tool ao `main.ts`

#### Frontend (view/)
1. Criar `view/src/stores/ai-store.ts`
2. Criar `view/src/hooks/useAICompletion.ts`
3. Criar `view/src/components/ai/AICompletionDialog.tsx`
4. Adicionar botão/atalho no canvas

#### Validação
1. Testar fluxo completo end-to-end
2. Verificar performance (latência, tokens)
3. Iterar baseado em feedback

---

## 📋 Checklist Inicial

Antes de começar Sprint 1, garantir:

- [ ] **Backend**
  - [ ] Acesso a `env.DECO_CHAT_WORKSPACE_API.AI_GENERATE_OBJECT` funcionando
  - [ ] Entender schema JSON esperado pela IA
  - [ ] Ter exemplos de elementos Excalidraw para testar

- [ ] **Frontend**
  - [ ] Zustand configurado e funcionando
  - [ ] TanStack Query setup correto
  - [ ] Excalidraw API acessível e testada
  - [ ] RPC client chamando tools com sucesso

- [ ] **Infraestrutura**
  - [ ] Ambiente de dev rodando (`npm run dev`)
  - [ ] Types gerados (`npm run gen` e `npm run gen:self`)
  - [ ] Git initialized e `.gitignore` configurado
  - [ ] README atualizado com AI features

---

## ❓ Perguntas Frequentes

### 1. Por que começar com Drawing Completion?
É o caso mais simples que valida toda a stack:
- Backend: Tool creation, AI_GENERATE_OBJECT
- Frontend: Zustand, TanStack Query, Excalidraw API
- UX: Dialog, preview, aplicação de elementos

Sucesso aqui = base sólida para outras features.

### 2. Quanto tempo leva cada sprint?
Estimativas baseadas em 1 dev full-time:
- Sprint 1 (Foundation): 2-3 semanas
- Sprint 2 (Polish): 1-2 semanas
- Sprint 3-5: 3-5 semanas cada

Total: ~3-4 meses para todas as features.

### 3. Posso pular diretamente para Widgets ou Inline Apps?
Não recomendado. Drawing Completion estabelece padrões e infraestrutura que serão reutilizados. Pular = retrabalho depois.

### 4. Como priorizar se tempo for limitado?
Ordem de prioridade:
1. **Drawing Completion** (essencial)
2. **Widgets** (alto valor, reutilizável)
3. **Inline Apps** (poderoso mas complexo)
4. **Deco Integration** (nice-to-have avançado)

### 5. Preciso implementar tudo de uma vez?
Não! Abordagem incremental é melhor:
- Implemente Drawing Completion MVP
- Teste com usuários reais
- Itere baseado em feedback
- Só então avance para próxima feature

---

## 📞 Próximos Passos

1. ✅ Ler [AI Integration Overview](../ai_integration.md)
2. ✅ Ler [Drawing Completion](./01-drawing-completion.md) em detalhe
3. ✅ Ler [Excalidraw Schema Reference](./excalidraw-schema-reference.md)
4. ⏭️ Criar branch `feature/ai-drawing-completion`
5. ⏭️ Implementar backend tool
6. ⏭️ Implementar frontend store e UI
7. ⏭️ Testar e iterar

---

## 🤝 Contribuindo

Ao implementar qualquer feature de IA:

**Sempre**:
- Seguir princípios de design (type safety, zustand, debuggability)
- Documentar decisões técnicas importantes
- Escrever testes para lógica crítica
- Validar com usuários reais

**Nunca**:
- Commitar código não-funcional em main
- Expor API keys ou secrets
- Implementar sem validar requisitos
- Ignorar feedback de usuários

---

## 📊 Métricas de Sucesso

Para cada feature implementada, track:

1. **Usabilidade**
   - Tempo para completar tarefa
   - Taxa de sucesso vs erro
   - NPS (Net Promoter Score)

2. **Performance**
   - Latência de geração
   - Tokens consumidos
   - Taxa de cache hit

3. **Adoção**
   - % de usuários usando feature
   - Frequência de uso
   - Retenção ao longo do tempo

4. **Qualidade**
   - Taxa de aceitação de sugestões IA
   - Número de regenerações necessárias
   - Ratings de qualidade do output

---

## 🎓 Recursos Adicionais

- [Deco MCP Documentation](https://deco.chat/docs)
- [Excalidraw API Docs](https://docs.excalidraw.com)
- [Zustand Guide](https://zustand-demo.pmnd.rs/)
- [TanStack Query](https://tanstack.com/query)
- [AI Usage Patterns](../../../../.cursor/rules/ai-usage-patterns.md)

---

**Boa sorte e bom código! 🚀**

*Atualizado em: 2025-10-05*
