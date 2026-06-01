const { OpenAI } = require('openai');
const configService = require('./configService');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class AIInterpreterService {
  async interpretMessage(text, context) {
    const apiKey = await configService.get('OPENAI_API_KEY');

    if (!apiKey) {
      console.error('OpenAI API Key not found in config or env');
      return { intent: 'unknown', user_question: 'Configuração de IA ausente.' };
    }

    // Carregar exemplos de treinamento personalizados do banco
    let trainingSection = '';
    try {
      const trainingExamples = await prisma.aITrainingExample.findMany({
        where: { ativo: true },
        orderBy: { created_date: 'asc' }
      });
      if (trainingExamples.length > 0) {
        const lines = trainingExamples.map(ex => {
          const dataStr = Object.entries(ex.expected_data || {})
            .filter(([, v]) => v !== null && v !== undefined)
            .map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ');
          const note = ex.notes ? ` // ${ex.notes}` : '';
          return `"${ex.input_message}" → ${ex.expected_intent}${dataStr ? ', ' + dataStr : ''}${note}`;
        }).join('\n');
        trainingSection = `\n==== EXEMPLOS DE TREINAMENTO PERSONALIZADOS (prioridade alta) ====\n${lines}`;
      }
    } catch (e) {
      console.warn('Não foi possível carregar exemplos de treinamento:', e.message);
    }

    const openai = new OpenAI({ apiKey });
    const {
      currentDate,
      userTimezone,
      creditCards = [],
      categories = [],
      lastSession = null
    } = context;

    const creditCardList = creditCards.map(cc => cc.nome).join(', ') || 'nenhum';
    const categoryList = categories.map(c => c.nome).join(', ') || 'nenhuma';
    const singleCard = creditCards.length === 1 ? creditCards[0].nome : null;

    const systemPrompt = `
Você é o assistente financeiro do app Freedom. Interprete mensagens de WhatsApp e retorne APENAS JSON válido.

==== REGRAS PRINCIPAIS ====
1. Retorne apenas JSON. Nunca texto livre.
2. Não invente dados. Se faltar informação obrigatória, coloque em missing_fields e gere user_question.
3. "sim", "ok", "pode", "confirma", "isso", "exato" → intent: "confirm_action"
4. "não", "cancela", "errado", "para" → intent: "reject_action"
5. Sempre inclua needs_confirmation: true antes de executar.
6. Seja conciso nas perguntas (máximo 1 pergunta por vez).

==== INTENTS E CAMPOS OBRIGATÓRIOS ====

create_expense (débito, PIX, dinheiro):
  OBRIGATÓRIO: amount, description, payment_method
  OPCIONAL: date (padrão: ${currentDate}), category
  ⚠️ NÃO EXISTE "conta bancária" neste sistema. Não pergunte sobre conta.
  Valores válidos para payment_method: PIX | DINHEIRO | DEBITO
  Infira automaticamente:
    "pix", "transferência" → PIX
    "dinheiro", "espécie" → DINHEIRO
    "débito", "debito" → DEBITO
  Se não informado: pergunte "Foi no PIX, débito ou dinheiro?"

create_credit_card_expense (cartão de crédito):
  OBRIGATÓRIO: amount, description, credit_card
  OPCIONAL: date (padrão: ${currentDate}), installments, category
  Cartões disponíveis: ${creditCardList}
  ${singleCard ? `Há apenas 1 cartão (${singleCard}) — use-o automaticamente sem perguntar.` : 'Se não informar o cartão, pergunte qual.'}

create_income (receita, salário, entrada):
  OBRIGATÓRIO: amount, description
  OPCIONAL: date (padrão: ${currentDate}), category

==== CONTEXTO ====
Categorias: ${categoryList}
Data atual: ${currentDate} | Timezone: ${userTimezone}
Sessão anterior: ${lastSession ? JSON.stringify(lastSession) : 'nenhuma'}

==== FORMATO DE SAÍDA ====
{
  "intent": "create_expense | create_income | create_credit_card_expense | confirm_action | reject_action | unknown",
  "confidence": 0.95,
  "data": {
    "amount": 100,
    "date": "${currentDate}",
    "description": "Mercado",
    "category": null,
    "payment_method": "PIX",
    "credit_card": null,
    "installments": null
  },
  "missing_fields": [],
  "needs_confirmation": true,
  "user_question": null,
  "summary_for_confirmation": "✅ Confirmar lançamento?\\n📝 Mercado\\n💰 R$ 100,00\\n📅 ${currentDate}\\n💳 PIX"
}

==== EXEMPLOS BASE ====
"gastei 50 no mercado no pix" → create_expense, amount=50, description="Mercado", payment_method="PIX", date=${currentDate}
"paguei 200 no nubank" → create_credit_card_expense, amount=200, credit_card="Nubank"
"recebi 3000 de salário" → create_income, amount=3000, description="Salário"
"gastei 80 de ifood" (sem forma de pagamento) → create_expense, missing_fields=["payment_method"], user_question="Foi no PIX, débito ou dinheiro?"
"sim" → confirm_action
"não cancela" → reject_action
${trainingSection}
`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0].message.content);
      if (result.needs_confirmation === undefined) result.needs_confirmation = true;
      return result;
    } catch (error) {
      console.error('Error in AI interpretation:', error);
      return {
        intent: 'unknown',
        confidence: 0,
        data: {},
        missing_fields: [],
        needs_confirmation: false,
        user_question: 'Desculpe, tive um problema técnico. Pode tentar novamente?'
      };
    }
  }
}

module.exports = new AIInterpreterService();
