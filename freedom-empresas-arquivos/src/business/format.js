const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brlCompact = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });
const n1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const n2 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

export const money = (v) => brl.format(Number(v) || 0);
export const moneyShort = (v) => (Math.abs(Number(v) || 0) >= 10000 ? brlCompact.format(Number(v) || 0) : brl.format(Number(v) || 0));
export const pct = (v) => (v === null || v === undefined || Number.isNaN(Number(v)) ? '—' : `${n1.format(Number(v))}%`);
export const num = (v) => n2.format(Number(v) || 0);
export const date = (v) => (v ? new Date(String(v).length === 10 ? `${v}T12:00:00Z` : v).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—');
export const ymd = (v) => (v ? String(v).slice(0, 10) : '');
export const todayYmd = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const currentYm = () => todayYmd().slice(0, 7);
export const monthLabel = (ym) => {
  if (!ym) return '';
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' }).replace('.', '');
};
export const monthLong = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  const s = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
export const shiftYm = (ym, n) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};
export const docMask = (v) => {
  const d = String(v || '').replace(/\D/g, '');
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return v || '';
};
