const jwt = require('jsonwebtoken');
const prisma = require('../db');
const { sha256 } = require('../lib/crypto');
const { can } = require('../lib/permissions');
const { HttpError } = require('../lib/errors');

const API_KEY_PREFIX = 'fbk_';

// Resolve a chave de API (MCP/integrações) → contexto da empresa
async function contextFromApiKey(raw) {
  const key = await prisma.bizApiKey.findUnique({ where: { hash: sha256(raw) } });
  if (!key || key.revogada) throw new HttpError(401, 'Chave de API inválida ou revogada');
  const member = await prisma.bizCompanyMember.findUnique({
    where: { company_id_user_id: { company_id: key.company_id, user_id: key.user_id } },
  });
  if (!member || !member.ativo) throw new HttpError(401, 'O usuário dono desta chave não tem mais acesso à empresa');
  prisma.bizApiKey.update({ where: { id: key.id }, data: { ultimo_uso: new Date() } }).catch(() => {});
  return {
    companyId: key.company_id,
    userId: key.user_id,
    email: member.email,
    // Chave somente leitura rebaixa o papel para LEITURA
    papel: key.escopo === 'LEITURA' ? 'LEITURA' : member.papel,
    origem: 'MCP',
    apiKeyId: key.id,
  };
}

function verifyJwt(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new HttpError(401, 'Sessão inválida ou expirada');
  }
}

// Autentica o usuário (JWT do Freedom) sem exigir empresa — usado para listar/criar empresas
const requireUser = async (req, res, next) => {
  try {
    const token = (req.headers.authorization || '').split(' ')[1];
    if (!token) throw new HttpError(401, 'Autenticação necessária');
    if (token.startsWith(API_KEY_PREFIX)) {
      req.ctx = await contextFromApiKey(token);
      req.user = { id: req.ctx.userId, email: req.ctx.email };
      return next();
    }
    req.user = verifyJwt(token);
    next();
  } catch (e) {
    next(e);
  }
};

// Autentica e resolve a empresa ativa (header x-company-id) + papel do usuário
const requireCompany = async (req, res, next) => {
  try {
    const token = (req.headers.authorization || '').split(' ')[1];
    if (!token) throw new HttpError(401, 'Autenticação necessária');

    if (token.startsWith(API_KEY_PREFIX)) {
      req.ctx = await contextFromApiKey(token);
      return next();
    }

    const user = verifyJwt(token);
    req.user = user;
    const companyId = req.headers['x-company-id'] || req.query.company_id;
    if (!companyId) throw new HttpError(400, 'Selecione uma empresa (cabeçalho x-company-id)');

    const member = await prisma.bizCompanyMember.findUnique({
      where: { company_id_user_id: { company_id: String(companyId), user_id: user.id } },
    });

    let papel = member?.ativo ? member.papel : null;
    if (!papel && user.role === 'admin') papel = 'ADMIN'; // suporte da plataforma
    if (!papel) throw new HttpError(403, 'Você não tem acesso a esta empresa');

    req.ctx = { companyId: String(companyId), userId: user.id, email: user.email, papel, origem: 'APP' };
    next();
  } catch (e) {
    next(e);
  }
};

const requirePerm = (perm) => (req, res, next) => {
  if (!req.ctx || !can(req.ctx.papel, perm)) return next(new HttpError(403, 'Seu papel nesta empresa não permite esta ação'));
  next();
};

module.exports = { requireUser, requireCompany, requirePerm, contextFromApiKey, API_KEY_PREFIX };
