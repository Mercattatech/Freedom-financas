const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 3000;

// ⚠️ WEBHOOK DEVE VIR ANTES DO express.json() (precisa de raw body)
app.use('/api/stripe/webhooks', express.raw({ type: 'application/json' }));
app.use('/api/webhooks/whatsapp', express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// Middleware
app.use(cors());
app.use(express.json());

// Basic health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Freedom API is running' });
});

const path = require('path');

// Make the uploads folder publicly accessible
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Import and use routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/families', require('./routes/families'));
app.use('/api/goals', require('./routes/goals'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/subcategories', require('./routes/subcategories'));
app.use('/api/functions', require('./routes/functions'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/stripe', require('./routes/stripe'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/webhooks/whatsapp', require('./routes/whatsapp'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/assistant', require('./routes/assistant'));

// Módulo Freedom Empresas (financeiro empresarial multiempresa + Asaas + MCP)
// Precisa vir antes do router genérico, que captura /api/:entity
const { createBizRouter } = require('./business/routes');
app.use('/api/biz', createBizRouter());

// Catch-all generic routes for other entities (FinancialMonths, Incomes, etc)
const genericRouter = require('./routes/generic');
app.use('/api', genericRouter());

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ status: 500, message: err.message || 'Internal Server Error' });
});

// Server do Frontend Estático (React/Vite) para a versão unificada da KingHost
const fs = require('fs');
const frontendPath = path.join(__dirname, '../public');
if (fs.existsSync(frontendPath)) {
  console.log('Servindo arquivos estáticos do frontend...');
  app.use(express.static(frontendPath));

  // Catch-all route to serve a aplicação React
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return res.status(404).json({ error: 'Endpoint não encontrado' });
    }
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

if (require.main === module) {
  // Inicia cron de inadimplência
  const { startDelinquencyCron } = require('./jobs/delinquencyCron');
  startDelinquencyCron();

  // Rotina diária do módulo Empresas (títulos de contratos e expiração de propostas)
  try {
    const cron = require('node-cron');
    const { runDaily } = require('./business/jobs/daily');
    cron.schedule('15 6 * * *', () => runDaily().then((r) => console.log('[biz] rotina diária', r)).catch(console.error), { timezone: 'America/Sao_Paulo' });
  } catch (e) {
    console.error('[biz] cron não iniciado:', e.message);
  }

  app.listen(port, () => {
    console.log(`🚀 Freedom Backend Server running on http://localhost:${port}`);
  });
}

module.exports = app;

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit();
});
