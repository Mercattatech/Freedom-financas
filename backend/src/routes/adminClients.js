// Painel do proprietário — cadastro de clientes (Pessoal e Empresarial)
// Montado em /api/admin/clientes (somente role admin/owner)
const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');
const companies = require('../business/services/companies');

const prisma = new PrismaClient();
const router = express.Router();

router.use(authenticateToken, (req, res, next) => {
  if (!['admin', 'owner'].includes(req.user?.role)) return res.status(403).json({ message: 'Acesso negado — apenas o proprietário do app.' });
  next();
});

// Perfil extra do cliente (qtd. de pessoas da família etc.) — tabela própria, criada sob demanda
let profileReady = false;
async function ensureProfileTable() {
  if (profileReady) return;
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "client_profile" (
    "user_id" TEXT PRIMARY KEY,
    "qtd_pessoas_familia" INTEGER NOT NULL DEFAULT 1,
    "telefone" TEXT,
    "observacoes" TEXT,
    "updated_date" TIMESTAMP NOT NULL DEFAULT now()
  )`);
  profileReady = true;
}
async function getProfiles(userIds) {
  await ensureProfileTable();
  if (!userIds.length) return {};
  const rows = await prisma.$queryRawUnsafe(`SELECT * FROM "client_profile" WHERE "user_id" = ANY($1::text[])`, userIds);
  return Object.fromEntries(rows.map((r) => [r.user_id, r]));
}
async function saveProfile(userId, { qtd_pessoas_familia, telefone, observacoes }) {
  await ensureProfileTable();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "client_profile" ("user_id","qtd_pessoas_familia","telefone","observacoes","updated_date") VALUES ($1,$2,$3,$4,now())
     ON CONFLICT ("user_id") DO UPDATE SET "qtd_pessoas_familia" = COALESCE($2, "client_profile"."qtd_pessoas_familia"),
       "telefone" = COALESCE($3, "client_profile"."telefone"), "observacoes" = COALESCE($4, "client_profile"."observacoes"), "updated_date" = now()`,
    userId, qtd_pessoas_familia != null ? Math.max(1, parseInt(qtd_pessoas_familia, 10) || 1) : null, telefone ?? null, observacoes ?? null,
  );
}

const ah = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error('[admin clientes]', e.message);
  res.status(e.status || 500).json({ message: e.message });
});
const err = (status, message) => Object.assign(new Error(message), { status });

// WhatsApp: guarda só dígitos, com DDI 55 (como chega da Meta)
const normPhone = (p) => {
  let d = String(p || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  if (d.length < 12 || d.length > 13) throw err(400, `Número de WhatsApp inválido: ${p}. Use DDD + número, ex.: 11 99999-9999`);
  return d;
};

const genPassword = () => crypto.randomBytes(6).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) + '9a';

// Cria (ou reaproveita) o login do cliente. Retorna { user, senha } — senha só quando foi criada agora
async function ensureUser({ email, full_name, password }) {
  const mail = String(email || '').toLowerCase().trim();
  if (!mail || !mail.includes('@')) throw err(400, 'Informe um e-mail válido');
  const existing = await prisma.user.findUnique({ where: { email: mail } });
  if (existing) {
    const data = {};
    if (full_name && !existing.full_name) data.full_name = full_name;
    if (password) { data.password = await bcrypt.hash(password, 10); data.must_change_password = true; }
    const user = Object.keys(data).length ? await prisma.user.update({ where: { id: existing.id }, data }) : existing;
    return { user, senha: password || null, existente: true };
  }
  const senha = password || genPassword();
  const user = await prisma.user.create({
    data: {
      email: mail, full_name: full_name || null, password: await bcrypt.hash(senha, 10),
      is_verified: true, must_change_password: true, role: 'user', subscription_status: 'active',
    },
  });
  return { user, senha, existente: false };
}

async function addPhones(user, phones = []) {
  const added = [];
  for (const item of phones) {
    const raw = typeof item === 'string' ? item : item?.phone;
    const phone = normPhone(raw);
    if (!phone) continue;
    const name = typeof item === 'string' ? null : item?.name || null;
    const owner = await prisma.user.findFirst({ where: { OR: [{ whatsapp_phone: phone }, { whatsapp_phone: phone.replace(/^55/, '') }] } });
    if (owner && owner.id !== user.id) throw err(400, `O número ${raw} já está vinculado a ${owner.email}`);
    if (owner) continue; // já é o número principal desse usuário
    const allowed = await prisma.whatsappAllowedPhone.findUnique({ where: { phone } });
    if (allowed && allowed.user_id !== user.id) throw err(400, `O número ${raw} já está liberado para outro cliente`);
    if (allowed) continue;
    // O primeiro número vira o principal do usuário
    if (!user.whatsapp_phone) {
      user = await prisma.user.update({ where: { id: user.id }, data: { whatsapp_phone: phone } });
      added.push({ phone, name, principal: true });
    } else {
      added.push(await prisma.whatsappAllowedPhone.create({ data: { user_id: user.id, phone, name } }));
    }
  }
  // Garante que o limite comporte os números liberados
  const total = (user.whatsapp_phone ? 1 : 0) + await prisma.whatsappAllowedPhone.count({ where: { user_id: user.id } });
  if (total > (user.limite_numeros_whatsapp || 1)) await prisma.user.update({ where: { id: user.id }, data: { limite_numeros_whatsapp: total } });
  return added;
}

const DEFAULT_CATEGORIES = [
  { nome: 'Moradia', tipo: 'DESPESA', cor: '#3B82F6', icone: 'Home', subs: ['Aluguel', 'Condomínio', 'Luz', 'Água', 'Internet'] },
  { nome: 'Alimentação', tipo: 'DESPESA', cor: '#F59E0B', icone: 'Utensils', subs: ['Supermercado', 'Restaurante', 'Padaria', 'Delivery'] },
  { nome: 'Transporte', tipo: 'DESPESA', cor: '#6366F1', icone: 'Car', subs: ['Combustível', 'Aplicativo', 'Estacionamento', 'Manutenção'] },
  { nome: 'Saúde', tipo: 'DESPESA', cor: '#10B981', icone: 'HeartPulse', subs: ['Plano de Saúde', 'Farmácia', 'Consultas', 'Exames'] },
  { nome: 'Lazer', tipo: 'DESPESA', cor: '#EC4899', icone: 'Smile', subs: ['Cinema', 'Shows', 'Viagens', 'Hobbys'] },
  { nome: 'Educação', tipo: 'DESPESA', cor: '#8B5CF6', icone: 'GraduationCap', subs: ['Mensalidade', 'Cursos', 'Material Escolar', 'Livros'] },
  { nome: 'Salário', tipo: 'RECEITA', cor: '#10B981', icone: 'Wallet', subs: ['Principal', 'Adiantamento', 'Férias', '13º Salário'] },
  { nome: 'Investimentos', tipo: 'RECEITA', cor: '#3B82F6', icone: 'TrendingUp', subs: ['Dividendos', 'Rendimentos', 'Resgates'] },
];
async function createFamily(user, nome, qtd) {
  return prisma.$transaction(async (tx) => {
    const filhos = Math.max(0, qtd - 2);
    const tipo = filhos === 0 ? 'SEM_FILHOS' : `${Math.min(Math.max(filhos, 2), 5)}_FILHOS`;
    const fam = await tx.family.create({ data: { nome_familia: nome, tipo_familia: tipo, created_by: user.email } });
    for (const cat of DEFAULT_CATEGORIES) {
      const c = await tx.category.create({ data: { nome: cat.nome, tipo: cat.tipo, cor: cat.cor, icone: cat.icone, family_id: fam.id, ativo: true } });
      await tx.subcategory.createMany({ data: cat.subs.map((s) => ({ nome: s, category_id: c.id, ativo: true })) });
    }
    return fam;
  }, { timeout: 20000 });
}

// ───────────────────────── PESSOAL ─────────────────────────
router.get('/pessoal', ah(async (req, res) => {
  const q = String(req.query.q || '').trim();
  const users = await prisma.user.findMany({
    where: { role: 'user', ...(q && { OR: [{ email: { contains: q, mode: 'insensitive' } }, { full_name: { contains: q, mode: 'insensitive' } }, { whatsapp_phone: { contains: q.replace(/\D/g, '') || q } }] }) },
    orderBy: { created_date: 'desc' },
    take: 300,
    select: {
      id: true, email: true, full_name: true, disabled: true, created_date: true, last_login: true, must_change_password: true,
      whatsapp_phone: true, limite_numeros_whatsapp: true, subscription_status: true,
      whatsappAllowedPhones: { select: { id: true, phone: true, name: true }, orderBy: { created_date: 'asc' } },
      families: { select: { id: true, nome_familia: true } },
    },
  });
  const profiles = await getProfiles(users.map((u) => u.id));
  res.json(users.map((u) => ({ ...u, qtd_pessoas_familia: profiles[u.id]?.qtd_pessoas_familia || 1, telefone: profiles[u.id]?.telefone || null, observacoes: profiles[u.id]?.observacoes || null })));
}));

router.post('/pessoal', ah(async (req, res) => {
  const { email, full_name, password, qtd_pessoas_familia = 1, nome_familia, whatsapps = [], observacoes } = req.body || {};
  const qtd = Math.max(1, parseInt(qtd_pessoas_familia, 10) || 1);
  const { user, senha, existente } = await ensureUser({ email, full_name, password });
  await prisma.user.update({ where: { id: user.id }, data: { disabled: false, limite_numeros_whatsapp: Math.max(qtd, user.limite_numeros_whatsapp || 1) } });
  await saveProfile(user.id, { qtd_pessoas_familia: qtd, observacoes });
  let family = await prisma.family.findFirst({ where: { created_by: user.email } });
  if (!family) family = await createFamily(user, nome_familia || `Família ${full_name || user.email.split('@')[0]}`, qtd);
  const fresh = await prisma.user.findUnique({ where: { id: user.id } });
  const phones = await addPhones(fresh, whatsapps);
  if (!fresh.whatsapp_default_family_id) await prisma.user.update({ where: { id: user.id }, data: { whatsapp_default_family_id: family.id } });
  res.status(201).json({ user_id: user.id, email: user.email, senha_provisoria: senha, existente, family, phones });
}));

router.put('/pessoal/:id', ah(async (req, res) => {
  const { full_name, qtd_pessoas_familia, limite_numeros_whatsapp, disabled, observacoes, password } = req.body || {};
  const data = {};
  if (full_name !== undefined) data.full_name = full_name;
  if (disabled !== undefined) data.disabled = !!disabled;
  if (limite_numeros_whatsapp !== undefined) data.limite_numeros_whatsapp = Math.max(1, parseInt(limite_numeros_whatsapp, 10) || 1);
  if (password) { data.password = await bcrypt.hash(password, 10); data.must_change_password = true; }
  if (Object.keys(data).length) await prisma.user.update({ where: { id: req.params.id }, data });
  if (qtd_pessoas_familia !== undefined || observacoes !== undefined) await saveProfile(req.params.id, { qtd_pessoas_familia, observacoes });
  res.json({ ok: true });
}));

router.post('/pessoal/:id/whatsapps', ah(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) throw err(404, 'Cliente não encontrado');
  res.status(201).json(await addPhones(user, [{ phone: req.body?.phone, name: req.body?.name }]));
}));

router.delete('/pessoal/:id/whatsapps/:phoneId', ah(async (req, res) => {
  if (req.params.phoneId === 'principal') {
    // Promove o próximo número liberado a principal
    const next = await prisma.whatsappAllowedPhone.findFirst({ where: { user_id: req.params.id }, orderBy: { created_date: 'asc' } });
    await prisma.$transaction([
      ...(next ? [prisma.whatsappAllowedPhone.delete({ where: { id: next.id } })] : []),
      prisma.user.update({ where: { id: req.params.id }, data: { whatsapp_phone: next?.phone || null } }),
    ]);
  } else {
    await prisma.whatsappAllowedPhone.deleteMany({ where: { id: req.params.phoneId, user_id: req.params.id } });
  }
  res.json({ ok: true });
}));

// ───────────────────────── EMPRESARIAL ─────────────────────────
const PAPEIS_ADMIN = ['ADMIN', 'COLABORADOR'];

router.get('/empresas', ah(async (req, res) => {
  const list = await prisma.bizCompany.findMany({
    orderBy: { created_date: 'desc' },
    select: {
      id: true, razao_social: true, nome_fantasia: true, cnpj: true, email: true, telefone: true, plano: true, ativo: true, created_date: true,
      members: { orderBy: { created_date: 'asc' }, select: { id: true, user_id: true, email: true, papel: true, ativo: true, created_date: true } },
    },
  });
  const ids = [...new Set(list.flatMap((c) => c.members.map((m) => m.user_id)))];
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, full_name: true, last_login: true, must_change_password: true } });
  const byId = Object.fromEntries(users.map((u) => [u.id, u]));
  res.json(list.map((c) => ({ ...c, members: c.members.map((m) => ({ ...m, full_name: byId[m.user_id]?.full_name || null, last_login: byId[m.user_id]?.last_login || null, pendente_troca_senha: !!byId[m.user_id]?.must_change_password })) })));
}));

router.post('/empresas', ah(async (req, res) => {
  const { razao_social, nome_fantasia, cnpj, email_empresa, telefone, plano, admin = {} } = req.body || {};
  if (!razao_social) throw err(400, 'Informe a razão social');
  const { user, senha, existente } = await ensureUser({ email: admin.email, full_name: admin.full_name, password: admin.password });
  // O primeiro administrador fica como proprietário (OWNER) da empresa
  const company = await companies.create(user, { razao_social, nome_fantasia, cnpj, email: email_empresa || user.email, telefone });
  if (plano) await prisma.bizCompany.update({ where: { id: company.id }, data: { plano } });
  res.status(201).json({ company, admin: { email: user.email, senha_provisoria: senha, existente } });
}));

router.put('/empresas/:id', ah(async (req, res) => {
  const { ativo, plano, razao_social, nome_fantasia, cnpj } = req.body || {};
  const data = {};
  if (ativo !== undefined) data.ativo = !!ativo;
  if (plano) data.plano = plano;
  if (razao_social) data.razao_social = razao_social;
  if (nome_fantasia !== undefined) data.nome_fantasia = nome_fantasia || null;
  if (cnpj !== undefined) data.cnpj = cnpj ? String(cnpj).replace(/\D/g, '') : null;
  res.json(await prisma.bizCompany.update({ where: { id: req.params.id }, data, select: { id: true, ativo: true, plano: true } }));
}));

router.post('/empresas/:id/usuarios', ah(async (req, res) => {
  const { email, full_name, password, papel = 'COLABORADOR' } = req.body || {};
  if (!PAPEIS_ADMIN.includes(papel)) throw err(400, 'Papel inválido. Use ADMIN ou COLABORADOR');
  const company = await prisma.bizCompany.findUnique({ where: { id: req.params.id } });
  if (!company) throw err(404, 'Empresa não encontrada');
  const { user, senha, existente } = await ensureUser({ email, full_name, password });
  const m = await prisma.bizCompanyMember.upsert({
    where: { company_id_user_id: { company_id: company.id, user_id: user.id } },
    create: { company_id: company.id, user_id: user.id, email: user.email, papel },
    update: { papel, ativo: true },
  });
  res.status(201).json({ member: m, senha_provisoria: senha, existente });
}));

router.put('/empresas/:id/usuarios/:memberId', ah(async (req, res) => {
  const { papel, ativo, password } = req.body || {};
  const m = await prisma.bizCompanyMember.findFirst({ where: { id: req.params.memberId, company_id: req.params.id } });
  if (!m) throw err(404, 'Usuário não encontrado nesta empresa');
  if (papel && !['OWNER', ...PAPEIS_ADMIN].includes(papel)) throw err(400, 'Papel inválido');
  if (m.papel === 'OWNER' && ((papel && papel !== 'OWNER') || ativo === false)) {
    const owners = await prisma.bizCompanyMember.count({ where: { company_id: m.company_id, papel: 'OWNER', ativo: true } });
    if (owners <= 1) throw err(400, 'A empresa precisa de pelo menos um proprietário ativo');
  }
  const upd = await prisma.bizCompanyMember.update({ where: { id: m.id }, data: { ...(papel && { papel }), ...(ativo !== undefined && { ativo: !!ativo }) } });
  if (password) await prisma.user.update({ where: { id: m.user_id }, data: { password: await bcrypt.hash(password, 10), must_change_password: true } });
  // Colaborador/inativo não pode manter chaves de MCP ativas
  if (upd.papel === 'COLABORADOR' || !upd.ativo) await prisma.bizApiKey.updateMany({ where: { company_id: m.company_id, user_id: m.user_id, revogada: false }, data: { revogada: true } });
  res.json(upd);
}));

module.exports = router;
