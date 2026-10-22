import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import './biz.css';
import { BizProvider, useBiz } from './BizContext';
import BizLayout from './BizLayout';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Registry, { CLIENTS, SUPPLIERS } from './pages/Registry';
import Products from './pages/Products';
import { ProposalList, ProposalEditor } from './pages/Proposals';
import { ContractList, ContractDetail } from './pages/Contracts';
import Reports from './pages/Reports';
import Team from './pages/Team';
import Settings from './pages/Settings';
import { Loading, ErrorBox } from './components/ui';

function Shell() {
  const { companies, loading, error, can } = useBiz();
  if (loading) return <div className="biz min-h-screen"><Loading label="Carregando empresas…" /></div>;
  if (error) return <div className="biz min-h-screen p-8"><ErrorBox error={error} /></div>;
  if (!companies.length) return <Onboarding first />;
  return (
    <Routes>
      <Route path="nova" element={<Onboarding />} />
      <Route path="*" element={
        <BizLayout>
          <Routes>
            <Route index element={can('relatorios:read') ? <Dashboard /> : <Navigate to="propostas" replace />} />
            <Route path="receber" element={<Transactions tipo="RECEITA" key="r" />} />
            <Route path="pagar" element={<Transactions tipo="DESPESA" key="p" />} />
            <Route path="clientes" element={<Registry config={CLIENTS} key="c" />} />
            <Route path="fornecedores" element={<Registry config={SUPPLIERS} key="f" />} />
            <Route path="produtos" element={<Products />} />
            <Route path="propostas" element={<ProposalList />} />
            <Route path="propostas/:id" element={<ProposalEditor />} />
            <Route path="contratos" element={<ContractList />} />
            <Route path="contratos/:id" element={<ContractDetail />} />
            <Route path="relatorios" element={<Reports />} />
            <Route path="equipe" element={<Team />} />
            <Route path="configuracoes" element={<Settings />} />
            <Route path="*" element={<Navigate to="/empresas" replace />} />
          </Routes>
        </BizLayout>
      } />
    </Routes>
  );
}

export default function BizApp() {
  return <BizProvider><Shell /></BizProvider>;
}
