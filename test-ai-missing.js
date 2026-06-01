require('dotenv').config();
const { OpenAI } = require('openai');

async function test() {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const text = "Pix";
  const lastSession = {
    state: "awaiting_missing_info",
    intent: "create_expense",
    extracted_data: {
      amount: 80,
      description: "Ifood",
      payment_method: null,
      date: "2026-06-01"
    },
    missing_fields: ["payment_method"]
  };

  const systemPrompt = `
Você é o assistente financeiro do app Freedom. Interprete mensagens de WhatsApp e retorne APENAS JSON válido.

==== REGRAS PRINCIPAIS ====
1. Retorne apenas JSON. Nunca texto livre.
2. Não invente dados. Se faltar informação obrigatória, coloque em missing_fields e gere user_question.
3. "sim", "ok", "pode", "confirma", "isso", "exato" → intent: "confirm_action"
4. "não", "cancela", "errado", "para" → intent: "reject_action"
5. Sempre inclua needs_confirmation: true antes de executar.
6. Seja conciso nas perguntas (máximo 1 pergunta por vez).
7. SE A SESSÃO ANTERIOR ESTIVER AGUARDANDO INFORMAÇÃO (awaiting_missing_info): 
   A mensagem do usuário provavelmente é a resposta. Junte com os dados da sessão anterior, valide se ainda faltam campos e retorne a intenção original com os dados completos.

==== INTENTS E CAMPOS OBRIGATÓRIOS ====
create_expense (débito, PIX, dinheiro):
  OBRIGATÓRIO: amount, description, payment_method
  OPCIONAL: date (padrão: 2026-06-01), category
  Valores válidos para payment_method: PIX | DINHEIRO | DEBITO

==== CONTEXTO ====
Sessão anterior: ${JSON.stringify(lastSession)}

==== FORMATO DE SAÍDA ====
{
  "intent": "create_expense | confirm_action | reject_action | unknown",
  "data": { "amount": 80, "description": "Ifood", "payment_method": "PIX", "date": "2026-06-01" },
  "missing_fields": [],
  "needs_confirmation": true,
  "summary_for_confirmation": "✅ Confirmar lançamento?\\n📝 Ifood\\n💰 R$ 80,00\\n📅 2026-06-01\\n💳 PIX"
}
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text }
    ],
    response_format: { type: 'json_object' }
  });

  console.log(response.choices[0].message.content);
}

test().catch(console.error);
