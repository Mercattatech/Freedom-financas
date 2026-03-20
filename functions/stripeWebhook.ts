import { createClientFromRequest } from 'npm:@0.8.20';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

Deno.serve(async (req) => {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  // Inicializa SDK como service role (webhook não tem user auth)
  const base44 = createClientFromRequest(req);

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  console.log('Stripe event recebido:', event.type);

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      await handleCheckoutCompleted(base44, stripe, session);
    }

    if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object;
      await handleSubscriptionUpdated(base44, sub);
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      await handleSubscriptionDeleted(base44, sub);
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object;
      await handlePaymentFailed(base44, invoice);
    }
  } catch (err) {
    console.error('Erro ao processar evento:', event.type, err.message);
    // Retorna 200 para evitar reenvio infinito do Stripe
  }

  return Response.json({ received: true });
});

async function handleCheckoutCompleted(base44, stripe, session) {
  console.log('Checkout completed:', session.id, 'customer:', session.customer_email);

  const plan_id = session.metadata?.plan_id;
  const customerEmail = session.customer_email || session.customer_details?.email;

  if (!customerEmail) {
    console.error('Email do cliente não encontrado na sessão');
    return;
  }

  // Busca o plano
  let plan = null;
  if (plan_id) {
    const plans = await apiClient.asServiceRole.entities.Plan.filter({ id: plan_id });
    plan = plans[0];
  }

  // Se for assinatura, busca detalhes
  let subscriptionId = session.subscription || null;
  let periodEnd = null;
  if (subscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      periodEnd = new Date(sub.current_period_end * 1000).toISOString().split('T')[0];
    } catch (e) {
      console.error('Erro ao buscar subscription:', e.message);
    }
  }

  // Verifica se já existe acesso para este email
  const existing = await apiClient.asServiceRole.entities.UserAccess.filter({ user_email: customerEmail });

  const accessData = {
    user_email: customerEmail,
    user_name: session.customer_details?.name || '',
    plan_id: plan?.id || '',
    plan_nome: plan?.nome || session.metadata?.plan_name || '',
    status: 'ATIVO',
    data_inicio: new Date().toISOString().split('T')[0],
    data_expiracao: periodEnd || null,
    stripe_subscription_id: subscriptionId || '',
    stripe_customer_id: session.customer || '',
    limite_familias: plan?.limite_familias || 1,
    origem: 'STRIPE',
    observacoes: `Pagamento via Stripe. Session: ${session.id}. Valor: R$ ${((session.amount_total || 0) / 100).toFixed(2)}`,
  };

  if (existing.length > 0) {
    await apiClient.asServiceRole.entities.UserAccess.update(existing[0].id, accessData);
    console.log('Acesso atualizado para:', customerEmail);
  } else {
    await apiClient.asServiceRole.entities.UserAccess.create(accessData);
    console.log('Acesso criado para:', customerEmail);
  }
}

async function handleSubscriptionUpdated(base44, sub) {
  const customerId = sub.customer;
  console.log('Subscription updated, customer:', customerId, 'status:', sub.status);

  const accesses = await apiClient.asServiceRole.entities.UserAccess.filter({ stripe_customer_id: customerId });
  if (accesses.length === 0) return;

  const statusMap = {
    active: 'ATIVO',
    past_due: 'SUSPENSO',
    canceled: 'CANCELADO',
    unpaid: 'SUSPENSO',
    paused: 'SUSPENSO',
  };

  const newStatus = statusMap[sub.status] || 'SUSPENSO';
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString().split('T')[0] : null;

  await apiClient.asServiceRole.entities.UserAccess.update(accesses[0].id, {
    status: newStatus,
    data_expiracao: periodEnd,
  });
  console.log('Status atualizado para:', newStatus, 'email:', accesses[0].user_email);
}

async function handleSubscriptionDeleted(base44, sub) {
  const customerId = sub.customer;
  console.log('Subscription deleted, customer:', customerId);

  const accesses = await apiClient.asServiceRole.entities.UserAccess.filter({ stripe_customer_id: customerId });
  if (accesses.length === 0) return;

  await apiClient.asServiceRole.entities.UserAccess.update(accesses[0].id, {
    status: 'CANCELADO',
    data_expiracao: new Date().toISOString().split('T')[0],
  });
  console.log('Acesso cancelado para customer:', customerId);
}

async function handlePaymentFailed(base44, invoice) {
  const customerId = invoice.customer;
  console.log('Payment failed, customer:', customerId);

  const accesses = await apiClient.asServiceRole.entities.UserAccess.filter({ stripe_customer_id: customerId });
  if (accesses.length === 0) return;

  await apiClient.asServiceRole.entities.UserAccess.update(accesses[0].id, {
    status: 'SUSPENSO',
    observacoes: `Pagamento falhou em ${new Date().toLocaleDateString('pt-BR')}`,
  });
  console.log('Acesso suspenso por falha de pagamento para customer:', customerId);
}