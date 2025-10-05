# Drawing Completion - AI Integration

## 🎯 Objetivo

Permitir que a IA complete, expanda ou modifique desenhos Excalidraw baseado no contexto atual (desenho completo ou seleção).

## 💡 Conceito

O usuário pode:
1. Selecionar elementos no canvas (ou nenhum para contexto completo)
2. Escrever um prompt descrevendo o que deseja
3. IA analisa os elementos selecionados e gera novos elementos
4. Usuário visualiza preview e aceita/rejeita
5. Elementos são adicionados ao canvas

## 🎨 UX Design

### 1. Trigger da Feature

**Opções de acesso**:
- **Botão flutuante "AI ✨"** no canto superior direito do canvas
- **Atalho de teclado**: `Cmd/Ctrl + K` (estilo command palette)
- **Context menu**: Botão direito em elementos selecionados → "AI Complete..."

### 2. AI Completion Dialog

```
┌─────────────────────────────────────────────────────┐
│  AI Drawing Assistant                          [X]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  📝 Context: 3 elements selected                    │
│      → 1 rectangle, 2 arrows                        │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │ What would you like me to do?                 │ │
│  │                                               │ │
│  │ [Placeholder suggestions:                     │ │
│  │  • Complete this flowchart                    │ │
│  │  • Add labels to these elements               │ │
│  │  • Create a legend for this diagram]          │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  ⚙️ Options:                                        │
│  ☐ Preserve selection                              │
│  ☐ Auto-arrange new elements                       │
│  Model: [GPT-4o ▼]                                  │
│                                                     │
│  [Cancel]              [Generate (Cmd+Enter)] ✨   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 3. Loading State

```
┌─────────────────────────────────────────────────────┐
│  AI Drawing Assistant                          [X]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ⏳ Generating elements...                          │
│                                                     │
│  [████████░░░░░░░░░] 60%                            │
│                                                     │
│  💡 Analyzing your selection...                     │
│     Generating 4 new elements...                    │
│                                                     │
│  [Cancel]                                           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 4. Preview & Accept

```
┌─────────────────────────────────────────────────────┐
│  AI Drawing Assistant                          [X]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ✅ Generated 4 new elements                        │
│                                                     │
│  [Canvas Preview with overlay showing new elements] │
│  (New elements highlighted in blue outline)         │
│                                                     │
│  📊 Changes:                                        │
│  • 2 rectangles (Decision nodes)                    │
│  • 2 arrows (Connecting flows)                      │
│                                                     │
│  💬 AI Note: "I added decision nodes to complete    │
│     the conditional flow you started."              │
│                                                     │
│  [Regenerate] [Edit Prompt]  [Cancel] [Accept ✨]  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 5. Error States

```
┌─────────────────────────────────────────────────────┐
│  AI Drawing Assistant                          [X]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ⚠️ Generation Failed                               │
│                                                     │
│  The AI couldn't complete the drawing:              │
│  "Prompt too vague. Please provide more details     │
│   about what you'd like to add."                    │
│                                                     │
│  💡 Suggestions:                                    │
│  • Be more specific about desired elements          │
│  • Select relevant context elements                 │
│  • Try simplifying your request                     │
│                                                     │
│  [Edit Prompt] [Cancel]                             │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 6. History Panel (Optional)

Sidebar mostrando histórico de AI completions:

```
┌─────────────────────────┐
│ AI History         [🔍] │
├─────────────────────────┤
│                         │
│ 🕐 2 minutes ago        │
│ "Add decision nodes"    │
│ ✅ 4 elements added     │
│ [Undo] [Redo]           │
│                         │
│ 🕐 5 minutes ago        │
│ "Create legend"         │
│ ✅ 1 element added      │
│ [Undo] [Redo]           │
│                         │
│ 🕐 10 minutes ago       │
│ "Complete flowchart"    │
│ ❌ Failed               │
│ [Retry]                 │
│                         │
└─────────────────────────┘
```

## 🔧 Tools Necessárias (Backend)

### 1. AI_COMPLETE_DRAWING

**Tool Principal** para drawing completion.

```typescript
/**
 * Tool: AI_COMPLETE_DRAWING
 * 
 * Completa ou expande um desenho baseado no contexto e prompt do usuário.
 */
export const createAICompleteDrawingTool = (env: Env) =>
  createTool({
    id: "AI_COMPLETE_DRAWING",
    description: "Completa ou expande um desenho Excalidraw usando IA",
    
    inputSchema: z.object({
      prompt: z.string().min(1).max(500),
      contextElements: z.array(z.any()), // Elementos selecionados filtrados
      drawingId: z.string().optional(), // ID do desenho para contexto adicional
      options: z.object({
        maxElements: z.number().default(10),
        preserveSelection: z.boolean().default(false),
        autoArrange: z.boolean().default(true),
        model: z.enum(["gpt-4o", "gpt-4o-mini", "claude-3-5-sonnet"]).default("gpt-4o-mini"),
      }).optional(),
    }),
    
    outputSchema: z.object({
      elements: z.array(z.any()), // Novos elementos gerados
      metadata: z.object({
        elementsGenerated: z.number(),
        aiNote: z.string().optional(), // Nota explicativa da IA
        tokensUsed: z.number(),
        model: z.string(),
      }),
      success: z.boolean(),
      error: z.string().optional(),
    }),
    
    execute: async ({ context }) => {
      const { prompt, contextElements, options } = context;
      
      // 1. Filtrar propriedades relevantes dos elementos
      const filteredContext = filterExcalidrawElements(contextElements);
      
      // 2. Construir schema para AI_GENERATE_OBJECT
      const elementsSchema = buildExcalidrawElementsSchema(options?.maxElements || 10);
      
      // 3. Construir mensagem para IA
      const systemPrompt = buildSystemPrompt();
      const userMessage = buildUserMessage(prompt, filteredContext);
      
      // 4. Chamar AI_GENERATE_OBJECT
      try {
        const result = await env.DECO_CHAT_WORKSPACE_API.AI_GENERATE_OBJECT({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage }
          ],
          schema: elementsSchema,
          model: options?.model || "gpt-4o-mini",
          temperature: 0.7,
        });
        
        if (!result.object) {
          return {
            elements: [],
            metadata: {
              elementsGenerated: 0,
              tokensUsed: result.usage.totalTokens,
              model: options?.model || "gpt-4o-mini",
            },
            success: false,
            error: "AI did not return valid elements",
          };
        }
        
        // 5. Processar elementos gerados
        const generatedElements = processGeneratedElements(
          result.object.elements,
          contextElements,
          options
        );
        
        // 6. Retornar resultado
        return {
          elements: generatedElements,
          metadata: {
            elementsGenerated: generatedElements.length,
            aiNote: result.object.note,
            tokensUsed: result.usage.totalTokens,
            model: options?.model || "gpt-4o-mini",
          },
          success: true,
        };
        
      } catch (error) {
        console.error("AI_COMPLETE_DRAWING error:", error);
        return {
          elements: [],
          metadata: {
            elementsGenerated: 0,
            tokensUsed: 0,
            model: options?.model || "gpt-4o-mini",
          },
          success: false,
          error: error.message,
        };
      }
    },
  });
```

### 2. Helpers & Utilities

```typescript
/**
 * Filtra propriedades irrelevantes dos elementos para enviar à IA
 */
function filterExcalidrawElements(elements: any[]): any[] {
  return elements.map(element => ({
    type: element.type,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    text: element.text,
    // Remover: versionNonce, version, isDeleted, updated, etc
    // Manter apenas propriedades relevantes para contexto semântico
  }));
}

/**
 * Constrói schema JSON para elementos Excalidraw
 */
function buildExcalidrawElementsSchema(maxElements: number) {
  return {
    type: "object",
    properties: {
      elements: {
        type: "array",
        maxItems: maxElements,
        items: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["rectangle", "ellipse", "diamond", "text", "arrow", "line"]
            },
            x: { type: "number" },
            y: { type: "number" },
            width: { type: "number" },
            height: { type: "number" },
            text: { type: "string" },
            strokeColor: { type: "string" },
            backgroundColor: { type: "string" },
            // ... outras propriedades essenciais
          },
          required: ["type", "x", "y", "width", "height"]
        }
      },
      note: {
        type: "string",
        description: "Brief explanation of what you generated"
      }
    },
    required: ["elements"]
  };
}

/**
 * Prompt do sistema para IA
 */
function buildSystemPrompt(): string {
  return `You are an expert Excalidraw drawing assistant. 
Your job is to complete or expand drawings based on user requests.

Guidelines:
- Analyze the context elements to understand the drawing's purpose
- Generate new elements that fit naturally with existing ones
- Maintain consistent styling (colors, sizes)
- Position new elements logically relative to existing ones
- Be creative but contextually appropriate
- Provide a brief note explaining your additions

Element positioning:
- x, y are top-left coordinates
- Use existing elements' positions as reference
- Maintain reasonable spacing

Available element types:
- rectangle: Standard boxes
- ellipse: Circles/ovals
- diamond: Diamond shapes
- text: Text labels
- arrow: Directional arrows
- line: Simple lines`;
}

/**
 * Mensagem do usuário para IA
 */
function buildUserMessage(prompt: string, contextElements: any[]): string {
  return `User request: "${prompt}"

Current drawing context:
${JSON.stringify(contextElements, null, 2)}

Please generate new elements to complete this drawing according to the user's request.`;
}

/**
 * Processa elementos gerados pela IA
 */
function processGeneratedElements(
  aiElements: any[],
  contextElements: any[],
  options?: any
): any[] {
  return aiElements.map(element => ({
    ...element,
    // Adicionar IDs únicos
    id: generateExcalidrawId(),
    // Adicionar propriedades obrigatórias do Excalidraw
    versionNonce: Math.floor(Math.random() * 1000000),
    version: 1,
    isDeleted: false,
    // Auto-arrange se habilitado
    ...(options?.autoArrange ? autoArrangeElement(element, contextElements) : {}),
  }));
}
```

### 3. Schema Reference File

Criar arquivo `excalidraw-schema-reference.md` com documentação completa do schema do Excalidraw.

## 🎭 Integração com Frontend (Zustand)

### 1. AI Store

Criar `view/src/stores/ai-store.ts`:

```typescript
/**
 * Zustand Store para gerenciamento de AI features
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface AICompletionRequest {
  prompt: string;
  contextElements: any[];
  options?: {
    maxElements?: number;
    preserveSelection?: boolean;
    autoArrange?: boolean;
    model?: string;
  };
}

interface AICompletionResult {
  elements: any[];
  metadata: {
    elementsGenerated: number;
    aiNote?: string;
    tokensUsed: number;
    model: string;
  };
  success: boolean;
  error?: string;
}

interface AICompletionHistoryItem {
  id: string;
  timestamp: number;
  request: AICompletionRequest;
  result: AICompletionResult;
}

type AIStatus = "idle" | "generating" | "previewing" | "applying" | "error";

interface AIStoreState {
  // ==================== STATE ====================
  
  /** Status atual da geração */
  status: AIStatus;
  
  /** Request atual sendo processado */
  currentRequest: AICompletionRequest | null;
  
  /** Resultado atual (para preview) */
  currentResult: AICompletionResult | null;
  
  /** Histórico de completions */
  history: AICompletionHistoryItem[];
  
  /** Diálogo aberto/fechado */
  dialogOpen: boolean;
  
  /** Progresso da geração (0-100) */
  progress: number;
  
  /** Mensagem de erro */
  error: string | null;
  
  // ==================== ACTIONS ====================
  
  /**
   * Abre o diálogo de AI completion
   */
  openDialog: (contextElements?: any[]) => void;
  
  /**
   * Fecha o diálogo
   */
  closeDialog: () => void;
  
  /**
   * Inicia geração de elementos
   */
  generateElements: (request: AICompletionRequest) => Promise<void>;
  
  /**
   * Cancela geração em andamento
   */
  cancelGeneration: () => void;
  
  /**
   * Aceita resultado e aplica ao canvas
   */
  acceptResult: () => Promise<void>;
  
  /**
   * Rejeita resultado e volta ao diálogo
   */
  rejectResult: () => void;
  
  /**
   * Regenera com mesmo prompt
   */
  regenerate: () => Promise<void>;
  
  /**
   * Limpa erro
   */
  clearError: () => void;
  
  /**
   * Adiciona item ao histórico
   */
  addToHistory: (item: AICompletionHistoryItem) => void;
  
  /**
   * Aplica item do histórico novamente
   */
  reapplyFromHistory: (itemId: string) => Promise<void>;
}

export const useAIStore = create<AIStoreState>()(
  devtools(
    (set, get) => ({
      // ==================== INITIAL STATE ====================
      
      status: "idle",
      currentRequest: null,
      currentResult: null,
      history: [],
      dialogOpen: false,
      progress: 0,
      error: null,
      
      // ==================== ACTIONS ====================
      
      openDialog: (contextElements = []) => {
        set({
          dialogOpen: true,
          currentRequest: {
            prompt: "",
            contextElements,
            options: {
              maxElements: 10,
              preserveSelection: false,
              autoArrange: true,
              model: "gpt-4o-mini",
            },
          },
          status: "idle",
          error: null,
        });
      },
      
      closeDialog: () => {
        set({
          dialogOpen: false,
          currentRequest: null,
          currentResult: null,
          status: "idle",
          error: null,
        });
      },
      
      generateElements: async (request: AICompletionRequest) => {
        set({
          status: "generating",
          currentRequest: request,
          progress: 0,
          error: null,
        });
        
        try {
          // Simular progresso (opcional - pode ser removido se API retornar rápido)
          const progressInterval = setInterval(() => {
            set((state) => ({
              progress: Math.min(state.progress + 10, 90),
            }));
          }, 300);
          
          // Chamar AI tool via RPC
          const result = await client.AI_COMPLETE_DRAWING({
            prompt: request.prompt,
            contextElements: request.contextElements,
            options: request.options,
          });
          
          clearInterval(progressInterval);
          
          if (result.success) {
            set({
              status: "previewing",
              currentResult: result,
              progress: 100,
            });
            
            // Adicionar ao histórico
            get().addToHistory({
              id: `ai_${Date.now()}`,
              timestamp: Date.now(),
              request,
              result,
            });
          } else {
            set({
              status: "error",
              error: result.error || "Generation failed",
              progress: 0,
            });
          }
        } catch (error) {
          set({
            status: "error",
            error: error.message || "Failed to generate elements",
            progress: 0,
          });
        }
      },
      
      cancelGeneration: () => {
        // TODO: Implementar cancelamento de request se API suportar
        set({
          status: "idle",
          progress: 0,
        });
      },
      
      acceptResult: async () => {
        const { currentResult } = get();
        if (!currentResult) return;
        
        set({ status: "applying" });
        
        try {
          // Aplicar elementos ao canvas via excalidraw API
          // (será implementado no hook useAICompletion)
          
          set({
            status: "idle",
            dialogOpen: false,
            currentRequest: null,
            currentResult: null,
          });
        } catch (error) {
          set({
            status: "error",
            error: "Failed to apply elements",
          });
        }
      },
      
      rejectResult: () => {
        set({
          status: "idle",
          currentResult: null,
        });
      },
      
      regenerate: async () => {
        const { currentRequest } = get();
        if (!currentRequest) return;
        
        await get().generateElements(currentRequest);
      },
      
      clearError: () => {
        set({ error: null });
      },
      
      addToHistory: (item: AICompletionHistoryItem) => {
        set((state) => ({
          history: [item, ...state.history].slice(0, 50), // Keep last 50
        }));
      },
      
      reapplyFromHistory: async (itemId: string) => {
        const item = get().history.find((h) => h.id === itemId);
        if (!item) return;
        
        await get().generateElements(item.request);
      },
    }),
    { name: "AIStore" }
  )
);
```

### 2. TanStack Query Hook

Criar `view/src/hooks/useAICompletion.ts`:

```typescript
/**
 * Hook para AI Drawing Completion
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "../lib/rpc";
import { useAIStore } from "../stores/ai-store";
import { useExcalidrawAPI } from "./useExcalidrawCanvas";

export const useAICompletion = () => {
  const queryClient = useQueryClient();
  const { excalidrawAPI } = useExcalidrawAPI();
  const aiStore = useAIStore();
  
  /**
   * Mutation para chamar AI_COMPLETE_DRAWING
   */
  const completionMutation = useMutation({
    mutationFn: (input: {
      prompt: string;
      contextElements: any[];
      options?: any;
    }) => client.AI_COMPLETE_DRAWING(input),
    
    onSuccess: (data) => {
      if (data.success) {
        aiStore.currentResult = data;
        aiStore.status = "previewing";
      } else {
        aiStore.status = "error";
        aiStore.error = data.error || "Generation failed";
      }
    },
    
    onError: (error) => {
      aiStore.status = "error";
      aiStore.error = error.message;
    },
  });
  
  /**
   * Aplica elementos gerados ao canvas
   */
  const applyElements = (elements: any[]) => {
    if (!excalidrawAPI) {
      throw new Error("Excalidraw API not ready");
    }
    
    const currentElements = excalidrawAPI.getSceneElements();
    const newElements = [...currentElements, ...elements];
    
    excalidrawAPI.updateScene({
      elements: newElements,
    });
    
    // Selecionar elementos novos
    excalidrawAPI.setSelectedElements(elements);
  };
  
  /**
   * Obtém elementos selecionados do canvas
   */
  const getSelectedElements = () => {
    if (!excalidrawAPI) return [];
    
    const appState = excalidrawAPI.getAppState();
    const elements = excalidrawAPI.getSceneElements();
    
    return elements.filter((el: any) => 
      appState.selectedElementIds[el.id]
    );
  };
  
  return {
    completionMutation,
    applyElements,
    getSelectedElements,
    isGenerating: completionMutation.isPending,
  };
};
```

### 3. UI Components

Criar `view/src/components/ai/AICompletionDialog.tsx`:

```typescript
/**
 * Diálogo principal de AI Completion
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { useAIStore } from "../../stores/ai-store";
import { useAICompletion } from "../../hooks/useAICompletion";
import { useState } from "react";

export const AICompletionDialog = () => {
  const {
    dialogOpen,
    closeDialog,
    currentRequest,
    currentResult,
    status,
    error,
    progress,
    generateElements,
    acceptResult,
    rejectResult,
    regenerate,
  } = useAIStore();
  
  const { applyElements } = useAICompletion();
  const [prompt, setPrompt] = useState("");
  
  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    
    await generateElements({
      prompt,
      contextElements: currentRequest?.contextElements || [],
      options: currentRequest?.options,
    });
  };
  
  const handleAccept = async () => {
    if (currentResult?.elements) {
      applyElements(currentResult.elements);
      await acceptResult();
    }
  };
  
  return (
    <Dialog open={dialogOpen} onOpenChange={closeDialog}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>AI Drawing Assistant ✨</DialogTitle>
        </DialogHeader>
        
        {status === "idle" && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              📝 Context: {currentRequest?.contextElements.length || 0} elements selected
            </div>
            
            <Textarea
              placeholder="What would you like me to do?"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.metaKey) {
                  handleGenerate();
                }
              }}
            />
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button onClick={handleGenerate} disabled={!prompt.trim()}>
                Generate (⌘↵)
              </Button>
            </div>
          </div>
        )}
        
        {status === "generating" && (
          <div className="space-y-4 py-8 text-center">
            <div className="text-lg">⏳ Generating elements...</div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              💡 Analyzing your selection...
            </div>
          </div>
        )}
        
        {status === "previewing" && currentResult && (
          <div className="space-y-4">
            <div className="text-sm">
              ✅ Generated {currentResult.metadata.elementsGenerated} new elements
            </div>
            
            {currentResult.metadata.aiNote && (
              <div className="bg-blue-50 p-3 rounded-md text-sm">
                💬 <strong>AI Note:</strong> {currentResult.metadata.aiNote}
              </div>
            )}
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={regenerate}>
                Regenerate
              </Button>
              <Button variant="outline" onClick={rejectResult}>
                Cancel
              </Button>
              <Button onClick={handleAccept}>
                Accept ✨
              </Button>
            </div>
          </div>
        )}
        
        {status === "error" && error && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 p-4 rounded-md">
              <div className="font-semibold text-red-800">⚠️ Generation Failed</div>
              <div className="text-sm text-red-700 mt-2">{error}</div>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button onClick={regenerate}>
                Retry
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
```

## 🚀 Implementação Step-by-Step

### Fase 1: Backend Foundation
1. ✅ Criar `AI_COMPLETE_DRAWING` tool
2. ✅ Implementar schema filtering utilities
3. ✅ Criar Excalidraw schema reference
4. ✅ Testar geração básica via MCP

### Fase 2: Frontend State
1. ✅ Criar `ai-store.ts` com Zustand
2. ✅ Implementar actions básicas
3. ✅ Criar hook `useAICompletion`
4. ✅ Integrar com TanStack Query

### Fase 3: UI Components
1. ✅ Criar `AICompletionDialog`
2. ✅ Adicionar botão/atalho para abrir
3. ✅ Implementar preview overlay
4. ✅ Adicionar loading states

### Fase 4: Canvas Integration
1. ✅ Integrar com Excalidraw API
2. ✅ Implementar seleção de contexto
3. ✅ Aplicar elementos gerados
4. ✅ Highlight de elementos novos

### Fase 5: Polish & Testing
1. ✅ Histórico de completions
2. ✅ Undo/redo support
3. ✅ Error handling robusto
4. ✅ Performance optimization
5. ✅ User testing

## ❓ Questões Técnicas

### 1. Limite de Elementos no Contexto
**Pergunta**: Quantos elementos podemos enviar para a IA sem exceder limites de tokens?

**Proposta**:
- Limitar a 50 elementos selecionados
- Se mais que isso, pedir ao usuário para refinar seleção
- Ou implementar estratégia de sumarização

### 2. Posicionamento de Elementos Novos
**Pergunta**: Como garantir que elementos novos são posicionados de forma inteligente?

**Opções**:
- **A**: IA decide posicionamento absoluto (x, y)
- **B**: IA decide posicionamento relativo ("to the right of element X")
- **C**: Frontend auto-posiciona após geração

**Proposta**: Opção A inicialmente, com opção C como fallback/refinamento.

### 3. Preview Visual
**Pergunta**: Como mostrar preview dos elementos antes de aplicar?

**Opções**:
- **A**: Overlay temporário no canvas
- **B**: Thumbnail/preview em modal separado
- **C**: Aplicar no canvas com possibilidade de desfazer

**Proposta**: Opção A - overlay com elementos destacados em cor diferente.

### 4. Model Selection
**Pergunta**: Permitir ao usuário escolher modelo ou decidir automaticamente?

**Proposta**:
- Default: `gpt-4o-mini` (custo-benefício)
- Advanced option: Dropdown para escolher outros modelos
- Auto-upgrade para GPT-4o se request complexo

### 5. Rate Limiting
**Pergunta**: Como evitar abuse e controlar custos?

**Proposta**:
- Limite por usuário: 50 completions/dia
- Limite por request: max 10 elementos gerados
- Tracking de tokens usados

## 📊 Métricas de Sucesso

1. **Aceitação**: % de completions aceitos vs rejeitados
2. **Qualidade**: User ratings de resultados
3. **Performance**: Tempo médio de geração
4. **Custo**: Tokens usados por completion
5. **Adoção**: % de usuários que usam a feature

## 🎯 Próximos Passos

1. ✅ Review deste documento
2. ⏭️ Responder questões técnicas em aberto
3. ⏭️ Criar spike para testar AI_GENERATE_OBJECT com schema Excalidraw
4. ⏭️ Implementar Fase 1 (Backend)
5. ⏭️ Iterar com testes reais
