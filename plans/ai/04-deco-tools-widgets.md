# Deco Tools as Widgets - AI Integration

## 🎯 Objetivo

Integrar o ecossistema de tools MCP da plataforma Deco diretamente no canvas Excalidraw, permitindo que qualquer tool disponível seja usado como um widget interativo.

## 💡 Conceito

Deco Tools Widgets são:
- **Descobríveis**: Todos os tools do workspace ficam disponíveis na widget library
- **Configuráveis**: Parâmetros do tool viram campos de configuração do widget
- **Executáveis**: Widget pode executar o tool e mostrar resultado
- **Visuais**: Resultado do tool pode ser renderizado no canvas
- **Integrados**: Output de um tool pode ser input de outro

### Exemplo Conceitual

```
Tool MCP disponível:          Vira Widget:
┌─────────────────────┐      ┌─────────────────────┐
│ DATABASES_RUN_SQL   │  →   │  📊 SQL Query      │
│                     │      │  Widget            │
│ input:              │      │                    │
│   sql: string       │      │  SQL: [SELECT...]  │
│   params: array     │      │  [Run Query 🚀]    │
│                     │      │                    │
│ output:             │      │  Results: 10 rows  │
│   results: array    │      │  [Show as Table]   │
└─────────────────────┘      └─────────────────────┘
```

## 🎨 UX Design

### 1. Tools Discovery

```
┌─────────────────────────────────────────────────────┐
│  Deco Tools                                   [X]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  🔍 Search tools... [________________]  [Refresh]  │
│                                                     │
│  📂 Your Workspace Tools                            │
│                                                     │
│  🗄️  Databases (5 tools)                           │
│  ├── RUN_SQL                                        │
│  ├── LIST_TABLES                                    │
│  ├── DESCRIBE_TABLE                                 │
│  ├── CREATE_TABLE                                   │
│  └── DROP_TABLE                                     │
│                                                     │
│  🌐 APIs (3 tools)                                  │
│  ├── HTTP_REQUEST                                   │
│  ├── WEATHER_API                                    │
│  └── GEOCODE_ADDRESS                                │
│                                                     │
│  🤖 AI Tools (4 tools)                              │
│  ├── AI_GENERATE_TEXT                               │
│  ├── AI_GENERATE_OBJECT                             │
│  ├── AI_COMPLETE_DRAWING                            │
│  └── AI_CREATE_INLINE_APP                           │
│                                                     │
│  📁 Files (3 tools)                                 │
│  ├── FS_READ                                        │
│  ├── FS_WRITE                                       │
│  └── FS_LIST                                        │
│                                                     │
│  ⚙️ Workflows (2 workflows)                         │
│  ├── DATA_PROCESSING_PIPELINE                       │
│  └── REPORT_GENERATION                              │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 2. Tool Widget Configuration

```
┌─────────────────────────────────────────────────────┐
│  Configure Tool Widget: RUN_SQL               [X]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  📝 Tool Description:                               │
│  Execute SQL queries against the workspace database │
│                                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                     │
│  ⚙️ Input Parameters:                               │
│                                                     │
│  SQL Query (required):                              │
│  ┌───────────────────────────────────────────────┐ │
│  │ SELECT * FROM users                           │ │
│  │ WHERE created_at > ?                          │ │
│  │ ORDER BY created_at DESC                      │ │
│  │ LIMIT 10                                      │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  Parameters (optional):                             │
│  [ '2024-01-01' ]                                   │
│                                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                     │
│  🎨 Display Options:                                │
│                                                     │
│  Show result as:                                    │
│  ⦿ Table         ○ JSON         ○ Text             │
│                                                     │
│  Auto-execute:   ☐ On canvas load                   │
│                  ☐ On parameters change             │
│                                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                     │
│  🔗 Output Connections:                             │
│                                                     │
│  Send output to:                                    │
│  ☐ Another tool widget                              │
│  ☐ Inline app                                       │
│  ☐ Drawing elements (via AI)                        │
│                                                     │
│  [Test Run 🧪]            [Cancel]  [Add to Canvas] │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 3. Tool Widget no Canvas

```
Canvas View:
┌──────────────────────────────────────────────────────┐
│                                                      │
│   ┌────────────────────────────────────────────┐    │
│   │  📊 SQL Query Widget                       │    │
│   ├────────────────────────────────────────────┤    │
│   │  SELECT * FROM users WHERE...              │    │
│   │                                            │    │
│   │  [▶️ Run Query]  Last run: 2 min ago       │    │
│   ├────────────────────────────────────────────┤    │
│   │  Results (10 rows):                        │    │
│   │  ┌──────────────────────────────────────┐  │    │
│   │  │ ID │ Name      │ Email              │  │    │
│   │  ├────┼───────────┼────────────────────┤  │    │
│   │  │ 1  │ John Doe  │ john@example.com   │  │    │
│   │  │ 2  │ Jane Smith│ jane@example.com   │  │    │
│   │  │ ...│ ...       │ ...                │  │    │
│   │  └──────────────────────────────────────┘  │    │
│   │                                            │    │
│   │  [📋 Copy] [📥 Export] [⚙️ Configure] [🗑️]  │    │
│   └────────────────────────────────────────────┘    │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 4. Tool Chaining

```
Canvas View - Workflow with multiple tool widgets:
┌──────────────────────────────────────────────────────┐
│                                                      │
│   ┌──────────────┐                                  │
│   │ 📊 SQL Query │                                  │
│   │ Widget       │                                  │
│   └──────┬───────┘                                  │
│          │                                          │
│          │ results                                  │
│          ▼                                          │
│   ┌──────────────┐                                  │
│   │ 🤖 AI        │                                  │
│   │ Summarize    │                                  │
│   │ Widget       │                                  │
│   └──────┬───────┘                                  │
│          │                                          │
│          │ summary                                  │
│          ▼                                          │
│   ┌──────────────┐                                  │
│   │ 📊 Chart     │                                  │
│   │ Generator    │                                  │
│   │ Widget       │                                  │
│   └──────────────┘                                  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

## 🔧 Tools Necessárias (Backend)

### 1. DISCOVER_DECO_TOOLS

```typescript
/**
 * Tool: DISCOVER_DECO_TOOLS
 * 
 * Lista todos os tools MCP disponíveis no workspace.
 */
export const createDiscoverDecoToolsTool = (env: Env) =>
  createTool({
    id: "DISCOVER_DECO_TOOLS",
    description: "Lista todos os tools MCP disponíveis no workspace",
    
    inputSchema: z.object({
      category: z.string().optional(),
      search: z.string().optional(),
    }),
    
    outputSchema: z.object({
      tools: z.array(z.object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
        category: z.string().optional(),
        inputSchema: z.record(z.any()),
        outputSchema: z.record(z.any()),
        integration: z.string(), // e.g., "DATABASES", "AI", etc
      })),
    }),
    
    execute: async ({ context }) => {
      // Esta tool precisa introspecção do runtime
      // Pode usar metadata do deco.gen.ts ou API de discovery
      
      // Por enquanto, retornar tools conhecidas manualmente
      // TODO: Implementar discovery automático via reflection/metadata
      
      const tools = [
        {
          id: "DATABASES_RUN_SQL",
          name: "Run SQL Query",
          description: "Execute SQL queries against database",
          category: "Databases",
          inputSchema: {
            sql: { type: "string", required: true },
            params: { type: "array", required: false },
          },
          outputSchema: {
            results: { type: "array" },
          },
          integration: "DATABASES",
        },
        // ... mais tools
      ];
      
      let filtered = tools;
      
      if (context.category) {
        filtered = filtered.filter(t => t.category === context.category);
      }
      
      if (context.search) {
        filtered = filtered.filter(t => 
          t.name.toLowerCase().includes(context.search.toLowerCase()) ||
          t.description.toLowerCase().includes(context.search.toLowerCase())
        );
      }
      
      return { tools: filtered };
    },
  });
```

### 2. CREATE_TOOL_WIDGET

```typescript
/**
 * Tool: CREATE_TOOL_WIDGET
 * 
 * Cria um widget que wrappeia um tool MCP.
 */
export const createCreateToolWidgetTool = (env: Env) =>
  createTool({
    id: "CREATE_TOOL_WIDGET",
    description: "Cria widget a partir de um tool MCP",
    
    inputSchema: z.object({
      toolId: z.string(),
      config: z.object({
        position: z.object({
          x: z.number(),
          y: z.number(),
        }),
        size: z.object({
          width: z.number().default(400),
          height: z.number().default(300),
        }),
        defaultInputs: z.record(z.any()).optional(),
        displayMode: z.enum(["table", "json", "text", "chart"]).default("table"),
        autoExecute: z.boolean().default(false),
      }),
    }),
    
    outputSchema: z.object({
      widgetInstance: z.object({
        id: z.string(),
        toolId: z.string(),
        elementId: z.string(), // Excalidraw element
        config: z.any(),
        createdAt: z.number(),
      }),
      success: z.boolean(),
      error: z.string().optional(),
    }),
    
    execute: async ({ context }) => {
      const { toolId, config } = context;
      
      // 1. Validar que tool existe
      const discovery = await env.SELF.DISCOVER_DECO_TOOLS({});
      const tool = discovery.tools.find((t: any) => t.id === toolId);
      
      if (!tool) {
        return {
          widgetInstance: null,
          success: false,
          error: `Tool not found: ${toolId}`,
        };
      }
      
      // 2. Criar widget instance
      const widgetInstanceId = `tool_widget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // 3. Criar visual do widget (pode ser gerado com IA)
      const visualResult = await env.DECO_CHAT_WORKSPACE_API.AI_GENERATE_OBJECT({
        messages: [{
          role: "user",
          content: `Create a widget visual for MCP tool "${tool.name}". 
          Make it look like a data panel/dashboard with an icon representing ${tool.category}.`
        }],
        schema: buildExcalidrawElementsSchema(5),
        model: "gpt-4o-mini",
      });
      
      const widgetInstance = {
        id: widgetInstanceId,
        toolId,
        elementId: visualResult.object?.elements[0]?.id || widgetInstanceId,
        config,
        createdAt: Date.now(),
      };
      
      return {
        widgetInstance,
        success: true,
      };
    },
  });
```

### 3. EXECUTE_TOOL_WIDGET

```typescript
/**
 * Tool: EXECUTE_TOOL_WIDGET
 * 
 * Executa o tool associado a um widget.
 */
export const createExecuteToolWidgetTool = (env: Env) =>
  createTool({
    id: "EXECUTE_TOOL_WIDGET",
    description: "Executa tool MCP de um widget",
    
    inputSchema: z.object({
      widgetInstanceId: z.string(),
      inputs: z.record(z.any()), // Inputs fornecidos pelo usuário
    }),
    
    outputSchema: z.object({
      result: z.any(),
      executionTime: z.number(),
      success: z.boolean(),
      error: z.string().optional(),
    }),
    
    execute: async ({ context, runtimeContext }) => {
      const { widgetInstanceId, inputs } = context;
      
      // 1. Carregar widget instance (de onde?)
      // Por enquanto assumir que está no runtime context ou store
      
      // 2. Executar o tool real
      // Isto requer reflexão/proxy para chamar tools dinamicamente
      // Exemplo:
      const toolId = "DATABASES_RUN_SQL"; // Vem do widget instance
      
      const startTime = Date.now();
      
      try {
        // Chamada dinâmica ao tool
        // @ts-ignore - dynamic call
        const result = await env.DATABASES.RUN_SQL(inputs);
        
        const executionTime = Date.now() - startTime;
        
        return {
          result,
          executionTime,
          success: true,
        };
      } catch (error) {
        return {
          result: null,
          executionTime: Date.now() - startTime,
          success: false,
          error: error.message,
        };
      }
    },
  });
```

### 4. CONNECT_TOOL_WIDGETS

```typescript
/**
 * Tool: CONNECT_TOOL_WIDGETS
 * 
 * Conecta output de um widget ao input de outro (tool chaining).
 */
export const createConnectToolWidgetsTool = (env: Env) =>
  createTool({
    id: "CONNECT_TOOL_WIDGETS",
    description: "Conecta output de um widget ao input de outro",
    
    inputSchema: z.object({
      sourceWidgetId: z.string(),
      targetWidgetId: z.string(),
      mapping: z.object({
        sourceOutput: z.string(), // path no output do source
        targetInput: z.string(),  // path no input do target
      }),
    }),
    
    outputSchema: z.object({
      connection: z.object({
        id: z.string(),
        sourceWidgetId: z.string(),
        targetWidgetId: z.string(),
        mapping: z.any(),
        createdAt: z.number(),
      }),
      success: z.boolean(),
    }),
    
    execute: async ({ context }) => {
      const { sourceWidgetId, targetWidgetId, mapping } = context;
      
      const connectionId = `connection_${Date.now()}`;
      
      const connection = {
        id: connectionId,
        sourceWidgetId,
        targetWidgetId,
        mapping,
        createdAt: Date.now(),
      };
      
      // Salvar connection no DECONFIG ou drawing metadata
      
      return {
        connection,
        success: true,
      };
    },
  });
```

## 🎭 Integração com Frontend (Zustand)

### 1. Tool Widgets Store

Estender `widgets-store.ts` ou criar `tool-widgets-store.ts`:

```typescript
/**
 * State para Tool Widgets
 */

interface DecoTool {
  id: string;
  name: string;
  description: string;
  category?: string;
  inputSchema: Record<string, any>;
  outputSchema: Record<string, any>;
  integration: string;
}

interface ToolWidgetInstance {
  id: string;
  toolId: string;
  elementId: string; // Excalidraw element
  config: {
    defaultInputs?: Record<string, any>;
    displayMode: "table" | "json" | "text" | "chart";
    autoExecute: boolean;
  };
  lastExecution?: {
    timestamp: number;
    result: any;
    error?: string;
    executionTime: number;
  };
}

interface ToolWidgetConnection {
  id: string;
  sourceWidgetId: string;
  targetWidgetId: string;
  mapping: {
    sourceOutput: string;
    targetInput: string;
  };
}

interface ToolWidgetsState {
  // State
  availableTools: DecoTool[];
  toolWidgets: ToolWidgetInstance[];
  connections: ToolWidgetConnection[];
  executingWidgetIds: string[];
  
  // Actions
  discoverTools: () => Promise<void>;
  createToolWidget: (toolId: string, config: any) => Promise<void>;
  executeToolWidget: (widgetId: string, inputs: Record<string, any>) => Promise<void>;
  connectWidgets: (sourceId: string, targetId: string, mapping: any) => Promise<void>;
  deleteToolWidget: (widgetId: string) => void;
  
  // Getters
  getToolById: (toolId: string) => DecoTool | undefined;
  getWidgetById: (widgetId: string) => ToolWidgetInstance | undefined;
}

export const useToolWidgetsStore = create<ToolWidgetsState>()(
  devtools(
    (set, get) => ({
      // Implementation...
      
      availableTools: [],
      toolWidgets: [],
      connections: [],
      executingWidgetIds: [],
      
      discoverTools: async () => {
        const result = await client.DISCOVER_DECO_TOOLS({});
        set({ availableTools: result.tools });
      },
      
      createToolWidget: async (toolId, config) => {
        const result = await client.CREATE_TOOL_WIDGET({
          toolId,
          config,
        });
        
        if (result.success) {
          set((state) => ({
            toolWidgets: [...state.toolWidgets, result.widgetInstance],
          }));
        }
      },
      
      executeToolWidget: async (widgetId, inputs) => {
        set((state) => ({
          executingWidgetIds: [...state.executingWidgetIds, widgetId],
        }));
        
        try {
          const result = await client.EXECUTE_TOOL_WIDGET({
            widgetInstanceId: widgetId,
            inputs,
          });
          
          // Update widget with result
          set((state) => ({
            toolWidgets: state.toolWidgets.map((w) =>
              w.id === widgetId
                ? {
                    ...w,
                    lastExecution: {
                      timestamp: Date.now(),
                      result: result.result,
                      error: result.error,
                      executionTime: result.executionTime,
                    },
                  }
                : w
            ),
            executingWidgetIds: state.executingWidgetIds.filter((id) => id !== widgetId),
          }));
          
          // Se há connections, executar widgets dependentes
          const connections = get().connections.filter(
            (c) => c.sourceWidgetId === widgetId
          );
          
          for (const conn of connections) {
            // Extrair output do source
            const sourceOutput = result.result; // Aplicar mapping
            
            // Executar target widget com output do source
            await get().executeToolWidget(conn.targetWidgetId, {
              [conn.mapping.targetInput]: sourceOutput,
            });
          }
        } catch (error) {
          console.error("Tool widget execution failed:", error);
          set((state) => ({
            executingWidgetIds: state.executingWidgetIds.filter((id) => id !== widgetId),
          }));
        }
      },
      
      connectWidgets: async (sourceId, targetId, mapping) => {
        const result = await client.CONNECT_TOOL_WIDGETS({
          sourceWidgetId: sourceId,
          targetWidgetId: targetId,
          mapping,
        });
        
        if (result.success) {
          set((state) => ({
            connections: [...state.connections, result.connection],
          }));
        }
      },
      
      deleteToolWidget: (widgetId) => {
        set((state) => ({
          toolWidgets: state.toolWidgets.filter((w) => w.id !== widgetId),
          connections: state.connections.filter(
            (c) => c.sourceWidgetId !== widgetId && c.targetWidgetId !== widgetId
          ),
        }));
      },
      
      getToolById: (toolId) => {
        return get().availableTools.find((t) => t.id === toolId);
      },
      
      getWidgetById: (widgetId) => {
        return get().toolWidgets.find((w) => w.id === widgetId);
      },
    }),
    { name: "ToolWidgetsStore" }
  )
);
```

### 2. UI Components

**ToolsDiscoveryDialog.tsx**: Browse available tools

**ToolWidgetConfigDialog.tsx**: Configure tool widget parameters

**ToolWidgetPanel.tsx**: Show tool widget with inputs/outputs

**ToolWidgetConnection.tsx**: Visual connection between widgets

## 🚀 Implementação Step-by-Step

### Fase 1: Discovery & Metadata
1. ✅ Implementar `DISCOVER_DECO_TOOLS`
2. ✅ Extrair schemas dos tools disponíveis
3. ✅ Categorização de tools
4. ✅ Cache de metadata

### Fase 2: Basic Tool Widgets
1. ✅ Implementar `CREATE_TOOL_WIDGET`
2. ✅ Implementar `EXECUTE_TOOL_WIDGET`
3. ✅ UI para executar tool widgets
4. ✅ Display de resultados

### Fase 3: Tool Chaining
1. ✅ Implementar `CONNECT_TOOL_WIDGETS`
2. ✅ Visual de connections no canvas
3. ✅ Execution pipeline
4. ✅ Error propagation

### Fase 4: Advanced Features
1. ✅ Caching de execuções
2. ✅ Parallel execution
3. ✅ Conditional execution
4. ✅ Scheduling/triggers

### Fase 5: Polish
1. ✅ Performance optimization
2. ✅ Better error handling
3. ✅ Monitoring & logging
4. ✅ Documentation

## 🎯 Casos de Uso

### 1. Database Query → Chart
1. Add SQL Query widget
2. Configure query
3. Add Chart widget
4. Connect query results to chart data
5. Run query → Chart updates automatically

### 2. API Call → AI Summary → Diagram
1. Add HTTP Request widget (fetch data)
2. Add AI Summarize widget
3. Add AI Complete Drawing widget
4. Connect: API → AI → Drawing
5. Execute pipeline

### 3. Workflow Trigger → Monitoring
1. Add Workflow Trigger widget
2. Configure workflow params
3. Add Status Monitor widget
4. Connect workflow output to monitor
5. Real-time status updates

## ❓ Questões Técnicas

### 1. Dynamic Tool Invocation
**Pergunta**: Como chamar tools MCP dinamicamente pelo ID?

**Opções**:
- **A**: Usar proxy/reflection em runtime
- **B**: Mapear manualmente toolId → função
- **C**: Usar `env[integration][toolId]` com type casting

**Proposta**: Opção C inicialmente, evoluir para A.

### 2. Output → Input Mapping
**Pergunta**: Como mapear outputs complexos para inputs de outros widgets?

**Proposta**:
- Usar JSONPath ou similar para extrair campos
- UI visual para criar mappings
- Transformations via JavaScript expressions

### 3. Tool Permissions
**Pergunta**: Todos os tools devem ser expostos ou alguns requerem permissão?

**Proposta**:
- Categorizar tools por sensibilidade
- Requerer confirmação para tools destrutivos
- Audit log de execuções

## 📊 Métricas de Sucesso

1. **Adoption**: % de desenhos usando tool widgets
2. **Coverage**: % de tools disponíveis usados
3. **Chaining**: Média de widgets conectados por desenho
4. **Performance**: Tempo médio de execução
5. **Errors**: Taxa de erro por tool

## 🔒 Segurança

### Tool Execution
- Validação de inputs antes de executar
- Rate limiting por tool e por usuário
- Timeout de execução
- Audit log completo

### Data Exposure
- Sanitização de outputs sensíveis
- Opt-in para tools que acessam dados privados
- Masking de credenciais/secrets

## 🎯 Próximos Passos

1. ✅ Review deste documento
2. ⏭️ Implementar tool discovery mechanism
3. ⏭️ Criar spike para dynamic tool invocation
4. ⏭️ Desenvolver UI básica
5. ⏭️ Testar com tools reais do workspace
