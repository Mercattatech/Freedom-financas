// Servidor MCP remoto (Streamable HTTP, sem estado) — /api/biz/mcp
// Conecte no Claude (Configurações › Conectores › Adicionar conector personalizado) com a URL
// e o cabeçalho Authorization: Bearer <chave fbk_...> gerada em Configurações › Integrações IA.
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const prisma = require('../db');
const { TOOLS } = require('./tools');
const { can } = require('../lib/permissions');
const { serialize } = require('../lib/money');
const { contextFromApiKey, API_KEY_PREFIX } = require('../middleware/tenant');

const INSTRUCTIONS = `Você está conectado ao Freedom Empresas, ERP financeiro da empresa do usuário.
- Valores em reais (BRL); datas no formato AAAA-MM-DD; meses como AAAA-MM.
- Para perguntas gerais sobre a saúde do negócio, use resumo_executivo. Para lucratividade, use margem_contratos, margem_clientes e margem_agencia.
- Você pode informar clientes, contratos, fornecedores e produtos pelo nome; se houver ambiguidade, a ferramenta pede o id.
- Antes de ações de escrita relevantes (criar cobrança, cancelar contrato, reajustar), confirme com o usuário os valores e datas.
- Classifique lançamentos no plano de contas (cadastros_auxiliares) para a DRE e as margens ficarem corretas; despesas de um cliente específico devem ser vinculadas ao contrato.`;

function buildServer(ctx, empresaNome) {
  const server = new McpServer({ name: 'freedom-empresas', version: '1.0.0' }, { instructions: `${INSTRUCTIONS}\nEmpresa conectada: ${empresaNome}.` });
  for (const tool of TOOLS) {
    if (tool.perm && !can(ctx.papel, tool.perm)) continue; // só expõe o que a chave pode fazer
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.schema,
        annotations: { readOnlyHint: !tool.perm || tool.perm === 'relatorios:read', destructiveHint: /cancelar|status|reajustar/.test(tool.name) },
      },
      async (args) => {
        try {
          const result = await tool.handler(ctx, args || {});
          return { content: [{ type: 'text', text: JSON.stringify(serialize(result), null, 1) }] };
        } catch (e) {
          return { isError: true, content: [{ type: 'text', text: `Erro: ${e.message}` }] };
        }
      },
    );
  }
  return server;
}

async function mcpHandler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).set('Allow', 'POST').json({ jsonrpc: '2.0', error: { code: -32000, message: 'Use POST (servidor MCP sem estado)' }, id: null });
    }
    const token = (req.headers.authorization || '').split(' ')[1] || req.headers['x-api-key'];
    if (!token || !String(token).startsWith(API_KEY_PREFIX)) {
      res.set('WWW-Authenticate', 'Bearer realm="freedom-empresas"');
      return res.status(401).json({ jsonrpc: '2.0', error: { code: -32001, message: 'Envie a chave de API do Freedom Empresas no cabeçalho Authorization: Bearer fbk_...' }, id: null });
    }
    const ctx = await contextFromApiKey(String(token));
    const company = await prisma.bizCompany.findUnique({ where: { id: ctx.companyId }, select: { razao_social: true, nome_fantasia: true } });
    const server = buildServer(ctx, company?.nome_fantasia || company?.razao_social || '');
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { transport.close(); server.close(); });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    if (!e.status || e.status >= 500) console.error('[biz mcp]', e);
    if (!res.headersSent) res.status(e.status || 500).json({ jsonrpc: '2.0', error: { code: -32603, message: e.message }, id: null });
  }
}

module.exports = { mcpHandler, buildServer };
