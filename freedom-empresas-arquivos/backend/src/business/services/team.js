// Apontamento de horas — transforma o custo da equipe em custo direto dos contratos
const prisma = require('../db');
const { num, round2 } = require('../lib/money');
const { toDate, today } = require('../lib/dates');
const { notFound, badRequest } = require('../lib/errors');
const { audit } = require('../lib/audit');
const { custoHora } = require('./registry');

async function listTeam(ctx) {
  const rows = await prisma.bizTeamMember.findMany({ where: { company_id: ctx.companyId }, orderBy: { nome: 'asc' } });
  return rows.map((m) => ({ ...m, custo_hora: custoHora(m) }));
}

async function listEntries(ctx, q = {}) {
  const where = { company_id: ctx.companyId };
  if (q.contract_id) where.contract_id = q.contract_id;
  if (q.team_member_id) where.team_member_id = q.team_member_id;
  if (q.from || q.to) {
    where.data = {};
    if (q.from) where.data.gte = toDate(q.from);
    if (q.to) where.data.lte = toDate(q.to);
  }
  const rows = await prisma.bizTimeEntry.findMany({
    where, orderBy: { data: 'desc' }, take: Math.min(parseInt(q.limit || '500', 10), 5000),
    include: { teamMember: { select: { id: true, nome: true, cargo: true } }, contract: { select: { id: true, numero: true, titulo: true } } },
  });
  return rows.map((r) => ({ ...r, custo_total: round2(num(r.horas) * num(r.custo_hora)) }));
}

async function createEntry(ctx, data) {
  if (!data.team_member_id) throw badRequest('Informe o colaborador');
  const horas = num(data.horas);
  if (!(horas > 0) || horas > 24 * 31) throw badRequest('Horas inválidas');
  const m = await prisma.bizTeamMember.findFirst({ where: { id: data.team_member_id, company_id: ctx.companyId } });
  if (!m) throw badRequest('Colaborador inválido');
  if (data.contract_id) {
    const c = await prisma.bizContract.findFirst({ where: { id: data.contract_id, company_id: ctx.companyId } });
    if (!c) throw badRequest('Contrato inválido');
  }
  const e = await prisma.bizTimeEntry.create({
    data: {
      company_id: ctx.companyId, team_member_id: m.id, contract_id: data.contract_id || null,
      data: toDate(data.data) || today(), horas, custo_hora: custoHora(m), descricao: data.descricao || null, created_by: ctx.userId || null,
    },
  });
  await audit(ctx, 'create', 'apontamento', e.id, `${horas}h de ${m.nome}${data.contract_id ? ' em contrato' : ' (interno)'}`);
  return e;
}

async function removeEntry(ctx, id) {
  const e = await prisma.bizTimeEntry.findFirst({ where: { id, company_id: ctx.companyId } });
  if (!e) throw notFound('Apontamento');
  await prisma.bizTimeEntry.delete({ where: { id } });
  await audit(ctx, 'delete', 'apontamento', id, `Apontamento de ${e.horas}h removido`);
  return { success: true };
}

module.exports = { listTeam, listEntries, createEntry, removeEntry };
