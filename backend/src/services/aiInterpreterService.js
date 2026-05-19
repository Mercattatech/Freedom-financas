const { OpenAI } = require('openai');
const configService = require('./configService');

class AIInterpreterService {
  async interpretMessage(text, context) {
    const apiKey = await configService.get('OPENAI_API_KEY');
    
    if (!apiKey) {
      console.error('OpenAI API Key not found in config or env');
      return { intent: 'unknown', user_question: "Configuração de IA ausente." };
    }

    const openai = new OpenAI({ apiKey });
    const { 
      currentDate, 
      userTimezone, 
      accounts = [], 
      creditCards = [], 
      categories = [],
      lastSession = null
    } = context;

    const systemPrompt = `
Você é um interpretador financeiro. Sua função é transformar mensagens informais de WhatsApp em JSON estruturado para um sistema financeiro.

Você não deve conversar livremente com o usuário.
Você deve apenas retornar JSON válido.
Não invente dados.
Não crie valores ausentes.
Não escolha conta ou cartão se houver ambiguidade.
Use as listas fornecidas de contas, cartões e categorias para normalizar os dados.
Quando uma informação obrigatória estiver ausente, adicione o campo em missing_fields e gere uma pergunta objetiva em user_question.
Quando a mensagem indicar confirmação de uma ação pendente, retorne intent confirm_action.
Quando a mensagem indicar cancelamento ou rejeição, retorne intent reject_action.
Nunca autorize lançamento sem confirmação explícita do usuário.

Campos obrigatórios para despesa:
- amount
- date
- description
- payment_method
- account ou credit_card

Campos obrigatórios para receita:
- amount
- date
- description
- account

Campos obrigatórios para conta a pagar:
- amount
- description
- due_date

Campos obrigatórios para despesa de cartão:
- amount
- date
- description
- credit_card

Campos obrigatórios para investimento:
- investment_operation
- investment_asset
- date
- amount ou quantity/unit_price

Categorias disponíveis: ${categories.map(c => c.nome).join(', ')}
Contas/Bancos disponíveis: ${accounts.map(a => a.nome).join(', ')}
Cartões disponíveis: ${creditCards.map(cc => cc.nome).join(', ')}

Data atual: ${currentDate}
Timezone: ${userTimezone}

Contexto da Sessão Anterior:
${lastSession ? JSON.stringify(lastSession) : 'Nenhuma sessão ativa.'}

Formato de saída obrigatório:
{
  "intent": "create_expense | create_income | create_payable | create_credit_card_expense | create_investment_transaction | query_summary | confirm_action | reject_action | unknown",
  "confidence": 0.0,
  "data": {
    "amount": null,
    "date": null,
    "description": null,
    "category": null,
    "payment_method": null,
    "account": null,
    "credit_card": null,
    "installments": null,
    "due_date": null,
    "status": null,
    "investment_asset": null,
    "investment_operation": null,
    "quantity": null,
    "unit_price": null
  },
  "missing_fields": [],
  "needs_confirmation": true,
  "user_question": null,
  "summary_for_confirmation": null
}
`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text }
        ],
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0].message.content);
      return result;
    } catch (error) {
      console.error('Error in AI interpretation:', error);
      return {
        intent: 'unknown',
        confidence: 0,
        data: {},
        missing_fields: [],
        needs_confirmation: false,
        user_question: "Desculpe, tive um problema técnico ao processar sua mensagem. Pode tentar novamente em alguns instantes?"
      };
    }
  }
}

module.exports = new AIInterpreterService();
