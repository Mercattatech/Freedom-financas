import React, { useState } from 'react';
import { Plus, Clock3, Users, X } from 'lucide-react';
import { biz } from '../api';
import { useBiz, useBizQuery, useBizMutation } from '../BizContext';
import { PageHeader, Button, Money, Empty, Loading, StatusPill, Input, Select, Tabs } from '../components/ui';
import { RegistryForm } from './Registry';
import { HoursModal } from './Contracts';
import { useLookups } from '../components/lookups';
import { money, num, date, currentYm } from '../format';

const TEAM = {
  entity: 'team', perm: 'cadastros:write', singular: 'Colaborador', newLabel: 'Novo colaborador',
  fields: [
    { k: 'nome', label: 'Nome', required: true }, { k: 'cargo', label: 'Cargo' }, { k: 'email', label: 'E-mail', type: 'email' },
    { k: 'vinculo', label: 'Vínculo', type: 'select', options: [['CLT', 'CLT'], ['PJ', 'PJ'], ['FREELANCER', 'Freelancer'], ['SOCIO', 'Sócio']], def: 'CLT' },
    { k: 'custo_mensal', label: 'Custo mensal total', type: 'money', hint: 'Salário + encargos + benefícios' }, { k: 'horas_mes', label: 'Horas por mês', type: 'number', def: 160 },
    { k: 'custo_hora_override', label: 'Custo/hora fixo (opcional)', type: 'money', hint: 'Para freelancers que cobram por hora' },
    { k: 'produtivo', label: 'Atua em contratos', type: 'bool', checkLabel: 'Sim, é equipe produtiva', def: true }, { k: 'ativo', label: 'Situação', type: 'bool', checkLabel: 'Ativo', def: true },
  ],
};

export default function Team() {
  const { can } = useBiz();
  const L = useLookups();
  const [tab, setTab] = useState('horas');
  const [editing, setEditing] = useState(null);
  const [hours, setHours] = useState(false);
  const [mes, setMes] = useState(currentYm());
  const [member, setMember] = useState('');
  const [y, m] = mes.split('-').map(Number);
  const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const team = useBizQuery('/team');
  const entries = useBizQuery('/time-entries', { from: `${mes}-01`, to, team_member_id: member }, { enabled: tab === 'horas' });
  const del = useBizMutation((id) => biz(`/time-entries/${id}`, { method: 'DELETE' }), { success: 'Apontamento removido' });
  const list = entries.data || [];
  const totalH = list.reduce((a, e) => a + Number(e.horas), 0);
  const totalC = list.reduce((a, e) => a + e.custo_total, 0);
  const emContratos = list.filter((e) => e.contract_id).reduce((a, e) => a + Number(e.horas), 0);

  return (
    <>
      <PageHeader title="Equipe e horas" subtitle="O custo/hora de cada pessoa transforma o tempo apontado em custo real do contrato."
        actions={<>{can('operacional:write') && <Button icon={Clock3} onClick={() => setHours(true)}>Apontar horas</Button>}{can('cadastros:write') && <Button variant="secondary" icon={Plus} onClick={() => setEditing({})}>Novo colaborador</Button>}</>} />
      <Tabs value={tab} onChange={setTab} tabs={[['horas', 'Apontamentos'], ['equipe', 'Equipe e custo/hora']]} />
      {tab === 'equipe' ? (
        <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] overflow-x-auto">
          {team.isLoading ? <Loading /> : !(team.data || []).length ? <Empty icon={Users} title="Cadastre a equipe" text="Com o custo mensal de cada pessoa, o sistema calcula o custo/hora e a margem real de cada contrato." action={<Button icon={Plus} onClick={() => setEditing({})}>Novo colaborador</Button>} /> : (
            <table className="tbl">
              <thead><tr><th>Nome</th><th>Vínculo</th><th>Tipo</th><th className="r">Custo mensal</th><th className="r">Horas/mês</th><th className="r">Custo/hora</th><th>Status</th></tr></thead>
              <tbody>{team.data.map((t) => (
                <tr key={t.id} className="cursor-pointer" onClick={() => can('cadastros:write') && setEditing(t)}>
                  <td><b>{t.nome}</b><div className="text-xs text-[var(--muted)]">{t.cargo}</div></td><td>{t.vinculo}</td><td>{t.produtivo ? 'Produtivo' : 'Estrutura'}</td>
                  <td className="r"><Money value={t.custo_mensal} /></td><td className="r num">{num(t.horas_mes)}</td><td className="r font-semibold"><Money value={t.custo_hora} /></td><td><StatusPill status={t.ativo ? 'ATIVO' : 'INATIVO'} /></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </section>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-4 items-center">
            <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="w-[160px]" />
            <Select value={member} onChange={(e) => setMember(e.target.value)} className="w-[220px]"><option value="">Toda a equipe</option>{L.team.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}</Select>
            <span className="text-sm ml-auto">{num(totalH)}h apontadas, {num(emContratos)}h em contratos, custo <b className="num">{money(totalC)}</b></span>
          </div>
          <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] overflow-x-auto">
            {entries.isLoading ? <Loading /> : !list.length ? <Empty icon={Clock3} title="Nenhuma hora apontada no mês" text="Aponte horas por contrato para descobrir quais clientes consomem mais do que pagam." /> : (
              <table className="tbl">
                <thead><tr><th>Data</th><th>Colaborador</th><th>Contrato</th><th>Atividade</th><th className="r">Horas</th><th className="r">Custo</th><th /></tr></thead>
                <tbody>{list.map((e) => (
                  <tr key={e.id}><td className="num">{date(e.data)}</td><td>{e.teamMember?.nome}</td><td>{e.contract ? `#${e.contract.numero} ${e.contract.titulo}` : <span className="text-[var(--muted)]">Interno</span>}</td><td className="text-[var(--ink-2)]">{e.descricao}</td>
                    <td className="r num">{num(e.horas)}h</td><td className="r"><Money value={e.custo_total} /></td>
                    <td>{can('operacional:write') && <button className="p-1 text-[var(--muted)] hover:text-[var(--bad)]" aria-label="Remover" onClick={() => del.mutate(e.id)}><X className="w-4 h-4" /></button>}</td></tr>
                ))}</tbody>
              </table>
            )}
          </section>
        </>
      )}
      {editing && <RegistryForm config={TEAM} initial={editing} onClose={() => setEditing(null)} />}
      {hours && <HoursModal onClose={() => setHours(false)} />}
    </>
  );
}
