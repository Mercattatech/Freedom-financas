import { createClientFromRequest } from 'npm:@0.8.20';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await apiClient.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { plan_id, nome, descricao, preco, tipo } = await req.json();

    if (!plan_id || !nome || !preco || !tipo) {
      return Response.json({ error: 'Campos obrigatórios: plan_id, nome, preco, tipo' }, { status: 400 });
    }

    const plans = await apiClient.asServiceRole.entities.Plan.filter({ id: plan_id });
    const plan = plans[0];

    if (!plan) {
      return Response.json({ error: 'Plano não encontrado' }, { status: 404 });
    }

    let productId = plan.stripe_product_id;
    let priceId = plan.stripe_price_id;

    // Cria ou atualiza produto no Stripe
    if (productId) {
      await stripe.products.update(productId, {
        name: nome,
        description: descricao || '',
      });
      console.log('Produto atualizado no Stripe:', productId);
    } else {
      const product = await stripe.products.create({
        name: nome,
        description: descricao || '',
        metadata: { plan_id, base44_app_id: Deno.env.get('BASE44_APP_ID') },
      });
      productId = product.id;
      console.log('Produto criado no Stripe:', productId);
    }

    // Arquiva price antigo e cria novo (Stripe não permite editar preço)
    if (priceId) {
      await stripe.prices.update(priceId, { active: false });
      console.log('Price antigo arquivado:', priceId);
    }

    const priceParams = {
      product: productId,
      currency: 'brl',
      unit_amount: Math.round(preco * 100),
      metadata: { plan_id },
    };

    if (tipo === 'MENSAL') {
      priceParams.recurring = { interval: 'month' };
    } else if (tipo === 'ANUAL') {
      priceParams.recurring = { interval: 'year' };
    }
    // UNICO = one-time, sem recurring

    const newPrice = await stripe.prices.create(priceParams);
    priceId = newPrice.id;
    console.log('Novo Price criado:', priceId);

    // Atualiza o plano com os IDs do Stripe
    await apiClient.asServiceRole.entities.Plan.update(plan_id, {
      stripe_product_id: productId,
      stripe_price_id: priceId,
    });

    return Response.json({
      success: true,
      stripe_product_id: productId,
      stripe_price_id: priceId,
    });
  } catch (error) {
    console.error('Erro ao sincronizar plano com Stripe:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});