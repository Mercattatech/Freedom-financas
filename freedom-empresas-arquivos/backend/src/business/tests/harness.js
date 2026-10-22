// Sobe: mock do Asaas (:4010) + API do módulo Empresas (:3000) para testes de integração.
// ATENÇÃO: use um banco de TESTE — o cenário apaga os dados das tabelas biz_* e "User".
process.env.JWT_SECRET ||= 'test-secret';
process.env.ASAAS_API_URL = 'http://127.0.0.1:4010/v3';
process.env.CRON_SECRET = 'cron-test';
const path = require('path');
const BACK = path.resolve(__dirname, '../../..');
const { PrismaClient } = require('@prisma/client');
// BIZ_TEST_ADAPTER=pg usa o driver adapter (Prisma 6+/7 sem engine nativa); padrão: cliente do projeto
if (process.env.BIZ_TEST_ADAPTER === 'pg') {
  const { PrismaPg } = require('@prisma/adapter-pg');
  global.__bizPrisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
} else {
  global.__bizPrisma = new PrismaClient();
}
const express = require('express');

// ── Mock Asaas ──
const store = { customers: {}, payments: {}, subscriptions: {}, calls: [] };
let seq = 1;
const mock = express();
mock.use(express.json());
mock.use((req, res, next) => { store.calls.push(`${req.method} ${req.path}`); if (!req.headers.access_token) return res.status(401).json({ errors: [{ description: 'sem token' }] }); next(); });
mock.post('/v3/customers', (req, res) => { const id = `cus_${seq++}`; store.customers[id] = { id, ...req.body }; res.json(store.customers[id]); });
mock.post('/v3/payments', (req, res) => { const id = `pay_${seq++}`; store.payments[id] = { id, status: 'PENDING', invoiceUrl: `https://sandbox.asaas.com/i/${id}`, bankSlipUrl: `https://sandbox.asaas.com/b/pdf/${id}`, ...req.body }; res.json(store.payments[id]); });
mock.get('/v3/payments/:id', (req, res) => res.json(store.payments[req.params.id]));
mock.put('/v3/payments/:id', (req, res) => { Object.assign(store.payments[req.params.id], req.body); res.json(store.payments[req.params.id]); });
mock.delete('/v3/payments/:id', (req, res) => { store.payments[req.params.id].status = 'DELETED'; res.json({ deleted: true, id: req.params.id }); });
mock.get('/v3/payments/:id/pixQrCode', (req, res) => res.json({ payload: `00020101PIX${req.params.id}`, encodedImage: 'x' }));
mock.post('/v3/payments/:id/receiveInCash', (req, res) => { store.payments[req.params.id].status = 'RECEIVED_IN_CASH'; res.json(store.payments[req.params.id]); });
mock.post('/v3/subscriptions', (req, res) => { const id = `sub_${seq++}`; store.subscriptions[id] = { id, status: 'ACTIVE', ...req.body }; res.json(store.subscriptions[id]); });
mock.post('/v3/subscriptions/:id', (req, res) => { Object.assign(store.subscriptions[req.params.id], req.body); res.json(store.subscriptions[req.params.id]); });
mock.delete('/v3/subscriptions/:id', (req, res) => { store.subscriptions[req.params.id].status = 'DELETED'; res.json({ deleted: true }); });
mock.get('/v3/finance/balance', (req, res) => res.json({ balance: 12345.67 }));
mock.get('/__store', (req, res) => res.json(store));

// ── App ──
const app = express();
app.use((req, res, next) => { res.set('Access-Control-Allow-Origin', '*'); res.set('Access-Control-Allow-Headers', '*'); res.set('Access-Control-Allow-Methods', '*'); if (req.method === 'OPTIONS') return res.end(); next(); });
app.use(express.json());
const jwtLib = require('jsonwebtoken');
app.get('/api/auth/me', (req, res) => {
  try { const u = jwtLib.verify((req.headers.authorization || '').split(' ')[1], process.env.JWT_SECRET); res.json({ id: u.id, email: u.email, name: 'Matheus', role: 'user' }); }
  catch { res.status(401).json({ message: 'token' }); }
});
const { createBizRouter } = require(path.join(BACK, 'src/business/routes'));
app.use('/api/biz', createBizRouter());

const ready = Promise.all([
  new Promise((r) => mock.listen(4010, r)),
  new Promise((r) => app.listen(3000, r)),
]).then(() => console.log('harness pronto: API :3000, mock Asaas :4010'));

module.exports = { ready, store, prisma: global.__bizPrisma };
if (require.main === module) ready;
