// Consulta oficial do IPCA acumulado 12 meses (Banco Central do Brasil — SGS série 13522)
// com cache em memória (6h) e fallback para cálculo composto da série mensal 433.
const { today } = require('./dates');

const BCB_HEADERS = { 'User-Agent': 'FreedomEmpresas/1.0 (+https://www.mercattafreedom.com.br)', Accept: 'application/json' };
let cache = { data: null, expiresAt: 0 };

async function fetchJson(url, timeoutMs = 8000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: BCB_HEADERS, signal: ac.signal });
    if (!res.ok) throw new Error(`BCB HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function getIpca12m({ force = false } = {}) {
  if (!force && cache.data && Date.now() < cache.expiresAt) return cache.data;

  try {
    const rows = await fetchJson('https://api.bcb.gov.br/dados/serie/bcdata.sgs.13522/dados/ultimos/1?formato=json');
    const last = Array.isArray(rows) ? rows[rows.length - 1] : null;
    const valor = last?.valor != null ? Number(String(last.valor).replace(',', '.')) : NaN;
    if (!Number.isFinite(valor)) throw new Error('Resposta inválida da série 13522');
    const data = { indice: 'IPCA', acumulado_12m: Math.round(valor * 100) / 100, referencia: last.data, fonte: 'Banco Central (SGS 13522)' };
    cache = { data, expiresAt: Date.now() + 6 * 60 * 60 * 1000 };
    return data;
  } catch (e1) {
    // Fallback: compõe os últimos 12 meses da série mensal do IPCA (SGS 433)
    const rows = await fetchJson('https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/12?formato=json');
    if (!Array.isArray(rows) || rows.length < 12) throw new Error(`Falha ao consultar IPCA no Banco Central: ${e1.message}`);
    const fator = rows.reduce((acc, r) => acc * (1 + Number(String(r.valor).replace(',', '.')) / 100), 1);
    const acumulado = Math.round((fator - 1) * 10000) / 100;
    const data = { indice: 'IPCA', acumulado_12m: acumulado, referencia: rows[rows.length - 1].data, fonte: 'Banco Central (SGS 433)' };
    cache = { data, expiresAt: Date.now() + 6 * 60 * 60 * 1000 };
    return data;
  }
}

/**
 * Próximo dia 1º de janeiro a partir da data de referência.
 * Ex.: 2026-11-23 → 2027-01-01; 2027-01-01 → 2028-01-01.
 */
function nextJanFirst(ref) {
  const d = ref instanceof Date && !Number.isNaN(ref.getTime()) ? ref : today();
  return new Date(Date.UTC(d.getUTCFullYear() + 1, 0, 1));
}

module.exports = { getIpca12m, nextJanFirst };
