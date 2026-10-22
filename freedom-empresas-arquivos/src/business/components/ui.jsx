import React, { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Loader2, ChevronLeft, ChevronRight, CheckCircle2, Clock, AlertTriangle, MinusCircle, CircleDot } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { money, pct, monthLong, shiftYm } from '../format';

// twMerge resolve conflitos (ex.: w-full do input × w-[150px] da página)
const cx = (...a) => twMerge(a.filter(Boolean).join(' '));

export function Button({ variant = 'primary', size = 'md', loading, icon: Icon, children, className, ...p }) {
  const v = {
    primary: 'bg-[var(--result)] text-white hover:brightness-110',
    secondary: 'bg-[var(--surface)] text-[var(--ink)] border border-[var(--line)] hover:bg-[var(--paper)]',
    ghost: 'text-[var(--ink-2)] hover:bg-[var(--line-2)]',
    danger: 'bg-[var(--surface)] text-[var(--bad)] border border-[var(--line)] hover:bg-[var(--bad-soft)]',
    success: 'bg-[var(--in)] text-white hover:brightness-110',
  }[variant];
  const s = { sm: 'h-8 px-3 text-[13px] gap-1.5', md: 'h-10 px-4 text-sm gap-2', lg: 'h-11 px-5 text-[15px] gap-2' }[size];
  return (
    <button {...p} disabled={p.disabled || loading} className={cx('inline-flex items-center justify-center rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed', v, s, className)}>
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : Icon ? <Icon className="w-4 h-4" /> : null}
      {children}
    </button>
  );
}

export function Field({ label, hint, children, className }) {
  return (
    <label className={cx('block', className)}>
      {label && <span className="block text-[13px] font-semibold text-[var(--ink-2)] mb-1.5">{label}</span>}
      {children}
      {hint && <span className="block text-xs text-[var(--muted)] mt-1">{hint}</span>}
    </label>
  );
}

const inputCls = 'w-full h-10 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--result)] focus:ring-2 focus:ring-[var(--result-soft)]';
export const Input = React.forwardRef(({ className, ...p }, ref) => <input ref={ref} {...p} className={cx(inputCls, className)} />);
Input.displayName = 'Input';
export const Textarea = ({ className, ...p }) => <textarea {...p} className={cx(inputCls, 'h-auto py-2 min-h-[90px]', className)} />;
export const Select = ({ className, children, ...p }) => <select {...p} className={cx(inputCls, 'pr-8', className)}>{children}</select>;

export function MoneyInput({ value, onChange, ...p }) {
  return <Input type="number" step="0.01" inputMode="decimal" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} {...p} className={cx('num', p.className)} />;
}

export function Modal({ open, onClose, title, description, children, footer, width = 560 }) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose?.()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-[#0b1020]/50 z-[100] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="biz fixed z-[101] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-24px)] max-h-[90vh] flex flex-col rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-2xl" style={{ maxWidth: width }}>
          <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
            <div>
              <Dialog.Title className="text-lg font-bold">{title}</Dialog.Title>
              {description && <Dialog.Description className="text-sm text-[var(--muted)] mt-0.5">{description}</Dialog.Description>}
            </div>
            <Dialog.Close className="p-1.5 rounded-lg text-[var(--muted)] hover:bg-[var(--line-2)]" aria-label="Fechar"><X className="w-5 h-5" /></Dialog.Close>
          </div>
          <div className="px-6 pb-4 overflow-y-auto">{children}</div>
          {footer && <div className="px-6 py-4 border-t border-[var(--line)] flex justify-end gap-2 bg-[var(--paper)] rounded-b-2xl">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function PageHeader({ title, subtitle, actions, children }) {
  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
      <div className="min-w-0">
        <h1 className="text-[26px] leading-tight font-extrabold">{title}</h1>
        {subtitle && <p className="text-[15px] text-[var(--muted)] mt-1 max-w-[70ch]">{subtitle}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 biz-noprint">{actions}</div>}
    </div>
  );
}

export function Panel({ title, action, children, className, pad = true }) {
  return (
    <section className={cx('rounded-xl border border-[var(--line)] bg-[var(--surface)]', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
          {title && <h2 className="text-[15px] font-bold">{title}</h2>}
          {action}
        </header>
      )}
      <div className={pad ? 'px-5 pb-5 pt-1' : ''}>{children}</div>
    </section>
  );
}

export function Money({ value, sign, className, colored }) {
  const v = Number(value) || 0;
  const color = colored ? (v > 0 ? 'text-[var(--in)]' : v < 0 ? 'text-[var(--out)]' : '') : '';
  return <span className={cx('num', color, className)}>{sign && v > 0 ? '+' : ''}{money(v)}</span>;
}

const STATUS = {
  PAGO: ['Pago', 'in', CheckCircle2], A_VENCER: ['A vencer', 'neutral', Clock], VENCIDO: ['Vencido', 'bad', AlertTriangle],
  VENCIDO_PARCIAL: ['Vencido (parcial)', 'bad', AlertTriangle], PARCIAL: ['Parcial', 'warn', CircleDot], CANCELADO: ['Cancelado', 'muted', MinusCircle],
  ATIVO: ['Ativo', 'in', CheckCircle2], RASCUNHO: ['Rascunho', 'neutral', CircleDot], PAUSADO: ['Pausado', 'warn', Clock], ENCERRADO: ['Encerrado', 'muted', MinusCircle],
  ENVIADA: ['Enviada', 'result', Clock], VISUALIZADA: ['Visualizada', 'warn', CircleDot], ACEITA: ['Aceita', 'in', CheckCircle2], RECUSADA: ['Recusada', 'bad', MinusCircle], EXPIRADA: ['Expirada', 'muted', MinusCircle],
  LEAD: ['Lead', 'result', CircleDot], INATIVO: ['Inativo', 'muted', MinusCircle], CHURN: ['Churn', 'bad', MinusCircle],
};
const TONE = {
  in: 'bg-[var(--in-soft)] text-[var(--in)]', bad: 'bg-[var(--bad-soft)] text-[var(--bad)]', warn: 'bg-[var(--warn-soft)] text-[var(--warn)]',
  result: 'bg-[var(--result-soft)] text-[var(--result)]', neutral: 'bg-[var(--line-2)] text-[var(--ink-2)]', muted: 'bg-[var(--line-2)] text-[var(--muted)]',
};
export function StatusPill({ status, label }) {
  const [l, tone, Icon] = STATUS[status] || [label || status, 'neutral', CircleDot];
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap', TONE[tone])}><Icon className="w-3.5 h-3.5" />{label || l}</span>;
}

export function Empty({ icon: Icon, title, text, action }) {
  return (
    <div className="text-center py-14 px-6">
      {Icon && <Icon className="w-10 h-10 mx-auto text-[var(--muted)] mb-3" strokeWidth={1.5} />}
      <p className="font-bold text-[16px]">{title}</p>
      {text && <p className="text-sm text-[var(--muted)] mt-1 max-w-md mx-auto">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Loading({ label = 'Carregando…' }) {
  return <div className="flex items-center justify-center gap-2 py-16 text-[var(--muted)] text-sm"><Loader2 className="w-4 h-4 animate-spin" />{label}</div>;
}

export function ErrorBox({ error }) {
  if (!error) return null;
  return <div className="rounded-lg bg-[var(--bad-soft)] text-[var(--bad)] px-4 py-3 text-sm font-medium">{error.message}</div>;
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="flex gap-1 border-b border-[var(--line)] mb-5 overflow-x-auto biz-noprint" role="tablist">
      {tabs.map(([k, label]) => (
        <button key={k} role="tab" aria-selected={value === k} onClick={() => onChange(k)}
          className={cx('px-3.5 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition', value === k ? 'border-[var(--result)] text-[var(--ink)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]')}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function MonthPicker({ value, onChange }) {
  return (
    <div className="inline-flex items-center rounded-lg border border-[var(--line)] bg-[var(--surface)] h-10">
      <button className="px-2 h-full text-[var(--muted)] hover:text-[var(--ink)]" onClick={() => onChange(shiftYm(value, -1))} aria-label="Mês anterior"><ChevronLeft className="w-4 h-4" /></button>
      <span className="px-2 text-sm font-semibold min-w-[140px] text-center">{monthLong(value)}</span>
      <button className="px-2 h-full text-[var(--muted)] hover:text-[var(--ink)]" onClick={() => onChange(shiftYm(value, 1))} aria-label="Próximo mês"><ChevronRight className="w-4 h-4" /></button>
    </div>
  );
}

export function RangePicker({ from, to, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <Input type="month" value={from} onChange={(e) => onChange({ from: e.target.value, to: to < e.target.value ? e.target.value : to })} className="w-[150px]" aria-label="De" />
      <span className="text-sm text-[var(--muted)]">até</span>
      <Input type="month" value={to} onChange={(e) => onChange({ from, to: e.target.value })} className="w-[150px]" aria-label="Até" />
    </div>
  );
}

// Régua de margem: barra da margem % com marca da meta
export function MarginRuler({ value, meta, width = 140 }) {
  const v = Number(value);
  const clamped = Math.max(-20, Math.min(100, Number.isFinite(v) ? v : 0));
  const below = Number.isFinite(v) && v < meta;
  const pos = (x) => `${((x + 20) / 120) * 100}%`;
  return (
    <div className="flex items-center gap-2 justify-end">
      <span className={cx('num text-sm font-bold w-[52px] text-right', below ? 'text-[var(--bad)]' : 'text-[var(--ink)]')}>{pct(v)}</span>
      <div className="relative h-2 rounded-full bg-[var(--line-2)]" style={{ width }} title={`Meta ${meta}%`}>
        <div className="absolute top-0 bottom-0 rounded-full" style={{ left: pos(Math.min(0, clamped)), width: `${(Math.abs(clamped) / 120) * 100}%`, background: below ? 'var(--out)' : 'var(--in)' }} />
        <div className="absolute -top-1 -bottom-1 w-[2px] bg-[var(--ink)]" style={{ left: pos(meta) }} />
      </div>
    </div>
  );
}

export function Kpi({ label, value, detail, tone }) {
  const t = tone === 'bad' ? 'text-[var(--bad)]' : tone === 'in' ? 'text-[var(--in)]' : tone === 'out' ? 'text-[var(--out)]' : '';
  return (
    <div className="py-1">
      <p className="text-[13px] font-semibold text-[var(--muted)]">{label}</p>
      <p className={cx('num text-[22px] font-extrabold mt-0.5 leading-tight', t)}>{value}</p>
      {detail && <p className="text-xs text-[var(--muted)] mt-0.5">{detail}</p>}
    </div>
  );
}

export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export function SearchInput({ value, onChange, placeholder = 'Buscar…', className }) {
  return <Input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cx('w-full sm:w-64', className)} />;
}

export function ConfirmButton({ onConfirm, children, message = 'Tem certeza?', ...p }) {
  return <Button {...p} onClick={() => { if (window.confirm(message)) onConfirm(); }}>{children}</Button>;
}

export { cx };
