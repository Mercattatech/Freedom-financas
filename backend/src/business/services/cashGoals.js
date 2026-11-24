// Meta de Caixa & Reservas Empresariais (caixas direcionados, aportes/resgates e saúde financeira)
const crypto = require('crypto');
const prisma = require('../db');
const { num, round2 } = require('../lib/money');
const { badRequest, notFound } = require('../lib/errors');
const { audit } = require('../lib/audit');

let tablesReady = false;
async function ensureTables() {
  if (tablesReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "biz_cash_goal" (
      "id" TEXT PRIMARY KEY,
      "company_id" TEXT NOT NULL,
      "nome" TEXT NOT NULL,
      "descricao" TEXT,
      "valor_meta" DECIMAL(14,2) NOT NULL DEFAULT 0,
      "aporte_mensal" DECIMAL(14,2) NOT NULL DEFAULT 0,
      "taxa_mensal_percent" DECIMAL(8,4) NOT NULL DEFAULT 0.85,
      "prazo_meses" INTEGER NOT NULL DEFAULT 12,
      "bank_account_id" TEXT,
      "cor" TEXT NOT NULL DEFAULT '#10B981',
      "ativo" BOOLEAN NOT NULL DEFAULT true,
      "created_date" TIMESTAMP NOT NULL DEFAULT now(),
      "updated_date" TIMESTAMP NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS "biz_cash_goal_company_idx" ON "biz_cash_goal"("company_id");

    CREATE TABLE IF NOT EXISTS "biz_cash_goal_entry" (
      "id" TEXT PRIMARY KEY,
      "company_id" TEXT NOT NULL,
      "goal_id" TEXT NOT NULL REFERENCES "biz_cash_goal"("id") ON DELETE CASCADE,
      "tipo" TEXT NOT NULL DEFAULT 'APORTE',
      "valor" DECIMAL(14,2) NOT NULL,
      "data" TIMESTAMP NOT NULL DEFAULT now(),
      "bank_account_id" TEXT,
      "observacoes" TEXT,
      "created_by" TEXT,
      "created_date" TIMESTAMP NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS "biz_cash_goal_entry_company_idx" ON "biz_cash_goal_entry"("company_id");
    CREATE INDEX IF NOT EXISTS "biz_cash_goal_entry_goal_idx" ON "biz_cash_goal_entry"("goal_id");
  `);
  tablesReady = true;
}

async function list(ctx) {
  await ensureTables();
  const [goals, entries, banks, despesaMediaRows] = await Promise.all([
    prisma.$queryRawUnsafe(
      `SELECT * FROM "biz_cash_goal" WHERE "company_id" = $1 AND "ativo" = true ORDER BY "created_date" ASC`,
      ctx.companyId,
    ),
    prisma.$queryRawUnsafe(
      `SELECT * FROM "biz_cash_goal_entry" WHERE "company_id" = $1 ORDER BY "data" DESC, "created_date" DESC LIMIT 300`,
      ctx.companyId,
    ),
    prisma.bizBankAccount.findMany({
      where: { company_id: ctx.companyId, ativo: true },
      select: { id: true, nome: true, tipo: true },
    }),
    // Média mensal de despesas dos últimos 3 meses para calcular saúde / meses de fôlego (runway)
    prisma.bizTransaction.aggregate({
      where: {
        company_id: ctx.companyId,
        tipo: 'DESPESA',
        status: { not: 'CANCELADO' },
        vencimento: { gte: new Date(Date.now() - 90 * 86400000), lte: new Date() },
      },
      _sum: { valor: true },
    }),
  ]);

  const bankById = Object.fromEntries(banks.map((b) => [b.id, b]));
  const entriesByGoal = new Map();
  for (const e of entries) {
    const item = {
      id: e.id,
      goal_id: e.goal_id,
      tipo: e.tipo,
      valor: round2(num(e.valor)),
      data: e.data,
      bank_account_id: e.bank_account_id,
      bank_name: e.bank_account_id ? bankById[e.bank_account_id]?.nome || null : null,
      observacoes: e.observacoes,
      created_date: e.created_date,
    };
    if (!entriesByGoal.has(e.goal_id)) entriesByGoal.set(e.goal_id, []);
    entriesByGoal.get(e.goal_id).push(item);
  }

  const decorated = goals.map((g) => {
    const listE = entriesByGoal.get(g.id) || [];
    const totalAportes = round2(listE.filter((e) => e.tipo === 'APORTE').reduce((s, e) => s + e.valor, 0));
    const totalResgates = round2(listE.filter((e) => e.tipo === 'RESGATE').reduce((s, e) => s + e.valor, 0));
    const saldo = round2(totalAportes - totalResgates);
    const meta = round2(num(g.valor_meta));
    const progresso = meta > 0 ? Math.min(999, round2((saldo / meta) * 100)) : 0;
    return {
      id: g.id,
      nome: g.nome,
      descricao: g.descricao || '',
      valor_meta: meta,
      aporte_mensal: round2(num(g.aporte_mensal)),
      taxa_mensal_percent: Number(g.taxa_mensal_percent ?? 0.85),
      prazo_meses: Number(g.prazo_meses || 12),
      bank_account_id: g.bank_account_id || '',
      bank_name: g.bank_account_id ? bankById[g.bank_account_id]?.nome || null : null,
      cor: g.cor || '#10B981',
      saldo,
      total_aportes: totalAportes,
      total_resgates: totalResgates,
      faltante: round2(Math.max(0, meta - saldo)),
      progresso_percent: progresso,
      lancamentos: listE,
    };
  });

  const totalAcumulado = round2(decorated.reduce((s, g) => s + g.saldo, 0));
  const totalMetas = round2(decorated.reduce((s, g) => s + g.valor_meta, 0));
  const totalAporteMensal = round2(decorated.reduce((s, g) => s + g.aporte_mensal, 0));
  const despesaMensalMedia = round2(num(despesaMediaRows._sum.valor) / 3);
  const mesesFolego = despesaMensalMedia > 0 ? round2(totalAcumulado / despesaMensalMedia) : null;
  const progressoGeral = totalMetas > 0 ? round2((totalAcumulado / totalMetas) * 100) : 0;

  let saude = 'EM_CONSTRUCAO';
  if (mesesFolego !== null) {
    if (mesesFolego >= 6) saude = 'EXCELENTE';
    else if (mesesFolego >= 3) saude = 'SAUDAVEL';
    else if (mesesFolego >= 1) saude = 'ATENCAO';
    else saude = 'CRITICO';
  } else if (progressoGeral >= 100) {
    saude = 'EXCELENTE';
  } else if (progressoGeral >= 50) {
    saude = 'SAUDAVEL';
  }

  return {
    resumo: {
      total_acumulado: totalAcumulado,
      total_metas: totalMetas,
      total_aporte_mensal: totalAporteMensal,
      progresso_percent: progressoGeral,
      despesa_mensal_media: despesaMensalMedia,
      meses_folego: mesesFolego,
      saude,
    },
    items: decorated,
  };
}

async function createGoal(ctx, data = {}) {
  await ensureTables();
  const nome = String(data.nome || '').trim();
  if (!nome) throw badRequest('Informe o nome do caixa / meta');
  const valorMeta = round2(num(data.valor_meta));
  if (!(valorMeta > 0)) throw badRequest('Informe um valor de meta maior que zero');
  const aporteMensal = round2(Math.max(0, num(data.aporte_mensal)));
  const taxaMensal = Math.max(0, Number(data.taxa_mensal_percent ?? 0.85) || 0);
  const prazoMeses = Math.max(1, Math.min(360, parseInt(data.prazo_meses || 12, 10) || 12));
  const id = crypto.randomUUID();

  await prisma.$executeRawUnsafe(
    `INSERT INTO "biz_cash_goal" ("id","company_id","nome","descricao","valor_meta","aporte_mensal","taxa_mensal_percent","prazo_meses","bank_account_id","cor")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    id, ctx.companyId, nome, data.descricao || null, valorMeta, aporteMensal, taxaMensal, prazoMeses, data.bank_account_id || null, data.cor || '#10B981',
  );

  // Se o usuário informar um saldo inicial já existente nesse caixa, cria o 1º aporte
  const saldoInicial = round2(num(data.saldo_inicial));
  if (saldoInicial > 0) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "biz_cash_goal_entry" ("id","company_id","goal_id","tipo","valor","data","bank_account_id","observacoes","created_by")
       VALUES ($1,$2,$3,'APORTE',$4,now(),$5,'Saldo inicial do caixa',$6)`,
      crypto.randomUUID(), ctx.companyId, id, saldoInicial, data.bank_account_id || null, ctx.userId || null,
    );
  }

  await audit(ctx, 'create', 'meta_caixa', id, `Meta de caixa "${nome}" criada (meta R$ ${valorMeta})`);
  return { id };
}

async function updateGoal(ctx, id, data = {}) {
  await ensureTables();
  const rows = await prisma.$queryRawUnsafe(`SELECT * FROM "biz_cash_goal" WHERE "id" = $1 AND "company_id" = $2`, id, ctx.companyId);
  if (!rows.length) throw notFound('Meta de caixa');
  const g = rows[0];
  const nome = data.nome !== undefined ? String(data.nome).trim() : g.nome;
  if (!nome) throw badRequest('Informe o nome do caixa / meta');
  const valorMeta = data.valor_meta !== undefined ? round2(num(data.valor_meta)) : num(g.valor_meta);
  const aporteMensal = data.aporte_mensal !== undefined ? round2(Math.max(0, num(data.aporte_mensal))) : num(g.aporte_mensal);
  const taxaMensal = data.taxa_mensal_percent !== undefined ? Math.max(0, Number(data.taxa_mensal_percent) || 0) : Number(g.taxa_mensal_percent);
  const prazoMeses = data.prazo_meses !== undefined ? Math.max(1, Math.min(360, parseInt(data.prazo_meses, 10) || 12)) : Number(g.prazo_meses);
  const desc = data.descricao !== undefined ? (data.descricao || null) : g.descricao;
  const bankId = data.bank_account_id !== undefined ? (data.bank_account_id || null) : g.bank_account_id;
  const cor = data.cor || g.cor;

  await prisma.$executeRawUnsafe(
    `UPDATE "biz_cash_goal" SET "nome"=$1, "descricao"=$2, "valor_meta"=$3, "aporte_mensal"=$4, "taxa_mensal_percent"=$5, "prazo_meses"=$6, "bank_account_id"=$7, "cor"=$8, "updated_date"=now()
     WHERE "id"=$9 AND "company_id"=$10`,
    nome, desc, valorMeta, aporteMensal, taxaMensal, prazoMeses, bankId, cor, id, ctx.companyId,
  );
  await audit(ctx, 'update', 'meta_caixa', id, `Meta de caixa "${nome}" atualizada`);
  return { ok: true };
}

async function deleteGoal(ctx, id) {
  await ensureTables();
  await prisma.$executeRawUnsafe(`DELETE FROM "biz_cash_goal" WHERE "id" = $1 AND "company_id" = $2`, id, ctx.companyId);
  await audit(ctx, 'delete', 'meta_caixa', id, 'Meta de caixa removida');
  return { ok: true };
}

async function addEntry(ctx, goalId, data = {}) {
  await ensureTables();
  const rows = await prisma.$queryRawUnsafe(`SELECT * FROM "biz_cash_goal" WHERE "id" = $1 AND "company_id" = $2`, goalId, ctx.companyId);
  if (!rows.length) throw notFound('Meta de caixa');
  const tipo = data.tipo === 'RESGATE' ? 'RESGATE' : 'APORTE';
  const valor = round2(num(data.valor));
  if (!(valor > 0)) throw badRequest('Informe um valor maior que zero');
  const dt = data.data ? new Date(`${String(data.data).slice(0, 10)}T12:00:00.000Z`) : new Date();
  const id = crypto.randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "biz_cash_goal_entry" ("id","company_id","goal_id","tipo","valor","data","bank_account_id","observacoes","created_by")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    id, ctx.companyId, goalId, tipo, valor, dt, data.bank_account_id || rows[0].bank_account_id || null, data.observacoes || null, ctx.userId || null,
  );
  await audit(ctx, 'create', 'meta_caixa_lancamento', id, `${tipo === 'APORTE' ? 'Aporte' : 'Resgate'} de R$ ${valor} em "${rows[0].nome}"`);
  return { id };
}

async function deleteEntry(ctx, entryId) {
  await ensureTables();
  await prisma.$executeRawUnsafe(`DELETE FROM "biz_cash_goal_entry" WHERE "id" = $1 AND "company_id" = $2`, entryId, ctx.companyId);
  await audit(ctx, 'delete', 'meta_caixa_lancamento', entryId, 'Lançamento de caixa removido');
  return { ok: true };
}

module.exports = { list, createGoal, updateGoal, deleteGoal, addEntry, deleteEntry };
