import { createClientFromRequest } from 'npm:@0.8.20';
import Stripe from 'npm:stripe@14.21.0';

Deno.serve(async (req) => {
  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    const base44 = createClientFromRequest(req);

    const { plan_id, success_url, cancel_url } = await req.json();

    if (!plan_id) {
      return Response.json({ error: 'plan_id é obrigatório' }, { status: 400 });
    }

    // Buscar o plano
    const plans = await apiClient.asServiceRole.entities.Plan.filter({ id: plan_id });
    const plan = plans?.[0];

    if (!plan) {
      console.error('Plano não encontrado:', plan_id);
      return Response.json({ error: 'Plano não encontrado' }, { status: 404 });
    }

    if (!plan.stripe_price_id) {
      console.error('Plano sem stripe_price_id:', plan_id);
      return Response.json({ error: 'Plano sem preço configurado no Stripe' }, { status: 400 });
    }

    // Determinar modo baseado no stripe_price_id - buscar o tipo do preço no Stripe
    // ANUAL e MENSAL podem ser tanto subscription quanto payment dependendo de como foi criado
    let mode = 'payment';
    try {
      const stripePrice = await stripe.prices.retrieve(plan.stripe_price_id);
      mode = stripePrice.type === 'recurring' ? 'subscription' : 'payment';
    } catch (e) {
      console.error('Erro ao buscar preço no Stripe, usando payment:', e.message);
    }

    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: [
        {
          price: plan.stripe_price_id,
          quantity: 1,
        },
      ],
      success_url: success_url || 'https://app.freedomfinanceiro.com.br/obrigado',
      cancel_url: cancel_url || 'https://app.freedomfinanceiro.com.br/',
      metadata: {
        base44_app_id: Deno.env.get('BASE44_APP_ID'),
        plan_id: plan.id,
        plan_nome: plan.nome,
      },
    });

    console.log('Checkout criado:', session.id, 'plano:', plan.nome, 'modo:', mode);
    return Response.json({ url: session.url });
  } catch (error) {
    console.error('Erro ao criar checkout:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});