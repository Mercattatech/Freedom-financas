// Contratos recorrentes (assinaturas) e pontuais (projetos), com faturamento automático
const prisma = require('../db');
const { num, round2, splitInstallments, sum } = require('../lib/money');
const { toDate, startOfMonth, addMonths, today, withDay, cycleMonths, ym } = require('../lib/dates');
const { notFound, badRequest } = require('../lib/errors');
const { audit } = require('../lib/audit');
const { AsaasClient } = require('./asaas');
const tx = require('./transactions');
const { DEFAULT_ACCOUNTS } = require('./seed');

const INCLUDE = {
  client: { select: { id: true, nome: true, nome_fantasia: true, documento: true, email: true } },
  items: { include: { product: { select: { id: true, nome: true, tipo: true, account_id: true } } } },
  costCenter: { select: { id: true, nome: true } },
};

const mrrDe = (c) => (c.tipo === 'RECORRENTE' && ['ATIVO'].includes(c.status) ? round2(num(c.valor_recorrente) / cycleMonths(c.periodicidade)) : 0);
const mensalDe = (c) => (c.tipo === 'RECORRENTE' ? round2(num(c.valor_recorrente) / cycleMonths(c.periodicidade)) : 0);

const decorate = (c) => {
  const mensal = mensalDe(c);
  const custo = num(c.custo_previsto_mensal);
  return {
    ...c,
    mrr: mrrDe(c),
    valor_mensal: mensal,
    valor_anual: round2(mensal * 12),
    margem_prevista_mensal: c.tipo === 'RECORRENTE' ? round2(mensal - custo) : null,
    margem_prevista_percent: mensal > 0 ? Math.round(((mensal - custo) / mensal) * 10000) / 100 : null,
  };
};

async function nextNumber(model, companyId) {
  const last = await prisma[model].findFirst({ where: { company_id: companyId }, orderBy: { numero: 'desc' }, select: { numero: true } });
  return (last?.numero || 0) + 1;
}

async function list(ctx, q = {}) {
  const where = { company_id: ctx.companyId };
  if (q.status) where.status = q.status;
  if (q.tipo) where.tipo = q.tipo;
  if (q.client_id) where.client_id = q.client_id;
  if (q.q) where.OR = [{ titulo: { contains: String(q.q), mode: 'insensitive' } }, { client: { nome: { contains: String(q.q), mode: 'insensitive' } } }];
  const rows = await prisma.bizContract.findMany({ where, include: INCLUDE, orderBy: [{ status: 'asc' }, { numero: 'desc' }] });
  const items = rows.map(decorate);
  return {
    items,
    resumo: {
      ativos: items.filter((c) => c.status === 'ATIVO').length,
      mrr: sum(items, (c) => c.mrr),
      arr: round2(sum(items, (c) => c.mrr) * 12),
      ticket_medio: items.filter((c) => c.mrr > 0).length ? round2(sum(items, (c) => c.mrr) / items.filter((c) => c.mrr > 0).length) : 0,
    },
  };
}

async function get(ctx, id) {
  const c = await prisma.bizContract.findFirst({ where: { id, company_id: ctx.companyId }, include: INCLUDE });
  if (!c) throw notFound('Contrato');
  return decorate(c);
}

function normalizeItems(items = []) {
  return items.filter((i) => i && (i.descricao || i.product_id)).map((i) => ({
    product_id: i.product_id || null,
    descricao: i.descricao || 'Item',
    quantidade: num(i.quantidade) || 1,
    preco_unitario: round2(i.preco_unitario),
    custo_unitario: num(i.custo_unitario),
    cobranca: i.cobranca === 'UNICA' ? 'UNICA' : 'RECORRENTE',
  }));
}

function totalsFromItems(items) {
  const rec = items.filter((i) => i.cobranca === 'RECORRENTE');
  const uni = items.filter((i) => i.cobranca === 'UNICA');
  return {
    valor_recorrente: sum(rec, (i) => num(i.quantidade) * num(i.preco_unitario)),
    valor_pontual: sum(uni, (i) => num(i.quantidade) * num(i.preco_unitario)),
    custo_previsto_mensal: sum(rec, (i) => num(i.quantidade) * num(i.custo_unitario)),
  };
}

const FIELDS = ['titulo', 'tipo', 'data_inicio', 'data_fim', 'periodicidade', 'dia_vencimento', 'valor_recorrente', 'valor_pontual',
  'parcelas_pontual', 'custo_previsto_mensal', 'horas_previstas_mensal', 'aliquota_imposto', 'comissao_percent', 'forma_pagamento',
  'cobrar_via_asaas', 'indice_reajuste', 'data_reajuste', 'cost_center_id', 'responsavel', 'observacoes', 'client_id'];

function pickFields(data) {
  const out = {};
  for (const f of FIELDS) if (data[f] !== undefined) out[f] = data[f] === '' ? null : data[f];
  for (const f of ['data_inicio', 'data_fim', 'data_reajuste']) if (out[f]) out[f] = toDate(out[f]);
  return out;
}

async function create(ctx, data) {
  if (!data.client_id) throw badRequest('Informe o cliente');
  const client = await prisma.bizClient.findFirst({ where: { id: data.client_id, company_id: ctx.companyId } });
  if (!client) throw badRequest('Cliente inválido');
  const items = normalizeItems(data.items);
  const payload = pickFields(data);
  const tot = items.length ? totalsFromItems(items) : {};
  if (items.length) {
    if (data.valor_recorrente === undefined) payload.valor_recorrente = tot.valor_recorrente;
    if (data.valor_pontual === undefined) payload.valor_pontual = tot.valor_pontual;
    if (data.custo_previsto_mensal === undefined) payload.custo_previsto_mensal = tot.custo_previsto_mensal;
  }
  payload.tipo = payload.tipo || (num(payload.valor_recorrente) > 0 ? 'RECORRENTE' : 'PONTUAL');
  if (!payload.titulo) payload.titulo = `${payload.tipo === 'RECORRENTE' ? 'Contrato recorrente' : 'Projeto'} — ${client.nome_fantasia || client.nome}`;
  payload.data_inicio = payload.data_inicio || today();
  if (payload.tipo === 'RECORRENTE' && !(num(payload.valor_recorrente) > 0)) throw badRequest('Contrato recorrente precisa de valor recorrente');
  if (payload.tipo === 'PONTUAL' && !(num(payload.valor_pontual) > 0)) throw badRequest('Contrato pontual precisa de valor');

  const company = await prisma.bizCompany.findUnique({ where: { id: ctx.companyId } });
  if (payload.cobrar_via_asaas === undefined) payload.cobrar_via_asaas = !!company.asaas_api_key;

  const contract = await prisma.bizContract.create({
    data: {
      ...payload,
      company_id: ctx.companyId,
      numero: await nextNumber('bizContract', ctx.companyId),
      status: 'RASCUNHO',
      proposal_id: data.proposal_id || null,
      created_by: ctx.userId || null,
      items: { create: items },
    },
  });
  await audit(ctx, 'create', 'contrato', contract.id, `Contrato #${contract.numero} "${contract.titulo}" criado`);
  if (data.ativar !== false && data.status !== 'RASCUNHO') return activate(ctx, contract.id);
  return get(ctx, contract.id);
}

async function update(ctx, id, data) {
  const c = await get(ctx, id);
  const payload = pickFields(data);
  delete payload.client_id;
  if (Array.isArray(data.items)) {
    const items = normalizeItems(data.items);
    const tot = totalsFromItems(items);
    await prisma.bizContractItem.deleteMany({ where: { contract_id: id } });
    if (items.length) await prisma.bizContractItem.createMany({ data: items.map((i) => ({ ...i, contract_id: id })) });
    if (data.valor_recorrente === undefined) payload.valor_recorrente = tot.valor_recorrente;
    if (data.valor_pontual === undefined) payload.valor_pontual = tot.valor_pontual;
    if (data.custo_previsto_mensal === undefined) payload.custo_previsto_mensal = tot.custo_previsto_mensal;
  }
  const upd = await prisma.bizContract.update({ where: { id }, data: payload });
  if (c.asaas_subscription_id && payload.valor_recorrente !== undefined && round2(payload.valor_recorrente) !== round2(c.valor_recorrente)) {
    const company = await prisma.bizCompany.findUnique({ where: { id: ctx.companyId } });
    await new AsaasClient(company).updateSubscription(c.asaas_subscription_id, { value: payload.valor_recorrente });
  }
  await audit(ctx, 'update', 'contrato', id, `Contrato #${upd.numero} atualizado`, Object.keys(payload));
  return get(ctx, id);
}

// Conta de receita: a do produto do 1º item, senão a padrão (recorrente/pontual)
async function revenueAccountId(ctx, contract, recorrente) {
  const fromItem = contract.items?.find((i) => (recorrente ? i.cobranca === 'RECORRENTE' : i.cobranca === 'UNICA') && i.product?.account_id);
  if (fromItem) return fromItem.product.account_id;
  const acc = await prisma.bizChartAccount.findFirst({
    where: { company_id: ctx.companyId, codigo: recorrente ? DEFAULT_ACCOUNTS.RECEITA_RECORRENTE : DEFAULT_ACCOUNTS.RECEITA_PONTUAL },
  });
  return acc?.id || null;
}

// Primeiro vencimento a partir da data de início respeitando o dia de vencimento
function firstDueDate(c) {
  const inicio = toDate(c.data_inicio);
  let d = withDay(inicio, c.dia_vencimento || 10);
  if (d < inicio) d = withDay(addMonths(startOfMonth(inicio), 1), c.dia_vencimento || 10);
  return d;
}

/** Ativa o contrato e configura o faturamento (Asaas ou títulos internos). */
async function activate(ctx, id) {
  const c = await get(ctx, id);
  if (['CANCELADO', 'ENCERRADO'].includes(c.status)) throw badRequest('Contrato encerrado/cancelado não pode ser ativado');
  const company = await prisma.bizCompany.findUnique({ where: { id: ctx.companyId } });
  const useAsaas = c.cobrar_via_asaas && !!company.asaas_api_key && c.forma_pagamento !== 'MANUAL';

  await prisma.bizContract.update({ where: { id }, data: { status: 'ATIVO' } });

  // Parte pontual (projeto ou setup) — gerada uma única vez
  if (num(c.valor_pontual) > 0) {
    const ref = `CT-${c.numero}/PONTUAL`;
    const exists = await prisma.bizTransaction.count({ where: { contract_id: id, documento: ref } });
    if (!exists) {
      const n = Math.max(1, c.parcelas_pontual || 1);
      const valores = splitInstallments(c.valor_pontual, n);
      const accountId = await revenueAccountId(ctx, c, false);
      const first = c.tipo === 'PONTUAL' ? firstDueDate(c) : withDay(today() > toDate(c.data_inicio) ? today() : c.data_inicio, c.dia_vencimento);
      for (let i = 0; i < n; i++) {
        const [t] = await tx.create(ctx, {
          tipo: 'RECEITA', descricao: `${c.titulo}${c.tipo === 'RECORRENTE' ? ' — setup' : ''}${n > 1 ? ` (${i + 1}/${n})` : ''}`,
          valor: valores[i], vencimento: addMonths(first, i), competencia: startOfMonth(c.data_inicio),
          client_id: c.client_id, contract_id: id, account_id: accountId, cost_center_id: c.cost_center_id,
          forma_pagamento: c.forma_pagamento === 'MANUAL' ? null : c.forma_pagamento, documento: ref, origem: 'CONTRATO',
        });
        if (useAsaas) {
          try { await tx.charge(ctx, t.id, { forma_pagamento: c.forma_pagamento }); } catch (e) { console.error('[biz] cobrança pontual:', e.message); }
        }
      }
    }
  }

  // Parte recorrente
  if (c.tipo === 'RECORRENTE') {
    if (useAsaas && !c.asaas_subscription_id) {
      const client = await prisma.bizClient.findUnique({ where: { id: c.client_id } });
      const customer = await tx.ensureAsaasCustomer(company, client);
      let next = firstDueDate(c);
      while (next < today()) next = addMonths(next, cycleMonths(c.periodicidade));
      const sub = await new AsaasClient(company).createSubscription({
        customer, billingType: c.forma_pagamento, value: c.valor_recorrente, nextDueDate: next,
        cycle: c.periodicidade, description: c.titulo, externalReference: `contract:${c.id}`, endDate: c.data_fim,
      });
      await prisma.bizContract.update({ where: { id }, data: { asaas_subscription_id: sub.id } });
    } else if (!useAsaas) {
      await generateRecurring(ctx, id);
    }
  }
  await audit(ctx, 'activate', 'contrato', id, `Contrato #${c.numero} ativado${useAsaas ? ' com cobrança no Asaas' : ''}`);
  return get(ctx, id);
}

/**
 * Gera os títulos a receber de contratos recorrentes faturados fora do Asaas,
 * do início do contrato (máx. 12 meses para trás) até o horizonte informado.
 */
async function generateRecurring(ctx, id, horizonMonths = 2) {
  const c = await get(ctx, id);
  if (c.tipo !== 'RECORRENTE' || c.status !== 'ATIVO' || c.asaas_subscription_id) return { criados: 0 };
  const step = cycleMonths(c.periodicidade);
  const limite = addMonths(today(), horizonMonths);
  const piso = addMonths(startOfMonth(today()), -12);
  const fim = c.data_fim ? toDate(c.data_fim) : null;
  const accountId = await revenueAccountId(ctx, c, true);
  let criados = 0;
  for (let due = firstDueDate(c); due <= limite; due = addMonths(due, step)) {
    if (fim && due > fim) break;
    if (due < piso) continue;
    const ref = `CT-${c.numero}/REC/${ym(due)}`;
    const exists = await prisma.bizTransaction.count({ where: { company_id: ctx.companyId, contract_id: id, documento: ref } });
    if (exists) continue;
    await prisma.bizTransaction.create({
      data: {
        company_id: ctx.companyId, tipo: 'RECEITA', descricao: `${c.titulo} — ${ym(due)}`, valor: c.valor_recorrente,
        vencimento: due, competencia: startOfMonth(due), client_id: c.client_id, contract_id: id, account_id: accountId,
        cost_center_id: c.cost_center_id, forma_pagamento: c.forma_pagamento === 'MANUAL' ? null : c.forma_pagamento,
        documento: ref, recorrente: true, origem: 'CONTRATO', created_by: ctx.userId || null,
      },
    });
    criados++;
  }
  return { criados };
}

async function setStatus(ctx, id, status, { motivo, data } = {}) {
  const c = await get(ctx, id);
  const company = await prisma.bizCompany.findUnique({ where: { id: ctx.companyId } });
  const asaas = c.asaas_subscription_id && company.asaas_api_key ? new AsaasClient(company) : null;
  const patch = { status };

  if (status === 'PAUSADO' && asaas) {
    try { await asaas.request('POST', `/subscriptions/${c.asaas_subscription_id}`, { status: 'INACTIVE' }); } catch (e) { console.error('[biz] pausar assinatura:', e.message); }
  }
  if (status === 'ATIVO' && c.status === 'PAUSADO' && asaas) {
    try { await asaas.request('POST', `/subscriptions/${c.asaas_subscription_id}`, { status: 'ACTIVE' }); } catch (e) { console.error('[biz] reativar assinatura:', e.message); }
  }
  if (['CANCELADO', 'ENCERRADO'].includes(status)) {
    const corte = toDate(data) || today();
    patch.cancelado_em = corte;
    patch.data_fim = c.data_fim && toDate(c.data_fim) < corte ? c.data_fim : corte;
    if (motivo) patch.motivo_cancelamento = motivo;
    if (asaas) {
      try { await asaas.deleteSubscription(c.asaas_subscription_id); } catch (e) { console.error('[biz] remover assinatura:', e.message); }
    }
    // Cancela títulos futuros em aberto
    const futuros = await prisma.bizTransaction.findMany({
      where: { contract_id: id, status: 'PENDENTE', vencimento: { gt: corte }, tipo: 'RECEITA' },
    });
    for (const t of futuros) await tx.cancel(ctx, t.id, { motivo: `Contrato ${status.toLowerCase()}` });
  }
  await prisma.bizContract.update({ where: { id }, data: patch });
  if (status === 'ATIVO' && c.status === 'RASCUNHO') return activate(ctx, id);
  await audit(ctx, 'status', 'contrato', id, `Contrato #${c.numero}: ${c.status} → ${status}${motivo ? ` (${motivo})` : ''}`);
  return get(ctx, id);
}

/** Reajuste por percentual ou novo valor. Atualiza itens, Asaas e títulos futuros. */
async function readjust(ctx, id, { percentual, novo_valor, a_partir }) {
  const c = await get(ctx, id);
  if (c.tipo !== 'RECORRENTE') throw badRequest('Reajuste se aplica a contratos recorrentes');
  const atual = num(c.valor_recorrente);
  const novo = novo_valor !== undefined ? round2(novo_valor) : round2(atual * (1 + num(percentual) / 100));
  if (!(novo > 0)) throw badRequest('Informe percentual ou novo valor');
  const fator = atual > 0 ? novo / atual : 1;
  for (const it of c.items.filter((i) => i.cobranca === 'RECORRENTE')) {
    await prisma.bizContractItem.update({ where: { id: it.id }, data: { preco_unitario: round2(num(it.preco_unitario) * fator) } });
  }
  const inicio = toDate(a_partir) || today();
  await prisma.bizContract.update({
    where: { id },
    data: {
      valor_recorrente: novo, data_reajuste: addMonths(inicio, 12),
      observacoes: `${c.observacoes || ''}\nReajuste em ${inicio.toISOString().slice(0, 10)}: R$ ${atual} → R$ ${novo}`.trim(),
    },
  });
  if (c.asaas_subscription_id) {
    const company = await prisma.bizCompany.findUnique({ where: { id: ctx.companyId } });
    await new AsaasClient(company).updateSubscription(c.asaas_subscription_id, { value: novo, updatePendingPayments: true });
  }
  await prisma.bizTransaction.updateMany({
    where: { contract_id: id, status: 'PENDENTE', recorrente: true, vencimento: { gte: inicio }, asaas_payment_id: null },
    data: { valor: novo },
  });
  await audit(ctx, 'readjust', 'contrato', id, `Contrato #${c.numero} reajustado: R$ ${atual} → R$ ${novo} (${Math.round((fator - 1) * 10000) / 100}%)`);
  return get(ctx, id);
}

async function remove(ctx, id) {
  const c = await get(ctx, id);
  const movs = await prisma.bizTransaction.count({ where: { contract_id: id, status: { not: 'CANCELADO' } } });
  if (c.status !== 'RASCUNHO' || movs) throw badRequest('Só contratos em rascunho e sem lançamentos podem ser excluídos. Use cancelar/encerrar.');
  await prisma.bizContract.delete({ where: { id } });
  await audit(ctx, 'delete', 'contrato', id, `Contrato #${c.numero} excluído`);
  return { success: true };
}

module.exports = { list, get, create, update, activate, generateRecurring, setStatus, readjust, remove, nextNumber, decorate, mrrDe, mensalDe, INCLUDE };
