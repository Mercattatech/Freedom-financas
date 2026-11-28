// Ferramentas MCP do Freedom Empresas — permitem operar a empresa por linguagem natural
// (Claude, ChatGPT, Cursor...). Toda escrita fica registrada na auditoria com origem MCP.
const { z } = require('zod');
const prisma = require('../db');
const { resolvers: R } = require('./resolve');
const registry = require('../services/registry');
const products = require('../services/products');
const transactions = require('../services/transactions');
const contracts = require('../services/contracts');
const proposals = require('../services/proposals');
const team = require('../services/team');
const reports = require('../services/reports');
const companies = require('../services/companies');
const invoices = require('../services/invoices');
const asaasImport = require('../services/asaasImport');
const cashGoals = require('../services/cashGoals');
const proposalAi = require('../services/proposalAi');
const { AsaasClient } = require('../services/asaas');
const { getIpca12m } = require('../lib/indices');
const { today, ymd, ym } = require('../lib/dates');

const periodo = {
  de: z.string().optional().describe('Início do período: AAAA-MM ou AAAA-MM-DD. Padrão: mês atual.'),
  ate: z.string().optional().describe('Fim do período: AAAA-MM ou AAAA-MM-DD. Padrão: igual ao início.'),
};
const idOuNome = (o) => ({
  [`${o}_id`]: z.string().optional().describe(`ID do ${o}`),
  [o]: z.string().optional().describe(`Nome (ou parte do nome) do ${o} — alternativa ao ID`),
});
const lim = (arr, n = 50) => (Array.isArray(arr) && arr.length > n ? { mostrando: n, total: arr.length, itens: arr.slice(0, n) } : arr);
const enxuto = (t) => ({
  id: t.id, tipo: t.tipo, descricao: t.descricao, valor: t.valor, saldo: t.saldo, vencimento: ymd(t.vencimento), competencia: t.competencia && ym(t.competencia),
  situacao: t.situacao, dias_atraso: t.dias_atraso, data_pagamento: ymd(t.data_pagamento), cliente: t.client?.nome, fornecedor: t.supplier?.nome,
  contrato: t.contract ? `#${t.contract.numero} ${t.contract.titulo}` : null, conta: t.account ? `${t.account.codigo} ${t.account.nome}` : null,
  centro_custo: t.costCenter?.nome, link_pagamento: t.asaas_invoice_url,
});

const TOOLS = [
  // ───────────── Leitura e análise ─────────────
  {
    name: 'resumo_executivo', perm: 'relatorios:read',
    description: 'Visão de CEO do mês: MRR/ARR, churn, faturamento, lucro e margens, caixa, a receber/pagar em 30 dias, inadimplência, melhores e piores contratos por margem, pipeline de propostas e alertas. Comece por aqui para perguntas gerais sobre a saúde da empresa.',
    schema: { mes: z.string().optional().describe('Mês de referência AAAA-MM (padrão: atual)') },
    handler: (ctx, a) => reports.dashboard(ctx, { ref: a.mes }),
  },
  {
    name: 'dre', perm: 'relatorios:read',
    description: 'Demonstração do Resultado (DRE gerencial) mês a mês: receita bruta, deduções, custos, despesas por grupo, EBITDA, lucro líquido e análise vertical. Regime de competência (padrão) ou caixa.',
    schema: { ...periodo, regime: z.enum(['competencia', 'caixa']).optional() },
    handler: async (ctx, a) => {
      const d = await reports.dre(ctx, { from: a.de, to: a.ate || a.de, regime: a.regime });
      return { ...d, linhas: d.linhas.map(({ key, label, tipo, total, av, valores }) => ({ label, tipo, total, av_percent: av, ...(d.meses.length > 1 && tipo !== 'conta' && { por_mes: valores }) })) };
    },
  },
  {
    name: 'margem_contratos', perm: 'relatorios:read',
    description: 'Margem de cada contrato no período: receita, impostos, comissão, custos diretos, horas da equipe × custo/hora, produtos, margem de contribuição (R$ e %), rateio do overhead e margem líquida. Compara com o previsto e sinaliza contratos abaixo da meta.',
    schema: { ...periodo, ...idOuNome('contrato'), ...idOuNome('cliente') },
    handler: async (ctx, a) => {
      const c = a.contrato_id || a.contrato ? await R.contract(ctx, a.contrato_id, a.contrato) : null;
      const cl = a.cliente_id || a.cliente ? await R.client(ctx, a.cliente_id, a.cliente) : null;
      return reports.contractsMargin(ctx, { from: a.de, to: a.ate || a.de, contract_id: c?.id, client_id: cl?.id });
    },
  },
  {
    name: 'margem_clientes', perm: 'relatorios:read',
    description: 'Rentabilidade e participação de cada cliente na receita (soma dos contratos + vendas avulsas) e concentração dos 5 maiores.',
    schema: { ...periodo },
    handler: (ctx, a) => reports.clientsMargin(ctx, { from: a.de, to: a.ate || a.de }),
  },
  {
    name: 'margem_agencia', perm: 'relatorios:read',
    description: 'Margem da empresa como um todo: margens bruta/EBITDA/líquida, cascata do resultado, margem de contribuição dos contratos vs overhead, utilização da equipe e custo ocioso, ponto de equilíbrio e mix recorrente × pontual.',
    schema: { ...periodo },
    handler: (ctx, a) => reports.agencyMargin(ctx, { from: a.de, to: a.ate || a.de }),
  },
  {
    name: 'fluxo_caixa_projetado', perm: 'relatorios:read',
    description: 'Saldo atual por conta e projeção de caixa (entradas, saídas e saldo) para os próximos dias, incluindo receitas previstas de contratos recorrentes. Mostra o menor saldo projetado.',
    schema: { dias: z.number().int().min(7).max(365).optional(), incluir_vencidos: z.boolean().optional(), granularidade: z.enum(['dia', 'semana', 'mes']).optional() },
    handler: (ctx, a) => reports.cashflow(ctx, { days: a.dias || 90, incluir_vencidos: a.incluir_vencidos, granularidade: a.granularidade }),
  },
  {
    name: 'inadimplencia', perm: 'relatorios:read',
    description: 'Aging de contas a receber (ou a pagar): valores por faixa de atraso e ranking de devedores.',
    schema: { tipo: z.enum(['RECEITA', 'DESPESA']).optional() },
    handler: (ctx, a) => reports.aging(ctx, { tipo: a.tipo || 'RECEITA' }),
  },
  {
    name: 'listar_lancamentos', perm: null,
    description: 'Lista contas a receber (RECEITA) e/ou a pagar (DESPESA) com filtros. Use situacao=VENCIDO para atrasados, A_VENCER para próximos, PAGO para baixados.',
    schema: {
      tipo: z.enum(['RECEITA', 'DESPESA']).optional(), situacao: z.enum(['ABERTO', 'VENCIDO', 'A_VENCER', 'PAGO', 'CANCELADO']).optional(),
      ...periodo, filtrar_por: z.enum(['vencimento', 'competencia', 'pagamento']).optional(), busca: z.string().optional(),
      ...idOuNome('cliente'), ...idOuNome('contrato'), limite: z.number().int().max(500).optional(),
    },
    handler: async (ctx, a) => {
      const cl = a.cliente_id || a.cliente ? await R.client(ctx, a.cliente_id, a.cliente) : null;
      const ct = a.contrato_id || a.contrato ? await R.contract(ctx, a.contrato_id, a.contrato) : null;
      const r = await transactions.list(ctx, {
        tipo: a.tipo, situacao: a.situacao, from: a.de, to: a.ate, por: a.filtrar_por, q: a.busca, client_id: cl?.id, contract_id: ct?.id,
      });
      return { resumo: r.resumo, itens: lim(r.items.map(enxuto), a.limite || 50) };
    },
  },
  {
    name: 'buscar_clientes', perm: null,
    description: 'Busca clientes por nome, documento ou e-mail.',
    schema: { busca: z.string().optional(), status: z.enum(['LEAD', 'ATIVO', 'INATIVO', 'CHURN']).optional() },
    handler: async (ctx, a) => lim(await registry.list(ctx, 'clients', { q: a.busca, status: a.status })),
  },
  {
    name: 'buscar_produtos_servicos', perm: null,
    description: 'Catálogo de produtos e serviços com preço, custo, margem unitária e estoque.',
    schema: { busca: z.string().optional(), tipo: z.enum(['PRODUTO', 'SERVICO']).optional(), estoque_baixo: z.boolean().optional() },
    handler: async (ctx, a) => lim(await products.list(ctx, { q: a.busca, tipo: a.tipo, estoque_baixo: a.estoque_baixo, ativo: true })),
  },
  {
    name: 'listar_contratos', perm: null,
    description: 'Lista contratos (recorrentes e pontuais) com valor mensal, MRR e margem prevista. Resumo traz MRR, ARR e ticket médio.',
    schema: { status: z.enum(['RASCUNHO', 'ATIVO', 'PAUSADO', 'ENCERRADO', 'CANCELADO']).optional(), tipo: z.enum(['RECORRENTE', 'PONTUAL']).optional(), busca: z.string().optional() },
    handler: async (ctx, a) => {
      const r = await contracts.list(ctx, { status: a.status, tipo: a.tipo, q: a.busca });
      return {
        resumo: r.resumo,
        contratos: lim(r.items.map((c) => ({
          id: c.id, numero: c.numero, titulo: c.titulo, cliente: c.client?.nome_fantasia || c.client?.nome, tipo: c.tipo, status: c.status,
          valor_mensal: c.valor_mensal, valor_pontual: c.valor_pontual, inicio: ymd(c.data_inicio), fim: ymd(c.data_fim),
          margem_prevista_percent: c.margem_prevista_percent, cobranca: c.asaas_subscription_id ? 'Asaas (assinatura)' : c.cobrar_via_asaas ? 'Asaas' : 'Manual',
        }))),
      };
    },
  },
  {
    name: 'detalhar_contrato', perm: null,
    description: 'Detalhes de um contrato: itens, cliente, títulos gerados e margem realizada (total e mês). Aceita número (#12) ou nome.',
    schema: { ...idOuNome('contrato') },
    handler: async (ctx, a) => {
      const c = await R.contract(ctx, a.contrato_id, a.contrato);
      const det = await contracts.get(ctx, c.id);
      const tx = await transactions.list(ctx, { contract_id: c.id });
      const margem = await reports.contractsMargin(ctx, { from: det.data_inicio, to: new Date(), contract_id: c.id });
      return { contrato: det, margem_acumulada: margem.contratos[0] || null, lancamentos: lim(tx.items.map(enxuto), 30) };
    },
  },
  {
    name: 'listar_propostas', perm: null,
    description: 'Lista propostas comerciais com status (rascunho, enviada, visualizada, aceita, recusada, expirada), valores e pipeline.',
    schema: { status: z.enum(['RASCUNHO', 'ENVIADA', 'VISUALIZADA', 'ACEITA', 'RECUSADA', 'EXPIRADA']).optional(), busca: z.string().optional() },
    handler: async (ctx, a) => {
      const r = await proposals.list(ctx, { status: a.status, q: a.busca });
      return {
        resumo: r.resumo,
        propostas: lim(r.items.map((p) => ({
          id: p.id, numero: p.numero, titulo: p.titulo, cliente: p.client?.nome || p.prospect_empresa || p.prospect_nome, status: p.status_efetivo,
          total_recorrente_mensal: p.total_recorrente, total_unico: p.total_unico, margem_recorrente_percent: p.margem_recorrente_percent,
          visualizacoes: p.visualizacoes, validade: ymd(p.validade), link: `/proposta/${p.public_token}`,
        }))),
      };
    },
  },
  {
    name: 'cadastros_auxiliares', perm: null,
    description: 'Retorna plano de contas, centros de custo, contas financeiras e equipe (com custo/hora). Use para escolher a classificação correta de lançamentos.',
    schema: {},
    handler: async (ctx) => ({
      plano_de_contas: (await registry.list(ctx, 'accounts', { ativo: true })).map((c) => ({ id: c.id, codigo: c.codigo, nome: c.nome, natureza: c.natureza, grupo_dre: c.grupo_dre })),
      centros_de_custo: (await registry.list(ctx, 'cost-centers', { ativo: true })).map((c) => ({ id: c.id, nome: c.nome })),
      contas_financeiras: (await registry.list(ctx, 'bank-accounts', { ativo: true })).map((c) => ({ id: c.id, nome: c.nome, tipo: c.tipo })),
      equipe: (await team.listTeam(ctx)).filter((m) => m.ativo).map((m) => ({ id: m.id, nome: m.nome, cargo: m.cargo, custo_hora: m.custo_hora })),
    }),
  },

  // ───────────── Cadastros ─────────────
  {
    name: 'criar_cliente', perm: 'clientes:write',
    description: 'Cadastra um cliente. CPF/CNPJ é necessário para emitir cobranças no Asaas.',
    schema: {
      nome: z.string(), nome_fantasia: z.string().optional(), tipo_pessoa: z.enum(['PF', 'PJ']).optional(), documento: z.string().optional(),
      email: z.string().optional(), telefone: z.string().optional(), contato_nome: z.string().optional(), segmento: z.string().optional(), origem: z.string().optional(),
    },
    handler: (ctx, a) => registry.create(ctx, 'clients', a),
  },
  {
    name: 'criar_fornecedor', perm: 'cadastros:write',
    description: 'Cadastra um fornecedor/prestador (freelancer, veículo de mídia, software...).',
    schema: { nome: z.string(), documento: z.string().optional(), email: z.string().optional(), telefone: z.string().optional(), categoria: z.string().optional(), chave_pix: z.string().optional() },
    handler: (ctx, a) => registry.create(ctx, 'suppliers', a),
  },
  {
    name: 'criar_produto_servico', perm: 'cadastros:write',
    description: 'Cadastra produto (com estoque) ou serviço (avulso ou recorrente) com preço de venda e custo direto unitário.',
    schema: {
      tipo: z.enum(['PRODUTO', 'SERVICO']), nome: z.string(), descricao: z.string().optional(), preco_venda: z.number(), custo_unitario: z.number().optional(),
      horas_estimadas: z.number().optional(), cobranca: z.enum(['UNICA', 'RECORRENTE']).optional(), unidade: z.string().optional(), categoria: z.string().optional(),
      controla_estoque: z.boolean().optional(), estoque_inicial: z.number().optional(), estoque_minimo: z.number().optional(), codigo: z.string().optional(),
    },
    handler: (ctx, a) => products.create(ctx, a),
  },
  {
    name: 'movimentar_estoque', perm: 'operacional:write',
    description: 'Entrada (compra, recalcula custo médio), saída (consumo/venda; com contrato vira custo do contrato) ou ajuste (define saldo).',
    schema: {
      ...idOuNome('produto'), tipo: z.enum(['ENTRADA', 'SAIDA', 'AJUSTE']), quantidade: z.number(), custo_unitario: z.number().optional(),
      ...idOuNome('contrato'), observacao: z.string().optional(),
    },
    handler: async (ctx, a) => {
      const p = await R.product(ctx, a.produto_id, a.produto);
      const c = a.contrato_id || a.contrato ? await R.contract(ctx, a.contrato_id, a.contrato) : null;
      return products.moveStock(ctx, p.id, { tipo: a.tipo, quantidade: a.quantidade, custo_unitario: a.custo_unitario, contract_id: c?.id, observacao: a.observacao });
    },
  },

  // ───────────── Financeiro ─────────────
  {
    name: 'criar_conta_receber', perm: 'financeiro:write',
    description: 'Lança conta a receber. Pode parcelar (parcelas) ou repetir mensalmente (repetir) e emitir a cobrança no Asaas (boleto/PIX/cartão) com cobrar_asaas=true.',
    schema: {
      descricao: z.string(), valor: z.number().describe('Valor total (se parcelado, é dividido)'), vencimento: z.string().describe('AAAA-MM-DD'),
      ...idOuNome('cliente'), ...idOuNome('contrato'), conta: z.string().optional().describe('Código ou nome da conta do plano de contas'),
      centro_custo: z.string().optional(), competencia: z.string().optional().describe('AAAA-MM (padrão: mês do vencimento)'),
      parcelas: z.number().int().min(1).max(120).optional(), repetir: z.number().int().min(1).max(120).optional(),
      forma_pagamento: z.enum(['BOLETO', 'PIX', 'CARTAO', 'UNDEFINED', 'TRANSFERENCIA', 'DINHEIRO']).optional(), cobrar_asaas: z.boolean().optional(),
      documento: z.string().optional(), observacoes: z.string().optional(),
    },
    handler: async (ctx, a) => {
      const [cl, ct, acc, cc] = await Promise.all([
        a.cliente_id || a.cliente ? R.client(ctx, a.cliente_id, a.cliente) : null,
        a.contrato_id || a.contrato ? R.contract(ctx, a.contrato_id, a.contrato) : null,
        a.conta ? R.account(ctx, null, a.conta) : null,
        a.centro_custo ? R.costCenter(ctx, null, a.centro_custo) : null,
      ]);
      const r = await transactions.create(ctx, {
        tipo: 'RECEITA', descricao: a.descricao, valor: a.valor, vencimento: a.vencimento, competencia: a.competencia, client_id: cl?.id, contract_id: ct?.id,
        account_id: acc?.id, cost_center_id: cc?.id, parcelas: a.parcelas, repetir: a.repetir, forma_pagamento: a.forma_pagamento, cobrar_asaas: a.cobrar_asaas,
        documento: a.documento, observacoes: a.observacoes,
      });
      return r.map(enxuto);
    },
  },
  {
    name: 'criar_conta_pagar', perm: 'financeiro:write',
    description: 'Lança conta a pagar (despesa/custo). Vincule a um contrato para que vire custo direto e reduza a margem dele. Pode parcelar, repetir mensalmente ou já lançar como pago.',
    schema: {
      descricao: z.string(), valor: z.number(), vencimento: z.string().describe('AAAA-MM-DD'), ...idOuNome('fornecedor'), ...idOuNome('contrato'),
      conta: z.string().optional().describe('Código ou nome da conta (ex.: "3.1.01" ou "Freelancers")'), centro_custo: z.string().optional(),
      competencia: z.string().optional(), parcelas: z.number().int().min(1).max(120).optional(), repetir: z.number().int().min(1).max(120).optional(),
      forma_pagamento: z.string().optional(), ja_pago: z.boolean().optional(), data_pagamento: z.string().optional(), documento: z.string().optional(), observacoes: z.string().optional(),
    },
    handler: async (ctx, a) => {
      const [sp, ct, acc, cc] = await Promise.all([
        a.fornecedor_id || a.fornecedor ? R.supplier(ctx, a.fornecedor_id, a.fornecedor) : null,
        a.contrato_id || a.contrato ? R.contract(ctx, a.contrato_id, a.contrato) : null,
        a.conta ? R.account(ctx, null, a.conta) : null,
        a.centro_custo ? R.costCenter(ctx, null, a.centro_custo) : null,
      ]);
      const r = await transactions.create(ctx, {
        tipo: 'DESPESA', descricao: a.descricao, valor: a.valor, vencimento: a.vencimento, competencia: a.competencia, supplier_id: sp?.id, contract_id: ct?.id,
        account_id: acc?.id, cost_center_id: cc?.id, parcelas: a.parcelas, repetir: a.repetir, forma_pagamento: a.forma_pagamento,
        pago: a.ja_pago, data_pagamento: a.data_pagamento, documento: a.documento, observacoes: a.observacoes,
      });
      return r.map(enxuto);
    },
  },
  {
    name: 'atualizar_lancamento', perm: 'financeiro:write',
    description: 'Altera um lançamento (valor, vencimento, classificação, contrato, centro de custo...).',
    schema: {
      lancamento_id: z.string(), descricao: z.string().optional(), valor: z.number().optional(), vencimento: z.string().optional(), competencia: z.string().optional(),
      conta: z.string().optional(), centro_custo: z.string().optional(), ...idOuNome('contrato'), observacoes: z.string().optional(),
      aplicar_proximas: z.boolean().optional().describe('Aplica classificação às próximas parcelas/recorrências'),
    },
    handler: async (ctx, a) => {
      const patch = { descricao: a.descricao, valor: a.valor, vencimento: a.vencimento, competencia: a.competencia, observacoes: a.observacoes, aplicar_proximas: a.aplicar_proximas };
      if (a.conta) patch.account_id = (await R.account(ctx, null, a.conta)).id;
      if (a.centro_custo) patch.cost_center_id = (await R.costCenter(ctx, null, a.centro_custo)).id;
      if (a.contrato_id || a.contrato) patch.contract_id = (await R.contract(ctx, a.contrato_id, a.contrato)).id;
      return enxuto(await transactions.update(ctx, a.lancamento_id, patch));
    },
  },
  {
    name: 'baixar_lancamento', perm: 'financeiro:write',
    description: 'Registra o pagamento/recebimento (total ou parcial) de um lançamento. Se a cobrança estiver no Asaas, informa o recebimento em dinheiro lá também.',
    schema: {
      lancamento_id: z.string(), valor: z.number().optional().describe('Padrão: saldo em aberto'), data_pagamento: z.string().optional(),
      juros_multa: z.number().optional(), desconto: z.number().optional(), conta_financeira: z.string().optional(),
    },
    handler: async (ctx, a) => {
      const ba = a.conta_financeira ? await R.bankAccount(ctx, null, a.conta_financeira) : null;
      return enxuto(await transactions.pay(ctx, a.lancamento_id, { valor: a.valor, data_pagamento: a.data_pagamento, juros_multa: a.juros_multa, desconto: a.desconto, bank_account_id: ba?.id }));
    },
  },
  {
    name: 'cancelar_lancamento', perm: 'financeiro:write',
    description: 'Cancela um lançamento em aberto (e a cobrança no Asaas, se houver).',
    schema: { lancamento_id: z.string(), motivo: z.string().optional() },
    handler: async (ctx, a) => enxuto(await transactions.cancel(ctx, a.lancamento_id, { motivo: a.motivo })),
  },
  {
    name: 'emitir_cobranca_asaas', perm: 'financeiro:write',
    description: 'Emite no Asaas a cobrança de uma conta a receber já lançada e devolve o link de pagamento (boleto/PIX/cartão).',
    schema: { lancamento_id: z.string(), forma_pagamento: z.enum(['BOLETO', 'PIX', 'CARTAO', 'UNDEFINED']).optional() },
    handler: async (ctx, a) => {
      const t = await transactions.charge(ctx, a.lancamento_id, { forma_pagamento: a.forma_pagamento });
      return { ...enxuto(t), asaas_id: t.asaas_payment_id, boleto: t.asaas_boleto_url, pix_copia_e_cola: t.asaas_pix_payload };
    },
  },

  // ───────────── Comercial e contratos ─────────────
  {
    name: 'criar_proposta', perm: 'comercial:write',
    description: 'Cria uma proposta comercial com a marca da empresa. Itens podem referenciar produtos/serviços do catálogo (preço e custo vêm do catálogo) ou ser livres. Retorna a margem estimada.',
    schema: {
      titulo: z.string(), ...idOuNome('cliente'), prospect_nome: z.string().optional(), prospect_empresa: z.string().optional(), prospect_email: z.string().optional(),
      introducao: z.string().optional().describe('Texto de abertura (markdown)'), escopo: z.string().optional().describe('Entregáveis (markdown)'),
      condicoes: z.string().optional(), desconto_percent: z.number().optional(), prazo_contrato_meses: z.number().int().optional(), validade: z.string().optional(),
      itens: z.array(z.object({
        produto: z.string().optional().describe('Nome do produto/serviço do catálogo'), produto_id: z.string().optional(),
        descricao: z.string().optional(), detalhes: z.string().optional(), quantidade: z.number().optional(), preco_unitario: z.number().optional(),
        custo_unitario: z.number().optional(), cobranca: z.enum(['UNICA', 'RECORRENTE']).optional(),
      })),
    },
    handler: async (ctx, a) => {
      const cl = a.cliente_id || a.cliente ? await R.client(ctx, a.cliente_id, a.cliente) : null;
      const items = [];
      for (const i of a.itens) {
        const p = i.produto_id || i.produto ? await R.product(ctx, i.produto_id, i.produto) : null;
        items.push({ ...i, product_id: p?.id });
      }
      const p = await proposals.create(ctx, { ...a, client_id: cl?.id, items });
      return { id: p.id, numero: p.numero, titulo: p.titulo, total_recorrente_mensal: p.total_recorrente, total_unico: p.total_unico, margem_recorrente_percent: p.margem_recorrente_percent, margem_unica: p.margem_unica, status: p.status, itens: p.items.map((i) => ({ descricao: i.descricao, quantidade: i.quantidade, preco_unitario: i.preco_unitario, total: i.total, cobranca: i.cobranca })) };
    },
  },
  {
    name: 'enviar_proposta', perm: 'comercial:write',
    description: 'Marca a proposta como enviada e devolve o link público (com a marca da empresa) para compartilhar por WhatsApp/e-mail. Opcionalmente envia por e-mail.',
    schema: { ...idOuNome('proposta'), enviar_email: z.boolean().optional() },
    handler: async (ctx, a) => {
      const p = await R.proposal(ctx, a.proposta_id, a.proposta);
      const r = await proposals.send(ctx, p.id, { baseUrl: process.env.APP_URL || '', enviar_email: a.enviar_email });
      return { numero: r.numero, status: r.status, link: r.link, email_enviado: r.email_enviado };
    },
  },
  {
    name: 'converter_proposta_em_contrato', perm: 'contratos:write',
    description: 'Converte uma proposta (aceita ou fechada por fora) em contrato. Com ativar=true já inicia o faturamento (assinatura no Asaas ou títulos internos).',
    schema: { ...idOuNome('proposta'), ativar: z.boolean().optional(), dia_vencimento: z.number().int().min(1).max(28).optional(), data_inicio: z.string().optional(), forma_pagamento: z.enum(['BOLETO', 'PIX', 'CARTAO', 'UNDEFINED', 'MANUAL']).optional() },
    handler: async (ctx, a) => {
      const p = await R.proposal(ctx, a.proposta_id, a.proposta);
      const c = await proposals.convert(ctx, p.id, { ativar: !!a.ativar, dia_vencimento: a.dia_vencimento, data_inicio: a.data_inicio, forma_pagamento: a.forma_pagamento });
      return { contrato_id: c.id, numero: c.numero, status: c.status, valor_mensal: c.valor_mensal, valor_pontual: c.valor_pontual };
    },
  },
  {
    name: 'criar_contrato', perm: 'contratos:write',
    description: 'Cria contrato recorrente (fee mensal, SaaS) ou pontual (projeto) e, por padrão, ativa o faturamento. Informe custo_previsto_mensal e horas_previstas_mensal para acompanhar a margem prevista × realizada.',
    schema: {
      ...idOuNome('cliente'), titulo: z.string().optional(), tipo: z.enum(['RECORRENTE', 'PONTUAL']),
      valor_recorrente: z.number().optional().describe('Valor por ciclo (ex.: mensal)'), periodicidade: z.enum(['MENSAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL']).optional(),
      valor_pontual: z.number().optional().describe('Projeto ou taxa de setup'), parcelas_pontual: z.number().int().optional(),
      data_inicio: z.string().optional(), data_fim: z.string().optional(), dia_vencimento: z.number().int().min(1).max(28).optional(),
      forma_pagamento: z.enum(['BOLETO', 'PIX', 'CARTAO', 'UNDEFINED', 'MANUAL']).optional(), cobrar_via_asaas: z.boolean().optional(),
      custo_previsto_mensal: z.number().optional(), horas_previstas_mensal: z.number().optional(), comissao_percent: z.number().optional(),
      centro_custo: z.string().optional(), responsavel: z.string().optional(), ativar: z.boolean().optional(),
    },
    handler: async (ctx, a) => {
      const cl = await R.client(ctx, a.cliente_id, a.cliente);
      if (!cl) throw new Error('Informe o cliente');
      const cc = a.centro_custo ? await R.costCenter(ctx, null, a.centro_custo) : null;
      const c = await contracts.create(ctx, { ...a, client_id: cl.id, cost_center_id: cc?.id, ativar: a.ativar !== false });
      return { id: c.id, numero: c.numero, titulo: c.titulo, status: c.status, valor_mensal: c.valor_mensal, mrr: c.mrr, assinatura_asaas: c.asaas_subscription_id };
    },
  },
  {
    name: 'alterar_status_contrato', perm: 'contratos:write',
    description: 'Ativa, pausa, encerra ou cancela um contrato. Cancelar/encerrar remove a assinatura no Asaas e cancela títulos futuros em aberto.',
    schema: { ...idOuNome('contrato'), status: z.enum(['ATIVO', 'PAUSADO', 'ENCERRADO', 'CANCELADO']), motivo: z.string().optional(), data: z.string().optional() },
    handler: async (ctx, a) => {
      const c = await R.contract(ctx, a.contrato_id, a.contrato);
      const r = await contracts.setStatus(ctx, c.id, a.status, { motivo: a.motivo, data: a.data });
      return { numero: r.numero, titulo: r.titulo, status: r.status };
    },
  },
  {
    name: 'reajustar_contrato', perm: 'contratos:write',
    description: 'Aplica reajuste (percentual ou novo valor) a um contrato recorrente, atualizando itens, assinatura no Asaas e títulos futuros.',
    schema: { ...idOuNome('contrato'), percentual: z.number().optional(), novo_valor: z.number().optional(), a_partir: z.string().optional() },
    handler: async (ctx, a) => {
      const c = await R.contract(ctx, a.contrato_id, a.contrato);
      const r = await contracts.readjust(ctx, c.id, a);
      return { numero: r.numero, titulo: r.titulo, valor_recorrente: r.valor_recorrente, valor_mensal: r.valor_mensal };
    },
  },
  {
    name: 'apontar_horas', perm: 'operacional:write',
    description: 'Registra horas trabalhadas por um colaborador, em um contrato (vira custo do contrato) ou internas.',
    schema: { ...idOuNome('colaborador'), horas: z.number(), ...idOuNome('contrato'), data: z.string().optional(), descricao: z.string().optional() },
    handler: async (ctx, a) => {
      const m = await R.teamMember(ctx, a.colaborador_id, a.colaborador);
      if (!m) throw new Error('Informe o colaborador');
      const c = a.contrato_id || a.contrato ? await R.contract(ctx, a.contrato_id, a.contrato) : null;
      return team.createEntry(ctx, { team_member_id: m.id, contract_id: c?.id, horas: a.horas, data: a.data || ymd(today()), descricao: a.descricao });
    },
  },

  // ───────────── Integração Inteligente Asaas e Dashboards ─────────────
  {
    name: 'criar_assinatura_asaas', perm: 'financeiro:write',
    description: 'Cria uma assinatura recorrente no Asaas diretamente a partir de Contas a Receber. Suporta periodicidades (SEMANAL, MENSAL, etc.), cadastra novo cliente na hora se necessário com CPF/CNPJ, gera o contrato e cria a primeira cobrança já com link de pagamento emitido.',
    schema: {
      ...idOuNome('cliente'),
      novo_cliente: z.object({
        nome: z.string(),
        cpf_cnpj: z.string().describe('CPF ou CNPJ obrigatório para o Asaas'),
        email: z.string().optional(),
        celular: z.string().optional(),
      }).optional().describe('Informe para cadastrar um novo cliente automaticamente caso ainda não exista'),
      valor: z.number().describe('Valor de cada ciclo de cobrança'),
      periodicidade: z.enum(['SEMANAL', 'QUINZENAL', 'MENSAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL']).optional().default('MENSAL'),
      vencimento: z.string().optional().describe('Data do primeiro vencimento AAAA-MM-DD (padrão: hoje)'),
      descricao: z.string().optional().describe('Descrição da assinatura'),
      competencia: z.string().optional(),
      formas_pagamento: z.array(z.string()).optional().describe('Formas aceitas pelo Asaas (ex: BOLETO, CREDIT_CARD, PIX)'),
    },
    handler: async (ctx, a) => {
      let clientId = a.cliente_id;
      if (!clientId && a.cliente) {
        const found = await R.client(ctx, null, a.cliente);
        clientId = found?.id;
      }
      return transactions.createSubscription(ctx, {
        client_id: clientId,
        novo_cliente: a.novo_cliente,
        valor: a.valor,
        periodicidade: a.periodicidade || 'MENSAL',
        vencimento: a.vencimento,
        descricao: a.descricao,
        competencia: a.competencia,
        billing_types: a.formas_pagamento,
      });
    },
  },
  {
    name: 'sincronizar_asaas', perm: 'financeiro:write',
    description: 'Consulta o status atual no Asaas sob demanda para uma cobrança (conta a receber) ou assinatura de contrato, atualizando se já foi pago, data de quitação, tarifas descontadas, código PIX e PDF do boleto.',
    schema: {
      lancamento_id: z.string().optional().describe('ID do lançamento de conta a receber'),
      ...idOuNome('contrato'),
    },
    handler: async (ctx, a) => {
      if (a.lancamento_id) {
        return transactions.syncAsaas(ctx, a.lancamento_id);
      }
      const c = a.contrato_id || a.contrato ? await R.contract(ctx, a.contrato_id, a.contrato) : null;
      if (c) {
        return contracts.syncAsaas(ctx, c.id);
      }
      throw new Error('Informe lancamento_id ou contrato');
    },
  },
  {
    name: 'gerar_link_pagamento', perm: 'financeiro:write',
    description: 'Gera cobrança no Asaas com fatura web, QR Code PIX e boleto bancário para uma conta a receber em aberto. Se o cliente não possuir CPF/CNPJ previamente cadastrado, informe no parâmetro cpf_cnpj.',
    schema: {
      lancamento_id: z.string().describe('ID do lançamento'),
      cpf_cnpj: z.string().optional().describe('CPF ou CNPJ do cliente caso falte no cadastro'),
      forma_pagamento: z.enum(['BOLETO', 'PIX', 'CARTAO', 'UNDEFINED']).optional(),
    },
    handler: async (ctx, a) => {
      const t = await transactions.charge(ctx, a.lancamento_id, {
        forma_pagamento: a.forma_pagamento,
        client_data: a.cpf_cnpj ? { cpfCnpj: a.cpf_cnpj } : undefined,
      });
      return {
        ...enxuto(t),
        link_fatura: t.asaas_invoice_url,
        pix_copia_e_cola: t.asaas_pix_payload,
        boleto_url: t.asaas_boleto_url,
        status_asaas: t.asaas_status,
      };
    },
  },
  {
    name: 'dashboard_financeiro', perm: 'relatorios:read',
    description: 'Retorna um dashboard executivo consolidado com indicadores financeiros em tempo real e filtros de período: hoje, semana, 15d (últimos 15 dias), 30d (últimos 30 dias), mes (mês atual) ou personalizado (de/até). Traz totais a receber, a pagar, saldo, vencidos, taxas e situação das cobranças Asaas.',
    schema: {
      periodo: z.enum(['hoje', 'semana', '15d', '30d', 'mes', 'personalizado']).optional().default('mes'),
      de: z.string().optional().describe('Data de início AAAA-MM-DD (se personalizado)'),
      ate: z.string().optional().describe('Data de término AAAA-MM-DD (se personalizado)'),
    },
    handler: async (ctx, a) => {
      const { getAiDashboard } = require('../services/aiBridge');
      return getAiDashboard(ctx, a);
    },
  },

  // ───────────── Funcionalidades completas do Freedom Empresas ─────────────
  {
    name: 'ranking_clientes', perm: 'relatorios:read',
    description: 'Ranking dos melhores clientes (Ouro, Prata e Bronze) por valor pago (LTV), pontualidade e tempo de casa, além do LTV médio da empresa.',
    schema: { limite: z.number().int().min(1).max(100).optional() },
    handler: (ctx, a) => reports.clientsRanking(ctx, { limit: a.limite || 15 }),
  },
  {
    name: 'saldo_asaas', perm: 'relatorios:read',
    description: 'Consulta o saldo em tempo real disponível na conta Asaas conectada à empresa.',
    schema: {},
    handler: async (ctx) => {
      const full = await prisma.bizCompany.findUnique({
        where: { id: ctx.companyId },
        select: { asaas_api_key: true, asaas_ambiente: true },
      });
      if (!full?.asaas_api_key) return { configurado: false, conectado: false, saldo: null };
      try {
        const bal = await new AsaasClient(full).getBalance();
        const saldo = typeof bal?.balance === 'number' ? bal.balance : (bal?.totalBalance != null ? Number(bal.totalBalance) : (bal?.balance != null ? Number(bal.balance) : null));
        return { configurado: true, conectado: true, ambiente: full.asaas_ambiente, saldo };
      } catch (e) {
        return { configurado: true, conectado: false, ambiente: full.asaas_ambiente, erro: e.message, saldo: null };
      }
    },
  },
  {
    name: 'sincronizar_conta_asaas', perm: 'financeiro:write',
    description: 'Sincroniza e importa todo o histórico da conta Asaas (clientes, assinaturas, cobranças a receber e contas a pagar) sem duplicidades.',
    schema: {},
    handler: (ctx) => asaasImport.syncAllFromAsaas(ctx, {}),
  },
  {
    name: 'links_pagamento_asaas', perm: 'financeiro:write',
    description: 'Lista ou cria Links de Pagamento avulsos ou recorrentes diretamente no Asaas.',
    schema: {
      acao: z.enum(['listar', 'criar']),
      nome: z.string().optional().describe('Obrigatório ao criar'),
      descricao: z.string().optional(),
      valor: z.number().positive().optional().describe('Obrigatório ao criar'),
      tipo_cobranca: z.enum(['DETACHED', 'RECURRENT', 'INSTALLMENT']).optional(),
      forma_pagamento: z.enum(['UNDEFINED', 'BOLETO', 'CREDIT_CARD', 'PIX']).optional(),
      max_parcelas: z.number().int().min(1).max(24).optional(),
    },
    handler: async (ctx, a) => {
      if (a.acao === 'listar') return asaasImport.listPaymentLinks(ctx, {});
      return asaasImport.createPaymentLink(ctx, {
        name: a.nome,
        description: a.descricao,
        value: a.valor,
        chargeType: a.tipo_cobranca || 'DETACHED',
        billingType: a.forma_pagamento || 'UNDEFINED',
        maxInstallmentCount: a.max_parcelas || 1,
      });
    },
  },
  {
    name: 'pagar_boleto_asaas', perm: 'financeiro:write',
    description: 'Paga ou agenda o pagamento de um boleto bancário usando o saldo da conta Asaas e lança automaticamente no Contas a Pagar.',
    schema: {
      linha_digitavel: z.string().min(10).describe('Linha digitável ou código de barras do boleto'),
      valor: z.number().positive().describe('Valor do boleto'),
      vencimento: z.string().optional().describe('AAAA-MM-DD'),
      data_agendamento: z.string().optional().describe('AAAA-MM-DD (se não informado, agenda/paga hoje)'),
      descricao: z.string().optional(),
      ...idOuNome('fornecedor'),
      conta: z.string().optional().describe('Conta do plano de contas'),
      centro_custo: z.string().optional(),
    },
    handler: async (ctx, a) => {
      const [sp, acc, cc] = await Promise.all([
        a.fornecedor_id || a.fornecedor ? R.supplier(ctx, a.fornecedor_id, a.fornecedor) : null,
        a.conta ? R.account(ctx, null, a.conta) : null,
        a.centro_custo ? R.costCenter(ctx, null, a.centro_custo) : null,
      ]);
      return asaasImport.payBillViaAsaas(ctx, {
        identificationField: a.linha_digitavel,
        value: a.valor,
        dueDate: a.vencimento,
        scheduleDate: a.data_agendamento,
        description: a.descricao,
        supplier_id: sp?.id,
        account_id: acc?.id,
        cost_center_id: cc?.id,
      });
    },
  },
  {
    name: 'gerenciar_nfse', perm: 'financeiro:write',
    description: 'Emite, consulta status (PDF/XML) ou cancela a Nota Fiscal de Serviço Eletrônica (NFS-e) no Asaas de uma conta a receber.',
    schema: {
      acao: z.enum(['emitir', 'consultar', 'cancelar']),
      lancamento_id: z.string(),
      descricao_servico: z.string().optional(),
      codigo_servico_municipal: z.string().optional(),
      motivo: z.string().optional(),
    },
    handler: async (ctx, a) => {
      if (a.acao === 'emitir') {
        return invoices.issueInvoice(ctx, a.lancamento_id, {
          serviceDescription: a.descricao_servico,
          municipalServiceCode: a.codigo_servico_municipal,
        });
      }
      if (a.acao === 'consultar') return invoices.syncInvoiceStatus(ctx, a.lancamento_id);
      return invoices.cancelInvoice(ctx, a.lancamento_id, { motivo: a.motivo });
    },
  },
  {
    name: 'estornar_lancamento', perm: 'financeiro:write',
    description: 'Estorna a baixa de um lançamento pago, retornando-o para pendente.',
    schema: { lancamento_id: z.string() },
    handler: async (ctx, a) => enxuto(await transactions.reopen(ctx, a.lancamento_id)),
  },
  {
    name: 'excluir_lancamento', perm: 'financeiro:write',
    description: 'Exclui definitivamente um lançamento não pago.',
    schema: { lancamento_id: z.string() },
    handler: (ctx, a) => transactions.remove(ctx, a.lancamento_id),
  },
  {
    name: 'operacao_lote_lancamentos', perm: 'financeiro:write',
    description: 'Executa baixa, cancelamento, exclusão ou atualização (conta DRE, centro de custo, forma de pagamento, vencimento) em vários lançamentos de uma só vez.',
    schema: {
      acao: z.enum(['baixar', 'cancelar', 'excluir', 'atualizar']),
      ids: z.array(z.string()).min(1),
      data_pagamento: z.string().optional(),
      conta_financeira: z.string().optional(),
      motivo: z.string().optional(),
      cancelar_asaas: z.boolean().optional(),
      conta: z.string().optional().describe('Conta do plano de contas (para acao=atualizar)'),
      centro_custo: z.string().optional(),
      forma_pagamento: z.string().optional(),
      vencimento: z.string().optional(),
    },
    handler: async (ctx, a) => {
      if (a.acao === 'baixar') {
        const ba = a.conta_financeira ? await R.bankAccount(ctx, null, a.conta_financeira) : null;
        return transactions.batchPay(ctx, { ids: a.ids, data_pagamento: a.data_pagamento, bank_account_id: ba?.id });
      }
      if (a.acao === 'cancelar') {
        return transactions.batchCancel(ctx, { ids: a.ids, motivo: a.motivo, cancelar_asaas: !!a.cancelar_asaas });
      }
      if (a.acao === 'excluir') {
        return transactions.batchDelete(ctx, { ids: a.ids });
      }
      const patch = {};
      if (a.conta) patch.account_id = (await R.account(ctx, null, a.conta)).id;
      if (a.centro_custo) patch.cost_center_id = (await R.costCenter(ctx, null, a.centro_custo)).id;
      if (a.conta_financeira) patch.bank_account_id = (await R.bankAccount(ctx, null, a.conta_financeira)).id;
      if (a.forma_pagamento) patch.forma_pagamento = a.forma_pagamento;
      if (a.vencimento) patch.vencimento = a.vencimento;
      return transactions.batchUpdate(ctx, { ids: a.ids, patch });
    },
  },
  {
    name: 'buscar_fornecedores', perm: null,
    description: 'Busca fornecedores e prestadores cadastrados por nome, CNPJ/CPF, e-mail ou categoria.',
    schema: { busca: z.string().optional(), categoria: z.string().optional(), ativo: z.boolean().optional() },
    handler: async (ctx, a) => lim(await registry.list(ctx, 'suppliers', { q: a.busca, categoria: a.categoria, ativo: a.ativo })),
  },
  {
    name: 'gerenciar_cliente', perm: 'clientes:write',
    description: 'Edita dados ou exclui/inativa um cliente existente.',
    schema: {
      acao: z.enum(['editar', 'excluir']),
      ...idOuNome('cliente'),
      nome: z.string().optional(),
      nome_fantasia: z.string().optional(),
      documento: z.string().optional(),
      email: z.string().optional(),
      telefone: z.string().optional(),
      contato_nome: z.string().optional(),
      segmento: z.string().optional(),
      status: z.enum(['LEAD', 'ATIVO', 'INATIVO', 'CHURN']).optional(),
      observacoes: z.string().optional(),
    },
    handler: async (ctx, a) => {
      const cl = await R.client(ctx, a.cliente_id, a.cliente);
      if (!cl) throw new Error('Informe o cliente');
      if (a.acao === 'excluir') return registry.remove(ctx, 'clients', cl.id);
      const { acao, cliente_id, cliente, ...patch } = a;
      return registry.update(ctx, 'clients', cl.id, patch);
    },
  },
  {
    name: 'gerenciar_fornecedor', perm: 'cadastros:write',
    description: 'Edita dados ou exclui um fornecedor/prestador existente.',
    schema: {
      acao: z.enum(['editar', 'excluir']),
      ...idOuNome('fornecedor'),
      nome: z.string().optional(),
      documento: z.string().optional(),
      email: z.string().optional(),
      telefone: z.string().optional(),
      categoria: z.string().optional(),
      chave_pix: z.string().optional(),
      observacoes: z.string().optional(),
      ativo: z.boolean().optional(),
    },
    handler: async (ctx, a) => {
      const sp = await R.supplier(ctx, a.fornecedor_id, a.fornecedor);
      if (!sp) throw new Error('Informe o fornecedor');
      if (a.acao === 'excluir') return registry.remove(ctx, 'suppliers', sp.id);
      const { acao, fornecedor_id, fornecedor, ...patch } = a;
      return registry.update(ctx, 'suppliers', sp.id, patch);
    },
  },
  {
    name: 'gerenciar_produto_servico', perm: 'cadastros:write',
    description: 'Edita, exclui ou consulta movimentações de estoque de um produto ou serviço.',
    schema: {
      acao: z.enum(['editar', 'excluir', 'movimentacoes']),
      ...idOuNome('produto'),
      nome: z.string().optional(),
      descricao: z.string().optional(),
      preco_venda: z.number().optional(),
      custo_unitario: z.number().optional(),
      horas_estimadas: z.number().optional(),
      cobranca: z.enum(['UNICA', 'RECORRENTE']).optional(),
      estoque_minimo: z.number().optional(),
      ativo: z.boolean().optional(),
    },
    handler: async (ctx, a) => {
      const p = await R.product(ctx, a.produto_id, a.produto);
      if (!p) throw new Error('Informe o produto ou serviço');
      if (a.acao === 'movimentacoes') return lim(await products.listMovements(ctx, { product_id: p.id }));
      if (a.acao === 'excluir') return products.remove(ctx, p.id);
      const { acao, produto_id, produto, ...patch } = a;
      return products.update(ctx, p.id, patch);
    },
  },
  {
    name: 'gerenciar_cadastro_auxiliar', perm: 'config:write',
    description: 'Cria, edita ou exclui cadastros auxiliares: accounts (plano de contas), cost-centers (centros de custo), bank-accounts (contas bancárias) ou team (colaboradores com custo/hora).',
    schema: {
      entidade: z.enum(['accounts', 'cost-centers', 'bank-accounts', 'team']),
      acao: z.enum(['criar', 'editar', 'excluir']),
      id: z.string().optional(),
      dados: z.record(z.string(), z.any()).optional().describe('Campos do registro conforme a entidade'),
    },
    handler: async (ctx, a) => {
      if (a.acao === 'criar') return registry.create(ctx, a.entidade, a.dados || {});
      if (!a.id) throw new Error('Informe o id do registro');
      if (a.acao === 'excluir') return registry.remove(ctx, a.entidade, a.id);
      return registry.update(ctx, a.entidade, a.id, a.dados || {});
    },
  },
  {
    name: 'editar_contrato', perm: 'contratos:write',
    description: 'Edita parâmetros de um contrato (título, valores, custo direto previsto, horas previstas, dia de vencimento, índice/data de reajuste, comissão, imposto).',
    schema: {
      ...idOuNome('contrato'),
      titulo: z.string().optional(),
      valor_recorrente: z.number().optional(),
      valor_pontual: z.number().optional(),
      dia_vencimento: z.number().int().min(1).max(28).optional(),
      data_fim: z.string().optional(),
      custo_previsto_mensal: z.number().optional(),
      horas_previstas_mensal: z.number().optional(),
      comissao_percent: z.number().optional(),
      aliquota_imposto: z.number().optional(),
      indice_reajuste: z.enum(['IPCA', 'IGPM', 'FIXO', 'NENHUM']).optional(),
      data_reajuste: z.string().optional(),
      responsavel: z.string().optional(),
      observacoes: z.string().optional(),
    },
    handler: async (ctx, a) => {
      const c = await R.contract(ctx, a.contrato_id, a.contrato);
      if (!c) throw new Error('Informe o contrato');
      const { contrato_id, contrato, ...patch } = a;
      return contracts.update(ctx, c.id, patch);
    },
  },
  {
    name: 'excluir_contrato', perm: 'contratos:write',
    description: 'Exclui um contrato em rascunho que não possua lançamentos.',
    schema: { ...idOuNome('contrato') },
    handler: async (ctx, a) => {
      const c = await R.contract(ctx, a.contrato_id, a.contrato);
      if (!c) throw new Error('Informe o contrato');
      return contracts.remove(ctx, c.id);
    },
  },
  {
    name: 'consultar_ipca_e_reajuste_padrao', perm: 'contratos:write',
    description: 'Consulta o IPCA acumulado 12m oficial do Banco Central e, opcionalmente, aplica o reajuste anual padrão (IPCA todo dia 01/01) aos contratos recorrentes sem data definida.',
    schema: { aplicar_padrao_contratos: z.boolean().optional() },
    handler: async (ctx, a) => {
      const ipca = await getIpca12m();
      const padrao = a.aplicar_padrao_contratos ? await contracts.applyDefaultReadjustment(ctx) : null;
      return { ipca, padrao };
    },
  },
  {
    name: 'gerenciar_proposta', perm: 'comercial:write',
    description: 'Detalha, edita, duplica ou exclui uma proposta comercial.',
    schema: {
      acao: z.enum(['detalhar', 'editar', 'duplicar', 'excluir']),
      ...idOuNome('proposta'),
      titulo: z.string().optional(),
      introducao: z.string().optional(),
      escopo: z.string().optional(),
      condicoes: z.string().optional(),
      desconto_percent: z.number().optional(),
      prazo_contrato_meses: z.number().int().optional(),
      validade: z.string().optional(),
    },
    handler: async (ctx, a) => {
      const p = await R.proposal(ctx, a.proposta_id, a.proposta);
      if (!p) throw new Error('Informe a proposta');
      if (a.acao === 'detalhar') return proposals.get(ctx, p.id);
      if (a.acao === 'duplicar') return proposals.duplicate(ctx, p.id);
      if (a.acao === 'excluir') return proposals.remove(ctx, p.id);
      const { acao, proposta_id, proposta, ...patch } = a;
      return proposals.update(ctx, p.id, patch);
    },
  },
  {
    name: 'gerar_proposta_ia', perm: 'comercial:write',
    description: 'Gera uma proposta comercial formal completa via IA a partir do texto/ata de uma reunião comercial, cruzando com catálogo e clientes. Com salvar_rascunho=true já salva na lista de propostas.',
    schema: {
      texto_reuniao: z.string().min(10),
      instrucoes_extras: z.string().optional(),
      ...idOuNome('cliente'),
      salvar_rascunho: z.boolean().optional(),
    },
    handler: async (ctx, a) => {
      const cl = a.cliente_id || a.cliente ? await R.client(ctx, a.cliente_id, a.cliente) : null;
      const res = await proposalAi.generateFromInput(ctx, {
        texto: a.texto_reuniao,
        instrucoes_extras: a.instrucoes_extras,
        client_id: cl?.id,
      });
      if (a.salvar_rascunho) {
        const criada = await proposals.create(ctx, res.proposta);
        return { salva: true, proposta: criada, link_publico: `/proposta/${criada.public_token}` };
      }
      return { salva: false, rascunho_gerado: res.proposta };
    },
  },
  {
    name: 'gerenciar_horas_equipe', perm: 'operacional:write',
    description: 'Lista ou remove apontamentos de horas da equipe em contratos.',
    schema: {
      acao: z.enum(['listar', 'excluir']),
      ...idOuNome('contrato'),
      ...idOuNome('colaborador'),
      apontamento_id: z.string().optional(),
      limite: z.number().int().max(200).optional(),
    },
    handler: async (ctx, a) => {
      if (a.acao === 'excluir') {
        if (!a.apontamento_id) throw new Error('Informe apontamento_id');
        return team.removeEntry(ctx, a.apontamento_id);
      }
      const c = a.contrato_id || a.contrato ? await R.contract(ctx, a.contrato_id, a.contrato) : null;
      const m = a.colaborador_id || a.colaborador ? await R.teamMember(ctx, a.colaborador_id, a.colaborador) : null;
      return lim(await team.listEntries(ctx, { contract_id: c?.id, team_member_id: m?.id, limit: a.limite || 50 }));
    },
  },
  {
    name: 'consultar_metas_caixa', perm: 'relatorios:read',
    description: 'Consulta as metas de caixa e reservas empresariais, fôlego financeiro (meses de cobertura / saúde), saldo acumulado e histórico de aportes.',
    schema: {},
    handler: (ctx) => cashGoals.list(ctx),
  },
  {
    name: 'gerenciar_meta_caixa', perm: 'financeiro:write',
    description: 'Cria, edita ou exclui uma meta de caixa / reserva empresarial (com valor alvo, aporte mensal e taxa estimada de rendimento).',
    schema: {
      acao: z.enum(['criar', 'editar', 'excluir']),
      id: z.string().optional(),
      nome: z.string().optional(),
      descricao: z.string().optional(),
      valor_meta: z.number().positive().optional(),
      aporte_mensal: z.number().min(0).optional(),
      taxa_mensal_percent: z.number().min(0).optional(),
      prazo_meses: z.number().int().min(1).max(360).optional(),
      saldo_inicial: z.number().min(0).optional(),
      conta_financeira: z.string().optional(),
    },
    handler: async (ctx, a) => {
      const ba = a.conta_financeira ? await R.bankAccount(ctx, null, a.conta_financeira) : null;
      if (a.acao === 'criar') {
        return cashGoals.createGoal(ctx, {
          nome: a.nome, descricao: a.descricao, valor_meta: a.valor_meta, aporte_mensal: a.aporte_mensal,
          taxa_mensal_percent: a.taxa_mensal_percent, prazo_meses: a.prazo_meses, saldo_inicial: a.saldo_inicial,
          bank_account_id: ba?.id,
        });
      }
      let targetId = a.id;
      if (!targetId && a.nome) {
        const list = await cashGoals.list(ctx);
        const ql = a.nome.toLowerCase();
        const found = list.items.find((g) => g.nome.toLowerCase() === ql) || list.items.find((g) => g.nome.toLowerCase().includes(ql));
        if (!found) throw new Error(`Meta de caixa "${a.nome}" não encontrada`);
        targetId = found.id;
      }
      if (!targetId) throw new Error('Informe id ou nome da meta de caixa');
      if (a.acao === 'excluir') return cashGoals.deleteGoal(ctx, targetId);
      return cashGoals.updateGoal(ctx, targetId, {
        ...(a.nome && !a.id ? {} : a.nome ? { nome: a.nome } : {}),
        ...(a.descricao !== undefined && { descricao: a.descricao }),
        ...(a.valor_meta !== undefined && { valor_meta: a.valor_meta }),
        ...(a.aporte_mensal !== undefined && { aporte_mensal: a.aporte_mensal }),
        ...(a.taxa_mensal_percent !== undefined && { taxa_mensal_percent: a.taxa_mensal_percent }),
        ...(a.prazo_meses !== undefined && { prazo_meses: a.prazo_meses }),
        ...(ba && { bank_account_id: ba.id }),
      });
    },
  },
  {
    name: 'lancar_meta_caixa', perm: 'financeiro:write',
    description: 'Direciona um aporte ou registra um resgate em uma meta de caixa empresarial (ou exclui um lançamento de caixa).',
    schema: {
      acao: z.enum(['aporte', 'resgate', 'excluir_lancamento']),
      meta_caixa: z.string().optional().describe('Nome da meta de caixa'),
      goal_id: z.string().optional(),
      entry_id: z.string().optional().describe('Obrigatório para acao=excluir_lancamento'),
      valor: z.number().positive().optional(),
      data: z.string().optional().describe('AAAA-MM-DD'),
      conta_financeira: z.string().optional(),
      observacoes: z.string().optional(),
    },
    handler: async (ctx, a) => {
      if (a.acao === 'excluir_lancamento') {
        if (!a.entry_id) throw new Error('Informe entry_id');
        return cashGoals.deleteEntry(ctx, a.entry_id);
      }
      let goalId = a.goal_id;
      if (!goalId && a.meta_caixa) {
        const list = await cashGoals.list(ctx);
        const ql = a.meta_caixa.toLowerCase();
        const found = list.items.find((g) => g.nome.toLowerCase() === ql) || list.items.find((g) => g.nome.toLowerCase().includes(ql));
        if (!found) throw new Error(`Meta de caixa "${a.meta_caixa}" não encontrada`);
        goalId = found.id;
      }
      if (!goalId) throw new Error('Informe meta_caixa ou goal_id');
      const ba = a.conta_financeira ? await R.bankAccount(ctx, null, a.conta_financeira) : null;
      return cashGoals.addEntry(ctx, goalId, {
        tipo: a.acao.toUpperCase(),
        valor: a.valor,
        data: a.data,
        bank_account_id: ba?.id,
        observacoes: a.observacoes,
      });
    },
  },
  {
    name: 'dados_empresa', perm: 'config:write',
    description: 'Consulta ou atualiza as configurações gerais da empresa (parâmetros de margem, impostos, comissão, NFS-e, textos de propostas).',
    schema: {
      acao: z.enum(['consultar', 'atualizar']).optional().default('consultar'),
      dados: z.record(z.string(), z.any()).optional(),
    },
    handler: async (ctx, a) => {
      if (a.acao === 'atualizar') return companies.update(ctx, a.dados || {});
      return companies.get(ctx);
    },
  },
  {
    name: 'gerenciar_membros_empresa', perm: 'config:write',
    description: 'Lista, adiciona ou altera o papel/status de usuários com acesso à empresa (ADMIN, COLABORADOR, FINANCEIRO, COMERCIAL, OPERACIONAL, LEITURA).',
    schema: {
      acao: z.enum(['listar', 'adicionar', 'atualizar']),
      email: z.string().optional(),
      member_id: z.string().optional(),
      papel: z.enum(['OWNER', 'ADMIN', 'COLABORADOR', 'FINANCEIRO', 'COMERCIAL', 'OPERACIONAL', 'LEITURA']).optional(),
      ativo: z.boolean().optional(),
    },
    handler: async (ctx, a) => {
      if (a.acao === 'listar') return companies.listMembers(ctx);
      if (a.acao === 'adicionar') return companies.addMember(ctx, { email: a.email, papel: a.papel });
      if (!a.member_id) throw new Error('Informe member_id');
      return companies.updateMember(ctx, a.member_id, { papel: a.papel, ativo: a.ativo });
    },
  },
  {
    name: 'consultar_auditoria', perm: 'config:write',
    description: 'Consulta os registros recentes de auditoria da empresa (ações de usuários, sistema e MCP).',
    schema: {
      origem: z.string().optional().describe('Ex.: MCP, WEB, SISTEMA, ASAAS'),
      limite: z.number().int().min(1).max(200).optional(),
    },
    handler: async (ctx, a) => prisma.bizAuditLog.findMany({
      where: { company_id: ctx.companyId, ...(a.origem ? { origem: a.origem } : {}) },
      orderBy: { created_date: 'desc' },
      take: Math.min(a.limite || 50, 200),
    }),
  },
];

module.exports = { TOOLS };
