// Estrutura padrão criada para toda empresa nova — pensada para agências e
// empresas de serviço, mas editável. O grupo_dre define a linha da DRE.

const CHART = [
  // Receitas
  ['1.1.01', 'Fees recorrentes (gestão mensal)', 'RECEITA', 'RECEITA_BRUTA'],
  ['1.1.02', 'Projetos pontuais', 'RECEITA', 'RECEITA_BRUTA'],
  ['1.1.03', 'Licenças de software / SaaS', 'RECEITA', 'RECEITA_BRUTA'],
  ['1.1.04', 'Produção audiovisual e conteúdo', 'RECEITA', 'RECEITA_BRUTA'],
  ['1.1.05', 'Venda de produtos', 'RECEITA', 'RECEITA_BRUTA'],
  ['1.1.06', 'Comissão de mídia (BV)', 'RECEITA', 'RECEITA_BRUTA'],
  ['1.2.01', 'Rendimentos financeiros', 'RECEITA', 'RECEITAS_FINANCEIRAS'],
  ['1.2.02', 'Juros e multas recebidos', 'RECEITA', 'RECEITAS_FINANCEIRAS'],
  ['1.3.01', 'Reembolso de mídia (repasse do cliente)', 'RECEITA', 'NAO_OPERACIONAL'],
  ['1.3.02', 'Aporte de sócios / empréstimos', 'RECEITA', 'NAO_OPERACIONAL'],
  // Deduções
  ['2.1.01', 'Simples Nacional (DAS)', 'DESPESA', 'DEDUCOES'],
  ['2.1.02', 'ISS', 'DESPESA', 'DEDUCOES'],
  ['2.1.03', 'PIS / COFINS', 'DESPESA', 'DEDUCOES'],
  ['2.1.04', 'Cancelamentos e descontos concedidos', 'DESPESA', 'DEDUCOES'],
  // Custos dos serviços prestados (diretos)
  ['3.1.01', 'Freelancers e terceiros', 'DESPESA', 'CUSTOS', { custo_direto: true }],
  ['3.1.02', 'Produção (foto, vídeo, gráfica)', 'DESPESA', 'CUSTOS', { custo_direto: true }],
  ['3.1.03', 'Ferramentas dedicadas a clientes', 'DESPESA', 'CUSTOS', { custo_direto: true }],
  ['3.1.04', 'Custo dos produtos vendidos', 'DESPESA', 'CUSTOS', { custo_direto: true }],
  ['3.1.05', 'Mídia paga sem repasse', 'DESPESA', 'CUSTOS', { custo_direto: true }],
  // Pessoal
  ['4.1.01', 'Salários e encargos', 'DESPESA', 'DESPESAS_PESSOAL', { fixa: true }],
  ['4.1.02', 'Pró-labore', 'DESPESA', 'DESPESAS_PESSOAL', { fixa: true }],
  ['4.1.03', 'Benefícios', 'DESPESA', 'DESPESAS_PESSOAL', { fixa: true }],
  ['4.1.04', 'Prestadores PJ fixos', 'DESPESA', 'DESPESAS_PESSOAL', { fixa: true }],
  // Administrativas
  ['5.1.01', 'Aluguel e condomínio', 'DESPESA', 'DESPESAS_ADMINISTRATIVAS', { fixa: true }],
  ['5.1.02', 'Softwares e assinaturas', 'DESPESA', 'DESPESAS_ADMINISTRATIVAS', { fixa: true }],
  ['5.1.03', 'Contabilidade e jurídico', 'DESPESA', 'DESPESAS_ADMINISTRATIVAS', { fixa: true }],
  ['5.1.04', 'Energia, internet e telefone', 'DESPESA', 'DESPESAS_ADMINISTRATIVAS', { fixa: true }],
  ['5.1.05', 'Material de escritório e limpeza', 'DESPESA', 'DESPESAS_ADMINISTRATIVAS'],
  ['5.1.06', 'Outras despesas administrativas', 'DESPESA', 'DESPESAS_ADMINISTRATIVAS'],
  // Comerciais
  ['6.1.01', 'Comissões de vendas', 'DESPESA', 'DESPESAS_COMERCIAIS'],
  ['6.1.02', 'Marketing próprio', 'DESPESA', 'DESPESAS_COMERCIAIS'],
  ['6.1.03', 'Eventos e viagens', 'DESPESA', 'DESPESAS_COMERCIAIS'],
  // Financeiras
  ['7.1.01', 'Tarifas bancárias e de cobrança', 'DESPESA', 'DESPESAS_FINANCEIRAS'],
  ['7.1.02', 'Juros e multas pagos', 'DESPESA', 'DESPESAS_FINANCEIRAS'],
  // Impostos sobre o lucro
  ['8.1.01', 'IRPJ e CSLL', 'DESPESA', 'IMPOSTOS_LUCRO'],
  // Não operacional (fora da DRE, dentro do fluxo de caixa)
  ['9.1.01', 'Repasse de mídia a veículos', 'DESPESA', 'NAO_OPERACIONAL'],
  ['9.1.02', 'Distribuição de lucros', 'DESPESA', 'NAO_OPERACIONAL'],
  ['9.1.03', 'Investimentos (equipamentos, CAPEX)', 'DESPESA', 'NAO_OPERACIONAL'],
  ['9.1.04', 'Amortização de empréstimos', 'DESPESA', 'NAO_OPERACIONAL'],
];

const COST_CENTERS = [
  ['OPE', 'Atendimento e planejamento', 'OPERACIONAL'],
  ['CRI', 'Criação e conteúdo', 'OPERACIONAL'],
  ['PERF', 'Tráfego e performance', 'OPERACIONAL'],
  ['TEC', 'Tecnologia e SaaS', 'OPERACIONAL'],
  ['COM', 'Comercial', 'COMERCIAL'],
  ['ADM', 'Administrativo', 'ADMINISTRATIVO'],
];

// Conta sem saldo inicial informado considera todas as movimentações
const DESDE_SEMPRE = new Date('2000-01-01T00:00:00.000Z');

async function seedCompany(tx, companyId) {
  await tx.bizChartAccount.createMany({
    data: CHART.map(([codigo, nome, natureza, grupo_dre, extra = {}]) => ({
      company_id: companyId, codigo, nome, natureza, grupo_dre, sistema: true, ...extra,
    })),
  });
  await tx.bizCostCenter.createMany({
    data: COST_CENTERS.map(([codigo, nome, tipo]) => ({ company_id: companyId, codigo, nome, tipo })),
  });
  const asaas = await tx.bizBankAccount.create({
    data: { company_id: companyId, nome: 'Conta Asaas', tipo: 'ASAAS', banco: 'Asaas', data_saldo_inicial: DESDE_SEMPRE },
  });
  await tx.bizBankAccount.create({ data: { company_id: companyId, nome: 'Caixa interno', tipo: 'CAIXA', data_saldo_inicial: DESDE_SEMPRE } });
  return { asaasBankAccountId: asaas.id };
}

// Conta padrão por situação (usada quando o lançamento não informa conta)
const DEFAULT_ACCOUNTS = {
  RECEITA_RECORRENTE: '1.1.01',
  RECEITA_PONTUAL: '1.1.02',
  RECEITA_PRODUTO: '1.1.05',
  CUSTO_PRODUTO: '3.1.04',
  TARIFA: '7.1.01',
};

module.exports = { seedCompany, CHART, COST_CENTERS, DEFAULT_ACCOUNTS, DESDE_SEMPRE };
