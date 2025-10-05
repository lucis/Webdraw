# Plano de Integração Frontend - Webdraw

## 🎯 Objetivo

Transformar o Webdraw em uma aplicação completa de desenho com:
- Sistema de folders (igual Excalidraw pago)
- Autenticação integrada
- Roteamento inteligente (/ → app se logado, /about se não logado)
- Left sidebar com folders e drawings
- Canvas do Excalidraw integrado

---

## 📐 Estrutura de Rotas

```
/                    → App principal (logado) ou /about (público)
/about              → Landing page pública
/canvas             → App de desenho (DEPRECADO, mover para /)
/debug-tools        → Debug tools (manter)
```

---

## 🗂️ Estrutura de Arquivos a Criar/Modificar

```
view/src/
├── routes/
│   ├── home.tsx              # ✏️ MODIFICAR: Redirecionar baseado em auth
│   ├── about.tsx             # 🆕 CRIAR: Landing page pública
│   ├── app.tsx               # 🆕 CRIAR: App principal de desenho
│   └── canvas.tsx            # ❌ DEPRECAR: Mover lógica para app.tsx
├── components/
│   ├── canvas/
│   │   ├── ExcalidrawCanvas.tsx   # ✏️ MODIFICAR: Integrar com store
│   │   └── LeftSidebar.tsx        # 🆕 CRIAR: Sidebar com folders
│   ├── folders/
│   │   ├── FolderList.tsx         # 🆕 CRIAR: Lista de folders
│   │   ├── FolderItem.tsx         # 🆕 CRIAR: Item de folder
│   │   └── FolderEditor.tsx       # 🆕 CRIAR: Editar folder
│   └── drawings/
│       ├── DrawingList.tsx        # 🆕 CRIAR: Lista de drawings
│       └── DrawingItem.tsx        # 🆕 CRIAR: Item de drawing
├── stores/
│   └── drawing-store.ts           # 🆕 CRIAR: Zustand store completo
├── hooks/
│   ├── useDrawings.ts             # 🆕 CRIAR: Hooks de drawings
│   └── useFolders.ts              # 🆕 CRIAR: Hooks de folders
└── lib/
    └── rpc.ts                      # ✅ JÁ EXISTE

```

---

## 🔄 Fluxo de Navegação

### Usuário NÃO logado:
```
Acessa / → Verifica auth → Redireciona para /about
```

### Usuário logado:
```
Acessa / → Verifica auth → Carrega app de desenho
Acessa /about → Pode ver landing, mas com link para app
```

---

## 🎨 Layout do App Principal (/)

```
┌─────────────────────────────────────────────────────────────┐
│ Header: Logo | Branch Selector | User Button                │
├────────────┬────────────────────────────────────────────────┤
│            │                                                 │
│  Folders   │                                                 │
│  ────────  │                                                 │
│  📁 Default│            Excalidraw Canvas                   │
│  🚀 Project│                                                 │
│  🎨 Design │                                                 │
│            │                                                 │
│  Drawings  │                                                 │
│  (folder)  │                                                 │
│  ────────  │                                                 │
│  Drawing 1 │                                                 │
│  Drawing 2 │                                                 │
│  + New     │                                                 │
│            │                                                 │
│            │                                                 │
│  [Collapse]│                                                 │
└────────────┴─────────────────────────────────────────────────┘
```

---

## 📝 Passo a Passo de Implementação

### FASE 1: Criar Store Zustand ✅
**Arquivo:** `view/src/stores/drawing-store.ts`

Estado global:
- Folders (lista)
- Drawings (lista do folder atual)
- Current folder
- Current drawing
- Branch atual
- Sync status

Actions:
- Folder CRUD
- Drawing CRUD
- Switch folder
- Switch branch

---

### FASE 2: Criar Hooks ✅
**Arquivos:** `view/src/hooks/useFolders.ts` e `useDrawings.ts`

Wrappear chamadas RPC com TanStack Query:
- `useFolders()` - Lista folders
- `useCreateFolder()` - Criar folder
- `useUpdateFolder()` - Atualizar folder
- `useDeleteFolder()` - Deletar folder
- `useDrawings(folderId)` - Lista drawings de um folder
- `useCreateDrawing()` - Criar drawing
- `useUpdateDrawing()` - Atualizar drawing
- `useDeleteDrawing()` - Deletar drawing

---

### FASE 3: Componentes de Folders ✅

#### `FolderList.tsx`
- Mostra lista de folders
- Folder ativo destacado
- Botão "Novo Folder"
- Emoji + nome

#### `FolderItem.tsx`
- Clickável para selecionar
- Menu de contexto (editar/deletar)
- Contador de drawings

#### `FolderEditor.tsx`
- Modal para criar/editar
- Input de nome
- Emoji picker
- Validação

---

### FASE 4: Componentes de Drawings ✅

#### `DrawingList.tsx`
- Mostra drawings do folder atual
- Botão "Novo Drawing"
- Busca/filtro
- Ordenação (data, nome)

#### `DrawingItem.tsx`
- Nome do drawing
- Data de modificação
- Thumbnail (futuro)
- Menu de ações (duplicar, deletar, mover)

---

### FASE 5: Left Sidebar ✅

#### `LeftSidebar.tsx`
Estrutura:
```tsx
<Sidebar>
  <Header>
    <BranchSelector />
    <CollapseButton />
  </Header>
  
  <FolderList>
    {folders.map(folder => (
      <FolderItem folder={folder} />
    ))}
  </FolderList>
  
  <Divider />
  
  <DrawingList>
    {drawings.map(drawing => (
      <DrawingItem drawing={drawing} />
    ))}
  </DrawingList>
</Sidebar>
```

---

### FASE 6: Integrar Excalidraw Canvas ✅

**Modificar:** `ExcalidrawCanvas.tsx`

- Conectar com store Zustand
- Auto-save com debounce (2s)
- Carregar drawing ao selecionar
- Salvar ao modificar
- Indicador de sync status

---

### FASE 7: Criar App Principal ✅

**Criar:** `view/src/routes/app.tsx`

```tsx
function AppPage() {
  const { user } = useUser();
  const { currentDrawing } = useDrawingStore();
  
  if (!user) {
    return <Navigate to="/about" />;
  }
  
  return (
    <div className="h-screen flex flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar />
        <ExcalidrawCanvas />
      </div>
    </div>
  );
}
```

---

### FASE 8: Criar Landing Page ✅

**Criar:** `view/src/routes/about.tsx`

Conteúdo:
- Hero section
- Features (folders, collaboration, etc)
- Screenshots/demo
- CTA: "Start Drawing" → Login
- Footer

---

### FASE 9: Modificar Home ✅

**Modificar:** `view/src/routes/home.tsx`

```tsx
function HomePage() {
  const { user } = useOptionalUser();
  
  if (user.data) {
    // Redirecionar para app
    return <Navigate to="/app" replace />;
  }
  
  // Redirecionar para about
  return <Navigate to="/about" replace />;
}
```

---

### FASE 10: Atualizar Router ✅

**Modificar:** `view/src/main.tsx`

```tsx
const routeTree = rootRoute.addChildren([
  HomePage(rootRoute),          // → Redireciona
  AboutPage(rootRoute),          // → Landing pública
  AppPage(rootRoute),            // → App principal
  DebugToolsPage(rootRoute),     // → Debug
]);
```

---

## 🎨 Componentes UI Necessários (shadcn)

Já temos:
- ✅ Button
- ✅ Popover
- ✅ Collapsible

Adicionar:
```bash
cd view
npx shadcn@latest add dialog
npx shadcn@latest add dropdown-menu
npx shadcn@latest add input
npx shadcn@latest add separator
npx shadcn@latest add scroll-area
npx shadcn@latest add badge
```

---

## 🔐 Autenticação

**Padrão:**
- Use `useOptionalUser()` para verificar login
- Use `<LoggedProvider>` para proteger rotas
- Redirecionar não-logados para `/about`

---

## 📊 Zustand Store - Estrutura Completa

```typescript
interface DrawingStore {
  // State
  folders: Folder[];
  currentFolderId: string | null;
  drawings: DrawingMetadata[];
  currentDrawing: Drawing | null;
  branch: string;
  syncStatus: SyncStatus;
  isLoading: boolean;
  
  // Folder Actions
  loadFolders: () => Promise<void>;
  createFolder: (name: string, emoji: string) => Promise<void>;
  updateFolder: (id: string, name: string, emoji: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  selectFolder: (id: string) => Promise<void>;
  
  // Drawing Actions
  loadDrawings: (folderId: string) => Promise<void>;
  createDrawing: (name: string) => Promise<void>;
  loadDrawing: (id: string) => Promise<void>;
  saveDrawing: (elements, appState, files) => Promise<void>;
  deleteDrawing: (id: string) => Promise<void>;
  duplicateDrawing: (id: string) => Promise<void>;
  moveDrawing: (id: string, targetFolderId: string) => Promise<void>;
  
  // Branch Actions
  switchBranch: (branch: string) => void;
  
  // Auto-save
  scheduleAutoSave: (elements, appState, files) => void;
  forceSave: () => Promise<void>;
}
```

---

## 🚀 Ordem de Implementação

1. ✅ **Zustand Store** - Base do estado global
2. ✅ **Hooks** - Wrappear RPC com TanStack Query
3. ✅ **Componentes de Folders** - FolderList, FolderItem, FolderEditor
4. ✅ **Componentes de Drawings** - DrawingList, DrawingItem
5. ✅ **Left Sidebar** - Container principal
6. ✅ **Integrar Canvas** - Conectar Excalidraw com store
7. ✅ **App Principal** - Rota /app com tudo junto
8. ✅ **Landing Page** - Rota /about
9. ✅ **Home Redirect** - Rota / com lógica
10. ✅ **Polish** - Animações, loading states, empty states

---

## 🎯 Features do Excalidraw Pago a Implementar

✅ **Já Implementado:**
- Folders para organização
- Nome + emoji customizável
- Criar/editar/deletar folders
- Listar drawings por folder
- Folder padrão não deletável

🔜 **Próximas Features:**
- Thumbnails dos drawings
- Busca de drawings
- Tags
- Compartilhamento
- Histórico de versões (usar branches?)
- Templates
- Exportação em batch

---

## 📝 Checklist Final

- [ ] Testar todas as tools via MCP
- [ ] Store Zustand criado e testado
- [ ] Hooks criados com TanStack Query
- [ ] Componentes de folders funcionando
- [ ] Componentes de drawings funcionando
- [ ] Left sidebar montada
- [ ] Canvas integrado com auto-save
- [ ] App principal funcionando
- [ ] Landing page criada
- [ ] Redirecionamento / funcionando
- [ ] Todas as rotas atualizadas
- [ ] UI polida
- [ ] Testado em produção

---

## 🎨 Paleta de Cores (Consistente)

```css
--background: slate-900
--foreground: white
--primary: blue-600
--accent: slate-800
--border: slate-700
--muted: slate-400
```

---

**Próximos passos:** Testar tools → Criar store → Criar componentes → Integrar tudo

