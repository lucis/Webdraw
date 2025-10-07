# AI Drawing Completion - Status Atual e Próximos Passos

## 📍 Status Atual (2025-10-07)

### ✅ O que já temos
- **Documentação completa** do plano de AI integration
- **Backend foundation** com sistema de tools organizado por domínio
- **Frontend foundation** com Zustand, TanStack Query, Excalidraw integration
- **RPC system** funcionando entre frontend e backend
- **Excalidraw canvas** integrado e funcionando

### ❌ O que ainda não existe (AI Integration)
- **Nenhum tool de AI** implementado no backend
- **Nenhum store de AI** (aiStore) no frontend  
- **Nenhum hook de AI** (useAICompletion)
- **Nenhum componente de AI** (AICompletionDialog)
- **Nenhuma integração** entre seleção de elementos e AI

## 🎯 Foco Imediato: Drawing Completion MVP

Baseado no plano, vamos implementar o **fluxo de rodar AI com elementos selecionados**:

```
1. Usuário seleciona elementos no canvas (ou nenhum para contexto completo)
2. Usuário clica no botão "AI ✨" ou usa atalho Cmd+K
3. Usuário escreve prompt: "Complete este diagrama" 
4. Sistema envia elementos selecionados + prompt para IA
5. IA retorna novos elementos
6. Sistema mostra preview dos elementos
7. Usuário aceita/rejeita
8. Elementos são aplicados ao canvas
```

## 🚀 Implementação Sprint 1 (2-3 semanas)

### Fase 1: Backend Tool (2-3 dias)
**Arquivo**: `server/tools/ai.ts`

**Tool Principal**: `AI_COMPLETE_DRAWING`
- Input: `prompt` + `contextElements` + `options`
- Process: Filtrar elementos → Construir schema → Chamar AI_GENERATE_OBJECT
- Output: `elements` + `metadata` + `success/error`

**Utilities**:
- `filterExcalidrawElements()` - Remove propriedades irrelevantes
- `buildExcalidrawElementsSchema()` - Schema JSON para IA
- `processGeneratedElements()` - Adiciona IDs e propriedades obrigatórias

### Fase 2: Frontend State (2-3 dias)
**Arquivo**: `view/src/stores/ai-store.ts`

**AI Store (Zustand)**:
- State: `status`, `currentRequest`, `currentResult`, `history`, `dialogOpen`
- Actions: `openDialog`, `generateElements`, `acceptResult`, `rejectResult`

**Hook**: `view/src/hooks/useAICompletion.ts`
- Wrapper para TanStack Query mutation
- Integração com Excalidraw API
- Aplicação de elementos no canvas

### Fase 3: UI Components (3-4 dias)
**Arquivo**: `view/src/components/ai/AICompletionDialog.tsx`

**Dialog States**:
- **Idle**: Textarea para prompt + botão Generate
- **Generating**: Loading com progresso
- **Previewing**: Lista de elementos + Accept/Reject buttons
- **Error**: Mensagem de erro + Retry button

### Fase 4: Canvas Integration (2-3 dias)
**Integrações necessárias**:
- Botão flutuante "AI ✨" no canvas
- Atalho de teclado `Cmd+K`
- Captura de elementos selecionados
- Preview overlay (elementos destacados)
- Aplicação final dos elementos

### Fase 5: Testing & Polish (2-3 dias)
- Testes end-to-end do fluxo completo
- Error handling robusto
- Performance optimization
- Documentação de uso

## 🔧 Detalhes Técnicos Específicos

### Schema Filtering Strategy
Enviar apenas propriedades essenciais para IA:
```typescript
{
  type: "rectangle" | "ellipse" | "text" | "arrow"...,
  x: number,
  y: number, 
  width: number,
  height: number,
  text?: string,
  strokeColor?: string,
  backgroundColor?: string
}
```

**Remover**: `versionNonce`, `version`, `isDeleted`, `updated`, etc.

### AI Schema Design
```typescript
{
  elements: [
    {
      type: "rectangle",
      x: 100,
      y: 200, 
      width: 150,
      height: 80,
      text: "New Box",
      strokeColor: "#000000",
      backgroundColor: "#ffffff"
    }
  ],
  note: "I added a decision box to complete your flowchart"
}
```

### Integration Points
- **Backend**: `env.DECO_CHAT_WORKSPACE_API.AI_GENERATE_OBJECT`
- **Frontend**: `client.AI_COMPLETE_DRAWING()` via RPC
- **Canvas**: `excalidrawAPI.updateScene()` e `setSelectedElements()`

## ⚡ Quick Start Checklist

Para começar **AGORA**:

### Backend Setup
- [ ] Criar `server/tools/ai.ts`
- [ ] Implementar `createAICompleteDrawingTool`
- [ ] Adicionar aos tools em `server/tools/index.ts`
- [ ] Testar tool via RPC

### Frontend Setup  
- [ ] Criar `view/src/stores/ai-store.ts`
- [ ] Criar `view/src/hooks/useAICompletion.ts`
- [ ] Criar `view/src/components/ai/AICompletionDialog.tsx`
- [ ] Adicionar botão AI ao canvas

### Validation
- [ ] Testar seleção de elementos
- [ ] Testar prompt → geração → aplicação
- [ ] Validar preview e accept/reject
- [ ] Performance check (< 5s latência)

## 🤔 Decisões Pendentes

### 1. Limite de Elementos no Contexto
**Pergunta**: Quantos elementos selecionados enviar para IA?
**Proposta**: Máximo 20 elementos, acima disso pedir refinamento

### 2. Posicionamento de Novos Elementos
**Pergunta**: Como posicionar elementos gerados?
**Proposta**: IA decide x,y absolutos, com fallback auto-arrange

### 3. Preview Implementation
**Pergunta**: Como mostrar preview?
**Proposta**: Overlay temporário com elementos destacados em azul

### 4. Model Selection
**Pergunta**: Qual modelo usar?
**Proposta**: Default `gpt-4o-mini`, opção advanced para outros

## 🎯 Critério de Sucesso Sprint 1

**MVP Funcional**:
✅ Usuário pode selecionar 2-3 elementos
✅ Escrever prompt "Add labels to these boxes"  
✅ Ver elementos de texto gerados como labels
✅ Aceitar e ver elementos aplicados no canvas
✅ Processo completo em < 30 segundos

**Performance Target**:
- Latência: < 5 segundos
- Taxa de sucesso: > 80%
- Elementos válidos: > 90%

## 📋 Próximos Passos Imediatos

### Esta Semana (7-11 Out)
1. **Segunda**: Implementar backend tool `AI_COMPLETE_DRAWING`
2. **Terça**: Criar AI store + hook useAICompletion
3. **Quarta**: Implementar AICompletionDialog básico
4. **Quinta**: Integrar botão AI no canvas + seleção
5. **Sexta**: Testar fluxo completo + polish

### Semana Seguinte (14-18 Out)  
1. Error handling robusto
2. Preview visual overlay
3. Histórico de completions
4. Performance optimization
5. User testing e feedback

## 🚨 Bloqueadores Potenciais

1. **AI_GENERATE_OBJECT não funciona** → Testar primeiro com mock
2. **Schema muito complexo** → Simplificar elementos enviados  
3. **Excalidraw API limitada** → Verificar capacidades de preview
4. **Performance ruim** → Implementar caching e otimização

## 📞 Help Needed

Se algo não ficou claro ou precisar de ajuda:
- **Backend tool implementation** → Revisar deco MCP patterns
- **Excalidraw API usage** → Revisar useExcalidrawCanvas hook
- **State management** → Revisar drawing-store.ts patterns
- **UI/UX design** → Revisar componente patterns existentes

---

**Status**: ⏭️ **Pronto para implementar**  
**Próxima ação**: Criar `server/tools/ai.ts` com `AI_COMPLETE_DRAWING`
**Timeline**: MVP em 2-3 semanas
**Confidence**: 🟢 Alto (infraestrutura pronta, plan claro)

*Atualizado em: 2025-10-07 18:54*
