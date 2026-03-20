import { createClientFromRequest } from 'npm:@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await apiClient.auth.me();

    if (!user) {
      return Response.json({ hasAccess: false, reason: 'not_authenticated' }, { status: 401 });
    }

    // Admin sempre tem acesso total
    if (user.role === 'admin') {
      return Response.json({
        hasAccess: true,
        isAdmin: true,
        plan: null,
        limits: { limite_familias: 999 },
        status: 'ATIVO',
      });
    }

    // Busca acesso do usuário
    const accesses = await apiClient.asServiceRole.entities.UserAccess.filter({ user_email: user.email });

    if (accesses.length === 0) {
      return Response.json({ hasAccess: false, reason: 'no_access', plan: null });
    }

    const access = accesses[0];

    // Verifica se está ativo
    if (access.status !== 'ATIVO' && access.status !== 'TRIAL') {
      return Response.json({ hasAccess: false, reason: 'access_' + access.status.toLowerCase(), access });
    }

    // Verifica expiração
    if (access.data_expiracao) {
      const expDate = new Date(access.data_expiracao);
      if (expDate < new Date()) {
        // Marca como expirado
        await apiClient.asServiceRole.entities.UserAccess.update(access.id, { status: 'CANCELADO' });
        return Response.json({ hasAccess: false, reason: 'expired', access });
      }
    }

    // Busca o plano para pegar todos os limites
    let plan = null;
    if (access.plan_id) {
      const plans = await apiClient.asServiceRole.entities.Plan.filter({ id: access.plan_id });
      plan = plans[0] || null;
    }

    return Response.json({
      hasAccess: true,
      isAdmin: false,
      access,
      plan,
      limits: {
        limite_familias: access.limite_familias || plan?.limite_familias || 1,
        features: plan?.features ? plan.features.split(',').map(f => f.trim()) : [],
        plan_nome: access.plan_nome || plan?.nome || '',
      },
      status: access.status,
    });
  } catch (error) {
    console.error('Erro ao verificar acesso:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});