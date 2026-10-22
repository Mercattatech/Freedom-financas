// Cenário ponta a ponta: agência de marketing com contratos recorrentes e pontuais.
// Rodar: DATABASE_URL=postgresql://.../freedom_test JWT_SECRET=x node backend/src/business/tests/scenario.js
const { ready, store, prisma } = require('./harness');
const jwt = require('jsonwebtoken');
const API = 'http://127.0.0.1:3000/api/biz';
let failures = 0;
const ok = (cond, msg, extra) => { if (cond) console.log('  ✓', msg); else { failures++; console.log('  ✗', msg, extra !== undefined ? JSON.stringify(extra) : ''); } };
const near = (a, b, tol = 0.02) => Math.abs(Number(a) - Number(b)) <= tol;
const now = new Date();
const Y = now.getFullYear(); const M = String(now.getMonth() + 1).padStart(2, '0');
const mes = `${Y}-${M}`;
const dia = (d) => `${mes}-${String(d).padStart(2, '0')}`;
const prevMonth = (n) => { const d = new Date(Date.UTC(Y, now.getMonth() - n, 1)); return d.toISOString().slice(0, 10); };

let TOKEN; let CID;
async function call(method, path, body, headers = {}) {
  const res = await fetch(API + path, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}`, ...(CID && { 'x-company-id': CID }), ...headers }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => null);
  if (!res.ok && !headers['x-expect-error']) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

(async () => {
  await ready;
  for (const t of ['biz_company'] ) await prisma.$executeRawUnsafe(`TRUNCATE "${t}" CASCADE`);
  if (!/test|localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || '')) throw new Error('Use um banco de teste (DATABASE_URL com "test" ou localhost)');
  await prisma.$executeRawUnsafe(`DELETE FROM "User"`);
  await prisma.$executeRawUnsafe(`INSERT INTO "User"(id,email,full_name,password,is_verified,role,updated_date) VALUES ('u1','matheus@grupomercatta.com.br','Matheus','x',true,'user',now()),('u2','comercial@grupomercatta.com.br','Comercial','x',true,'user',now())`);
  TOKEN = jwt.sign({ id: 'u1', email: 'matheus@grupomercatta.com.br', role: 'user' }, process.env.JWT_SECRET);

  console.log('\n1. Empresa e estrutura padrão');
  const comp = await call('POST', '/companies', { razao_social: 'Grupo Mercatta Ltda', nome_fantasia: 'Grupo Mercatta', cnpj: '12.345.678/0001-90', aliquota_imposto: 6, cor_primaria: '#111827', cor_secundaria: '#F97316' });
  CID = comp.id;
  ok(comp.papel === 'OWNER' && !comp.asaas_api_key, 'empresa criada, usuário é OWNER e segredo não vaza');
  const accounts = await call('GET', '/accounts');
  ok(accounts.length === 39, `plano de contas padrão (${accounts.length} contas)`);
  ok((await call('GET', '/cost-centers')).length === 6, 'centros de custo padrão');
  const banks = await call('GET', '/bank-accounts');
  const caixa = banks.find((b) => b.tipo === 'CAIXA');
  const asaasConn = await call('PUT', '/company/asaas', { api_key: '$aact_test_123', ambiente: 'SANDBOX' });
  ok(asaasConn.conexao?.ok && asaasConn.conexao.saldo === 12345.67 && asaasConn.asaas_api_key_mascarada?.includes('…'), 'Asaas conectado e chave mascarada');
  const st = await call('GET', '/company/asaas/status');
  ok(st.webhook.url.endsWith(`/api/biz/webhooks/asaas/${CID}`) && st.webhook.token.length > 30, 'URL e token do webhook gerados');

  console.log('\n2. Permissões');
  await call('POST', '/members', { email: 'comercial@grupomercatta.com.br', papel: 'COMERCIAL' });
  const tokU1 = TOKEN; TOKEN = jwt.sign({ id: 'u2', email: 'comercial@grupomercatta.com.br', role: 'user' }, process.env.JWT_SECRET);
  const denied = await call('GET', '/reports/dre', null, { 'x-expect-error': '1' });
  ok(denied.status === 403, 'papel COMERCIAL não vê DRE');
  const denied2 = await call('POST', '/transactions', { tipo: 'DESPESA', descricao: 'x', valor: 1, vencimento: dia(1) }, { 'x-expect-error': '1' });
  ok(denied2.status === 403, 'papel COMERCIAL não lança despesas');
  TOKEN = 'invalid'; const noauth = await call('GET', '/clients', null, { 'x-expect-error': '1' }); ok(noauth.status === 401, 'sem token → 401');
  TOKEN = tokU1;
  const otherCo = await call('GET', '/clients', null, { 'x-company-id': '00000000-0000-0000-0000-000000000000', 'x-expect-error': '1' });
  ok(otherCo.status === 403, 'empresa de outro tenant → 403');

  console.log('\n3. Equipe, clientes, catálogo e estoque');
  const ana = await call('POST', '/team', { nome: 'Ana Designer', cargo: 'Designer', custo_mensal: 6000, horas_mes: 160 });
  const bruno = await call('POST', '/team', { nome: 'Bruno Tráfego', cargo: 'Gestor de tráfego', custo_mensal: 8000, horas_mes: 160 });
  await call('POST', '/team', { nome: 'Carla Adm', cargo: 'Administrativo', custo_mensal: 4000, produtivo: false });
  const teamList = await call('GET', '/team');
  ok(teamList.find((m) => m.nome === 'Ana Designer').custo_hora === 37.5, 'custo/hora calculado (6000/160 = 37,50)');
  const alfa = await call('POST', '/clients', { nome: 'Locadora Alfa S/A', nome_fantasia: 'Locadora Alfa', documento: '11.222.333/0001-44', email: 'fin@alfa.com' });
  const beta = await call('POST', '/clients', { nome: 'Escola Beta', documento: '22333444000155' });
  const gama = await call('POST', '/clients', { nome: 'Loja Gama' });
  ok(alfa.documento === '11222333000144', 'documento normalizado');
  const trafego = await call('POST', '/products', { tipo: 'SERVICO', nome: 'Gestão de tráfego', preco_venda: 3500, custo_unitario: 0, horas_estimadas: 20, cobranca: 'RECORRENTE', periodicidade: 'MENSAL' });
  const social = await call('POST', '/products', { tipo: 'SERVICO', nome: 'Social media', preco_venda: 2500, custo_unitario: 300, cobranca: 'RECORRENTE' });
  const lp = await call('POST', '/products', { tipo: 'SERVICO', nome: 'Landing page', preco_venda: 4000, custo_unitario: 800, cobranca: 'UNICA' });
  const kit = await call('POST', '/products', { tipo: 'PRODUTO', nome: 'Kit brindes', preco_venda: 150, custo_unitario: 60, controla_estoque: true, estoque_inicial: 100, estoque_minimo: 20 });
  ok(kit.estoque_atual === 100 && kit.custo_unitario === 60 && lp.margem_percent === 80, 'estoque inicial e margem unitária');
  await call('POST', `/products/${kit.id}/stock`, { tipo: 'ENTRADA', quantidade: 100, custo_unitario: 80 });
  let k2 = await call('GET', `/products/${kit.id}`);
  ok(k2.estoque_atual === 200 && k2.custo_unitario === 70, 'custo médio ponderado (100×60 + 100×80)/200 = 70');
  await call('POST', `/products/${kit.id}/stock`, { tipo: 'ENTRADA', quantidade: -5 }, { 'x-expect-error': '1' }).then((r) => ok(r.status === 400, 'quantidade negativa rejeitada'));
  const over = await call('POST', `/products/${kit.id}/stock`, { tipo: 'SAIDA', quantidade: 999 }, { 'x-expect-error': '1' });
  ok(over.status === 400 && over.message.includes('insuficiente'), 'saída maior que o saldo bloqueada');

  console.log('\n4. Proposta → link público → aceite → contrato');
  const prop = await call('POST', '/proposals', {
    titulo: 'Plano de crescimento digital', client_id: alfa.id, introducao: 'Olá, time Alfa!', escopo: '- Tráfego\n- Social', prazo_contrato_meses: 12,
    items: [{ product_id: trafego.id }, { product_id: social.id }, { product_id: lp.id }],
  });
  ok(prop.total_recorrente === 6000 && prop.total_unico === 4000, `totais da proposta (rec ${prop.total_recorrente}, único ${prop.total_unico})`);
  ok(prop.margem_recorrente === 5700 && prop.margem_recorrente_percent === 95, 'margem estimada recorrente (6000 − 300)');
  const sent = await call('POST', `/proposals/${prop.id}/send`, {});
  ok(sent.status === 'ENVIADA' && sent.link.includes(`/proposta/`), 'proposta enviada com link');
  const token = sent.link.split('/proposta/')[1];
  const pub = await (await fetch(`${API}/public/proposals/${token}`)).json();
  const pubStr = JSON.stringify(pub);
  ok(pub.status === 'VISUALIZADA' && pub.empresa.cor_secundaria === '#F97316', 'página pública com marca e status visualizada');
  ok(!pubStr.includes('custo') && !pubStr.includes('margem') && !pubStr.includes('asaas'), 'página pública não expõe custo/margem');
  const acc = await (await fetch(`${API}/public/proposals/${token}/accept`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: 'João Alfa', documento: '123.456.789-00' }) })).json();
  ok(acc.status === 'ACEITA', 'aceite online');
  const propAfter = await call('GET', `/proposals/${prop.id}`);
  ok(!!propAfter.contract_id, 'contrato gerado automaticamente no aceite');
  let ctAlfa = await call('GET', `/contracts/${propAfter.contract_id}`);
  ok(ctAlfa.status === 'RASCUNHO' && ctAlfa.valor_recorrente === 6000 && ctAlfa.valor_pontual === 4000, 'contrato em rascunho com valores da proposta');
  ctAlfa = await call('POST', `/contracts/${ctAlfa.id}/activate`);
  ok(ctAlfa.status === 'ATIVO' && ctAlfa.asaas_subscription_id?.startsWith('sub_'), 'ativação criou assinatura no Asaas');
  const sub = store.subscriptions[ctAlfa.asaas_subscription_id];
  ok(sub.cycle === 'MONTHLY' && sub.value === 6000 && sub.externalReference === `contract:${ctAlfa.id}`, 'assinatura com ciclo/valor/referência corretos');
  const alfaTx = (await call('GET', `/transactions?contract_id=${ctAlfa.id}`)).items;
  ok(alfaTx.length === 1 && alfaTx[0].valor === 4000 && alfaTx[0].asaas_payment_id, 'setup (landing page) cobrado no Asaas');

  console.log('\n5. Contratos manuais (recorrente com histórico e pontual parcelado)');
  const ctBeta = await call('POST', '/contracts', { client_id: beta.id, titulo: 'Fee mensal Escola Beta', tipo: 'RECORRENTE', valor_recorrente: 3000, data_inicio: prevMonth(2), dia_vencimento: 10, cobrar_via_asaas: false, forma_pagamento: 'PIX', custo_previsto_mensal: 500, horas_previstas_mensal: 15 });
  const betaTx = (await call('GET', `/transactions?contract_id=${ctBeta.id}`)).items;
  ok(betaTx.length === 5, `títulos gerados do início até +2 meses (${betaTx.length})`);
  const again = await call('POST', `/contracts/${ctBeta.id}/generate`, {});
  ok(again.criados === 0, 'geração é idempotente');
  const ctGama = await call('POST', '/contracts', { client_id: gama.id, titulo: 'Site institucional Loja Gama', tipo: 'PONTUAL', valor_pontual: 10000, parcelas_pontual: 2, forma_pagamento: 'MANUAL' });
  const gamaTx = (await call('GET', `/transactions?contract_id=${ctGama.id}`)).items;
  ok(gamaTx.length === 2 && gamaTx[0].valor + gamaTx[1].valor === 10000 && !gamaTx[0].asaas_payment_id, 'pontual em 2 parcelas, sem Asaas');

  console.log('\n6. Webhooks do Asaas');
  const wh = await call('GET', '/company/asaas/status');
  const hook = (body, tok = wh.webhook.token) => fetch(`${API}/webhooks/asaas/${CID}`, { method: 'POST', headers: { 'content-type': 'application/json', 'asaas-access-token': tok }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, ...(await r.json()) }));
  ok((await hook({ id: 'evt_x', event: 'PAYMENT_CREATED', payment: {} }, 'errado')).status === 401, 'webhook com token errado → 401');
  const cusId = Object.keys(store.customers)[0];
  const subPay = { object: 'payment', id: 'pay_sub_1', customer: cusId, subscription: ctAlfa.asaas_subscription_id, value: 6000, netValue: 5990.01, billingType: 'BOLETO', status: 'PENDING', dueDate: dia(10), description: 'Mensalidade', invoiceUrl: 'https://asaas/i/1' };
  await hook({ id: 'evt_1', event: 'PAYMENT_CREATED', payment: subPay });
  let created = (await call('GET', `/transactions?contract_id=${ctAlfa.id}`)).items.find((t) => t.asaas_payment_id === 'pay_sub_1');
  ok(created && created.valor === 6000 && created.contract?.id === ctAlfa.id && created.account?.codigo === '1.1.01', 'PAYMENT_CREATED da assinatura gera título vinculado ao contrato');
  await hook({ id: 'evt_2', event: 'PAYMENT_RECEIVED', payment: { ...subPay, status: 'RECEIVED', paymentDate: dia(9) } });
  const dup = await hook({ id: 'evt_2', event: 'PAYMENT_RECEIVED', payment: { ...subPay, status: 'RECEIVED' } });
  ok(dup.duplicado === true, 'evento duplicado ignorado (idempotência)');
  created = await call('GET', `/transactions/${created.id}`);
  ok(created.status === 'PAGO' && created.taxa === 9.99 && created.bankAccount?.nome === 'Conta Asaas', 'pagamento confirmado, tarifa registrada, conta Asaas');
  const setup = alfaTx[0];
  await hook({ id: 'evt_3', event: 'PAYMENT_RECEIVED', payment: { id: setup.asaas_payment_id, customer: cusId, value: 4000, netValue: 3996.01, status: 'RECEIVED', dueDate: setup.vencimento.slice(0, 10), paymentDate: dia(5), externalReference: `tx:${setup.id}` } });
  ok((await call('GET', `/transactions/${setup.id}`)).status === 'PAGO', 'setup pago via webhook');

  console.log('\n7. Baixas, despesas, horas e estoque alocado');
  for (const t of betaTx.filter((t) => t.vencimento.slice(0, 7) <= mes)) await call('POST', `/transactions/${t.id}/pay`, { bank_account_id: caixa.id, data_pagamento: t.vencimento.slice(0, 10) });
  const partial = await call('POST', `/transactions/${gamaTx[0].id}/pay`, { valor: 2000, bank_account_id: caixa.id });
  ok(partial.status === 'PARCIAL' && partial.saldo === 3000, 'baixa parcial (2.000 de 5.000)');
  const reopened = await call('POST', `/transactions/${gamaTx[0].id}/reopen`);
  ok(reopened.status === 'PENDENTE' && reopened.valor_pago === 0, 'estorno de baixa');
  const byCode = Object.fromEntries(accounts.map((a) => [a.codigo, a.id]));
  const forn = await call('POST', '/suppliers', { nome: 'Freela Vídeo', categoria: 'freelancer' });
  await call('POST', '/transactions', { tipo: 'DESPESA', descricao: 'Edição de vídeos Alfa', valor: 1200, vencimento: dia(15), supplier_id: forn.id, contract_id: ctAlfa.id, account_id: byCode['3.1.01'] });
  await call('POST', '/transactions', { tipo: 'DESPESA', descricao: 'Folha', valor: 12000, vencimento: dia(5), account_id: byCode['4.1.01'], pago: true, bank_account_id: caixa.id });
  await call('POST', '/transactions', { tipo: 'DESPESA', descricao: 'Aluguel', valor: 3000, vencimento: dia(10), account_id: byCode['5.1.01'], pago: true, bank_account_id: caixa.id, repetir: 12 });
  await call('POST', '/transactions', { tipo: 'DESPESA', descricao: 'Softwares', valor: 800, vencimento: dia(20), account_id: byCode['5.1.02'] });
  await call('POST', '/transactions', { tipo: 'DESPESA', descricao: 'DAS', valor: 1500, vencimento: dia(20), account_id: byCode['2.1.01'] });
  const parc = await call('POST', '/transactions', { tipo: 'DESPESA', descricao: 'Anúncios próprios', valor: 1000, parcelas: 2, vencimento: dia(25), account_id: byCode['6.1.02'] });
  ok(parc.length === 2 && parc[0].valor === 500 && parc[0].competencia.slice(0, 7) === mes && parc[1].competencia.slice(0, 7) === mes, 'parcelado: competência única, vencimentos mensais');
  const alug = (await call('GET', '/transactions?tipo=DESPESA&q=Aluguel')).items;
  ok(alug.length === 12 && alug.filter((t) => t.status === 'PAGO').length === 1 && alug[11].competencia.slice(0, 7) > mes, 'recorrência de 12 meses: só a 1ª baixada, competências mensais');
  await call('POST', '/time-entries', { team_member_id: ana.id, contract_id: ctAlfa.id, horas: 40, data: dia(12) });
  await call('POST', '/time-entries', { team_member_id: bruno.id, contract_id: ctAlfa.id, horas: 30, data: dia(12) });
  await call('POST', '/time-entries', { team_member_id: ana.id, contract_id: ctBeta.id, horas: 20, data: dia(12) });
  await call('POST', '/time-entries', { team_member_id: bruno.id, horas: 10, data: dia(12), descricao: 'Interno' });
  await call('POST', `/products/${kit.id}/stock`, { tipo: 'SAIDA', quantidade: 10, contract_id: ctAlfa.id, data: dia(12) });
  k2 = await call('GET', `/products/${kit.id}`);
  ok(k2.estoque_atual === 190 && k2.custo_unitario === 70, 'saída baixa estoque mantendo custo médio');

  console.log('\n8. DRE do mês (competência)');
  const d = await call('GET', `/reports/dre?from=${mes}`);
  const T = d.totais;
  ok(near(T.RECEITA_BRUTA, 23000), `receita bruta 23.000 (${T.RECEITA_BRUTA})`);
  ok(near(T.DEDUCOES, -1500) && near(T.CUSTOS, -1200), 'deduções −1.500 e custos −1.200');
  ok(near(T.EBITDA, 23000 - 1500 - 1200 - 12000 - 3800 - 1000), `EBITDA 3.500 (${T.EBITDA})`);
  ok(near(T.LUCRO_LIQUIDO, 3500 - 13.98), `lucro líquido 3.486,02 com tarifas Asaas (${T.LUCRO_LIQUIDO})`);
  ok(d.linhas.some((l) => l.label === 'Tarifas de cobrança (Asaas)' && near(l.total, -13.98)), 'linha de tarifas do Asaas');
  ok(near(d.indicadores.margem_liquida, 15.16), `margem líquida 15,16% (${d.indicadores.margem_liquida})`);
  const dc = await call('GET', `/reports/dre?from=${mes}&regime=caixa`);
  ok(near(dc.totais.RECEITA_BRUTA, 6000 + 4000 + 3000), `DRE caixa: recebido no mês 13.000 (${dc.totais.RECEITA_BRUTA})`);

  console.log('\n9. Margem dos contratos e da agência');
  const cm = await call('GET', `/reports/contracts-margin?from=${mes}`);
  const A = cm.contratos.find((c) => c.contract_id === ctAlfa.id);
  const B = cm.contratos.find((c) => c.contract_id === ctBeta.id);
  const G = cm.contratos.find((c) => c.contract_id === ctGama.id);
  ok(A.receita === 10000 && A.impostos === 600 && A.custos_diretos === 1200 && A.mao_obra === 3000 && A.produtos === 700 && near(A.taxas, 13.98), 'Alfa: receita, impostos, custos, horas, produtos e tarifas', A);
  ok(near(A.margem_contribuicao, 10000 - 600 - 1200 - 13.98 - 3000 - 700) && near(A.margem_contribuicao_percent, 44.86), `Alfa MC 4.486,02 (44,86%) → ${A.margem_contribuicao} (${A.margem_contribuicao_percent}%)`);
  ok(near(B.margem_contribuicao, 3000 - 180 - 750), `Beta MC 2.070 → ${B.margem_contribuicao}`);
  ok(near(G.margem_contribuicao, 9400), `Gama MC 9.400 → ${G.margem_contribuicao}`);
  const overheadEsperado = 12000 + 3000 + 800 + 1000 - 3750 - 700;
  ok(near(cm.overhead.nao_alocado, overheadEsperado), `overhead não alocado ${overheadEsperado} → ${cm.overhead.nao_alocado}`);
  ok(near(cm.totais.rateio_overhead, overheadEsperado, 0.05) && near(A.rateio_overhead, overheadEsperado * 10000 / 23000, 0.05), 'rateio do overhead proporcional à receita');
  ok(near(cm.totais.margem_liquida, cm.totais.margem_contribuicao - overheadEsperado, 0.05), 'margem líquida = MC − overhead');
  // Reconciliação gerencial: Σ margem líquida dos contratos ≈ EBITDA − tarifas + (impostos estimados − DAS real)
  const imposEst = cm.totais.impostos; const ebitdaAjust = T.EBITDA - 13.98 - (imposEst - 1500);
  ok(near(cm.totais.margem_liquida, ebitdaAjust, 0.05), `reconciliação contratos × DRE (${cm.totais.margem_liquida} vs ${ebitdaAjust.toFixed(2)})`);
  ok(B.previsto.meses_ativos === 1 && B.previsto.receita === 3000 && B.previsto.custo_direto === 500, 'previsto × realizado (Beta)');
  const ag = await call('GET', `/reports/agency-margin?from=${mes}`);
  ok(ag.capacidade.horas_disponiveis === 320 && ag.capacidade.horas_em_contratos === 90 && near(ag.capacidade.utilizacao_percent, 28.13), `utilização da equipe 28,13% (${ag.capacidade.utilizacao_percent})`);
  ok(ag.capacidade.custo_ocioso === 14000 - 3750, `custo ocioso 10.250 (${ag.capacidade.custo_ocioso})`);
  const imc = (23000 - (1500 + 1200 + 1000)) / 23000; const pe = 15800 / imc;
  ok(near(ag.ponto_equilibrio.receita_minima_mensal, pe, 0.05), `ponto de equilíbrio ${pe.toFixed(2)} → ${ag.ponto_equilibrio.receita_minima_mensal}`);
  ok(ag.cascata[ag.cascata.length - 1].valor === T.LUCRO_LIQUIDO, 'cascata fecha no lucro líquido');
  const cl = await call('GET', `/reports/clients-margin?from=${mes}`);
  ok(cl.clientes.length === 3 && near(cl.concentracao_top5, 100), 'margem por cliente e concentração');

  const single = await call('GET', `/reports/contracts-margin?from=${mes}&contract_id=${ctAlfa.id}`);
  ok(single.contratos.length === 1 && near(single.contratos[0].rateio_overhead, A.rateio_overhead), 'filtro por contrato mantém o rateio calculado sobre a base completa');
  const keepKey = await call('PUT', '/company/asaas', { ambiente: 'SANDBOX' });
  ok(keepKey.asaas_configurado === true, 'trocar ambiente sem enviar chave mantém a chave do Asaas');

  console.log('\n10. Dashboard, caixa e aging');
  const db = await call('GET', '/reports/dashboard');
  ok(db.assinaturas.mrr === 9000 && db.assinaturas.arr === 108000 && db.assinaturas.novo_mrr === 6000, `MRR 9.000 / ARR 108.000 / novo MRR 6.000 (${db.assinaturas.mrr})`);
  const bal = await call('GET', '/reports/balances');
  const caixaSaldo = bal.contas.find((c) => c.id === caixa.id).saldo; const asaasSaldo = bal.contas.find((c) => c.nome === 'Conta Asaas').saldo;
  ok(near(asaasSaldo, 9986.02) && near(caixaSaldo, 9000 - 15000), `saldos: Asaas 9.986,02 (${asaasSaldo}) e Caixa −6.000 (${caixaSaldo})`);
  const cf = await call('GET', '/reports/cashflow?days=90');
  ok(cf.serie.length >= 12 && near(cf.saldo_inicial, bal.total), 'fluxo de caixa projetado semanal');
  ok(cf.receita_prevista_contratos >= 6000, `receita prevista de assinaturas ainda não emitidas (${cf.receita_prevista_contratos})`);
  const ag2 = await call('GET', '/reports/aging');
  ok(ag2.faixas.length === 5, 'aging em 5 faixas');

  console.log('\n11. Reajuste, cancelamento e auditoria');
  const rj = await call('POST', `/contracts/${ctBeta.id}/readjust`, { percentual: 10 });
  ok(rj.valor_recorrente === 3300, 'reajuste de 10% (3.000 → 3.300)');
  const futBeta = (await call('GET', `/transactions?contract_id=${ctBeta.id}&situacao=A_VENCER`)).items;
  ok(futBeta.every((t) => t.valor === 3300), 'títulos futuros reajustados');
  const rjA = await call('POST', `/contracts/${ctAlfa.id}/readjust`, { novo_valor: 6500 });
  ok(store.subscriptions[ctAlfa.asaas_subscription_id].value === 6500, 'reajuste propagado para a assinatura no Asaas');
  const canc = await call('POST', `/contracts/${ctBeta.id}/status`, { status: 'CANCELADO', motivo: 'Fim de ano letivo' });
  ok(canc.status === 'CANCELADO', 'contrato cancelado');
  const afterCancel = (await call('GET', `/transactions?contract_id=${ctBeta.id}&situacao=A_VENCER`)).items;
  ok(afterCancel.length === 0, 'títulos futuros cancelados');
  const db2 = await call('GET', '/reports/dashboard');
  ok(db2.assinaturas.churn_mrr === 3300 && db2.assinaturas.mrr === 6500, `churn do mês 3.300, MRR 6.500 (${db2.assinaturas.churn_mrr}/${db2.assinaturas.mrr})`);
  const audit = await call('GET', '/audit?limit=500');
  ok(audit.length > 30 && audit.some((a) => a.origem === 'PUBLICO' && a.acao === 'accept') && audit.some((a) => a.origem === 'WEBHOOK'), `auditoria registrou app, público e webhook (${audit.length})`);

  console.log('\n12. MCP (Streamable HTTP)');
  const key = await call('POST', '/api-keys', { nome: 'Claude do Matheus' });
  ok(key.chave.startsWith('fbk_') && key.mcp_url.endsWith('/api/biz/mcp'), 'chave de API criada');
  const rpc = async (method, params, id = 1, k = key.chave) => {
    const r = await fetch(`${API}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: `Bearer ${k}` }, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'teste', version: '1' } });
  ok(init.status === 200 && init.body.result?.serverInfo?.name === 'freedom-empresas' && init.body.result.instructions?.includes('Grupo Mercatta'), 'initialize ok com instruções');
  const tl = await rpc('tools/list', {}, 2);
  ok(tl.body?.result?.tools?.length >= 30, `tools/list expõe ${tl.body?.result?.tools?.length} ferramentas`, tl.body);
  const tcall = async (name, args) => { const r = await rpc('tools/call', { name, arguments: args }, 3); const c = r.body?.result; return { isError: c?.isError, data: c?.content?.[0]?.text?.startsWith('Erro') ? c.content[0].text : JSON.parse(c?.content?.[0]?.text || 'null') }; };
  const res1 = await tcall('resumo_executivo', {});
  ok(!res1.isError && res1.data.assinaturas.mrr === 6500, 'MCP resumo_executivo');
  const res2 = await tcall('margem_contratos', { contrato: 'Plano de crescimento' });
  ok(!res2.isError && res2.data.contratos.length === 1, 'MCP resolve contrato pelo nome');
  const res3 = await tcall('criar_conta_pagar', { descricao: 'Fotógrafo evento Alfa', valor: 900, vencimento: dia(28), contrato: 'Plano de crescimento', conta: 'Freelancers' });
  ok(!res3.isError && res3.data[0].contrato.includes('Plano') && res3.data[0].conta.startsWith('3.1.01'), 'MCP cria despesa vinculada ao contrato classificando pelo nome da conta', res3.data);
  const res4 = await tcall('criar_proposta', { titulo: 'Proposta via IA', prospect_nome: 'Fulano', prospect_empresa: 'Delta Ltda', itens: [{ produto: 'tráfego' }, { descricao: 'Consultoria', preco_unitario: 2000 }] });
  ok(!res4.isError && res4.data.total_recorrente_mensal === 3500 && res4.data.total_unico === 2000, 'MCP cria proposta com item do catálogo + item livre', res4.data);
  const res5 = await tcall('criar_cliente', { nome: 'Delta Um' });
  await tcall('criar_cliente', { nome: 'Delta Dois' });
  ok(!res5.isError, 'MCP cria cliente');
  const res6 = await tcall('listar_lancamentos', { cliente: 'Delta' });
  ok(res6.isError || String(res6.data).includes('Mais de um'), 'MCP pede desambiguação quando o nome é ambíguo', res6.data);
  const ro = await call('POST', '/api-keys', { nome: 'Leitura', escopo: 'LEITURA' });
  const tlRo = await rpc('tools/list', {}, 4, ro.chave);
  ok(tlRo.body.result.tools.every((t) => !t.name.startsWith('criar_')), `chave somente leitura não expõe escrita (${tlRo.body.result.tools.length} ferramentas)`);
  ok((await rpc('tools/list', {}, 5, 'fbk_invalida')).status === 401, 'chave inválida → 401');
  const auditMcp = await call('GET', '/audit?origem=MCP');
  ok(auditMcp.length >= 3, `ações do MCP auditadas (${auditMcp.length})`);

  console.log('\n13. Rotina diária');
  const job = await fetch(`${API}/jobs/daily`, { headers: { authorization: 'Bearer cron-test' } }).then((r) => r.json());
  ok(job.erros.length === 0, `rotina diária executada (${JSON.stringify(job)})`);

  console.log(`\n${failures ? `❌ ${failures} falha(s)` : '✅ Todos os testes passaram'}`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('ERRO FATAL', e); process.exit(1); });
