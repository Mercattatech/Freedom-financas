# WhatsApp Official API Kit

Kit reutilizável com **todo o processo de conexão da WhatsApp Cloud API oficial
(Meta)**: o passo a passo de configuração no painel da Meta + o código
(backend Express e painel admin React) pronto para colar em qualquer sistema
novo, sem precisar reconstruir do zero toda vez.

Extraído e generalizado a partir da integração já em produção no sistema
Freedom Finanças (`backend/src/routes/whatsapp.js`, `whatsappService.js`,
`configService.js` e `src/components/admin/WhatsAppConfig.jsx`).

> **Instalando com um agente de IA (Antigravity, Cursor, Claude Code, etc.)?**
> Aponte o agente para esta pasta e peça para ele seguir
> [`INSTALL_PROMPT.md`](./INSTALL_PROMPT.md) — é um roteiro escrito
> especificamente para um agente executar a integração sozinho no projeto
> alvo (copiar arquivos, montar o webhook, configurar `.env`, etc), sem você
> precisar fazer isso manualmente.

---

## 1. O que tem aqui

```
whatsapp-official-api-kit/
├── README.md                        este arquivo
├── .env.example                     variáveis de ambiente necessárias
├── package.json
├── src/
│   ├── whatsappClient.js            enviar texto/template/imagem, marcar como lida, baixar mídia
│   ├── webhookRouter.js             router Express: verificação do webhook + recebimento de mensagens
│   ├── configStore.js               de onde vêm as credenciais (env por padrão, plugável)
│   └── index.js                     ponto de entrada (createWhatsAppOfficialApi)
├── frontend/
│   └── WhatsAppOfficialConfig.jsx   painel admin genérico (React + Tailwind, sem deps extras)
├── scripts/
│   └── test-connection.js           testa credenciais e opcionalmente envia msg de teste
└── example/
    └── server.js                    exemplo mínimo funcionando do zero
```

Você só precisa do **backend + Express**. O painel React é opcional, só se o
sistema novo também tiver interface admin em React/Tailwind.

---

## 2. Passo a passo no Meta (fazer isso uma vez por número/app)

### 2.1. Criar o App

1. Acesse [developers.facebook.com/apps](https://developers.facebook.com/apps)
   e crie um App do tipo **Business**.
2. No painel do App, adicione o produto **WhatsApp**.
3. A Meta cria automaticamente um **número de teste** e um **token temporário
   (válido por 24h)** — dá pra usar isso já para os primeiros testes.

### 2.2. Pegar as credenciais iniciais

Em **WhatsApp → Configuração da API**, você encontra:

- **Token de acesso temporário** → `WHATSAPP_ACCESS_TOKEN`
- **ID do número de telefone** (não é o número em si, é um ID numérico) →
  `WHATSAPP_PHONE_NUMBER_ID`

### 2.3. Gerar um token permanente (necessário para produção)

O token temporário expira em 24h. Para produção:

1. Vá ao [Gerenciador de Negócios](https://business.facebook.com/) →
   **Configurações do Negócio → Usuários → Usuários do Sistema**.
2. Crie um Usuário do Sistema (papel: Admin).
3. Em **Adicionar Ativos**, vincule o App criado no passo 2.1.
4. Gere um **token de acesso** para esse Usuário do Sistema, com a permissão
   `whatsapp_business_messaging` (e `whatsapp_business_management` se for
   gerenciar templates/números por API também).
5. Esse token não expira automaticamente — use ele em produção.

### 2.4. Configurar o Webhook

1. Ainda em **WhatsApp → Configuração**, clique em **Editar** no Webhook.
2. **Callback URL**: a URL pública do seu sistema + o caminho onde você vai
   montar o router deste kit, ex:
   ```
   https://seusistema.com/webhooks/whatsapp
   ```
   Em desenvolvimento local, use [ngrok](https://ngrok.com) ou
   [localtunnel](https://github.com/localtunnel/localtunnel) para expor sua
   máquina (a Meta exige HTTPS público, não aceita `localhost`).
3. **Verify Token**: invente uma string qualquer (ex: `meusistema_2026`) e
   salve o mesmo valor em `WHATSAPP_VERIFY_TOKEN` no seu `.env`. É esse valor
   que o kit usa para confirmar o handshake de verificação.
4. Clique em **Verificar e Salvar** — a Meta faz uma requisição `GET` para a
   sua URL; o `webhookRouter.js` deste kit já responde esse handshake
   automaticamente.
5. Em **Campos do Webhook**, clique **Assinar** no campo **`messages`**
   (é o único obrigatório para receber mensagens de usuários).

### 2.5. Sair do modo de desenvolvimento (produção com números reais)

Enquanto o App está em modo *Development*, só números cadastrados como
testadores em **WhatsApp → Configuração da API → Para** conseguem enviar/
receber mensagens. Para atender qualquer número:

1. Complete a **verificação de negócio** (Business Verification) no
   Gerenciador de Negócios.
2. Solicite acesso avançado (App Review) para a permissão
   `whatsapp_business_messaging`, ou mude o App para modo **Live** depois da
   verificação — dependendo do fluxo atual do Meta, um dos dois é exigido.
3. Cadastre/valide o número de telefone real que vai enviar as mensagens
   (WhatsApp → Números de telefone → Adicionar número).

> ⚠️ Fora da janela de 24h desde a última mensagem do usuário, ou no
> primeiro contato, a Meta **não permite** mandar texto livre — é obrigatório
> usar uma **mensagem de template** pré-aprovada
> (`client.sendTemplate(...)` no kit). Templates são criados e aprovados em
> **WhatsApp → Modelos de Mensagem**.

---

## 3. Instalando o kit no sistema novo

### 3.1. Copiar e instalar

```bash
cp -r whatsapp-official-api-kit /caminho/do/novo-sistema/
cd /caminho/do/novo-sistema/whatsapp-official-api-kit
npm install          # só instala dotenv (dev) — express é peer dependency
```

Se o backend novo ainda não tem `express`, instale na raiz dele:
```bash
npm install express
```

### 3.2. Configurar variáveis de ambiente

Copie `.env.example` para `.env` (ou adicione as chaves no `.env` já
existente do sistema novo) e preencha com o que você pegou no passo 2:

```
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_VERIFY_TOKEN=...
WHATSAPP_APP_SECRET=...        # opcional, recomendado em produção
WHATSAPP_API_VERSION=v21.0
```

### 3.3. Plugar no servidor Express

```js
const { createWhatsAppOfficialApi } = require('./whatsapp-official-api-kit/src');

const { client, router } = createWhatsAppOfficialApi({
  onMessage: async (message, ctx) => {
    // message.type: 'text' | 'audio' | 'image' | 'document' | ...
    if (message.type === 'text') {
      await client.sendText(message.from, `Você disse: ${message.text.body}`);
    }
  },
  onStatus: async (status) => {
    // status.status: 'sent' | 'delivered' | 'read' | 'failed'
  },
  requireSignature: process.env.NODE_ENV === 'production',
});

// IMPORTANTE: monte ANTES de qualquer app.use(express.json()) global,
// o router precisa do corpo raw para validar a assinatura do webhook.
app.use('/webhooks/whatsapp', router);

app.use(express.json()); // demais rotas do sistema, depois
```

Veja `example/server.js` para um servidor completo funcionando.

### 3.4. Guardar credenciais em banco em vez de `.env` (opcional)

Por padrão as credenciais vêm de `process.env` (`configStore.js`). Se o
sistema novo tem um painel admin e você quer trocar o token sem redeployar,
implemente um configStore próprio com a mesma interface:

```js
const configStore = {
  async get(key, defaultValue = null) {
    const row = await db.systemConfig.findUnique({ where: { key } });
    return row?.value ?? process.env[key] ?? defaultValue;
  },
  async set(key, value) {
    return db.systemConfig.upsert({ where: { key }, update: { value }, create: { key, value } });
  },
};

const { client, router } = createWhatsAppOfficialApi({ configStore, onMessage });
```

Isso é exatamente o padrão usado no Freedom Finanças (`configService.js`).

### 3.5. Painel admin (opcional, React + Tailwind)

```jsx
import WhatsAppOfficialConfig from './whatsapp-official-api-kit/frontend/WhatsAppOfficialConfig';

<WhatsAppOfficialConfig
  apiBase="/api"
  configEndpoint="/admin/config"
  authHeaders={() => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })}
  webhookPath="/webhooks/whatsapp"
/>
```

O componente espera dois endpoints simples de config chave/valor no backend
(`GET`/`POST /admin/config`). Exemplo mínimo em Express, se o sistema novo
ainda não tiver isso:

```js
router.get('/admin/config', async (req, res) => {
  const rows = await configStore.list?.() ?? []; // implemente list() se quiser
  res.json({ data: rows });
});

router.post('/admin/config', async (req, res) => {
  const { key, value } = req.body;
  await configStore.set(key, value);
  res.json({ ok: true });
});
```

---

## 4. Testando

```bash
# 1. Testa se o token e phone_number_id são válidos
node scripts/test-connection.js

# 2. Testa envio de mensagem de texto (só funciona dentro da janela de 24h
#    ou com número cadastrado como testador em modo dev)
node scripts/test-connection.js 5511999999999

# 3. Testa envio de template aprovado (funciona a qualquer momento)
node scripts/test-connection.js 5511999999999 hello_world en_US
```

Para testar o recebimento de mensagens localmente:
```bash
npx ngrok http 3000
# copie a URL https://xxxx.ngrok.io e configure no passo 2.4 como
# https://xxxx.ngrok.io/webhooks/whatsapp
node example/server.js
# mande uma mensagem pelo WhatsApp para o número de teste e veja o log
```

---

## 5. Segurança

- **Nunca** commite `.env` com tokens reais.
- Ative `requireSignature: true` em produção — o kit valida a assinatura
  `X-Hub-Signature-256` usando `WHATSAPP_APP_SECRET`, garantindo que a
  requisição realmente veio da Meta.
- Trate o webhook como endpoint público — ele sempre responde `200` mesmo em
  erro interno (é o comportamento esperado pela Meta, para não gerar
  reenvios em loop); erros de processamento vão para o `console.error`, não
  para a resposta HTTP.
- Tokens de Usuário do Sistema não expiram sozinhos — trate como um segredo
  de longa duração (rotacione periodicamente, revogue se vazar).

---

## 6. Troubleshooting

| Sintoma | Causa provável |
|---|---|
| Webhook não verifica (403 ao salvar no painel Meta) | `WHATSAPP_VERIFY_TOKEN` no `.env` diferente do valor colado no painel Meta |
| Mensagens não chegam no `onMessage` | Não assinou o campo `messages` no passo 2.4.5, ou URL do webhook aponta pro caminho errado |
| `Error: 401` ao enviar mensagem | Token expirado (temporário de 24h) — gere um permanente (passo 2.3) |
| `Error: (#131047)` "message failed to send because more than 24 hours..." | Fora da janela de atendimento — use `sendTemplate` em vez de `sendText` |
| Funciona com seu número mas não com o de outra pessoa | App ainda em modo Development — cadastre o número como testador ou complete o passo 2.5 |
| `req.rawBody` undefined / assinatura sempre inválida | O router foi montado depois de outro `express.json()` global que já consumiu o corpo — mova o `app.use('/webhooks/whatsapp', router)` para antes |

---

## 7. Checklist rápido para instalar num sistema novo

- [ ] Criar/reaproveitar App Meta Business + produto WhatsApp
- [ ] Copiar a pasta `whatsapp-official-api-kit/` para o sistema novo
- [ ] `npm install express` (se ainda não tiver)
- [ ] Preencher `.env` com as 4-5 chaves `WHATSAPP_*`
- [ ] Montar o router **antes** do `express.json()` global
- [ ] Implementar `onMessage` com a lógica de negócio do sistema novo
- [ ] Configurar Callback URL + Verify Token no painel Meta (passo 2.4)
- [ ] Assinar o campo `messages`
- [ ] `node scripts/test-connection.js` para validar
- [ ] Gerar token permanente via Usuário do Sistema antes de ir pra produção
- [ ] Ativar `requireSignature: true` + `WHATSAPP_APP_SECRET` em produção
