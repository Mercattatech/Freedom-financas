const prisma = require('../db');

// Registro de auditoria — essencial quando ações vêm de LLMs via MCP
async function audit(ctx, acao, entidade, entidade_id, resumo, dados) {
  try {
    await prisma.bizAuditLog.create({
      data: {
        company_id: ctx.companyId,
        user_id: ctx.userId || null,
        origem: ctx.origem || 'APP',
        acao,
        entidade,
        entidade_id: entidade_id || null,
        resumo: resumo || null,
        dados: dados === undefined ? undefined : JSON.parse(JSON.stringify(dados)),
      },
    });
  } catch (e) {
    console.error('[biz audit]', e.message);
  }
}

module.exports = { audit };
