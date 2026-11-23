// Contas a pagar e a receber (lançamentos), baixas, parcelamento e cobrança via Asaas
const crypto = require('crypto');
const prisma = require('../db');
const { num, round2, splitInstallments, sum } = require('../lib/money');
const { toDate, startOfMonth, addMonths, addDays, today, ym } = require('../lib/dates');
const { notFound, badRequest } = require('../lib/errors');
const { audit } = require('../lib/audit');
const { AsaasClient } = require('./asaas');
const { nextJanFirst } = require('../lib/indices');

const INCLUDE = {
  client: { select: { id: true, nome: true, nome_fantasia: true } },
  supplier: { select: { id: true, nome: true } },
  contract: { select: { id: true, numero: true, titulo: true } },
  account: { select: { id: true, codigo: true, nome: true, grupo_dre: true } },
  costCenter: { select: { id: true, nome: true } },
  bankAccount: { select: { id: true, nome: true } },
};

const saldoDe = (t) => round2(num(t.valor) + num(t.juros_multa) - num(t.desconto) - num(t.valor_pago));

function situacao(t, ref = today()) {
  if (t.status === 'CANCELADO') return 'CANCELADO';
  if (t.status === 'PAGO') return 'PAGO';
  const venc = toDate(t.vencimento);
  if (venc < ref) return t.status === 'PARCIAL' ? 'VENCIDO_PARCIAL' : 'VENCIDO';
  return t.status === 'PARCIAL' ? 'PARCIAL' : 'A_VENCER';
}

const decorate = (t) => ({ ...t, situacao: situacao(t), saldo: saldoDe(t), dias_atraso: diasAtraso(t) });
const diasAtraso = (t) => {
  if (['PAGO', 'CANCELADO'].includes(t.status)) return 0;
  const d = Math.floor((today() - toDate(t.vencimento)) / 86400000);
  return d > 0 ? d : 0;
};

function buildWhere(ctx, q = {}) {
  const where = { company_id: ctx.companyId };
  if (q.tipo) where.tipo = q.tipo;
  for (const f of ['client_id', 'supplier_id', 'contract_id', 'account_id', 'cost_center_id', 'bank_account_id', 'origem', 'nfse_status', 'asaas_status']) {
    if (q[f]) where[f] = q[f];
  }
  const campoData = q.por === 'competencia' ? 'competencia' : q.por === 'pagamento' ? 'data_pagamento' : 'vencimento';
  if (q.from || q.to) {
    where[campoData] = {};
    if (q.from) where[campoData].gte = toDate(q.from);
    if (q.to) {
      const t = toDate(q.to);
      where[campoData].lte = String(q.to).length <= 7 ? new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0, 23, 59, 59)) : new Date(t.getTime() + 86399999);
    }
  }
  const s = q.situacao;
  if (s === 'ABERTO') where.status = { in: ['PENDENTE', 'PARCIAL'] };
  else if (s === 'VENCIDO') { where.status = { in: ['PENDENTE', 'PARCIAL'] }; where.vencimento = { ...(where.vencimento || {}), lt: today() }; }
  else if (s === 'A_VENCER') { where.status = { in: ['PENDENTE', 'PARCIAL'] }; where.vencimento = { ...(where.vencimento || {}), gte: today() }; }
  else if (s === 'PAGO') where.status = 'PAGO';
  else if (s === 'CONFIRMADO') where.OR = [{ status: 'CONFIRMADO' }, { asaas_status: { in: ['CONFIRMED', 'CREDIT_CARD_CONFIRMED'] } }];
  else if (s === 'CANCELADO') where.status = 'CANCELADO';
  else if (!q.incluir_cancelados) where.status = { not: 'CANCELADO' };
  if (q.q) {
    where.OR = [
      { descricao: { contains: String(q.q), mode: 'insensitive' } },
      { documento: { contains: String(q.q), mode: 'insensitive' } },
      { nfse_numero: { contains: String(q.q), mode: 'insensitive' } },
      { client: { nome: { contains: String(q.q), mode: 'insensitive' } } },
      { supplier: { nome: { contains: String(q.q), mode: 'insensitive' } } },
    ];
  }
  return where;
}

async function list(ctx, q = {}) {
  const where = buildWhere(ctx, q);
  const take = Math.min(parseInt(q.limit || '1000', 10), 5000);
  const rows = await prisma.bizTransaction.findMany({ where, include: INCLUDE, orderBy: [{ vencimento: 'asc' }, { created_date: 'asc' }], take });
  const items = rows.map(decorate);
  const resumo = {
    quantidade: items.length,
    total: sum(items, (t) => t.valor),
    pago: sum(items, (t) => t.valor_pago),
    em_aberto: sum(items.filter((t) => !['PAGO', 'CANCELADO'].includes(t.status)), (t) => t.saldo),
    vencido: sum(items.filter((t) => t.situacao.startsWith('VENCIDO')), (t) => t.saldo),
  };
  return { items, resumo };
}

async function get(ctx, id) {
  const t = await prisma.bizTransaction.findFirst({ where: { id, company_id: ctx.companyId }, include: INCLUDE });
  if (!t) throw notFound('Lançamento');
  return decorate(t);
}

const FIELDS = ['descricao', 'valor', 'vencimento', 'competencia', 'forma_pagamento', 'documento', 'client_id', 'supplier_id',
  'contract_id', 'account_id', 'cost_center_id', 'bank_account_id', 'observacoes', 'anexo_url', 'juros_multa', 'desconto',
  'data_pagamento', 'valor_pago'];

async function assertRefs(ctx, d) {
  const checks = [
    ['client_id', 'bizClient', 'Cliente'], ['supplier_id', 'bizSupplier', 'Fornecedor'], ['contract_id', 'bizContract', 'Contrato'],
    ['account_id', 'bizChartAccount', 'Conta'], ['cost_center_id', 'bizCostCenter', 'Centro de custo'], ['bank_account_id', 'bizBankAccount', 'Conta financeira'],
  ];
  for (const [f, model, label] of checks) {
    if (d[f]) {
      const ok = await prisma[model].findFirst({ where: { id: d[f], company_id: ctx.companyId }, select: { id: true } });
      if (!ok) throw badRequest(`${label} inválido para esta empresa`);
    }
  }
}

function stepDate(baseDate, i, periodicidade = 'MENSAL') {
  if (i === 0) return baseDate;
  switch (String(periodicidade || '').toUpperCase()) {
    case 'SEMANAL': return addDays(baseDate, i * 7);
    case 'QUINZENAL': return addDays(baseDate, i * 15);
    case 'BIMESTRAL': return addMonths(baseDate, i * 2);
    case 'TRIMESTRAL': return addMonths(baseDate, i * 3);
    case 'SEMESTRAL': return addMonths(baseDate, i * 6);
    case 'ANUAL': return addMonths(baseDate, i * 12);
    case 'MENSAL':
    default:
      return addMonths(baseDate, i);
  }
}

/**
 * Cria um ou mais lançamentos.
 * - parcelas: divide o valor total em N vencimentos mensais (ou na periodicidade informada)
 * - repetir: replica o mesmo valor por N períodos (recorrência)
 */
async function create(ctx, data) {
  const tipo = data.tipo;
  if (!['RECEITA', 'DESPESA'].includes(tipo)) throw badRequest('tipo deve ser RECEITA ou DESPESA');

  // Se for criação de assinatura Asaas direta
  if (tipo === 'RECEITA' && (data.modo === 'ASSINATURA_ASAAS' || data.is_subscription)) {
    const res = await createSubscription(ctx, data);
    return res.transactions;
  }

  if (!data.descricao) throw badRequest('Informe a descrição');
  const valor = round2(data.valor);
  if (!(valor > 0)) throw badRequest('Informe um valor maior que zero');
  const venc = toDate(data.vencimento);
  if (!venc) throw badRequest('Informe o vencimento (AAAA-MM-DD)');
  await assertRefs(ctx, data);

  // Contrato informado sem cliente: herda o cliente
  if (data.contract_id && !data.client_id && tipo === 'RECEITA') {
    const c = await prisma.bizContract.findUnique({ where: { id: data.contract_id }, select: { client_id: true } });
    data.client_id = c?.client_id;
  }

  const parcelas = Math.max(1, Math.min(parseInt(data.parcelas || 1, 10), 120));
  const repetir = Math.max(1, Math.min(parseInt(data.repetir || 1, 10), 120));
  const periodicidade = data.periodicidade || 'MENSAL';
  const n = parcelas > 1 ? parcelas : repetir;
  const valores = parcelas > 1 ? splitInstallments(valor, parcelas) : Array(n).fill(valor);
  const grupo = n > 1 ? crypto.randomUUID() : null;
  const competenciaBase = data.competencia ? startOfMonth(data.competencia) : startOfMonth(venc);

  const base = {};
  for (const f of FIELDS) if (data[f] !== undefined && data[f] !== '') base[f] = data[f];
  delete base.valor; delete base.vencimento; delete base.competencia;

  const created = [];
  for (let i = 0; i < n; i++) {
    const dueDate = stepDate(venc, i, periodicidade);
    const compDate = parcelas > 1 ? competenciaBase : startOfMonth(dueDate);
    const t = await prisma.bizTransaction.create({
      data: {
        ...base,
        company_id: ctx.companyId,
        tipo,
        descricao: parcelas > 1 ? `${data.descricao} (${i + 1}/${parcelas})` : data.descricao,
        valor: valores[i],
        vencimento: dueDate,
        competencia: compDate,
        parcela: parcelas > 1 ? i + 1 : (n > 1 ? i + 1 : null),
        total_parcelas: parcelas > 1 ? parcelas : (n > 1 ? n : null),
        grupo_parcelas: grupo,
        recorrente: repetir > 1 || Boolean(data.recorrente),
        origem: data.origem || (ctx.origem === 'MCP' ? 'MCP' : 'MANUAL'),
        created_by: ctx.userId || null,
      },
    });
    created.push(t);
  }
  await audit(ctx, 'create', tipo === 'RECEITA' ? 'conta_receber' : 'conta_pagar', created[0].id,
    `${tipo === 'RECEITA' ? 'Conta a receber' : 'Conta a pagar'} "${data.descricao}" — ${n}x — R$ ${valor}${repetir > 1 ? ' (recorrente)' : ''}`);

  // Baixa imediata da primeira ocorrência (ex.: despesa paga no ato; as recorrências seguintes ficam em aberto)
  if (data.pago) {
    await pay(ctx, created[0].id, { data_pagamento: data.data_pagamento || created[0].vencimento, bank_account_id: data.bank_account_id });
  }
  // Emissão de cobrança no Asaas
  if (tipo === 'RECEITA' && data.cobrar_asaas) {
    for (const t of created) {
      try {
        await charge(ctx, t.id, { forma_pagamento: data.forma_pagamento });
      } catch (err) {
        console.warn(`[biz] falha ao emitir cobrança Asaas para ${t.id}:`, err.message);
      }
    }
  }
  const out = await prisma.bizTransaction.findMany({ where: { id: { in: created.map((c) => c.id) } }, include: INCLUDE, orderBy: { vencimento: 'asc' } });
  return out.map(decorate);
}

/**
 * Cria uma assinatura recorrente no Asaas diretamente pelo módulo de Contas a Receber.
 * Vincula ao cliente, cria o contrato correspondente e sincroniza a primeira fatura com link de pagamento.
 */
async function createSubscription(ctx, data) {
  const company = await prisma.bizCompany.findUnique({ where: { id: ctx.companyId } });
  if (!company?.asaas_api_key) {
    throw badRequest('Integração com o Asaas não configurada. Configure sua chave em Configurações › Asaas.');
  }

  // 1. Resolução do Cliente
  let client = null;
  if (data.client_id) {
    client = await prisma.bizClient.findFirst({ where: { id: data.client_id, company_id: ctx.companyId } });
    if (!client) throw badRequest('Cliente não encontrado');
    if (data.client_data && Object.keys(data.client_data).length > 0) {
      const patch = {};
      if (data.client_data.documento) patch.documento = String(data.client_data.documento).replace(/\D/g, '');
      if (data.client_data.email) patch.email = data.client_data.email;
      if (data.client_data.telefone) patch.telefone = data.client_data.telefone;
      if (data.client_data.nome) patch.nome = data.client_data.nome;
      if (Object.keys(patch).length > 0) {
        client = await prisma.bizClient.update({ where: { id: client.id }, data: patch });
      }
    }
  } else if (data.client_data) {
    if (!data.client_data.nome) throw badRequest('Informe o nome do cliente');
    const cleanDoc = String(data.client_data.documento || '').replace(/\D/g, '');
    if (!cleanDoc || cleanDoc.length < 11) {
      throw badRequest('O Asaas exige CPF ou CNPJ do cliente para criar assinaturas');
    }
    client = await prisma.bizClient.create({
      data: {
        company_id: ctx.companyId,
        nome: data.client_data.nome,
        documento: cleanDoc,
        email: data.client_data.email || null,
        telefone: data.client_data.telefone || null,
      },
    });
  } else {
    throw badRequest('Informe o cliente para criar a assinatura no Asaas');
  }

  if (!client.documento) {
    throw badRequest(`Cadastre o CPF/CNPJ do cliente ${client.nome} para criar a assinatura no Asaas`);
  }

  // 2. Garante o cliente no Asaas
  const customerId = await ensureAsaasCustomer(company, client);

  // 3. Validação dos dados da assinatura
  const valor = round2(data.valor);
  if (!(valor > 0)) throw badRequest('Informe um valor maior que zero para a assinatura');
  const venc = toDate(data.vencimento) || today();
  const periodicidade = (data.periodicidade || 'MENSAL').toUpperCase();
  const forma = data.forma_pagamento || 'UNDEFINED';
  const titulo = data.descricao || `Assinatura ${periodicidade.toLowerCase()} — ${client.nome_fantasia || client.nome}`;
  const diaVenc = venc.getUTCDate();

  // 4. Criação do Contrato
  const lastCt = await prisma.bizContract.findFirst({ where: { company_id: ctx.companyId }, orderBy: { numero: 'desc' }, select: { numero: true } });
  const numero = (lastCt?.numero || 0) + 1;

  const contract = await prisma.bizContract.create({
    data: {
      company_id: ctx.companyId,
      numero,
      titulo,
      tipo: 'RECORRENTE',
      status: 'ATIVO',
      client_id: client.id,
      valor_recorrente: valor,
      periodicidade,
      dia_vencimento: diaVenc,
      data_inicio: venc,
      data_fim: data.data_fim ? toDate(data.data_fim) : null,
      forma_pagamento: forma,
      cobrar_via_asaas: true,
      indice_reajuste: 'IPCA',
      data_reajuste: nextJanFirst(today()),
      cost_center_id: data.cost_center_id || null,
      observacoes: data.observacoes || null,
      created_by: ctx.userId || null,
    },
  });

  // 5. Criação da Assinatura no Asaas
  const asaas = new AsaasClient(company);
  const sub = await asaas.createSubscription({
    customer: customerId,
    billingType: forma,
    value: valor,
    nextDueDate: venc,
    cycle: periodicidade,
    description: titulo,
    externalReference: `contract:${contract.id}`,
    endDate: data.data_fim ? toDate(data.data_fim) : undefined,
  });

  // 6. Vincula a assinatura ao contrato
  await prisma.bizContract.update({
    where: { id: contract.id },
    data: { asaas_subscription_id: sub.id },
  });

  // 7. Sincroniza pagamentos gerados pela assinatura
  const contracts = require('./contracts');
  await contracts.syncAsaas(ctx, contract.id);

  // 8. Busca lançamentos gerados
  const createdTransactions = await prisma.bizTransaction.findMany({
    where: { contract_id: contract.id, company_id: ctx.companyId },
    include: INCLUDE,
    orderBy: { vencimento: 'asc' },
  });

  await audit(ctx, 'create', 'assinatura', sub.id, `Assinatura Asaas ${sub.id} criada para "${client.nome}" no valor de R$ ${valor} (${periodicidade})`);

  return {
    success: true,
    subscription: sub,
    contract,
    transactions: createdTransactions.map(decorate),
    primaryTransaction: createdTransactions[0] ? decorate(createdTransactions[0]) : null,
  };
}

async function update(ctx, id, data) {
  const t = await get(ctx, id);
  await assertRefs(ctx, data);
  const patch = {};
  for (const f of FIELDS) if (data[f] !== undefined) patch[f] = data[f] === '' ? null : data[f];
  if (patch.vencimento) patch.vencimento = toDate(patch.vencimento);
  if (patch.competencia) patch.competencia = startOfMonth(patch.competencia);
  if (patch.data_pagamento) patch.data_pagamento = toDate(patch.data_pagamento);
  if (patch.valor !== undefined) patch.valor = round2(patch.valor);
  if (patch.valor_pago !== undefined) patch.valor_pago = round2(patch.valor_pago);

  // Mantém a cobrança do Asaas em sincronia enquanto estiver em aberto
  if (t.asaas_payment_id && t.status === 'PENDENTE' && (patch.valor !== undefined || patch.vencimento)) {
    const company = await prisma.bizCompany.findUnique({ where: { id: ctx.companyId } });
    await new AsaasClient(company).updatePayment(t.asaas_payment_id, { value: patch.valor, dueDate: patch.vencimento, description: patch.descricao });
  }
  const upd = await prisma.bizTransaction.update({ where: { id }, data: patch, include: INCLUDE });
  // Aplicar alteração às próximas parcelas do mesmo grupo
  if (data.aplicar_proximas && t.grupo_parcelas) {
    const prox = {};
    for (const f of ['descricao', 'account_id', 'cost_center_id', 'client_id', 'supplier_id', 'contract_id', 'forma_pagamento', 'bank_account_id']) if (patch[f] !== undefined) prox[f] = patch[f];
    if (patch.valor !== undefined && t.recorrente) prox.valor = patch.valor;
    if (Object.keys(prox).length) {
      await prisma.bizTransaction.updateMany({
        where: { company_id: ctx.companyId, grupo_parcelas: t.grupo_parcelas, vencimento: { gt: t.vencimento }, status: 'PENDENTE' },
        data: prox,
      });
    }
  }
  await audit(ctx, 'update', 'lancamento', id, `Lançamento "${upd.descricao}" atualizado`, Object.keys(patch));
  return decorate(upd);
}

/** Baixa (total ou parcial). Valor padrão: saldo em aberto. */
async function pay(ctx, id, data = {}) {
  const t = await get(ctx, id);
  if (t.status === 'CANCELADO') throw badRequest('Lançamento cancelado não pode ser baixado');
  if (t.status === 'PAGO') throw badRequest('Lançamento já está pago');
  const juros = data.juros_multa !== undefined ? round2(data.juros_multa) : num(t.juros_multa);
  const desconto = data.desconto !== undefined ? round2(data.desconto) : num(t.desconto);
  const devido = round2(num(t.valor) + juros - desconto - num(t.valor_pago));
  const valorBaixa = data.valor !== undefined ? round2(data.valor) : devido;
  if (!(valorBaixa > 0)) throw badRequest('Valor da baixa deve ser maior que zero');
  const novoPago = round2(num(t.valor_pago) + valorBaixa);
  const quitado = novoPago >= round2(num(t.valor) + juros - desconto) - 0.009;

  if (data.bank_account_id) await assertRefs(ctx, { bank_account_id: data.bank_account_id });
  const upd = await prisma.bizTransaction.update({
    where: { id },
    data: {
      valor_pago: novoPago,
      juros_multa: juros,
      desconto,
      status: quitado ? 'PAGO' : 'PARCIAL',
      data_pagamento: toDate(data.data_pagamento) || today(),
      bank_account_id: data.bank_account_id || t.bank_account_id || null,
      forma_pagamento: data.forma_pagamento || t.forma_pagamento,
    },
    include: INCLUDE,
  });

  // Recebimento por fora do Asaas: informa o Asaas para não cobrar de novo
  if (t.asaas_payment_id && data.informar_asaas !== false && t.tipo === 'RECEITA' && quitado && !['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(t.asaas_status)) {
    try {
      const company = await prisma.bizCompany.findUnique({ where: { id: ctx.companyId } });
      await new AsaasClient(company).receiveInCash(t.asaas_payment_id, { paymentDate: upd.data_pagamento, value: valorBaixa });
      await prisma.bizTransaction.update({ where: { id }, data: { asaas_status: 'RECEIVED_IN_CASH' } });
    } catch (e) {
      console.error('[biz] receiveInCash falhou:', e.message);
    }
  }
  await audit(ctx, 'pay', 'lancamento', id, `Baixa de R$ ${valorBaixa} em "${t.descricao}"${quitado ? ' (quitado)' : ' (parcial)'}`);
  return decorate(upd);
}

async function reopen(ctx, id) {
  const t = await get(ctx, id);
  const upd = await prisma.bizTransaction.update({
    where: { id },
    data: { status: 'PENDENTE', valor_pago: 0, data_pagamento: null, taxa: 0 },
    include: INCLUDE,
  });
  await audit(ctx, 'reopen', 'lancamento', id, `Baixa estornada em "${t.descricao}"`);
  return decorate(upd);
}

async function cancel(ctx, id, { motivo } = {}) {
  const t = await get(ctx, id);
  if (t.status === 'PAGO') throw badRequest('Estorne a baixa antes de cancelar um lançamento pago');
  if (t.asaas_payment_id && !['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(t.asaas_status)) {
    const company = await prisma.bizCompany.findUnique({ where: { id: ctx.companyId } });
    try { await new AsaasClient(company).deletePayment(t.asaas_payment_id); } catch (e) { console.error('[biz] deletePayment:', e.message); }
  }
  const upd = await prisma.bizTransaction.update({
    where: { id },
    data: { status: 'CANCELADO', asaas_status: t.asaas_payment_id ? 'DELETED' : t.asaas_status, observacoes: motivo ? `${t.observacoes || ''}\nCancelado: ${motivo}`.trim() : t.observacoes },
    include: INCLUDE,
  });
  await audit(ctx, 'cancel', 'lancamento', id, `Lançamento "${t.descricao}" cancelado${motivo ? `: ${motivo}` : ''}`);
  return decorate(upd);
}

async function remove(ctx, id) {
  const t = await get(ctx, id);
  if (t.status === 'PAGO' || num(t.valor_pago) > 0) throw badRequest('Lançamentos com baixa não podem ser excluídos. Estorne ou cancele.');
  if (t.asaas_payment_id) await cancel(ctx, id);
  await prisma.bizTransaction.delete({ where: { id } });
  await audit(ctx, 'delete', 'lancamento', id, `Lançamento "${t.descricao}" excluído`);
  return { success: true };
}

// ── Asaas ──
async function ensureAsaasCustomer(company, client) {
  if (client.asaas_customer_id) return client.asaas_customer_id;
  if (!client.documento) throw badRequest(`Cadastre o CPF/CNPJ do cliente ${client.nome} para emitir cobrança no Asaas`);
  const asaas = new AsaasClient(company);
  const cleanDoc = String(client.documento).replace(/\D/g, '');
  try {
    const created = await asaas.createCustomer(client);
    await prisma.bizClient.update({ where: { id: client.id }, data: { asaas_customer_id: created.id } });
    return created.id;
  } catch (err) {
    try {
      const existing = await asaas.request('GET', `/customers?cpfCnpj=${cleanDoc}`);
      if (existing?.data?.[0]?.id) {
        const id = existing.data[0].id;
        await prisma.bizClient.update({ where: { id: client.id }, data: { asaas_customer_id: id } });
        return id;
      }
    } catch { /* ignora se falhar */ }
    throw err;
  }
}

async function charge(ctx, id, { forma_pagamento, client_id, client_data } = {}) {
  let t = await get(ctx, id);
  if (t.tipo !== 'RECEITA') throw badRequest('Só é possível cobrar contas a receber');
  if (t.asaas_payment_id) return t;
  if (t.status !== 'PENDENTE') throw badRequest('Lançamento não está em aberto');

  if (client_id && client_id !== t.client_id) {
    await prisma.bizTransaction.update({ where: { id }, data: { client_id } });
    t = await get(ctx, id);
  }
  if (!t.client_id) throw badRequest('Vincule um cliente ao lançamento para emitir a cobrança');

  const company = await prisma.bizCompany.findUnique({ where: { id: ctx.companyId } });
  let client = await prisma.bizClient.findUnique({ where: { id: t.client_id } });

  if (client_data && Object.keys(client_data).length > 0) {
    const patch = {};
    if (client_data.documento) patch.documento = String(client_data.documento).replace(/\D/g, '');
    if (client_data.email) patch.email = client_data.email;
    if (client_data.telefone) patch.telefone = client_data.telefone;
    if (Object.keys(patch).length > 0) {
      client = await prisma.bizClient.update({ where: { id: client.id }, data: patch });
    }
  }

  const customer = await ensureAsaasCustomer(company, client);
  const asaas = new AsaasClient(company);
  const venc = toDate(t.vencimento) < today() ? today() : t.vencimento;
  const forma = forma_pagamento || t.forma_pagamento || 'UNDEFINED';
  const p = await asaas.createPayment({
    customer, billingType: forma, value: saldoDe(t) || t.valor, dueDate: venc,
    description: t.descricao, externalReference: `tx:${t.id}`,
  });
  let pix = null;
  if (['PIX', 'UNDEFINED'].includes(forma)) {
    try { pix = (await asaas.getPixQrCode(p.id))?.payload || null; } catch { /* pix pode não estar habilitado */ }
  }
  const upd = await prisma.bizTransaction.update({
    where: { id },
    data: {
      asaas_payment_id: p.id, asaas_status: p.status, asaas_invoice_url: p.invoiceUrl || null,
      asaas_boleto_url: p.bankSlipUrl || null, asaas_pix_payload: pix, forma_pagamento: forma,
      bank_account_id: t.bank_account_id || company.asaas_conta_financeira_id || null,
    },
    include: INCLUDE,
  });
  await audit(ctx, 'charge', 'lancamento', id, `Cobrança Asaas ${p.id} emitida para "${t.descricao}"`);
  return decorate(upd);
}

/** Sincroniza status e dados da cobrança diretamente com a API do Asaas */
async function syncAsaas(ctx, id) {
  const t = await get(ctx, id);
  if (!t.asaas_payment_id) throw badRequest('Lançamento não possui cobrança emitida no Asaas');
  const company = await prisma.bizCompany.findUnique({ where: { id: ctx.companyId } });
  if (!company?.asaas_api_key) throw badRequest('Asaas não configurado');
  const asaas = new AsaasClient(company);
  const p = await asaas.getPayment(t.asaas_payment_id);

  let pix = t.asaas_pix_payload;
  if (!pix && ['PENDING', 'OVERDUE'].includes(p.status)) {
    try {
      const pixData = await asaas.getPixQrCode(p.id);
      pix = pixData?.payload || null;
    } catch { /* ignora */ }
  }

  const asaasSync = require('./asaasSync');
  await asaasSync.applyPayment(company, `PAYMENT_${p.status}`, p);
  if (pix && pix !== t.asaas_pix_payload) {
    await prisma.bizTransaction.update({ where: { id: t.id }, data: { asaas_pix_payload: pix } });
  }
  return get(ctx, id);
}

/** Baixa em massa */
async function batchPay(ctx, { ids, data_pagamento, bank_account_id, informar_asaas = true }) {
  if (!Array.isArray(ids) || !ids.length) throw badRequest('Nenhum lançamento selecionado');
  const datePay = toDate(data_pagamento) || today();
  if (bank_account_id) await assertRefs(ctx, { bank_account_id });

  const rows = await prisma.bizTransaction.findMany({
    where: { id: { in: ids }, company_id: ctx.companyId, status: { in: ['PENDENTE', 'PARCIAL'] } },
  });

  let asaasClient = null;
  if (informar_asaas) {
    try {
      const company = await prisma.bizCompany.findUnique({ where: { id: ctx.companyId } });
      if (company?.asaas_api_key) asaasClient = new AsaasClient(company);
    } catch { /* sem asaas */ }
  }

  let count = 0;
  for (const t of rows) {
    const saldo = saldoDe(t);
    await prisma.bizTransaction.update({
      where: { id: t.id },
      data: {
        valor_pago: round2(num(t.valor) + num(t.juros_multa) - num(t.desconto)),
        status: 'PAGO',
        data_pagamento: datePay,
        bank_account_id: bank_account_id || t.bank_account_id || null,
      },
    });

    if (asaasClient && t.asaas_payment_id && t.tipo === 'RECEITA' && !['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(t.asaas_status)) {
      try {
        await asaasClient.receiveInCash(t.asaas_payment_id, { paymentDate: datePay, value: saldo });
        await prisma.bizTransaction.update({ where: { id: t.id }, data: { asaas_status: 'RECEIVED_IN_CASH' } });
      } catch (err) {
        console.warn(`[batchPay] receiveInCash failed for ${t.id}:`, err.message);
      }
    }
    count++;
  }

  await audit(ctx, 'pay', 'lancamento', null, `Baixa em massa realizada em ${count} lançamentos`);
  return { ok: true, count };
}

/** Cancelamento em massa */
async function batchCancel(ctx, { ids, motivo, cancelar_asaas = false }) {
  if (!Array.isArray(ids) || !ids.length) throw badRequest('Nenhum lançamento selecionado');

  const rows = await prisma.bizTransaction.findMany({
    where: { id: { in: ids }, company_id: ctx.companyId, status: { in: ['PENDENTE', 'PARCIAL'] } },
  });

  let asaasClient = null;
  if (cancelar_asaas) {
    try {
      const company = await prisma.bizCompany.findUnique({ where: { id: ctx.companyId } });
      if (company?.asaas_api_key) asaasClient = new AsaasClient(company);
    } catch { /* sem asaas */ }
  }

  let count = 0;
  for (const t of rows) {
    await prisma.bizTransaction.update({
      where: { id: t.id },
      data: {
        status: 'CANCELADO',
        observacoes: motivo ? (t.observacoes ? `${t.observacoes}\nMotivo cancelamento: ${motivo}` : `Motivo cancelamento: ${motivo}`) : t.observacoes,
      },
    });

    if (asaasClient && t.asaas_payment_id && t.tipo === 'RECEITA' && ['PENDENTE', 'A_VENCER', 'OVERDUE'].includes(t.asaas_status)) {
      try {
        await asaasClient.deletePayment(t.asaas_payment_id);
      } catch (err) {
        console.warn(`[batchCancel] deletePayment failed for ${t.id}:`, err.message);
      }
    }
    count++;
  }

  await audit(ctx, 'cancel', 'lancamento', null, `Cancelamento em massa de ${count} lançamentos`, { motivo });
  return { ok: true, count };
}

/** Exclusão em massa (para não pagos) */
async function batchDelete(ctx, { ids }) {
  if (!Array.isArray(ids) || !ids.length) throw badRequest('Nenhum lançamento selecionado');

  const res = await prisma.bizTransaction.deleteMany({
    where: {
      id: { in: ids },
      company_id: ctx.companyId,
      status: { not: 'PAGO' },
    },
  });

  await audit(ctx, 'delete', 'lancamento', null, `Exclusão em massa de ${res.count} lançamentos`);
  return { ok: true, count: res.count };
}

/** Atualização em massa de campos (categoria, centro de custo, vencimento, conta bancária) */
async function batchUpdate(ctx, { ids, patch = {} }) {
  if (!Array.isArray(ids) || !ids.length) throw badRequest('Nenhum lançamento selecionado');

  const allowed = ['account_id', 'cost_center_id', 'bank_account_id', 'forma_pagamento'];
  const updateData = {};
  for (const f of allowed) {
    if (patch[f] !== undefined) updateData[f] = patch[f] || null;
  }
  if (patch.vencimento) updateData.vencimento = toDate(patch.vencimento);
  if (patch.competencia) updateData.competencia = startOfMonth(toDate(patch.competencia));

  if (!Object.keys(updateData).length) throw badRequest('Nenhum campo para atualizar informado');

  await assertRefs(ctx, updateData);

  const res = await prisma.bizTransaction.updateMany({
    where: { id: { in: ids }, company_id: ctx.companyId },
    data: updateData,
  });

  await audit(ctx, 'update', 'lancamento', null, `Atualização em massa em ${res.count} lançamentos`, Object.keys(updateData));
  return { ok: true, count: res.count };
}

module.exports = {
  list,
  get,
  create,
  createSubscription,
  update,
  pay,
  reopen,
  cancel,
  remove,
  charge,
  syncAsaas,
  batchPay,
  batchCancel,
  batchDelete,
  batchUpdate,
  ensureAsaasCustomer,
  decorate,
  situacao,
  saldoDe,
  INCLUDE,
  buildWhere,
};
