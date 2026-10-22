// Propostas comerciais com a marca da empresa, link público, aceite online e conversão em contrato
const prisma = require('../db');
const { num, round2, sum } = require('../lib/money');
const { toDate, addDays, addMonths, today } = require('../lib/dates');
const { randomToken } = require('../lib/crypto');
const { notFound, badRequest } = require('../lib/errors');
const { audit } = require('../lib/audit');
const contracts = require('./contracts');

const INCLUDE = {
  client: { select: { id: true, nome: true, nome_fantasia: true, email: true, documento: true } },
  items: { orderBy: { ordem: 'asc' } },
};

const itemTotal = (i) => round2(num(i.quantidade) * num(i.preco_unitario) * (1 - num(i.desconto_percent) / 100));

function computeTotals(items, descontoPercent = 0) {
  const fator = 1 - num(descontoPercent) / 100;
  const rec = items.filter((i) => i.cobranca === 'RECORRENTE');
  const uni = items.filter((i) => i.cobranca !== 'RECORRENTE');
  return {
    total_recorrente: round2(sum(rec, itemTotal) * fator),
    total_unico: round2(sum(uni, itemTotal) * fator),
    custo_estimado: sum(items, (i) => num(i.quantidade) * num(i.custo_unitario)),
  };
}

const decorate = (p) => {
  const recItems = (p.items || []).filter((i) => i.cobranca === 'RECORRENTE');
  const uniItems = (p.items || []).filter((i) => i.cobranca !== 'RECORRENTE');
  const custoRec = sum(recItems, (i) => num(i.quantidade) * num(i.custo_unitario));
  const custoUni = sum(uniItems, (i) => num(i.quantidade) * num(i.custo_unitario));
  const expirada = p.validade && toDate(p.validade) < today() && ['RASCUNHO', 'ENVIADA', 'VISUALIZADA'].includes(p.status);
  return {
    ...p,
    status_efetivo: expirada ? 'EXPIRADA' : p.status,
    items: (p.items || []).map((i) => ({ ...i, total: itemTotal(i) })),
    margem_recorrente: round2(num(p.total_recorrente) - custoRec),
    margem_recorrente_percent: num(p.total_recorrente) > 0 ? Math.round(((num(p.total_recorrente) - custoRec) / num(p.total_recorrente)) * 10000) / 100 : null,
    margem_unica: round2(num(p.total_unico) - custoUni),
    valor_total_contrato: round2(num(p.total_unico) + num(p.total_recorrente) * (p.prazo_contrato_meses || 12)),
  };
};

async function list(ctx, q = {}) {
  const where = { company_id: ctx.companyId };
  if (q.status) where.status = q.status;
  if (q.client_id) where.client_id = q.client_id;
  if (q.q) where.OR = [
    { titulo: { contains: String(q.q), mode: 'insensitive' } },
    { prospect_nome: { contains: String(q.q), mode: 'insensitive' } },
    { prospect_empresa: { contains: String(q.q), mode: 'insensitive' } },
    { client: { nome: { contains: String(q.q), mode: 'insensitive' } } },
  ];
  const rows = await prisma.bizProposal.findMany({ where, include: INCLUDE, orderBy: { numero: 'desc' } });
  const items = rows.map(decorate);
  const abertas = items.filter((p) => ['ENVIADA', 'VISUALIZADA'].includes(p.status_efetivo));
  const decididas = items.filter((p) => ['ACEITA', 'RECUSADA'].includes(p.status));
  return {
    items,
    resumo: {
      pipeline_recorrente: sum(abertas, (p) => p.total_recorrente),
      pipeline_unico: sum(abertas, (p) => p.total_unico),
      abertas: abertas.length,
      taxa_conversao: decididas.length ? Math.round((items.filter((p) => p.status === 'ACEITA').length / decididas.length) * 10000) / 100 : null,
    },
  };
}

async function get(ctx, id) {
  const p = await prisma.bizProposal.findFirst({ where: { id, company_id: ctx.companyId }, include: INCLUDE });
  if (!p) throw notFound('Proposta');
  return decorate(p);
}

function normalizeItems(items = []) {
  return items.filter((i) => i && (i.descricao || i.product_id)).map((i, idx) => ({
    product_id: i.product_id || null,
    descricao: i.descricao || 'Item',
    detalhes: i.detalhes || null,
    quantidade: num(i.quantidade) || 1,
    preco_unitario: round2(i.preco_unitario),
    desconto_percent: num(i.desconto_percent),
    custo_unitario: num(i.custo_unitario),
    cobranca: i.cobranca === 'RECORRENTE' ? 'RECORRENTE' : 'UNICA',
    ordem: idx,
    _ci: !!i.cobranca,
  }));
}

// Completa itens com dados do catálogo quando só o product_id é informado
async function hydrateItems(ctx, items) {
  const ids = items.map((i) => i.product_id).filter(Boolean);
  if (!ids.length) return items;
  const prods = await prisma.bizProduct.findMany({ where: { id: { in: ids }, company_id: ctx.companyId } });
  const byId = Object.fromEntries(prods.map((p) => [p.id, p]));
  return items.map((i) => {
    const p = byId[i.product_id];
    if (!p) return { ...i, product_id: null };
    return {
      ...i,
      descricao: i.descricao && i.descricao !== 'Item' ? i.descricao : p.nome,
      detalhes: i.detalhes ?? p.descricao,
      preco_unitario: i.preco_unitario > 0 ? i.preco_unitario : num(p.preco_venda),
      custo_unitario: i.custo_unitario > 0 ? i.custo_unitario : num(p.custo_unitario),
      cobranca: i._ci ? i.cobranca : p.cobranca,
    };
  });
}

const FIELDS = ['client_id', 'prospect_nome', 'prospect_email', 'prospect_empresa', 'titulo', 'introducao', 'escopo', 'condicoes',
  'capa_url', 'validade', 'desconto_percent', 'prazo_contrato_meses', 'responsavel'];

async function create(ctx, data) {
  if (!data.titulo) throw badRequest('Informe o título da proposta');
  if (!data.client_id && !data.prospect_nome) throw badRequest('Informe o cliente ou o nome do prospect');
  if (data.client_id) {
    const ok = await prisma.bizClient.findFirst({ where: { id: data.client_id, company_id: ctx.companyId } });
    if (!ok) throw badRequest('Cliente inválido');
  }
  const company = await prisma.bizCompany.findUnique({ where: { id: ctx.companyId } });
  const clean = (await hydrateItems(ctx, normalizeItems(data.items || []))).map(({ _ci, ...i }) => i);
  const payload = {};
  for (const f of FIELDS) if (data[f] !== undefined && data[f] !== '') payload[f] = data[f];
  payload.validade = payload.validade ? toDate(payload.validade) : addDays(today(), company.proposta_validade_dias || 15);
  if (!payload.condicoes && company.proposta_termos) payload.condicoes = company.proposta_termos;

  const p = await prisma.bizProposal.create({
    data: {
      ...payload,
      ...computeTotals(clean, payload.desconto_percent),
      company_id: ctx.companyId,
      numero: await contracts.nextNumber('bizProposal', ctx.companyId),
      public_token: randomToken(18),
      created_by: ctx.userId || null,
      items: { create: clean },
    },
  });
  await audit(ctx, 'create', 'proposta', p.id, `Proposta #${p.numero} "${p.titulo}" criada`);
  return get(ctx, p.id);
}

async function update(ctx, id, data) {
  const p = await get(ctx, id);
  if (['ACEITA'].includes(p.status)) throw badRequest('Proposta aceita não pode ser alterada. Duplique para criar uma nova versão.');
  const payload = {};
  for (const f of FIELDS) if (data[f] !== undefined) payload[f] = data[f] === '' ? null : data[f];
  if (payload.validade) payload.validade = toDate(payload.validade);
  let items = p.items;
  if (Array.isArray(data.items)) {
    items = (await hydrateItems(ctx, normalizeItems(data.items))).map(({ _ci, ...i }) => i);
    await prisma.bizProposalItem.deleteMany({ where: { proposal_id: id } });
    if (items.length) await prisma.bizProposalItem.createMany({ data: items.map((i) => ({ ...i, proposal_id: id })) });
  }
  const descontoP = payload.desconto_percent !== undefined ? payload.desconto_percent : p.desconto_percent;
  await prisma.bizProposal.update({ where: { id }, data: { ...payload, ...computeTotals(items, descontoP) } });
  await audit(ctx, 'update', 'proposta', id, `Proposta #${p.numero} atualizada`);
  return get(ctx, id);
}

async function remove(ctx, id) {
  const p = await get(ctx, id);
  if (p.status === 'ACEITA') throw badRequest('Proposta aceita não pode ser excluída');
  await prisma.bizProposal.delete({ where: { id } });
  await audit(ctx, 'delete', 'proposta', id, `Proposta #${p.numero} excluída`);
  return { success: true };
}

async function send(ctx, id, { baseUrl, enviar_email } = {}) {
  const p = await get(ctx, id);
  if (!p.items.length) throw badRequest('Adicione ao menos um item antes de enviar');
  const status = ['RASCUNHO', 'EXPIRADA'].includes(p.status) || p.status_efetivo === 'EXPIRADA' ? 'ENVIADA' : p.status;
  const patch = { status, enviada_em: p.enviada_em || new Date() };
  if (p.status_efetivo === 'EXPIRADA') {
    const company = await prisma.bizCompany.findUnique({ where: { id: ctx.companyId } });
    patch.validade = addDays(today(), company.proposta_validade_dias || 15);
  }
  await prisma.bizProposal.update({ where: { id }, data: patch });
  const link = `${baseUrl || ''}/proposta/${p.public_token}`;
  const email = p.client?.email || p.prospect_email;
  let emailEnviado = false;
  if (enviar_email && email && process.env.RESEND_API_KEY) {
    try {
      const company = await prisma.bizCompany.findUnique({ where: { id: ctx.companyId } });
      const { Resend } = require('resend');
      await new Resend(process.env.RESEND_API_KEY).emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'Freedom Empresas <onboarding@resend.dev>',
        to: email,
        subject: `${company.nome_fantasia || company.razao_social} — Proposta: ${p.titulo}`,
        html: `<p>Olá${p.client?.nome || p.prospect_nome ? `, ${p.client?.nome || p.prospect_nome}` : ''}!</p><p>Preparamos a proposta <b>${p.titulo}</b> para você.</p><p><a href="${link}" style="background:${company.cor_secundaria};color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Ver proposta</a></p><p>Qualquer dúvida, é só responder este e-mail.</p>`,
      });
      emailEnviado = true;
    } catch (e) { console.error('[biz] e-mail proposta:', e.message); }
  }
  await audit(ctx, 'send', 'proposta', id, `Proposta #${p.numero} enviada${emailEnviado ? ` por e-mail para ${email}` : ''}`);
  return { ...(await get(ctx, id)), link, email_enviado: emailEnviado };
}

async function duplicate(ctx, id) {
  const p = await get(ctx, id);
  return create(ctx, {
    ...Object.fromEntries(FIELDS.map((f) => [f, p[f]])),
    validade: undefined,
    titulo: `${p.titulo} (v2)`,
    items: p.items.map((i) => ({ ...i, id: undefined, proposal_id: undefined })),
  });
}

/** Converte proposta aceita (ou fechada fora do sistema) em contrato. */
async function convert(ctx, id, { ativar = false, ...overrides } = {}) {
  const p = await get(ctx, id);
  if (p.contract_id) return contracts.get(ctx, p.contract_id);
  let clientId = p.client_id;
  if (!clientId) {
    const c = await prisma.bizClient.create({
      data: {
        company_id: ctx.companyId, nome: p.aceite_nome || p.prospect_empresa || p.prospect_nome,
        nome_fantasia: p.prospect_empresa || null, email: p.prospect_email || null,
        documento: p.aceite_documento ? String(p.aceite_documento).replace(/\D/g, '') : null,
        tipo_pessoa: p.aceite_documento && String(p.aceite_documento).replace(/\D/g, '').length === 11 ? 'PF' : 'PJ',
        contato_nome: p.prospect_nome || null, origem: 'Proposta', status: 'ATIVO',
      },
    });
    clientId = c.id;
    await prisma.bizProposal.update({ where: { id }, data: { client_id: clientId } });
  } else {
    await prisma.bizClient.update({ where: { id: clientId }, data: { status: 'ATIVO' } });
  }
  const fator = 1 - num(p.desconto_percent) / 100;
  const contract = await contracts.create(ctx, {
    client_id: clientId,
    proposal_id: p.id,
    titulo: p.titulo,
    data_fim: p.prazo_contrato_meses ? addMonths(today(), p.prazo_contrato_meses) : undefined,
    items: p.items.map((i) => ({
      product_id: i.product_id, descricao: i.descricao, quantidade: i.quantidade,
      preco_unitario: round2(num(i.preco_unitario) * (1 - num(i.desconto_percent) / 100) * fator),
      custo_unitario: i.custo_unitario, cobranca: i.cobranca,
    })),
    ...overrides,
    ativar,
    status: ativar ? 'ATIVO' : 'RASCUNHO',
  });
  await prisma.bizProposal.update({ where: { id }, data: { contract_id: contract.id, status: 'ACEITA', respondida_em: p.respondida_em || new Date() } });
  await audit(ctx, 'convert', 'proposta', id, `Proposta #${p.numero} convertida no contrato #${contract.numero}`);
  return contract;
}

// ── Público (link compartilhável) — nunca expõe custos ou margens ──
async function findByToken(token) {
  const p = await prisma.bizProposal.findUnique({ where: { public_token: String(token) }, include: { ...INCLUDE, company: true } });
  if (!p) throw notFound('Proposta');
  return p;
}

function publicShape(p) {
  const d = decorate(p);
  const c = p.company;
  return {
    numero: d.numero, titulo: d.titulo, introducao: d.introducao, escopo: d.escopo, condicoes: d.condicoes, capa_url: d.capa_url,
    status: d.status_efetivo, validade: d.validade, desconto_percent: d.desconto_percent, prazo_contrato_meses: d.prazo_contrato_meses,
    total_unico: d.total_unico, total_recorrente: d.total_recorrente, created_date: d.created_date, responsavel: d.responsavel,
    cliente: d.client ? { nome: d.client.nome_fantasia || d.client.nome } : { nome: d.prospect_empresa || d.prospect_nome },
    aceite_nome: d.aceite_nome, respondida_em: d.respondida_em,
    items: d.items.map((i) => ({ descricao: i.descricao, detalhes: i.detalhes, quantidade: i.quantidade, preco_unitario: i.preco_unitario, desconto_percent: i.desconto_percent, cobranca: i.cobranca, total: i.total })),
    empresa: {
      nome: c.nome_fantasia || c.razao_social, razao_social: c.razao_social, cnpj: c.cnpj, email: c.email, telefone: c.telefone, site: c.site,
      logo_url: c.logo_url, cor_primaria: c.cor_primaria, cor_secundaria: c.cor_secundaria, rodape: c.proposta_rodape,
    },
  };
}

async function publicView(token, { ip, track = true } = {}) {
  const p = await findByToken(token);
  if (track && p.status !== 'RASCUNHO') {
    await prisma.bizProposal.update({
      where: { id: p.id },
      data: { visualizacoes: { increment: 1 }, ultima_visualizacao: new Date(), ...(p.status === 'ENVIADA' && { status: 'VISUALIZADA' }) },
    });
    if (p.status === 'ENVIADA') {
      await audit({ companyId: p.company_id, origem: 'PUBLICO' }, 'view', 'proposta', p.id, `Proposta #${p.numero} visualizada pelo cliente${ip ? ` (${ip})` : ''}`);
      p.status = 'VISUALIZADA';
    }
  }
  return publicShape(p);
}

async function publicAccept(token, { nome, documento }, ip) {
  const p = await findByToken(token);
  if (!nome) throw badRequest('Informe seu nome para aceitar');
  const d = decorate(p);
  if (d.status_efetivo === 'EXPIRADA') throw badRequest('Esta proposta expirou. Peça uma nova versão.');
  if (!['ENVIADA', 'VISUALIZADA'].includes(p.status)) throw badRequest('Esta proposta não está disponível para aceite');
  await prisma.bizProposal.update({
    where: { id: p.id },
    data: { status: 'ACEITA', respondida_em: new Date(), aceite_nome: nome, aceite_documento: documento || null, aceite_ip: ip || null },
  });
  const ctx = { companyId: p.company_id, userId: p.created_by, origem: 'PUBLICO' };
  await audit(ctx, 'accept', 'proposta', p.id, `Proposta #${p.numero} ACEITA por ${nome}${documento ? ` (${documento})` : ''}`);
  // Gera o contrato em rascunho para o financeiro revisar e ativar a cobrança
  try { await convert(ctx, p.id, { ativar: false }); } catch (e) { console.error('[biz] conversão automática:', e.message); }
  return publicView(token, { track: false });
}

async function publicReject(token, { motivo }) {
  const p = await findByToken(token);
  if (!['ENVIADA', 'VISUALIZADA'].includes(p.status)) throw badRequest('Esta proposta não está disponível');
  await prisma.bizProposal.update({ where: { id: p.id }, data: { status: 'RECUSADA', respondida_em: new Date(), motivo_recusa: motivo || null } });
  await audit({ companyId: p.company_id, origem: 'PUBLICO' }, 'reject', 'proposta', p.id, `Proposta #${p.numero} recusada${motivo ? `: ${motivo}` : ''}`);
  return publicView(token, { track: false });
}

module.exports = { list, get, create, update, remove, send, duplicate, convert, publicView, publicAccept, publicReject, computeTotals };
