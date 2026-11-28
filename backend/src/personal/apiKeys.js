// Chaves de API (tokens fpk_...) do módulo Freedom Pessoal / Familiar
// Cada cliente possui seus próprios tokens isolados para conectar no ChatGPT/Claude.
const crypto = require('crypto');
const prisma = require('../business/db');
const { sha256, randomToken } = require('../business/lib/crypto');
const { HttpError, badRequest } = require('../business/lib/errors');

const PERSONAL_KEY_PREFIX = 'fpk_';

let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "personal_api_key" ("id" TEXT PRIMARY KEY, "user_id" TEXT NOT NULL, "family_id" TEXT, "nome" TEXT NOT NULL, "prefixo" TEXT NOT NULL, "hash" TEXT UNIQUE NOT NULL, "escopo" TEXT NOT NULL DEFAULT 'COMPLETO', "revogada" BOOLEAN NOT NULL DEFAULT false, "ultimo_uso" TIMESTAMP, "created_date" TIMESTAMP NOT NULL DEFAULT now())`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "personal_api_key_user_idx" ON "personal_api_key"("user_id")`,
  );
  tableReady = true;
}

async function list(userId) {
  await ensureTable();
  const rows = await prisma.$queryRawUnsafe(
    `SELECT "id", "user_id", "family_id", "nome", "prefixo", "escopo", "revogada", "ultimo_uso", "created_date"
     FROM "personal_api_key"
     WHERE "user_id" = $1
     ORDER BY "created_date" DESC`,
    userId,
  );
  const famIds = [...new Set(rows.map((r) => r.family_id).filter(Boolean))];
  const families = famIds.length
    ? await prisma.family.findMany({ where: { id: { in: famIds } }, select: { id: true, nome_familia: true } })
    : [];
  const famMap = Object.fromEntries(families.map((f) => [f.id, f.nome_familia]));
  return rows.map((r) => ({
    ...r,
    family_nome: r.family_id ? famMap[r.family_id] || null : null,
  }));
}

async function create(user, { nome, escopo = 'COMPLETO', family_id = null } = {}) {
  await ensureTable();
  const cleanEscopo = escopo === 'LEITURA' ? 'LEITURA' : 'COMPLETO';
  if (!['COMPLETO', 'LEITURA'].includes(escopo || 'COMPLETO')) {
    throw badRequest('Escopo inválido. Use COMPLETO ou LEITURA');
  }
  const cleanNome = String(nome || 'ChatGPT Pessoal').trim() || 'ChatGPT Pessoal';
  let resolvedFamilyId = family_id ? String(family_id).trim() : null;
  let familyNome = null;
  if (resolvedFamilyId) {
    const fam = await prisma.family.findFirst({
      where: { id: resolvedFamilyId, created_by: user.email },
      select: { id: true, nome_familia: true },
    });
    if (!fam) throw badRequest('Família não encontrada para este usuário');
    familyNome = fam.nome_familia;
  } else {
    resolvedFamilyId = null;
  }

  const raw = PERSONAL_KEY_PREFIX + randomToken(30);
  const prefixo = raw.slice(0, 12);
  const hash = sha256(raw);
  const id = crypto.randomUUID();

  await prisma.$executeRawUnsafe(
    `INSERT INTO "personal_api_key" ("id", "user_id", "family_id", "nome", "prefixo", "hash", "escopo")
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    id,
    user.id,
    resolvedFamilyId,
    cleanNome,
    prefixo,
    hash,
    cleanEscopo,
  );

  return {
    id,
    nome: cleanNome,
    prefixo,
    escopo: cleanEscopo,
    family_id: resolvedFamilyId,
    family_nome: familyNome,
    chave: raw,
    created_date: new Date(),
  };
}

async function revoke(userId, id) {
  await ensureTable();
  await prisma.$executeRawUnsafe(
    `UPDATE "personal_api_key" SET "revogada" = true WHERE "id" = $1 AND "user_id" = $2`,
    id,
    userId,
  );
  return { success: true };
}

async function resolveApiKey(raw) {
  if (!raw || !String(raw).startsWith(PERSONAL_KEY_PREFIX)) {
    throw new HttpError(401, 'Chave MCP pessoal inválida ou ausente');
  }
  await ensureTable();
  const hash = sha256(String(raw));
  const rows = await prisma.$queryRawUnsafe(
    `SELECT "id", "user_id", "family_id", "escopo", "revogada"
     FROM "personal_api_key"
     WHERE "hash" = $1
     LIMIT 1`,
    hash,
  );
  const row = rows[0];
  if (!row || row.revogada) {
    throw new HttpError(401, 'Chave MCP pessoal inválida ou revogada');
  }

  const user = await prisma.user.findUnique({ where: { id: row.user_id } });
  if (!user || user.disabled) {
    throw new HttpError(401, 'Conta de usuário inativa');
  }

  prisma
    .$executeRawUnsafe(`UPDATE "personal_api_key" SET "ultimo_uso" = now() WHERE "id" = $1`, row.id)
    .catch(() => {});

  return {
    userId: user.id,
    email: user.email,
    fullName: user.full_name || user.email,
    familyId: row.family_id || null,
    escopo: row.escopo,
    apiKeyId: row.id,
  };
}

module.exports = {
  PERSONAL_KEY_PREFIX,
  ensureTable,
  list,
  create,
  revoke,
  resolveApiKey,
};
