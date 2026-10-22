import React, { useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useTheme } from 'next-themes';
import {
  LayoutDashboard, ArrowDownToLine, ArrowUpFromLine, Users, Truck, Package, FileSignature, Repeat, BarChart3, Clock3,
  Settings, ChevronsUpDown, Menu, X, Moon, Sun, Home, Plus,
} from 'lucide-react';
import { useBiz } from './BizContext';
import { cx } from './components/ui';

const NAV = [
  [null, [['', 'Visão geral', LayoutDashboard, 'relatorios:read']]],
  ['Financeiro', [['receber', 'Contas a receber', ArrowDownToLine], ['pagar', 'Contas a pagar', ArrowUpFromLine]]],
  ['Comercial', [['propostas', 'Propostas', FileSignature], ['contratos', 'Contratos', Repeat], ['clientes', 'Clientes', Users]]],
  ['Operação', [['produtos', 'Produtos e estoque', Package], ['fornecedores', 'Fornecedores', Truck], ['equipe', 'Equipe e horas', Clock3]]],
  ['Análises', [['relatorios', 'DRE e margens', BarChart3, 'relatorios:read']]],
];

function CompanySwitcher() {
  const { companies, company, setCompanyId } = useBiz();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-[var(--side-active)] text-left" aria-expanded={open}>
        <span className="w-9 h-9 rounded-lg grid place-items-center text-white font-extrabold text-sm shrink-0 overflow-hidden" style={{ background: company?.cor_secundaria || '#5161D6' }}>
          {company?.logo_url ? <img src={company.logo_url} alt="" className="w-full h-full object-cover" /> : (company?.nome_fantasia || company?.razao_social || '?')[0]}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-bold text-white truncate">{company?.nome_fantasia || company?.razao_social}</span>
          <span className="block text-xs text-[var(--side-ink)] truncate">{({ OWNER: 'Proprietário', ADMIN: 'Administrador', FINANCEIRO: 'Financeiro', COMERCIAL: 'Comercial', OPERACIONAL: 'Operacional', LEITURA: 'Somente leitura' })[company?.papel]}</span>
        </span>
        <ChevronsUpDown className="w-4 h-4 text-[var(--side-ink)]" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 rounded-lg bg-[var(--surface)] border border-[var(--line)] shadow-xl z-50 py-1">
          {companies.map((c) => (
            <button key={c.id} onClick={() => { setCompanyId(c.id); setOpen(false); }} className={cx('w-full text-left px-3 py-2 text-sm hover:bg-[var(--paper)]', c.id === company?.id && 'font-bold')}>
              {c.nome_fantasia || c.razao_social}
            </button>
          ))}
          <Link to="/empresas/nova" onClick={() => setOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--result)] font-semibold hover:bg-[var(--paper)] border-t border-[var(--line)]"><Plus className="w-4 h-4" />Nova empresa</Link>
        </div>
      )}
    </div>
  );
}

function SideNav({ onNavigate }) {
  const { can } = useBiz();
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-2" aria-label="Módulo Empresas">
      {NAV.map(([group, items]) => {
        const visible = items.filter(([, , , perm]) => !perm || can(perm));
        if (!visible.length) return null;
        return (
          <div key={group || 'top'} className="mb-4">
            {group && <p className="px-2.5 mb-1 text-xs font-semibold text-[#7D879B]">{group}</p>}
            {visible.map(([to, label, Icon]) => (
              <NavLink key={to} to={`/empresas${to ? `/${to}` : ''}`} end={!to} onClick={onNavigate}
                className={({ isActive }) => cx('flex items-center gap-3 rounded-lg px-2.5 py-2 text-[14px] font-medium transition', isActive ? 'bg-[var(--side-active)] text-white' : 'text-[var(--side-ink)] hover:text-white hover:bg-[var(--side-active)]/60')}>
                <Icon className="w-[18px] h-[18px]" strokeWidth={1.8} />{label}
              </NavLink>
            ))}
          </div>
        );
      })}
    </nav>
  );
}

export default function BizLayout({ children }) {
  const [mobile, setMobile] = useState(false);
  const { theme, setTheme } = useTheme();
  const { can } = useBiz();
  const loc = useLocation();
  const sidebar = (
    <div className="flex flex-col h-full bg-[var(--side)]">
      <div className="px-3 pt-4 pb-3 border-b border-white/5"><CompanySwitcher /></div>
      <SideNav onNavigate={() => setMobile(false)} />
      <div className="px-3 py-3 border-t border-white/5 space-y-0.5">
        {can('config:write') && (
          <NavLink to="/empresas/configuracoes" onClick={() => setMobile(false)} className={({ isActive }) => cx('flex items-center gap-3 rounded-lg px-2.5 py-2 text-[14px] font-medium', isActive ? 'bg-[var(--side-active)] text-white' : 'text-[var(--side-ink)] hover:text-white')}>
            <Settings className="w-[18px] h-[18px]" strokeWidth={1.8} />Configurações
          </NavLink>
        )}
        <Link to="/Dashboard" className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-[14px] font-medium text-[var(--side-ink)] hover:text-white"><Home className="w-[18px] h-[18px]" strokeWidth={1.8} />Finanças pessoais</Link>
        <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="w-full flex items-center gap-3 rounded-lg px-2.5 py-2 text-[14px] font-medium text-[var(--side-ink)] hover:text-white">
          {theme === 'dark' ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}{theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
        </button>
      </div>
    </div>
  );
  return (
    <div className="biz min-h-screen lg:pl-[256px]">
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-[256px] z-40 biz-noprint">{sidebar}</aside>
      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between h-14 px-4 bg-[var(--side)] text-white biz-noprint">
        <span className="font-bold">Freedom Empresas</span>
        <button onClick={() => setMobile(true)} aria-label="Abrir menu" className="p-2"><Menu className="w-5 h-5" /></button>
      </div>
      {mobile && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-[280px] h-full">{sidebar}</div>
          <button className="flex-1 bg-black/50" onClick={() => setMobile(false)} aria-label="Fechar menu"><X className="w-6 h-6 text-white ml-auto mr-4" /></button>
        </div>
      )}
      <main key={loc.pathname} className="px-4 sm:px-6 lg:px-10 py-6 lg:py-8 max-w-[1360px]">{children}</main>
      <Toaster richColors position="top-right" />
    </div>
  );
}
