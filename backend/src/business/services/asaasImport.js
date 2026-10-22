// Serviço completo de sincronização e importação de dados do Asaas
// Clientes, Assinaturas (Contratos), Cobranças (Receber), Contas a Pagar (Bill) e Links de Pagamento
const prisma = require('../db');
const { AsaasClient, PAID_STATUSES, CANCEL_STATUSES } = require('./asaas');
const { DEFAULT_ACCOUNTS } = require('./seed');
const { num, round2 } = require('../lib/money');
const { toDate, startOfMonth } = require('../lib/dates');
const { audit } = require('../lib/audit');
const { HttpError, badRequest } = require('../lib/errors');

const CYCLE_MAP = {
  MONTHLY: 'MENSAL',
  BIMONTHLY: 'BIMESTRAL',
  QUARTERLY: 'TRIMESTRAL',
  SEMIANNUALLY: 'SEMESTRAL',
  YEARLY: 'ANUAL',
};

// Itera páginas do Asaas até esgotar
async function fetchAllPages(fetchFn, limit = 100) {
  const all = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const res = await fetchFn({ offset, limit });
    const data = res?.data || [];
    all.push(...data);

    if (res?.hasMore === false || data.length < limit || all.length >= 2000) {
      hasMore = false;
    } else {
      offset += limit;
    }
  }
  return all;
}

async function syncAllFromAsaas(ctx, options = {}) {
  const company = await prisma.bizCompany.findUnique({ where: { id: ctx.companyId } });
  if (!company) throw new HttpError(404, 'Empresa não encontrada');
  if (!company.asaas_api_key) {
    throw badRequest('Chave de API do Asaas não configurada. Configure em Configurações › Asaas.');
  }

  const asaas = new AsaasClient(company);

  // Contas padrão de receita e despesa
  const defaultRecorrente = await prisma.bizChartAccount.findFirst({
    where: { company_id: company.id, codigo: DEFAULT_ACCOUNTS.RECEITA_RECORRENTE },
  });
  const defaultPontual = await prisma.bizChartAccount.findFirst({
    where: { company_id: company.id, codigo: DEFAULT_ACCOUNTS.RECEITA_PONTUAL },
  });
  const defaultDespesa = await prisma.bizChartAccount.findFirst({
    where: { company_id: company.id, codigo: '5.1.06' }, // Outras despesas administrativas
  }) || await prisma.bizChartAccount.findFirst({
    where: { company_id: company.id, natureza: 'DESPESA' },
  });

  const stats = {
    clientes: { importados: 0, atualizados: 0 },
    assinaturas: { importadas: 0, atualizadas: 0 },
    cobrancas: { importadas: 0, atualizadas: 0 },
    contas_pagar: { importadas: 0, atualizadas: 0 },
    links_pagamento: { total: 0 },
  };

  // 1. SINCRONIZAÇÃO DE CLIENTES
  const asaasCustomers = await fetchAllPages((p) => asaas.listCustomers(p));
  const clientMap = new Map(); // asaas_customer_id -> BizClient

  // Carrega clientes locais existentes
  const localClients = await prisma.bizClient.findMany({ where: { company_id: company.id } });
  const localClientsByAsaas = new Map(localClients.filter((c) => c.asaas_customer_id).map((c) => [c.asaas_customer_id, c]));
  const localClientsByDoc = new Map(localClients.filter((c) => c.documento).map((c) => [c.documento, c]));

  for (const c of asaasCustomers) {
    const doc = c.cpfCnpj ? String(c.cpfCnpj).replace(/\D/g, '') : null;
    let local = localClientsByAsaas.get(c.id) || (doc ? localClientsByDoc.get(doc) : null);

    const clientData = {
      nome: c.name || 'Cliente Asaas',
      documento: doc,
      tipo_pessoa: doc && doc.length > 11 ? 'PJ' : 'PF',
      email: c.email || null,
      telefone: c.mobilePhone || c.phone || null,
      asaas_customer_id: c.id,
      endereco: (c.address || c.city) ? {
        logradouro: c.address,
        numero: c.addressNumber,
        complemento: c.complement,
        bairro: c.province,
        cep: c.postalCode,
        cidade: c.city,
        uf: c.state,
      } : undefined,
    };

    if (local) {
      if (!local.asaas_customer_id || (c.email && !local.email)) {
        local = await prisma.bizClient.update({
          where: { id: local.id },
          data: { asaas_customer_id: c.id, ...(c.email && !local.email && { email: c.email }) },
        });
        stats.clientes.atualizados++;
      }
    } else {
      local = await prisma.bizClient.create({
        data: {
          company_id: company.id,
          ...clientData,
          status: 'ATIVO',
          origem: 'ASAAS',
        },
      });
      stats.clientes.importados++;
    }
    clientMap.set(c.id, local);
  }

  // 2. SINCRONIZAÇÃO DE ASSINATURAS (CONTRATOS)
  const asaasSubscriptions = await fetchAllPages((p) => asaas.listSubscriptions(p));
  const contractMap = new Map(); // asaas_subscription_id -> BizContract

  // Carrega contratos existentes
  const localContracts = await prisma.bizContract.findMany({ where: { company_id: company.id } });
  const localContractsByAsaas = new Map(localContracts.filter((ct) => ct.asaas_subscription_id).map((ct) => [ct.asaas_subscription_id, ct]));

  // Próximo número de contrato
  let maxNum = localContracts.reduce((m, ct) => Math.max(m, ct.numero || 0), 0);

  for (const s of asaasSubscriptions) {
    let ct = localContractsByAsaas.get(s.id);
    const client = clientMap.get(s.customer) || (s.customer ? await prisma.bizClient.findFirst({ where: { company_id: company.id, asaas_customer_id: s.customer } }) : null);

    if (!client) continue; // Precisa de cliente para criar contrato

    const val = round2(s.value);
    const status = s.status === 'ACTIVE' ? 'ATIVO' : 'ENCERRADO';
    const periodicidade = CYCLE_MAP[s.cycle] || 'MENSAL';
    const dueDay = s.nextDueDate ? new Date(s.nextDueDate).getDate() : 10;
    const paymentForm = { BOLETO: 'BOLETO', PIX: 'PIX', CREDIT_CARD: 'CARTAO' }[s.billingType] || 'BOLETO';

    if (ct) {
      if (num(ct.valor_recorrente) !== val || ct.status !== status) {
        ct = await prisma.bizContract.update({
          where: { id: ct.id },
          data: { valor_recorrente: val, status, periodicidade },
        });
        stats.assinaturas.atualizadas++;
      }
    } else {
      maxNum++;
      ct = await prisma.bizContract.create({
        data: {
          company_id: company.id,
          numero: maxNum,
          client_id: client.id,
          titulo: s.description || `Assinatura Asaas #${s.id}`,
          tipo: 'RECORRENTE',
          status,
          data_inicio: toDate(s.dateCreated || new Date()),
          periodicidade,
          dia_vencimento: dueDay,
          valor_recorrente: val,
          forma_pagamento: paymentForm,
          cobrar_via_asaas: true,
          asaas_subscription_id: s.id,
          created_by: ctx.userId,
        },
      });
      stats.assinaturas.importadas++;
    }
    contractMap.set(s.id, ct);
  }

  // 3. SINCRONIZAÇÃO DE COBRANÇAS / RECEBÍVEIS
  const asaasPayments = await fetchAllPages((p) => asaas.listPayments(p));
  const localTransactions = await prisma.bizTransaction.findMany({
    where: { company_id: company.id, tipo: 'RECEITA' },
  });
  const localTxByAsaas = new Map(localTransactions.filter((t) => t.asaas_payment_id).map((t) => [t.asaas_payment_id, t]));

  for (const pay of asaasPayments) {
    let t = localTxByAsaas.get(pay.id);
    const isPaid = PAID_STATUSES.includes(pay.status);
    const isCanceled = CANCEL_STATUSES.includes(pay.status);
    const status = isPaid ? 'PAGO' : isCanceled ? 'CANCELADO' : 'PENDENTE';

    const val = round2(pay.value);
    const net = pay.netValue != null ? round2(pay.netValue) : val;
    const fee = round2(Math.max(0, val - net));
    const due = toDate(pay.dueDate) || new Date();
    const payDate = toDate(pay.paymentDate || pay.clientPaymentDate || pay.confirmedDate);
    const paymentForm = { BOLETO: 'BOLETO', PIX: 'PIX', CREDIT_CARD: 'CARTAO' }[pay.billingType] || 'BOLETO';

    const contract = pay.subscription ? (contractMap.get(pay.subscription) || await prisma.bizContract.findFirst({ where: { company_id: company.id, asaas_subscription_id: pay.subscription } })) : null;
    const client = clientMap.get(pay.customer) || (contract ? await prisma.bizClient.findUnique({ where: { id: contract.client_id } }) : null);

    const accountId = contract ? defaultRecorrente?.id : defaultPontual?.id;

    if (t) {
      const needsUpdate = t.status !== status || (isPaid && !t.data_pagamento) || t.asaas_status !== pay.status;
      if (needsUpdate) {
        await prisma.bizTransaction.update({
          where: { id: t.id },
          data: {
            status,
            valor: val,
            valor_pago: isPaid ? val : 0,
            taxa: fee,
            data_pagamento: isPaid ? (payDate || t.data_pagamento || new Date()) : null,
            asaas_status: pay.status,
            asaas_invoice_url: pay.invoiceUrl || t.asaas_invoice_url,
            asaas_boleto_url: pay.bankSlipUrl || t.asaas_boleto_url,
          },
        });
        stats.cobrancas.atualizadas++;
      }
    } else {
      await prisma.bizTransaction.create({
        data: {
          company_id: company.id,
          tipo: 'RECEITA',
          descricao: pay.description || (contract ? contract.titulo : 'Cobrança Asaas'),
          valor: val,
          valor_pago: isPaid ? val : 0,
          taxa: fee,
          vencimento: due,
          competencia: startOfMonth(due),
          data_pagamento: isPaid ? (payDate || new Date()) : null,
          status,
          forma_pagamento: paymentForm,
          client_id: client?.id || null,
          contract_id: contract?.id || null,
          account_id: accountId || null,
          bank_account_id: company.asaas_conta_financeira_id || null,
          recorrente: !!contract,
          origem: 'ASAAS',
          asaas_payment_id: pay.id,
          asaas_status: pay.status,
          asaas_invoice_url: pay.invoiceUrl || null,
          asaas_boleto_url: pay.bankSlipUrl || null,
          documento: contract ? `CT-${contract.numero}/ASAAS` : null,
          created_by: ctx.userId,
        },
      });
      stats.cobrancas.importadas++;
    }
  }

  // 4. SINCRONIZAÇÃO DE CONTAS A PAGAR (BILLS)
  try {
    const asaasBills = await fetchAllPages((p) => asaas.listBills(p));
    const localExpenses = await prisma.bizTransaction.findMany({
      where: { company_id: company.id, tipo: 'DESPESA', origem: 'ASAAS' },
    });
    const localExpByAsaas = new Map(localExpenses.filter((e) => e.asaas_payment_id).map((e) => [e.asaas_payment_id, e]));

    for (const b of asaasBills) {
      let t = localExpByAsaas.get(b.id);
      const isPaid = b.status === 'PAID';
      const isCanceled = ['CANCELLED', 'REFUNDED', 'FAILED'].includes(b.status);
      const status = isPaid ? 'PAGO' : isCanceled ? 'CANCELADO' : 'PENDENTE';
      const val = round2(b.value);
      const due = toDate(b.dueDate || b.scheduleDate) || new Date();
      const payDate = toDate(b.paymentDate || b.scheduleDate);

      if (t) {
        if (t.status !== status || (isPaid && !t.data_pagamento)) {
          await prisma.bizTransaction.update({
            where: { id: t.id },
            data: {
              status,
              valor_pago: isPaid ? val : 0,
              data_pagamento: isPaid ? (payDate || new Date()) : null,
              asaas_status: b.status,
            },
          });
          stats.contas_pagar.atualizadas++;
        }
      } else {
        await prisma.bizTransaction.create({
          data: {
            company_id: company.id,
            tipo: 'DESPESA',
            descricao: b.description || b.companyName || 'Pagamento de boleto (Asaas)',
            valor: val,
            valor_pago: isPaid ? val : 0,
            vencimento: due,
            competencia: startOfMonth(due),
            data_pagamento: isPaid ? (payDate || new Date()) : null,
            status,
            forma_pagamento: 'BOLETO',
            account_id: defaultDespesa?.id || null,
            bank_account_id: company.asaas_conta_financeira_id || null,
            origem: 'ASAAS',
            asaas_payment_id: b.id,
            asaas_status: b.status,
            created_by: ctx.userId,
          },
        });
        stats.contas_pagar.importadas++;
      }
    }
  } catch (err) {
    console.warn('[asaas sync] Erro ao sincronizar bills (pode não estar liberado na conta):', err.message);
  }

  // 5. LINKS DE PAGAMENTO
  try {
    const paymentLinks = await fetchAllPages((p) => asaas.listPaymentLinks(p));
    stats.links_pagamento.total = paymentLinks.length;
  } catch {
    // ignorar falha não impeditiva
  }

  await audit(ctx, 'sync', 'asaas', company.id, 'Sincronização completa do Asaas realizada com sucesso', stats);

  return {
    ok: true,
    stats,
  };
}

// Listar Links de Pagamento do Asaas
async function listPaymentLinks(ctx, query = {}) {
  const company = await prisma.bizCompany.findUnique({ where: { id: ctx.companyId } });
  if (!company?.asaas_api_key) throw badRequest('Asaas não configurado');
  const asaas = new AsaasClient(company);
  return asaas.listPaymentLinks(query);
}

// Criar Link de Pagamento no Asaas
async function createPaymentLink(ctx, data) {
  const company = await prisma.bizCompany.findUnique({ where: { id: ctx.companyId } });
  if (!company?.asaas_api_key) throw badRequest('Asaas não configurado');
  if (!data.name) throw badRequest('Informe o nome do link de pagamento');
  if (!data.value || num(data.value) <= 0) throw badRequest('Informe o valor do link');

  const asaas = new AsaasClient(company);
  const result = await asaas.createPaymentLink({
    name: data.name,
    description: data.description,
    value: data.value,
    billingType: data.billingType || 'UNDEFINED',
    chargeType: data.chargeType || 'DETACHED',
    dueDateLimitDays: data.dueDateLimitDays || 10,
    maxInstallmentCount: data.maxInstallmentCount || 1,
    endDate: data.endDate,
  });

  await audit(ctx, 'create', 'link_pagamento', result.id, `Link de pagamento criado no Asaas: ${data.name} (${result.url})`);

  return result;
}

// Pagar ou agendar boleto via saldo do Asaas
async function payBillViaAsaas(ctx, data) {
  const company = await prisma.bizCompany.findUnique({ where: { id: ctx.companyId } });
  if (!company?.asaas_api_key) throw badRequest('Asaas não configurado');
  if (!data.identificationField) throw badRequest('Informe a linha digitável ou código de barras do boleto');
  if (!data.value || num(data.value) <= 0) throw badRequest('Informe o valor do boleto');

  const asaas = new AsaasClient(company);
  const bill = await asaas.createBill({
    identificationField: data.identificationField,
    value: data.value,
    dueDate: data.dueDate,
    scheduleDate: data.scheduleDate,
    description: data.description || 'Pagamento de fornecedor',
  });

  // Cria ou atualiza a transação local no Contas a Pagar
  const due = toDate(data.dueDate || data.scheduleDate) || new Date();
  const tx = await prisma.bizTransaction.create({
    data: {
      company_id: company.id,
      tipo: 'DESPESA',
      descricao: data.description || bill.companyName || 'Pagamento de conta (Asaas)',
      valor: round2(data.value),
      vencimento: due,
      competencia: startOfMonth(due),
      status: bill.status === 'PAID' ? 'PAGO' : 'PENDENTE',
      valor_pago: bill.status === 'PAID' ? round2(data.value) : 0,
      data_pagamento: bill.status === 'PAID' ? new Date() : null,
      forma_pagamento: 'BOLETO',
      supplier_id: data.supplier_id || null,
      account_id: data.account_id || null,
      cost_center_id: data.cost_center_id || null,
      bank_account_id: company.asaas_conta_financeira_id || null,
      origem: 'ASAAS',
      asaas_payment_id: bill.id,
      asaas_status: bill.status,
      created_by: ctx.userId,
    },
  });

  await audit(ctx, 'pay', 'bill', bill.id, `Boleto agendado/pago via Asaas: R$ ${data.value} (${bill.id})`);

  return { bill, transaction: tx };
}

module.exports = {
  syncAllFromAsaas,
  listPaymentLinks,
  createPaymentLink,
  payBillViaAsaas,
};
