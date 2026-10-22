// Router do módulo Freedom Empresas — montado em /api/biz
const express = require('express');
const { ah, HttpError } = require('../lib/errors');
const { serialize } = require('../lib/money');
const { requireUser, requireCompany, requirePerm } = require('../middleware/tenant');
const { can } = require('../lib/permissions');
const prisma = require('../db');

const companies = require('../services/companies');
const registry = require('../services/registry');
const products = require('../services/products');
const transactions = require('../services/transactions');
const contracts = require('../services/contracts');
const proposals = require('../services/proposals');
const team = require('../services/team');
const reports = require('../services/reports');
const apiKeys = require('../services/apiKeys');
const asaasSync = require('../services/asaasSync');
const asaasImport = require('../services/asaasImport');
const invoices = require('../services/invoices');
const { AsaasClient } = require('../services/asaas');
const { runDaily } = require('../jobs/daily');
const { mcpHandler } = require('../mcp/server');

const baseUrl = (req) => process.env.APP_URL || req.headers.origin || `${req.headers['x-forwarded-proto'] || req.protocol}://${req.get('host')}`;
const clientIp = (req) => String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();

let dbSynced = false;
async function ensureDbColumns() {
  if (dbSynced) return;
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "biz_company" ADD COLUMN IF NOT EXISTS "municipal_service_code" TEXT;
      ALTER TABLE "biz_company" ADD COLUMN IF NOT EXISTS "municipal_service_name" TEXT;
      ALTER TABLE "biz_company" ADD COLUMN IF NOT EXISTS "nfse_descricao_padrao" TEXT;
      ALTER TABLE "biz_company" ADD COLUMN IF NOT EXISTS "nfse_emitir_ao_receber" BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE "biz_company" ADD COLUMN IF NOT EXISTS "nfse_reter_iss" BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE "biz_company" ADD COLUMN IF NOT EXISTS "nfse_aliquota_iss" DECIMAL(6,3);

      ALTER TABLE "biz_transaction" ADD COLUMN IF NOT EXISTS "asaas_invoice_id" TEXT;
      ALTER TABLE "biz_transaction" ADD COLUMN IF NOT EXISTS "nfse_numero" TEXT;
      ALTER TABLE "biz_transaction" ADD COLUMN IF NOT EXISTS "nfse_status" TEXT;
      ALTER TABLE "biz_transaction" ADD COLUMN IF NOT EXISTS "nfse_pdf_url" TEXT;
      ALTER TABLE "biz_transaction" ADD COLUMN IF NOT EXISTS "nfse_xml_url" TEXT;
      ALTER TABLE "biz_transaction" ADD COLUMN IF NOT EXISTS "nfse_rps_numero" TEXT;
      ALTER TABLE "biz_transaction" ADD COLUMN IF NOT EXISTS "nfse_erro" TEXT;
    `);
    dbSynced = true;
  } catch (err) {
    console.error('[biz ensureDbColumns]', err.message);
  }
}

function createBizRouter() {
  const r = express.Router();

  // Garante colunas de migração no banco de dados
  r.use(async (req, res, next) => {
    if (!dbSynced) {
      await ensureDbColumns();
    }
    next();
  });

  // Decimals → Number em todas as respostas
  r.use((req, res, next) => {
    const json = res.json.bind(res);
    res.json = (body) => json(serialize(body));
    next();
  });

  r.get('/health', (req, res) => res.json({ ok: true, modulo: 'freedom-empresas' }));

  // ── Público: proposta compartilhável ──
  r.get('/public/proposals/:token', ah(async (req, res) => res.json(await proposals.publicView(req.params.token, { ip: clientIp(req), track: req.query.preview !== '1' }))));
  r.post('/public/proposals/:token/accept', ah(async (req, res) => res.json(await proposals.publicAccept(req.params.token, req.body || {}, clientIp(req)))));
  r.post('/public/proposals/:token/reject', ah(async (req, res) => res.json(await proposals.publicReject(req.params.token, req.body || {}))));

  // ── Webhook do Asaas (um endpoint por empresa) ──
  r.post('/webhooks/asaas/:companyId', ah(async (req, res) => {
    const result = await asaasSync.handleWebhook(req.params.companyId, req.headers['asaas-access-token'], req.body);
    res.status(200).json({ received: true, ...result });
  }));

  // ── Rotina diária (Vercel Cron envia Authorization: Bearer CRON_SECRET) ──
  r.all('/jobs/daily', ah(async (req, res) => {
    const secret = process.env.CRON_SECRET;
    const got = (req.headers.authorization || '').replace('Bearer ', '') || req.headers['x-cron-secret'];
    if (!secret || got !== secret) throw new HttpError(401, 'Não autorizado');
    res.json(await runDaily());
  }));

  // ── MCP remoto (Streamable HTTP) — autenticado por chave de API ──
  r.all('/mcp', mcpHandler);

  // ── Empresas do usuário ──
  r.get('/companies', requireUser, ah(async (req, res) => {
    if (req.ctx) return res.json([await companies.get(req.ctx)]);
    res.json(await companies.listForUser(req.user));
  }));
  r.post('/companies', requireUser, ah(async (req, res) => res.status(201).json(await companies.create(req.user, req.body || {}))));

  // Daqui em diante: empresa obrigatória
  r.use(requireCompany);

  r.get('/me', ah(async (req, res) => res.json({ ...req.ctx, empresa: await companies.get(req.ctx) })));
  r.get('/company', ah(async (req, res) => res.json(await companies.get(req.ctx))));
  r.put('/company', requirePerm('config:write'), ah(async (req, res) => res.json(await companies.update(req.ctx, req.body || {}))));

  // Asaas
  r.put('/company/asaas', requirePerm('config:write'), ah(async (req, res) => {
    const { api_key, ambiente } = req.body || {};
    const c = await companies.setAsaasKey(req.ctx, api_key, ambiente);
    let conexao = null;
    if (api_key) {
      try {
        const full = await prisma.bizCompany.findUnique({ where: { id: req.ctx.companyId } });
        conexao = { ok: true, saldo: (await new AsaasClient(full).getBalance())?.balance };
      } catch (e) { conexao = { ok: false, erro: e.message }; }
    }
    res.json({ ...c, conexao });
  }));
  r.get('/company/asaas/status', requirePerm('config:write'), ah(async (req, res) => {
    const full = await prisma.bizCompany.findUnique({ where: { id: req.ctx.companyId } });
    const webhook = await companies.getWebhookInfo(req.ctx, baseUrl(req));
    if (!full.asaas_api_key) return res.json({ configurado: false, ambiente: full.asaas_ambiente, webhook });
    try {
      const bal = await new AsaasClient(full).getBalance();
      res.json({ configurado: true, conectado: true, ambiente: full.asaas_ambiente, saldo: bal?.balance, webhook });
    } catch (e) {
      res.json({ configurado: true, conectado: false, erro: e.message, ambiente: full.asaas_ambiente, webhook });
    }
  }));
  r.post('/company/asaas/sync', requirePerm('config:write'), ah(async (req, res) => {
    res.json(await asaasImport.syncAllFromAsaas(req.ctx, req.body || {}));
  }));
  r.get('/payment-links', ah(async (req, res) => res.json(await asaasImport.listPaymentLinks(req.ctx, req.query))));
  r.post('/payment-links', requirePerm('financeiro:write'), ah(async (req, res) => res.status(201).json(await asaasImport.createPaymentLink(req.ctx, req.body || {}))));
  r.post('/transactions/pay-bill-asaas', requirePerm('financeiro:write'), ah(async (req, res) => res.json(await asaasImport.payBillViaAsaas(req.ctx, req.body || {}))));

  // Membros
  r.get('/members', ah(async (req, res) => res.json(await companies.listMembers(req.ctx))));
  r.post('/members', requirePerm('config:write'), ah(async (req, res) => res.status(201).json(await companies.addMember(req.ctx, req.body || {}))));
  r.put('/members/:id', requirePerm('config:write'), ah(async (req, res) => res.json(await companies.updateMember(req.ctx, req.params.id, req.body || {}))));

  // Cadastros simples
  for (const entity of Object.keys(registry.ENTITIES)) {
    const perm = registry.ENTITIES[entity].perm;
    r.get(`/${entity}`, ah(async (req, res) => {
      if (entity === 'team') return res.json(await team.listTeam(req.ctx));
      res.json(await registry.list(req.ctx, entity, req.query));
    }));
    r.get(`/${entity}/:id`, ah(async (req, res) => res.json(await registry.get(req.ctx, entity, req.params.id))));
    r.post(`/${entity}`, requirePerm(perm), ah(async (req, res) => res.status(201).json(await registry.create(req.ctx, entity, req.body || {}))));
    r.put(`/${entity}/:id`, requirePerm(perm), ah(async (req, res) => res.json(await registry.update(req.ctx, entity, req.params.id, req.body || {}))));
    r.delete(`/${entity}/:id`, requirePerm(perm), ah(async (req, res) => res.json(await registry.remove(req.ctx, entity, req.params.id))));
  }

  // Produtos, serviços e estoque
  r.get('/products', ah(async (req, res) => res.json(await products.list(req.ctx, req.query))));
  r.get('/products/:id', ah(async (req, res) => res.json(await products.get(req.ctx, req.params.id))));
  r.post('/products', requirePerm('cadastros:write'), ah(async (req, res) => res.status(201).json(await products.create(req.ctx, req.body || {}))));
  r.put('/products/:id', requirePerm('cadastros:write'), ah(async (req, res) => res.json(await products.update(req.ctx, req.params.id, req.body || {}))));
  r.delete('/products/:id', requirePerm('cadastros:write'), ah(async (req, res) => res.json(await products.remove(req.ctx, req.params.id))));
  r.get('/stock-movements', ah(async (req, res) => res.json(await products.listMovements(req.ctx, req.query))));
  r.post('/products/:id/stock', requirePerm('operacional:write'), ah(async (req, res) => res.status(201).json(await products.moveStock(req.ctx, req.params.id, req.body || {}))));

  // Contas a pagar / receber
  const finWrite = requirePerm('financeiro:write');
  r.get('/transactions', ah(async (req, res) => res.json(await transactions.list(req.ctx, req.query))));
  r.post('/transactions/batch/pay', finWrite, ah(async (req, res) => res.json(await transactions.batchPay(req.ctx, req.body || {}))));
  r.post('/transactions/batch/cancel', finWrite, ah(async (req, res) => res.json(await transactions.batchCancel(req.ctx, req.body || {}))));
  r.post('/transactions/batch/delete', finWrite, ah(async (req, res) => res.json(await transactions.batchDelete(req.ctx, req.body || {}))));
  r.post('/transactions/batch/update', finWrite, ah(async (req, res) => res.json(await transactions.batchUpdate(req.ctx, req.body || {}))));
  r.post('/transactions/batch/invoice', finWrite, ah(async (req, res) => res.json(await invoices.batchIssueInvoices(req.ctx, req.body || {}))));
  r.get('/transactions/:id', ah(async (req, res) => res.json(await transactions.get(req.ctx, req.params.id))));
  r.post('/transactions', finWrite, ah(async (req, res) => res.status(201).json(await transactions.create(req.ctx, req.body || {}))));
  r.put('/transactions/:id', finWrite, ah(async (req, res) => res.json(await transactions.update(req.ctx, req.params.id, req.body || {}))));
  r.delete('/transactions/:id', finWrite, ah(async (req, res) => res.json(await transactions.remove(req.ctx, req.params.id))));
  r.post('/transactions/:id/pay', finWrite, ah(async (req, res) => res.json(await transactions.pay(req.ctx, req.params.id, req.body || {}))));
  r.post('/transactions/:id/reopen', finWrite, ah(async (req, res) => res.json(await transactions.reopen(req.ctx, req.params.id))));
  r.post('/transactions/:id/cancel', finWrite, ah(async (req, res) => res.json(await transactions.cancel(req.ctx, req.params.id, req.body || {}))));
  r.post('/transactions/:id/charge', finWrite, ah(async (req, res) => res.json(await transactions.charge(req.ctx, req.params.id, req.body || {}))));
  r.post('/transactions/:id/invoice', finWrite, ah(async (req, res) => res.json(await invoices.issueInvoice(req.ctx, req.params.id, req.body || {}))));
  r.get('/transactions/:id/invoice', ah(async (req, res) => res.json(await invoices.syncInvoiceStatus(req.ctx, req.params.id))));
  r.post('/transactions/:id/invoice/cancel', finWrite, ah(async (req, res) => res.json(await invoices.cancelInvoice(req.ctx, req.params.id, req.body || {}))));

  // Contratos
  const ctWrite = requirePerm('contratos:write');
  r.get('/contracts', ah(async (req, res) => res.json(await contracts.list(req.ctx, req.query))));
  r.get('/contracts/:id', ah(async (req, res) => {
    const c = await contracts.get(req.ctx, req.params.id);
    const full = { ...c };
    if (can(req.ctx.papel, 'relatorios:read')) {
      const from = c.data_inicio;
      full.margem_total = (await reports.contractsMargin(req.ctx, { from, to: new Date(), contract_id: c.id })).contratos[0] || null;
      full.margem_mes = (await reports.contractsMargin(req.ctx, { contract_id: c.id })).contratos[0] || null;
    }
    full.lancamentos = (await transactions.list(req.ctx, { contract_id: c.id, incluir_cancelados: true })).items;
    full.apontamentos = await team.listEntries(req.ctx, { contract_id: c.id, limit: 200 });
    res.json(full);
  }));
  r.post('/contracts', ctWrite, ah(async (req, res) => res.status(201).json(await contracts.create(req.ctx, req.body || {}))));
  r.put('/contracts/:id', ctWrite, ah(async (req, res) => res.json(await contracts.update(req.ctx, req.params.id, req.body || {}))));
  r.delete('/contracts/:id', ctWrite, ah(async (req, res) => res.json(await contracts.remove(req.ctx, req.params.id))));
  r.post('/contracts/:id/activate', ctWrite, ah(async (req, res) => res.json(await contracts.activate(req.ctx, req.params.id))));
  r.post('/contracts/:id/status', ctWrite, ah(async (req, res) => res.json(await contracts.setStatus(req.ctx, req.params.id, req.body?.status, req.body || {}))));
  r.post('/contracts/:id/readjust', ctWrite, ah(async (req, res) => res.json(await contracts.readjust(req.ctx, req.params.id, req.body || {}))));
  r.post('/contracts/:id/generate', ctWrite, ah(async (req, res) => res.json(await contracts.generateRecurring(req.ctx, req.params.id, parseInt(req.body?.meses || 2, 10)))));

  // Propostas
  const comWrite = requirePerm('comercial:write');
  r.get('/proposals', ah(async (req, res) => res.json(await proposals.list(req.ctx, req.query))));
  r.get('/proposals/:id', ah(async (req, res) => res.json({ ...(await proposals.get(req.ctx, req.params.id)), base_url: baseUrl(req) })));
  r.post('/proposals', comWrite, ah(async (req, res) => res.status(201).json(await proposals.create(req.ctx, req.body || {}))));
  r.put('/proposals/:id', comWrite, ah(async (req, res) => res.json(await proposals.update(req.ctx, req.params.id, req.body || {}))));
  r.delete('/proposals/:id', comWrite, ah(async (req, res) => res.json(await proposals.remove(req.ctx, req.params.id))));
  r.post('/proposals/:id/send', comWrite, ah(async (req, res) => res.json(await proposals.send(req.ctx, req.params.id, { baseUrl: baseUrl(req), enviar_email: req.body?.enviar_email }))));
  r.post('/proposals/:id/duplicate', comWrite, ah(async (req, res) => res.status(201).json(await proposals.duplicate(req.ctx, req.params.id))));
  r.post('/proposals/:id/convert', ctWrite, ah(async (req, res) => res.json(await proposals.convert(req.ctx, req.params.id, req.body || {}))));

  // Equipe e horas
  r.get('/time-entries', ah(async (req, res) => res.json(await team.listEntries(req.ctx, req.query))));
  r.post('/time-entries', requirePerm('operacional:write'), ah(async (req, res) => res.status(201).json(await team.createEntry(req.ctx, req.body || {}))));
  r.delete('/time-entries/:id', requirePerm('operacional:write'), ah(async (req, res) => res.json(await team.removeEntry(req.ctx, req.params.id))));

  // Relatórios
  const rep = requirePerm('relatorios:read');
  r.get('/reports/dashboard', rep, ah(async (req, res) => res.json(await reports.dashboard(req.ctx, req.query))));
  r.get('/reports/dre', rep, ah(async (req, res) => res.json(await reports.dre(req.ctx, req.query))));
  r.get('/reports/contracts-margin', rep, ah(async (req, res) => res.json(await reports.contractsMargin(req.ctx, req.query))));
  r.get('/reports/clients-margin', rep, ah(async (req, res) => res.json(await reports.clientsMargin(req.ctx, req.query))));
  r.get('/reports/agency-margin', rep, ah(async (req, res) => res.json(await reports.agencyMargin(req.ctx, req.query))));
  r.get('/reports/cashflow', rep, ah(async (req, res) => res.json(await reports.cashflow(req.ctx, { ...req.query, incluir_vencidos: req.query.incluir_vencidos === 'true' }))));
  r.get('/reports/aging', rep, ah(async (req, res) => res.json(await reports.aging(req.ctx, req.query))));
  r.get('/reports/balances', rep, ah(async (req, res) => res.json(await reports.bankBalances(req.ctx))));

  // Chaves de API (MCP) e auditoria
  r.get('/api-keys', requirePerm('config:write'), ah(async (req, res) => res.json(await apiKeys.list(req.ctx))));
  r.post('/api-keys', requirePerm('config:write'), ah(async (req, res) => res.status(201).json({ ...(await apiKeys.create(req.ctx, req.body || {})), mcp_url: `${baseUrl(req)}/api/biz/mcp` })));
  r.delete('/api-keys/:id', requirePerm('config:write'), ah(async (req, res) => res.json(await apiKeys.revoke(req.ctx, req.params.id))));
  r.get('/audit', requirePerm('config:write'), ah(async (req, res) => {
    const where = { company_id: req.ctx.companyId };
    if (req.query.origem) where.origem = req.query.origem;
    if (req.query.entidade_id) where.entidade_id = req.query.entidade_id;
    res.json(await prisma.bizAuditLog.findMany({ where, orderBy: { created_date: 'desc' }, take: Math.min(parseInt(req.query.limit || '200', 10), 1000) }));
  }));

  // Tratamento de erros do módulo
  // eslint-disable-next-line no-unused-vars
  r.use((err, req, res, next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ status: err.status, message: err.message, details: err.details });
    if (err?.code === 'P2002') return res.status(409).json({ status: 409, message: 'Registro duplicado' });
    if (err?.code === 'P2025') return res.status(404).json({ status: 404, message: 'Registro não encontrado' });
    console.error('[biz]', err);
    res.status(500).json({ status: 500, message: err?.message || 'Erro interno' });
  });

  return r;
}

module.exports = { createBizRouter };
