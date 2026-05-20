const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const whatsappService = require('../services/whatsappService');
const aiInterpreter = require('../services/aiInterpreterService');
const { triggerRecalculo } = require('../services/creditCardBill');
const axios = require('axios');
const { OpenAI } = require('openai');
const configService = require('../services/configService');

// GET /api/webhooks/whatsapp - Verificação do Webhook
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('WEBHOOK_VERIFIED');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// POST /api/webhooks/whatsapp - Recebimento de mensagens
router.post('/', async (req, res) => {
  const body = req.body;

  // Validar se é um evento de mensagem do WhatsApp
  if (!body.object || !body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
    return res.sendStatus(200); // Responder 200 para a Meta não reenviar
  }

  const message = body.entry[0].changes[0].value.messages[0];
  const contact = body.entry[0].changes[0].value.contacts?.[0];
  const phone = message.from;
  const messageId = message.id;

  // 1. Aceita texto e áudio; ignora outros tipos
  if (!['text', 'audio'].includes(message.type)) {
    return res.sendStatus(200);
  }

  let messageText = message.text?.body || null;

  if (message.type === 'audio') {
    try {
      messageText = await transcribeAudio(message.audio.id);
    } catch (err) {
      console.error('Whisper transcription error:', err.message);
      await whatsappService.sendTextMessage(phone, '🎙️ Não consegui entender o áudio. Pode tentar enviar uma mensagem de texto?');
      return res.sendStatus(200);
    }
  }

  if (!messageText) return res.sendStatus(200);

  try {
    // 2. Proteção contra duplicidade
    const existingMessage = await prisma.whatsappMessage.findUnique({
      where: { meta_message_id: messageId }
    });
    if (existingMessage) return res.sendStatus(200);

    // 3. Identificar usuário pelo telefone
    // Nota: O telefone da Meta vem no formato 5511999999999. 
    // Pode ser necessário normalizar dependendo de como está salvo no banco.
    const user = await prisma.user.findFirst({
      where: { 
        OR: [
          { whatsapp_phone: phone },
          { whatsapp_phone: phone.replace(/^55/, '') } // Tenta sem o DDI 55
        ]
      },
      include: {
        families: { take: 1 } // Pega a primeira família por padrão
      }
    });

    if (!user) {
      await whatsappService.sendTextMessage(phone, "Não encontrei seu WhatsApp vinculado a uma conta do sistema. Acesse o sistema e vincule este número antes de usar os lançamentos por WhatsApp.");
      return res.sendStatus(200);
    }

    if (user.disabled) {
      await whatsappService.sendTextMessage(phone, "Sua conta está desativada. Entre em contato com o suporte.");
      return res.sendStatus(200);
    }

    // Registrar mensagem recebida
    await prisma.whatsappMessage.create({
      data: {
        user_id: user.id,
        phone: phone,
        meta_message_id: messageId,
        direction: 'incoming',
        message_type: 'text',
        message_text: messageText,
        raw_payload: body,
        status: 'received'
      }
    });

    // 4. Buscar ou Criar Sessão Ativa (expira em 30 min)
    let session = await prisma.whatsappSession.findFirst({
      where: {
        user_id: user.id,
        phone: phone,
        state: { not: 'completed' },
        expires_at: { gt: new Date() }
      },
      orderBy: { created_at: 'desc' }
    });

    // 5. Preparar contexto para a IA
    const family = user.families[0];
    if (!family) {
      await whatsappService.sendTextMessage(phone, "Você ainda não possui uma Família cadastrada no sistema. Crie uma família primeiro.");
      return res.sendStatus(200);
    }

    const [categories, accounts, creditCards] = await Promise.all([
      prisma.category.findMany({ where: { family_id: family.id, ativo: true } }),
      // No schema atual, 'accounts' parece ser implícito ou vir de algum lugar. 
      // Vou buscar categorias do tipo RECEITA como "Contas" se necessário, 
      // ou apenas passar o que temos.
      prisma.category.findMany({ where: { family_id: family.id, tipo: 'RECEITA' } }),
      prisma.creditCard.findMany({ where: { family_id: family.id, ativo: true } })
    ]);

    const interpretationContext = {
      currentDate: new Date().toISOString().split('T')[0],
      userTimezone: 'America/Sao_Paulo', // Poderia vir do User futuramente
      categories,
      accounts,
      creditCards,
      lastSession: session ? {
        state: session.state,
        intent: session.intent,
        extracted_data: session.extracted_data,
        pending_action: session.pending_action
      } : null
    };

    // 6. Chamar IA
    const aiResult = await aiInterpreter.interpretMessage(messageText, interpretationContext);

    // 7. Processar Intent
    await handleIntent(aiResult, user, phone, session, family);

    return res.sendStatus(200);
  } catch (error) {
    console.error('Error processing WhatsApp webhook:', error);
    await whatsappService.sendTextMessage(phone, "Ocorreu um erro ao processar sua mensagem. Tente novamente mais tarde.");
    return res.sendStatus(200);
  }
});

async function transcribeAudio(mediaId) {
  const accessToken = await configService.get('WHATSAPP_ACCESS_TOKEN');
  const apiVersion = await configService.get('WHATSAPP_API_VERSION', 'v21.0');

  // 1. Obtém a URL de download do arquivo
  const mediaRes = await axios.get(
    `https://graph.facebook.com/${apiVersion}/${mediaId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const mediaUrl = mediaRes.data.url;

  // 2. Baixa o arquivo de áudio como buffer
  const audioRes = await axios.get(mediaUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
    responseType: 'arraybuffer'
  });

  // 3. Transcreve com OpenAI Whisper
  const openaiKey = await configService.get('OPENAI_API_KEY');
  const openai = new OpenAI({ apiKey: openaiKey });
  const buffer = Buffer.from(audioRes.data);
  const file = new File([buffer], 'audio.ogg', { type: 'audio/ogg' });

  const transcription = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    language: 'pt'
  });

  return transcription.text;
}

async function handleIntent(aiResult, user, phone, session, family) {
  const { intent, data, missing_fields, needs_confirmation, user_question, summary_for_confirmation } = aiResult;

  // Se a intenção for confirm_action ou reject_action, precisamos de uma sessão ativa com ação pendente
  if ((intent === 'confirm_action' || intent === 'reject_action') && session?.pending_action) {
    if (intent === 'confirm_action') {
      return await executePendingAction(session, user, phone, family);
    } else {
      await prisma.whatsappSession.update({
        where: { id: session.id },
        data: { state: 'cancelled', updated_at: new Date() }
      });
      return await whatsappService.sendTextMessage(phone, "Tudo bem, lançamento cancelado.");
    }
  }

  // Se houver campos faltando
  if (missing_fields && missing_fields.length > 0) {
    if (session) {
      await prisma.whatsappSession.update({
        where: { id: session.id },
        data: {
          state: 'awaiting_missing_info',
          intent: intent,
          extracted_data: { ...(session.extracted_data || {}), ...data },
          missing_fields: missing_fields,
          updated_at: new Date()
        }
      });
    } else {
      await prisma.whatsappSession.create({
        data: {
          user_id: user.id,
          phone: phone,
          state: 'awaiting_missing_info',
          intent: intent,
          extracted_data: data,
          missing_fields: missing_fields,
          expires_at: new Date(Date.now() + 30 * 60000)
        }
      });
    }
    return await whatsappService.sendTextMessage(phone, user_question || "Pode me informar o que falta?");
  }

  // Se precisar de confirmação
  if (needs_confirmation && intent !== 'unknown') {
    const sessionData = {
      user_id: user.id,
      phone: phone,
      state: 'awaiting_confirmation',
      intent: intent,
      extracted_data: data,
      pending_action: { intent, data },
      expires_at: new Date(Date.now() + 30 * 60000)
    };

    if (session) {
      await prisma.whatsappSession.update({
        where: { id: session.id },
        data: sessionData
      });
    } else {
      await prisma.whatsappSession.create({ data: sessionData });
    }

    return await whatsappService.sendTextMessage(phone, summary_for_confirmation || `Identifiquei um lançamento de ${intent}. Confirmar?`);
  }

  // Se não entendeu
  if (intent === 'unknown') {
    return await whatsappService.sendTextMessage(phone, user_question || "Não consegui entender sua solicitação. Pode reformular?");
  }

  // Se chegou aqui e não precisa de confirmação (raro pela regra do prompt), executa direto ou pede confirmação
  return await whatsappService.sendTextMessage(phone, "Entendi sua mensagem, mas por segurança, poderia confirmar o lançamento?");
}

async function executePendingAction(session, user, phone, family) {
  const { intent, data } = session.pending_action;
  
  try {
    // 1. Resolver Mês Financeiro (competência)
    const competencia = (data.date || new Date().toISOString()).substring(0, 7); // YYYY-MM
    let financialMonth = await prisma.financialMonth.findUnique({
      where: { family_id_competencia: { family_id: family.id, competencia } }
    });

    if (!financialMonth) {
      financialMonth = await prisma.financialMonth.create({
        data: {
          family_id: family.id,
          competencia: competencia,
          status: 'ABERTO'
        }
      });
    }

    // 2. Criar registro no banco conforme intent
    let record;
    if (intent === 'create_expense' || intent === 'create_credit_card_expense') {
      // Tenta encontrar a categoria pelo nome
      let categoryId = null;
      if (data.category) {
        const cat = await prisma.category.findFirst({
          where: { family_id: family.id, nome: { contains: data.category, mode: 'insensitive' } }
        });
        categoryId = cat?.id;
      }

      // Tenta encontrar o cartão pelo nome
      let creditCardId = null;
      if (data.credit_card) {
        const cc = await prisma.creditCard.findFirst({
          where: { family_id: family.id, nome: { contains: data.credit_card, mode: 'insensitive' } }
        });
        creditCardId = cc?.id;
      }

      record = await prisma.expense.create({
        data: {
          descricao: data.description || 'Lançamento WhatsApp',
          valor: parseFloat(data.amount),
          data: data.date || new Date().toISOString().split('T')[0],
          forma_pagamento: data.payment_method || (creditCardId ? 'CARTAO_CREDITO' : 'PIX'),
          month_id: financialMonth.id,
          family_id: family.id,
          category_id: categoryId,
          credit_card_id: creditCardId
        }
      });

      // Se for cartão, recalcula fatura
      if (creditCardId) {
        triggerRecalculo(record, family.id).catch(console.error);
      }

    } else if (intent === 'create_income') {
      let categoryId = null;
      if (data.category) {
        const cat = await prisma.category.findFirst({
          where: { family_id: family.id, nome: { contains: data.category, mode: 'insensitive' } }
        });
        categoryId = cat?.id;
      }

      record = await prisma.income.create({
        data: {
          descricao: data.description || 'Receita WhatsApp',
          valor: parseFloat(data.amount),
          data_recebimento: data.date || new Date().toISOString().split('T')[0],
          month_id: financialMonth.id,
          family_id: family.id,
          category_id: categoryId
        }
      });
    }
    // TODO: Implementar outros intents (payable, investment)

    // 3. Registrar Ação Financeira
    await prisma.whatsappFinancialAction.create({
      data: {
        user_id: user.id,
        phone: phone,
        session_id: session.id,
        action_type: intent,
        extracted_data: data,
        confirmation_status: 'confirmed',
        related_record_type: intent.includes('expense') ? 'Expense' : 'Income',
        related_record_id: record.id,
        confirmed_at: new Date()
      }
    });

    // 4. Finalizar Sessão
    await prisma.whatsappSession.update({
      where: { id: session.id },
      data: { state: 'completed', updated_at: new Date() }
    });

    await whatsappService.sendTextMessage(phone, "✅ Lançamento criado com sucesso!");

  } catch (error) {
    console.error('Error executing financial action:', error);
    await whatsappService.sendTextMessage(phone, "❌ Erro ao criar o lançamento. Por favor, verifique no sistema.");
  }
}

module.exports = router;
