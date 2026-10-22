// Produtos e serviços + controle de estoque com custo médio ponderado
const prisma = require('../db');
const { num, round2, round4 } = require('../lib/money');
const { toDate } = require('../lib/dates');
const { notFound, badRequest } = require('../lib/errors');
const { audit } = require('../lib/audit');

const FIELDS = ['tipo', 'codigo', 'nome', 'descricao', 'categoria', 'unidade', 'preco_venda', 'custo_unitario', 'horas_estimadas',
  'cobranca', 'periodicidade', 'controla_estoque', 'estoque_minimo', 'account_id', 'ativo'];

const decorate = (p) => {
  const preco = num(p.preco_venda);
  const custo = num(p.custo_unitario);
  return {
    ...p,
    margem_unitaria: round2(preco - custo),
    margem_percent: preco > 0 ? Math.round(((preco - custo) / preco) * 10000) / 100 : 0,
    estoque_baixo: p.controla_estoque && num(p.estoque_atual) <= num(p.estoque_minimo),
    valor_em_estoque: p.controla_estoque ? round2(num(p.estoque_atual) * custo) : 0,
  };
};

async function list(ctx, q = {}) {
  const where = { company_id: ctx.companyId };
  if (q.tipo) where.tipo = q.tipo;
  if (q.ativo !== undefined) where.ativo = q.ativo === 'true' || q.ativo === true;
  if (q.cobranca) where.cobranca = q.cobranca;
  if (q.q) where.OR = ['nome', 'codigo', 'categoria'].map((f) => ({ [f]: { contains: String(q.q), mode: 'insensitive' } }));
  const rows = await prisma.bizProduct.findMany({ where, orderBy: { nome: 'asc' }, include: { account: { select: { id: true, nome: true, codigo: true } } } });
  let items = rows.map(decorate);
  if (q.estoque_baixo === 'true' || q.estoque_baixo === true) items = items.filter((p) => p.estoque_baixo);
  return items;
}

async function get(ctx, id) {
  const p = await prisma.bizProduct.findFirst({ where: { id, company_id: ctx.companyId }, include: { account: true } });
  if (!p) throw notFound('Produto/serviço');
  return decorate(p);
}

async function create(ctx, data) {
  if (!data.nome) throw badRequest('Informe o nome');
  const payload = {};
  for (const f of FIELDS) if (data[f] !== undefined && data[f] !== '') payload[f] = data[f];
  if (payload.tipo === 'SERVICO') payload.controla_estoque = false;
  const p = await prisma.bizProduct.create({ data: { ...payload, company_id: ctx.companyId } });
  if (p.controla_estoque && num(data.estoque_inicial) > 0) {
    await moveStock(ctx, p.id, { tipo: 'ENTRADA', quantidade: data.estoque_inicial, custo_unitario: data.custo_unitario, observacao: 'Estoque inicial' });
  }
  await audit(ctx, 'create', 'produto', p.id, `${p.tipo === 'SERVICO' ? 'Serviço' : 'Produto'} "${p.nome}" cadastrado`);
  return get(ctx, p.id);
}

async function update(ctx, id, data) {
  await get(ctx, id);
  const payload = {};
  for (const f of FIELDS) if (data[f] !== undefined) payload[f] = data[f] === '' ? null : data[f];
  const p = await prisma.bizProduct.update({ where: { id }, data: payload });
  await audit(ctx, 'update', 'produto', id, `Produto/serviço "${p.nome}" atualizado`, Object.keys(payload));
  return decorate(p);
}

async function remove(ctx, id) {
  const p = await get(ctx, id);
  const used = await prisma.bizContractItem.count({ where: { product_id: id } }) + await prisma.bizProposalItem.count({ where: { product_id: id } }) + await prisma.bizStockMovement.count({ where: { product_id: id } });
  if (used) {
    await prisma.bizProduct.update({ where: { id }, data: { ativo: false } });
    return { success: true, inativado: true };
  }
  await prisma.bizProduct.delete({ where: { id } });
  await audit(ctx, 'delete', 'produto', id, `Produto/serviço "${p.nome}" excluído`);
  return { success: true };
}

/**
 * Movimenta estoque.
 * ENTRADA: recalcula custo médio ponderado. SAIDA: baixa ao custo médio atual
 * (e, se tiver contract_id, vira custo direto do contrato). AJUSTE: define o saldo final.
 */
async function moveStock(ctx, productId, data) {
  const tipo = data.tipo;
  if (!['ENTRADA', 'SAIDA', 'AJUSTE'].includes(tipo)) throw badRequest('tipo deve ser ENTRADA, SAIDA ou AJUSTE');
  const qtd = round4(data.quantidade);
  if (tipo !== 'AJUSTE' && !(qtd > 0)) throw badRequest('Quantidade deve ser maior que zero');
  if (data.contract_id) {
    const c = await prisma.bizContract.findFirst({ where: { id: data.contract_id, company_id: ctx.companyId } });
    if (!c) throw badRequest('Contrato inválido');
  }

  return prisma.$transaction(async (tx) => {
    const p = await tx.bizProduct.findFirst({ where: { id: productId, company_id: ctx.companyId } });
    if (!p) throw notFound('Produto');
    if (!p.controla_estoque) throw badRequest('Este item não controla estoque');
    const saldo = num(p.estoque_atual);
    const cm = num(p.custo_unitario);
    let novoSaldo = saldo;
    let novoCm = cm;
    let custoMov = cm;

    if (tipo === 'ENTRADA') {
      custoMov = data.custo_unitario !== undefined && data.custo_unitario !== '' ? round4(data.custo_unitario) : cm;
      novoSaldo = round4(saldo + qtd);
      novoCm = novoSaldo > 0 ? round4((Math.max(saldo, 0) * cm + qtd * custoMov) / (Math.max(saldo, 0) + qtd)) : custoMov;
    } else if (tipo === 'SAIDA') {
      if (qtd > saldo && !data.permitir_negativo) throw badRequest(`Estoque insuficiente de "${p.nome}" (saldo ${saldo})`);
      novoSaldo = round4(saldo - qtd);
    } else {
      novoSaldo = round4(data.quantidade);
    }

    const mov = await tx.bizStockMovement.create({
      data: {
        company_id: ctx.companyId, product_id: productId, tipo,
        quantidade: tipo === 'AJUSTE' ? Math.abs(round4(novoSaldo - saldo)) : qtd,
        custo_unitario: custoMov, saldo_apos: novoSaldo, custo_medio_apos: novoCm,
        contract_id: data.contract_id || null, documento: data.documento || null, observacao: data.observacao || null,
        data: toDate(data.data) || new Date(), created_by: ctx.userId || null,
      },
    });
    await tx.bizProduct.update({ where: { id: productId }, data: { estoque_atual: novoSaldo, custo_unitario: novoCm } });
    await audit(ctx, 'stock', 'produto', productId, `${tipo} de ${qtd} ${p.unidade} em "${p.nome}" → saldo ${novoSaldo}`);
    return mov;
  });
}

async function listMovements(ctx, q = {}) {
  const where = { company_id: ctx.companyId };
  if (q.product_id) where.product_id = q.product_id;
  if (q.contract_id) where.contract_id = q.contract_id;
  return prisma.bizStockMovement.findMany({
    where, orderBy: { data: 'desc' }, take: Math.min(parseInt(q.limit || '300', 10), 2000),
    include: { product: { select: { id: true, nome: true, unidade: true } }, contract: { select: { id: true, numero: true, titulo: true } } },
  });
}

module.exports = { list, get, create, update, remove, moveStock, listMovements, decorate };
