const prisma = require('../db');
const { seedCompany } = require('./seed');
const { encrypt, decrypt, randomToken, mask } = require('../lib/crypto');
const { notFound, badRequest } = require('../lib/errors');
const { audit } = require('../lib/audit');

const PUBLIC_FIELDS_OMIT = ['asaas_api_key', 'asaas_webhook_token'];

const present = (c) => {
  if (!c) return c;
  const out = { ...c };
  for (const f of PUBLIC_FIELDS_OMIT) delete out[f];
  out.asaas_configurado = !!c.asaas_api_key;
  out.asaas_api_key_mascarada = c.asaas_api_key ? mask(decrypt(c.asaas_api_key)) : null;
  return out;
};

async function listForUser(user) {
  const members = await prisma.bizCompanyMember.findMany({
    where: { user_id: user.id, ativo: true },
    include: { company: true },
    orderBy: { created_date: 'asc' },
  });
  return members.map((m) => ({ ...present(m.company), papel: m.papel }));
}

async function create(user, data) {
  if (!data.razao_social) throw badRequest('Informe a razão social');
  const company = await prisma.$transaction(async (tx) => {
    const c = await tx.bizCompany.create({
      data: {
        razao_social: data.razao_social,
        nome_fantasia: data.nome_fantasia || null,
        cnpj: data.cnpj ? String(data.cnpj).replace(/\D/g, '') : null,
        email: data.email || user.email,
        telefone: data.telefone || null,
        regime_tributario: data.regime_tributario || 'SIMPLES',
        aliquota_imposto: data.aliquota_imposto ?? 6,
        cor_primaria: data.cor_primaria || '#0F172A',
        cor_secundaria: data.cor_secundaria || '#10B981',
        asaas_webhook_token: encrypt(randomToken(32)),
        created_by: user.id,
      },
    });
    await tx.bizCompanyMember.create({ data: { company_id: c.id, user_id: user.id, email: user.email, papel: 'OWNER' } });
    const { asaasBankAccountId } = await seedCompany(tx, c.id);
    return tx.bizCompany.update({ where: { id: c.id }, data: { asaas_conta_financeira_id: asaasBankAccountId } });
  });
  await audit({ companyId: company.id, userId: user.id }, 'create', 'empresa', company.id, `Empresa ${company.razao_social} criada`);
  return { ...present(company), papel: 'OWNER' };
}

async function get(ctx) {
  const c = await prisma.bizCompany.findUnique({ where: { id: ctx.companyId } });
  if (!c) throw notFound('Empresa');
  return present(c);
}

const EDITABLE = [
  'razao_social', 'nome_fantasia', 'cnpj', 'email', 'telefone', 'site', 'endereco', 'logo_url', 'cor_primaria',
  'cor_secundaria', 'regime_tributario', 'aliquota_imposto', 'aliquota_comissao', 'meta_margem_contrato',
  'rateio_overhead', 'asaas_ambiente', 'asaas_conta_financeira_id', 'proposta_validade_dias', 'proposta_termos',
  'proposta_rodape',
];

async function update(ctx, data) {
  const patch = {};
  for (const k of EDITABLE) if (data[k] !== undefined) patch[k] = data[k];
  if (patch.cnpj) patch.cnpj = String(patch.cnpj).replace(/\D/g, '');
  const c = await prisma.bizCompany.update({ where: { id: ctx.companyId }, data: patch });
  await audit(ctx, 'update', 'empresa', c.id, 'Dados da empresa atualizados', Object.keys(patch));
  return present(c);
}

async function setAsaasKey(ctx, apiKey, ambiente) {
  const data = {};
  // undefined = manter a chave atual; null/'' = remover
  if (apiKey !== undefined) data.asaas_api_key = apiKey ? encrypt(String(apiKey).trim()) : null;
  if (ambiente) data.asaas_ambiente = ambiente;
  const c = await prisma.bizCompany.update({ where: { id: ctx.companyId }, data });
  await audit(ctx, 'update', 'empresa', c.id, apiKey ? 'Chave do Asaas configurada' : apiKey === undefined ? `Ambiente do Asaas: ${ambiente}` : 'Chave do Asaas removida');
  return present(c);
}

async function getWebhookInfo(ctx, baseUrl) {
  let c = await prisma.bizCompany.findUnique({ where: { id: ctx.companyId } });
  if (!c.asaas_webhook_token) {
    c = await prisma.bizCompany.update({ where: { id: c.id }, data: { asaas_webhook_token: encrypt(randomToken(32)) } });
  }
  return {
    url: `${baseUrl}/api/biz/webhooks/asaas/${c.id}`,
    token: decrypt(c.asaas_webhook_token),
    eventos: ['PAYMENT_CREATED', 'PAYMENT_UPDATED', 'PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'PAYMENT_OVERDUE', 'PAYMENT_DELETED', 'PAYMENT_REFUNDED', 'PAYMENT_RECEIVED_IN_CASH_UNDONE'],
  };
}

// ── Membros ──
async function listMembers(ctx) {
  return prisma.bizCompanyMember.findMany({ where: { company_id: ctx.companyId }, orderBy: { created_date: 'asc' } });
}

async function addMember(ctx, { email, papel }) {
  const user = await prisma.user.findUnique({ where: { email: String(email || '').toLowerCase().trim() } });
  if (!user) throw badRequest('Usuário não encontrado. Ele precisa ter uma conta no Freedom.');
  const m = await prisma.bizCompanyMember.upsert({
    where: { company_id_user_id: { company_id: ctx.companyId, user_id: user.id } },
    create: { company_id: ctx.companyId, user_id: user.id, email: user.email, papel: papel || 'LEITURA' },
    update: { papel: papel || 'LEITURA', ativo: true },
  });
  await audit(ctx, 'create', 'membro', m.id, `Acesso de ${user.email} como ${m.papel}`);
  return m;
}

async function updateMember(ctx, id, { papel, ativo }) {
  const m = await prisma.bizCompanyMember.findFirst({ where: { id, company_id: ctx.companyId } });
  if (!m) throw notFound('Membro');
  if (m.papel === 'OWNER' && (papel && papel !== 'OWNER' || ativo === false)) {
    const owners = await prisma.bizCompanyMember.count({ where: { company_id: ctx.companyId, papel: 'OWNER', ativo: true } });
    if (owners <= 1) throw badRequest('A empresa precisa de pelo menos um proprietário ativo');
  }
  const upd = await prisma.bizCompanyMember.update({ where: { id }, data: { ...(papel && { papel }), ...(ativo !== undefined && { ativo }) } });
  await audit(ctx, 'update', 'membro', id, `Acesso de ${m.email} alterado`);
  return upd;
}

module.exports = { listForUser, create, get, update, setAsaasKey, getWebhookInfo, listMembers, addMember, updateMember, present };
