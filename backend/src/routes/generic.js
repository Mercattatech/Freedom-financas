const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

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
  'landingcmss': 'landingCms'
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

      if (req.method === 'GET') {
        const parsedQuery = { ...req.query };
        if (parsedQuery.ativo === 'true') parsedQuery.ativo = true;
        if (parsedQuery.ativo === 'false') parsedQuery.ativo = false;
        
        const items = await model.findMany({ where: parsedQuery });
        return res.json(items);
      }
      
      if (req.method === 'POST') {
        const newItem = await model.create({ data: req.body });
        
        if (entityParam === 'useraccesses') {
          await syncUserAccessWithAuth(req.body);
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

        const updatedItem = await model.update({ where: { id: entityId }, data: req.body });
        
        if (entityParam === 'useraccesses') {
          await syncUserAccessWithAuth(req.body);
        }

        return res.json(updatedItem);
      }
      
      if (req.method === 'DELETE' && entityId) {
        await model.delete({ where: { id: entityId } });
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
