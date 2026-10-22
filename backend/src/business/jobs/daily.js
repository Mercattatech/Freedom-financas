// Rotina diária: gera títulos de contratos faturados fora do Asaas e expira propostas
const prisma = require('../db');
const contracts = require('../services/contracts');
const { today } = require('../lib/dates');

async function runDaily() {
  const out = { contratos: 0, titulos: 0, propostas_expiradas: 0, erros: [] };
  const ativos = await prisma.bizContract.findMany({
    where: { status: 'ATIVO', tipo: 'RECORRENTE', asaas_subscription_id: null },
    select: { id: true, company_id: true },
  });
  for (const c of ativos) {
    try {
      const r = await contracts.generateRecurring({ companyId: c.company_id, origem: 'SISTEMA' }, c.id);
      out.contratos++;
      out.titulos += r.criados;
    } catch (e) {
      out.erros.push({ contrato: c.id, erro: e.message });
    }
  }
  const exp = await prisma.bizProposal.updateMany({
    where: { status: { in: ['ENVIADA', 'VISUALIZADA'] }, validade: { lt: today() } },
    data: { status: 'EXPIRADA' },
  });
  out.propostas_expiradas = exp.count;
  return out;
}

module.exports = { runDaily };
