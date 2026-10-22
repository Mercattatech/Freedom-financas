// Resolve nomes em IDs — LLMs costumam falar "cliente Europcar" e não um UUID
const prisma = require('../db');
const { badRequest } = require('../lib/errors');

async function resolveOne(ctx, model, label, { id, termo, fields }) {
  if (id) {
    const r = await prisma[model].findFirst({ where: { id, company_id: ctx.companyId } });
    if (!r) throw badRequest(`${label} com id ${id} não encontrado`);
    return r;
  }
  if (!termo) return null;
  const t = String(termo).trim();
  const exact = await prisma[model].findMany({
    where: { company_id: ctx.companyId, OR: fields.map((f) => ({ [f]: { equals: t, mode: 'insensitive' } })) }, take: 2,
  });
  if (exact.length === 1) return exact[0];
  const like = await prisma[model].findMany({
    where: { company_id: ctx.companyId, OR: fields.map((f) => ({ [f]: { contains: t, mode: 'insensitive' } })) }, take: 6,
  });
  if (like.length === 1) return like[0];
  if (!like.length) throw badRequest(`${label} "${t}" não encontrado. Cadastre antes ou use a ferramenta de busca.`);
  throw badRequest(`Mais de um ${label} corresponde a "${t}": ${like.map((x) => `${x.nome || x.titulo} (id ${x.id})`).join('; ')}. Informe o id.`);
}

const resolvers = {
  client: (ctx, id, termo) => resolveOne(ctx, 'bizClient', 'cliente', { id, termo, fields: ['nome', 'nome_fantasia', 'documento'] }),
  supplier: (ctx, id, termo) => resolveOne(ctx, 'bizSupplier', 'fornecedor', { id, termo, fields: ['nome', 'documento'] }),
  product: (ctx, id, termo) => resolveOne(ctx, 'bizProduct', 'produto/serviço', { id, termo, fields: ['nome', 'codigo'] }),
  costCenter: (ctx, id, termo) => resolveOne(ctx, 'bizCostCenter', 'centro de custo', { id, termo, fields: ['nome', 'codigo'] }),
  bankAccount: (ctx, id, termo) => resolveOne(ctx, 'bizBankAccount', 'conta financeira', { id, termo, fields: ['nome'] }),
  teamMember: (ctx, id, termo) => resolveOne(ctx, 'bizTeamMember', 'colaborador', { id, termo, fields: ['nome', 'email'] }),
  account: (ctx, id, termo) => resolveOne(ctx, 'bizChartAccount', 'conta do plano de contas', { id, termo, fields: ['codigo', 'nome'] }),
  async contract(ctx, id, termo) {
    if (!id && termo && /^#?\d+$/.test(String(termo).trim())) {
      const n = parseInt(String(termo).replace('#', ''), 10);
      const c = await prisma.bizContract.findFirst({ where: { company_id: ctx.companyId, numero: n } });
      if (!c) throw badRequest(`Contrato #${n} não encontrado`);
      return c;
    }
    return resolveOne(ctx, 'bizContract', 'contrato', { id, termo, fields: ['titulo'] });
  },
  async proposal(ctx, id, termo) {
    if (!id && termo && /^#?\d+$/.test(String(termo).trim())) {
      const n = parseInt(String(termo).replace('#', ''), 10);
      const p = await prisma.bizProposal.findFirst({ where: { company_id: ctx.companyId, numero: n } });
      if (!p) throw badRequest(`Proposta #${n} não encontrada`);
      return p;
    }
    return resolveOne(ctx, 'bizProposal', 'proposta', { id, termo, fields: ['titulo'] });
  },
};

module.exports = { resolvers };
