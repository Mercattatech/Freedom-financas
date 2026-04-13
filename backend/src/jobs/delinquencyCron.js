/**
 * Cron Job — Bloqueio automático por inadimplência
 * Roda a cada hora e bloqueia usuários com pagamento atrasado há 7+ dias
 */
const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const DELINQUENCY_DAYS = 7;

async function checkAndBlockDelinquent() {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - DELINQUENCY_DAYS);

    // Busca usuários inadimplentes há mais de 7 dias, ainda não bloqueados
    const delinquent = await prisma.user.findMany({
      where: {
        subscription_status: 'past_due',
        delinquent_since: { lte: cutoff },
        disabled: false
      }
    });

    if (delinquent.length === 0) return;

    console.log(`[CRON] ⚠️  ${delinquent.length} usuário(s) inadimplentes por +${DELINQUENCY_DAYS} dias. Bloqueando...`);

    for (const user of delinquent) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          disabled: true,
          subscription_status: 'blocked',
          blocked_at: new Date(),
          blocked_by: 'system_cron'
        }
      });
      console.log(`[CRON] 🔒 Bloqueado: ${user.email} (inadimplente desde ${user.delinquent_since?.toISOString()})`);
    }
  } catch (err) {
    console.error('[CRON] Erro ao verificar inadimplentes:', err.message);
  }
}

function startDelinquencyCron() {
  // Roda a cada hora
  cron.schedule('0 * * * *', checkAndBlockDelinquent);
  console.log('[CRON] ✅ Cron de inadimplência iniciado (verifica a cada hora)');

  // Roda também na inicialização
  checkAndBlockDelinquent();
}

module.exports = { startDelinquencyCron };
