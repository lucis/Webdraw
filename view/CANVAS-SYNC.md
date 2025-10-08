# 🎨 Canvas Sync - Arquitetura Simplificada

## 📋 Visão Geral

Sistema de sincronização **simples e direto** entre Excalidraw Canvas e Backend, seguindo as melhores práticas do documento oficial.

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                    ExcalidrawCanvas.tsx                      │
│                                                               │
│  1. onChange → detecta mudanças                              │
│  2. Debounce de 2s                                           │
│  3. Save via RPC direto                                      │
│  4. Atualiza metadata no store                               │
└─────────────────────────────────────────────────────────────┘
         │
         │ client.UPDATE_DRAWING()
         ▼
┌─────────────────────────────────────────────────────────────┐
│                         Backend                              │
│                                                               │
│  - Salva elementos, appState, files                          │
│  - Retorna sucesso/erro                                      │
└─────────────────────────────────────────────────────────────┘
         │
         │ metadata update
         ▼
┌─────────────────────────────────────────────────────────────┐
│                    DrawingStore (Zustand)                    │
│                                                               │
│  - Atualiza elementCount                                     │
│  - Atualiza updatedAt                                        │
│  - Mantém currentDrawing                                     │
└─────────────────────────────────────────────────────────────┘
```

## ✅ Características

### **1. API Imperativa Única**
```typescript
const apiRef = useRef<any>(null);

// API montada uma vez
const onExcalidrawAPIMount = useCallback((api: any) => {
  apiRef.current = api;
}, []);
```

### **2. Scene Version Tracking**
```typescript
// Versão simples: contagem de elementos
const currentVersion = elements.length;

// Só salva se versão mudou
if (currentVersion === lastSavedVersionRef.current) {
  return;
}
```

### **3. Debounce Nativo**
```typescript
const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

// Cancelar timeout anterior
if (saveTimeoutRef.current) {
  clearTimeout(saveTimeoutRef.current);
}

// Novo timeout de 2s
saveTimeoutRef.current = setTimeout(async () => {
  await client.UPDATE_DRAWING({...});
}, 2000);
```

### **4. Guards Contra Loops**
```typescript
// 1. Flag de carregamento inicial
const isInitialLoadRef = useRef(true);
if (isInitialLoadRef.current) return;

// 2. Version tracking
if (currentVersion === lastSavedVersionRef.current) return;

// 3. Sem currentDrawing
if (!currentDrawing) return;
```

## 📁 Estrutura de Arquivos

```
view/src/
├── components/
│   └── canvas/
│       └── ExcalidrawCanvas.tsx    # ✅ TODO o código de sync aqui
│
├── stores/
│   └── drawing-store.ts            # ✅ Estado global simples
│
└── hooks/
    └── useDrawingManagement.ts     # ✅ Hooks de conveniência
```

## 🔧 Como Funciona

### **Passo 1: Usuário Desenha**
```typescript
// Excalidraw dispara onChange automaticamente
<Excalidraw onChange={handleChange} />
```

### **Passo 2: Handler Processa**
```typescript
const handleChange = useCallback((elements, appState, files) => {
  // Guards
  if (!currentDrawing) return;
  if (isInitialLoadRef.current) return;
  
  // Version check
  const currentVersion = elements.length;
  if (currentVersion === lastSavedVersionRef.current) return;
  
  // Debounce...
}, [currentDrawing, branch]);
```

### **Passo 3: Save com Debounce**
```typescript
saveTimeoutRef.current = setTimeout(async () => {
  // Atualizar status para "saving" via setState direto
  useDrawingStore.setState({ syncStatus: "saving" });
  
  await client.UPDATE_DRAWING({
    drawingId: currentDrawing.id,
    elements: [...elements],
    appState,
    files,
    branch,
  });
  
  // Update version
  lastSavedVersionRef.current = currentVersion;
  
  // Update metadata e status em uma única operação
  useDrawingStore.setState((state) => ({
    drawings: state.drawings.map(d => 
      d.id === currentDrawing.id 
        ? { ...d, elementCount: elements.length, updatedAt: Date.now() }
        : d
    ),
    syncStatus: "idle"
  }));
}, 2000);
```

## 🚀 Benefícios

### **✅ Simples**
- Apenas 1 componente gerencia sync
- Sem hooks customizados complexos
- Sem sistema paralelo de sync

### **✅ Type-Safe**
- TypeScript em todo lugar
- RPC client tipado
- Store com tipos Zustand

### **✅ Sem Loops**
- Version tracking previne saves desnecessários
- Flags previnem recursão
- Debounce agrupa mudanças

### **✅ Performance**
- Debounce de 2s evita saves excessivos
- Version check pula saves idênticos
- Metadata update local (sem refetch)

### **✅ Preparado para AI**
- API imperativa exposta
- Fácil adicionar elementos via código
- Streaming updates possível

## 🤖 Uso com AI

```typescript
// Adicionar elementos gerados por AI
const addAIElements = async (aiElements: any[]) => {
  if (!apiRef.current) return;
  
  const currentElements = apiRef.current.getSceneElements();
  
  // Adicionar novos elementos
  apiRef.current.updateScene({
    elements: [...currentElements, ...aiElements]
  });
  
  // onChange será chamado automaticamente
  // Debounce vai agendar o save
};

// Streaming incremental
for await (const chunk of aiStream()) {
  const element = parseChunk(chunk);
  addAIElements([element]);
  // Cada chunk atualiza o canvas
  // Debounce agrupa os saves
}
```

## 📊 Estado do Sistema

### **DrawingStore (Zustand)**
```typescript
interface DrawingStoreState {
  // Dados
  folders: Folder[];
  drawings: DrawingMetadata[];
  currentDrawing: Drawing | null;
  
  // Status
  syncStatus: "idle" | "saving" | "error";
  
  // Actions
  loadDrawing: (id: string) => Promise<void>;
  // ... outros métodos CRUD
}
```

### **ExcalidrawCanvas (Component)**
```typescript
// Refs para tracking
const apiRef = useRef<any>(null);                    // API do Excalidraw
const isInitialLoadRef = useRef(true);               // Flag de carregamento
const saveTimeoutRef = useRef<NodeJS.Timeout>(null); // Timeout do debounce
const lastSavedVersionRef = useRef(-1);              // Version tracking
```

## 🐛 Debugging

Logs automáticos no console:
```
🎯 Excalidraw API montada
📂 Carregando drawing no canvas: Meu Desenho
✅ Drawing carregado, auto-save habilitado
🎨 Canvas mudou: { elementCount: 5, lastSaved: 3 }
💾 Salvando drawing...
✅ Drawing salvo com sucesso
```

## 🔮 Próximos Passos

1. **Collaboration Real-time** - adicionar WebSocket para sync multi-usuário
2. **Conflict Resolution** - reconciliar mudanças simultâneas
3. **History/Undo** - sistema de histórico persistente
4. **AI Tools Integration** - widgets AI no canvas

## 📚 Referências

- [Excalidraw Docs](https://docs.excalidraw.com)
- [Guia Completo de Manipulação](./docs/excalidraw-guide.md)
- [Zustand Docs](https://docs.pmnd.rs/zustand)

---

**Última Atualização:** Outubro 2025  
**Versão:** 1.0.0 - Simplificada  
**Status:** ✅ Estável e Pronta para Produção

