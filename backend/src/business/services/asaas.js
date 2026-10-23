// Cliente da API v3 do Asaas — https://docs.asaas.com
// Sandbox: https://api-sandbox.asaas.com/v3 · Produção: https://api.asaas.com/v3
const { decrypt } = require('../lib/crypto');
const { HttpError } = require('../lib/errors');
const { ymd } = require('../lib/dates');
const { round2 } = require('../lib/money');

const BASE = {
  SANDBOX: 'https://api-sandbox.asaas.com/v3',
  PRODUCAO: 'https://api.asaas.com/v3',
};

// Periodicidade interna → ciclo de assinatura do Asaas
const CYCLE = { MENSAL: 'MONTHLY', BIMESTRAL: 'BIMONTHLY', TRIMESTRAL: 'QUARTERLY', SEMESTRAL: 'SEMIANNUALLY', ANUAL: 'YEARLY' };
// Forma de pagamento interna → billingType do Asaas
const BILLING = { BOLETO: 'BOLETO', PIX: 'PIX', CARTAO: 'CREDIT_CARD', UNDEFINED: 'UNDEFINED' };

class AsaasClient {
  constructor(company) {
    this.apiKey = decrypt(company.asaas_api_key);
    if (!this.apiKey) throw new HttpError(400, 'Integração com o Asaas não configurada. Informe a chave de API em Configurações › Asaas.');
    // ASAAS_API_URL permite apontar para um mock/proxy (testes e homologação)
    this.base = process.env.ASAAS_API_URL || BASE[company.asaas_ambiente] || BASE.SANDBOX;
  }

  async request(method, path, body) {
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        access_token: this.apiKey,
        'User-Agent': 'freedom-empresas/1.0',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
    if (!res.ok) {
      const msg = data?.errors?.map((e) => e.description).join('; ') || `Asaas respondeu ${res.status}`;
      throw new HttpError(res.status === 401 ? 400 : 502, `Asaas: ${msg}`, data);
    }
    return data;
  }

  // Clientes
  createCustomer(c) {
    const end = typeof c.endereco === 'object' && c.endereco ? c.endereco : {};
    return this.request('POST', '/customers', {
      name: c.nome,
      cpfCnpj: c.documento ? String(c.documento).replace(/\D/g, '') : undefined,
      email: c.email || undefined,
      phone: c.telefone ? String(c.telefone).replace(/\D/g, '') : undefined,
      mobilePhone: c.telefone ? String(c.telefone).replace(/\D/g, '') : undefined,
      address: end.logradouro || end.rua || undefined,
      addressNumber: end.numero || undefined,
      complement: end.complemento || undefined,
      province: end.bairro || undefined,
      postalCode: end.cep ? String(end.cep).replace(/\D/g, '') : undefined,
      externalReference: `client:${c.id}`,
      notificationDisabled: false,
    });
  }
  updateCustomer(id, c) {
    const end = typeof c.endereco === 'object' && c.endereco ? c.endereco : {};
    return this.request('PUT', `/customers/${id}`, {
      name: c.nome,
      cpfCnpj: c.documento ? String(c.documento).replace(/\D/g, '') : undefined,
      email: c.email || undefined,
      phone: c.telefone ? String(c.telefone).replace(/\D/g, '') : undefined,
      mobilePhone: c.telefone ? String(c.telefone).replace(/\D/g, '') : undefined,
      address: end.logradouro || end.rua || undefined,
      addressNumber: end.numero || undefined,
      complement: end.complemento || undefined,
      province: end.bairro || undefined,
      postalCode: end.cep ? String(end.cep).replace(/\D/g, '') : undefined,
    });
  }

  // Cobranças avulsas
  createPayment({ customer, billingType, value, dueDate, description, externalReference, installmentCount }) {
    return this.request('POST', '/payments', {
      customer,
      billingType: BILLING[billingType] || 'UNDEFINED',
      value: round2(value),
      dueDate: ymd(dueDate),
      description: description?.slice(0, 500),
      externalReference,
      ...(installmentCount > 1 && { installmentCount, totalValue: round2(value) }),
    });
  }
  getPayment(id) { return this.request('GET', `/payments/${id}`); }
  updatePayment(id, { value, dueDate, description }) {
    return this.request('PUT', `/payments/${id}`, {
      ...(value !== undefined && { value: round2(value) }),
      ...(dueDate && { dueDate: ymd(dueDate) }),
      ...(description && { description }),
    });
  }
  deletePayment(id) { return this.request('DELETE', `/payments/${id}`); }
  getPixQrCode(id) { return this.request('GET', `/payments/${id}/pixQrCode`); }
  receiveInCash(id, { paymentDate, value }) {
    return this.request('POST', `/payments/${id}/receiveInCash`, { paymentDate: ymd(paymentDate), value: round2(value), notifyCustomer: false });
  }

  // Assinaturas (contratos recorrentes)
  createSubscription({ customer, billingType, value, nextDueDate, cycle, description, externalReference, endDate }) {
    return this.request('POST', '/subscriptions', {
      customer,
      billingType: BILLING[billingType] || 'UNDEFINED',
      value: round2(value),
      nextDueDate: ymd(nextDueDate),
      cycle: CYCLE[cycle] || 'MONTHLY',
      description: description?.slice(0, 500),
      externalReference,
      ...(endDate && { endDate: ymd(endDate) }),
    });
  }
  updateSubscription(id, { value, nextDueDate, updatePendingPayments = true, description }) {
    return this.request('POST', `/subscriptions/${id}`, {
      ...(value !== undefined && { value: round2(value) }),
      ...(nextDueDate && { nextDueDate: ymd(nextDueDate) }),
      ...(description && { description }),
      updatePendingPayments,
    });
  }
  deleteSubscription(id) { return this.request('DELETE', `/subscriptions/${id}`); }
  listSubscriptionPayments(id) { return this.request('GET', `/subscriptions/${id}/payments?limit=100`); }

  // Listagens com paginação
  listCustomers({ offset = 0, limit = 100 } = {}) {
    return this.request('GET', `/customers?offset=${offset}&limit=${limit}`);
  }

  listSubscriptions({ offset = 0, limit = 100 } = {}) {
    return this.request('GET', `/subscriptions?offset=${offset}&limit=${limit}`);
  }

  listPayments({ offset = 0, limit = 100, status } = {}) {
    const qs = status ? `&status=${status}` : '';
    return this.request('GET', `/payments?offset=${offset}&limit=${limit}${qs}`);
  }

  // Links de Pagamento
  listPaymentLinks({ offset = 0, limit = 100 } = {}) {
    return this.request('GET', `/paymentLinks?offset=${offset}&limit=${limit}`);
  }

  createPaymentLink({ name, description, value, billingType = 'UNDEFINED', chargeType = 'DETACHED', dueDateLimitDays = 10, maxInstallmentCount = 1, endDate }) {
    return this.request('POST', '/paymentLinks', {
      name,
      description: description?.slice(0, 500),
      value: value ? round2(value) : undefined,
      billingType: BILLING[billingType] || 'UNDEFINED',
      chargeType: chargeType || 'DETACHED',
      dueDateLimitDays: dueDateLimitDays ? parseInt(dueDateLimitDays, 10) : undefined,
      maxInstallmentCount: maxInstallmentCount ? parseInt(maxInstallmentCount, 10) : 1,
      ...(endDate && { endDate: ymd(endDate) }),
    });
  }

  // Pagamento de contas / boletos via Asaas (Contas a Pagar)
  listBills({ offset = 0, limit = 100 } = {}) {
    return this.request('GET', `/bill?offset=${offset}&limit=${limit}`);
  }

  createBill({ identificationField, scheduleDate, description, value, dueDate }) {
    return this.request('POST', '/bill', {
      identificationField: String(identificationField).replace(/\D/g, ''),
      scheduleDate: scheduleDate ? ymd(scheduleDate) : undefined,
      description: description?.slice(0, 500),
      value: round2(value),
      dueDate: dueDate ? ymd(dueDate) : undefined,
    });
  }

  cancelBill(id) {
    return this.request('POST', `/bill/${id}/cancel`);
  }

  // Notas Fiscais de Serviço (NFS-e)
  createInvoice({ payment, customer, serviceDescription, observations, value, deductions, effectiveDate, municipalServiceCode, municipalServiceName, taxes, externalReference }) {
    return this.request('POST', '/invoices', {
      payment,
      customer,
      serviceDescription: serviceDescription?.slice(0, 2000),
      observations: observations?.slice(0, 500),
      value: value !== undefined && value !== null ? round2(value) : undefined,
      deductions: deductions !== undefined && deductions !== null ? round2(deductions) : undefined,
      effectiveDate: effectiveDate ? ymd(effectiveDate) : undefined,
      municipalServiceCode: municipalServiceCode || undefined,
      municipalServiceName: municipalServiceName || undefined,
      taxes: taxes || undefined,
      externalReference,
    });
  }

  getInvoice(id) {
    return this.request('GET', `/invoices/${id}`);
  }

  authorizeInvoice(id) {
    return this.request('POST', `/invoices/${id}/authorize`);
  }

  cancelInvoice(id) {
    return this.request('POST', `/invoices/${id}/cancel`);
  }

  listInvoices({ offset = 0, limit = 100, payment, status } = {}) {
    const params = new URLSearchParams();
    params.set('offset', offset);
    params.set('limit', limit);
    if (payment) params.set('payment', payment);
    if (status) params.set('status', status);
    return this.request('GET', `/invoices?${params.toString()}`);
  }

  // Conta e Estatísticas Financeiras
  getBalance() { return this.request('GET', '/finance/balance'); }
  getMyAccount() { return this.request('GET', '/myAccount/commercialInfo/'); }
  getPaymentStatistics(params = {}) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') qs.set(k, v);
    }
    const qStr = qs.toString();
    return this.request('GET', `/finance/payment/statistics${qStr ? `?${qStr}` : ''}`);
  }
}

// Status Asaas → status interno do lançamento
const PAID_STATUSES = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'];
const CANCEL_STATUSES = ['REFUNDED', 'REFUND_REQUESTED', 'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE', 'DELETED'];

module.exports = { AsaasClient, CYCLE, BILLING, PAID_STATUSES, CANCEL_STATUSES, BASE };
