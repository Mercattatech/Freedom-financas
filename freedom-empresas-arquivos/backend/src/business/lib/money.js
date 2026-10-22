// Utilitários numéricos. O banco guarda Decimal; a lógica trabalha com Number
// sempre arredondado a centavos, o que é seguro para valores de até trilhões.

const isDecimal = (v) =>
  v !== null && typeof v === 'object' && typeof v.toNumber === 'function' && typeof v.toFixed === 'function' && 'd' in v && 'e' in v;

const num = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  if (isDecimal(v)) return v.toNumber();
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

const round2 = (v) => Math.round((num(v) + Number.EPSILON) * 100) / 100;
const round4 = (v) => Math.round((num(v) + Number.EPSILON) * 10000) / 10000;
const sum = (arr, fn = (x) => x) => round2(arr.reduce((acc, x) => acc + num(fn(x)), 0));
const pct = (part, total) => (num(total) === 0 ? 0 : Math.round((num(part) / num(total)) * 10000) / 100);

// Divide um valor em N parcelas, jogando a diferença de centavos na última
const splitInstallments = (total, n) => {
  const t = round2(total);
  const base = Math.floor((t / n) * 100) / 100;
  const parts = Array.from({ length: n }, () => base);
  parts[n - 1] = round2(t - base * (n - 1));
  return parts;
};

// Converte recursivamente Decimals do Prisma em Number para respostas JSON
const serialize = (value) => {
  if (value === null || value === undefined) return value;
  if (isDecimal(value)) return value.toNumber();
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = serialize(v);
    return out;
  }
  return value;
};

module.exports = { num, round2, round4, sum, pct, splitInstallments, serialize, isDecimal };
