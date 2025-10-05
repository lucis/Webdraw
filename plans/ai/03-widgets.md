# Widgets - AI Integration

## 🎯 Objetivo

Criar um sistema de widgets que funcionam como "abstrações visuais" - desenhos especiais que escondem informações complexas, servindo como prompts parametrizados e templates reutilizáveis.

## 💡 Conceito

Widgets são elementos Excalidraw especiais que:
- **Visualmente**: Aparecem como desenhos normais (retângulos coloridos, ícones)
- **Semanticamente**: Carregam metadata estruturada (JSON)
- **Funcionalmente**: Podem ser editados via UI especializada
- **Inteligentemente**: Podem expandir-se em desenhos completos via IA

### Exemplo Conceitual

```
Visual no Canvas:           Metadata Escondida:
┌─────────────────┐        {
│  📊 Chart       │          "type": "widget",
│  Widget         │          "widgetType": "chart",
│                 │          "config": {
│  [Edit Config]  │            "dataSource": "table1",
└─────────────────┘            "chartType": "bar",
                               "colors": ["#FF6384", "#36A2EB"]
                             },
                             "prompt": "Create a bar chart showing..."
                           }
```

## 🎨 UX Design

### 1. Widget Library

```
┌─────────────────────────────────────────────────────┐
│  Widget Library                               [X]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  🔍 Search widgets... [________________]            │
│                                                     │
│  📊 Data Visualization                              │
│  ┌──────┐ ┌──────┐ ┌──────┐                        │
│  │ Bar  │ │ Line │ │ Pie  │                        │
│  │Chart │ │Chart │ │Chart │                        │
│  └──────┘ └──────┘ └──────┘                        │
│                                                     │
│  📝 Forms & Input                                   │
│  ┌──────┐ ┌──────┐ ┌──────┐                        │
│  │Button│ │Input │ │Table │                        │
│  └──────┘ └──────┘ └──────┘                        │
│                                                     │
│  🎨 Design Elements                                 │
│  ┌──────┐ ┌──────┐ ┌──────┐                        │
│  │Card  │ │Badge │ │Icon  │                        │
│  └──────┘ └──────┘ └──────┘                        │
│                                                     │
│  ⭐ Your Widgets                                    │
│  ┌──────┐ ┌──────┐                                 │
│  │Custom│ │My    │                                 │
│  │Flow  │ │Button│                                 │
│  └──────┘ └──────┘                                 │
│                                                     │
│  [+ Create New Widget]                              │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 2. Widget Configuration

Quando usuário clica em widget no canvas:

```
┌─────────────────────────────────────────────────────┐
│  Configure Widget: Button                     [X]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Preview:                                           │
│  ┌─────────────────────────────────────────────┐   │
│  │                                             │   │
│  │         [ Click Me! ]                       │   │
│  │                                             │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ⚙️ Configuration:                                  │
│                                                     │
│  Label: [Click Me!_______________]                  │
│                                                     │
│  Style:  ○ Primary  ⦿ Secondary  ○ Outlined        │
│                                                     │
│  Size:   ○ Small    ⦿ Medium     ○ Large           │
│                                                     │
│  Colors:                                            │
│  Background: [#3B82F6] 🎨                           │
│  Text:       [#FFFFFF] 🎨                           │
│                                                     │
│  Action:                                            │
│  ○ None                                             │
│  ⦿ AI Expand (Create drawing from config)          │
│  ○ Run Tool (Connect to MCP tool)                  │
│  ○ Custom JavaScript                                │
│                                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                     │
│  💡 AI Expansion Prompt:                            │
│  ┌───────────────────────────────────────────────┐ │
│  │ Create a modern call-to-action button with   │ │
│  │ the label "{label}" using {style} style      │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  Variables: {label}, {style}, {backgroundColor}    │
│                                                     │
│  [Cancel]     [Expand Now ✨]     [Save Config]    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 3. Widget Expansion

Quando usuário clica "Expand Now":

```
Canvas Before:                    Canvas After:
┌────────────────────┐           ┌─────────────────────────────┐
│                    │           │                             │
│  ┌──────────────┐  │           │  ┌────────────────────────┐│
│  │  [ Button ]  │  │  ──────>  │  │  ┌──────────────────┐ ││
│  │   Widget     │  │           │  │  │                  │ ││
│  └──────────────┘  │           │  │  │  [ Click Me! ]   │ ││
│                    │           │  │  │                  │ ││
│                    │           │  │  └──────────────────┘ ││
│                    │           │  │                        ││
│                    │           │  │  Hover effect shape    ││
│                    │           │  │  Shadow element        ││
│                    │           │  │  Border decoration     ││
│                    │           │  └────────────────────────┘│
│                    │           │                             │
└────────────────────┘           └─────────────────────────────┘
   (Widget collapses)                (Expanded drawing)
```

### 4. Widget Creation

```
┌─────────────────────────────────────────────────────┐
│  Create New Widget                            [X]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Step 1: Design the Widget                         │
│                                                     │
│  Name: [My Custom Widget_________]                  │
│                                                     │
│  Visual Representation:                             │
│  ○ Use Excalidraw drawing                           │
│  ⦿ Generate with AI                                 │
│  ○ Use emoji/icon                                   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ Describe how this widget should look:      │   │
│  │                                             │   │
│  │ [e.g., "A purple rectangle with a star     │   │
│  │  icon and the text 'API Call'"]            │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                     │
│  Step 2: Define Configuration Schema                │
│                                                     │
│  Fields: [+ Add Field]                              │
│  ┌───────────────────────────────────────────────┐ │
│  │ • title (text) - Required                     │ │
│  │ • color (color) - Default: #3B82F6           │ │
│  │ • size (select: small, medium, large)        │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                     │
│  Step 3: AI Expansion Prompt                        │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │ When expanded, create a {size} component     │ │
│  │ with title "{title}" and primary color       │ │
│  │ {color}. Include decorative elements and     │ │
│  │ make it visually appealing.                  │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  [Back]                        [Create Widget 🚀]  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## 🔧 Tools Necessárias (Backend)

### 1. AI_CREATE_WIDGET_DEFINITION

```typescript
/**
 * Tool: AI_CREATE_WIDGET_DEFINITION
 * 
 * Cria a definição de um widget (visual + schema + prompt).
 */
export const createAICreateWidgetDefinitionTool = (env: Env) =>
  createTool({
    id: "AI_CREATE_WIDGET_DEFINITION",
    description: "Cria definição de um novo widget",
    
    inputSchema: z.object({
      name: z.string(),
      description: z.string(),
      visualDescription: z.string(),
      configSchema: z.array(z.object({
        name: z.string(),
        type: z.enum(["text", "number", "color", "select", "boolean"]),
        required: z.boolean(),
        default: z.any().optional(),
        options: z.array(z.string()).optional(), // For select type
      })),
      expansionPromptTemplate: z.string(),
    }),
    
    outputSchema: z.object({
      widgetDefinition: z.object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
        visualElements: z.array(z.any()), // Excalidraw elements
        configSchema: z.array(z.any()),
        expansionPromptTemplate: z.string(),
        createdAt: z.number(),
      }),
      success: z.boolean(),
      error: z.string().optional(),
    }),
    
    execute: async ({ context }) => {
      const { name, description, visualDescription, configSchema, expansionPromptTemplate } = context;
      
      // 1. Gerar visual do widget com IA
      const visualResult = await env.DECO_CHAT_WORKSPACE_API.AI_GENERATE_OBJECT({
        messages: [{
          role: "user",
          content: `Create a simple Excalidraw drawing for a widget: ${visualDescription}. 
          Keep it minimal (2-3 elements max), iconic, and recognizable at small size.`
        }],
        schema: buildExcalidrawElementsSchema(3),
        model: "gpt-4o-mini",
      });
      
      if (!visualResult.object) {
        return {
          widgetDefinition: null,
          success: false,
          error: "Failed to generate widget visual",
        };
      }
      
      // 2. Criar definição do widget
      const widgetId = `widget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const widgetDefinition = {
        id: widgetId,
        name,
        description,
        visualElements: visualResult.object.elements,
        configSchema,
        expansionPromptTemplate,
        createdAt: Date.now(),
      };
      
      // 3. Salvar no DECONFIG
      await env.DECONFIG.PUT_FILE({
        branch: "main",
        path: `webdraw/widgets/${widgetId}.json`,
        content: JSON.stringify(widgetDefinition, null, 2),
        metadata: {
          app: "webdraw",
          type: "widget-definition",
          widgetId,
        },
      });
      
      return {
        widgetDefinition,
        success: true,
      };
    },
  });
```

### 2. AI_EXPAND_WIDGET

```typescript
/**
 * Tool: AI_EXPAND_WIDGET
 * 
 * Expande um widget em desenho completo baseado em sua configuração.
 */
export const createAIExpandWidgetTool = (env: Env) =>
  createTool({
    id: "AI_EXPAND_WIDGET",
    description: "Expande um widget em desenho completo",
    
    inputSchema: z.object({
      widgetId: z.string(),
      config: z.record(z.any()), // User configuration values
      contextElements: z.array(z.any()).optional(), // Surrounding elements for context
    }),
    
    outputSchema: z.object({
      elements: z.array(z.any()),
      metadata: z.object({
        widgetId: z.string(),
        widgetName: z.string(),
        elementsGenerated: z.number(),
        tokensUsed: z.number(),
      }),
      success: z.boolean(),
      error: z.string().optional(),
    }),
    
    execute: async ({ context }) => {
      const { widgetId, config, contextElements } = context;
      
      // 1. Carregar definição do widget
      const widgetDefResult = await env.DECONFIG.READ_FILE({
        branch: "main",
        path: `webdraw/widgets/${widgetId}.json`,
        format: "plainString",
      });
      
      const widgetDef = JSON.parse(widgetDefResult.content as string);
      
      // 2. Interpolar variáveis no prompt
      let prompt = widgetDef.expansionPromptTemplate;
      for (const [key, value] of Object.entries(config)) {
        prompt = prompt.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
      }
      
      // 3. Chamar AI_COMPLETE_DRAWING com prompt interpolado
      const result = await env.SELF.AI_COMPLETE_DRAWING({
        prompt,
        contextElements: contextElements || [],
        options: {
          maxElements: 20,
          autoArrange: true,
        },
      });
      
      if (!result.success) {
        return {
          elements: [],
          metadata: null,
          success: false,
          error: result.error,
        };
      }
      
      return {
        elements: result.elements,
        metadata: {
          widgetId,
          widgetName: widgetDef.name,
          elementsGenerated: result.elements.length,
          tokensUsed: result.metadata.tokensUsed,
        },
        success: true,
      };
    },
  });
```

### 3. Widget Management Tools

```typescript
/**
 * Tool: LIST_WIDGETS
 */
export const createListWidgetsTool = (env: Env) =>
  createTool({
    id: "LIST_WIDGETS",
    description: "Lista todos os widgets disponíveis",
    
    inputSchema: z.object({
      category: z.string().optional(),
      search: z.string().optional(),
    }),
    
    outputSchema: z.object({
      widgets: z.array(z.object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
        category: z.string().optional(),
        visualElements: z.array(z.any()),
      })),
    }),
    
    execute: async ({ context }) => {
      // Implementação de listagem
    },
  });

/**
 * Tool: GET_WIDGET
 */
export const createGetWidgetTool = (env: Env) =>
  createTool({
    id: "GET_WIDGET",
    description: "Obtém definição de um widget",
    
    inputSchema: z.object({
      widgetId: z.string(),
    }),
    
    outputSchema: z.object({
      widget: z.object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
        visualElements: z.array(z.any()),
        configSchema: z.array(z.any()),
        expansionPromptTemplate: z.string(),
      }).nullable(),
    }),
    
    execute: async ({ context }) => {
      // Implementação de get
    },
  });

/**
 * Tool: DELETE_WIDGET
 */
export const createDeleteWidgetTool = (env: Env) =>
  createTool({
    id: "DELETE_WIDGET",
    description: "Deleta um widget",
    
    inputSchema: z.object({
      widgetId: z.string(),
    }),
    
    outputSchema: z.object({
      success: z.boolean(),
    }),
    
    execute: async ({ context }) => {
      // Implementação de delete
    },
  });
```

## 🎭 Integração com Frontend (Zustand)

### 1. Widgets Store

```typescript
/**
 * Zustand Store para Widgets
 */

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

interface WidgetDefinition {
  id: string;
  name: string;
  description: string;
  category?: string;
  visualElements: any[];
  configSchema: Array<{
    name: string;
    type: string;
    required: boolean;
    default?: any;
    options?: string[];
  }>;
  expansionPromptTemplate: string;
  createdAt: number;
}

interface WidgetInstance {
  id: string; // Unique instance ID
  widgetId: string; // Reference to definition
  elementId: string; // Excalidraw element ID
  config: Record<string, any>; // User-provided config values
  expanded: boolean;
  expandedElements?: string[]; // IDs of elements created by expansion
}

interface WidgetsStoreState {
  // ==================== STATE ====================
  
  /** Definições de widgets disponíveis */
  definitions: WidgetDefinition[];
  
  /** Instâncias de widgets no canvas atual */
  instances: WidgetInstance[];
  
  /** Widget atualmente sendo configurado */
  configuringWidgetId: string | null;
  
  /** Dialog states */
  libraryOpen: boolean;
  creationDialogOpen: boolean;
  configDialogOpen: boolean;
  
  /** Loading states */
  isLoading: boolean;
  
  /** Error */
  error: string | null;
  
  // ==================== ACTIONS ====================
  
  /**
   * Carrega definições de widgets
   */
  loadWidgetDefinitions: () => Promise<void>;
  
  /**
   * Cria nova definição de widget
   */
  createWidgetDefinition: (input: {
    name: string;
    description: string;
    visualDescription: string;
    configSchema: any[];
    expansionPromptTemplate: string;
  }) => Promise<WidgetDefinition>;
  
  /**
   * Adiciona instância de widget ao canvas
   */
  addWidgetInstance: (widgetId: string, position: { x: number; y: number }) => Promise<void>;
  
  /**
   * Configura widget existente
   */
  configureWidget: (instanceId: string, config: Record<string, any>) => void;
  
  /**
   * Expande widget em desenho completo
   */
  expandWidget: (instanceId: string) => Promise<void>;
  
  /**
   * Colapsa widget expandido de volta
   */
  collapseWidget: (instanceId: string) => void;
  
  /**
   * Deleta instância de widget
   */
  deleteWidgetInstance: (instanceId: string) => void;
  
  /**
   * Abre/fecha dialogs
   */
  openLibrary: () => void;
  closeLibrary: () => void;
  openCreationDialog: () => void;
  closeCreationDialog: () => void;
  openConfigDialog: (instanceId: string) => void;
  closeConfigDialog: () => void;
}

export const useWidgetsStore = create<WidgetsStoreState>()(
  devtools(
    persist(
      (set, get) => ({
        // ==================== INITIAL STATE ====================
        
        definitions: [],
        instances: [],
        configuringWidgetId: null,
        libraryOpen: false,
        creationDialogOpen: false,
        configDialogOpen: false,
        isLoading: false,
        error: null,
        
        // ==================== ACTIONS ====================
        
        loadWidgetDefinitions: async () => {
          set({ isLoading: true, error: null });
          
          try {
            const result = await client.LIST_WIDGETS({});
            set({
              definitions: result.widgets,
              isLoading: false,
            });
          } catch (error) {
            set({
              error: error.message,
              isLoading: false,
            });
          }
        },
        
        createWidgetDefinition: async (input) => {
          set({ isLoading: true, error: null });
          
          try {
            const result = await client.AI_CREATE_WIDGET_DEFINITION(input);
            
            if (result.success) {
              // Recarregar definições
              await get().loadWidgetDefinitions();
              return result.widgetDefinition;
            } else {
              throw new Error(result.error);
            }
          } catch (error) {
            set({
              error: error.message,
              isLoading: false,
            });
            throw error;
          }
        },
        
        addWidgetInstance: async (widgetId, position) => {
          // Criar elemento Excalidraw para o widget
          // Adicionar instância ao state
          // Detalhes de implementação...
        },
        
        configureWidget: (instanceId, config) => {
          set((state) => ({
            instances: state.instances.map((inst) =>
              inst.id === instanceId
                ? { ...inst, config }
                : inst
            ),
          }));
        },
        
        expandWidget: async (instanceId) => {
          const instance = get().instances.find((i) => i.id === instanceId);
          if (!instance) return;
          
          set({ isLoading: true });
          
          try {
            const result = await client.AI_EXPAND_WIDGET({
              widgetId: instance.widgetId,
              config: instance.config,
            });
            
            if (result.success) {
              // Aplicar elementos ao canvas
              // Marcar widget como expandido
              // Salvar IDs dos elementos gerados
              
              set((state) => ({
                instances: state.instances.map((inst) =>
                  inst.id === instanceId
                    ? {
                        ...inst,
                        expanded: true,
                        expandedElements: result.elements.map((el: any) => el.id),
                      }
                    : inst
                ),
                isLoading: false,
              }));
            }
          } catch (error) {
            set({
              error: error.message,
              isLoading: false,
            });
          }
        },
        
        collapseWidget: (instanceId) => {
          // Remove elementos expandidos
          // Restaura widget visual
          // Marca como não expandido
        },
        
        deleteWidgetInstance: (instanceId) => {
          set((state) => ({
            instances: state.instances.filter((i) => i.id !== instanceId),
          }));
        },
        
        openLibrary: () => set({ libraryOpen: true }),
        closeLibrary: () => set({ libraryOpen: false }),
        openCreationDialog: () => set({ creationDialogOpen: true }),
        closeCreationDialog: () => set({ creationDialogOpen: false }),
        openConfigDialog: (instanceId) => set({ 
          configDialogOpen: true,
          configuringWidgetId: instanceId,
        }),
        closeConfigDialog: () => set({ 
          configDialogOpen: false,
          configuringWidgetId: null,
        }),
      }),
      {
        name: "widgets-storage",
        partialize: (state) => ({
          // Não persistir instances (são específicas do drawing)
          // Persistir apenas definitions se fizer sentido
        }),
      }
    ),
    { name: "WidgetsStore" }
  )
);
```

### 2. Widget Components

**WidgetLibraryDialog.tsx**: Gallery de widgets

**WidgetConfigDialog.tsx**: Formulário de configuração dinâmico

**WidgetCreationDialog.tsx**: Wizard de criação de widget

**WidgetBadge.tsx**: Visual do widget no canvas (overlay)

## 🚀 Implementação Step-by-Step

### Fase 1: Core Infrastructure
1. ✅ Criar schema de widget definitions
2. ✅ Implementar `AI_CREATE_WIDGET_DEFINITION`
3. ✅ Implementar `AI_EXPAND_WIDGET`
4. ✅ Storage layer (DECONFIG)

### Fase 2: Frontend State
1. ✅ Criar `widgets-store.ts`
2. ✅ Implementar CRUD operations
3. ✅ Integração com Excalidraw

### Fase 3: UI Components
1. ✅ Widget library dialog
2. ✅ Configuration dialog com formulário dinâmico
3. ✅ Creation wizard
4. ✅ Widget badge/overlay no canvas

### Fase 4: Built-in Widgets
1. ✅ Button widget
2. ✅ Card widget
3. ✅ Chart widget
4. ✅ Form widget
5. ✅ Icon widget

### Fase 5: Advanced Features
1. ✅ Widget nesting (widgets dentro de widgets)
2. ✅ Widget marketplace/sharing
3. ✅ Widget versioning
4. ✅ Widget import/export

## 🎯 Built-in Widgets Examples

### 1. Button Widget
```json
{
  "name": "Button",
  "configSchema": [
    { "name": "label", "type": "text", "required": true },
    { "name": "style", "type": "select", "options": ["primary", "secondary", "outlined"] },
    { "name": "size", "type": "select", "options": ["small", "medium", "large"] }
  ],
  "expansionPromptTemplate": "Create a modern {style} button with label '{label}' in {size} size"
}
```

### 2. Chart Widget
```json
{
  "name": "Chart",
  "configSchema": [
    { "name": "type", "type": "select", "options": ["bar", "line", "pie"] },
    { "name": "title", "type": "text" },
    { "name": "data", "type": "text", "placeholder": "Enter comma-separated values" }
  ],
  "expansionPromptTemplate": "Create a {type} chart titled '{title}' with data: {data}"
}
```

### 3. Card Widget
```json
{
  "name": "Card",
  "configSchema": [
    { "name": "title", "type": "text", "required": true },
    { "name": "description", "type": "text" },
    { "name": "icon", "type": "text", "placeholder": "emoji" },
    { "name": "color", "type": "color", "default": "#3B82F6" }
  ],
  "expansionPromptTemplate": "Create a card component with title '{title}', description '{description}', icon {icon}, and primary color {color}"
}
```

## ❓ Questões Técnicas

### 1. Widget Metadata Storage
**Pergunta**: Onde armazenar config de widgets no desenho?

**Opções**:
- **A**: Em `customData` do elemento Excalidraw
- **B**: Em arquivo separado no DECONFIG
- **C**: Em drawing metadata

**Proposta**: Opção A - usar `customData` para manter tudo no desenho.

### 2. Widget Expansion Behavior
**Pergunta**: Widget deve desaparecer após expansão ou manter ambos?

**Opções**:
- **A**: Widget vira grupo com elementos expandidos
- **B**: Widget some, elementos ficam
- **C**: Ambos ficam (widget + elementos)

**Proposta**: Opção B com histórico para poder reverter.

### 3. Widget Sharing
**Pergunta**: Como permitir compartilhamento de widgets entre usuários?

**Proposta**:
- Export widget como JSON
- Import de URLs ou arquivos
- Marketplace centralizado (fase futura)

## 📊 Próximos Passos

1. ✅ Review deste documento
2. ⏭️ Definir schema JSON completo para widget definitions
3. ⏭️ Criar built-in widgets base
4. ⏭️ Implementar backend tools
5. ⏭️ Desenvolver UI components
