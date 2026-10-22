import { useBizQuery } from '../BizContext';

// Listas auxiliares usadas em formulários
export function useLookups() {
  const clients = useBizQuery('/clients');
  const suppliers = useBizQuery('/suppliers', { ativo: true });
  const contracts = useBizQuery('/contracts');
  const accounts = useBizQuery('/accounts', { ativo: true });
  const costCenters = useBizQuery('/cost-centers', { ativo: true });
  const banks = useBizQuery('/bank-accounts', { ativo: true });
  const products = useBizQuery('/products', { ativo: true });
  const team = useBizQuery('/team');
  return {
    clients: clients.data || [],
    suppliers: suppliers.data || [],
    contracts: contracts.data?.items || [],
    accounts: accounts.data || [],
    costCenters: costCenters.data || [],
    banks: banks.data || [],
    products: products.data || [],
    team: team.data || [],
  };
}

export const GRUPOS_DRE = {
  RECEITA_BRUTA: 'Receita bruta', DEDUCOES: 'Deduções', CUSTOS: 'Custos diretos', DESPESAS_PESSOAL: 'Pessoal',
  DESPESAS_ADMINISTRATIVAS: 'Administrativas', DESPESAS_COMERCIAIS: 'Comerciais', RECEITAS_FINANCEIRAS: 'Receitas financeiras',
  DESPESAS_FINANCEIRAS: 'Despesas financeiras', IMPOSTOS_LUCRO: 'IR/CSLL', NAO_OPERACIONAL: 'Não operacional',
};

export const FORMAS = [['PIX', 'PIX'], ['BOLETO', 'Boleto'], ['CARTAO', 'Cartão'], ['TRANSFERENCIA', 'Transferência'], ['DINHEIRO', 'Dinheiro'], ['DEBITO_AUTOMATICO', 'Débito automático'], ['UNDEFINED', 'Cliente escolhe (Asaas)']];
