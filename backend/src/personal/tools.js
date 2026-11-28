// Ferramentas MCP do módulo Freedom Pessoal / Familiar (100% isoladas por usuário/família)
const { z } = require('zod');
const prisma = require('../business/db');
const { badRequest, notFound } = require('../business/lib/errors');
const { recalcularFaturaCartao, calcularCompetenciaFatura } = require('../services/creditCardBill');

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const todayYmd = () => new Date().toISOString().slice(0, 10);
const currentYm = () => new Date().toISOString().slice(0, 7);

async function getUserFamilies(ctx) {
  return prisma.family.findMany({
    where: {
      created_by: ctx.email,
      ...(ctx.familyId ? { id: ctx.familyId } : {}),
    },
    orderBy: { created_date: 'asc' },
  });
}

async function resolveFamily(ctx, familiaParam) {
  const families = await getUserFamilies(ctx);
  if (!families.length) {
    throw badRequest('Nenhuma família cadastrada para este usuário.');
  }
  if (familiaParam) {
    const q = String(familiaParam).trim();
    const ql = q.toLowerCase();
    const exact = families.find((f) => f.id === q || f.nome_familia.toLowerCase() === ql);
    if (exact) return exact;
    const partial = families.filter((f) => f.nome_familia.toLowerCase().includes(ql));
    if (partial.length === 1) return partial[0];
    if (partial.length > 1) {
      throw badRequest(`Mais de uma família encontrada para "${q}": ${partial.map((f) => f.nome_familia).join(', ')}.`);
    }
    throw badRequest(`Família "${q}" não encontrada. Disponíveis: ${families.map((f) => f.nome_familia).join(', ')}.`);
  }
  if (families.length === 1) return families[0];

  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { whatsapp_default_family_id: true },
  });
  if (user?.whatsapp_default_family_id) {
    const def = families.find((f) => f.id === user.whatsapp_default_family_id);
    if (def) return def;
  }
  throw badRequest(
    `Você possui ${families.length} famílias (${families.map((f) => f.nome_familia).join(', ')}). Informe o parâmetro "familia".`,
  );
}

async function ensureMonth(familyId, competencia) {
  const comp = String(competencia || currentYm()).slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(comp)) throw badRequest(`Competência inválida: ${competencia}. Use AAAA-MM.`);
  let m = await prisma.financialMonth.findUnique({
    where: { family_id_competencia: { family_id: familyId, competencia: comp } },
  });
  if (!m) {
    m = await prisma.financialMonth.create({
      data: { family_id: familyId, competencia: comp, status: 'ABERTO' },
    });
  }
  return m;
}

async function findCategory(familyId, q, tipo) {
  if (!q) return null;
  const s = String(q).trim();
  const baseWhere = { family_id: familyId, ativo: true, ...(tipo ? { tipo } : {}) };
  let cat = await prisma.category.findFirst({ where: { ...baseWhere, id: s } });
  if (cat) return cat;
  cat = await prisma.category.findFirst({ where: { ...baseWhere, nome: { equals: s, mode: 'insensitive' } } });
  if (cat) return cat;
  return prisma.category.findFirst({ where: { ...baseWhere, nome: { contains: s, mode: 'insensitive' } } });
}

async function findSubcategory(categoryId, q) {
  if (!categoryId || !q) return null;
  const s = String(q).trim();
  let sub = await prisma.subcategory.findFirst({ where: { category_id: categoryId, ativo: true, id: s } });
  if (sub) return sub;
  sub = await prisma.subcategory.findFirst({ where: { category_id: categoryId, ativo: true, nome: { equals: s, mode: 'insensitive' } } });
  if (sub) return sub;
  return prisma.subcategory.findFirst({ where: { category_id: categoryId, ativo: true, nome: { contains: s, mode: 'insensitive' } } });
}

async function findCard(familyId, q) {
  if (!q) return null;
  const s = String(q).trim();
  let cc = await prisma.creditCard.findFirst({ where: { family_id: familyId, ativo: true, id: s } });
  if (cc) return cc;
  cc = await prisma.creditCard.findFirst({ where: { family_id: familyId, ativo: true, nome: { equals: s, mode: 'insensitive' } } });
  if (cc) return cc;
  return prisma.creditCard.findFirst({ where: { family_id: familyId, ativo: true, nome: { contains: s, mode: 'insensitive' } } });
}

const TOOLS = [
  {
    name: 'listar_familias',
    description: 'Lista as famílias do Freedom Pessoal acessíveis por este token, com suas categorias, subcategorias e cartões de crédito ativos.',
    readOnly: true,
    schema: {},
    handler: async (ctx) => {
      const families = await getUserFamilies(ctx);
      const result = [];
      for (const f of families) {
        const [categories, cards] = await Promise.all([
          prisma.category.findMany({
            where: { family_id: f.id, ativo: true },
            include: { subcategories: { where: { ativo: true }, select: { id: true, nome: true } } },
            orderBy: [{ tipo: 'asc' }, { nome: 'asc' }],
          }),
          prisma.creditCard.findMany({
            where: { family_id: f.id, ativo: true },
            select: { id: true, nome: true, bandeira: true, ultimos_digitos: true, limite: true, dia_fechamento: true, dia_vencimento: true },
            orderBy: { nome: 'asc' },
          }),
        ]);
        result.push({
          id: f.id,
          nome: f.nome_familia,
          tipo: f.tipo_familia,
          moeda: f.moeda,
          categorias: categories.map((c) => ({
            id: c.id,
            nome: c.nome,
            tipo: c.tipo,
            subcategorias: c.subcategories.map((s) => s.nome),
          })),
          cartoes: cards,
        });
      }
      return { familias: result };
    },
  },
  {
    name: 'resumo_mes',
    description: 'Retorna o resumo financeiro pessoal do mês (AAAA-MM): total de receitas, despesas, gastos no cartão, saldo do mês, gastos vs orçamento por categoria, metas, dívidas e caixinhas.',
    readOnly: true,
    schema: {
      competencia: z.string().optional().describe('Mês no formato AAAA-MM (padrão: mês atual)'),
      familia: z.string().optional().describe('Nome ou ID da família (opcional se houver só uma)'),
    },
    handler: async (ctx, { competencia, familia }) => {
      const fam = await resolveFamily(ctx, familia);
      const comp = String(competencia || currentYm()).slice(0, 7);
      const month = await prisma.financialMonth.findUnique({
        where: { family_id_competencia: { family_id: fam.id, competencia: comp } },
      });

      const [incomes, expenses, budgets, goals, debts, boxes] = await Promise.all([
        month ? prisma.income.findMany({ where: { month_id: month.id, ativo: true }, include: { category: { select: { nome: true } } } }) : [],
        month ? prisma.expense.findMany({ where: { month_id: month.id }, include: { category: { select: { nome: true } } } }) : [],
        month ? prisma.budget.findMany({ where: { month_id: month.id }, include: { category: { select: { nome: true } } } }) : [],
        prisma.goal.findMany({ where: { family_id: fam.id, ativo: true } }),
        prisma.debt.findMany({ where: { family_id: fam.id, status: 'ATIVA' } }),
        prisma.investmentBox.findMany({ where: { family_id: fam.id, ativo: true } }),
      ]);

      const total_receitas = round2(incomes.reduce((s, i) => s + (i.valor || 0), 0));
      // Evita dupla contagem: despesas fora do cartão + faturas automáticas do cartão
      const despesasDiretasOuFatura = expenses.filter((e) => !e.credit_card_id || e.is_fatura_cartao);
      const gastosCartao = expenses.filter((e) => e.credit_card_id && !e.is_fatura_cartao);

      const total_despesas = round2(despesasDiretasOuFatura.reduce((s, e) => s + (e.valor || 0), 0));
      const gastos_no_cartao = round2(gastosCartao.reduce((s, e) => s + (e.valor || 0), 0));
      const saldo_mes = round2(total_receitas - total_despesas);

      // Agrupa gasto por categoria (excluindo faturas consolidadas para detalhar por categoria real)
      const gastoPorCat = new Map();
      for (const e of expenses) {
        if (e.is_fatura_cartao) continue;
        const catNome = e.category?.nome || 'Sem categoria';
        gastoPorCat.set(catNome, round2((gastoPorCat.get(catNome) || 0) + (e.valor || 0)));
      }
      const orcPorCat = new Map(budgets.map((b) => [b.category?.nome || 'Sem categoria', round2(b.valor_orcado || 0)]));
      const todasCats = new Set([...gastoPorCat.keys(), ...orcPorCat.keys()]);
      const por_categoria = [...todasCats].map((cat) => {
        const gasto = gastoPorCat.get(cat) || 0;
        const orcado = orcPorCat.get(cat) ?? null;
        return {
          categoria: cat,
          gasto,
          orcado,
          saldo_orcamento: orcado !== null ? round2(orcado - gasto) : null,
        };
      }).sort((a, b) => b.gasto - a.gasto);

      return {
        escopo: 'PESSOAL',
        familia: fam.nome_familia,
        competencia: comp,
        total_receitas,
        total_despesas,
        gastos_no_cartao,
        saldo_mes,
        por_categoria,
        total_metas: round2(goals.reduce((s, g) => s + (g.valor_alvo || 0), 0)),
        metas_acumulado: round2(goals.reduce((s, g) => s + (g.valor_atual || 0), 0)),
        total_dividas: round2(debts.reduce((s, d) => s + (d.saldo_atual || 0), 0)),
        total_caixinhas: round2(boxes.reduce((s, b) => s + (b.saldo_atual || 0), 0)),
      };
    },
  },
  {
    name: 'listar_lancamentos',
    description: 'Lista lançamentos pessoais (despesas e/ou receitas) de um mês, com filtros por categoria, cartão ou busca no texto.',
    readOnly: true,
    schema: {
      competencia: z.string().optional().describe('Mês no formato AAAA-MM (padrão: mês atual)'),
      tipo: z.enum(['TODOS', 'DESPESA', 'RECEITA']).optional(),
      categoria: z.string().optional().describe('Nome da categoria'),
      cartao: z.string().optional().describe('Nome do cartão de crédito'),
      busca: z.string().optional().describe('Termo para buscar na descrição'),
      familia: z.string().optional(),
    },
    handler: async (ctx, { competencia, tipo = 'TODOS', categoria, cartao, busca, familia }) => {
      const fam = await resolveFamily(ctx, familia);
      const comp = String(competencia || currentYm()).slice(0, 7);
      const month = await prisma.financialMonth.findUnique({
        where: { family_id_competencia: { family_id: fam.id, competencia: comp } },
      });
      if (!month) return { familia: fam.nome_familia, competencia: comp, despesas: [], receitas: [] };

      const catObj = categoria ? await findCategory(fam.id, categoria) : null;
      const cardObj = cartao ? await findCard(fam.id, cartao) : null;
      const qLower = busca ? String(busca).toLowerCase() : null;

      let despesas = [];
      if (tipo === 'TODOS' || tipo === 'DESPESA') {
        const rows = await prisma.expense.findMany({
          where: {
            month_id: month.id,
            ...(catObj ? { category_id: catObj.id } : {}),
            ...(cardObj ? { credit_card_id: cardObj.id } : {}),
          },
          include: {
            category: { select: { nome: true } },
            subcategory: { select: { nome: true } },
            creditCard: { select: { nome: true } },
          },
          orderBy: { data: 'desc' },
        });
        despesas = rows
          .filter((r) => !qLower || r.descricao?.toLowerCase().includes(qLower))
          .map((r) => ({
            id: r.id,
            tipo: 'DESPESA',
            data: r.data,
            descricao: r.descricao,
            valor: round2(r.valor),
            categoria: r.category?.nome || null,
            subcategoria: r.subcategory?.nome || null,
            forma_pagamento: r.forma_pagamento || null,
            cartao: r.creditCard?.nome || null,
            is_fatura_cartao: r.is_fatura_cartao,
            notas: r.notes || null,
          }));
      }

      let receitas = [];
      if (tipo === 'TODOS' || tipo === 'RECEITA') {
        const rows = await prisma.income.findMany({
          where: {
            month_id: month.id,
            ativo: true,
            ...(catObj ? { category_id: catObj.id } : {}),
          },
          include: {
            category: { select: { nome: true } },
            subcategory: { select: { nome: true } },
          },
          orderBy: { data_recebimento: 'desc' },
        });
        receitas = rows
          .filter((r) => !qLower || (r.descricao || '').toLowerCase().includes(qLower))
          .map((r) => ({
            id: r.id,
            tipo: 'RECEITA',
            data: r.data_recebimento,
            descricao: r.descricao || 'Receita',
            valor: round2(r.valor),
            categoria: r.category?.nome || null,
            subcategoria: r.subcategory?.nome || null,
            recorrente: r.recorrente,
          }));
      }

      return { familia: fam.nome_familia, competencia: comp, despesas, receitas };
    },
  },
  {
    name: 'lancar_despesa',
    description: 'Lança uma despesa pessoal (à vista, PIX, débito ou no cartão de crédito, inclusive parcelada). Se usar cartão de crédito, recalcula a fatura automaticamente.',
    readOnly: false,
    schema: {
      descricao: z.string().min(1),
      valor: z.number().positive().describe('Valor total da despesa (se parcelada, é dividido entre as parcelas)'),
      data: z.string().optional().describe('Data AAAA-MM-DD (padrão: hoje)'),
      categoria: z.string().optional().describe('Nome da categoria (ex.: Alimentação, Moradia, Transporte)'),
      subcategoria: z.string().optional().describe('Nome da subcategoria'),
      forma_pagamento: z.string().optional().describe('Ex.: PIX, DEBITO, DINHEIRO, CARTAO_CREDITO, BOLETO'),
      cartao: z.string().optional().describe('Nome ou ID do cartão de crédito'),
      parcelas: z.number().int().min(1).max(48).optional().describe('Quantidade de parcelas (padrão: 1)'),
      recorrente: z.boolean().optional(),
      notas: z.string().optional(),
      familia: z.string().optional(),
    },
    handler: async (ctx, args) => {
      const fam = await resolveFamily(ctx, args.familia);
      const cat = args.categoria ? await findCategory(fam.id, args.categoria, 'DESPESA') : null;
      const sub = cat && args.subcategoria ? await findSubcategory(cat.id, args.subcategoria) : null;
      const card = args.cartao ? await findCard(fam.id, args.cartao) : null;
      if (args.cartao && !card) {
        throw badRequest(`Cartão "${args.cartao}" não encontrado na família "${fam.nome_familia}".`);
      }

      const installments = Math.max(1, Math.min(48, parseInt(args.parcelas, 10) || 1));
      const valorParcela = installments > 1 ? round2(args.valor / installments) : round2(args.valor);
      const baseStr = (args.data || todayYmd()).slice(0, 10);
      const [y, m, d] = baseStr.split('-').map(Number);
      const baseDate = new Date(Date.UTC(y, m - 1, d));

      const created = [];
      const competenciasCartao = new Set();

      for (let i = 0; i < installments; i++) {
        const cur = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth() + i, baseDate.getUTCDate()));
        const curYmd = cur.toISOString().slice(0, 10);
        const curComp = curYmd.slice(0, 7);
        const fm = await ensureMonth(fam.id, curComp);
        const desc = installments > 1 ? `${args.descricao} (${i + 1}/${installments})` : args.descricao;

        const rec = await prisma.expense.create({
          data: {
            descricao: desc,
            valor: valorParcela,
            data: curYmd,
            forma_pagamento: args.forma_pagamento || (card ? 'CARTAO_CREDITO' : 'PIX'),
            recorrente: !!args.recorrente,
            notes: args.notas || null,
            month_id: fm.id,
            family_id: fam.id,
            category_id: cat?.id || null,
            subcategory_id: sub?.id || null,
            credit_card_id: card?.id || null,
          },
        });
        created.push({ id: rec.id, descricao: rec.descricao, valor: rec.valor, data: rec.data, competencia: curComp });
        if (card) {
          competenciasCartao.add(calcularCompetenciaFatura(curYmd, card.dia_fechamento || 1));
        }
      }

      if (card) {
        for (const compFat of competenciasCartao) {
          await recalcularFaturaCartao(card.id, compFat, fam.id);
        }
      }

      return {
        escopo: 'PESSOAL',
        familia: fam.nome_familia,
        categoria: cat?.nome || null,
        cartao: card?.nome || null,
        criados: created,
      };
    },
  },
  {
    name: 'lancar_receita',
    description: 'Lança uma receita pessoal (salário, rendimento, freela, reembolso) no mês correspondente.',
    readOnly: false,
    schema: {
      descricao: z.string().min(1),
      valor: z.number().positive(),
      data: z.string().optional().describe('Data AAAA-MM-DD (padrão: hoje)'),
      categoria: z.string().optional().describe('Nome da categoria de receita (ex.: Salário, Investimentos)'),
      tipo: z.string().optional().describe('Ex.: FIXA ou VARIAVEL'),
      recorrente: z.boolean().optional(),
      familia: z.string().optional(),
    },
    handler: async (ctx, args) => {
      const fam = await resolveFamily(ctx, args.familia);
      const dataStr = (args.data || todayYmd()).slice(0, 10);
      const comp = dataStr.slice(0, 7);
      const fm = await ensureMonth(fam.id, comp);
      const cat = args.categoria ? await findCategory(fam.id, args.categoria, 'RECEITA') : null;

      const rec = await prisma.income.create({
        data: {
          descricao: args.descricao,
          valor: round2(args.valor),
          data_recebimento: dataStr,
          tipo: args.tipo || null,
          recorrente: !!args.recorrente,
          month_id: fm.id,
          family_id: fam.id,
          category_id: cat?.id || null,
        },
      });

      return {
        escopo: 'PESSOAL',
        familia: fam.nome_familia,
        receita: {
          id: rec.id,
          descricao: rec.descricao,
          valor: rec.valor,
          data: rec.data_recebimento,
          competencia: comp,
          categoria: cat?.nome || null,
        },
      };
    },
  },
  {
    name: 'editar_lancamento',
    description: 'Edita uma despesa ou receita pessoal existente pelo ID (retornado por listar_lancamentos).',
    readOnly: false,
    schema: {
      id: z.string().min(1),
      tipo: z.enum(['DESPESA', 'RECEITA']),
      descricao: z.string().optional(),
      valor: z.number().positive().optional(),
      data: z.string().optional().describe('AAAA-MM-DD'),
      categoria: z.string().optional(),
      forma_pagamento: z.string().optional(),
      notas: z.string().optional(),
    },
    handler: async (ctx, args) => {
      const families = await getUserFamilies(ctx);
      const famIds = new Set(families.map((f) => f.id));

      if (args.tipo === 'DESPESA') {
        const exp = await prisma.expense.findUnique({
          where: { id: args.id },
          include: { month: { select: { family_id: true } }, creditCard: true },
        });
        const ownerFamId = exp?.family_id || exp?.month?.family_id;
        if (!exp || !famIds.has(ownerFamId)) throw notFound('Despesa');

        const patch = {};
        if (args.descricao !== undefined) patch.descricao = args.descricao;
        if (args.valor !== undefined) patch.valor = round2(args.valor);
        if (args.forma_pagamento !== undefined) patch.forma_pagamento = args.forma_pagamento;
        if (args.notas !== undefined) patch.notes = args.notas;
        if (args.categoria !== undefined) {
          const cat = args.categoria ? await findCategory(ownerFamId, args.categoria, 'DESPESA') : null;
          patch.category_id = cat?.id || null;
        }
        if (args.data !== undefined) {
          const dStr = String(args.data).slice(0, 10);
          const fm = await ensureMonth(ownerFamId, dStr.slice(0, 7));
          patch.data = dStr;
          patch.month_id = fm.id;
        }

        const upd = await prisma.expense.update({ where: { id: exp.id }, data: patch });
        if (exp.credit_card_id && exp.creditCard) {
          const diaFech = exp.creditCard.dia_fechamento || 1;
          const comps = new Set([calcularCompetenciaFatura(exp.data, diaFech), calcularCompetenciaFatura(upd.data, diaFech)]);
          for (const c of comps) await recalcularFaturaCartao(exp.credit_card_id, c, ownerFamId);
        }
        return { ok: true, tipo: 'DESPESA', lancamento: { id: upd.id, descricao: upd.descricao, valor: upd.valor, data: upd.data } };
      }

      const inc = await prisma.income.findUnique({
        where: { id: args.id },
        include: { month: { select: { family_id: true } } },
      });
      const ownerFamId = inc?.family_id || inc?.month?.family_id;
      if (!inc || !famIds.has(ownerFamId)) throw notFound('Receita');

      const patch = {};
      if (args.descricao !== undefined) patch.descricao = args.descricao;
      if (args.valor !== undefined) patch.valor = round2(args.valor);
      if (args.categoria !== undefined) {
        const cat = args.categoria ? await findCategory(ownerFamId, args.categoria, 'RECEITA') : null;
        patch.category_id = cat?.id || null;
      }
      if (args.data !== undefined) {
        const dStr = String(args.data).slice(0, 10);
        const fm = await ensureMonth(ownerFamId, dStr.slice(0, 7));
        patch.data_recebimento = dStr;
        patch.month_id = fm.id;
      }
      const upd = await prisma.income.update({ where: { id: inc.id }, data: patch });
      return { ok: true, tipo: 'RECEITA', lancamento: { id: upd.id, descricao: upd.descricao, valor: upd.valor, data: upd.data_recebimento } };
    },
  },
  {
    name: 'excluir_lancamento',
    description: 'Exclui uma despesa ou receita pessoal pelo ID. Se for despesa no cartão de crédito, recalcula a fatura.',
    readOnly: false,
    schema: {
      id: z.string().min(1),
      tipo: z.enum(['DESPESA', 'RECEITA']),
    },
    handler: async (ctx, args) => {
      const families = await getUserFamilies(ctx);
      const famIds = new Set(families.map((f) => f.id));

      if (args.tipo === 'DESPESA') {
        const exp = await prisma.expense.findUnique({
          where: { id: args.id },
          include: { month: { select: { family_id: true } }, creditCard: true },
        });
        const ownerFamId = exp?.family_id || exp?.month?.family_id;
        if (!exp || !famIds.has(ownerFamId)) throw notFound('Despesa');
        await prisma.expense.delete({ where: { id: exp.id } });
        if (exp.credit_card_id && exp.creditCard && exp.data) {
          const compFat = calcularCompetenciaFatura(exp.data, exp.creditCard.dia_fechamento || 1);
          await recalcularFaturaCartao(exp.credit_card_id, compFat, ownerFamId);
        }
        return { ok: true, excluido: { id: exp.id, tipo: 'DESPESA', descricao: exp.descricao } };
      }

      const inc = await prisma.income.findUnique({
        where: { id: args.id },
        include: { month: { select: { family_id: true } } },
      });
      const ownerFamId = inc?.family_id || inc?.month?.family_id;
      if (!inc || !famIds.has(ownerFamId)) throw notFound('Receita');
      await prisma.income.delete({ where: { id: inc.id } });
      return { ok: true, excluido: { id: inc.id, tipo: 'RECEITA', descricao: inc.descricao } };
    },
  },
  {
    name: 'metas_dividas_caixinhas',
    description: 'Lista metas financeiras, dívidas ativas, caixinhas de investimento e bens/patrimônio da família.',
    readOnly: true,
    schema: {
      familia: z.string().optional(),
    },
    handler: async (ctx, { familia }) => {
      const fam = await resolveFamily(ctx, familia);
      const [metas, dividas, caixinhas, bens] = await Promise.all([
        prisma.goal.findMany({ where: { family_id: fam.id, ativo: true }, orderBy: { created_date: 'asc' } }),
        prisma.debt.findMany({ where: { family_id: fam.id, status: 'ATIVA' }, orderBy: { created_date: 'asc' } }),
        prisma.investmentBox.findMany({ where: { family_id: fam.id, ativo: true }, orderBy: { created_date: 'asc' } }),
        prisma.asset.findMany({ where: { family_id: fam.id, ativo: true }, orderBy: { created_date: 'asc' } }),
      ]);
      return {
        familia: fam.nome_familia,
        metas: metas.map((g) => ({ id: g.id, nome: g.nome, tipo: g.tipo, valor_alvo: round2(g.valor_alvo), valor_atual: round2(g.valor_atual), prazo: g.prazo, concluida: g.concluida })),
        dividas: dividas.map((d) => ({ id: d.id, nome: d.nome_divida, credor: d.credor, saldo_atual: round2(d.saldo_atual), juros_mensal_percent: d.juros_mensal_percent, vencimento_dia: d.vencimento_dia })),
        caixinhas: caixinhas.map((b) => ({ id: b.id, nome: b.nome, objetivo: b.objetivo, saldo_atual: round2(b.saldo_atual), tipo_rendimento: b.tipo_rendimento })),
        patrimonio: bens.map((a) => ({ id: a.id, nome: a.nome, tipo: a.tipo, valor: round2(a.valor) })),
      };
    },
  },
  {
    name: 'lancar_caixinha',
    description: 'Registra um aporte ou resgate em uma caixinha de investimento pessoal e atualiza o saldo.',
    readOnly: false,
    schema: {
      caixinha: z.string().min(1).describe('Nome ou ID da caixinha de investimento'),
      valor: z.number().positive(),
      tipo: z.enum(['APORTE', 'RESGATE']).optional().describe('Padrão: APORTE'),
      data: z.string().optional().describe('Data AAAA-MM-DD (padrão: hoje)'),
      descricao: z.string().optional(),
      familia: z.string().optional(),
    },
    handler: async (ctx, args) => {
      const fam = await resolveFamily(ctx, args.familia);
      const boxes = await prisma.investmentBox.findMany({ where: { family_id: fam.id, ativo: true } });
      const q = String(args.caixinha).trim();
      const ql = q.toLowerCase();
      const box = boxes.find((b) => b.id === q || b.nome.toLowerCase() === ql)
        || boxes.find((b) => b.nome.toLowerCase().includes(ql));
      if (!box) {
        throw badRequest(`Caixinha "${q}" não encontrada na família "${fam.nome_familia}". Disponíveis: ${boxes.map((b) => b.nome).join(', ') || 'nenhuma'}.`);
      }

      const tipo = args.tipo === 'RESGATE' ? 'RESGATE' : 'APORTE';
      const val = round2(args.valor);
      const novoSaldo = round2(tipo === 'RESGATE' ? (box.saldo_atual || 0) - val : (box.saldo_atual || 0) + val);

      const [dep, upd] = await prisma.$transaction([
        prisma.investmentDeposit.create({
          data: {
            box_id: box.id,
            valor: val,
            tipo,
            data: (args.data || todayYmd()).slice(0, 10),
            descricao: args.descricao || null,
          },
        }),
        prisma.investmentBox.update({
          where: { id: box.id },
          data: { saldo_atual: novoSaldo },
        }),
      ]);

      return { familia: fam.nome_familia, caixinha: upd.nome, tipo, valor: val, novo_saldo: upd.saldo_atual, deposito_id: dep.id };
    },
  },
  {
    name: 'definir_orcamento',
    description: 'Define ou atualiza o valor orçado de uma categoria de despesa para um mês (AAAA-MM).',
    readOnly: false,
    schema: {
      categoria: z.string().min(1),
      valor_orcado: z.number().min(0),
      competencia: z.string().optional().describe('Mês AAAA-MM (padrão: mês atual)'),
      familia: z.string().optional(),
    },
    handler: async (ctx, args) => {
      const fam = await resolveFamily(ctx, args.familia);
      const comp = String(args.competencia || currentYm()).slice(0, 7);
      const fm = await ensureMonth(fam.id, comp);
      const cat = await findCategory(fam.id, args.categoria, 'DESPESA');
      if (!cat) throw badRequest(`Categoria de despesa "${args.categoria}" não encontrada na família "${fam.nome_familia}".`);

      const budget = await prisma.budget.upsert({
        where: { month_id_category_id: { month_id: fm.id, category_id: cat.id } },
        create: {
          month_id: fm.id,
          category_id: cat.id,
          family_id: fam.id,
          tipo_orcamento: 'VALOR_FIXO',
          valor_orcado: round2(args.valor_orcado),
        },
        update: {
          tipo_orcamento: 'VALOR_FIXO',
          valor_orcado: round2(args.valor_orcado),
        },
      });

      return { familia: fam.nome_familia, competencia: comp, categoria: cat.nome, valor_orcado: budget.valor_orcado };
    },
  },
];

module.exports = { TOOLS, getUserFamilies };
