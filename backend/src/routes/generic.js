const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');
const { triggerRecalculo } = require('../services/creditCardBill');

const prisma = new PrismaClient();

// Map Frontend Pluralized Endpoint Names to Prisma Model Names
const ENDPOINT_TO_PRISMA_MODEL = {
  'financialmonths': 'financialMonth',
  'incomes': 'income',
  'expenses': 'expense',
  'budgets': 'budget',
  'debts': 'debt',
  'debtpayments': 'debtPayment',
  'recurringexpenses': 'recurringExpense',
  'investmentboxs': 'investmentBox',
  'investmentdeposits': 'investmentDeposit',
  'stockinvestments': 'stockInvestment',
  'stockalerts': 'stockAlert',
  'useraccesses': 'userAccess',
  'users': 'user',
  'plans': 'plan',
  'landingcmss': 'landingCms',
  'assets': 'asset',
  'creditcards': 'creditCard'
};

function createGenericRouter() {
  const router = express.Router();
  router.use(authenticateToken);

  // Using two separate paths instead of regex to avoid path-to-regexp errors in newer Express versions
  router.all(['/:entity', '/:entity/:id'], async (req, res, next) => {
    const entityParam = req.params.entity.toLowerCase();
    const entityId = req.params.id;

    const prismaModelName = ENDPOINT_TO_PRISMA_MODEL[entityParam];

    if (!prismaModelName) {
      // If we don't have a mapping, just mock it to prevent frontend crashes
      if (req.method === 'GET') return res.json([]);
      if (req.method === 'POST') return res.status(201).json({ id: Date.now().toString(), ...req.body });
      return res.json({ success: true });
    }

    // Try to safely handle Prisma CRUD if the model exists in schema
    try {
      const model = prisma[prismaModelName];
      if (!model) {
        // Fallback for alerts/boxes not in schema
        if (req.method === 'GET') return res.json([]);
        if (req.method === 'POST') return res.status(201).json({ id: Date.now().toString(), ...req.body });
        return res.json({ success: true });
      }

      if (req.method === 'GET' || req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
        const globalEndpoints = ['plans', 'landingcmss', 'users', 'useraccesses'];
        // Entities that are scoped via month_id (their family_id comes from FinancialMonth)
        const monthScopedEntities = ['incomes', 'expenses', 'budgets'];
        
        // === GLOBAL SECURITY POLICY FOR NON-ADMINS ===
        if (req.user.role !== 'admin' && !globalEndpoints.includes(entityParam)) {
          const myFamilies = await prisma.family.findMany({ where: { created_by: req.user.email }, select: { id: true } });
          const myFamilyIds = myFamilies.map(f => f.id);

          // Auto-populate family_id on POST for month-scoped entities
          if (req.method === 'POST' && monthScopedEntities.includes(entityParam) && req.body && req.body.month_id && !req.body.family_id) {
            try {
              const relatedMonth = await prisma.financialMonth.findUnique({ where: { id: req.body.month_id }, select: { family_id: true } });
              if (relatedMonth) {
                req.body.family_id = relatedMonth.family_id;
              }
            } catch (e) {
              console.error('[Generic] Error resolving family_id from month_id:', e.message);
            }
          }

          // Block POST/PUT if trying to mutate someone else's family
          if (['POST', 'PUT'].includes(req.method) && req.body && req.body.family_id) {
             if (!myFamilyIds.includes(req.body.family_id)) {
                return res.status(403).json({ error: "Acesso Negado. Você não é dono desta família." });
             }
          }
          
          if (req.method === 'GET') {
             const parsedQuery = { ...req.query };
             if (parsedQuery.ativo === 'true') parsedQuery.ativo = true;
             if (parsedQuery.ativo === 'false') parsedQuery.ativo = false;
             if (parsedQuery.resolvido === 'true') parsedQuery.resolvido = true;
             if (parsedQuery.resolvido === 'false') parsedQuery.resolvido = false;

             if (entityParam === 'investmentdeposits') {
                const myBoxes = await prisma.investmentBox.findMany({ where: { family_id: { in: myFamilyIds } }, select: { id: true }});
                parsedQuery.box_id = { in: myBoxes.map(b => b.id) };
             } else if (entityParam === 'debtpayments') {
                const myDebts = await prisma.debt.findMany({ where: { family_id: { in: myFamilyIds } }, select: { id: true }});
                parsedQuery.debt_id = { in: myDebts.map(d => d.id) };
             } else if (monthScopedEntities.includes(entityParam) && parsedQuery.month_id) {
                // For month-scoped entities, validate month ownership instead of filtering by family_id
                try {
                  const relatedMonth = await prisma.financialMonth.findUnique({ where: { id: parsedQuery.month_id }, select: { family_id: true } });
                  if (!relatedMonth || !myFamilyIds.includes(relatedMonth.family_id)) {
                    return res.json([]); // Not the user's month
                  }
                  // month_id is valid and belongs to user - do NOT add family_id filter
                  // because older records may have family_id = null
                } catch (e) {
                  console.error('[Generic] Error validating month ownership:', e.message);
                  return res.json([]);
                }
             } else {
                // Scope by family_id
                if (parsedQuery.family_id) {
                   if (!myFamilyIds.includes(parsedQuery.family_id)) {
                      return res.json([]); // Return empty if trying to spy
                   }
                } else {
                   parsedQuery.family_id = { in: myFamilyIds };
                }
             }

             const items = await model.findMany({ where: parsedQuery });
             return res.json(items);
          }
        }
      }

      if (req.method === 'GET') {
        const parsedQuery = { ...req.query };
        if (parsedQuery.ativo === 'true') parsedQuery.ativo = true;
        if (parsedQuery.ativo === 'false') parsedQuery.ativo = false;
        
        // For admin / global endpoints where role wasn't intercepted
        if (req.user.role !== 'admin') {
           if (entityParam === 'users') parsedQuery.email = req.user.email;
           if (entityParam === 'useraccesses') parsedQuery.user_email = req.user.email;
        }

        const items = await model.findMany({ where: parsedQuery });
        return res.json(items);
      }
      
      if (req.method === 'POST') {
        const newItem = await model.create({ data: req.body });
        
        if (entityParam === 'useraccesses') {
          await syncUserAccessWithAuth(req.body);
        }

        // Fatura de cartão: recalcula após criar despesa com credit_card_id
        if (entityParam === 'expenses' && newItem.credit_card_id && !newItem.is_fatura_cartao) {
          triggerRecalculo(newItem, newItem.family_id).catch(console.error);
        }
        
        return res.status(201).json(newItem);
      }
      
      if (req.method === 'PUT' && entityId) {
        if (entityId === 'new') {
          const newItem = await model.create({ data: req.body });
          if (entityParam === 'useraccesses') {
            await syncUserAccessWithAuth(req.body);
          }
          return res.status(201).json(newItem);
        }

        // Safe check for singleton (LandingCMS)
        if (entityParam === 'landingcmss' && entityId === 'singleton') {
          const updatedItem = await model.upsert({
            where: { id: 'singleton' },
            create: { id: 'singleton', ...req.body },
            update: req.body
          });
          return res.json(updatedItem);
        }

        if (prismaModelName === 'user' && req.body.password) {
           const bcrypt = require('bcryptjs');
           req.body.password = await bcrypt.hash(req.body.password, 10);
        }

        const updatedItem = await model.update({ where: { id: entityId }, data: req.body });
        
        if (entityParam === 'useraccesses') {
          await syncUserAccessWithAuth(req.body);
        }

        // Fatura de cartão: recalcula após atualizar despesa com credit_card_id
        if (entityParam === 'expenses' && updatedItem.credit_card_id && !updatedItem.is_fatura_cartao) {
          triggerRecalculo(updatedItem, updatedItem.family_id).catch(console.error);
        }

        return res.json(updatedItem);
      }
      
      if (req.method === 'DELETE' && entityId) {
        // Para despesas com cartão, busca antes de deletar para poder recalcular depois
        let expenseParaRecalculo = null;
        if (entityParam === 'expenses') {
          expenseParaRecalculo = await model.findUnique({ where: { id: entityId } });
        }

        await model.delete({ where: { id: entityId } });

        // Recalcula fatura após deletar despesa de cartão
        if (expenseParaRecalculo?.credit_card_id && !expenseParaRecalculo.is_fatura_cartao) {
          triggerRecalculo(expenseParaRecalculo, expenseParaRecalculo.family_id).catch(console.error);
        }

        return res.json({ success: true });
      }

    } catch (error) {
      console.error(`[Generic API Error] ${entityParam}:`, error);
      return res.status(500).json({ error: error.message });
    }
  });

  return router;
}

// Interceptor para Criar/Suspender usuários na auth quando o Admin mexe no Painel UserAccess
async function syncUserAccessWithAuth(userAccessData) {
  try {
    let userAccount = await prisma.user.findUnique({ where: { email: userAccessData.user_email } });
    const isDisabled = userAccessData.status === 'SUSPENSO' || userAccessData.status === 'CANCELADO';
    
    if (!userAccount) {
      const bcrypt = require('bcryptjs');
      const randomPassword = Math.random().toString(36).slice(-8); // 8 character random
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      
      userAccount = await prisma.user.create({
        data: {
          email: userAccessData.user_email,
          full_name: userAccessData.user_name || 'Novo Usuário',
          password: hashedPassword,
          is_verified: true,
          must_change_password: true,
          disabled: isDisabled
        }
      });
      // MOCK ENVIO DE E-MAIL AQUI
      console.log('\n======================================================');
      console.log(`🟢 NOVO ACESSO CRIADO - EMAIL/ACESSO GERADO 🟢`);
      console.log(`Para testar sem o e-mail real:`);
      console.log(`Email/Login: ${userAccessData.user_email}`);
      console.log(`Senha de 1º Acesso: ${randomPassword}`);
      console.log(`(O usuário será forçado a trocar para uma senha nova ao logar)`);
      console.log('======================================================\n');
    } else {
       if (userAccount.disabled !== isDisabled) {
          await prisma.user.update({ where: { email: userAccessData.user_email }, data: { disabled: isDisabled }});
       }
    }
  } catch(e) {
    console.log('[syncUserAccessWithAuth] error = ', e.message);
  }
}

module.exports = createGenericRouter;
