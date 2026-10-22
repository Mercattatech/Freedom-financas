// Datas de negócio tratadas em UTC à meia-noite (evita deslocamento de fuso em vencimentos).

const toDate = (v) => {
  if (!v) return null;
  if (v instanceof Date) return v;
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00.000Z`);
  if (/^\d{4}-\d{2}$/.test(s)) return new Date(`${s}-01T00:00:00.000Z`);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

const startOfMonth = (d) => {
  const x = toDate(d);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), 1));
};
const endOfMonth = (d) => {
  const x = toDate(d);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0, 23, 59, 59, 999));
};
const addMonths = (d, n) => {
  const x = toDate(d);
  const day = x.getUTCDate();
  const target = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + n, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, last));
  return target;
};
const addDays = (d, n) => new Date(toDate(d).getTime() + n * 86400000);
const today = () => {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
};
const ymd = (d) => (d ? toDate(d).toISOString().slice(0, 10) : null);
const ym = (d) => toDate(d).toISOString().slice(0, 7);

// Data com dia fixo no mês (respeita meses curtos)
const withDay = (monthDate, day) => {
  const m = startOfMonth(monthDate);
  const last = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth(), Math.min(Math.max(1, day), last)));
};

const monthsBetween = (from, to) => {
  const a = startOfMonth(from);
  const b = startOfMonth(to);
  const list = [];
  for (let d = a; d <= b; d = addMonths(d, 1)) list.push(d);
  return list;
};

const CYCLE_MONTHS = { MENSAL: 1, BIMESTRAL: 2, TRIMESTRAL: 3, SEMESTRAL: 6, ANUAL: 12 };
const cycleMonths = (p) => CYCLE_MONTHS[p] || 1;

// Período padrão: mês corrente. Aceita from/to em YYYY-MM ou YYYY-MM-DD.
const parsePeriod = (q = {}) => {
  const from = q.from ? startOfMonth(q.from) : startOfMonth(today());
  const to = q.to ? endOfMonth(q.to) : endOfMonth(from);
  return { from, to };
};

module.exports = {
  toDate, startOfMonth, endOfMonth, addMonths, addDays, today, ymd, ym, withDay,
  monthsBetween, cycleMonths, parsePeriod, CYCLE_MONTHS,
};
