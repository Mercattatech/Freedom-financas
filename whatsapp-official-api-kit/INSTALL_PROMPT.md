# Instruções para agente de IA — instalar este kit em outro projeto

Você é um agente de codificação (Antigravity, Cursor, Claude Code, Windsurf ou
similar) e recebeu esta pasta (`whatsapp-official-api-kit/`) dentro de — ou ao
lado de — um projeto alvo. Sua tarefa é **integrar a conexão oficial com a
WhatsApp Cloud API (Meta) nesse projeto alvo**, usando o código desta pasta
como implementação de referência. Este arquivo é o seu roteiro. Execute os
passos em ordem, usando suas ferramentas de terminal/edição de arquivo.

Não peça para o humano copiar/colar nada manualmente — faça você mesmo as
edições e instalações. Só pare e pergunte ao usuário quando um passo abaixo
disser explicitamente para perguntar.

---

## Passo 0 — Entender o projeto alvo

1. Identifique a raiz do projeto alvo (o diretório que contém `package.json`
   mais próximo desta pasta, ou o diretório que o usuário indicou como
   destino — se ambíguo, pergunte qual é).
2. Leia o `package.json` da raiz do projeto alvo e verifique se `express`
   está nas dependências.
   - **Se não houver Node/Express no projeto alvo**: este kit foi escrito
     para Node.js + Express. Avise o usuário disso e pergunte se: (a) o
     projeto tem algum backend Node/Express secundário onde isso se encaixa,
     ou (b) ele quer que você porte a lógica de `src/whatsappClient.js` e
     `src/webhookRouter.js` para a linguagem/framework do projeto alvo
     (mantendo os mesmos endpoints da Graph API e o mesmo fluxo de
     verificação de webhook documentados no `README.md`). Não prossiga com
     os passos Node-específicos abaixo sem essa resposta.
3. Encontre o arquivo de entrada do servidor Express (candidatos comuns:
   `server.js`, `index.js`, `app.js`, `src/index.js`, `src/server.js`,
   `backend/src/index.js`) — procure por `express()` e `app.listen(`.
4. Verifique se já existe alguma integração com WhatsApp no projeto
   (`grep -ri whatsapp` na raiz). Se já existir algo:
   - Não sobrescreva sem perguntar. Mostre ao usuário o que já existe e
     pergunte se ele quer (a) substituir pela implementação deste kit, (b)
     manter a existente e só adicionar o que falta, ou (c) cancelar.

---

## Passo 1 — Copiar os arquivos do kit

1. Copie a pasta `src/` deste kit para dentro do projeto alvo, preservando a
   estrutura, em um diretório de libs/serviços coerente com as convenções do
   projeto (ex: `<raiz>/lib/whatsapp-official-api-kit/`,
   `<raiz>/backend/src/integrations/whatsapp-official-api-kit/`, ou apenas
   `<raiz>/whatsapp-official-api-kit/src/` se o projeto não tiver um padrão
   claro de organização). Copie `configStore.js`, `whatsappClient.js`,
   `webhookRouter.js` e `index.js` juntos — eles se importam entre si por
   caminho relativo, então mantenha os quatro na mesma pasta.
2. Copie também `scripts/test-connection.js` para dentro do projeto alvo
   (ex: `<raiz>/scripts/whatsapp-test-connection.js`), ajustando o
   `require(...)` do topo para apontar para onde você colocou o `src/` no
   passo anterior.
3. Se o projeto alvo tiver frontend em React + Tailwind e o usuário quiser
   um painel admin para configurar as credenciais, copie
   `frontend/WhatsAppOfficialConfig.jsx` para a pasta de componentes admin
   do projeto (ex: procure por `components/admin/` ou equivalente).

---

## Passo 2 — Dependências

1. Se `express` não estiver instalado no projeto alvo, rode a instalação
   (`npm install express` / `yarn add express` / `pnpm add express`,
   conforme o gerenciador de pacotes que o projeto já usa — veja qual
   lockfile existe: `package-lock.json`, `yarn.lock` ou `pnpm-lock.yaml`).
2. Este kit não precisa de `axios` nem de nenhuma outra lib de HTTP — ele
   usa `fetch` nativo do Node (exige Node >= 18). Confirme a versão do Node
   do projeto (`.nvmrc`, `engines` no `package.json`, ou rode `node -v`). Se
   for menor que 18, avise o usuário — ele vai precisar atualizar o Node ou
   você adapta `whatsappClient.js` para usar `axios`/`node-fetch`.

---

## Passo 3 — Variáveis de ambiente

1. Abra o `.env` (ou `.env.local`) da raiz do projeto alvo. Se não existir,
   crie um.
2. Adicione **somente as chaves que ainda não existem** (não sobrescreva
   valores já presentes) a partir de `.env.example` deste kit:
   ```
   WHATSAPP_ACCESS_TOKEN=
   WHATSAPP_PHONE_NUMBER_ID=
   WHATSAPP_VERIFY_TOKEN=
   WHATSAPP_APP_SECRET=
   WHATSAPP_API_VERSION=v21.0
   ```
3. Confirme que o projeto alvo já ignora `.env` no `.gitignore`. Se não
   ignorar, adicione — nunca deixe segredos irem para o git.
4. Deixe os valores em branco — quem preenche é o humano depois de seguir o
   passo a passo do Meta descrito na seção 2 do `README.md` deste kit.
   Não invente/gere valores falsos para essas chaves.

---

## Passo 4 — Montar o webhook no servidor

Esta é a parte mais delicada: o router precisa ser montado **antes** de
qualquer `app.use(express.json())` global existente no arquivo de entrada,
porque ele precisa do corpo raw da requisição para validar a assinatura.

1. Abra o arquivo de entrada identificado no Passo 0.3.
2. Localize a primeira ocorrência de `app.use(express.json(` (parser JSON
   global) ou, se não houver nenhum, localize onde as demais rotas (`app.use('/api/...', ...)`) são montadas.
3. Logo **antes** dessa linha, insira:
   ```js
   const { createWhatsAppOfficialApi } = require('<caminho-relativo-para-o-src-copiado>');

   const { client: whatsappOfficialClient, router: whatsappOfficialRouter } = createWhatsAppOfficialApi({
     onMessage: async (message, ctx) => {
       // TODO: plugue aqui a lógica de negócio do projeto (ex: interpretar a
       // mensagem, chamar uma IA, salvar no banco, etc). Veja o exemplo em
       // example/server.js deste kit e o webhook original do Freedom
       // Finanças (backend/src/routes/whatsapp.js) como referência de um
       // fluxo completo (sessão, confirmação, múltiplos intents).
       if (message.type === 'text') {
         await whatsappOfficialClient.sendText(message.from, `Recebi: ${message.text.body}`);
       }
     },
     requireSignature: process.env.NODE_ENV === 'production',
   });

   app.use('/webhooks/whatsapp', whatsappOfficialRouter);
   ```
   Ajuste o caminho `/webhooks/whatsapp` se o projeto já tiver uma convenção
   de prefixo de API (ex: `/api/webhooks/whatsapp`).
4. Se o projeto usa TypeScript, ajuste a sintaxe de import para
   `import { createWhatsAppOfficialApi } from '...'` e adicione tipos `any`
   simples onde necessário (o kit em si é JS puro, não precisa converter os
   arquivos do `src/` para TS a menos que o usuário peça).
5. Depois de editar, rode um comando de sintaxe/compilação do projeto (ex:
   `node --check <arquivo>`, `npm run build`, ou o comando de lint
   existente) para garantir que não quebrou nada.

---

## Passo 5 — Painel admin (opcional)

Só faça isso se o projeto já tem uma área admin em React e o usuário
confirmou que quer o painel visual.

1. Depois de copiar `WhatsAppOfficialConfig.jsx` (Passo 1.3), encontre onde
   as outras páginas/rotas admin do projeto são registradas (menu lateral,
   router) e adicione uma entrada apontando para esse componente, seguindo
   o mesmo padrão das outras entradas existentes.
2. Ajuste as props do componente (`apiBase`, `configEndpoint`,
   `authHeaders`, `webhookPath`) para bater com as convenções de API e auth
   do projeto alvo.
3. Se o projeto alvo **não tiver** ainda um endpoint genérico de config
   chave/valor (`GET`/`POST /admin/config`), crie um seguindo o exemplo que
   está na seção 3.5 do `README.md` deste kit, adaptado ao ORM/banco do
   projeto (Prisma, Sequelize, Mongoose, SQL puro, etc — descubra qual o
   projeto usa antes de escrever o código).

---

## Passo 6 — Validar

1. Rode o script de teste copiado no Passo 1.2:
   ```
   node <caminho>/whatsapp-test-connection.js
   ```
   Com as credenciais ainda vazias, ele deve falhar de forma clara dizendo
   que `WHATSAPP_ACCESS_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID` não estão
   configurados — isso é esperado antes do usuário preencher o `.env`.
2. Resuma para o usuário, em poucas linhas:
   - Onde os arquivos foram colocados.
   - Qual URL de webhook ele deve configurar no painel da Meta (baseado no
     domínio/porta do projeto + o path escolhido no Passo 4.3).
   - Que falta ele preencher o `.env` e seguir a seção 2 do `README.md`
     deste kit (passo a passo completo no Meta Developers) antes de o
     webhook funcionar de verdade.
3. Não tente adivinhar ou inventar tokens/IDs reais da Meta — essas
   credenciais só existem depois que o usuário cria o App no
   developers.facebook.com.

---

## Regras gerais

- Não rode `git commit`/`git push` sem o usuário pedir explicitamente.
- Não sobrescreva uma integração WhatsApp já existente sem confirmar antes.
- Não coloque tokens/segredos reais em nenhum arquivo versionado — sempre em
  `.env`.
- Se o projeto alvo tiver um jeito próprio de guardar configuração em banco
  (em vez de variáveis de ambiente), prefira plugar um `configStore`
  customizado (ver seção 3.4 do `README.md`) em vez de forçar tudo via
  `.env`.
