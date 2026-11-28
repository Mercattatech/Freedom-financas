// Servidor MCP remoto do módulo Pessoal / Familiar (Streamable HTTP, sem estado) — /api/personal/mcp
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { resolveApiKey, PERSONAL_KEY_PREFIX } = require('./apiKeys');
const { TOOLS, getUserFamilies } = require('./tools');

function buildPersonalServer(ctx, familias = []) {
  const nomes = familias.map((f) => f.nome_familia).join(', ') || 'nenhuma família cadastrada';
  const instructions = `Você está conectado ao Freedom Pessoal (finanças pessoais e familiares) de ${ctx.fullName}.
- Este MCP é EXCLUSIVO de finanças pessoais/familiares (não acessa dados empresariais).
- Famílias acessíveis: ${nomes}.
- Valores em reais (BRL); datas no formato AAAA-MM-DD; meses (competência) no formato AAAA-MM.
- Sempre informe na resposta o nome da família em que o lançamento ou consulta foi realizado.
- Use listar_familias quando precisar descobrir os nomes exatos das categorias ou cartões de crédito disponíveis.`;

  const server = new McpServer({ name: 'freedom-pessoal', version: '1.0.0' }, { instructions });

  for (const tool of TOOLS) {
    if (!tool.readOnly && ctx.escopo === 'LEITURA') continue;
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.schema,
        annotations: {
          readOnlyHint: !!tool.readOnly,
          destructiveHint: tool.name === 'excluir_lancamento',
        },
      },
      async (args) => {
        try {
          const result = await tool.handler(ctx, args || {});
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 1) }] };
        } catch (e) {
          return { isError: true, content: [{ type: 'text', text: `Erro: ${e.message}` }] };
        }
      },
    );
  }
  return server;
}

async function personalMcpHandler(req, res) {
  try {
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    const token = (req.headers.authorization || '').split(' ')[1]
      || req.headers['x-api-key']
      || req.query.token
      || req.query.apiKey
      || req.query.key;

    if (!token || !String(token).startsWith(PERSONAL_KEY_PREFIX)) {
      res.set('WWW-Authenticate', 'Bearer realm="freedom-pessoal"');
      return res.status(401).json({
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: 'Envie o token do Freedom Pessoal no cabeçalho Authorization: Bearer fpk_... ou parâmetro ?token=fpk_...',
        },
        id: null,
      });
    }

    const ctx = await resolveApiKey(String(token));
    const familias = await getUserFamilies(ctx);
    const server = buildPersonalServer(ctx, familias);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    if (!e.status || e.status >= 500) console.error('[personal mcp]', e);
    if (!res.headersSent) {
      res.status(e.status || 500).json({ jsonrpc: '2.0', error: { code: -32603, message: e.message }, id: null });
    }
  }
}

module.exports = { personalMcpHandler, buildPersonalServer };
