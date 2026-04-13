/**
 * creditCardBill.js
 * 
 * Lógica de recálculo automático da fatura do cartão de crédito.
 * 
 * Conceito:
 * - Despesas com credit_card_id ficam APENAS no extrato do cartão
 * - O sistema cria/atualiza automaticamente uma "fatura" no mês 
 *   correspondente ao fechamento do cartão (dia_fechamento).
 * - A fatura é uma expense com is_fatura_cartao=true, que aparece 
 *   normalmente como despesa variável no Dashboard/Transações.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Determina o mês competência (yyyy-MM) de cobrança de uma despesa no cartão.
 * 
 * Regra: se a data da despesa é ANTES do dia_fechamento, a fatura
 * é do próprio mês. Se for no dia_fechamento ou depois, vai para o próximo mês.
 * 
 * Ex: cartão fecha dia 10.
 *   - despesa dia 05/04 → fatura de abril (paga em maio se dia_vencimento=10)
 *   - despesa dia 15/04 → fatura de maio  (paga em junho)
 */
function calcularCompetenciaFatura(dataExpense, diaFechamento) {
  // dataExpense pode ser "2024-04-15"
  const [year, month, day] = dataExpense.split('-').map(Number);
  const diaGasto = day;

  if (diaGasto < diaFechamento) {
    // Despesa dentro do ciclo do mês atual → fatura deste mês
    return `${year}-${String(month).padStart(2, '0')}`;
  } else {
    // Despesa após fechamento → fatura do próximo mês
    const proxMes = month === 12 ? 1 : month + 1;
    const proxAno = month === 12 ? year + 1 : year;
    return `${proxAno}-${String(proxMes).padStart(2, '0')}`;
  }
}

/**
 * Recalcula e atualiza (ou cria) a fatura automática de um cartão
 * para uma determinada competência (yyyy-MM).
 * 
 * @param {string} creditCardId  - UUID do cartão
 * @param {string} competencia   - "yyyy-MM" do período de recálculo
 * @param {string} familyId      - UUID da família (para criar o mês se necessário)
 */
async function recalcularFaturaCartao(creditCardId, competencia, familyId) {
  try {
    // 1. Busca o cartão
    const card = await prisma.creditCard.findUnique({ where: { id: creditCardId } });
    if (!card) return;

    // 2. Busca todas as despesas do cartão nesta competência
    //    (que NÃO são faturas — evita contagem circular)
    const allExpenses = await prisma.expense.findMany({
      where: {
        credit_card_id: creditCardId,
        is_fatura_cartao: false,
      }
    });

    // Filtra as que competem a esta competência
    const diaFechamento = card.dia_fechamento || 1;
    const expensesDoPeriodo = allExpenses.filter(exp => {
      if (!exp.data) return false;
      return calcularCompetenciaFatura(exp.data, diaFechamento) === competencia;
    });

    const totalFatura = expensesDoPeriodo.reduce((sum, e) => sum + (e.valor || 0), 0);

    // 3. Localiza ou cria o FinancialMonth da competência para a família
    const efFamilyId = familyId || card.family_id;
    let financialMonth = await prisma.financialMonth.findFirst({
      where: { competencia, family_id: efFamilyId }
    });
    if (!financialMonth) {
      financialMonth = await prisma.financialMonth.create({
        data: { competencia, family_id: efFamilyId }
      });
    }

    // Data de vencimento da fatura: dia_vencimento do cartão no mês seguinte à competência
    const [compYear, compMonth] = competencia.split('-').map(Number);
    const mesVenc = compMonth === 12 ? 1 : compMonth + 1;
    const anoVenc = compMonth === 12 ? compYear + 1 : compYear;
    const diaVenc = card.dia_vencimento || 10;
    const dataVencimento = `${anoVenc}-${String(mesVenc).padStart(2, '0')}-${String(diaVenc).padStart(2, '0')}`;

    // 4. Verifica se já existe uma fatura automática para este cartão neste mês
    const faturaExistente = await prisma.expense.findFirst({
      where: {
        month_id: financialMonth.id,
        credit_card_id: creditCardId,
        is_fatura_cartao: true,
      }
    });

    if (totalFatura <= 0) {
      // Se não há despesas, remove a fatura se existir
      if (faturaExistente) {
        await prisma.expense.delete({ where: { id: faturaExistente.id } });
        console.log(`[CreditCardBill] Fatura removida para cartão ${card.nome} em ${competencia}`);
      }
      return;
    }

    const descricaoFatura = `Fatura ${card.nome}${card.ultimos_digitos ? ` (•••• ${card.ultimos_digitos})` : ''}`;

    if (faturaExistente) {
      // Atualiza a fatura existente
      await prisma.expense.update({
        where: { id: faturaExistente.id },
        data: {
          valor: totalFatura,
          data: dataVencimento,
          descricao: descricaoFatura,
        }
      });
      console.log(`[CreditCardBill] Fatura atualizada: ${descricaoFatura} = R$${totalFatura.toFixed(2)} (venc. ${dataVencimento})`);
    } else {
      // Cria nova fatura
      await prisma.expense.create({
        data: {
          descricao: descricaoFatura,
          valor: totalFatura,
          data: dataVencimento,
          forma_pagamento: 'CREDITO',
          recorrente: false,
          month_id: financialMonth.id,
          family_id: efFamilyId,
          credit_card_id: creditCardId,
          is_fatura_cartao: true,
        }
      });
      console.log(`[CreditCardBill] Fatura criada: ${descricaoFatura} = R$${totalFatura.toFixed(2)} (venc. ${dataVencimento})`);
    }
  } catch (err) {
    console.error('[CreditCardBill] Erro ao recalcular fatura:', err.message);
  }
}

/**
 * Chamada after um expense com credit_card_id é criado, atualizado ou deletado.
 * Determina quais competências precisam ser recalculadas.
 * 
 * @param {object} expense - O expense (tem credit_card_id e data)
 * @param {string} familyId
 */
async function triggerRecalculo(expense, familyId) {
  if (!expense.credit_card_id || expense.is_fatura_cartao) return;

  const card = await prisma.creditCard.findUnique({ where: { id: expense.credit_card_id } });
  if (!card) return;

  const diaFechamento = card.dia_fechamento || 1;
  const competencia = calcularCompetenciaFatura(expense.data, diaFechamento);
  await recalcularFaturaCartao(expense.credit_card_id, competencia, familyId || card.family_id);
}

module.exports = { recalcularFaturaCartao, triggerRecalculo, calcularCompetenciaFatura };
