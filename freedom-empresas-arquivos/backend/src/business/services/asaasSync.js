// Processamento dos webhooks do Asaas (idempotente) e sincronização de cobranças
const prisma = require('../db');
const { num, round2 } = require('../lib/money');
const { toDate, startOfMonth } = require('../lib/dates');
const { decrypt, safeEqual } = require('../lib/crypto');
const { HttpError } = require('../lib/errors');
const { audit } = require('../lib/audit');
const { PAID_STATUSES } = require('./asaas');
const { DEFAULT_ACCOUNTS } = require('./seed');

async function verifyWebhook(companyId, headerToken) {
  const company = await prisma.bizCompany.findUnique({ where: { id: companyId } });
  if (!company) throw new HttpError(404, 'Empresa não encontrada');
  const expected = decrypt(company.asaas_webhook_token);
  if (!expected || !safeEqual(expected, headerToken)) throw new HttpError(401, 'Token do webhook inválido');
  return company;
}

async function findOrCreateTransaction(company, payment) {
  let t = await prisma.bizTransaction.findUnique({ where: { asaas_payment_id: payment.id } });
  if (t) return t;

  const ref = String(payment.externalReference || '');
  if (ref.startsWith('tx:')) {
    t = await prisma.bizTransaction.findFirst({ where: { id: ref.slice(3), company_id: company.id } });
    if (t) return prisma.bizTransaction.update({ where: { id: t.id }, data: { asaas_payment_id: payment.id } });
  }

  // Cobrança de assinatura → cria o título vinculado ao contrato
  let contract = null;
  if (payment.subscription) {
    contract = await prisma.bizContract.findFirst({
      where: { company_id: company.id, asaas_subscription_id: payment.subscription },
      include: { items: { include: { product: { select: { account_id: true } } } } },
    });
  }
  let client = await prisma.bizClient.findFirst({ where: { company_id: company.id, asaas_customer_id: payment.customer } });
  if (!client && contract) client = await prisma.bizClient.findUnique({ where: { id: contract.client_id } });

  let accountId = contract?.items?.find((i) => i.cobranca === 'RECORRENTE' && i.product?.account_id)?.product.account_id;
  if (!accountId) {
    const acc = await prisma.bizChartAccount.findFirst({
      where: { company_id: company.id, codigo: contract ? DEFAULT_ACCOUNTS.RECEITA_RECORRENTE : DEFAULT_ACCOUNTS.RECEITA_PONTUAL },
    });
    accountId = acc?.id || null;
  }
  const due = toDate(payment.dueDate);
  return prisma.bizTransaction.create({
    data: {
      company_id: company.id,
      tipo: 'RECEITA',
      descricao: payment.description || (contract ? contract.titulo : 'Cobrança Asaas'),
      valor: round2(payment.value),
      vencimento: due,
      competencia: startOfMonth(due),
      client_id: client?.id || null,
      contract_id: contract?.id || null,
      account_id: accountId,
      cost_center_id: contract?.cost_center_id || null,
      bank_account_id: company.asaas_conta_financeira_id || null,
      forma_pagamento: { BOLETO: 'BOLETO', PIX: 'PIX', CREDIT_CARD: 'CARTAO' }[payment.billingType] || null,
      recorrente: !!contract,
      origem: 'ASAAS',
      asaas_payment_id: payment.id,
      asaas_status: payment.status,
      asaas_invoice_url: payment.invoiceUrl || null,
      asaas_boleto_url: payment.bankSlipUrl || null,
      documento: contract ? `CT-${contract.numero}/ASAAS` : null,
    },
  });
}

async function applyPayment(company, event, payment) {
  const t = await findOrCreateTransaction(company, payment);
  const base = { asaas_status: payment.status, asaas_invoice_url: payment.invoiceUrl || t.asaas_invoice_url, asaas_boleto_url: payment.bankSlipUrl || t.asaas_boleto_url };
  const ctx = { companyId: company.id, origem: 'WEBHOOK' };

  if (PAID_STATUSES.includes(payment.status) || ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'].includes(event)) {
    if (t.status !== 'PAGO') {
      const value = round2(payment.value);
      const net = payment.netValue !== undefined && payment.netValue !== null ? round2(payment.netValue) : value;
      await prisma.bizTransaction.update({
        where: { id: t.id },
        data: {
          ...base,
          status: 'PAGO',
          valor_pago: value,
          juros_multa: round2(Math.max(0, value - num(t.valor))),
          desconto: round2(Math.max(0, num(t.valor) - value)),
          taxa: round2(Math.max(0, value - net)),
          data_pagamento: toDate(payment.paymentDate || payment.clientPaymentDate || payment.confirmedDate) || new Date(),
          bank_account_id: t.bank_account_id || company.asaas_conta_financeira_id || null,
        },
      });
      await audit(ctx, 'pay', 'lancamento', t.id, `Asaas confirmou pagamento de R$ ${value} (${payment.id})`);
    }
    return 'PROCESSADO';
  }
  if (['PAYMENT_DELETED', 'PAYMENT_REFUNDED'].includes(event) || ['REFUNDED', 'DELETED'].includes(payment.status)) {
    await prisma.bizTransaction.update({ where: { id: t.id }, data: { ...base, status: 'CANCELADO' } });
    await audit(ctx, 'cancel', 'lancamento', t.id, `Asaas: ${event} (${payment.id})`);
    return 'PROCESSADO';
  }
  if (event === 'PAYMENT_RECEIVED_IN_CASH_UNDONE' || event === 'PAYMENT_RESTORED') {
    await prisma.bizTransaction.update({ where: { id: t.id }, data: { ...base, status: 'PENDENTE', valor_pago: 0, data_pagamento: null, taxa: 0 } });
    return 'PROCESSADO';
  }
  // CREATED / UPDATED / OVERDUE: atualiza dados enquanto em aberto
  const patch = { ...base };
  if (t.status === 'PENDENTE') {
    if (payment.value) patch.valor = round2(payment.value);
    if (payment.dueDate) patch.vencimento = toDate(payment.dueDate);
  }
  await prisma.bizTransaction.update({ where: { id: t.id }, data: patch });
  return 'PROCESSADO';
}

async function handleWebhook(companyId, headerToken, body) {
  const company = await verifyWebhook(companyId, headerToken);
  const eventId = body?.id || `${body?.event}:${body?.payment?.id}:${body?.dateCreated}`;
  // Idempotência: entrega "at least once"
  try {
    await prisma.bizWebhookEvent.create({
      data: { company_id: company.id, provedor: 'ASAAS', evento_id: String(eventId), evento: String(body?.event || 'DESCONHECIDO'), payload: body || {} },
    });
  } catch (e) {
    if (e.code === 'P2002') return { duplicado: true };
    throw e;
  }
  let status = 'IGNORADO';
  let erro = null;
  try {
    if (body?.payment && String(body.event || '').startsWith('PAYMENT_')) status = await applyPayment(company, body.event, body.payment);
  } catch (e) {
    status = 'ERRO';
    erro = e.message;
    console.error('[biz webhook]', e);
  }
  await prisma.bizWebhookEvent.update({ where: { provedor_evento_id: { provedor: 'ASAAS', evento_id: String(eventId) } }, data: { status, erro } });
  return { status };
}

module.exports = { handleWebhook, applyPayment, verifyWebhook };
