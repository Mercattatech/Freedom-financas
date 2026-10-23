// Motor de relatórios gerenciais: DRE, margem por contrato/cliente, margem da agência,
// KPIs de assinatura (MRR, churn), fluxo de caixa projetado e aging.
const prisma = require('../db');
const { num, round2, sum, pct } = require('../lib/money');
const {
  toDate, startOfMonth, endOfMonth, addMonths, addDays, today, ym, ymd, monthsBetween, cycleMonths, withDay,
} = require('../lib/dates');
const contractsSvc = require('./contracts');

// ─────────────────────────── DRE ───────────────────────────
const DRE_GROUPS = {
  RECEITA_BRUTA: 'Receita operacional bruta',
  DEDUCOES: '(-) Deduções e impostos sobre a receita',
  CUSTOS: '(-) Custos dos serviços prestados',
  DESPESAS_PESSOAL: '(-) Despesas com pessoal',
  DESPESAS_ADMINISTRATIVAS: '(-) Despesas administrativas',
  DESPESAS_COMERCIAIS: '(-) Despesas comerciais',
  RECEITAS_FINANCEIRAS: '(+) Receitas financeiras',
  DESPESAS_FINANCEIRAS: '(-) Despesas financeiras',
  IMPOSTOS_LUCRO: '(-) IRPJ e CSLL',
  NAO_OPERACIONAL: 'Movimentações não operacionais',
};

const STRUCTURE = [
  ['grupo', 'RECEITA_BRUTA'],
  ['grupo', 'DEDUCOES'],
  ['subtotal', 'RECEITA_LIQUIDA', '= Receita líquida', ['RECEITA_BRUTA', 'DEDUCOES']],
  ['grupo', 'CUSTOS'],
  ['subtotal', 'LUCRO_BRUTO', '= Lucro bruto', ['RECEITA_BRUTA', 'DEDUCOES', 'CUSTOS']],
  ['grupo', 'DESPESAS_PESSOAL'],
  ['grupo', 'DESPESAS_ADMINISTRATIVAS'],
  ['grupo', 'DESPESAS_COMERCIAIS'],
  ['subtotal', 'EBITDA', '= Resultado operacional (EBITDA)', ['RECEITA_BRUTA', 'DEDUCOES', 'CUSTOS', 'DESPESAS_PESSOAL', 'DESPESAS_ADMINISTRATIVAS', 'DESPESAS_COMERCIAIS']],
  ['grupo', 'RECEITAS_FINANCEIRAS'],
  ['grupo', 'DESPESAS_FINANCEIRAS'],
  ['subtotal', 'LAIR', '= Resultado antes do IR/CSLL', ['RECEITA_BRUTA', 'DEDUCOES', 'CUSTOS', 'DESPESAS_PESSOAL', 'DESPESAS_ADMINISTRATIVAS', 'DESPESAS_COMERCIAIS', 'RECEITAS_FINANCEIRAS', 'DESPESAS_FINANCEIRAS']],
  ['grupo', 'IMPOSTOS_LUCRO'],
  ['subtotal', 'LUCRO_LIQUIDO', '= Lucro líquido', ['RECEITA_BRUTA', 'DEDUCOES', 'CUSTOS', 'DESPESAS_PESSOAL', 'DESPESAS_ADMINISTRATIVAS', 'DESPESAS_COMERCIAIS', 'RECEITAS_FINANCEIRAS', 'DESPESAS_FINANCEIRAS', 'IMPOSTOS_LUCRO']],
  ['grupo', 'NAO_OPERACIONAL'],
  ['subtotal', 'GERACAO_CAIXA', '= Resultado após não operacionais', ['RECEITA_BRUTA', 'DEDUCOES', 'CUSTOS', 'DESPESAS_PESSOAL', 'DESPESAS_ADMINISTRATIVAS', 'DESPESAS_COMERCIAIS', 'RECEITAS_FINANCEIRAS', 'DESPESAS_FINANCEIRAS', 'IMPOSTOS_LUCRO', 'NAO_OPERACIONAL']],
];

const grupoDe = (t) => t.account?.grupo_dre || (t.tipo === 'RECEITA' ? 'RECEITA_BRUTA' : 'DESPESAS_ADMINISTRATIVAS');
const signed = (t, v) => (t.tipo === 'RECEITA' ? num(v) : -num(v));

async function loadTransactions(ctx, from, to, regime) {
  const where = { company_id: ctx.companyId, status: { not: 'CANCELADO' } };
  if (regime === 'caixa') {
    where.data_pagamento = { gte: from, lte: to };
    where.valor_pago = { gt: 0 };
  } else {
    where.competencia = { gte: startOfMonth(from), lte: to };
  }
  return prisma.bizTransaction.findMany({
    where,
    include: { account: { select: { id: true, codigo: true, nome: true, grupo_dre: true, custo_direto: true, fixa: true } } },
  });
}

/**
 * DRE gerencial mês a mês.
 * regime=competencia (padrão): usa competência e valor do título.
 * regime=caixa: usa data e valor efetivamente pagos.
 */
async function dre(ctx, { from, to, regime = 'competencia' } = {}) {
  from = startOfMonth(from || today());
  to = endOfMonth(to || from);
  const meses = monthsBetween(from, to).map(ym);
  const rows = await loadTransactions(ctx, from, to, regime);

  const groups = {}; // grupo -> { contas: { key: {label, valores} }, valores }
  const add = (grupo, contaKey, contaLabel, mes, v) => {
    if (!v) return;
    groups[grupo] ||= { contas: {}, valores: {} };
    const g = groups[grupo];
    g.contas[contaKey] ||= { label: contaLabel, valores: {} };
    g.contas[contaKey].valores[mes] = round2((g.contas[contaKey].valores[mes] || 0) + v);
    g.valores[mes] = round2((g.valores[mes] || 0) + v);
  };

  for (const t of rows) {
    const mes = ym(regime === 'caixa' ? t.data_pagamento : t.competencia);
    if (!meses.includes(mes)) continue;
    const valor = regime === 'caixa' ? t.valor_pago : t.valor;
    const grupo = grupoDe(t);
    const contaKey = t.account ? t.account.codigo : `SEM_${t.tipo}`;
    const contaLabel = t.account ? `${t.account.codigo} ${t.account.nome}` : 'Sem classificação';
    add(grupo, contaKey, contaLabel, mes, signed(t, valor));
    // Tarifa do gateway (Asaas) vira despesa financeira automaticamente
    if (num(t.taxa) > 0 && t.tipo === 'RECEITA') add('DESPESAS_FINANCEIRAS', 'TARIFA_GATEWAY', 'Tarifas de cobrança (Asaas)', mes, -num(t.taxa));
  }

  const totalOf = (valores) => round2(Object.values(valores).reduce((a, b) => a + b, 0));
  const receitaTotal = totalOf(groups.RECEITA_BRUTA?.valores || {});
  const linhas = [];
  for (const [kind, key, label, comp] of STRUCTURE) {
    if (kind === 'grupo') {
      const g = groups[key] || { contas: {}, valores: {} };
      const total = totalOf(g.valores);
      linhas.push({ key, label: DRE_GROUPS[key], tipo: 'grupo', valores: g.valores, total, av: pct(total, receitaTotal) });
      for (const [ck, c] of Object.entries(g.contas).sort(([a], [b]) => a.localeCompare(b))) {
        const ct = totalOf(c.valores);
        linhas.push({ key: `${key}:${ck}`, label: c.label, tipo: 'conta', grupo: key, valores: c.valores, total: ct, av: pct(ct, receitaTotal) });
      }
    } else {
      const valores = {};
      for (const m of meses) valores[m] = round2(comp.reduce((acc, gk) => acc + (groups[gk]?.valores[m] || 0), 0));
      const total = totalOf(valores);
      linhas.push({ key, label, tipo: 'subtotal', valores, total, av: pct(total, receitaTotal) });
    }
  }
  const L = Object.fromEntries(linhas.filter((l) => l.tipo !== 'conta').map((l) => [l.key, l.total]));
  return {
    periodo: { from: ymd(from), to: ymd(to) },
    regime,
    meses,
    linhas,
    totais: L,
    indicadores: {
      receita_bruta: L.RECEITA_BRUTA,
      receita_liquida: L.RECEITA_LIQUIDA,
      lucro_bruto: L.LUCRO_BRUTO,
      ebitda: L.EBITDA,
      lucro_liquido: L.LUCRO_LIQUIDO,
      margem_bruta: pct(L.LUCRO_BRUTO, L.RECEITA_BRUTA),
      margem_ebitda: pct(L.EBITDA, L.RECEITA_BRUTA),
      margem_liquida: pct(L.LUCRO_LIQUIDO, L.RECEITA_BRUTA),
    },
  };
}

// ─────────────────────── Margem por contrato ───────────────────────
const OVERHEAD_GROUPS = ['CUSTOS', 'DESPESAS_PESSOAL', 'DESPESAS_ADMINISTRATIVAS', 'DESPESAS_COMERCIAIS'];

function monthsActiveIn(c, from, to) {
  const ini = startOfMonth(c.data_inicio);
  const fimC = c.data_fim ? startOfMonth(c.data_fim) : null;
  const canc = c.cancelado_em ? startOfMonth(c.cancelado_em) : null;
  let n = 0;
  for (const m of monthsBetween(from, to)) {
    if (m < ini) continue;
    if (fimC && m > fimC) continue;
    if (canc && m > canc) continue;
    if (c.status === 'RASCUNHO') continue;
    n++;
  }
  return n;
}

/**
 * Margem de contribuição por contrato no período (regime de competência):
 * receita − impostos − comissão − custos diretos − tarifas − mão de obra (horas × custo/hora) − produtos.
 * Depois rateia o overhead não alocado (por receita ou horas) para chegar à margem líquida.
 */
async function contractsMargin(ctx, { from, to, contract_id, client_id } = {}) {
  from = startOfMonth(from || today());
  to = endOfMonth(to || from);
  const company = await prisma.bizCompany.findUnique({ where: { id: ctx.companyId } });
  const meta = num(company.meta_margem_contrato);

  // Sempre calcula todos os contratos: o rateio do overhead depende da base completa.
  // Filtros por contrato/cliente são aplicados só no resultado.
  const whereC = { company_id: ctx.companyId, status: { not: 'RASCUNHO' } };
  const contracts = await prisma.bizContract.findMany({ where: whereC, include: { client: { select: { id: true, nome: true, nome_fantasia: true } } } });

  const [txs, entries, moves] = await Promise.all([
    prisma.bizTransaction.findMany({
      where: { company_id: ctx.companyId, status: { not: 'CANCELADO' }, competencia: { gte: from, lte: to } },
      include: { account: { select: { grupo_dre: true, nome: true, codigo: true } } },
    }),
    prisma.bizTimeEntry.findMany({ where: { company_id: ctx.companyId, data: { gte: from, lte: to } } }),
    prisma.bizStockMovement.findMany({ where: { company_id: ctx.companyId, tipo: 'SAIDA', data: { gte: from, lte: to }, contract_id: { not: null } } }),
  ]);

  const byContract = {};
  const acc = (id) => (byContract[id] ||= { receita: 0, recebido: 0, custos_diretos: 0, custos_detalhe: {}, taxas: 0, horas: 0, mao_obra: 0, produtos: 0 });

  let overheadBruto = 0;
  let receitaSemContrato = 0;
  const receitaSemContratoPorCliente = {};
  for (const t of txs) {
    const g = t.account?.grupo_dre || (t.tipo === 'RECEITA' ? 'RECEITA_BRUTA' : 'DESPESAS_ADMINISTRATIVAS');
    if (g === 'NAO_OPERACIONAL') continue;
    if (t.tipo === 'RECEITA' && g === 'RECEITA_BRUTA') {
      if (t.contract_id) {
        const a = acc(t.contract_id);
        a.receita += num(t.valor);
        a.recebido += num(t.valor_pago);
        a.taxas += num(t.taxa);
      } else {
        receitaSemContrato += num(t.valor);
        if (t.client_id) receitaSemContratoPorCliente[t.client_id] = (receitaSemContratoPorCliente[t.client_id] || 0) + num(t.valor);
      }
    }
    if (t.tipo === 'DESPESA') {
      if (t.contract_id && ['CUSTOS', 'DESPESAS_PESSOAL', 'DESPESAS_ADMINISTRATIVAS', 'DESPESAS_COMERCIAIS', 'DESPESAS_FINANCEIRAS'].includes(g)) {
        const a = acc(t.contract_id);
        a.custos_diretos += num(t.valor);
        const k = t.account ? t.account.nome : 'Sem classificação';
        a.custos_detalhe[k] = round2((a.custos_detalhe[k] || 0) + num(t.valor));
      } else if (OVERHEAD_GROUPS.includes(g)) {
        overheadBruto += num(t.valor);
      }
    }
  }
  let horasTotaisContratos = 0;
  let maoObraAlocada = 0;
  for (const e of entries) {
    if (!e.contract_id) continue;
    const a = acc(e.contract_id);
    const custo = num(e.horas) * num(e.custo_hora);
    a.horas += num(e.horas);
    a.mao_obra += custo;
    horasTotaisContratos += num(e.horas);
    maoObraAlocada += custo;
  }
  let produtosAlocados = 0;
  for (const m of moves) {
    const custo = num(m.quantidade) * num(m.custo_unitario);
    acc(m.contract_id).produtos += custo;
    produtosAlocados += custo;
  }

  // Overhead = estrutura não alocada (despesas sem contrato − custo de equipe/produtos já apropriados aos contratos)
  const overhead = round2(Math.max(0, overheadBruto - maoObraAlocada - produtosAlocados));

  const results = contracts.map((c) => {
    const a = byContract[c.id] || acc(c.id);
    const aliq = num(c.aliquota_imposto ?? company.aliquota_imposto);
    const com = num(c.comissao_percent ?? company.aliquota_comissao);
    const receita = round2(a.receita);
    const impostos = round2(receita * aliq / 100);
    const comissao = round2(receita * com / 100);
    const mc = round2(receita - impostos - comissao - a.custos_diretos - a.taxas - a.mao_obra - a.produtos);
    const meses = monthsActiveIn(c, from, to);
    const mensal = contractsSvc.mensalDe(c);
    const receitaPrevista = round2(mensal * meses + (c.data_inicio >= from && c.data_inicio <= to ? num(c.valor_pontual) : 0));
    const custoPrevisto = round2(num(c.custo_previsto_mensal) * meses);
    return {
      contract_id: c.id, numero: c.numero, titulo: c.titulo, tipo: c.tipo, status: c.status,
      cliente: c.client ? (c.client.nome_fantasia || c.client.nome) : null, client_id: c.client_id,
      receita, recebido: round2(a.recebido), impostos, comissao,
      custos_diretos: round2(a.custos_diretos), custos_detalhe: a.custos_detalhe, taxas: round2(a.taxas),
      horas: round2(a.horas), mao_obra: round2(a.mao_obra), produtos: round2(a.produtos),
      custo_total: round2(impostos + comissao + a.custos_diretos + a.taxas + a.mao_obra + a.produtos),
      margem_contribuicao: mc,
      margem_contribuicao_percent: pct(mc, receita),
      receita_por_hora: a.horas > 0 ? round2(receita / a.horas) : null,
      previsto: {
        meses_ativos: meses, receita: receitaPrevista, custo_direto: custoPrevisto, horas: round2(num(c.horas_previstas_mensal) * meses),
        margem: round2(receitaPrevista * (1 - (aliq + com) / 100) - custoPrevisto),
      },
      horas_estouradas: num(c.horas_previstas_mensal) > 0 && a.horas > num(c.horas_previstas_mensal) * Math.max(meses, 1),
    };
  }).filter((r) => r.receita !== 0 || r.custo_total !== 0 || r.previsto.meses_ativos > 0 || r.contract_id === contract_id);

  // Rateio do overhead
  const base = company.rateio_overhead === 'HORAS' ? sum(results, (r) => r.horas) : sum(results, (r) => r.receita) + (company.rateio_overhead === 'RECEITA' ? receitaSemContrato : 0);
  for (const r of results) {
    const share = company.rateio_overhead === 'NENHUM' || base === 0 ? 0 : (company.rateio_overhead === 'HORAS' ? r.horas : r.receita) / base;
    r.rateio_overhead = round2(overhead * share);
    r.margem_liquida = round2(r.margem_contribuicao - r.rateio_overhead);
    r.margem_liquida_percent = pct(r.margem_liquida, r.receita);
    r.abaixo_da_meta = r.receita > 0 && r.margem_contribuicao_percent < meta;
  }
  results.sort((a, b) => b.margem_contribuicao - a.margem_contribuicao);
  if (contract_id || client_id) {
    const keep = results.filter((r) => (!contract_id || r.contract_id === contract_id) && (!client_id || r.client_id === client_id));
    results.length = 0;
    results.push(...keep);
  }

  const tot = {
    receita: sum(results, (r) => r.receita),
    impostos: sum(results, (r) => r.impostos),
    comissao: sum(results, (r) => r.comissao),
    custos_diretos: sum(results, (r) => r.custos_diretos),
    taxas: sum(results, (r) => r.taxas),
    mao_obra: sum(results, (r) => r.mao_obra),
    produtos: sum(results, (r) => r.produtos),
    horas: sum(results, (r) => r.horas),
    margem_contribuicao: sum(results, (r) => r.margem_contribuicao),
    rateio_overhead: sum(results, (r) => r.rateio_overhead),
    margem_liquida: sum(results, (r) => r.margem_liquida),
  };
  tot.margem_contribuicao_percent = pct(tot.margem_contribuicao, tot.receita);
  tot.margem_liquida_percent = pct(tot.margem_liquida, tot.receita);

  return {
    periodo: { from: ymd(from), to: ymd(to) },
    meta_margem: meta,
    rateio: company.rateio_overhead,
    overhead: { bruto: round2(overheadBruto), mao_obra_alocada: round2(maoObraAlocada), produtos_alocados: round2(produtosAlocados), nao_alocado: overhead },
    receita_sem_contrato: round2(receitaSemContrato),
    receita_sem_contrato_por_cliente: receitaSemContratoPorCliente,
    contratos: results,
    totais: tot,
  };
}

async function clientsMargin(ctx, params = {}) {
  const m = await contractsMargin(ctx, params);
  const by = {};
  for (const r of m.contratos) {
    const k = r.client_id;
    by[k] ||= { client_id: k, cliente: r.cliente, contratos: 0, receita: 0, custo_total: 0, margem_contribuicao: 0, rateio_overhead: 0, margem_liquida: 0, horas: 0 };
    const b = by[k];
    b.contratos++;
    for (const f of ['receita', 'custo_total', 'margem_contribuicao', 'rateio_overhead', 'margem_liquida', 'horas']) b[f] = round2(b[f] + r[f]);
  }
  const avulsos = m.receita_sem_contrato_por_cliente;
  const clientIds = Object.keys(avulsos).filter(Boolean);
  if (clientIds.length) {
    const cs = await prisma.bizClient.findMany({ where: { id: { in: clientIds } }, select: { id: true, nome: true, nome_fantasia: true } });
    const company = await prisma.bizCompany.findUnique({ where: { id: ctx.companyId }, select: { aliquota_imposto: true } });
    for (const c of cs) {
      by[c.id] ||= { client_id: c.id, cliente: c.nome_fantasia || c.nome, contratos: 0, receita: 0, custo_total: 0, margem_contribuicao: 0, rateio_overhead: 0, margem_liquida: 0, horas: 0 };
      const v = num(avulsos[c.id]);
      const imp = round2(v * num(company.aliquota_imposto) / 100);
      by[c.id].receita = round2(by[c.id].receita + v);
      by[c.id].custo_total = round2(by[c.id].custo_total + imp);
      by[c.id].margem_contribuicao = round2(by[c.id].margem_contribuicao + v - imp);
      by[c.id].margem_liquida = round2(by[c.id].margem_liquida + v - imp);
    }
  }
  const receitaTotal = sum(Object.values(by), (b) => b.receita);
  const items = Object.values(by).map((b) => ({
    ...b,
    margem_contribuicao_percent: pct(b.margem_contribuicao, b.receita),
    margem_liquida_percent: pct(b.margem_liquida, b.receita),
    participacao_receita: pct(b.receita, receitaTotal),
  })).sort((a, b) => b.receita - a.receita);
  return { periodo: m.periodo, clientes: items, concentracao_top5: round2(sum(items.slice(0, 5), (i) => i.participacao_receita)) };
}

// ─────────────────────── Margem da agência ───────────────────────
async function agencyMargin(ctx, { from, to } = {}) {
  from = startOfMonth(from || today());
  to = endOfMonth(to || from);
  const [d, cm, team, entries] = await Promise.all([
    dre(ctx, { from, to }),
    contractsMargin(ctx, { from, to }),
    prisma.bizTeamMember.findMany({ where: { company_id: ctx.companyId, ativo: true } }),
    prisma.bizTimeEntry.findMany({ where: { company_id: ctx.companyId, data: { gte: from, lte: to } } }),
  ]);
  const nMeses = monthsBetween(from, to).length;
  const T = d.totais;

  // Capacidade produtiva
  const produtivos = team.filter((m) => m.produtivo);
  const horasDisponiveis = round2(sum(produtivos, (m) => num(m.horas_mes)) * nMeses);
  const horasApontadas = sum(entries, (e) => e.horas);
  const horasContratos = sum(entries.filter((e) => e.contract_id), (e) => e.horas);
  const custoEquipeProdutiva = round2(sum(produtivos, (m) => num(m.custo_mensal)) * nMeses);
  const custoAlocado = cm.overhead.mao_obra_alocada;

  // Ponto de equilíbrio: despesas fixas / índice de margem de contribuição
  const fixas = await prisma.bizTransaction.findMany({
    where: { company_id: ctx.companyId, tipo: 'DESPESA', status: { not: 'CANCELADO' }, competencia: { gte: from, lte: to }, account: { fixa: true } },
    select: { valor: true },
  });
  const despesasFixas = sum(fixas, (f) => f.valor);
  const variaveis = -(num(T.DEDUCOES) + num(T.CUSTOS) + num(d.linhas.find((l) => l.key === 'DESPESAS_COMERCIAIS')?.total));
  const imc = T.RECEITA_BRUTA > 0 ? (T.RECEITA_BRUTA - variaveis) / T.RECEITA_BRUTA : 0;
  const pontoEquilibrioMensal = imc > 0 ? round2(despesasFixas / nMeses / imc) : null;

  // Recorrente x pontual
  const recorrente = sum(cm.contratos.filter((c) => c.tipo === 'RECORRENTE'), (c) => c.receita);
  const pontual = round2(sum(cm.contratos.filter((c) => c.tipo === 'PONTUAL'), (c) => c.receita) + cm.receita_sem_contrato);

  return {
    periodo: d.periodo,
    meses: nMeses,
    dre: d.indicadores,
    margem_contratos: {
      receita_contratos: cm.totais.receita,
      margem_contribuicao: cm.totais.margem_contribuicao,
      margem_contribuicao_percent: cm.totais.margem_contribuicao_percent,
      overhead_nao_alocado: cm.overhead.nao_alocado,
      contratos_abaixo_meta: cm.contratos.filter((c) => c.abaixo_da_meta).length,
      meta: cm.meta_margem,
    },
    cascata: [
      { etapa: 'Receita bruta', valor: T.RECEITA_BRUTA },
      { etapa: 'Impostos', valor: T.DEDUCOES },
      { etapa: 'Custos diretos', valor: T.CUSTOS },
      { etapa: 'Pessoal', valor: d.linhas.find((l) => l.key === 'DESPESAS_PESSOAL')?.total || 0 },
      { etapa: 'Administrativas', valor: d.linhas.find((l) => l.key === 'DESPESAS_ADMINISTRATIVAS')?.total || 0 },
      { etapa: 'Comerciais', valor: d.linhas.find((l) => l.key === 'DESPESAS_COMERCIAIS')?.total || 0 },
      { etapa: 'Financeiro', valor: round2((d.linhas.find((l) => l.key === 'RECEITAS_FINANCEIRAS')?.total || 0) + (d.linhas.find((l) => l.key === 'DESPESAS_FINANCEIRAS')?.total || 0)) },
      { etapa: 'IR/CSLL', valor: d.linhas.find((l) => l.key === 'IMPOSTOS_LUCRO')?.total || 0 },
      { etapa: 'Lucro líquido', valor: T.LUCRO_LIQUIDO, total: true },
    ],
    capacidade: {
      horas_disponiveis: horasDisponiveis,
      horas_apontadas: horasApontadas,
      horas_em_contratos: horasContratos,
      utilizacao_percent: pct(horasContratos, horasDisponiveis),
      custo_equipe_produtiva: custoEquipeProdutiva,
      custo_alocado_contratos: custoAlocado,
      custo_ocioso: round2(Math.max(0, custoEquipeProdutiva - custoAlocado)),
    },
    ponto_equilibrio: {
      despesas_fixas_mensais: round2(despesasFixas / nMeses),
      indice_margem_contribuicao: Math.round(imc * 10000) / 100,
      receita_minima_mensal: pontoEquilibrioMensal,
      folga_percent: pontoEquilibrioMensal ? pct(T.RECEITA_BRUTA / nMeses - pontoEquilibrioMensal, pontoEquilibrioMensal) : null,
    },
    mix_receita: { recorrente, pontual, recorrente_percent: pct(recorrente, recorrente + pontual) },
  };
}

// ─────────────────────── Saldos e fluxo de caixa ───────────────────────
const startOfDay = (d) => { const x = toDate(d); return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate())); };
async function bankBalances(ctx) {
  const accounts = await prisma.bizBankAccount.findMany({ where: { company_id: ctx.companyId, ativo: true }, orderBy: { nome: 'asc' } });
  const paid = await prisma.bizTransaction.findMany({
    where: { company_id: ctx.companyId, valor_pago: { gt: 0 }, bank_account_id: { not: null }, status: { not: 'CANCELADO' } },
    select: { tipo: true, valor_pago: true, taxa: true, bank_account_id: true, data_pagamento: true },
  });
  const out = accounts.map((a) => {
    const corte = startOfDay(a.data_saldo_inicial);
    const movs = paid.filter((p) => p.bank_account_id === a.id && (!p.data_pagamento || p.data_pagamento >= corte));
    const saldo = round2(num(a.saldo_inicial) + sum(movs, (m) => (m.tipo === 'RECEITA' ? num(m.valor_pago) - num(m.taxa) : -num(m.valor_pago))));
    return { id: a.id, nome: a.nome, tipo: a.tipo, saldo };
  });
  return { contas: out, total: sum(out, (o) => o.saldo) };
}

async function cashflow(ctx, { days = 90, incluir_vencidos = false, granularidade = 'semana' } = {}) {
  days = Math.min(Math.max(parseInt(days, 10) || 90, 7), 365);
  const hoje = today();
  const fim = addDays(hoje, days);
  const saldos = await bankBalances(ctx);
  const open = await prisma.bizTransaction.findMany({
    where: { company_id: ctx.companyId, status: { in: ['PENDENTE', 'PARCIAL'] }, vencimento: { lte: fim } },
    select: { tipo: true, valor: true, valor_pago: true, juros_multa: true, desconto: true, vencimento: true, contract_id: true, competencia: true },
  });
  // Projeção de contratos recorrentes cujo título ainda não existe (ex.: Asaas gera a cobrança perto do vencimento)
  const contracts = await prisma.bizContract.findMany({ where: { company_id: ctx.companyId, status: 'ATIVO', tipo: 'RECORRENTE' } });
  const existing = new Set((await prisma.bizTransaction.findMany({
    where: { company_id: ctx.companyId, contract_id: { in: contracts.map((c) => c.id) }, recorrente: true, competencia: { gte: startOfMonth(hoje) } },
    select: { contract_id: true, competencia: true },
  })).map((t) => `${t.contract_id}:${ym(t.competencia)}`));
  // Títulos de assinatura do Asaas não marcam "recorrente" — considera qualquer receita do contrato no mês
  const anyByMonth = new Set((await prisma.bizTransaction.findMany({
    where: { company_id: ctx.companyId, contract_id: { in: contracts.map((c) => c.id) }, tipo: 'RECEITA', status: { not: 'CANCELADO' }, vencimento: { gte: hoje, lte: fim } },
    select: { contract_id: true, vencimento: true },
  })).map((t) => `${t.contract_id}:${ym(t.vencimento)}`));

  const projetados = [];
  for (const c of contracts) {
    const step = cycleMonths(c.periodicidade);
    for (let due = withDay(c.data_inicio, c.dia_vencimento); due <= fim; due = addMonths(due, step)) {
      if (due < hoje) continue;
      if (c.data_fim && due > c.data_fim) break;
      const k = `${c.id}:${ym(due)}`;
      if (existing.has(k) || anyByMonth.has(k)) continue;
      projetados.push({ tipo: 'RECEITA', valor: num(c.valor_recorrente), vencimento: due, previsto: true });
    }
  }

  const items = [
    ...open.map((t) => ({ tipo: t.tipo, valor: round2(num(t.valor) + num(t.juros_multa) - num(t.desconto) - num(t.valor_pago)), vencimento: t.vencimento, previsto: false })),
    ...projetados,
  ];
  const vencidosReceber = sum(items.filter((i) => i.vencimento < hoje && i.tipo === 'RECEITA'), (i) => i.valor);
  const vencidosPagar = sum(items.filter((i) => i.vencimento < hoje && i.tipo === 'DESPESA'), (i) => i.valor);

  const bucketKey = (d) => {
    if (granularidade === 'dia') return ymd(d);
    if (granularidade === 'mes') return ym(d);
    const diff = Math.floor((toDate(d) - hoje) / 86400000);
    return ymd(addDays(hoje, Math.max(0, Math.floor(diff / 7) * 7)));
  };
  const buckets = {};
  const keys = [];
  for (let d = hoje; d <= fim; d = addDays(d, granularidade === 'mes' ? 28 : granularidade === 'dia' ? 1 : 7)) {
    const k = bucketKey(d);
    if (!buckets[k]) { buckets[k] = { periodo: k, entradas: 0, saidas: 0, entradas_previstas: 0 }; keys.push(k); }
  }
  for (const i of items) {
    let d = toDate(i.vencimento);
    if (d < hoje) { if (!incluir_vencidos) continue; d = hoje; }
    const k = bucketKey(d);
    if (!buckets[k]) { buckets[k] = { periodo: k, entradas: 0, saidas: 0, entradas_previstas: 0 }; keys.push(k); }
    if (i.tipo === 'RECEITA') {
      buckets[k].entradas = round2(buckets[k].entradas + i.valor);
      if (i.previsto) buckets[k].entradas_previstas = round2(buckets[k].entradas_previstas + i.valor);
    } else buckets[k].saidas = round2(buckets[k].saidas + i.valor);
  }
  keys.sort();
  let saldo = saldos.total;
  const serie = keys.map((k) => {
    const b = buckets[k];
    saldo = round2(saldo + b.entradas - b.saidas);
    return { ...b, saldo };
  });
  const menor = serie.reduce((m, s) => (s.saldo < m.saldo ? s : m), { saldo: saldos.total, periodo: ymd(hoje) });
  return {
    saldo_inicial: saldos.total,
    contas: saldos.contas,
    dias: days,
    serie,
    saldo_final: saldo,
    menor_saldo: menor,
    vencidos: { a_receber: vencidosReceber, a_pagar: vencidosPagar, incluidos: !!incluir_vencidos },
    receita_prevista_contratos: sum(projetados, (p) => p.valor),
  };
}

async function aging(ctx, { tipo = 'RECEITA' } = {}) {
  const hoje = today();
  const open = await prisma.bizTransaction.findMany({
    where: { company_id: ctx.companyId, tipo, status: { in: ['PENDENTE', 'PARCIAL'] } },
    include: { client: { select: { id: true, nome: true } }, supplier: { select: { id: true, nome: true } } },
  });
  const faixas = [
    ['A vencer', (d) => d <= 0], ['1–30 dias', (d) => d >= 1 && d <= 30], ['31–60 dias', (d) => d >= 31 && d <= 60],
    ['61–90 dias', (d) => d >= 61 && d <= 90], ['+90 dias', (d) => d > 90],
  ];
  const result = faixas.map(([label]) => ({ faixa: label, valor: 0, quantidade: 0 }));
  const porPessoa = {};
  for (const t of open) {
    const saldo = round2(num(t.valor) + num(t.juros_multa) - num(t.desconto) - num(t.valor_pago));
    const dias = Math.floor((hoje - toDate(t.vencimento)) / 86400000);
    const idx = faixas.findIndex(([, f]) => f(dias));
    result[idx].valor = round2(result[idx].valor + saldo);
    result[idx].quantidade++;
    if (dias > 0) {
      const p = t.client || t.supplier || { id: 'sem', nome: 'Sem cadastro' };
      porPessoa[p.id] ||= { id: p.id, nome: p.nome, vencido: 0, titulos: 0, maior_atraso: 0 };
      porPessoa[p.id].vencido = round2(porPessoa[p.id].vencido + saldo);
      porPessoa[p.id].titulos++;
      porPessoa[p.id].maior_atraso = Math.max(porPessoa[p.id].maior_atraso, dias);
    }
  }
  return { tipo, faixas: result, total: sum(result, (r) => r.valor), vencido: sum(result.slice(1), (r) => r.valor), devedores: Object.values(porPessoa).sort((a, b) => b.vencido - a.vencido) };
}

// ─────────────────────── Dashboard executivo ───────────────────────
async function subscriptionMetrics(ctx, ref = today()) {
  const ini = startOfMonth(ref);
  const fim = endOfMonth(ref);
  const all = await prisma.bizContract.findMany({ where: { company_id: ctx.companyId, tipo: 'RECORRENTE', status: { not: 'RASCUNHO' } } });
  const ativos = all.filter((c) => c.status === 'ATIVO');
  const mrr = sum(ativos, (c) => contractsSvc.mensalDe(c));
  const novos = all.filter((c) => c.data_inicio >= ini && c.data_inicio <= fim);
  const cancelados = all.filter((c) => c.cancelado_em && c.cancelado_em >= ini && c.cancelado_em <= fim);
  const novoMrr = sum(novos, (c) => contractsSvc.mensalDe(c));
  const churnMrr = sum(cancelados, (c) => contractsSvc.mensalDe(c));
  const mrrInicio = round2(mrr - novoMrr + churnMrr);
  return {
    mrr, arr: round2(mrr * 12), contratos_ativos: ativos.length,
    ticket_medio: ativos.length ? round2(mrr / ativos.length) : 0,
    novo_mrr: novoMrr, churn_mrr: churnMrr, contratos_cancelados_mes: cancelados.length,
    churn_percent: pct(churnMrr, mrrInicio),
    crescimento_liquido_mrr: round2(novoMrr - churnMrr),
  };
}

async function dashboard(ctx, { ref } = {}) {
  const hoje = today();
  const mes = startOfMonth(ref || hoje);
  const fimMes = endOfMonth(mes);
  const ini12 = addMonths(mes, -11);

  const [dreMes, dre12, subs, saldos, cm, proposals, lowStock] = await Promise.all([
    dre(ctx, { from: mes, to: fimMes }),
    dre(ctx, { from: ini12, to: fimMes }),
    subscriptionMetrics(ctx, mes),
    bankBalances(ctx),
    contractsMargin(ctx, { from: mes, to: fimMes }),
    prisma.bizProposal.findMany({ where: { company_id: ctx.companyId, status: { in: ['ENVIADA', 'VISUALIZADA'] } }, select: { total_recorrente: true, total_unico: true, validade: true } }),
    prisma.bizProduct.findMany({ where: { company_id: ctx.companyId, controla_estoque: true, ativo: true }, select: { id: true, nome: true, estoque_atual: true, estoque_minimo: true } }),
  ]);

  const open = await prisma.bizTransaction.findMany({
    where: { company_id: ctx.companyId, status: { in: ['PENDENTE', 'PARCIAL'] }, vencimento: { lte: addDays(hoje, 30) } },
    select: { tipo: true, valor: true, valor_pago: true, juros_multa: true, desconto: true, vencimento: true },
  });
  const saldoT = (t) => round2(num(t.valor) + num(t.juros_multa) - num(t.desconto) - num(t.valor_pago));
  const receber30 = sum(open.filter((t) => t.tipo === 'RECEITA' && t.vencimento >= hoje), saldoT);
  const pagar30 = sum(open.filter((t) => t.tipo === 'DESPESA' && t.vencimento >= hoje), saldoT);
  const vencReceber = sum(open.filter((t) => t.tipo === 'RECEITA' && t.vencimento < hoje), saldoT);
  const vencPagar = sum(open.filter((t) => t.tipo === 'DESPESA' && t.vencimento < hoje), saldoT);

  const pagosMes = await prisma.bizTransaction.findMany({
    where: { company_id: ctx.companyId, data_pagamento: { gte: mes, lte: fimMes }, status: { not: 'CANCELADO' } },
    select: { tipo: true, valor_pago: true, taxa: true },
  });
  const faturado90 = await prisma.bizTransaction.aggregate({
    where: { company_id: ctx.companyId, tipo: 'RECEITA', status: { not: 'CANCELADO' }, vencimento: { gte: addDays(hoje, -90), lt: hoje } },
    _sum: { valor: true },
  });

  const serie = dre12.meses.map((m) => {
    const get = (k) => dre12.linhas.find((l) => l.key === k)?.valores[m] || 0;
    const receita = get('RECEITA_BRUTA');
    const resultado = get('LUCRO_LIQUIDO');
    return { mes: m, receita, despesas: round2(receita - resultado), resultado, margem: pct(resultado, receita) };
  });

  const company = await prisma.bizCompany.findUnique({ where: { id: ctx.companyId }, select: { meta_margem_contrato: true } });
  const reajustes = await prisma.bizContract.findMany({
    where: { company_id: ctx.companyId, status: 'ATIVO', data_reajuste: { lte: addDays(hoje, 30) } },
    select: { id: true, numero: true, titulo: true, data_reajuste: true },
  });

  return {
    referencia: ym(mes),
    assinaturas: subs,
    resultado_mes: dreMes.indicadores,
    caixa: {
      saldo_atual: saldos.total,
      contas: saldos.contas,
      recebido_mes: sum(pagosMes.filter((p) => p.tipo === 'RECEITA'), (p) => num(p.valor_pago) - num(p.taxa)),
      pago_mes: sum(pagosMes.filter((p) => p.tipo === 'DESPESA'), (p) => p.valor_pago),
      a_receber_30d: receber30,
      a_pagar_30d: pagar30,
      vencido_receber: vencReceber,
      vencido_pagar: vencPagar,
      inadimplencia_percent: pct(vencReceber, num(faturado90._sum.valor)),
    },
    margens: {
      margem_contribuicao_contratos: cm.totais.margem_contribuicao,
      margem_contribuicao_percent: cm.totais.margem_contribuicao_percent,
      margem_liquida_agencia: dreMes.indicadores.margem_liquida,
      meta_contrato: num(company.meta_margem_contrato),
      top_contratos: cm.contratos.filter((c) => c.receita > 0).slice(0, 5),
      piores_contratos: cm.contratos.filter((c) => c.receita > 0).slice(-5).reverse(),
    },
    serie_12m: serie,
    pipeline: {
      propostas_abertas: proposals.length,
      recorrente: sum(proposals, (p) => p.total_recorrente),
      unico: sum(proposals, (p) => p.total_unico),
    },
    alertas: {
      estoque_baixo: lowStock.filter((p) => num(p.estoque_atual) <= num(p.estoque_minimo)).map((p) => p.nome),
      contratos_abaixo_meta: cm.contratos.filter((c) => c.abaixo_da_meta).map((c) => ({ numero: c.numero, titulo: c.titulo, margem: c.margem_contribuicao_percent })),
      reajustes_proximos: reajustes,
      vencido_receber: vencReceber,
    },
    situacao_cobrancas: await situacaoCobrancas(ctx, { ref }),
  };
}

async function situacaoCobrancas(ctx, { ref, periodo = 'mes', forma_pagamento } = {}) {
  const hoje = today();
  const mes = startOfMonth(ref || hoje);
  const fimMes = endOfMonth(mes);

  let dateFilter = {};
  if (periodo === 'mes' || !periodo) {
    dateFilter = {
      OR: [
        { vencimento: { gte: mes, lte: fimMes } },
        { data_pagamento: { gte: mes, lte: fimMes } },
        { competencia: { gte: mes, lte: fimMes } },
      ],
    };
  } else if (periodo === 'mes_anterior') {
    const prevMes = addMonths(mes, -1);
    const prevFim = endOfMonth(prevMes);
    dateFilter = {
      OR: [
        { vencimento: { gte: prevMes, lte: prevFim } },
        { data_pagamento: { gte: prevMes, lte: prevFim } },
        { competencia: { gte: prevMes, lte: prevFim } },
      ],
    };
  } else if (periodo === '30d') {
    const d30 = addDays(hoje, -30);
    dateFilter = {
      OR: [
        { vencimento: { gte: d30, lte: hoje } },
        { data_pagamento: { gte: d30, lte: hoje } },
      ],
    };
  } else if (periodo === 'ano') {
    const anoIni = new Date(Date.UTC(mes.getUTCFullYear(), 0, 1));
    const anoFim = new Date(Date.UTC(mes.getUTCFullYear(), 11, 31, 23, 59, 59));
    dateFilter = {
      OR: [
        { vencimento: { gte: anoIni, lte: anoFim } },
        { data_pagamento: { gte: anoIni, lte: anoFim } },
        { competencia: { gte: anoIni, lte: anoFim } },
      ],
    };
  } else if (periodo === 'todos') {
    dateFilter = {};
  }

  const where = {
    company_id: ctx.companyId,
    tipo: 'RECEITA',
    status: { not: 'CANCELADO' },
    ...dateFilter,
  };

  if (forma_pagamento) {
    where.forma_pagamento = forma_pagamento;
  }

  const [company, txs] = await Promise.all([
    prisma.bizCompany.findUnique({
      where: { id: ctx.companyId },
      select: { asaas_api_key: true, asaas_ambiente: true },
    }),
    prisma.bizTransaction.findMany({
      where,
      include: {
        client: { select: { id: true, nome: true, asaas_customer_id: true } },
      },
    }),
  ]);

  const buckets = {
    recebidas: { valor: 0, liquido: 0, clientes: new Set(), cobrancas: 0 },
    confirmadas: { valor: 0, liquido: 0, clientes: new Set(), cobrancas: 0 },
    aguardando: { valor: 0, liquido: 0, clientes: new Set(), cobrancas: 0 },
    vencidas: { valor: 0, liquido: 0, clientes: new Set(), cobrancas: 0 },
  };

  for (const t of txs) {
    const val = round2(num(t.valor_pago) > 0 ? num(t.valor_pago) : num(t.valor));
    const fee = round2(num(t.taxa) || 0);
    const net = round2(Math.max(0, val - fee));
    const clientKey = t.client_id || t.client?.asaas_customer_id || t.client?.nome || t.id;
    const asaasSt = String(t.asaas_status || '').toUpperCase();
    const venc = toDate(t.vencimento);

    let b = null;
    if (['RECEIVED', 'RECEIVED_IN_CASH'].includes(asaasSt) || (t.status === 'PAGO' && asaasSt !== 'CONFIRMED')) {
      b = buckets.recebidas;
    } else if (['CONFIRMED', 'CREDIT_CARD_CONFIRMED'].includes(asaasSt) || t.status === 'CONFIRMADO') {
      b = buckets.confirmadas;
    } else if (asaasSt === 'OVERDUE' || (['PENDENTE', 'PARCIAL'].includes(t.status) && venc < hoje)) {
      b = buckets.vencidas;
    } else {
      b = buckets.aguardando;
    }

    b.valor = round2(b.valor + val);
    b.liquido = round2(b.liquido + net);
    b.clientes.add(clientKey);
    b.cobrancas += 1;
  }

  let statsFromAsaas = false;
  // Se localmente não há cobranças, mas a empresa tem Asaas configurado,
  // consulta diretamente as estatísticas da API do Asaas como fallback
  if (txs.length === 0 && company?.asaas_api_key) {
    try {
      const { AsaasClient } = require('./asaas');
      const asaas = new AsaasClient(company);
      const ymdStr = (d) => d.toISOString().slice(0, 10);
      const baseFilter = {
        'dueDate[ge]': ymdStr(mes),
        'dueDate[le]': ymdStr(fimMes),
      };
      if (forma_pagamento) baseFilter.billingType = forma_pagamento;

      const [rec, conf, pend, overd] = await Promise.all([
        asaas.getPaymentStatistics({ ...baseFilter, status: 'RECEIVED' }).catch(() => null),
        asaas.getPaymentStatistics({ ...baseFilter, status: 'CONFIRMED' }).catch(() => null),
        asaas.getPaymentStatistics({ ...baseFilter, status: 'PENDING' }).catch(() => null),
        asaas.getPaymentStatistics({ ...baseFilter, status: 'OVERDUE' }).catch(() => null),
      ]);

      if (rec || conf || pend || overd) {
        statsFromAsaas = true;
        if (rec) {
          buckets.recebidas.valor = round2(rec.value || 0);
          buckets.recebidas.liquido = round2(rec.netValue || rec.value || 0);
          buckets.recebidas.cobrancas = rec.quantity || 0;
        }
        if (conf) {
          buckets.confirmadas.valor = round2(conf.value || 0);
          buckets.confirmadas.liquido = round2(conf.netValue || conf.value || 0);
          buckets.confirmadas.cobrancas = conf.quantity || 0;
        }
        if (pend) {
          buckets.aguardando.valor = round2(pend.value || 0);
          buckets.aguardando.liquido = round2(pend.netValue || pend.value || 0);
          buckets.aguardando.cobrancas = pend.quantity || 0;
        }
        if (overd) {
          buckets.vencidas.valor = round2(overd.value || 0);
          buckets.vencidas.liquido = round2(overd.netValue || overd.value || 0);
          buckets.vencidas.cobrancas = overd.quantity || 0;
        }
      }
    } catch (e) {
      console.warn('[biz] Falha ao consultar estatísticas do Asaas:', e.message);
    }
  }

  const totalValor = round2(
    buckets.recebidas.valor +
    buckets.confirmadas.valor +
    buckets.aguardando.valor +
    buckets.vencidas.valor
  );

  const totalLiquido = round2(
    buckets.recebidas.liquido +
    buckets.confirmadas.liquido +
    buckets.aguardando.liquido +
    buckets.vencidas.liquido
  );

  const formatB = (b) => ({
    valor: b.valor,
    liquido: b.liquido,
    clientes: b.clientes instanceof Set ? b.clientes.size : (b.clientes || 0),
    cobrancas: b.cobrancas || 0,
    percentual: totalValor > 0 ? round2((b.valor / totalValor) * 100) : 0,
  });

  const totalClientes = new Set([
    ...buckets.recebidas.clientes,
    ...buckets.confirmadas.clientes,
    ...buckets.aguardando.clientes,
    ...buckets.vencidas.clientes,
  ]).size;

  const totalCobrancas = (
    buckets.recebidas.cobrancas +
    buckets.confirmadas.cobrancas +
    buckets.aguardando.cobrancas +
    buckets.vencidas.cobrancas
  );

  return {
    referencia: ym(mes),
    periodo,
    asaas_conectado: !!company?.asaas_api_key,
    stats_origem: statsFromAsaas ? 'ASAAS_LIVE' : 'BANCO_DADOS',
    recebidas: formatB(buckets.recebidas),
    confirmadas: formatB(buckets.confirmadas),
    aguardando: formatB(buckets.aguardando),
    vencidas: formatB(buckets.vencidas),
    total: {
      valor: totalValor,
      liquido: totalLiquido,
      clientes: totalClientes,
      cobrancas: totalCobrancas,
    },
  };
}

module.exports = { dre, contractsMargin, clientsMargin, agencyMargin, cashflow, aging, dashboard, bankBalances, subscriptionMetrics, situacaoCobrancas };
