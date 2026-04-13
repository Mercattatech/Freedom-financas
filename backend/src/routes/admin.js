const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const prisma = new PrismaClient();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Middleware: apenas admins
const onlyAdmin = (req, res, next) => {
  if (!['admin', 'owner'].includes(req.user?.role)) {
    return res.status(403).json({ message: 'Acesso negado — apenas administradores.' });
  }
  next();
};

// ────────────────────────────────────────────
// GET /api/admin/stats
// Métricas gerais
// ────────────────────────────────────────────
router.get('/stats', authenticateToken, onlyAdmin, async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      trialingUsers,
      pastDueUsers,
      blockedUsers,
      canceledUsers
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'user' } }),
      prisma.user.count({ where: { subscription_status: 'active' } }),
      prisma.user.count({ where: { subscription_status: 'trialing' } }),
      prisma.user.count({ where: { subscription_status: 'past_due' } }),
      prisma.user.count({ where: { subscription_status: 'blocked' } }),
      prisma.user.count({ where: { subscription_status: 'canceled' } })
    ]);

    // MRR estimado: soma de preços dos planos ativos
    const activeWithPlan = await prisma.user.findMany({
      where: { subscription_status: { in: ['active', 'trialing'] } },
      include: { plan: true }
    });
    const mrr = activeWithPlan.reduce((sum, u) => sum + (u.plan?.preco_mensal || u.plan?.preco || 0), 0);

    res.json({
      totalUsers,
      activeUsers,
      trialingUsers,
      pastDueUsers,
      blockedUsers,
      canceledUsers,
      mrr,
      conversionRate: totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(1) : 0
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ────────────────────────────────────────────
// GET /api/admin/subscribers
// Lista todos os assinantes com filtros
// ────────────────────────────────────────────
router.get('/subscribers', authenticateToken, onlyAdmin, async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (status && status !== 'all') where.subscription_status = status;
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { full_name: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: { plan: true },
        orderBy: { created_date: 'desc' },
        skip,
        take: parseInt(limit),
        select: {
          id: true, email: true, full_name: true, role: true,
          disabled: true, is_verified: true,
          subscription_status: true, plan_id: true,
          stripe_customer_id: true, stripe_subscription_id: true,
          trial_ends_at: true, current_period_end: true,
          delinquent_since: true, blocked_at: true, blocked_by: true,
          created_date: true, last_login: true,
          plan: {
            select: { id: true, nome: true, preco: true, preco_mensal: true }
          }
        }
      }),
      prisma.user.count({ where })
    ]);

    res.json({ data: users, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ────────────────────────────────────────────
// POST /api/admin/subscribers/:id/block
// ────────────────────────────────────────────
router.post('/subscribers/:id/block', authenticateToken, onlyAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        disabled: true,
        subscription_status: 'blocked',
        blocked_at: new Date(),
        blocked_by: req.user.email
      }
    });
    console.log(`[ADMIN] ${req.user.email} bloqueou ${user.email}. Motivo: ${reason || 'não informado'}`);
    res.json({ success: true, message: `${user.email} bloqueado.` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ────────────────────────────────────────────
// POST /api/admin/subscribers/:id/unblock
// ────────────────────────────────────────────
router.post('/subscribers/:id/unblock', authenticateToken, onlyAdmin, async (req, res) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        disabled: false,
        subscription_status: 'active',
        blocked_at: null,
        blocked_by: null,
        delinquent_since: null
      }
    });
    console.log(`[ADMIN] ${req.user.email} desbloqueou ${user.email}`);
    res.json({ success: true, message: `${user.email} desbloqueado.` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ────────────────────────────────────────────
// POST /api/admin/subscribers/:id/cancel
// Cancela assinatura de um usuário no Stripe
// ────────────────────────────────────────────
router.post('/subscribers/:id/cancel', authenticateToken, onlyAdmin, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });

    if (user.stripe_subscription_id) {
      await stripe.subscriptions.cancel(user.stripe_subscription_id);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        subscription_status: 'canceled',
        stripe_subscription_id: null,
        plan_id: null
      }
    });

    res.json({ success: true, message: 'Assinatura cancelada.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ────────────────────────────────────────────
// POST /api/admin/subscribers/:id/change-plan
// Muda o plano de um usuário
// ────────────────────────────────────────────
router.post('/subscribers/:id/change-plan', authenticateToken, onlyAdmin, async (req, res) => {
  try {
    const { plan_id } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    const newPlan = await prisma.plan.findUnique({ where: { id: plan_id } });
    if (!user || !newPlan) return res.status(404).json({ message: 'Dados inválidos' });

    // Atualiza no Stripe se tiver assinatura ativa
    if (user.stripe_subscription_id && newPlan.stripe_price_id_mensal) {
      const sub = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
      await stripe.subscriptions.update(user.stripe_subscription_id, {
        items: [{ id: sub.items.data[0].id, price: newPlan.stripe_price_id_mensal }]
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { plan_id: plan_id }
    });

    res.json({ success: true, message: `Plano alterado para ${newPlan.nome}` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ────────────────────────────────────────────
// POST /api/admin/subscribers/:id/invoice
// Gera ou lista faturas / 2ª via de boleto
// ────────────────────────────────────────────
router.get('/subscribers/:id/invoices', authenticateToken, onlyAdmin, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user?.stripe_customer_id) return res.json({ data: [] });

    const invoices = await stripe.invoices.list({ customer: user.stripe_customer_id, limit: 24 });
    const data = invoices.data.map(inv => ({
      id: inv.id,
      status: inv.status,
      amount: inv.amount_due / 100,
      date: new Date(inv.created * 1000),
      paid: inv.paid,
      pdf_url: inv.invoice_pdf,
      hosted_url: inv.hosted_invoice_url
    }));

    res.json({ data });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ────────────────────────────────────────────
// PLANS CRUD
// ────────────────────────────────────────────

// GET /api/admin/plans (público para pricing page) — também funciona sem auth
router.get('/plans', async (req, res) => {
  try {
    const plans = await prisma.plan.findMany({
      where: { ativo: true },
      orderBy: { ordem: 'asc' }
    });
    res.json({ data: plans });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/admin/plans — cria plano + produto no Stripe automaticamente
router.post('/plans', authenticateToken, onlyAdmin, async (req, res) => {
  try {
    const { nome, descricao, preco_mensal, preco_anual, features, destaque, ordem, limite_familias, trial_dias, badge, cor } = req.body;

    // 1. Cria produto no Stripe
    const product = await stripe.products.create({
      name: nome,
      description: descricao || undefined,
      metadata: { created_by: 'freedom_admin' }
    });

    // 2. Cria price mensal
    let priceMensal = null;
    if (preco_mensal > 0) {
      priceMensal = await stripe.prices.create({
        product: product.id,
        currency: 'brl',
        recurring: { interval: 'month', trial_period_days: trial_dias || 7 },
        unit_amount: Math.round(preco_mensal * 100)
      });
    }

    // 3. Cria price anual (opcional)
    let priceAnual = null;
    if (preco_anual && preco_anual > 0) {
      priceAnual = await stripe.prices.create({
        product: product.id,
        currency: 'brl',
        recurring: { interval: 'year' },
        unit_amount: Math.round(preco_anual * 100)
      });
    }

    // 4. Salva no banco
    const plan = await prisma.plan.create({
      data: {
        nome,
        descricao: descricao || null,
        preco: preco_mensal || 0,
        preco_mensal: preco_mensal || 0,
        preco_anual: preco_anual || null,
        features: features ? JSON.stringify(features) : null,
        destaque: destaque || false,
        ordem: ordem || 0,
        limite_familias: limite_familias || 1,
        trial_dias: trial_dias || 7,
        badge: badge || null,
        cor: cor || null,
        stripe_product_id: product.id,
        stripe_price_id: priceMensal?.id || null,
        stripe_price_id_mensal: priceMensal?.id || null,
        stripe_price_id_anual: priceAnual?.id || null
      }
    });

    res.status(201).json({ data: plan });
  } catch (error) {
    console.error('[ADMIN] create plan error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/admin/plans/:id
router.put('/plans/:id', authenticateToken, onlyAdmin, async (req, res) => {
  try {
    const { nome, descricao, preco_mensal, preco_anual, features, destaque, ordem, ativo, limite_familias, trial_dias, badge, cor } = req.body;

    const existing = await prisma.plan.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Plano não encontrado' });

    // Atualiza nome/descrição no produto Stripe (se tiver)
    if (existing.stripe_product_id) {
      await stripe.products.update(existing.stripe_product_id, {
        name: nome || existing.nome,
        description: descricao || undefined
      }).catch(() => {});
    }

    const plan = await prisma.plan.update({
      where: { id: req.params.id },
      data: {
        nome: nome ?? existing.nome,
        descricao: descricao ?? existing.descricao,
        preco: preco_mensal ?? existing.preco,
        preco_mensal: preco_mensal ?? existing.preco_mensal,
        preco_anual: preco_anual ?? existing.preco_anual,
        features: features ? JSON.stringify(features) : existing.features,
        destaque: destaque ?? existing.destaque,
        ordem: ordem ?? existing.ordem,
        ativo: ativo ?? existing.ativo,
        limite_familias: limite_familias ?? existing.limite_familias,
        trial_dias: trial_dias ?? existing.trial_dias,
        badge: badge ?? existing.badge,
        cor: cor ?? existing.cor
      }
    });

    res.json({ data: plan });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/admin/plans/:id — desativa (soft delete)
router.delete('/plans/:id', authenticateToken, onlyAdmin, async (req, res) => {
  try {
    const existing = await prisma.plan.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Plano não encontrado' });

    // Arquiva produto no Stripe
    if (existing.stripe_product_id) {
      await stripe.products.update(existing.stripe_product_id, { active: false }).catch(() => {});
    }

    await prisma.plan.update({ where: { id: req.params.id }, data: { ativo: false } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
