# Mudanças Propostas: Deconfig Implementation

## 🔍 Análise do Código Atual vs Documentação Oficial

Após revisar a implementação atual de `folders.ts` e `drawings.ts` contra a documentação oficial do Deconfig, identifiquei os seguintes problemas:

---

## ❌ Problemas Encontrados

### 1. **Parâmetro `contentType` não existe na API**

**Código atual:**
```typescript
await env.DECONFIG.PUT_FILE({
  branch: index.branch,
  path: getFoldersIndexPath(),
  content: JSON.stringify(index, null, 2),
  contentType: "application/json",  // ❌ Este parâmetro NÃO existe!
});
```

**Documentação oficial:**
```typescript
await env.DECONFIG.PUT_FILE({
  branch?: string;
  path: string;
  content: string | { base64: string } | number[];
  metadata?: Record<string, any>;      // ✅ Use metadata ao invés de contentType
  expectedCtime?: number;
});
```

**Impacto:** Todas as chamadas `PUT_FILE` estão passando um parâmetro inválido que será ignorado ou pode causar erro.

**Localização:**
- `server/tools/folders.ts`: linhas 96, 180, 248, 314, 456
- `server/tools/drawings.ts`: linhas similares

---

### 2. **Falta de Metadata para rastreamento**

**Problema:** Não estamos usando o campo `metadata` recomendado pela documentação para:
- Rastrear qual app criou o arquivo
- Versão do formato
- Autor/timestamp adicional
- Tags para busca/debug

**Recomendação da doc:**
```typescript
metadata: {
  app: "webdraw",
  version: "1.0.0",
  author: context.userId,
  environment: "production",
  tags: ["config", "critical"],
}
```

**Onde usar:**
- Ao criar folders
- Ao criar drawings
- Ao atualizar índices

---

### 3. **Falta de Conflict Detection em updates**

**Problema:** Não estamos usando `expectedCtime` para prevenir race conditions quando múltiplos processos atualizam o mesmo arquivo.

**Cenário de problema:**
1. Processo A lê folder (ctime: 1000)
2. Processo B lê folder (ctime: 1000)
3. Processo A atualiza folder (ctime: 2000)
4. Processo B atualiza folder (ctime: 3000) ← sobrescreve mudanças de A! 🐛

**Solução recomendada pela doc:**
```typescript
// Ler arquivo atual
const current = await env.DECONFIG.READ_FILE({
  path: "/shared/counter.json",
  format: "plainString",
});

// Atualizar com conflict detection
const result = await env.DECONFIG.PUT_FILE({
  path: "/shared/counter.json",
  content: JSON.stringify(data),
  expectedCtime: current.ctime, // ✅ falha se arquivo mudou
});

if (result.conflict) {
  throw new Error("Arquivo foi modificado por outro processo");
}
```

**Onde aplicar:**
- `UPDATE_FOLDER` tool
- `UPDATE_DRAWING` tool
- `REORDER_FOLDERS` tool
- Qualquer operação de update

---

### 4. **Path structure não segue recomendação**

**Código atual:**
```typescript
PATH_PREFIX: "webdraw/"  // Está OK, mas poderia ser mais explícito
```

**Recomendação da doc:**
```
/apps/<app-name>/           # configs do seu app
  ├── config.json           # config principal
  ├── secrets.json          # secrets (criptografados)
  └── state/                # estado persistente
      └── cache.json
```

**Proposta:**
```typescript
PATH_PREFIX: "/apps/webdraw/"  // Mais explícito e segue padrão
// ou simplesmente:
PATH_PREFIX: "/webdraw/"       // Também OK, apenas adicionar /
```

**Impacto:** Baixo, mas boa prática para consistência.

---

### 5. **Missing format parameter em READ_FILE**

**Código atual:**
```typescript
const result = await env.DECONFIG.READ_FILE({
  branch,
  path: getFoldersIndexPath(),
  // ❌ Falta especificar formato
});
```

**Recomendação da doc:**
```typescript
const result = await env.DECONFIG.READ_FILE({
  branch,
  path: getFoldersIndexPath(),
  format: "plainString",  // ✅ Explícito é melhor
});
```

**Onde aplicar:**
- Todas as chamadas `READ_FILE`

---

### 6. **Error handling pode ser melhorado**

**Código atual:**
```typescript
try {
  const result = await env.DECONFIG.READ_FILE({...});
  return JSON.parse(result.content);
} catch {
  // Retorna vazio
  return {...};
}
```

**Problema:** Não diferenciamos entre "arquivo não existe" e outros erros.

**Recomendação da doc:**
```typescript
try {
  const file = await env.DECONFIG.READ_FILE({...});
  return { content: file.content };
} catch (error) {
  if (error.message.includes("not found")) {
    // Arquivo não existe, criar default
    await env.DECONFIG.PUT_FILE({...});
    return { content: { default: true } };
  }
  throw error; // Re-throw outros erros
}
```

---

## ✅ Mudanças Necessárias

### Prioridade ALTA (Quebra funcionalidade)

1. **Remover `contentType` de todas as chamadas `PUT_FILE`**
   - Arquivos: `folders.ts` (7 ocorrências), `drawings.ts` (7 ocorrências)
   - Substituir por `metadata` apropriado

### Prioridade MÉDIA (Melhora robustez)

2. **Adicionar `expectedCtime` em updates**
   - Tools afetadas: `UPDATE_FOLDER`, `UPDATE_DRAWING`, `REORDER_FOLDERS`
   - Adicionar lógica de conflict detection

3. **Adicionar `format: "plainString"` em READ_FILE**
   - Todas as chamadas `READ_FILE`
   - Explícito é melhor que implícito

4. **Adicionar metadata em PUT_FILE**
   - Todos os `PUT_FILE` devem incluir metadata útil

### Prioridade BAIXA (Boa prática)

5. **Ajustar PATH_PREFIX para incluir `/` inicial**
   - `PATH_PREFIX: "/webdraw/"` ou `"/apps/webdraw/"`

6. **Melhorar error handling**
   - Diferenciar "not found" de outros erros

---

## 📝 Código Corrigido

### Exemplo: saveFoldersIndex (ANTES)

```typescript
const saveFoldersIndex = async (env: Env, index: FolderIndex): Promise<void> => {
  await env.DECONFIG.PUT_FILE({
    branch: index.branch,
    path: getFoldersIndexPath(),
    content: JSON.stringify(index, null, 2),
    contentType: "application/json",  // ❌ ERRADO
  });
};
```

### Exemplo: saveFoldersIndex (DEPOIS)

```typescript
const saveFoldersIndex = async (env: Env, index: FolderIndex): Promise<void> => {
  await env.DECONFIG.PUT_FILE({
    branch: index.branch,
    path: getFoldersIndexPath(),
    content: JSON.stringify(index, null, 2),
    metadata: {                         // ✅ CORRETO
      app: "webdraw",
      type: "folder-index",
      version: "1.0",
      lastUpdated: Date.now(),
    },
  });
};
```

### Exemplo: UPDATE_FOLDER com conflict detection (DEPOIS)

```typescript
execute: async ({ context }) => {
  const { folderId, name, emoji, branch } = context;
  
  // 1. Ler folder atual com ctime
  const current = await env.DECONFIG.READ_FILE({
    branch,
    path: getFolderPath(folderId),
    format: "plainString",              // ✅ Explícito
  });
  
  if (!current) {
    throw new Error(`Folder não encontrado: ${folderId}`);
  }
  
  const existing: Folder = JSON.parse(current.content);
  
  // 2. Atualizar campos
  const updated: Folder = {
    ...existing,
    name: name ?? existing.name,
    emoji: emoji ?? existing.emoji,
    updatedAt: Date.now(),
  };
  
  // 3. Salvar com conflict detection
  const result = await env.DECONFIG.PUT_FILE({
    branch,
    path: getFolderPath(folderId),
    content: JSON.stringify(updated, null, 2),
    expectedCtime: current.ctime,       // ✅ Conflict detection
    metadata: {                          // ✅ Metadata
      app: "webdraw",
      type: "folder",
      version: "1.0",
    },
  });
  
  // 4. Verificar conflito
  if (result.conflict) {
    throw new Error("Folder foi modificado por outro processo. Tente novamente.");
  }
  
  return { folder: updated };
}
```

---

## 🛠️ Plano de Ação

### Passo 1: Correção Imediata (Breaking)
- [ ] Buscar e substituir TODOS os `contentType` por `metadata`
- [ ] Adicionar `format: "plainString"` em TODOS os `READ_FILE`

### Passo 2: Adicionar Conflict Detection
- [ ] Modificar `UPDATE_FOLDER` tool
- [ ] Modificar `UPDATE_DRAWING` tool
- [ ] Modificar `REORDER_FOLDERS` tool
- [ ] Testar cenários de conflito

### Passo 3: Melhorias de Metadata
- [ ] Definir estrutura padrão de metadata para folders
- [ ] Definir estrutura padrão de metadata para drawings
- [ ] Adicionar metadata em todas as operações

### Passo 4: Error Handling
- [ ] Melhorar tratamento de erros em helpers
- [ ] Adicionar logs úteis para debug
- [ ] Documentar códigos de erro

### Passo 5: Testing
- [ ] Testar todas as tools após mudanças
- [ ] Testar cenários de conflito
- [ ] Verificar metadata está sendo salvo corretamente

---

## 📊 Impacto Estimado

| Mudança | Arquivos Afetados | Linhas | Risco | Prioridade |
|---------|-------------------|--------|-------|------------|
| Remover contentType | 2 | ~14 | Alto | ALTA |
| Adicionar format | 2 | ~7 | Baixo | ALTA |
| Conflict detection | 2 | ~50 | Médio | MÉDIA |
| Adicionar metadata | 2 | ~30 | Baixo | MÉDIA |
| Ajustar paths | 2 | ~2 | Baixo | BAIXA |
| Error handling | 2 | ~20 | Baixo | BAIXA |

**Total estimado:** ~123 linhas modificadas em 2 arquivos

---

## 🎯 Conclusão

O código atual **não vai funcionar corretamente** devido ao uso do parâmetro `contentType` que não existe na API do Deconfig. 

**Ação requerida IMEDIATA:**
1. Remover todos os `contentType`
2. Adicionar `metadata` apropriado
3. Adicionar `format: "plainString"` em READ_FILE

**Ações recomendadas para robustez:**
4. Implementar conflict detection em updates
5. Melhorar error handling

Após essas correções, o código estará alinhado com a documentação oficial e funcionará corretamente com o Deconfig.

---

## 📋 Checklist de Validação

Após aplicar as mudanças:

- [ ] Nenhum `contentType` presente no código
- [ ] Todos os `PUT_FILE` têm `metadata`
- [ ] Todos os `READ_FILE` têm `format: "plainString"`
- [ ] Updates importantes usam `expectedCtime`
- [ ] Error handling diferencia "not found"
- [ ] Paths começam com `/`
- [ ] Tests passam com novo código
- [ ] Debug tools funcionam corretamente

---

**Status:** ⚠️ **CORREÇÕES NECESSÁRIAS ANTES DE USAR**
