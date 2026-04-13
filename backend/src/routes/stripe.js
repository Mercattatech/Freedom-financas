const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const prisma = new PrismaClient();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// ────────────────────────────────────────────
// POST /api/stripe/checkout
// Cria sessão de checkout para assinar um plano
// ────────────────────────────────────────────
router.post('/checkout', authenticateToken, async (req, res) => {
  try {
    const { plan_id, interval = 'month' } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, include: { plan: true } });

    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });

    const plan = await prisma.plan.findUnique({ where: { id: plan_id } });
    if (!plan || !plan.ativo) return res.status(404).json({ message: 'Plano não encontrado' });

    const priceId = interval === 'year' ? plan.stripe_price_id_anual : (plan.stripe_price_id_mensal || plan.stripe_price_id);
    if (!priceId) return res.status(400).json({ message: 'Este plano não tem um preço Stripe configurado.' });

    // Cria ou recupera o customer do Stripe
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.full_name || user.email,
        metadata: { user_id: user.id }
      });
      customerId = customer.id;
      await prisma.user.update({ where: { id: user.id }, data: { stripe_customer_id: customerId } });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      subscription_data: {
        trial_period_days: plan.trial_dias || 7,
        metadata: { user_id: user.id, plan_id: plan.id }
      },
      success_url: `${frontendUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/pricing?canceled=true`,
      metadata: { user_id: user.id, plan_id: plan.id }
    });

    res.json({ url: session.url, session_id: session.id });
  } catch (error) {
    console.error('[STRIPE] checkout error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

// ────────────────────────────────────────────
// POST /api/stripe/portal
// Abre o Customer Portal do Stripe (cancelar, ver faturas, atualizar cartão)
// ────────────────────────────────────────────
router.post('/portal', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user?.stripe_customer_id) {
      return res.status(400).json({ message: 'Você ainda não tem uma assinatura ativa.' });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${frontendUrl}/profile`
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('[STRIPE] portal error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

// ────────────────────────────────────────────
// GET /api/stripe/invoices
// Lista faturas do usuário logado
// ────────────────────────────────────────────
router.get('/invoices', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user?.stripe_customer_id) return res.json({ data: [] });

    const invoices = await stripe.invoices.list({
      customer: user.stripe_customer_id,
      limit: 12
    });

    const simplified = invoices.data.map(inv => ({
      id: inv.id,
      status: inv.status,
      amount: inv.amount_due / 100,
      currency: inv.currency,
      date: new Date(inv.created * 1000),
      paid: inv.paid,
      period_start: new Date(inv.period_start * 1000),
      period_end: new Date(inv.period_end * 1000),
      pdf_url: inv.invoice_pdf,
      hosted_url: inv.hosted_invoice_url
    }));

    res.json({ data: simplified });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ────────────────────────────────────────────
// POST /api/stripe/cancel
// Cancela assinatura (agendado para fim do período)
// ────────────────────────────────────────────
router.post('/cancel', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user?.stripe_subscription_id) {
      return res.status(400).json({ message: 'Sem assinatura ativa.' });
    }

    // Cancela no final do período atual
    await stripe.subscriptions.update(user.stripe_subscription_id, {
      cancel_at_period_end: true
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { subscription_status: 'canceling' }
    });

    res.json({ success: true, message: 'Assinatura cancelada. Você terá acesso até o fim do período atual.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ────────────────────────────────────────────
// GET /api/stripe/subscription
// Status da assinatura atual
// ────────────────────────────────────────────
router.get('/subscription', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { plan: true }
    });

    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });

    let stripeSubscription = null;
    if (user.stripe_subscription_id) {
      try {
        stripeSubscription = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
      } catch (_) {}
    }

    res.json({
      subscription_status: user.subscription_status,
      plan: user.plan ? {
        id: user.plan.id,
        nome: user.plan.nome,
        preco: user.plan.preco,
        preco_mensal: user.plan.preco_mensal
      } : null,
      trial_ends_at: user.trial_ends_at,
      current_period_end: user.current_period_end,
      stripe_status: stripeSubscription?.status || null,
      cancel_at_period_end: stripeSubscription?.cancel_at_period_end || false
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ────────────────────────────────────────────
// POST /api/stripe/webhooks
// Recebe eventos do Stripe (DEVE ser sem autenticação e com raw body)
// ────────────────────────────────────────────
router.post('/webhooks', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      event = JSON.parse(req.body.toString());
      console.warn('[STRIPE WEBHOOK] ⚠️ STRIPE_WEBHOOK_SECRET não configurado - modo dev');
    }
  } catch (err) {
    console.error('[STRIPE WEBHOOK] Signature inválida:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`[STRIPE WEBHOOK] Evento: ${event.type}`);

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.user_id;
        const planId = session.metadata?.plan_id;
        if (!userId) break;

        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        const plan = planId ? await prisma.plan.findUnique({ where: { id: planId } }) : null;

        await prisma.user.update({
          where: { id: userId },
          data: {
            stripe_subscription_id: session.subscription,
            subscription_status: subscription.status, // trialing | active
            plan_id: planId || null,
            trial_ends_at: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
            current_period_end: new Date(subscription.current_period_end * 1000),
            delinquent_since: null,
            blocked_at: null,
            disabled: false,
            is_verified: true
          }
        });
        console.log(`[STRIPE] ✅ Assinatura ativada para user ${userId}`);
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const customer = await stripe.customers.retrieve(sub.customer);
        const user = await prisma.user.findFirst({
          where: { stripe_customer_id: sub.customer }
        });
        if (!user) break;

        const newStatus = sub.cancel_at_period_end ? 'canceling' : sub.status;

        await prisma.user.update({
          where: { id: user.id },
          data: {
            subscription_status: newStatus,
            current_period_end: new Date(sub.current_period_end * 1000),
            trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000) : null
          }
        });
        console.log(`[STRIPE] 🔄 Assinatura atualizada: ${user.email} → ${newStatus}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const user = await prisma.user.findFirst({
          where: { stripe_customer_id: sub.customer }
        });
        if (!user) break;

        await prisma.user.update({
          where: { id: user.id },
          data: {
            subscription_status: 'canceled',
            stripe_subscription_id: null,
            plan_id: null
          }
        });
        console.log(`[STRIPE] ❌ Assinatura cancelada: ${user.email}`);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const user = await prisma.user.findFirst({
          where: { stripe_customer_id: invoice.customer }
        });
        if (!user) break;

        await prisma.user.update({
          where: { id: user.id },
          data: {
            subscription_status: 'active',
            delinquent_since: null,
            disabled: false,
            blocked_at: null
          }
        });
        console.log(`[STRIPE] 💰 Pagamento recebido: ${user.email}`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const user = await prisma.user.findFirst({
          where: { stripe_customer_id: invoice.customer }
        });
        if (!user) break;

        const delinquentSince = user.delinquent_since || new Date();
        await prisma.user.update({
          where: { id: user.id },
          data: {
            subscription_status: 'past_due',
            delinquent_since: delinquentSince
          }
        });
        console.log(`[STRIPE] ⚠️ Falha no pagamento: ${user.email}`);
        break;
      }

      default:
        console.log(`[STRIPE WEBHOOK] Evento ignorado: ${event.type}`);
    }
  } catch (err) {
    console.error('[STRIPE WEBHOOK] Erro ao processar evento:', err.message);
  }

  res.json({ received: true });
});

module.exports = router;
