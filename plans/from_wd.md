# Guia Completo de Integração com Excalidraw

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Instalação e Setup](#instalação-e-setup)
3. [Arquitetura da Integração](#arquitetura-da-integração)
4. [API Imperativa](#api-imperativa)
5. [Tipagens e Tipos](#tipagens-e-tipos)
6. [Gotchas e Armadilhas](#gotchas-e-armadilhas)
7. [Sistema de Storage](#sistema-de-storage)
8. [Colaboração em Tempo Real](#colaboração-em-tempo-real)
9. [Embeds e Elementos Customizados](#embeds-e-elementos-customizados)
10. [Hooks Customizados](#hooks-customizados)
11. [Reconciliação de Estado](#reconciliação-de-estado)
12. [Boas Práticas](#boas-práticas)

---

## 🎯 Visão Geral

O Webdraw utiliza o Excalidraw como biblioteca core para desenho, extendendo-o com funcionalidades customizadas:

- **Versão:** `@excalidraw/excalidraw@^0.17.6`
- **Arquitetura:** React + TypeScript com Remix
- **Padrões:** Store centralizado, API Imperativa, Sistema de reconciliação

### Principais Características

- ✅ Persistência automática no filesystem
- ✅ Colaboração em tempo real via WebSockets
- ✅ Sistema de embeds extensível
- ✅ Biblioteca de componentes reutilizáveis
- ✅ Reconciliação inteligente de conflitos
- ✅ Integração com AI para geração de elementos

---

## 📦 Instalação e Setup

### Dependências Principais

```json
{
  "@excalidraw/excalidraw": "^0.17.6",
  "@excalidraw/random-username": "^1.2.0"
}
```

### Importações Essenciais

```typescript
// Componente principal
import { Excalidraw } from "@excalidraw/excalidraw";

// Tipos core
import type {
  ExcalidrawElement,
  ExcalidrawEmbeddableElement,
  NonDeletedExcalidrawElement
} from "@excalidraw/excalidraw/types/element/types.ts";

import type {
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
  ExcalidrawProps,
  AppState,
  BinaryFiles
} from "@excalidraw/excalidraw/types/types.ts";

// Utilitários
import {
  convertToExcalidrawElements,
  restoreElements,
  mutateElement,
  getCommonBounds,
  viewportCoordsToSceneCoords,
  sceneCoordsToViewportCoords,
  elementsOverlappingBBox,
  getSceneVersion,
  serializeAsJSON
} from "@excalidraw/excalidraw";
```

---

## 🏗️ Arquitetura da Integração

### Estrutura de Componentes

```
Editor.client.tsx (Root Component)
├── Excalidraw (Core Component)
│   ├── initialData: ExcalidrawInitialDataState
│   ├── excalidrawAPI: (api) => void
│   ├── renderEmbeddable: (element) => ReactNode
│   ├── validateEmbeddable: (link) => boolean
│   └── theme: "light" | "dark"
├── Store Provider (Estado Global)
│   ├── api: ExcalidrawImperativeAPI
│   ├── elements: readonly ExcalidrawElement[]
│   ├── selected: Set<string>
│   ├── library: Library
│   └── viewport tracking
└── Effects System
    ├── usePersistOnStorageEffect()
    ├── useAnnotationsEffect()
    ├── useEmbedEffect()
    └── useCollab()
```

### Store Centralizado

```typescript
// apps/webdraw/app/sdk/stores/editor/store.client.tsx
export interface State {
  /** Excalidraw Imperative API */
  api?: ExcalidrawImperativeAPI;
  
  /** All scene elements */
  elements?: readonly ExcalidrawElement[];
  
  /** Selected element ids including bounded elements */
  selected?: Set<string>;
  
  /** Element ids fully or partially overlapping viewport */
  overlappingViewport?: Set<string>;
  
  /** Library */
  library?: Library;
  
  /** True when we have fully restored excalidraw's appState */
  isRestored: boolean;
  
  /** Name of the drawing file to be used on this scene */
  drawing: string;
}
```

---

## 🎮 API Imperativa

### Obtendo a API

```typescript
// Via callback do componente
<Excalidraw
  excalidrawAPI={(api) => {
    // API está pronta para uso
    editor.dispatch({ type: "set-api", payload: api });
  }}
/>

// Via hook customizado
const editor = useEditor();
const api = editor.state.api; // ExcalidrawImperativeAPI | undefined
```

### Métodos Principais

#### 1. Manipulação de Elementos

```typescript
// Obter elementos
const elements = api.getSceneElements(); // Sem deletados
const allElements = api.getSceneElementsIncludingDeleted(); // Com deletados

// Atualizar cena
api.updateScene({
  elements: [...elements, newElement],
  appState: {
    selectedElementIds: { [newElement.id]: true }
  }
});

// Scroll para conteúdo
api.scrollToContent(element, {
  animate: true,
  fitToViewport: false
});
```

#### 2. App State

```typescript
// Obter estado da aplicação
const appState = api.getAppState();

// Propriedades importantes:
interface AppState {
  selectedElementIds: Record<string, boolean>;
  zoom: { value: number };
  offsetLeft: number;
  offsetTop: number;
  width: number;
  height: number;
  zenModeEnabled: boolean;
  activeTool: ActiveTool;
  activeEmbeddable?: {
    element: ExcalidrawEmbeddableElement;
    state: "hover" | "active";
  };
}
```

#### 3. Arquivos Binários

```typescript
// Obter arquivos
const files = api.getFiles(); // BinaryFiles

// Adicionar arquivos
api.addFiles(newFiles);

// Reconciliar arquivos
const newOrUpdatedFiles = reconcileFiles(localFiles, remoteFiles);
api.addFiles(newOrUpdatedFiles);
```

#### 4. Listeners

```typescript
// Ouvir mudanças
const unsubscribe = api.onChange((elements, appState, files) => {
  // Reage a qualquer mudança na cena
  console.log('Scene updated', { elements, appState, files });
});

// Limpar listener
unsubscribe();
```

---

## 📝 Tipagens e Tipos

### Tipos Core de Elementos

```typescript
// Elemento base
interface ExcalidrawElement {
  id: string;
  type: "rectangle" | "diamond" | "ellipse" | "arrow" | 
        "line" | "text" | "embeddable" | "frame" | "image";
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: "solid" | "hachure" | "cross-hatch";
  strokeWidth: number;
  strokeStyle: "solid" | "dashed" | "dotted";
  roughness: number;
  opacity: number;
  groupIds: string[];
  frameId: string | null;
  roundness: { type: number } | null;
  seed: number;
  version: number;
  versionNonce: number;
  isDeleted: boolean;
  boundElements: { id: string; type: string }[] | null;
  updated: number;
  link: string | null;
  locked: boolean;
  customData?: Record<string, unknown>; // ⚠️ IMPORTANTE!
}

// Elemento de texto
interface ExcalidrawTextElement extends ExcalidrawElement {
  type: "text";
  text: string;
  fontSize: number;
  fontFamily: number;
  textAlign: string;
  verticalAlign: string;
  containerId: string | null;
  originalText: string;
  lineHeight: number;
}

// Elemento embeddable
interface ExcalidrawEmbeddableElement extends ExcalidrawElement {
  type: "embeddable";
  link: string;
  validated: boolean;
}
```

### Custom Data Schema

O Webdraw extende elementos via `customData`:

```typescript
interface WebdrawCustomData {
  // Tags de funcionalidade
  isAnnotation?: boolean;        // Marca anotações
  isActionSlot?: boolean;        // Slots de ação
  isSuggestion?: boolean;        // Sugestões da IA
  
  // Biblioteca e prompts
  promptId?: string;             // ID do prompt na biblioteca
  widgetId?: string;             // Legacy - mantido para compatibilidade
  isLibraryFrame?: boolean;      // Frame de biblioteca
  
  // Embeds
  focusedEmbed?: string;         // Nome do embed focado
  frame?: string;                // URL do frame
  fileVersion?: string;          // Versão do arquivo
}

// Uso:
const annotatedElement: ExcalidrawElement = {
  ...element,
  customData: {
    isAnnotation: true,
    promptId: "my-prompt-id"
  }
};
```

### Skeleton vs Element

```typescript
// Skeleton - para criar elementos
type ExcalidrawElementSkeleton = Partial<ExcalidrawElement> & {
  type: ExcalidrawElement["type"];
};

// Converter skeleton para elemento completo
const [element] = restoreElements([skeleton], null, {
  repairBindings: false,
  refreshDimensions: false
});
```

---

## ⚠️ Gotchas e Armadilhas

### 1. **API Assíncrona no Callback**

```typescript
// ❌ ERRADO - API pode estar undefined
const api = useEditor().state.api;
api.updateScene({ elements: [] }); // Crash!

// ✅ CORRETO
const api = useEditor().state.api;
if (!api) return;
api.updateScene({ elements: [] });
```

### 2. **Elementos Deletados vs Não Deletados**

```typescript
// ⚠️ GOTCHA: getSceneElements() NÃO inclui deletados
const elements = api.getSceneElements(); // Sem isDeleted: true

// Use getSceneElementsIncludingDeleted() para versionamento
const allElements = api.getSceneElementsIncludingDeleted(); // Com deletados

// IMPORTANTE: Colaboração em tempo real não propaga deletados!
const actualElements = realtimeCollaboration 
  ? api.getSceneElements()
  : api.getSceneElementsIncludingDeleted();
```

### 3. **Scene Version e Reconciliação**

```typescript
// ⚠️ CRÍTICO: Sempre verifique a versão antes de atualizar
const currentVersion = getSceneVersion(elements);

if (currentVersion <= lastSavedVersion) {
  return; // Evita loop infinito!
}

lastSavedVersion = currentVersion;
// Agora é seguro salvar
```

### 4. **BoundElements e Seleção**

```typescript
// ⚠️ GOTCHA: Elementos selecionados não incluem bounded elements automaticamente
const selectedIds = Object.keys(appState.selectedElementIds);

// Você precisa buscar manualmente os elementos bounded:
export const getElementsOnSelection = (
  elements: readonly ExcalidrawElement[],
  selectedElementIds: string[]
): ExcalidrawElement[] => {
  const elementsById = Object.fromEntries(
    elements.map(element => [element.id, element])
  );
  
  const selected: ExcalidrawElement[] = [];
  
  for (const id of selectedElementIds) {
    const element = elementsById[id];
    if (!element) continue;
    
    selected.push(element);
    
    // Adicionar bounded elements (ex: texto dentro de retângulo)
    if (element.boundElements) {
      for (const boundElement of element.boundElements) {
        const be = elementsById[boundElement.id];
        if (boundElement.type === "text" && be) {
          selected.push(be);
        }
      }
    }
  }
  
  return selected;
};
```

### 5. **Viewport Coordinates vs Scene Coordinates**

```typescript
// ⚠️ GOTCHA: Coordenadas do viewport ≠ coordenadas da cena

// Converter viewport -> scene
const sceneCoords = viewportCoordsToSceneCoords(
  { clientX: 100, clientY: 200 },
  appState
);

// Converter scene -> viewport
const viewportCoords = sceneCoordsToViewportCoords(
  { sceneX: element.x, sceneY: element.y },
  appState
);

// Considerar offset e zoom:
const actualX = viewportCoords.x - appState.offsetLeft;
const actualY = viewportCoords.y - appState.offsetTop;
```

### 6. **Criar Elementos com restoreElements**

```typescript
// ❌ ERRADO - IDs e bindings quebrados
const elements = [skeleton1, skeleton2];
api.updateScene({ elements: [...oldElements, ...elements] });

// ✅ CORRETO - Usar restoreElements
const restoredElements = restoreElements(
  [skeleton1, skeleton2],
  oldElements,
  {
    repairBindings: true,      // Reconstrói bindings
    refreshDimensions: true     // Recalcula dimensões de texto
  }
);

api.updateScene({ 
  elements: [...oldElements, ...restoredElements] 
});
```

### 7. **convertToExcalidrawElements Não Regenera IDs**

```typescript
// ⚠️ GOTCHA: Por padrão, mantém os IDs originais!
const elements = convertToExcalidrawElements([skeleton]);
// element.id === skeleton.id (se fornecido)

// Para regenerar IDs:
const elements = convertToExcalidrawElements(
  [skeleton], 
  { regenerateIds: true }  // ⚡ Importante!
);
```

### 8. **mutateElement é Imutável**

```typescript
// ⚠️ GOTCHA: mutateElement não muta! Retorna novo elemento
const element = sceneElements[0];

// ❌ ERRADO
mutateElement(element, { x: 100 });
// element.x ainda é o valor antigo!

// ✅ CORRETO
const updatedElement = mutateElement(element, { x: 100 }, true);
// updatedElement.x === 100
```

### 9. **backgroundColor Vazia Causa Erros**

```typescript
// ⚠️ GOTCHA: backgroundColor com menos de 4 caracteres quebra
const element = {
  ...skeleton,
  backgroundColor: "red"  // ❌ Vai crashar!
};

// ✅ CORRETO
const element = {
  ...skeleton,
  backgroundColor: element.backgroundColor?.length >= 4 
    ? element.backgroundColor 
    : "transparent"
};
```

### 10. **ZenMode Toggle Automático**

```typescript
// ⚠️ GOTCHA: Selecionar embeddable ativa zenMode automaticamente
api.onChange((elements, appState) => {
  const selectedElements = getElementsOnSelection(
    elements,
    Object.keys(appState.selectedElementIds)
  );
  
  const hasEmbeddable = selectedElements.some(
    element => element.type === "embeddable"
  );
  
  // Ativa/desativa zenMode automaticamente
  if (hasEmbeddable && !appState.zenModeEnabled) {
    api.updateScene({
      appState: { ...appState, zenModeEnabled: true }
    });
  }
});
```

### 11. **ループ de onChange**

```typescript
// ❌ ERRADO - Loop infinito!
api.onChange((elements) => {
  api.updateScene({ elements }); // Dispara onChange novamente!
});

// ✅ CORRETO - Guard condition
let isUpdating = false;

api.onChange((elements) => {
  if (isUpdating) return;
  
  isUpdating = true;
  api.updateScene({ elements: modifiedElements });
  isUpdating = false;
});
```

### 12. **CustomData Não Persiste Automaticamente**

```typescript
// ⚠️ GOTCHA: customData deve ser explicitamente copiado
const newElement = {
  ...oldElement,
  x: newX,
  y: newY,
  // customData é perdido se não copiar!
  customData: { ...oldElement.customData, newProp: value }
};
```

---

## 💾 Sistema de Storage

### SceneHandler - Sincronização Bidirecional

```typescript
// apps/webdraw/app/sdk/sceneHandler.ts
export class SceneHandler implements Disposable {
  private lastSceneVersion: number = -1;
  private unwatchFSCb?: () => void;
  
  constructor(options: SceneHandlerOptions) {
    this.setupWatchFS();
    this.writeScene = debounce(this._writeScene, 300);
  }
  
  // Previne loop: stop watchFS -> writeFile -> start watchFS
  private _writeScene = async (elements, appState, files) => {
    const sceneVersion = getSceneVersion(elements);
    
    // ⚠️ Previne escrever versão antiga
    if (sceneVersion <= this.lastSceneVersion) return;
    
    this.lastSceneVersion = sceneVersion;
    
    await this.fs.writeFile(
      this.drawingPath,
      serializeAsJSON(elements, appState, files, "local")
    );
  };
  
  private updateScene = async () => {
    const saved = JSON.parse(await this.fs.readFile(this.drawingPath));
    
    const actualElements = this.realtimeCollaboration
      ? this.excalidraw!.getSceneElements()
      : this.excalidraw!.getSceneElementsIncludingDeleted();
      
    const reconciledElements = reconcile(actualElements, saved.elements ?? []);
    const reconciledVersion = getSceneVersion(reconciledElements);
    
    // ⚠️ Previne atualizar com versão antiga
    if (reconciledVersion === this.lastSceneVersion) return;
    
    this.lastSceneVersion = reconciledVersion;
    this.excalidraw.updateScene({ elements: reconciledElements });
  };
}
```

### Persistência Automática

```typescript
// apps/webdraw/app/sdk/storage.ts
export const usePersistOnStorageEffect = () => {
  const { state: { api, library, drawing, isRestored } } = useEditor();
  const { fs, cwd } = useStorage();
  
  // Salva biblioteca
  useEffect(() => {
    if (!isRestored || !library || !fs) return;
    
    fs.writeFile(
      Path.files.library(),
      JSON.stringify(library, null, 2)
    );
  }, [library, isRestored, fs]);
  
  // Salva cena
  useEffect(() => {
    if (!isRestored || !api || !fs) return;
    
    const sceneHandler = new SceneHandler({
      excalidraw: api,
      drawingPath: Path.files.drawings.fromName(drawing),
      fs,
      cwd,
      realtimeCollaboration
    });
    
    const unsubscribe = api.onChange(sceneHandler.writeScene);
    
    return () => {
      sceneHandler[Symbol.dispose]();
      unsubscribe();
    };
  }, [api, fs, drawing, isRestored]);
};
```

---

## 🤝 Colaboração em Tempo Real

### Setup com Actors

```typescript
// apps/webdraw/app/sdk/collab.ts
export function useCollab({
  excalidraw,
  drawingPath,
  user,
  realtimeCollaboration
}: CollabOptions) {
  const others = useRef<Map<string, Collaborator>>(new Map());
  const collabChan = useRef<DuplexChannel | null>(null);
  
  useEffect(() => {
    if (!excalidraw || !realtimeCollaboration) return;
    
    const collab = webdrawCollab.new(drawingPath);
    const ch = collab.join({ id: user.id, username: user.email });
    
    // Sincronização inicial
    const events = ch.recv();
    const initialSync = await events.next();
    
    if (initialSync.value.type === "collaborators-synced") {
      others.current = new Map(Object.entries(initialSync.value.payload));
      
      excalidraw.updateScene({
        elements: excalidraw.getSceneElementsIncludingDeleted(),
        collaborators: others.current
      });
    }
    
    // Eventos de colaboradores
    for await (const event of events) {
      if (event.type === "collaborator-updated") {
        others.current.set(event.payload.id, event.payload);
        throttledUpdate();
      }
      
      if (event.type === "collaborator-left") {
        others.current.delete(event.payload);
        throttledUpdate();
      }
    }
    
    return () => ch.close();
  }, [excalidraw, drawingPath]);
  
  // Atualiza ponteiro
  const onPointerUpdate: ExcalidrawProps["onPointerUpdate"] = 
    throttle(async (payload) => {
      if (others.current.size === 0) return;
      
      await collabChan.current?.send({
        id: user.id,
        pointer: payload.pointer,
        button: payload.button,
        selectedElementIds: excalidraw?.getAppState().selectedElementIds,
        username: user.email
      });
    }, 80);
  
  return { onPointerUpdate };
}
```

### ⚠️ Gotcha: Elementos Deletados em Realtime

```typescript
// IMPORTANTE: Colaboração realtime não propaga isDeleted!
const actualElements = realtimeCollaboration
  ? api.getSceneElements()              // Sem deletados
  : api.getSceneElementsIncludingDeleted(); // Com deletados
```

---

## 🧩 Embeds e Elementos Customizados

### Registro de Embeds

```typescript
// apps/webdraw/app/sdk/embedded.ts
export type Embed = {
  name: string;
  icon: AvailableIcons;
  Component: ComponentType<EmbedProps>;
  accepts?: (link: string) => boolean;
  explain: (link: string) => string;
};

const EMBED_REGISTRY: Embed[] = [];

export const register = (embed: Embed) => {
  const found = EMBED_REGISTRY.find(w => w.name === embed.name);
  
  if (!found) {
    EMBED_REGISTRY.push({
      ...embed,
      Component: memo(embed.Component)
    });
  }
};
```

### Criar Embed

```typescript
export const createEmbed = (
  { width, height, ...skeleton }: Partial<ExcalidrawEmbeddableElement>
) => {
  const embed: ExcalidrawElementSkeleton = {
    type: "embeddable",
    link: null,
    validated: true,
    width: width ?? 640,
    height: height ?? 360,
    x: 0,
    y: 0,
    backgroundColor: "transparent",
    strokeColor: "transparent",
    strokeWidth: 0,
    ...skeleton
  };
  
  const [element] = restoreElements([embed], null, {
    repairBindings: false,
    refreshDimensions: false
  });
  
  return element;
};
```

### Render Customizado

```typescript
// apps/webdraw/app/components/Editor.client.tsx
const renderEmbeddable = (element: ExcalidrawEmbeddableElement) => (
  <RenderEmbeddable element={element} />
);

function RenderEmbeddable({ element }: { element: ExcalidrawEmbeddableElement }) {
  const inViewport = useIsOverlappingViewport(element);
  const [display, setDisplay] = useState(false);
  
  // Lazy load: só renderiza quando no viewport
  useEffect(() => {
    if (inViewport) setDisplay(true);
  }, [inViewport]);
  
  if (!display) return null;
  
  const focused = getFocusedEmbed(element);
  
  return (
    <RenderEmbed
      name={focused}
      link={element.link}
      id={element.id}
      version={element.customData?.fileVersion}
    />
  );
}

<Excalidraw
  renderEmbeddable={renderEmbeddable}
  validateEmbeddable={() => true}  // Aceita todos os embeds
/>
```

### Focar Embed

```typescript
// Adiciona metadado de embed focado
export const focusEmbed = (element: ExcalidrawElement, name: string) =>
  mutateElement(
    element,
    {
      ...element,
      customData: { ...element.customData, focusedEmbed: name }
    },
    true
  );
```

---

## 🪝 Hooks Customizados

### useOnChangeEffect

```typescript
export const useOnChangeEffect = (
  cb: (elements, appState, files) => void | (() => void),
  deps: DependencyList = []
) => {
  const sdk = useEditor();
  
  useEffect(() => {
    const appState = sdk.state.api?.getAppState();
    const elements = sdk.state.api?.getSceneElements();
    const files = sdk.state.api?.getFiles();
    
    let clear = appState && elements && files
      ? cb(elements, appState, files)
      : undefined;
    
    const unsub = sdk.state.api?.onChange((elements, appState, files) => {
      clear?.();
      clear = cb(elements, appState, files);
    });
    
    return () => {
      clear?.();
      unsub?.();
    };
  }, [sdk.state.api, ...deps]);
};
```

### useElementBounds

```typescript
export const useElementBounds = (
  element: ExcalidrawElement | null
): DetailedBounds | null => {
  const [bounds, setBounds] = useState<DetailedBounds | null>(null);
  const draw = useApi();
  
  useEffect(() => {
    if (!element || !draw) {
      setBounds(null);
      return;
    }
    
    const updateBounds = () => {
      const appState = draw.getAppState();
      const [sceneX1, sceneY1, sceneX2, sceneY2] = getCommonBounds([element]);
      
      const topLeft = sceneCoordsToViewportCoords(
        { sceneX: sceneX1, sceneY: sceneY1 },
        appState
      );
      
      const bottomRight = sceneCoordsToViewportCoords(
        { sceneX: sceneX2, sceneY: sceneY2 },
        appState
      );
      
      setBounds({
        x: topLeft.x - appState.offsetLeft,
        y: topLeft.y - appState.offsetTop,
        width: bottomRight.x - topLeft.x,
        height: bottomRight.y - topLeft.y,
        scale: appState.zoom.value,
        w0: sceneX2 - sceneX1,
        h0: sceneY2 - sceneY1
      });
    };
    
    updateBounds();
    const unsubscribe = draw.onChange(updateBounds);
    
    return unsubscribe;
  }, [element, draw]);
  
  return bounds;
};
```

### useViewportElements

```typescript
export const useViewportElements = () => {
  const { state: { containedInViewport } } = useEditor();
  return useMemo(
    () => containedInViewport || new Set<string>(),
    [containedInViewport]
  );
};
```

---

## ⚖️ Reconciliação de Estado

### Algoritmo de Reconciliação

```typescript
// apps/webdraw/app/sdk/reconcile.ts
export const reconcile = (
  local: readonly ExcalidrawElement[] | Record<string, ExcalidrawElement>,
  remote: readonly ExcalidrawElement[] | Record<string, ExcalidrawElement>
): ExcalidrawElement[] => {
  const _local = isArray(local) ? indexed(local) : local;
  const _remote = isArray(remote) ? indexed(remote) : remote;
  
  const result: Record<string, ExcalidrawElement> = { ..._local };
  
  // Iterar elementos remotos
  for (const id in _remote) {
    const remoteEl = _remote[id];
    const localEl = _local[id];
    
    // Caso 1: Elemento remoto é mais novo ou não existe localmente
    if (!localEl || remoteEl.updated > localEl.updated) {
      if (!remoteEl.isDeleted) {
        result[id] = remoteEl;  // Adicionar/atualizar
      } else {
        delete result[id];       // Remover se deletado
      }
    }
    // Caso 2: Elemento local é mais recente ou igual
    else if (localEl.updated >= remoteEl.updated) {
      if (localEl.isDeleted) {
        result[id] = localEl;    // Manter deletado local
      }
    }
  }
  
  // Remover elementos deletados localmente que não existem remotamente
  for (const id in _local) {
    if (!_remote[id] && _local[id].isDeleted) {
      delete result[id];
    }
  }
  
  return Object.values(result);
};
```

### Reconciliação de Arquivos

```typescript
export const reconcileFiles = (
  local: BinaryFiles,
  remote: BinaryFiles
): BinaryFileData[] => {
  const newOrUpdatedFiles: Record<string, BinaryFileData> = {};
  
  // Adicionar apenas arquivos novos ou atualizados
  Object.entries(remote).forEach(([id, file]) => {
    if (
      !local[id] ||
      local[id].mimeType !== file.mimeType ||
      local[id].created !== file.created
    ) {
      newOrUpdatedFiles[id] = file;
    }
  });
  
  return Object.values(newOrUpdatedFiles);
};
```

---

## 🎨 Boas Práticas

### 1. Sempre Verificar API

```typescript
const api = useEditor().state.api;
if (!api) return; // Guard clause
```

### 2. Usar Skeleton + restoreElements

```typescript
const skeleton: ExcalidrawElementSkeleton = {
  type: "rectangle",
  x: 100,
  y: 100,
  width: 200,
  height: 100
};

const [element] = restoreElements([skeleton], existingElements, {
  repairBindings: true,
  refreshDimensions: true
});
```

### 3. Custom Data Tipado

```typescript
interface MyCustomData {
  myProp: string;
}

const element: ExcalidrawElement = {
  ...baseElement,
  customData: { myProp: "value" } as MyCustomData
};

// Type-safe access
const customData = element.customData as MyCustomData | undefined;
```

### 4. Debounce para Persistência

```typescript
// Sempre fazer debounce de operações de escrita
const writeScene = debounce((elements, appState, files) => {
  fs.writeFile(path, serializeAsJSON(elements, appState, files));
}, 300);
```

### 5. Validação de Elementos

```typescript
const REQUIRED_PROPS = ["x", "y", "width", "height", "type"];

export const isValidElement = (element: ExcalidrawElementSkeleton) => {
  return REQUIRED_PROPS.every(prop => prop in element);
};
```

### 6. Transform Coordinates Helper

```typescript
export const calculatePosition = ({
  position,
  elements,
  appEmbeddable,
  padding = 50
}: PositionCalculationParams) => {
  const maxWidth = Math.max(...elements.map(el => el.x + el.width)) -
    Math.min(...elements.map(el => el.x));
  
  switch (position) {
    case "bottom":
      return {
        x: appEmbeddable.x + (appEmbeddable.width - maxWidth) / 2,
        y: appEmbeddable.y + appEmbeddable.height + padding
      };
    // ... outros casos
  }
};
```

### 7. Error Boundaries para Embeds

```typescript
function RenderEmbeddable({ element }: Props) {
  try {
    const focused = getFocusedEmbed(element);
    return <RenderEmbed name={focused} link={element.link} />;
  } catch (error) {
    console.error("Error rendering embed:", error);
    return null; // Falha silenciosa
  }
}
```

### 8. Lazy Loading de Embeds

```typescript
function RenderEmbeddable({ element }: Props) {
  const inViewport = useIsOverlappingViewport(element);
  const [display, setDisplay] = useState(false);
  
  useEffect(() => {
    if (inViewport) {
      setDisplay(true);
    }
  }, [inViewport]);
  
  if (!display) return null;
  
  return <RenderEmbed {...props} />;
}
```

### 9. CSS Override para Customização

```css
/* apps/webdraw/app/themes/excalidraw.css */
.deco .excalidraw {
  /* Esconder botão de menu */
  .dropdown-menu-button.main-menu-trigger {
    display: none;
  }
  
  /* Customizar sidebar */
  .Island.App-menu__left {
    @apply top-1/2 -translate-y-1/2 h-5/6 left-[52px] w-52 rounded-lg;
  }
}
```

### 10. Usar Library para Componentes Reutilizáveis

```typescript
const { upsert, thumb, details } = useLibrary();

// Salvar na biblioteca
upsert({
  id: "my-component",
  detail: elements,
  thumb: thumbnailElements,
  label: "My Component",
  shortcut: {
    keys: ["Ctrl", "K"],
    callback: () => addToCanvas()
  }
});

// Usar da biblioteca
const elementsToDraw = thumb("my-component");
if (elementsToDraw) {
  api.updateScene({
    elements: [...api.getSceneElements(), ...elementsToDraw]
  });
}
```

---

## 📚 Referências

### Documentação Oficial
- [Excalidraw Docs](https://docs.excalidraw.com/)
- [Excalidraw GitHub](https://github.com/excalidraw/excalidraw)

### Arquivos Chave no Webdraw
- `apps/webdraw/app/components/Editor.client.tsx` - Componente principal
- `apps/webdraw/app/sdk/stores/editor/store.client.tsx` - Store global
- `apps/webdraw/app/sdk/stores/editor/hooks.tsx` - Hooks customizados
- `apps/webdraw/app/sdk/sceneHandler.ts` - Persistência e sincronização
- `apps/webdraw/app/sdk/reconcile.ts` - Reconciliação de estado
- `apps/webdraw/app/sdk/embedded.ts` - Sistema de embeds
- `apps/webdraw/app/sdk/collab.ts` - Colaboração em tempo real
- `apps/webdraw/app/sdk/utils.ts` - Utilitários

### Tipos Importantes
```
@excalidraw/excalidraw/types/element/types.ts
@excalidraw/excalidraw/types/types.ts
@excalidraw/excalidraw/types/data/transform.ts
```

---

## 🎓 Resumo Executivo

### Para Começar Rapidamente

1. **Setup Básico**
   ```typescript
   import { Excalidraw } from "@excalidraw/excalidraw";
   
   <Excalidraw
     excalidrawAPI={(api) => setApi(api)}
     initialData={initialData}
   />
   ```

2. **Obter/Atualizar Elementos**
   ```typescript
   const elements = api.getSceneElements();
   api.updateScene({ elements: [...elements, newElement] });
   ```

3. **Ouvir Mudanças**
   ```typescript
   api.onChange((elements, appState, files) => {
     console.log("Updated!", elements);
   });
   ```

### Gotchas Mais Críticos

1. ⚠️ API pode ser `undefined` - sempre verificar
2. ⚠️ `getSceneElements()` não inclui deletados
3. ⚠️ Verificar `sceneVersion` para evitar loops
4. ⚠️ Usar `restoreElements` para criar elementos corretamente
5. ⚠️ `backgroundColor` precisa ter pelo menos 4 caracteres
6. ⚠️ `customData` não persiste automaticamente
7. ⚠️ Colaboração realtime não propaga elementos deletados

### Padrões Essenciais

- ✅ Usar `restoreElements` ao criar elementos
- ✅ Debounce de operações de escrita
- ✅ Guard clauses para API
- ✅ Reconciliação baseada em `updated` timestamp
- ✅ Lazy loading de embeds
- ✅ Type-safe `customData`

---

**Última Atualização:** Outubro 2025  
**Versão do Excalidraw:** 0.17.6  
**Autor:** Webdraw Team
