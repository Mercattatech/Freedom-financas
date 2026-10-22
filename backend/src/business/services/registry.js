// CRUD genérico e seguro (escopo por empresa + whitelist de campos) para cadastros simples
const prisma = require('../db');
const { notFound, badRequest } = require('../lib/errors');
const { audit } = require('../lib/audit');
const { toDate } = require('../lib/dates');

const digits = (s) => (s ? String(s).replace(/\D/g, '') : s);

const ENTITIES = {
  clients: {
    model: 'bizClient', label: 'cliente', perm: 'clientes:write',
    fields: ['tipo_pessoa', 'nome', 'nome_fantasia', 'documento', 'email', 'telefone', 'contato_nome', 'endereco', 'segmento', 'origem', 'status', 'tags', 'observacoes'],
    required: ['nome'], search: ['nome', 'nome_fantasia', 'documento', 'email'], orderBy: { nome: 'asc' },
    normalize: (d) => ({ ...d, ...(d.documento !== undefined && { documento: digits(d.documento) }) }),
    filters: ['status'],
  },
  suppliers: {
    model: 'bizSupplier', label: 'fornecedor', perm: 'cadastros:write',
    fields: ['tipo_pessoa', 'nome', 'documento', 'email', 'telefone', 'categoria', 'chave_pix', 'dados_bancarios', 'observacoes', 'ativo'],
    required: ['nome'], search: ['nome', 'documento', 'email', 'categoria'], orderBy: { nome: 'asc' },
    normalize: (d) => ({ ...d, ...(d.documento !== undefined && { documento: digits(d.documento) }) }),
    filters: ['ativo', 'categoria'],
  },
  accounts: {
    model: 'bizChartAccount', label: 'conta', perm: 'config:write',
    fields: ['codigo', 'nome', 'natureza', 'grupo_dre', 'custo_direto', 'fixa', 'ativo'],
    required: ['codigo', 'nome', 'natureza', 'grupo_dre'], search: ['nome', 'codigo'], orderBy: { codigo: 'asc' },
    filters: ['natureza', 'grupo_dre', 'ativo'],
  },
  'cost-centers': {
    model: 'bizCostCenter', label: 'centro de custo', perm: 'cadastros:write',
    fields: ['codigo', 'nome', 'tipo', 'orcamento_mensal', 'ativo'],
    required: ['nome'], search: ['nome', 'codigo'], orderBy: { nome: 'asc' }, filters: ['ativo', 'tipo'],
  },
  'bank-accounts': {
    model: 'bizBankAccount', label: 'conta financeira', perm: 'config:write',
    fields: ['nome', 'tipo', 'banco', 'saldo_inicial', 'data_saldo_inicial', 'ativo'],
    required: ['nome'], search: ['nome', 'banco'], orderBy: { nome: 'asc' }, filters: ['ativo', 'tipo'],
    normalize: (d) => ({
      ...d,
      ...(d.data_saldo_inicial && { data_saldo_inicial: toDate(d.data_saldo_inicial) }),
      // Sem data informada: o saldo inicial vale "desde sempre" (soma todas as movimentações)
      ...(!d.data_saldo_inicial && (d.data_saldo_inicial !== undefined || d.nome !== undefined) && { data_saldo_inicial: new Date('2000-01-01T00:00:00.000Z') }),
    }),
  },
  team: {
    model: 'bizTeamMember', label: 'colaborador', perm: 'cadastros:write',
    fields: ['nome', 'email', 'cargo', 'vinculo', 'custo_mensal', 'horas_mes', 'custo_hora_override', 'produtivo', 'ativo'],
    required: ['nome'], search: ['nome', 'cargo', 'email'], orderBy: { nome: 'asc' }, filters: ['ativo', 'produtivo'],
  },
};

const pick = (data, fields) => {
  const out = {};
  for (const f of fields) if (data[f] !== undefined) out[f] = data[f] === '' ? null : data[f];
  return out;
};

const parseBool = (v) => (v === 'true' ? true : v === 'false' ? false : v);

function def(entity) {
  const d = ENTITIES[entity];
  if (!d) throw notFound('Recurso');
  return d;
}

async function list(ctx, entity, query = {}) {
  const d = def(entity);
  const where = { company_id: ctx.companyId };
  for (const f of d.filters || []) if (query[f] !== undefined && query[f] !== '') where[f] = parseBool(query[f]);
  if (query.q) where.OR = d.search.map((f) => ({ [f]: { contains: String(query.q), mode: 'insensitive' } }));
  const take = Math.min(parseInt(query.limit || '500', 10), 1000);
  return prisma[d.model].findMany({ where, orderBy: d.orderBy, take });
}

async function get(ctx, entity, id) {
  const d = def(entity);
  const item = await prisma[d.model].findFirst({ where: { id, company_id: ctx.companyId } });
  if (!item) throw notFound(d.label);
  return item;
}

async function create(ctx, entity, data) {
  const d = def(entity);
  let payload = pick(data, d.fields);
  if (d.normalize) payload = d.normalize(payload);
  for (const r of d.required) if (!payload[r]) throw badRequest(`Campo obrigatório: ${r}`);
  const item = await prisma[d.model].create({ data: { ...payload, company_id: ctx.companyId } });
  await audit(ctx, 'create', d.label, item.id, `${d.label} ${item.nome || item.codigo || ''} criado`);
  return item;
}

async function update(ctx, entity, id, data) {
  const d = def(entity);
  await get(ctx, entity, id);
  let payload = pick(data, d.fields);
  if (d.normalize) payload = d.normalize(payload);
  const item = await prisma[d.model].update({ where: { id }, data: payload });
  if (entity === 'clients' && item.asaas_customer_id) {
    try {
      const company = await prisma.bizCompany.findUnique({ where: { id: ctx.companyId } });
      if (company?.asaas_api_key) {
        const { AsaasClient } = require('./asaas');
        await new AsaasClient(company).updateCustomer(item.asaas_customer_id, item);
      }
    } catch (e) {
      console.error('[biz registry asaas updateCustomer]', e.message);
    }
  }
  await audit(ctx, 'update', d.label, id, `${d.label} ${item.nome || ''} atualizado`, Object.keys(payload));
  return item;
}

async function remove(ctx, entity, id) {
  const d = def(entity);
  const item = await get(ctx, entity, id);
  try {
    await prisma[d.model].delete({ where: { id } });
  } catch (e) {
    // Registro com vínculos: inativa em vez de excluir
    if (d.fields.includes('ativo')) {
      await prisma[d.model].update({ where: { id }, data: { ativo: false } });
      await audit(ctx, 'deactivate', d.label, id, `${d.label} inativado (possui vínculos)`);
      return { success: true, inativado: true };
    }
    if (entity === 'clients') {
      await prisma.bizClient.update({ where: { id }, data: { status: 'INATIVO' } });
      return { success: true, inativado: true };
    }
    throw badRequest(`Não é possível excluir: ${d.label} possui lançamentos vinculados`);
  }
  await audit(ctx, 'delete', d.label, id, `${d.label} ${item.nome || ''} excluído`);
  return { success: true };
}

const custoHora = (m) => {
  const { num, round4 } = require('../lib/money');
  if (m.custo_hora_override && num(m.custo_hora_override) > 0) return round4(m.custo_hora_override);
  const h = num(m.horas_mes) || 160;
  return round4(num(m.custo_mensal) / h);
};

module.exports = { ENTITIES, list, get, create, update, remove, custoHora };
