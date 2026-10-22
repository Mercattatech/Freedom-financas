import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast, Toaster } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { biz } from '../api';
import { useBiz } from '../BizContext';
import { Button, Field, Input, Select } from '../components/ui';

export default function Onboarding({ first }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { setCompanyId } = useBiz();
  const [f, setF] = useState({ razao_social: '', nome_fantasia: '', cnpj: '', regime_tributario: 'SIMPLES', aliquota_imposto: 6, cor_secundaria: '#5161D6' });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const c = await biz('/companies', { method: 'POST', body: { ...f, aliquota_imposto: Number(f.aliquota_imposto) } });
      setCompanyId(c.id);
      await qc.invalidateQueries({ queryKey: ['biz', 'companies'] });
      toast.success('Empresa criada');
      nav('/empresas');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="biz min-h-screen grid lg:grid-cols-[1fr_520px]">
      <div className="hidden lg:flex flex-col justify-between bg-[var(--side)] text-white p-12">
        <p className="font-bold text-lg">Freedom Empresas</p>
        <div className="max-w-lg">
          <h1 className="text-[40px] leading-[1.1] font-extrabold">Saiba quanto cada contrato deixa no caixa.</h1>
          <p className="text-[#AEB6C7] text-lg mt-4">Contas a pagar e receber, cobranças no Asaas, propostas com a sua marca, estoque, DRE e margem por contrato. E tudo pode ser comandado por IA.</p>
        </div>
        <p className="text-sm text-[#7D879B]">Criamos o plano de contas, os centros de custo e as contas financeiras para você começar.</p>
      </div>
      <form onSubmit={submit} className="p-6 sm:p-12 flex flex-col justify-center gap-4 bg-[var(--surface)]">
        <div>
          <h2 className="text-2xl font-extrabold">{first ? 'Cadastre sua empresa' : 'Nova empresa'}</h2>
          <p className="text-[var(--muted)] mt-1">Você poderá ajustar tudo depois em Configurações.</p>
        </div>
        <Field label="Razão social"><Input required value={f.razao_social} onChange={set('razao_social')} placeholder="Grupo Mercatta Ltda" /></Field>
        <Field label="Nome fantasia"><Input value={f.nome_fantasia} onChange={set('nome_fantasia')} placeholder="Grupo Mercatta" /></Field>
        <Field label="CNPJ"><Input value={f.cnpj} onChange={set('cnpj')} placeholder="00.000.000/0001-00" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Regime tributário">
            <Select value={f.regime_tributario} onChange={set('regime_tributario')}>
              <option value="MEI">MEI</option><option value="SIMPLES">Simples Nacional</option><option value="PRESUMIDO">Lucro presumido</option><option value="REAL">Lucro real</option>
            </Select>
          </Field>
          <Field label="Imposto sobre faturamento (%)" hint="Usado na margem dos contratos"><Input type="number" step="0.01" value={f.aliquota_imposto} onChange={set('aliquota_imposto')} /></Field>
        </div>
        <Field label="Cor da marca" hint="Aparece nas propostas enviadas aos clientes">
          <div className="flex gap-2"><input type="color" value={f.cor_secundaria} onChange={set('cor_secundaria')} className="h-10 w-14 rounded-lg border border-[var(--line)]" /><Input value={f.cor_secundaria} onChange={set('cor_secundaria')} /></div>
        </Field>
        <Button type="submit" size="lg" loading={saving} className="mt-2">Criar empresa</Button>
        {!first && <Button type="button" variant="ghost" onClick={() => nav(-1)}>Cancelar</Button>}
      </form>
      <Toaster richColors position="top-right" />
    </div>
  );
}
