// Rotina diária: gera títulos de contratos faturados fora do Asaas, aplica reajuste anual IPCA e expira propostas
const prisma = require('../db');
const contracts = require('../services/contracts');
const { today } = require('../lib/dates');
const { getIpca12m, nextJanFirst } = require('../lib/indices');

async function runDaily() {
  const out = { contratos: 0, titulos: 0, reajustados: 0, ipca_usado: null, propostas_expiradas: 0, erros: [] };
  const hoje = today();

  // 1. Reajuste anual automático (IPCA) para contratos ativos cuja data_reajuste chegou
  const aReajustar = await prisma.bizContract.findMany({
    where: {
      status: 'ATIVO',
      tipo: 'RECORRENTE',
      indice_reajuste: 'IPCA',
      data_reajuste: { lte: hoje },
    },
    select: { id: true, company_id: true, numero: true, data_reajuste: true },
  });

  if (aReajustar.length > 0) {
    try {
      const ipca = await getIpca12m();
      out.ipca_usado = ipca;
      if (ipca.acumulado_12m > 0) {
        for (const c of aReajustar) {
          try {
            await contracts.readjust(
              { companyId: c.company_id, origem: 'SISTEMA' },
              c.id,
              {
                percentual: ipca.acumulado_12m,
                a_partir: c.data_reajuste || hoje,
                proxima_data_reajuste: nextJanFirst(c.data_reajuste || hoje),
                motivo: `IPCA automático 12m (${ipca.referencia})`,
              },
            );
            out.reajustados++;
          } catch (e) {
            out.erros.push({ contrato: c.id, acao: 'reajuste_ipca', erro: e.message });
          }
        }
      }
    } catch (e) {
      out.erros.push({ acao: 'consulta_ipca', erro: e.message });
    }
  }

  // 2. Geração de títulos recorrentes fora do Asaas
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

  // 3. Expiração de propostas
  const exp = await prisma.bizProposal.updateMany({
    where: { status: { in: ['ENVIADA', 'VISUALIZADA'] }, validade: { lt: hoje } },
    data: { status: 'EXPIRADA' },
  });
  out.propostas_expiradas = exp.count;
  return out;
}

module.exports = { runDaily };
