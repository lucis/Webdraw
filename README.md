# Webdraw

Webdraw é um editor de desenho baseado em Excalidraw. O frontend React e o
Worker Cloudflare armazenam pastas, desenhos, sessões e credenciais cifradas
no D1.

## Requisitos

- Node.js 22 ou superior
- npm
- Uma conta Cloudflare com um banco D1 configurado no `wrangler.jsonc`
- Uma aplicação OpenRouter configurada para OAuth

## Desenvolvimento local

Instale as dependências e crie a configuração local a partir do exemplo:

```bash
npm install
cp .dev.vars.example .dev.vars
```

Gere uma chave de cifragem de exatamente 32 bytes codificada em base64 e copie
o resultado para `AUTH_ENCRYPTION_KEY` em `.dev.vars`:

```bash
openssl rand -base64 32
```

Mantenha `APP_ORIGIN=http://localhost:5173` para o ambiente local. A URL de
callback que deve ser registrada na aplicação OpenRouter é:

```
http://localhost:5173/api/auth/callback
```

Crie o banco D1 local e inicie o servidor de desenvolvimento:

```bash
npm run db:migrate:local
npm run dev
```

Abra `http://localhost:5173`. O login começa em `/api/auth/login`; a chave
OpenRouter recebida no callback é tratada pelo Worker e não é exposta ao
navegador.

## Limites de cenas

Cada cena serializada é limitada a 1.000.000 bytes UTF-8 e cada requisição de
criação ou atualização de desenho a 1.100.000 bytes. Imagens e outros binários
devem ser mantidos fora da cena no D1 (por exemplo, no R2), com apenas suas
referências na cena.

## Publicação no Cloudflare

O workflow de produção aplica as migrações remotas do D1 com as mesmas
credenciais Cloudflare, antes de publicar o Worker. O workflow de preview não
aplica migrações remotas.

Defina os valores de produção de forma interativa, sem colocá-los em arquivos
versionados:

```bash
npx wrangler secret put AUTH_ENCRYPTION_KEY
npx wrangler secret put APP_ORIGIN
```

`AUTH_ENCRYPTION_KEY` deve ser uma nova chave base64 de 32 bytes. `APP_ORIGIN`
deve ser a origem HTTPS final do Worker. Registre então
`https://seu-dominio/api/auth/callback` como callback da aplicação OpenRouter,
substituindo `seu-dominio` pela origem configurada.

Publique o Worker e os assets:

```bash
npm run deploy
```

## Verificação

```bash
bash scripts/check-no-deco.sh
npm test
npm run test:worker
npm run typecheck
npm run lint
npm run build
npx wrangler deploy --dry-run
```

## Estrutura

- `worker/`: API HTTP, autenticação OpenRouter e acesso ao D1.
- `view/`: interface React e integração com o canvas.
- `migrations/`: esquema versionado do banco D1.
- `shared/contracts/`: contratos entre browser e Worker.
