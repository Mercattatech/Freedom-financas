// Ferramentas MCP do módulo Freedom Pessoal / Familiar (100% isoladas por usuário/família)
const { z } = require('zod');
const prisma = require('../business/db');
const { badRequest, notFound } = require('../business/lib/errors');
const { recalcularFaturaCartao, calcularCompetenciaFatura } = require('../services/creditCardBill');

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
  {
    name: 'gerenciar_familia',
    description: 'Cria uma nova família (já com categorias padrão) ou edita nome, tipo e moeda de uma família existente.',
    readOnly: false,
    schema: {
      acao: z.enum(['criar', 'editar']),
      familia: z.string().optional().describe('Nome ou ID da família (para editar)'),
      nome_familia: z.string().optional().describe('Nome da família'),
      tipo_familia: z.string().optional().describe('Ex.: SEM_FILHOS, 2_FILHOS, 3_FILHOS...'),
      moeda: z.string().optional().describe('Padrão: BRL'),
    },
    handler: async (ctx, args) => {
      if (args.acao === 'criar') {
        if (ctx.familyId) throw badRequest('Este token está restrito a uma única família e não pode criar outras.');
        const nome = String(args.nome_familia || '').trim();
        if (!nome) throw badRequest('Informe nome_familia');
        const fam = await prisma.$transaction(async (tx) => {
          const created = await tx.family.create({
            data: {
              nome_familia: nome,
              tipo_familia: args.tipo_familia || 'SEM_FILHOS',
              moeda: args.moeda || 'BRL',
              created_by: ctx.email,
            },
          });
          for (const cat of DEFAULT_CATEGORIES) {
            const c = await tx.category.create({
              data: { nome: cat.nome, tipo: cat.tipo, cor: cat.cor, icone: cat.icone, family_id: created.id, ativo: true },
            });
            await tx.subcategory.createMany({ data: cat.subs.map((s) => ({ nome: s, category_id: c.id, ativo: true })) });
          }
          return created;
        }, { timeout: 20000 });
        return { ok: true, acao: 'criar', familia: fam };
      }
      const fam = await resolveFamily(ctx, args.familia);
      const upd = await prisma.family.update({
        where: { id: fam.id },
        data: {
          ...(args.nome_familia && { nome_familia: String(args.nome_familia).trim() }),
          ...(args.tipo_familia && { tipo_familia: args.tipo_familia }),
          ...(args.moeda && { moeda: args.moeda }),
        },
      });
      return { ok: true, acao: 'editar', familia: upd };
    },
  },
  {
    name: 'gerenciar_categoria',
    description: 'Cria, edita ou desativa (exclui com segurança) uma categoria pessoal de DESPESA ou RECEITA.',
    readOnly: false,
    schema: {
      acao: z.enum(['criar', 'editar', 'excluir']),
      familia: z.string().optional(),
      id: z.string().optional(),
      nome: z.string().optional().describe('Nome da categoria'),
      novo_nome: z.string().optional(),
      tipo: z.enum(['DESPESA', 'RECEITA']).optional(),
      cor: z.string().optional(),
      icone: z.string().optional(),
    },
    handler: async (ctx, args) => {
      const fam = await resolveFamily(ctx, args.familia);
      if (args.acao === 'criar') {
        if (!args.nome || !args.tipo) throw badRequest('Informe nome e tipo (DESPESA ou RECEITA)');
        const cat = await prisma.category.create({
          data: { nome: args.nome.trim(), tipo: args.tipo, cor: args.cor || '#10B981', icone: args.icone || null, family_id: fam.id, ativo: true },
        });
        return { ok: true, familia: fam.nome_familia, categoria: cat };
      }
      const cat = args.id
        ? await prisma.category.findFirst({ where: { id: args.id, family_id: fam.id } })
        : await findCategory(fam.id, args.nome, args.tipo);
      if (!cat) throw notFound('Categoria');
      if (args.acao === 'excluir') {
        await prisma.category.update({ where: { id: cat.id }, data: { ativo: false } });
        return { ok: true, familia: fam.nome_familia, desativada: cat.nome };
      }
      const upd = await prisma.category.update({
        where: { id: cat.id },
        data: {
          ...(args.novo_nome && { nome: args.novo_nome.trim() }),
          ...(args.tipo && { tipo: args.tipo }),
          ...(args.cor && { cor: args.cor }),
          ...(args.icone !== undefined && { icone: args.icone }),
        },
      });
      return { ok: true, familia: fam.nome_familia, categoria: upd };
    },
  },
  {
    name: 'gerenciar_subcategoria',
    description: 'Cria, renomeia ou desativa uma subcategoria vinculada a uma categoria.',
    readOnly: false,
    schema: {
      acao: z.enum(['criar', 'editar', 'excluir']),
      familia: z.string().optional(),
      categoria: z.string().min(1).describe('Nome ou ID da categoria pai'),
      id: z.string().optional(),
      nome: z.string().optional(),
      novo_nome: z.string().optional(),
    },
    handler: async (ctx, args) => {
      const fam = await resolveFamily(ctx, args.familia);
      const cat = await findCategory(fam.id, args.categoria);
      if (!cat) throw notFound('Categoria');
      if (args.acao === 'criar') {
        if (!args.nome) throw badRequest('Informe nome da subcategoria');
        const sub = await prisma.subcategory.create({ data: { nome: args.nome.trim(), category_id: cat.id, ativo: true } });
        return { ok: true, familia: fam.nome_familia, categoria: cat.nome, subcategoria: sub };
      }
      const sub = args.id
        ? await prisma.subcategory.findFirst({ where: { id: args.id, category_id: cat.id } })
        : await findSubcategory(cat.id, args.nome);
      if (!sub) throw notFound('Subcategoria');
      if (args.acao === 'excluir') {
        await prisma.subcategory.update({ where: { id: sub.id }, data: { ativo: false } });
        return { ok: true, familia: fam.nome_familia, categoria: cat.nome, desativada: sub.nome };
      }
      const upd = await prisma.subcategory.update({
        where: { id: sub.id },
        data: { ...(args.novo_nome && { nome: args.novo_nome.trim() }) },
      });
      return { ok: true, familia: fam.nome_familia, categoria: cat.nome, subcategoria: upd };
    },
  },
  {
    name: 'gerenciar_cartao',
    description: 'Cadastra, edita ou desativa um cartão de crédito pessoal (limite, bandeira, dia de fechamento e vencimento).',
    readOnly: false,
    schema: {
      acao: z.enum(['criar', 'editar', 'excluir']),
      familia: z.string().optional(),
      id: z.string().optional(),
      nome: z.string().optional(),
      novo_nome: z.string().optional(),
      bandeira: z.string().optional().describe('VISA, MASTERCARD, ELO, AMEX, HIPERCARD, OUTRO'),
      ultimos_digitos: z.string().optional(),
      limite: z.number().min(0).optional(),
      dia_fechamento: z.number().int().min(1).max(31).optional(),
      dia_vencimento: z.number().int().min(1).max(31).optional(),
      cor: z.string().optional(),
    },
    handler: async (ctx, args) => {
      const fam = await resolveFamily(ctx, args.familia);
      if (args.acao === 'criar') {
        if (!args.nome) throw badRequest('Informe nome do cartão');
        const cc = await prisma.creditCard.create({
          data: {
            nome: args.nome.trim(),
            bandeira: args.bandeira || 'VISA',
            ultimos_digitos: args.ultimos_digitos || null,
            limite: args.limite ?? 0,
            dia_fechamento: args.dia_fechamento ?? 1,
            dia_vencimento: args.dia_vencimento ?? 10,
            cor: args.cor || '#6366F1',
            family_id: fam.id,
          },
        });
        return { ok: true, familia: fam.nome_familia, cartao: cc };
      }
      const cc = args.id
        ? await prisma.creditCard.findFirst({ where: { id: args.id, family_id: fam.id } })
        : await findCard(fam.id, args.nome);
      if (!cc) throw notFound('Cartão de crédito');
      if (args.acao === 'excluir') {
        await prisma.creditCard.update({ where: { id: cc.id }, data: { ativo: false } });
        return { ok: true, familia: fam.nome_familia, desativado: cc.nome };
      }
      const upd = await prisma.creditCard.update({
        where: { id: cc.id },
        data: {
          ...(args.novo_nome && { nome: args.novo_nome.trim() }),
          ...(args.bandeira && { bandeira: args.bandeira }),
          ...(args.ultimos_digitos !== undefined && { ultimos_digitos: args.ultimos_digitos }),
          ...(args.limite !== undefined && { limite: args.limite }),
          ...(args.dia_fechamento !== undefined && { dia_fechamento: args.dia_fechamento }),
          ...(args.dia_vencimento !== undefined && { dia_vencimento: args.dia_vencimento }),
          ...(args.cor && { cor: args.cor }),
        },
      });
      return { ok: true, familia: fam.nome_familia, cartao: upd };
    },
  },
  {
    name: 'fatura_cartao',
    description: 'Detalha a fatura de um cartão de crédito em um mês (AAAA-MM): compras lançadas na competência da fatura, total e limite disponível.',
    readOnly: true,
    schema: {
      cartao: z.string().min(1).describe('Nome ou ID do cartão'),
      competencia: z.string().optional().describe('Mês AAAA-MM (padrão: mês atual)'),
      familia: z.string().optional(),
    },
    handler: async (ctx, args) => {
      const fam = await resolveFamily(ctx, args.familia);
      const card = await findCard(fam.id, args.cartao);
      if (!card) throw notFound('Cartão de crédito');
      const comp = String(args.competencia || currentYm()).slice(0, 7);
      const diaFech = card.dia_fechamento || 1;

      const all = await prisma.expense.findMany({
        where: { credit_card_id: card.id, is_fatura_cartao: false },
        include: { category: { select: { nome: true } } },
        orderBy: { data: 'desc' },
      });
      const itens = all.filter((e) => e.data && calcularCompetenciaFatura(e.data, diaFech) === comp);
      const total_fatura = round2(itens.reduce((s, e) => s + (e.valor || 0), 0));
      const limite = round2(card.limite || 0);
      return {
        familia: fam.nome_familia,
        cartao: card.nome,
        bandeira: card.bandeira,
        dia_fechamento: diaFech,
        dia_vencimento: card.dia_vencimento,
        competencia: comp,
        total_fatura,
        limite,
        limite_disponivel: limite > 0 ? round2(limite - total_fatura) : null,
        lancamentos: itens.map((e) => ({ id: e.id, data: e.data, descricao: e.descricao, valor: round2(e.valor), categoria: e.category?.nome || null })),
      };
    },
  },
  {
    name: 'listar_recorrentes',
    description: 'Lista as contas fixas/recorrentes mensais cadastradas na família (aluguel, internet, escola, assinaturas).',
    readOnly: true,
    schema: {
      familia: z.string().optional(),
      incluir_inativas: z.boolean().optional(),
    },
    handler: async (ctx, args) => {
      const fam = await resolveFamily(ctx, args.familia);
      const rows = await prisma.recurringExpense.findMany({
        where: { family_id: fam.id, ...(!args.incluir_inativas ? { ativo: true } : {}) },
        orderBy: { dia_vencimento: 'asc' },
      });
      const cats = await prisma.category.findMany({ where: { family_id: fam.id }, select: { id: true, nome: true } });
      const catMap = Object.fromEntries(cats.map((c) => [c.id, c.nome]));
      const total_mensal = round2(rows.filter((r) => r.ativo).reduce((s, r) => s + (r.valor || 0), 0));
      return {
        familia: fam.nome_familia,
        total_mensal,
        itens: rows.map((r) => ({
          id: r.id, descricao: r.descricao, valor: round2(r.valor), dia_vencimento: r.dia_vencimento,
          categoria: catMap[r.category_id] || null, forma_pagamento: r.forma_pagamento, ativo: r.ativo,
        })),
      };
    },
  },
  {
    name: 'gerenciar_recorrente',
    description: 'Cria, edita ou exclui uma despesa fixa recorrente da família.',
    readOnly: false,
    schema: {
      acao: z.enum(['criar', 'editar', 'excluir']),
      familia: z.string().optional(),
      id: z.string().optional(),
      descricao: z.string().optional(),
      valor: z.number().positive().optional(),
      categoria: z.string().optional(),
      subcategoria: z.string().optional(),
      forma_pagamento: z.string().optional(),
      dia_vencimento: z.number().int().min(1).max(31).optional(),
      ativo: z.boolean().optional(),
    },
    handler: async (ctx, args) => {
      const fam = await resolveFamily(ctx, args.familia);
      if (args.acao === 'criar') {
        if (!args.descricao || !args.valor || !args.categoria) throw badRequest('Informe descricao, valor e categoria');
        const cat = await findCategory(fam.id, args.categoria, 'DESPESA');
        if (!cat) throw badRequest(`Categoria "${args.categoria}" não encontrada na família "${fam.nome_familia}".`);
        const sub = args.subcategoria ? await findSubcategory(cat.id, args.subcategoria) : null;
        const rec = await prisma.recurringExpense.create({
          data: {
            descricao: args.descricao.trim(),
            valor: round2(args.valor),
            category_id: cat.id,
            subcategory_id: sub?.id || null,
            forma_pagamento: args.forma_pagamento || 'PIX',
            dia_vencimento: args.dia_vencimento || 10,
            ativo: args.ativo !== false,
            family_id: fam.id,
          },
        });
        return { ok: true, familia: fam.nome_familia, recorrente: rec };
      }
      const existing = args.id
        ? await prisma.recurringExpense.findFirst({ where: { id: args.id, family_id: fam.id } })
        : (args.descricao ? await prisma.recurringExpense.findFirst({ where: { family_id: fam.id, descricao: { contains: args.descricao, mode: 'insensitive' } } }) : null);
      if (!existing) throw notFound('Despesa recorrente');
      if (args.acao === 'excluir') {
        await prisma.recurringExpense.delete({ where: { id: existing.id } });
        return { ok: true, familia: fam.nome_familia, excluida: existing.descricao };
      }
      const patch = {};
      if (args.descricao !== undefined && args.id) patch.descricao = args.descricao.trim();
      if (args.valor !== undefined) patch.valor = round2(args.valor);
      if (args.forma_pagamento !== undefined) patch.forma_pagamento = args.forma_pagamento;
      if (args.dia_vencimento !== undefined) patch.dia_vencimento = args.dia_vencimento;
      if (args.ativo !== undefined) patch.ativo = args.ativo;
      if (args.categoria) {
        const cat = await findCategory(fam.id, args.categoria, 'DESPESA');
        if (cat) patch.category_id = cat.id;
      }
      const upd = await prisma.recurringExpense.update({ where: { id: existing.id }, data: patch });
      return { ok: true, familia: fam.nome_familia, recorrente: upd };
    },
  },
  {
    name: 'aplicar_recorrentes_mes',
    description: 'Lança automaticamente no mês (AAAA-MM) todas as despesas fixas recorrentes ativas que ainda não foram lançadas nele.',
    readOnly: false,
    schema: {
      competencia: z.string().optional().describe('Mês AAAA-MM (padrão: mês atual)'),
      familia: z.string().optional(),
    },
    handler: async (ctx, args) => {
      const fam = await resolveFamily(ctx, args.familia);
      const comp = String(args.competencia || currentYm()).slice(0, 7);
      const fm = await ensureMonth(fam.id, comp);
      const [recs, existing] = await Promise.all([
        prisma.recurringExpense.findMany({ where: { family_id: fam.id, ativo: true } }),
        prisma.expense.findMany({ where: { month_id: fm.id } }),
      ]);
      const existingKeys = new Set(existing.map((e) => `${(e.descricao || '').toLowerCase()}::${round2(e.valor)}`));
      const criadas = [];
      for (const r of recs) {
        const key = `${r.descricao.toLowerCase()}::${round2(r.valor)}`;
        if (existingKeys.has(key)) continue;
        const dia = String(Math.min(28, Math.max(1, r.dia_vencimento || 10))).padStart(2, '0');
        const created = await prisma.expense.create({
          data: {
            descricao: r.descricao,
            valor: round2(r.valor),
            data: `${comp}-${dia}`,
            forma_pagamento: r.forma_pagamento || 'PIX',
            recorrente: true,
            month_id: fm.id,
            family_id: fam.id,
            category_id: r.category_id,
            subcategory_id: r.subcategory_id,
          },
        });
        criadas.push({ id: created.id, descricao: created.descricao, valor: created.valor, data: created.data });
      }
      return { familia: fam.nome_familia, competencia: comp, quantidade_criada: criadas.length, criadas };
    },
  },
  {
    name: 'gerenciar_meta',
    description: 'Cria, edita, registra aporte ou exclui uma meta financeira pessoal (reserva, viagem, carro, casa).',
    readOnly: false,
    schema: {
      acao: z.enum(['criar', 'editar', 'aportar', 'excluir']),
      familia: z.string().optional(),
      id: z.string().optional(),
      nome: z.string().optional(),
      novo_nome: z.string().optional(),
      tipo: z.string().optional().describe('Ex.: RESERVA, VIAGEM, COMPRA, APOSENTADORIA'),
      valor_alvo: z.number().positive().optional(),
      valor_atual: z.number().min(0).optional(),
      valor_aporte: z.number().positive().optional().describe('Valor a somar na meta (quando acao=aportar)'),
      prazo: z.string().optional().describe('Data ou mês previsto (ex.: 2027-12-31)'),
      descricao: z.string().optional(),
      concluida: z.boolean().optional(),
    },
    handler: async (ctx, args) => {
      const fam = await resolveFamily(ctx, args.familia);
      if (args.acao === 'criar') {
        if (!args.nome || !args.valor_alvo) throw badRequest('Informe nome e valor_alvo');
        const g = await prisma.goal.create({
          data: {
            nome: args.nome.trim(),
            tipo: args.tipo || 'RESERVA',
            valor_alvo: round2(args.valor_alvo),
            valor_atual: round2(args.valor_atual || 0),
            prazo: args.prazo || null,
            descricao: args.descricao || null,
            concluida: round2(args.valor_atual || 0) >= round2(args.valor_alvo),
            family_id: fam.id,
          },
        });
        return { ok: true, familia: fam.nome_familia, meta: g };
      }
      const goal = args.id
        ? await prisma.goal.findFirst({ where: { id: args.id, family_id: fam.id } })
        : (args.nome ? await prisma.goal.findFirst({ where: { family_id: fam.id, ativo: true, nome: { contains: args.nome, mode: 'insensitive' } } }) : null);
      if (!goal) throw notFound('Meta');
      if (args.acao === 'excluir') {
        await prisma.goal.update({ where: { id: goal.id }, data: { ativo: false } });
        return { ok: true, familia: fam.nome_familia, removida: goal.nome };
      }
      if (args.acao === 'aportar') {
        const aporte = round2(args.valor_aporte || args.valor_atual);
        if (!(aporte > 0)) throw badRequest('Informe valor_aporte maior que zero');
        const novo = round2((goal.valor_atual || 0) + aporte);
        const upd = await prisma.goal.update({
          where: { id: goal.id },
          data: { valor_atual: novo, concluida: novo >= goal.valor_alvo },
        });
        return { ok: true, familia: fam.nome_familia, meta: upd };
      }
      const upd = await prisma.goal.update({
        where: { id: goal.id },
        data: {
          ...(args.novo_nome && { nome: args.novo_nome.trim() }),
          ...(args.tipo && { tipo: args.tipo }),
          ...(args.valor_alvo !== undefined && { valor_alvo: round2(args.valor_alvo) }),
          ...(args.valor_atual !== undefined && { valor_atual: round2(args.valor_atual) }),
          ...(args.prazo !== undefined && { prazo: args.prazo }),
          ...(args.descricao !== undefined && { descricao: args.descricao }),
          ...(args.concluida !== undefined && { concluida: args.concluida }),
        },
      });
      return { ok: true, familia: fam.nome_familia, meta: upd };
    },
  },
  {
    name: 'gerenciar_divida',
    description: 'Cadastra, edita ou exclui uma dívida/financiamento/empréstimo da família.',
    readOnly: false,
    schema: {
      acao: z.enum(['criar', 'editar', 'excluir']),
      familia: z.string().optional(),
      id: z.string().optional(),
      nome_divida: z.string().optional(),
      novo_nome: z.string().optional(),
      credor: z.string().optional(),
      tipo: z.string().optional().describe('Ex.: CARTAO, EMPRESTIMO, FINANCIAMENTO, OUTROS'),
      saldo_inicial: z.number().min(0).optional(),
      saldo_atual: z.number().min(0).optional(),
      juros_mensal_percent: z.number().min(0).optional(),
      data_inicio: z.string().optional(),
      vencimento_dia: z.number().int().min(1).max(31).optional(),
      status: z.enum(['ATIVA', 'QUITADA', 'RENEGOCIADA']).optional(),
    },
    handler: async (ctx, args) => {
      const fam = await resolveFamily(ctx, args.familia);
      if (args.acao === 'criar') {
        if (!args.nome_divida) throw badRequest('Informe nome_divida');
        const ini = round2(args.saldo_inicial ?? args.saldo_atual ?? 0);
        const atu = round2(args.saldo_atual ?? args.saldo_inicial ?? 0);
        const d = await prisma.debt.create({
          data: {
            nome_divida: args.nome_divida.trim(),
            credor: args.credor || null,
            tipo: args.tipo || 'OUTROS',
            saldo_inicial: ini,
            saldo_atual: atu,
            juros_mensal_percent: args.juros_mensal_percent ?? null,
            data_inicio: args.data_inicio || todayYmd(),
            vencimento_dia: args.vencimento_dia ?? null,
            status: args.status || 'ATIVA',
            family_id: fam.id,
          },
        });
        return { ok: true, familia: fam.nome_familia, divida: d };
      }
      const debt = args.id
        ? await prisma.debt.findFirst({ where: { id: args.id, family_id: fam.id } })
        : (args.nome_divida ? await prisma.debt.findFirst({ where: { family_id: fam.id, nome_divida: { contains: args.nome_divida, mode: 'insensitive' } } }) : null);
      if (!debt) throw notFound('Dívida');
      if (args.acao === 'excluir') {
        await prisma.debt.delete({ where: { id: debt.id } });
        return { ok: true, familia: fam.nome_familia, excluida: debt.nome_divida };
      }
      const upd = await prisma.debt.update({
        where: { id: debt.id },
        data: {
          ...(args.novo_nome && { nome_divida: args.novo_nome.trim() }),
          ...(args.credor !== undefined && { credor: args.credor }),
          ...(args.tipo && { tipo: args.tipo }),
          ...(args.saldo_inicial !== undefined && { saldo_inicial: round2(args.saldo_inicial) }),
          ...(args.saldo_atual !== undefined && { saldo_atual: round2(args.saldo_atual) }),
          ...(args.juros_mensal_percent !== undefined && { juros_mensal_percent: args.juros_mensal_percent }),
          ...(args.vencimento_dia !== undefined && { vencimento_dia: args.vencimento_dia }),
          ...(args.status && { status: args.status }),
        },
      });
      return { ok: true, familia: fam.nome_familia, divida: upd };
    },
  },
  {
    name: 'pagar_divida',
    description: 'Registra pagamento/amortização de uma dívida, reduzindo o saldo devedor e opcionalmente lançando a saída como despesa do mês.',
    readOnly: false,
    schema: {
      divida: z.string().min(1).describe('Nome ou ID da dívida'),
      valor_pagamento: z.number().positive(),
      data_pagamento: z.string().optional().describe('Data AAAA-MM-DD (padrão: hoje)'),
      lancar_como_despesa: z.boolean().optional().describe('Padrão: true'),
      forma_pagamento: z.string().optional(),
      familia: z.string().optional(),
    },
    handler: async (ctx, args) => {
      const fam = await resolveFamily(ctx, args.familia);
      const q = String(args.divida).trim();
      const debt = (await prisma.debt.findFirst({ where: { id: q, family_id: fam.id } }))
        || (await prisma.debt.findFirst({ where: { family_id: fam.id, nome_divida: { contains: q, mode: 'insensitive' } } }));
      if (!debt) throw notFound('Dívida');

      const val = round2(args.valor_pagamento);
      const dataStr = (args.data_pagamento || todayYmd()).slice(0, 10);
      const novoSaldo = round2(Math.max(0, (debt.saldo_atual || 0) - val));
      const novoStatus = novoSaldo <= 0 ? 'QUITADA' : debt.status;

      let expenseId = null;
      let monthId = null;
      if (args.lancar_como_despesa !== false) {
        const fm = await ensureMonth(fam.id, dataStr.slice(0, 7));
        monthId = fm.id;
        const cat = await findCategory(fam.id, 'Dívidas', 'DESPESA');
        const exp = await prisma.expense.create({
          data: {
            descricao: `Pagamento dívida: ${debt.nome_divida}`,
            valor: val,
            data: dataStr,
            forma_pagamento: args.forma_pagamento || 'PIX',
            month_id: fm.id,
            family_id: fam.id,
            category_id: cat?.id || null,
          },
        });
        expenseId = exp.id;
      }

      const [payment, upd] = await prisma.$transaction([
        prisma.debtPayment.create({
          data: { debt_id: debt.id, valor_pagamento: val, data_pagamento: dataStr, month_id: monthId },
        }),
        prisma.debt.update({
          where: { id: debt.id },
          data: { saldo_atual: novoSaldo, status: novoStatus },
        }),
      ]);

      return { ok: true, familia: fam.nome_familia, divida: upd.nome_divida, pago: val, novo_saldo: upd.saldo_atual, status: upd.status, pagamento_id: payment.id, despesa_id: expenseId };
    },
  },
  {
    name: 'gerenciar_caixinha',
    description: 'Cria, edita ou desativa uma caixinha de investimento pessoal (CDB, reserva, viagem). Para movimentar valor use lancar_caixinha.',
    readOnly: false,
    schema: {
      acao: z.enum(['criar', 'editar', 'excluir']),
      familia: z.string().optional(),
      id: z.string().optional(),
      nome: z.string().optional(),
      novo_nome: z.string().optional(),
      objetivo: z.string().optional(),
      valor_inicial: z.number().min(0).optional(),
      tipo_rendimento: z.string().optional().describe('PERCENTUAL_MENSAL | CDI'),
      taxa_mensal: z.number().min(0).optional(),
      taxa_anual_cdi: z.number().min(0).optional(),
      cor: z.string().optional(),
    },
    handler: async (ctx, args) => {
      const fam = await resolveFamily(ctx, args.familia);
      if (args.acao === 'criar') {
        if (!args.nome) throw badRequest('Informe nome da caixinha');
        const ini = round2(args.valor_inicial || 0);
        const box = await prisma.investmentBox.create({
          data: {
            nome: args.nome.trim(),
            objetivo: args.objetivo || null,
            valor_inicial: ini,
            saldo_atual: ini,
            tipo_rendimento: args.tipo_rendimento || 'PERCENTUAL_MENSAL',
            taxa_mensal: args.taxa_mensal ?? null,
            taxa_anual_cdi: args.taxa_anual_cdi ?? null,
            cor: args.cor || '#10B981',
            family_id: fam.id,
          },
        });
        return { ok: true, familia: fam.nome_familia, caixinha: box };
      }
      const box = args.id
        ? await prisma.investmentBox.findFirst({ where: { id: args.id, family_id: fam.id } })
        : (args.nome ? await prisma.investmentBox.findFirst({ where: { family_id: fam.id, ativo: true, nome: { contains: args.nome, mode: 'insensitive' } } }) : null);
      if (!box) throw notFound('Caixinha');
      if (args.acao === 'excluir') {
        await prisma.investmentBox.update({ where: { id: box.id }, data: { ativo: false } });
        return { ok: true, familia: fam.nome_familia, desativada: box.nome };
      }
      const upd = await prisma.investmentBox.update({
        where: { id: box.id },
        data: {
          ...(args.novo_nome && { nome: args.novo_nome.trim() }),
          ...(args.objetivo !== undefined && { objetivo: args.objetivo }),
          ...(args.tipo_rendimento && { tipo_rendimento: args.tipo_rendimento }),
          ...(args.taxa_mensal !== undefined && { taxa_mensal: args.taxa_mensal }),
          ...(args.taxa_anual_cdi !== undefined && { taxa_anual_cdi: args.taxa_anual_cdi }),
          ...(args.cor && { cor: args.cor }),
        },
      });
      return { ok: true, familia: fam.nome_familia, caixinha: upd };
    },
  },
  {
    name: 'listar_acoes_alertas',
    description: 'Lista a carteira de ações/FIIs/BDRs/ETFs da família (com rentabilidade calculada) e os alertas de preço configurados.',
    readOnly: true,
    schema: { familia: z.string().optional() },
    handler: async (ctx, { familia }) => {
      const fam = await resolveFamily(ctx, familia);
      const [stocks, alerts] = await Promise.all([
        prisma.stockInvestment.findMany({ where: { family_id: fam.id, ativo: true }, orderBy: { ticker: 'asc' } }),
        prisma.stockAlert.findMany({ where: { family_id: fam.id, is_active: true }, orderBy: { ticker: 'asc' } }),
      ]);
      const posicoes = stocks.map((s) => {
        const investido = round2(s.quantidade * s.preco_medio);
        const atualUnit = s.preco_atual ?? s.preco_medio;
        const atual = round2(s.quantidade * atualUnit);
        const resultado = round2(atual - investido);
        return {
          id: s.id,
          ticker: s.ticker,
          nome_empresa: s.nome_empresa,
          tipo: s.tipo,
          setor: s.setor,
          quantidade: s.quantidade,
          preco_medio: round2(s.preco_medio),
          preco_atual: round2(atualUnit),
          valor_investido: investido,
          valor_atual: atual,
          resultado,
          rentabilidade_percent: investido > 0 ? round2((resultado / investido) * 100) : 0,
        };
      });
      const total_investido = round2(posicoes.reduce((s, p) => s + p.valor_investido, 0));
      const total_atual = round2(posicoes.reduce((s, p) => s + p.valor_atual, 0));
      return {
        familia: fam.nome_familia,
        resumo: {
          total_investido,
          total_atual,
          resultado: round2(total_atual - total_investido),
          rentabilidade_percent: total_investido > 0 ? round2(((total_atual - total_investido) / total_investido) * 100) : 0,
        },
        posicoes,
        alertas: alerts,
      };
    },
  },
  {
    name: 'gerenciar_acao',
    description: 'Cadastra, atualiza (quantidade, preço médio/atual) ou remove uma posição na carteira de ações/FIIs.',
    readOnly: false,
    schema: {
      acao: z.enum(['criar', 'editar', 'excluir']),
      familia: z.string().optional(),
      id: z.string().optional(),
      ticker: z.string().optional().describe('Ex.: PETR4, ITUB4, MXRF11'),
      nome_empresa: z.string().optional(),
      tipo: z.string().optional().describe('ACAO | FII | ETF | BDR'),
      quantidade: z.number().positive().optional(),
      preco_medio: z.number().positive().optional(),
      preco_atual: z.number().positive().optional(),
      data_primeira_compra: z.string().optional(),
      setor: z.string().optional(),
    },
    handler: async (ctx, args) => {
      const fam = await resolveFamily(ctx, args.familia);
      const ticker = args.ticker ? String(args.ticker).trim().toUpperCase() : null;
      if (args.acao === 'criar') {
        if (!ticker || !args.quantidade || !args.preco_medio) throw badRequest('Informe ticker, quantidade e preco_medio');
        const stock = await prisma.stockInvestment.create({
          data: {
            ticker,
            nome_empresa: args.nome_empresa || null,
            tipo: args.tipo || 'ACAO',
            quantidade: args.quantidade,
            preco_medio: round2(args.preco_medio),
            preco_atual: args.preco_atual ? round2(args.preco_atual) : round2(args.preco_medio),
            data_primeira_compra: args.data_primeira_compra || todayYmd(),
            setor: args.setor || null,
            family_id: fam.id,
          },
        });
        return { ok: true, familia: fam.nome_familia, ativo: stock };
      }
      const stock = args.id
        ? await prisma.stockInvestment.findFirst({ where: { id: args.id, family_id: fam.id } })
        : (ticker ? await prisma.stockInvestment.findFirst({ where: { family_id: fam.id, ativo: true, ticker } }) : null);
      if (!stock) throw notFound('Ativo na carteira');
      if (args.acao === 'excluir') {
        await prisma.stockInvestment.update({ where: { id: stock.id }, data: { ativo: false } });
        return { ok: true, familia: fam.nome_familia, removido: stock.ticker };
      }
      const upd = await prisma.stockInvestment.update({
        where: { id: stock.id },
        data: {
          ...(args.nome_empresa !== undefined && { nome_empresa: args.nome_empresa }),
          ...(args.tipo && { tipo: args.tipo }),
          ...(args.quantidade !== undefined && { quantidade: args.quantidade }),
          ...(args.preco_medio !== undefined && { preco_medio: round2(args.preco_medio) }),
          ...(args.preco_atual !== undefined && { preco_atual: round2(args.preco_atual) }),
          ...(args.setor !== undefined && { setor: args.setor }),
        },
      });
      return { ok: true, familia: fam.nome_familia, ativo: upd };
    },
  },
  {
    name: 'gerenciar_alerta_acao',
    description: 'Cria ou remove um alerta de preço-alvo (PISO ou TETO) para uma ação/FII.',
    readOnly: false,
    schema: {
      acao: z.enum(['criar', 'excluir']),
      familia: z.string().optional(),
      id: z.string().optional(),
      ticker: z.string().optional(),
      target_price: z.number().positive().optional(),
      alert_type: z.enum(['PISO', 'TETO']).optional(),
    },
    handler: async (ctx, args) => {
      const fam = await resolveFamily(ctx, args.familia);
      if (args.acao === 'criar') {
        if (!args.ticker || !args.target_price || !args.alert_type) throw badRequest('Informe ticker, target_price e alert_type (PISO ou TETO)');
        const al = await prisma.stockAlert.create({
          data: { ticker: args.ticker.trim().toUpperCase(), target_price: round2(args.target_price), alert_type: args.alert_type, family_id: fam.id },
        });
        return { ok: true, familia: fam.nome_familia, alerta: al };
      }
      const al = args.id
        ? await prisma.stockAlert.findFirst({ where: { id: args.id, family_id: fam.id } })
        : (args.ticker ? await prisma.stockAlert.findFirst({ where: { family_id: fam.id, is_active: true, ticker: args.ticker.trim().toUpperCase() } }) : null);
      if (!al) throw notFound('Alerta de preço');
      await prisma.stockAlert.update({ where: { id: al.id }, data: { is_active: false } });
      return { ok: true, familia: fam.nome_familia, desativado: al.ticker };
    },
  },
  {
    name: 'gerenciar_patrimonio',
    description: 'Cadastra, edita ou remove um bem do patrimônio familiar (imóvel, veículo, terreno, herança).',
    readOnly: false,
    schema: {
      acao: z.enum(['criar', 'editar', 'excluir']),
      familia: z.string().optional(),
      id: z.string().optional(),
      nome: z.string().optional(),
      novo_nome: z.string().optional(),
      tipo: z.enum(['IMOVEL', 'VEICULO', 'TERRENO', 'HERANCA', 'OUTROS']).optional(),
      valor: z.number().min(0).optional(),
      descricao: z.string().optional(),
      data_aquisicao: z.string().optional(),
    },
    handler: async (ctx, args) => {
      const fam = await resolveFamily(ctx, args.familia);
      if (args.acao === 'criar') {
        if (!args.nome || args.valor === undefined) throw badRequest('Informe nome e valor do bem');
        const asset = await prisma.asset.create({
          data: {
            nome: args.nome.trim(),
            tipo: args.tipo || 'OUTROS',
            valor: round2(args.valor),
            descricao: args.descricao || null,
            data_aquisicao: args.data_aquisicao || null,
            family_id: fam.id,
          },
        });
        return { ok: true, familia: fam.nome_familia, bem: asset };
      }
      const asset = args.id
        ? await prisma.asset.findFirst({ where: { id: args.id, family_id: fam.id } })
        : (args.nome ? await prisma.asset.findFirst({ where: { family_id: fam.id, ativo: true, nome: { contains: args.nome, mode: 'insensitive' } } }) : null);
      if (!asset) throw notFound('Bem patrimonial');
      if (args.acao === 'excluir') {
        await prisma.asset.update({ where: { id: asset.id }, data: { ativo: false } });
        return { ok: true, familia: fam.nome_familia, removido: asset.nome };
      }
      const upd = await prisma.asset.update({
        where: { id: asset.id },
        data: {
          ...(args.novo_nome && { nome: args.novo_nome.trim() }),
          ...(args.tipo && { tipo: args.tipo }),
          ...(args.valor !== undefined && { valor: round2(args.valor) }),
          ...(args.descricao !== undefined && { descricao: args.descricao }),
          ...(args.data_aquisicao !== undefined && { data_aquisicao: args.data_aquisicao }),
        },
      });
      return { ok: true, familia: fam.nome_familia, bem: upd };
    },
  },
  {
    name: 'evolucao_financeira',
    description: 'Retorna a evolução mês a mês (receitas, despesas, saldo, taxa de poupança) e o patrimônio líquido consolidado (bens + caixinhas + ações − dívidas).',
    readOnly: true,
    schema: {
      meses: z.number().int().min(1).max(24).optional().describe('Quantidade de meses (padrão: 6)'),
      familia: z.string().optional(),
    },
    handler: async (ctx, args) => {
      const fam = await resolveFamily(ctx, args.familia);
      const limit = Math.min(24, Math.max(1, args.meses || 6));
      const [months, assets, boxes, stocks, debts] = await Promise.all([
        prisma.financialMonth.findMany({
          where: { family_id: fam.id },
          orderBy: { competencia: 'desc' },
          take: limit,
          include: {
            incomes: { where: { ativo: true }, select: { valor: true } },
            expenses: { select: { valor: true, credit_card_id: true, is_fatura_cartao: true } },
          },
        }),
        prisma.asset.findMany({ where: { family_id: fam.id, ativo: true }, select: { valor: true } }),
        prisma.investmentBox.findMany({ where: { family_id: fam.id, ativo: true }, select: { saldo_atual: true } }),
        prisma.stockInvestment.findMany({ where: { family_id: fam.id, ativo: true }, select: { quantidade: true, preco_medio: true, preco_atual: true } }),
        prisma.debt.findMany({ where: { family_id: fam.id, status: 'ATIVA' }, select: { saldo_atual: true } }),
      ]);

      const serie = months
        .slice()
        .reverse()
        .map((m) => {
          const rec = round2(m.incomes.reduce((s, i) => s + (i.valor || 0), 0));
          const desp = round2(m.expenses.filter((e) => !e.credit_card_id || e.is_fatura_cartao).reduce((s, e) => s + (e.valor || 0), 0));
          const saldo = round2(rec - desp);
          return {
            competencia: m.competencia,
            receitas: rec,
            despesas: desp,
            saldo,
            taxa_poupanca_percent: rec > 0 ? round2((saldo / rec) * 100) : 0,
          };
        });

      const total_bens = round2(assets.reduce((s, a) => s + (a.valor || 0), 0));
      const total_caixinhas = round2(boxes.reduce((s, b) => s + (b.saldo_atual || 0), 0));
      const total_acoes = round2(stocks.reduce((s, x) => s + x.quantidade * (x.preco_atual ?? x.preco_medio), 0));
      const total_dividas = round2(debts.reduce((s, d) => s + (d.saldo_atual || 0), 0));
      const patrimonio_liquido = round2(total_bens + total_caixinhas + total_acoes - total_dividas);

      return {
        familia: fam.nome_familia,
        patrimonio: { total_bens, total_caixinhas, total_acoes, total_dividas, patrimonio_liquido },
        serie,
      };
    },
  },
];

module.exports = { TOOLS, getUserFamilies };
