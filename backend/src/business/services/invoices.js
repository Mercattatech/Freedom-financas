// Serviço de Emissão e Gestão de NFS-e (Notas Fiscais de Serviços) via Asaas
const prisma = require('../db');
const { AsaasClient } = require('./asaas');
const { HttpError, badRequest, notFound } = require('../lib/errors');
const { audit } = require('../lib/audit');
const { round2 } = require('../lib/money');
const { toDate, today } = require('../lib/dates');

async function ensureAsaasCustomer(company, client) {
  if (client.asaas_customer_id) return client.asaas_customer_id;
  if (!client.documento) {
    throw badRequest(`Cadastre o CPF/CNPJ do cliente "${client.nome}" para emitir Nota Fiscal.`);
  }
  const asaas = new AsaasClient(company);
  const created = await asaas.createCustomer(client);
  await prisma.bizClient.update({
    where: { id: client.id },
    data: { asaas_customer_id: created.id },
  });
  return created.id;
}

/** Emite ou agenda NFS-e vinculada a um lançamento financeiro */
async function issueInvoice(ctx, transactionId, customParams = {}) {
  const company = await prisma.bizCompany.findUnique({ where: { id: ctx.companyId } });
  if (!company) throw notFound('Empresa');

  const t = await prisma.bizTransaction.findFirst({
    where: { id: transactionId, company_id: ctx.companyId },
    include: { client: true, contract: true },
  });
  if (!t) throw notFound('Lançamento financeiro');
  if (t.tipo !== 'RECEITA') throw badRequest('Apenas contas a receber podem ter emissão de NFS-e');
  if (t.status === 'CANCELADO') throw badRequest('Lançamento cancelado não pode ter nota fiscal emitida');
  if (t.nfse_status === 'AUTHORIZED') throw badRequest(`NFS-e já foi autorizada (Nº ${t.nfse_numero}) para este lançamento`);

  if (!t.client_id || !t.client) {
    throw badRequest('Vincule um cliente ao lançamento para emitir Nota Fiscal');
  }

  const asaas = new AsaasClient(company);

  // Garante que o cliente existe no Asaas
  const asaasCustomerId = await ensureAsaasCustomer(company, t.client);

  // Garante cobrança no Asaas se ainda não existir
  let asaasPaymentId = t.asaas_payment_id;
  if (!asaasPaymentId) {
    const venc = toDate(t.vencimento) < today() ? today() : t.vencimento;
    const p = await asaas.createPayment({
      customer: asaasCustomerId,
      billingType: t.forma_pagamento || 'UNDEFINED',
      value: t.valor,
      dueDate: venc,
      description: t.descricao,
      externalReference: `tx:${t.id}`,
    });
    asaasPaymentId = p.id;
    await prisma.bizTransaction.update({
      where: { id: t.id },
      data: {
        asaas_payment_id: p.id,
        asaas_status: p.status,
        asaas_invoice_url: p.invoiceUrl || null,
        asaas_boleto_url: p.bankSlipUrl || null,
      },
    });
  }

  // Prepara dados fiscais da NFS-e
  const serviceDescription = (customParams.serviceDescription || company.nfse_descricao_padrao || t.descricao || 'Prestação de serviços').slice(0, 2000);
  const municipalServiceCode = customParams.municipalServiceCode || company.municipal_service_code || undefined;
  const municipalServiceName = customParams.municipalServiceName || company.municipal_service_name || undefined;
  const value = customParams.value !== undefined ? round2(customParams.value) : round2(t.valor);
  const effectiveDate = customParams.effectiveDate || today();

  const retainIss = customParams.retainIss !== undefined ? Boolean(customParams.retainIss) : Boolean(company.nfse_reter_iss);
  const issRate = customParams.iss !== undefined ? Number(customParams.iss) : (company.nfse_aliquota_iss ? Number(company.nfse_aliquota_iss) : undefined);

  const taxes = {};
  taxes.retainIss = retainIss;
  if (issRate !== undefined && !isNaN(issRate)) {
    taxes.iss = issRate;
  }
  if (customParams.inss !== undefined) taxes.inss = Number(customParams.inss);
  if (customParams.ir !== undefined) taxes.ir = Number(customParams.ir);
  if (customParams.pis !== undefined) taxes.pis = Number(customParams.pis);
  if (customParams.cofins !== undefined) taxes.cofins = Number(customParams.cofins);
  if (customParams.csll !== undefined) taxes.csll = Number(customParams.csll);

  const invoicePayload = {
    payment: asaasPaymentId,
    serviceDescription,
    value,
    effectiveDate,
    municipalServiceCode,
    municipalServiceName,
    taxes: Object.keys(taxes).length ? taxes : undefined,
    observations: customParams.observations || t.observacoes || undefined,
    deductions: customParams.deductions !== undefined ? round2(customParams.deductions) : undefined,
    externalReference: `tx:${t.id}`,
  };

  const invoice = await asaas.createInvoice(invoicePayload);

  // Se solicitado autorização imediata e status estiver SCHEDULED
  let finalStatus = invoice.status || 'SCHEDULED';
  if (customParams.authorizeNow && invoice.id && finalStatus === 'SCHEDULED') {
    try {
      const authorized = await asaas.authorizeInvoice(invoice.id);
      finalStatus = authorized.status || finalStatus;
    } catch (e) {
      console.error('[biz nfs-e authorizeNow]', e.message);
    }
  }

  const updatedTx = await prisma.bizTransaction.update({
    where: { id: t.id },
    data: {
      asaas_invoice_id: invoice.id,
      nfse_status: finalStatus,
      nfse_numero: invoice.number || null,
      nfse_pdf_url: invoice.pdfUrl || null,
      nfse_xml_url: invoice.xmlUrl || null,
      nfse_rps_numero: invoice.rpsNumber ? String(invoice.rpsNumber) : null,
      nfse_erro: null,
    },
    include: {
      client: { select: { id: true, nome: true, documento: true, email: true } },
      account: { select: { id: true, codigo: true, nome: true } },
    },
  });

  await audit(ctx, 'create', 'nfse', invoice.id, `NFS-e gerada no Asaas para o lançamento "${t.descricao}" (Status: ${finalStatus})`);

  return {
    success: true,
    invoice,
    transaction: updatedTx,
  };
}

/** Consulta e sincroniza status atual da NFS-e junto ao Asaas */
async function syncInvoiceStatus(ctx, transactionId) {
  const company = await prisma.bizCompany.findUnique({ where: { id: ctx.companyId } });
  if (!company) throw notFound('Empresa');

  const t = await prisma.bizTransaction.findFirst({
    where: { id: transactionId, company_id: ctx.companyId },
  });
  if (!t) throw notFound('Lançamento financeiro');
  if (!t.asaas_invoice_id) throw badRequest('Lançamento não possui NFS-e gerada no Asaas');

  const asaas = new AsaasClient(company);
  const invoice = await asaas.getInvoice(t.asaas_invoice_id);

  const updatedTx = await prisma.bizTransaction.update({
    where: { id: t.id },
    data: {
      nfse_status: invoice.status || t.nfse_status,
      nfse_numero: invoice.number || t.nfse_numero,
      nfse_pdf_url: invoice.pdfUrl || t.nfse_pdf_url,
      nfse_xml_url: invoice.xmlUrl || t.nfse_xml_url,
      nfse_rps_numero: invoice.rpsNumber ? String(invoice.rpsNumber) : t.nfse_rps_numero,
      nfse_erro: invoice.status === 'ERROR' ? (invoice.validationErrors || invoice.observations || 'Erro no processamento da NFS-e') : null,
    },
  });

  return {
    success: true,
    invoice,
    transaction: updatedTx,
  };
}

/** Cancela uma NFS-e emitida no Asaas */
async function cancelInvoice(ctx, transactionId, { motivo } = {}) {
  const company = await prisma.bizCompany.findUnique({ where: { id: ctx.companyId } });
  if (!company) throw notFound('Empresa');

  const t = await prisma.bizTransaction.findFirst({
    where: { id: transactionId, company_id: ctx.companyId },
  });
  if (!t) throw notFound('Lançamento financeiro');
  if (!t.asaas_invoice_id) throw badRequest('Lançamento não possui NFS-e vinculada');

  const asaas = new AsaasClient(company);
  const res = await asaas.cancelInvoice(t.asaas_invoice_id);

  const updatedTx = await prisma.bizTransaction.update({
    where: { id: t.id },
    data: {
      nfse_status: res.status || 'CANCELED',
      observacoes: motivo ? `${t.observacoes || ''}\nNFS-e cancelada: ${motivo}`.trim() : t.observacoes,
    },
  });

  await audit(ctx, 'cancel', 'nfse', t.asaas_invoice_id, `NFS-e do lançamento "${t.descricao}" cancelada${motivo ? `: ${motivo}` : ''}`);

  return {
    success: true,
    invoice: res,
    transaction: updatedTx,
  };
}

/** Emissão em lote de NFS-e para múltiplos lançamentos */
async function batchIssueInvoices(ctx, { ids, serviceDescription, municipalServiceCode, municipalServiceName, iss, retainIss }) {
  if (!Array.isArray(ids) || !ids.length) throw badRequest('Nenhum lançamento selecionado');

  const issued = [];
  const errors = [];

  for (const id of ids) {
    try {
      const res = await issueInvoice(ctx, id, {
        serviceDescription,
        municipalServiceCode,
        municipalServiceName,
        iss,
        retainIss,
      });
      issued.push({ id, invoiceId: res.invoice.id, status: res.invoice.status });
    } catch (err) {
      errors.push({ id, error: err.message });
    }
  }

  return {
    total: ids.length,
    successCount: issued.length,
    errorCount: errors.length,
    issued,
    errors,
  };
}

/** Disparado automaticamente na confirmação de pagamento se configurado */
async function autoIssueOnPayment(company, transaction) {
  if (!company.nfse_emitir_ao_receber) return;
  if (transaction.tipo !== 'RECEITA' || transaction.asaas_invoice_id) return;
  if (!transaction.client_id) return;

  try {
    const ctx = { companyId: company.id, userId: 'asaas_webhook', papel: 'ADMIN' };
    await issueInvoice(ctx, transaction.id, {
      serviceDescription: company.nfse_descricao_padrao || transaction.descricao,
      municipalServiceCode: company.municipal_service_code,
      municipalServiceName: company.municipal_service_name,
      retainIss: company.nfse_reter_iss,
      iss: company.nfse_aliquota_iss ? Number(company.nfse_aliquota_iss) : undefined,
    });
    console.log(`[biz nfs-e auto] Emitida NFS-e automática para lançamento ${transaction.id}`);
  } catch (err) {
    console.error(`[biz nfs-e auto error] Falha ao emitir NFS-e automática para lançamento ${transaction.id}:`, err.message);
  }
}

module.exports = {
  issueInvoice,
  syncInvoiceStatus,
  cancelInvoice,
  batchIssueInvoices,
  autoIssueOnPayment,
};
