// Bridge de Inteligência Artificial para Claude e ChatGPT (OpenAPI 3.0 + Executor)
// Freedom Empresas — https://freedomfinancas.com.br
const { TOOLS } = require('../mcp/tools');
const { audit } = require('../lib/audit');
const { can } = require('../lib/permissions');
const { serialize } = require('../lib/money');
const { badRequest, notFound } = require('../lib/errors');
const reports = require('./reports');
const transactions = require('./transactions');
const { today, startOfMonth, endOfMonth, addDays, ym, ymd } = require('../lib/dates');

/**
 * Executa uma ferramenta do MCP em nome da empresa autenticada.
 */
async function executeTool(ctx, toolName, args = {}) {
  const tool = TOOLS.find((t) => t.name === toolName);
  if (!tool) throw notFound(`Ferramenta de IA "${toolName}"`);
  if (tool.perm && !can(ctx.papel, tool.perm)) {
    throw badRequest(`Sua chave de acesso (${ctx.papel}) não tem permissão para a ferramenta "${toolName}"`);
  }
  const result = await tool.handler(ctx, args);
  await audit(ctx, 'execute', 'ai_tool', null, `Executou ferramenta de IA "${toolName}"`, { tool: toolName, args }).catch(() => {});
  return serialize(result);
}

/**
 * Resumo financeiro consolidado formatado para consumo por IA (ChatGPT / Claude).
 */
async function getAiDashboard(ctx, { periodo = 'mes', de, ate } = {}) {
  const hoje = today();
  let fromDate = null;
  let toDate = null;

  switch (String(periodo).toLowerCase()) {
    case 'hoje':
    case 'dia':
      fromDate = hoje;
      toDate = hoje;
      break;
    case 'semana': {
      const d = new Date(hoje);
      const day = d.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + diffToMonday);
      fromDate = new Date(d);
      const endW = new Date(d);
      endW.setDate(endW.getDate() + 6);
      toDate = endW;
      break;
    }
    case '15d':
      fromDate = addDays(hoje, -14);
      toDate = hoje;
      break;
    case '30d':
      fromDate = addDays(hoje, -29);
      toDate = hoje;
      break;
    case 'personalizado':
      fromDate = de ? new Date(de) : addDays(hoje, -30);
      toDate = ate ? new Date(ate) : hoje;
      break;
    case 'mes':
    default:
      fromDate = startOfMonth(hoje);
      toDate = endOfMonth(hoje);
      break;
  }

  const [recList, despList, aging, cobrancas] = await Promise.all([
    transactions.list(ctx, { tipo: 'RECEITA', from: ymd(fromDate), to: ymd(toDate) }),
    transactions.list(ctx, { tipo: 'DESPESA', from: ymd(fromDate), to: ymd(toDate) }),
    reports.aging(ctx, { tipo: 'RECEITA' }).catch(() => null),
    reports.situacaoCobrancas(ctx, { ref: ym(fromDate), periodo: '30d' }).catch(() => null),
  ]);

  return {
    empresa: ctx.companyName || 'Empresa conectada',
    periodo: {
      tipo: periodo,
      de: ymd(fromDate),
      ate: ymd(toDate),
    },
    receitas: {
      total: recList.resumo.total,
      recebido: recList.resumo.pago,
      em_aberto: recList.resumo.em_aberto,
      vencido: recList.resumo.vencido,
      quantidade: recList.resumo.quantidade,
      taxa_liquidacao_pct: recList.resumo.total > 0 ? Number(((recList.resumo.pago / recList.resumo.total) * 100).toFixed(1)) : 0,
    },
    despesas: {
      total: despList.resumo.total,
      pago: despList.resumo.pago,
      em_aberto: despList.resumo.em_aberto,
      vencido: despList.resumo.vencido,
      quantidade: despList.resumo.quantidade,
    },
    saldo_periodo: Number((recList.resumo.pago - despList.resumo.pago).toFixed(2)),
    inadimplencia: {
      total_vencido: recList.resumo.vencido,
      aging_por_faixa: aging?.faixas || {},
    },
    asaas: cobrancas?.totais || null,
  };
}

/**
 * Gera a especificação OpenAPI 3.0.3 para criação instantânea de Custom GPTs no ChatGPT.
 */
function generateOpenApiSpec(baseUrl = 'https://app.freedomfinancas.com.br') {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Freedom Empresas - AI Financial Agent',
      version: '1.0.0',
      description: 'API corporativa para operar o Freedom Empresas via ChatGPT e Claude: lançamentos financeiros, contas a pagar e receber, assinaturas e cobranças no Asaas, contratos, clientes e dashboards analíticos.',
    },
    servers: [
      {
        url: baseUrl,
        description: 'Servidor da API Freedom Empresas',
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'Token Empresarial (fbk_...)',
          description: 'Insira sua Chave de IA do Freedom Empresas gerada em Configurações > Integrações IA.',
        },
      },
    },
    security: [{ ApiKeyAuth: [] }],
    paths: {
      '/api/biz/ai/dashboard': {
        get: {
          summary: 'Dashboard financeiro consolidado',
          description: 'Consulta métricas do período: receitas, despesas, valores recebidos, saldo, vencidos, taxas e inadimplência.',
          operationId: 'getFinancialDashboard',
          parameters: [
            {
              name: 'periodo',
              in: 'query',
              required: false,
              schema: { type: 'string', enum: ['hoje', 'semana', '15d', '30d', 'mes', 'personalizado'], default: 'mes' },
              description: 'Período desejado para análise',
            },
            {
              name: 'de',
              in: 'query',
              required: false,
              schema: { type: 'string', format: 'date' },
              description: 'Data de início (AAAA-MM-DD) se período for personalizado',
            },
            {
              name: 'ate',
              in: 'query',
              required: false,
              schema: { type: 'string', format: 'date' },
              description: 'Data de término (AAAA-MM-DD) se período for personalizado',
            },
          ],
          responses: {
            '200': { description: 'Resumo financeiro retornado com sucesso' },
            '401': { description: 'Token de IA inválido' },
            '403': { description: 'Módulo de IA não contratado na empresa' },
          },
        },
      },
      '/api/biz/ai/receber': {
        post: {
          summary: 'Criar conta a receber',
          description: 'Lança uma nova conta a receber, opcionalmente com parcelamento, repetição mensal e emissão automática de fatura no Asaas (com link de pagamento, boleto e PIX).',
          operationId: 'createContaReceber',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['descricao', 'valor', 'vencimento'],
                  properties: {
                    descricao: { type: 'string', description: 'Descrição da receita ou serviço prestado' },
                    valor: { type: 'number', description: 'Valor total em BRL' },
                    vencimento: { type: 'string', format: 'date', description: 'Vencimento inicial (AAAA-MM-DD)' },
                    cliente: { type: 'string', description: 'Nome ou razão do cliente' },
                    cliente_id: { type: 'string', description: 'ID do cliente cadastrado' },
                    cobrar_asaas: { type: 'boolean', description: 'Gerar cobrança no Asaas com link de pagamento' },
                    forma_pagamento: { type: 'string', enum: ['BOLETO', 'PIX', 'CARTAO', 'UNDEFINED'] },
                    parcelas: { type: 'integer', description: 'Número de parcelas (se parcelado)' },
                    repetir: { type: 'integer', description: 'Número de repetições mensais' },
                    observacoes: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: { '201': { description: 'Conta(s) a receber criada(s) com sucesso' } },
        },
      },
      '/api/biz/ai/pagar': {
        post: {
          summary: 'Criar conta a pagar',
          description: 'Lança uma conta a pagar para fornecedor, custo direto ou despesa operacional.',
          operationId: 'createContaPagar',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['descricao', 'valor', 'vencimento'],
                  properties: {
                    descricao: { type: 'string' },
                    valor: { type: 'number' },
                    vencimento: { type: 'string', format: 'date' },
                    fornecedor: { type: 'string', description: 'Nome do fornecedor' },
                    fornecedor_id: { type: 'string' },
                    parcelas: { type: 'integer' },
                    repetir: { type: 'integer' },
                    ja_pago: { type: 'boolean' },
                    observacoes: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: { '201': { description: 'Conta a pagar criada com sucesso' } },
        },
      },
      '/api/biz/ai/assinatura-asaas': {
        post: {
          summary: 'Criar assinatura recorrente no Asaas',
          description: 'Cria uma assinatura recorrente no Asaas diretamente. Cadastra o cliente se necessário com CPF/CNPJ, gera o contrato corporativo e disponibiliza o link de pagamento da primeira cobrança.',
          operationId: 'createAsaasSubscription',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['valor'],
                  properties: {
                    cliente_id: { type: 'string', description: 'ID do cliente cadastrado' },
                    cliente: { type: 'string', description: 'Nome do cliente existente' },
                    novo_cliente: {
                      type: 'object',
                      description: 'Dados para cadastrar novo cliente caso não exista',
                      properties: {
                        nome: { type: 'string' },
                        cpf_cnpj: { type: 'string', description: 'CPF ou CNPJ obrigatório para o Asaas' },
                        email: { type: 'string' },
                        celular: { type: 'string' },
                      },
                    },
                    valor: { type: 'number', description: 'Valor por ciclo' },
                    periodicidade: {
                      type: 'string',
                      enum: ['SEMANAL', 'QUINZENAL', 'MENSAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL'],
                      default: 'MENSAL',
                    },
                    vencimento: { type: 'string', format: 'date', description: 'Primeiro vencimento (AAAA-MM-DD)' },
                    descricao: { type: 'string', description: 'Descrição da assinatura ou serviço' },
                  },
                },
              },
            },
          },
          responses: { '201': { description: 'Assinatura criada e sincronizada com sucesso' } },
        },
      },
      '/api/biz/ai/sincronizar-asaas': {
        post: {
          summary: 'Sincronizar cobrança com Asaas',
          description: 'Consulta o status de um lançamento diretamente no Asaas para atualizar se foi pago, obter comprovante e baixa automática.',
          operationId: 'syncAsaasPayment',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['lancamento_id'],
                  properties: {
                    lancamento_id: { type: 'string', description: 'ID do lançamento no Freedom' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Lançamento sincronizado' } },
        },
      },
      '/api/biz/ai/gerar-link': {
        post: {
          summary: 'Gerar link de pagamento Asaas para conta existente',
          description: 'Gera cobrança no Asaas com fatura, PIX Copia e Cola e boleto para uma conta a receber em aberto.',
          operationId: 'generatePaymentLink',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['lancamento_id'],
                  properties: {
                    lancamento_id: { type: 'string' },
                    forma_pagamento: { type: 'string', enum: ['BOLETO', 'PIX', 'CARTAO', 'UNDEFINED'] },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Link e código PIX gerados' } },
        },
      },
      '/api/biz/ai/baixar': {
        post: {
          summary: 'Registrar pagamento ou recebimento (dar baixa)',
          description: 'Registra a liquidação total ou parcial de um lançamento financeiro.',
          operationId: 'payTransaction',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['lancamento_id'],
                  properties: {
                    lancamento_id: { type: 'string' },
                    valor: { type: 'number', description: 'Valor pago (opcional, padrão: saldo total)' },
                    data_pagamento: { type: 'string', format: 'date' },
                    juros_multa: { type: 'number' },
                    desconto: { type: 'number' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Baixa efetuada com sucesso' } },
        },
      },
      '/api/biz/ai/execute': {
        post: {
          summary: 'Executar qualquer ferramenta avançada do sistema',
          description: 'Executa genericamente qualquer uma das ferramentas do catálogo MCP do Freedom Empresas (DRE, contratos, clientes, propostas, estoque, etc.).',
          operationId: 'executeAiTool',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['tool'],
                  properties: {
                    tool: { type: 'string', description: 'Nome da ferramenta' },
                    args: { type: 'object', description: 'Parâmetros da ferramenta' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Resultado da execução' } },
        },
      },
    },
  };
}

module.exports = {
  executeTool,
  getAiDashboard,
  generateOpenApiSpec,
};
