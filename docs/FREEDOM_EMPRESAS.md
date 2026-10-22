# Freedom Empresas

Módulo de gestão financeira empresarial do Freedom: multiempresa (vendável como SaaS), integrado ao Asaas e comandável por IA via MCP.

- Frontend: `src/business/` (rotas `/empresas/*` e página pública `/proposta/:token`)
- Backend: `backend/src/business/` (montado em `/api/biz`)
- Banco: modelos `Biz*` em `backend/prisma/schema.prisma` (tabelas `biz_*`)

## O que tem

| Área | Recursos |
|---|---|
| Financeiro | Contas a pagar e a receber, parcelamento, recorrência mensal, baixa total/parcial com juros e desconto, estorno, cancelamento, competência × caixa, contas financeiras e saldos |
| Asaas | Clientes, cobranças avulsas (boleto/PIX/cartão), assinaturas para contratos recorrentes, reajuste propagado, recebimento em dinheiro informado ao Asaas, webhook idempotente com baixa automática e tarifa lançada na DRE |
| Comercial | Clientes, catálogo de produtos e serviços (preço, custo, margem), propostas com a marca da empresa, link público com aceite (nome + CPF/CNPJ + IP), recusa com motivo, contagem de aberturas, conversão automática em contrato |
| Contratos | Recorrentes (mensal a anual) e pontuais (projeto/setup parcelado), ativação com faturamento automático, pausa, cancelamento (remove assinatura e títulos futuros), reajuste, previsto × realizado |
| Operação | Estoque com custo médio ponderado (entrada, saída alocada a contrato, ajuste), fornecedores, equipe com custo/hora, apontamento de horas por contrato, centros de custo |
| Relatórios | Dashboard executivo, DRE mês a mês (competência ou caixa) com análise vertical, margem por contrato (com rateio de overhead), margem por cliente e concentração, margem da empresa (cascata, utilização da equipe, custo ocioso, ponto de equilíbrio, mix recorrente × pontual), fluxo de caixa projetado com assinaturas futuras, aging/inadimplência, exportação CSV |
| IA (MCP) | 31 ferramentas (leitura e escrita), resolução de nomes ("contrato da Locadora Alfa"), chaves somente leitura, auditoria de tudo que a IA faz |
| Plataforma | Papéis (Proprietário, Administrador, Financeiro, Comercial, Operacional, Leitura), auditoria, chave do Asaas criptografada (AES-256-GCM), rotina diária |

## Como a margem é calculada

**Margem de contribuição do contrato** (por competência) =
receita do contrato − impostos estimados (alíquota da empresa ou do contrato) − comissão − despesas lançadas no contrato − produtos do estoque baixados para o contrato − tarifas do Asaas − horas apontadas × custo/hora do colaborador.

**Overhead não alocado** = despesas de custos, pessoal, administrativas e comerciais sem contrato − custo de equipe e de produtos já apropriados aos contratos. Ele é rateado entre os contratos por receita (padrão), por horas, ou não é rateado. **Margem líquida do contrato** = contribuição − overhead rateado.

A soma das margens líquidas dos contratos reconcilia com o EBITDA da DRE, ajustada pela diferença entre imposto estimado e imposto pago e pelas tarifas (verificado no teste de integração).

## Instalação

1. Dependências do backend (já no `backend/package.json`): `@modelcontextprotocol/sdk` e `zod`.
   ```bash
   npm install            # raiz (roda prisma generate e instala o backend)
   ```
2. Criar as tabelas (escolha uma):
   ```bash
   cd backend && npx prisma db push          # recomendado
   # ou rode backend/prisma/sql/freedom_empresas.sql no SQL editor do Supabase
   ```
3. Variáveis de ambiente (Vercel / KingHost):

   | Variável | Para quê |
   |---|---|
   | `BIZ_ENCRYPTION_KEY` | Chave para criptografar a API key do Asaas (se ausente, deriva do `JWT_SECRET`). Defina uma e não troque depois. |
   | `CRON_SECRET` | Protege `/api/biz/jobs/daily` (o `vercel.json` já agenda a rotina diária) |
   | `APP_URL` | URL pública do app, usada nos links de proposta e na URL do webhook (ex.: `https://freedom.grupomercatta.com.br`) |
   | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Opcional: envio de propostas por e-mail |
   | `ASAAS_API_URL` | Opcional: aponta para mock/proxy em homologação |

4. Acesse `/empresas`, cadastre a empresa (o plano de contas, centros de custo e contas financeiras são criados automaticamente).

## Asaas

1. Configurações › Asaas: escolha o ambiente (sandbox ou produção) e cole a chave de API.
2. No painel do Asaas: Integrações › Webhooks › novo webhook de cobranças, com a URL e o token exibidos na tela e os eventos `PAYMENT_CREATED, PAYMENT_UPDATED, PAYMENT_CONFIRMED, PAYMENT_RECEIVED, PAYMENT_OVERDUE, PAYMENT_DELETED, PAYMENT_REFUNDED, PAYMENT_RECEIVED_IN_CASH_UNDONE`.
3. Clientes precisam de CPF/CNPJ para receber cobranças.

Fluxo: contrato recorrente ativado → assinatura no Asaas → o Asaas gera a cobrança → webhook `PAYMENT_CREATED` cria o título vinculado ao contrato → `PAYMENT_RECEIVED` baixa o título, registra a tarifa (valor − valor líquido) e credita a conta financeira "Conta Asaas".

## MCP (comando por IA)

- Endpoint: `POST {APP_URL}/api/biz/mcp` (Streamable HTTP, sem estado)
- Autenticação: `Authorization: Bearer fbk_...` (gere em Configurações › Integração com IA)
- Claude: Configurações › Conectores › Adicionar conector personalizado. Clientes que só aceitam processo local:
  ```bash
  npx mcp-remote https://SEU_APP/api/biz/mcp --header "Authorization: Bearer fbk_..."
  ```

Ferramentas: `resumo_executivo`, `dre`, `margem_contratos`, `margem_clientes`, `margem_agencia`, `fluxo_caixa_projetado`, `inadimplencia`, `listar_lancamentos`, `buscar_clientes`, `buscar_produtos_servicos`, `listar_contratos`, `detalhar_contrato`, `listar_propostas`, `cadastros_auxiliares`, `criar_cliente`, `criar_fornecedor`, `criar_produto_servico`, `movimentar_estoque`, `criar_conta_receber`, `criar_conta_pagar`, `atualizar_lancamento`, `baixar_lancamento`, `cancelar_lancamento`, `emitir_cobranca_asaas`, `criar_proposta`, `enviar_proposta`, `converter_proposta_em_contrato`, `criar_contrato`, `alterar_status_contrato`, `reajustar_contrato`, `apontar_horas`.

Uma chave "somente leitura" expõe apenas as ferramentas de consulta. As ações ficam na auditoria com origem `MCP`.

## API REST (resumo)

Todas exigem `Authorization: Bearer <JWT do Freedom>` + `x-company-id`, ou uma chave `fbk_`.

```
GET/POST        /api/biz/companies
GET/PUT         /api/biz/company            PUT /api/biz/company/asaas   GET /api/biz/company/asaas/status
CRUD            /api/biz/{clients|suppliers|accounts|cost-centers|bank-accounts|team}
CRUD            /api/biz/products           POST /products/:id/stock     GET /stock-movements
CRUD            /api/biz/transactions       POST /transactions/:id/{pay|reopen|cancel|charge}
CRUD            /api/biz/contracts          POST /contracts/:id/{activate|status|readjust|generate}
CRUD            /api/biz/proposals          POST /proposals/:id/{send|duplicate|convert}
GET/POST/DELETE /api/biz/time-entries
GET             /api/biz/reports/{dashboard|dre|contracts-margin|clients-margin|agency-margin|cashflow|aging|balances}
GET/POST/DELETE /api/biz/api-keys           GET /api/biz/audit
Público:        GET /api/biz/public/proposals/:token   POST .../accept   POST .../reject
Asaas:          POST /api/biz/webhooks/asaas/:companyId
Rotina:         GET  /api/biz/jobs/daily (Bearer CRON_SECRET)
MCP:            POST /api/biz/mcp
```

## Testes

Cenário ponta a ponta (agência com 3 contratos, Asaas simulado, webhooks, DRE, margens, MCP): 87 verificações.

```bash
cd backend
DATABASE_URL=postgresql://localhost:5432/freedom_test npx prisma db push
DATABASE_URL=postgresql://localhost:5432/freedom_test npm run test:biz
```

Use um banco de teste: o cenário apaga os dados das tabelas do módulo.
