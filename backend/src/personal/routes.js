// Router do módulo MCP Pessoal — montado em /api/personal
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const apiKeys = require('./apiKeys');
const { personalMcpHandler } = require('./server');

const r = express.Router();

const baseUrl = (req) => process.env.APP_URL || req.headers.origin || `${req.headers['x-forwarded-proto'] || req.protocol}://${req.get('host')}`;
const ah = (fn) => (req, res) => fn(req, res).catch((e) => {
  if (!e.status || e.status >= 500) console.error('[personal route]', e);
  res.status(e.status || 500).json({ message: e.message });
});

// Endpoint MCP (autenticação via token fpk_...)
r.all('/mcp', personalMcpHandler);

// Gestão dos tokens pelo usuário autenticado
r.get('/api-keys', authenticateToken, ah(async (req, res) => {
  const items = await apiKeys.list(req.user.id);
  res.json({ mcp_url: `${baseUrl(req)}/api/personal/mcp`, items });
}));

r.post('/api-keys', authenticateToken, ah(async (req, res) => {
  const created = await apiKeys.create(req.user, req.body || {});
  const mcpUrl = `${baseUrl(req)}/api/personal/mcp`;
  res.status(201).json({
    ...created,
    mcp_url: mcpUrl,
    mcp_url_com_token: `${mcpUrl}?token=${created.chave}`,
  });
}));

r.delete('/api-keys/:id', authenticateToken, ah(async (req, res) => {
  res.json(await apiKeys.revoke(req.user.id, req.params.id));
}));

module.exports = r;
