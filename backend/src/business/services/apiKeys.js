const prisma = require('../db');
const { sha256, randomToken } = require('../lib/crypto');
const { notFound, badRequest } = require('../lib/errors');
const { audit } = require('../lib/audit');
const { API_KEY_PREFIX } = require('../middleware/tenant');

async function list(ctx) {
  const rows = await prisma.bizApiKey.findMany({ where: { company_id: ctx.companyId }, orderBy: { created_date: 'desc' } });
  return rows.map(({ hash, ...r }) => r);
}

async function create(ctx, { nome, escopo = 'ESCRITA' }) {
  if (!nome) throw badRequest('Dê um nome à chave (ex.: "Claude do Matheus")');
  const raw = `${API_KEY_PREFIX}${randomToken(30)}`;
  const k = await prisma.bizApiKey.create({
    data: { company_id: ctx.companyId, nome, escopo: escopo === 'LEITURA' ? 'LEITURA' : 'ESCRITA', prefixo: raw.slice(0, 10), hash: sha256(raw), user_id: ctx.userId },
  });
  await audit(ctx, 'create', 'api_key', k.id, `Chave de API "${nome}" (${k.escopo}) criada`);
  const { hash, ...rest } = k;
  return { ...rest, chave: raw };
}

async function revoke(ctx, id) {
  const k = await prisma.bizApiKey.findFirst({ where: { id, company_id: ctx.companyId } });
  if (!k) throw notFound('Chave');
  await prisma.bizApiKey.update({ where: { id }, data: { revogada: true } });
  await audit(ctx, 'revoke', 'api_key', id, `Chave de API "${k.nome}" revogada`);
  return { success: true };
}

module.exports = { list, create, revoke };
