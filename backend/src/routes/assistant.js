const express = require('express');
const router = express.Router();
const { OpenAI } = require('openai');
const configService = require('../services/configService');

const SYSTEM_PROMPT = `Você é um Assistente de Inteligência Artificial Especialista em Vendas e Suporte do sistema financeiro Freedom.
Seu objetivo PRIMÁRIO e SEU MANTRA é: VENDER O SISTEMA.
Para isso, você deve tirar dúvidas, mostrar o valor do sistema, como ele ajuda famílias a organizarem suas finanças, caixinhas, cartões de crédito e metas.
Seja sempre muito educado, persuasivo e use técnicas de vendas.
Sempre que o usuário demonstrar interesse ou você resolver uma dúvida que comprove o valor do sistema, sugira fortemente que ele assine enviando o link dos planos: /planos
Diga sempre algo como "Que tal garantir a liberdade financeira da sua família hoje mesmo? Acesse a página de planos e assine o Freedom!"

Além disso, seu objetivo é CAPTURAR LEADS.
Sempre que possível, no meio da conversa, peça sutilmente o Nome, Email e WhatsApp do usuário para enviar "materiais exclusivos" ou "para que nossa equipe possa dar um atendimento premium".
Quando o usuário fornecer seus dados (pode ser o nome, email, ou whatsapp), você DEVE usar a ferramenta/função chamada 'capture_lead'. 
Sempre chame a ferramenta se os dados parecerem ser nome, telefone ou email.

Seja conciso, use emojis, e nunca perca o foco em conversão e suporte amigável.`;

router.post('/chat', async (req, res) => {
  const { messages } = req.body;
  
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages array is required' });
  }

  try {
    const openaiKey = await configService.get('OPENAI_API_KEY');
    if (!openaiKey) {
      return res.status(500).json({ error: 'OpenAI API Key não configurada no sistema.' });
    }

    const openai = new OpenAI({ apiKey: openaiKey });

    const tools = [
      {
        type: "function",
        function: {
          name: "capture_lead",
          description: "Captura os dados de contato do lead e envia para o CRM. Chame esta função APENAS quando o usuário fornecer seu nome, email e/ou telefone (whatsapp).",
          parameters: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Nome do usuário."
              },
              email: {
                type: "string",
                description: "Email do usuário."
              },
              whatsapp: {
                type: "string",
                description: "Telefone / WhatsApp do usuário."
              }
            },
            required: ["name"]
          }
        }
      }
    ];

    // Mapeia mensagens do frontend para a API
    const apiMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.map(m => ({
        role: m.role,
        content: m.content
      }))
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: apiMessages,
      tools: tools,
      tool_choice: 'auto'
    });

    const responseMessage = response.choices[0].message;

    // Se o modelo decidiu chamar uma função
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      for (const toolCall of responseMessage.tool_calls) {
        if (toolCall.function.name === 'capture_lead') {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            
            // Dispara webhook N8N
            await fetch('https://n8nwebhook.mercattatech.com.br/webhook/mercatta-freedom', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                source: 'AI_Assistant',
                name: args.name || '',
                email: args.email || '',
                whatsapp: args.whatsapp || '',
                timestamp: new Date().toISOString()
              })
            });
            console.log(`[AI Assistant] Lead enviado para Webhook N8N:`, args);
          } catch (err) {
            console.error(`[AI Assistant] Erro ao enviar Webhook:`, err.message);
          }
        }
      }
      
      // Envia uma segunda requisição para o OpenAI processar a resposta da tool call, ou devolve direto
      // Para manter a resposta rápida, vamos adicionar a chamada de função no array e gerar uma resposta
      apiMessages.push(responseMessage);
      
      for (const toolCall of responseMessage.tool_calls) {
        apiMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: '{"success": true, "message": "Dados enviados para o CRM com sucesso."}'
        });
      }

      const finalResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: apiMessages
      });

      return res.json({ role: 'assistant', content: finalResponse.choices[0].message.content });
    }

    // Resposta normal em texto
    return res.json({ role: 'assistant', content: responseMessage.content });

  } catch (error) {
    console.error('AI Assistant Error:', error);
    res.status(500).json({ error: 'Erro ao processar mensagem com a IA' });
  }
});

module.exports = router;
