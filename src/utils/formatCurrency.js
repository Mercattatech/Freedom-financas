/**
 * Utilitário centralizado de formatação de moeda.
 * Substitui as funções formatCurrency duplicadas em 6+ páginas.
 */
export const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value || 0);
};

export const fmt = formatCurrency;

export const formatPercent = (value, decimals = 1) => {
  return `${(value || 0).toFixed(decimals)}%`;
};

export const parseNumber = (value) => {
  return parseFloat(value) || 0;
};

export const today = () => new Date().toISOString().split('T')[0];
