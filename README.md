# Webdraw - Editor de Desenho com IA

Uma aplicação de desenho baseada na biblioteca Excalidraw, com capacidades de IA integradas. Construído com [Deco MCP](https://spec.modelcontextprotocol.io/) para ferramentas de IA e React para a interface.

## 🎨 Recursos

- **Editor Excalidraw Completo**: Interface poderosa de desenho e diagramação
- **Gerenciamento de Desenhos**: Crie, edite, salve e organize múltiplos desenhos
- **Auto-save Inteligente**: Salvamento automático enquanto você desenha (debounce de 2s)
- **Exportação Flexível**: Exporte seus desenhos como PNG, SVG ou JSON
- **Estado Global com Zustand**: Gerenciamento eficiente e type-safe de estado
- **Arquitetura Preparada para IA**: Estrutura pronta para integração com ferramentas de IA

## 📝 Development History

This repository uses [Specstory](https://specstory.com/) to track the history of
prompts that were used to code this repo. You can inspect the complete
development history in the [`.specstory/`](.specstory/) folder.

## 🚀 Começando

### Pré-requisitos

- Node.js ≥22.0.0
- Deno ≥2.0.0
- npm ≥8.0.0

### Instalação

```bash
# Instalar dependências
npm install

# Configurar projeto
npm run configure

# Iniciar desenvolvimento
npm run dev
```

**Acesse `http://localhost:5173/canvas` para começar a desenhar!**

O servidor MCP estará disponível em `http://localhost:8787`.

## 📁 Estrutura do Projeto

```
├── server/                    # MCP Server (Cloudflare Workers)
│   ├── main.ts               # Servidor com tools e workflows
│   ├── tools/                # Tools organizados por domínio
│   └── workflows/            # Workflows (futuro: IA)
├── view/                      # React Frontend
│   ├── src/
│   │   ├── components/
│   │   │   └── canvas/       # Componentes do Excalidraw
│   │   ├── stores/
│   │   │   └── drawing-store.ts  # Estado global (Zustand)
│   │   ├── lib/
│   │   │   ├── storage.ts        # Abstração de persistência
│   │   │   └── excalidraw-state.ts  # Gerenciador do canvas
│   │   ├── hooks/            # React hooks customizados
│   │   ├── routes/           # TanStack Router routes
│   │   └── types/            # TypeScript types
│   └── package.json
└── plans/
    └── excalidraw.md         # 📖 Documentação detalhada
```

## 🎯 Arquitetura

### Camadas de Abstração

```
┌─────────────────────────────────────────────────┐
│         Componentes React (Canvas, UI)          │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│      Zustand Store (Estado Global)              │
│  - drawings[]                                    │
│  - currentDrawing                                │
│  - loading/error states                          │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│        Storage API (Abstração 1:1)              │
│  - createDrawing()                               │
│  - getDrawing()                                  │
│  - updateDrawing()                               │
│  - deleteDrawing()                               │
└──────────────────┬──────────────────────────────┘
                   │
        ┌──────────▼───────────┐
        │   localStorage       │
        │      (hoje)          │
        └──────────────────────┘
                   │
        ┌──────────▼───────────┐
        │   Backend API        │
        │     (futuro)         │
        └──────────────────────┘
```

### Por que esta arquitetura?

1. **Storage API como Abstração**: A interface `DrawingStorage` foi desenhada para ser **1:1 com os tools do servidor**. Quando a API backend estiver pronta, basta trocar a implementação sem modificar nenhum outro código.

2. **Zustand para Estado Global**: Gerencia estado de forma eficiente e type-safe, com DevTools integradas para debugging.

3. **ExcalidrawStateManager**: Encapsula toda a lógica de interação com a API imperativa do Excalidraw (auto-save, exportação, etc).

## 🛠️ Comandos Disponíveis

```bash
# Desenvolvimento
npm run dev          # Inicia frontend + backend com hot reload
npm run gen          # Gera tipos para integrações externas
npm run gen:self     # Gera tipos dos seus próprios tools

# Produção
npm run deploy       # Deploy para Cloudflare Workers

# Utilitários
npm run configure    # Configurar workspace
```

## 📚 Documentação Detalhada

Para informações completas sobre a integração do Excalidraw, arquitetura e roadmap:
- **[Plano de Integração Excalidraw](/plans/excalidraw.md)**

Este documento inclui:
- Fluxo de dados completo
- Padrões de implementação
- Guia de migração para backend
- Roadmap de funcionalidades futuras (IA)

## 🔮 Próximos Passos (Roadmap)

### ✅ Implementado
- [x] Integração Excalidraw
- [x] Gerenciamento de múltiplos desenhos
- [x] Auto-save com debounce
- [x] Storage abstraction (localStorage)
- [x] Estado global com Zustand
- [x] Exportação PNG/SVG/JSON

### 🚧 Em Desenvolvimento
- [ ] API de persistência backend
- [ ] Migração de localStorage para servidor
- [ ] Colaboração em tempo real

### 🔮 Planejado (IA)
- [ ] Geração de desenhos com IA
- [ ] Auto-complete de formas
- [ ] Sugestões de layout
- [ ] Conversão texto → diagrama
- [ ] Análise semântica de desenhos

## 📖 Learn More

This template is built for deploying primarily on top of the
[Deco platform](https://decocms.com) which can be found at the
[deco-cx/chat](https://github.com/deco-cx/chat) repository.

Documentation can be found at [https://docs.deco.page](https://docs.deco.page)

---

**Ready to build your next MCP server with a beautiful frontend?
[Get started now!](https://admin.decocms.com)**
