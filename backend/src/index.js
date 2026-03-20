const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 3000;

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

app.listen(port, () => {
  console.log(`🚀 Freedom Backend Server running on http://localhost:${port}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit();
});
