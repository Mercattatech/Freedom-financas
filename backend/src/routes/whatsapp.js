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

  // 1. Aceita texto, áudio e imagem; ignora outros tipos
  if (!['text', 'audio', 'image'].includes(message.type)) {
    return res.sendStatus(200);
  }

  let messageText = message.text?.body || null;
  let base64Image = null;
  let mimeType = null;

  if (message.type === 'audio') {
    try {
      messageText = await transcribeAudio(message.audio.id);
    } catch (err) {
      console.error('Whisper transcription error:', err.message);
      await whatsappService.sendTextMessage(phone, '🎙️ Não consegui entender o áudio. Pode tentar enviar uma mensagem de texto?');
      return res.sendStatus(200);
    }
  } else if (message.type === 'image') {
    try {
      messageText = message.image.caption || null;
      const mediaData = await downloadMedia(message.image.id);
      base64Image = mediaData.buffer.toString('base64');
      mimeType = mediaData.mimeType;
    } catch (err) {
      console.error('Image download error:', err.message);
      await whatsappService.sendTextMessage(phone, '🖼️ Não consegui baixar a imagem. Tente novamente ou digite a mensagem.');
      return res.sendStatus(200);
    }
  }

  if (!messageText && !base64Image) return res.sendStatus(200);

  try {
    // 2. Proteção contra duplicidade
    const existingMessage = await prisma.whatsappMessage.findUnique({
      where: { meta_message_id: messageId }
    });
    if (existingMessage) return res.sendStatus(200);

    // 3. Identificar usuário pelo telefone
    let user = await prisma.user.findFirst({
      where: { 
        OR: [
          { whatsapp_phone: phone },
          { whatsapp_phone: phone.replace(/^55/, '') } // Tenta sem o DDI 55
        ]
      }
    });

    if (!user) {
      const allowedPhone = await prisma.whatsappAllowedPhone.findFirst({
        where: {
          OR: [
            { phone: phone },
            { phone: phone.replace(/^55/, '') }
          ]
        },
        include: { user: true }
      });
      if (allowedPhone) {
        user = allowedPhone.user;
      }
    }

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

    // Verificar se é a primeira mensagem do usuário na plataforma
    const previousMessagesCount = await prisma.whatsappMessage.count({
      where: { phone: phone, direction: 'incoming' }
    });

    if (previousMessagesCount === 1) { // 1 pois acabou de registrar a atual acima
      const welcomeMsg = `👋 *Olá! Seja bem-vindo(a) ao seu assistente da Freedom!* \n\n` +
        `Estou aqui para organizar sua vida financeira e te ajudar no dia a dia. Veja o que você pode me pedir:\n\n` +
        `💸 *Lançamentos:* "Gastei 50 no mercado no pix", "Recebi 3000 de salário"\n` +
        `📊 *Relatórios e Listagens:* "Resumo de hoje", "Liste os gastos de ontem"\n` +
        `✏️ *Editar:* (Após listar) "Altere o lançamento 1 para boleto"\n` +
        `📅 *Agendamentos:* "Marque uma reunião amanhã às 15h"\n` +
        `💬 *E muito mais:* Receitas fitness, dicas de filmes, clima, ações e futebol!\n\n` +
        `Você pode me mandar texto, áudio ou até foto de comprovantes! Como posso te ajudar hoje?`;
      await whatsappService.sendTextMessage(phone, welcomeMsg);
    }

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

    // 5. Verificar se quer mudar de família
    const wantsFamilyChange = /mudar fam[ií]lia|trocar fam[ií]lia|change family/i.test(messageText);
    if (wantsFamilyChange && user.whatsapp_default_family_id) {
      await prisma.user.update({ where: { id: user.id }, data: { whatsapp_default_family_id: null } });
      // Invalidar sessão atual
      if (session) await prisma.whatsappSession.update({ where: { id: session.id }, data: { state: 'cancelled', updated_at: new Date() } });
      session = null;
    }

    // 6. Buscar famílias do usuário
    const userFamilies = await prisma.family.findMany({
      where: { created_by: user.email },
      include: { _count: { select: { categories: true } } },
      orderBy: { created_date: 'asc' }
    });

    if (userFamilies.length === 0) {
      await whatsappService.sendTextMessage(phone, "Você ainda não possui uma Família cadastrada no sistema. Crie uma família primeiro.");
      return res.sendStatus(200);
    }

    // 7. Processar seleção de família se estiver em estado pendente
    if (session?.state === 'awaiting_family_selection') {
      const text = messageText.trim();
      const storedFamilies = session.extracted_data?.families || [];
      let selectedFamily = null;

      // Tenta por número ("1", "2", ...)
      const num = parseInt(text);
      if (!isNaN(num) && num >= 1 && num <= storedFamilies.length) {
        selectedFamily = storedFamilies[num - 1];
      } else {
        // Tenta por nome (parcial)
        selectedFamily = storedFamilies.find(f =>
          f.nome_familia.toLowerCase().includes(text.toLowerCase())
        );
      }

      if (!selectedFamily) {
        const opts = storedFamilies.map((f, i) => `${i + 1}⃣ ${f.nome_familia}`).join('\n');
        await whatsappService.sendTextMessage(phone, `Não entendi. Responda com o número ou nome da família:\n${opts}`);
        return res.sendStatus(200);
      }

      // Salvar como padrão permanente
      await prisma.user.update({
        where: { id: user.id },
        data: { whatsapp_default_family_id: selectedFamily.id }
      });

      // Atualizar sessão com família escolhida e continuar fluxo normal
      const pendingMessage = session.extracted_data?.pending_message;
      await prisma.whatsappSession.update({
        where: { id: session.id },
        data: { state: 'new', extracted_data: { family_id: selectedFamily.id }, updated_at: new Date() }
      });
      session = await prisma.whatsappSession.findUnique({ where: { id: session.id } });

      const confirmMsg = `✅ Família *${selectedFamily.nome_familia}* selecionada! Vou lembrar para as próximas vezes.`;
      if (!pendingMessage) {
        await whatsappService.sendTextMessage(phone, confirmMsg + '\n\nAgora pode enviar seu lançamento!');
        return res.sendStatus(200);
      }
      // Se tinha mensagem pendente, envia confirmação e reprocessa
      await whatsappService.sendTextMessage(phone, confirmMsg);
    }

    // 8. Resolver qual família usar
    let family;
    // Recarregar user para pegar default atualizado
    const freshUser = await prisma.user.findUnique({ where: { id: user.id } });
    
    if (freshUser.whatsapp_default_family_id) {
      family = userFamilies.find(f => f.id === freshUser.whatsapp_default_family_id);
    }

    if (!family && userFamilies.length === 1) {
      family = userFamilies[0];
    }

    if (!family) {
      // Múltiplas famílias, nenhuma padrão → perguntar
      const opts = userFamilies.map((f, i) => `${i + 1}⃣ ${f.nome_familia}`).join('\n');
      const msg = `Olá! Você tem ${userFamilies.length} famílias cadastradas. Para qual delas é esse lançamento?\n\n${opts}\n\n_Essa escolha será salva para as próximas mensagens. Digite \'mudar família\' para trocar._`;
      
      const sessionData = {
        user_id: user.id,
        phone: phone,
        state: 'awaiting_family_selection',
        intent: null,
        extracted_data: { families: userFamilies.map(f => ({ id: f.id, nome_familia: f.nome_familia })), pending_message: messageText },
        expires_at: new Date(Date.now() + 30 * 60000)
      };
      if (session) {
        await prisma.whatsappSession.update({ where: { id: session.id }, data: { ...sessionData, updated_at: new Date() } });
      } else {
        await prisma.whatsappSession.create({ data: sessionData });
      }
      await whatsappService.sendTextMessage(phone, msg);
      return res.sendStatus(200);
    }

    // 9. Preparar contexto e chamar IA
    const [categories, creditCards] = await Promise.all([
      prisma.category.findMany({ where: { family_id: family.id, ativo: true } }),
      prisma.creditCard.findMany({ where: { family_id: family.id, ativo: true } })
    ]);

    // 9.5. Se sessão está aguardando um campo específico, responder diretamente sem IA
    if (session?.state === 'awaiting_missing_info' && session.missing_fields?.length > 0) {
      const handled = await handleMissingFieldResponse(session, user, phone, family, messageText, categories, creditCards);
      if (handled) return res.sendStatus(200);
    }

    const interpretationContext = {
      currentDate: new Date().toISOString().split('T')[0],
      userTimezone: 'America/Sao_Paulo',
      categories,
      creditCards,
      lastSession: session ? {
        state: session.state,
        intent: session.intent,
        extracted_data: session.extracted_data,
        missing_fields: session.missing_fields,
        pending_action: session.pending_action
      } : null,
      base64Image,
      mimeType
    };

    // 10. Chamar IA
    const aiResult = await aiInterpreter.interpretMessage(messageText, interpretationContext);

    // 11. Processar Intent
    await handleIntent(aiResult, user, phone, session, family);

    return res.sendStatus(200);
  } catch (error) {
    console.error('Error processing WhatsApp webhook:', error);
    await whatsappService.sendTextMessage(phone, `Ocorreu um erro interno: ${error.message}\n\nStack:\n${error.stack.substring(0, 500)}`);
    return res.sendStatus(200);
  }
});

async function downloadMedia(mediaId) {
  const accessToken = await configService.get('WHATSAPP_ACCESS_TOKEN');
  const apiVersion = await configService.get('WHATSAPP_API_VERSION', 'v21.0');

  const mediaRes = await axios.get(
    `https://graph.facebook.com/${apiVersion}/${mediaId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const mediaUrl = mediaRes.data.url;
  const mimeType = mediaRes.data.mime_type;

  const fileRes = await axios.get(mediaUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
    responseType: 'arraybuffer'
  });

  return {
    buffer: Buffer.from(fileRes.data),
    mimeType: mimeType || fileRes.headers['content-type'] || 'image/jpeg'
  };
}

async function transcribeAudio(mediaId) {
  const { buffer } = await downloadMedia(mediaId);
  const openaiKey = await configService.get('OPENAI_API_KEY');
  const openai = new OpenAI({ apiKey: openaiKey });
  
  const file = new File([buffer], 'audio.ogg', { type: 'audio/ogg' });

  const transcription = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    language: 'pt'
  });

  return transcription.text;
}

// Responde diretamente a campos faltantes sem chamar a IA (evita loops)
async function handleMissingFieldResponse(session, user, phone, family, messageText, categories, creditCards) {
  if (!messageText) return false; // Se for imagem sem legenda, deixa a IA tentar extrair ou processar como novo lançamento

  const currentField = session.missing_fields[0];
  const extractedData = { ...(session.extracted_data || {}) };
  const intent = session.intent;
  let fieldValue = null;

  if (currentField === 'payment_method') {
    const t = messageText.trim().toLowerCase();
    if (/créd|cred|cartão|cartao/.test(t)) {
      // Transição para crédito
      extractedData.payment_method = 'CARTAO_CREDITO';
      let newMissing = [];
      if (creditCards.length === 1) {
        extractedData.credit_card = creditCards[0].nome;
      } else {
        newMissing.push('credit_card');
      }
      if (!extractedData.installments) newMissing.push('installments');
      if (!extractedData.category) newMissing.push('category');

      await prisma.whatsappSession.update({
        where: { id: session.id },
        data: { intent: 'create_credit_card_expense', extracted_data: extractedData, missing_fields: newMissing, updated_at: new Date() }
      });

      if (newMissing.length === 0) {
        const updatedSession = await prisma.whatsappSession.findUnique({ where: { id: session.id } });
        await sendConfirmation(updatedSession, phone, 'create_credit_card_expense', extractedData);
      } else {
        await askNextField(newMissing[0], creditCards, categories, phone);
      }
      return true;
    } else if (/pix/.test(t))              fieldValue = 'PIX';
    else if (/déb|deb/.test(t))            fieldValue = 'DEBITO';
    else if (/din|espe/.test(t))           fieldValue = 'DINHEIRO';
    else if (/boleto|carnê|carne/.test(t)) fieldValue = 'BOLETO';
    else {
      await whatsappService.sendTextMessage(phone, 'Foi no PIX, débito, dinheiro ou crédito?');
      return true;
    }
    extractedData.payment_method = fieldValue;

  } else if (currentField === 'credit_card') {
    const num = parseInt(messageText.trim());
    if (!isNaN(num) && num >= 1 && num <= creditCards.length) {
      extractedData.credit_card = creditCards[num - 1].nome;
    } else {
      const card = creditCards.find(c => c.nome.toLowerCase().includes(messageText.trim().toLowerCase()));
      if (card) {
        extractedData.credit_card = card.nome;
      } else {
        const opts = creditCards.map((c, i) => `${i + 1} - ${c.nome}`).join('\n');
        await whatsappService.sendTextMessage(phone, `Qual cartão? Responda com o número:\n${opts}`);
        return true;
      }
    }

  } else if (currentField === 'installments') {
    const match = messageText.match(/(\d+)/);
    if (match) {
      extractedData.installments = parseInt(match[1]);
    } else {
      await whatsappService.sendTextMessage(phone, 'Em quantas parcelas? (Responda 1 para à vista)');
      return true;
    }

  } else if (currentField === 'category') {
    const num = parseInt(messageText.trim());
    if (!isNaN(num) && num >= 1 && num <= categories.length) {
      extractedData.category = categories[num - 1].nome;
    } else {
      const cat = categories.find(c => c.nome.toLowerCase().includes(messageText.trim().toLowerCase()));
      if (cat) {
        extractedData.category = cat.nome;
      } else {
        const opts = categories.map((c, i) => `${i + 1} - ${c.nome}`).join('\n');
        await whatsappService.sendTextMessage(phone, `Qual a categoria? Responda com o número:\n${opts}`);
        return true;
      }
    }

  } else {
    // Campo não reconhecido — deixa a IA tratar
    return false;
  }

  // Remove o campo respondido e verifica o próximo
  const remainingFields = session.missing_fields.filter(f => f !== currentField);

  if (remainingFields.length > 0) {
    await prisma.whatsappSession.update({
      where: { id: session.id },
      data: { extracted_data: extractedData, missing_fields: remainingFields, updated_at: new Date() }
    });
    await askNextField(remainingFields[0], creditCards, categories, phone);
  } else {
    // Todos os campos preenchidos → pedir confirmação
    await prisma.whatsappSession.update({
      where: { id: session.id },
      data: {
        state: 'awaiting_confirmation',
        extracted_data: extractedData,
        missing_fields: [],
        pending_action: { intent, data: extractedData },
        updated_at: new Date()
      }
    });
    await sendConfirmation(session, phone, intent, extractedData);
  }

  return true;
}

async function askNextField(field, creditCards, categories, phone) {
  const creditCardListMenu = creditCards.map((cc, i) => `${i + 1} - ${cc.nome}`).join('\n');
  const categoryListMenu = categories.map((c, i) => `${i + 1} - ${c.nome}`).join('\n');

  if (field === 'payment_method') {
    await whatsappService.sendTextMessage(phone, 'Foi no PIX, débito, dinheiro ou crédito?');
  } else if (field === 'credit_card') {
    await whatsappService.sendTextMessage(phone, `Qual cartão? Responda com o número:\n${creditCardListMenu}`);
  } else if (field === 'installments') {
    await whatsappService.sendTextMessage(phone, 'Em quantas parcelas? (Responda 1 para à vista)');
  } else if (field === 'category') {
    await whatsappService.sendTextMessage(phone, `Qual a categoria do gasto? Responda com o número:\n${categoryListMenu}`);
  }
}

async function sendConfirmation(session, phone, intent, data) {
  const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const amount = parseFloat(data.amount) || 0;
  const installments = parseInt(data.installments) || 1;

  let msg = `✅ *Confirmar lançamento?*\n\n`;
  msg += `📝 ${data.description || 'Lançamento'}\n`;
  msg += `💰 ${formatter.format(amount)}`;
  if (installments > 1) msg += ` *(${installments}x de ${formatter.format(amount / installments)})*`;
  msg += `\n📅 ${data.date || new Date().toISOString().split('T')[0]}`;
  if (intent === 'create_credit_card_expense') {
    msg += `\n💳 Cartão: ${data.credit_card}`;
  } else if (data.payment_method) {
    msg += `\n💳 ${data.payment_method}`;
  }
  if (data.category) msg += `\n📂 ${data.category}`;
  msg += `\n\nResponda *sim* para confirmar ou *não* para cancelar.`;

  await whatsappService.sendTextMessage(phone, msg);
}

async function handleIntent(aiResult, user, phone, session, family) {
  const { intent, data, missing_fields, needs_confirmation, user_question, summary_for_confirmation } = aiResult;

  // Se for relatório
  if (intent === 'generate_report') {
    return await handleReportRequest(user, family, data.period, phone);
  }

  // Se for ajuda
  if (intent === 'help') {
    const helpMsg = `🤖 *Como posso ajudar?*\n\n` +
      `Posso te ajudar a organizar suas finanças! Veja o que você pode me pedir:\n\n` +
      `💸 *Despesas:* "Gastei 50 no mercado no pix", "Comprei um lanche por 30 no cartão"\n` +
      `💰 *Receitas:* "Recebi 3000 de salário"\n` +
      `📋 *Listar:* "Liste os lançamentos de hoje" ou "Liste os gastos de ontem"\n` +
      `✏️ *Editar:* (Após listar) "Altere o lançamento 1 para boleto"\n` +
      `📊 *Relatórios:* "Mande o relatório desse mês" ou "Resumo de hoje"\n\n` +
      `Pode mandar texto, áudio ou foto de comprovante!`;
    return await whatsappService.sendTextMessage(phone, helpMsg);
  }

  // Se for listagem de gastos
  if (intent === 'list_expenses') {
    return await handleListExpensesRequest(user, family, data.date, phone, session);
  }

  // Se for chat geral (dicas, clima, filmes, esportes)
  if (intent === 'general_chat' && data.chat_response) {
    return await whatsappService.sendTextMessage(phone, data.chat_response);
  }

  // Se for agendamento
  if (intent === 'schedule_event') {
    return await handleScheduleEventRequest(data, phone);
  }

  // Se for edição e estiver faltando o índice
  if (intent === 'update_expense' && (!data.item_index || !session?.extracted_data?.listed_items)) {
    return await whatsappService.sendTextMessage(phone, "Por favor, liste os lançamentos primeiro (ex: 'liste os de hoje') e depois diga qual número quer alterar.");
  }

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
    let recordsCreated = [];
    if (intent === 'create_expense' || intent === 'create_credit_card_expense') {
      // Encontrar a categoria pelo nome (busca insensitive exata ou parcial)
      let categoryId = null;
      if (data.category) {
        const cat = await prisma.category.findFirst({
          where: { family_id: family.id, nome: { equals: data.category, mode: 'insensitive' } }
        });
        categoryId = cat?.id;
        
        // Fallback para 'contains' se a exata não bater
        if (!categoryId) {
          const catFallback = await prisma.category.findFirst({
            where: { family_id: family.id, nome: { contains: data.category, mode: 'insensitive' } }
          });
          categoryId = catFallback?.id;
        }
      }

      // Tenta encontrar o cartão pelo nome
      let creditCardId = null;
      if (data.credit_card) {
        const cc = await prisma.creditCard.findFirst({
          where: { family_id: family.id, nome: { contains: data.credit_card, mode: 'insensitive' } }
        });
        creditCardId = cc?.id;
      }

      const totalAmount = parseFloat(data.amount);
      const installments = parseInt(data.installments) || 1;
      const installmentValue = installments > 1 ? (totalAmount / installments) : totalAmount;
      const baseDate = new Date(data.date || new Date().toISOString().split('T')[0]);

      for (let i = 0; i < installments; i++) {
        // Calcular data da parcela (adiciona meses)
        const currentInstallmentDate = new Date(baseDate);
        currentInstallmentDate.setMonth(currentInstallmentDate.getMonth() + i);
        const installmentDateStr = currentInstallmentDate.toISOString().split('T')[0];
        const installmentCompetencia = installmentDateStr.substring(0, 7); // YYYY-MM

        // Garantir que o mês financeiro exista
        let instFinancialMonth = await prisma.financialMonth.findUnique({
          where: { family_id_competencia: { family_id: family.id, competencia: installmentCompetencia } }
        });

        if (!instFinancialMonth) {
          instFinancialMonth = await prisma.financialMonth.create({
            data: { family_id: family.id, competencia: installmentCompetencia, status: 'ABERTO' }
          });
        }

        const description = installments > 1 
          ? `${data.description || 'Lançamento WhatsApp'} (${i + 1}/${installments})`
          : (data.description || 'Lançamento WhatsApp');

        const record = await prisma.expense.create({
          data: {
            descricao: description,
            valor: installmentValue,
            data: installmentDateStr,
            forma_pagamento: data.payment_method || (creditCardId ? 'CARTAO_CREDITO' : 'PIX'),
            month_id: instFinancialMonth.id,
            family_id: family.id,
            category_id: categoryId,
            credit_card_id: creditCardId
          }
        });
        
        recordsCreated.push(record);
      }

      // Se for cartão, recalcula a fatura do cartão
      if (creditCardId) {
        // Precisamos recalcular todas as despesas recém criadas se afetarem faturas futuras.
        // O `triggerRecalculo` recalcula faturas pendentes do cartão na família.
        triggerRecalculo(recordsCreated[0], family.id).catch(console.error);
      }

    } else if (intent === 'create_income') {
      let categoryId = null;
      if (data.category) {
        const cat = await prisma.category.findFirst({
          where: { family_id: family.id, nome: { equals: data.category, mode: 'insensitive' } }
        });
        categoryId = cat?.id;
      }

      const record = await prisma.income.create({
        data: {
          descricao: data.description || 'Receita WhatsApp',
          valor: parseFloat(data.amount),
          data_recebimento: data.date || new Date().toISOString().split('T')[0],
          month_id: financialMonth.id,
          family_id: family.id,
          category_id: categoryId
        }
      });
      recordsCreated.push(record);
    } else if (intent === 'update_expense') {
      const listedItems = session.extracted_data.listed_items;
      const index = parseInt(data.item_index) - 1;
      
      if (index < 0 || index >= listedItems.length) {
        throw new Error("Índice de lançamento inválido");
      }
      
      const targetExpenseId = listedItems[index].id;
      const oldExpense = await prisma.expense.findUnique({ where: { id: targetExpenseId } });
      
      if (!oldExpense) throw new Error("Lançamento não encontrado");

      let updateData = {};
      if (data.amount) updateData.valor = parseFloat(data.amount);
      
      if (data.payment_method) {
        updateData.forma_pagamento = data.payment_method;
        if (data.payment_method !== 'CARTAO_CREDITO') {
          updateData.credit_card_id = null; // Remove do cartão
        }
      }
      
      if (data.credit_card) {
        const cc = await prisma.creditCard.findFirst({
          where: { family_id: family.id, nome: { contains: data.credit_card, mode: 'insensitive' } }
        });
        if (cc) {
          updateData.credit_card_id = cc.id;
          updateData.forma_pagamento = 'CARTAO_CREDITO';
        }
      }

      const updatedRecord = await prisma.expense.update({
        where: { id: targetExpenseId },
        data: updateData
      });
      
      recordsCreated.push(updatedRecord);

      // Recalcula fatura se envolveu cartão (antes ou depois)
      if (oldExpense.credit_card_id || updatedRecord.credit_card_id) {
        triggerRecalculo(updatedRecord, family.id).catch(console.error);
      }
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
        related_record_id: recordsCreated[0]?.id || 'unknown',
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

async function handleReportRequest(user, family, period, phone) {
  try {
    const isDaily = period && period.length === 10;
    const p = period || new Date().toISOString().substring(0, 7);
    const monthPeriod = p.substring(0, 7);
    
    const financialMonth = await prisma.financialMonth.findUnique({
      where: { family_id_competencia: { family_id: family.id, competencia: monthPeriod } }
    });

    if (!financialMonth) {
      return await whatsappService.sendTextMessage(phone, `Não encontrei dados financeiros para o período ${monthPeriod}.`);
    }

    const [incomes, expenses, investmentBoxes, stocks] = await Promise.all([
      prisma.income.findMany({ where: { month_id: financialMonth.id } }),
      prisma.expense.findMany({ where: { month_id: financialMonth.id } }),
      prisma.investmentBox.findMany({ where: { family_id: family.id, ativo: true } }),
      prisma.stockInvestment.findMany({ where: { family_id: family.id, ativo: true } })
    ]);

    const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

    if (isDaily) {
      const dayExpenses = expenses.filter(e => e.data === p);
      const dayIncomes = incomes.filter(i => i.data_recebimento === p);

      const dayTotalExpense = dayExpenses.reduce((sum, e) => sum + Number(e.valor), 0);
      const dayTotalIncome = dayIncomes.reduce((sum, i) => sum + Number(i.valor), 0);

      const totalMonthIncome = incomes.reduce((sum, i) => sum + Number(i.valor), 0);
      const regularMonthExpenses = expenses.filter(e => !e.credit_card_id || e.is_fatura_cartao);
      const totalMonthRegular = regularMonthExpenses.reduce((sum, e) => sum + Number(e.valor), 0);
      
      const balance = totalMonthIncome - totalMonthRegular;

      let msg = `📊 *Resumo do Dia ${p.split('-').reverse().join('/')}*\n\n`;
      msg += `💰 *Receita na Conta (Total do Mês):* ${formatter.format(totalMonthIncome)}\n`;
      msg += `💸 *Despesas de Hoje:* ${formatter.format(dayTotalExpense)}\n`;
      if (dayTotalIncome > 0) {
        msg += `🟢 *Receitas de Hoje:* ${formatter.format(dayTotalIncome)}\n`;
      }

      if (dayExpenses.length > 0) {
        msg += `\n📋 *Lançamentos de Hoje:*\n`;
        dayExpenses.forEach(exp => {
          msg += `- ${exp.descricao} (${formatter.format(exp.valor)})\n`;
        });
      }

      msg += `\n💵 *Saldo Atualizado (Mês):* ${formatter.format(balance)}`;

      await whatsappService.sendTextMessage(phone, msg);
      return;
    }

    const totalIncome = incomes.reduce((sum, i) => sum + Number(i.valor), 0);
    const regularExpenses = expenses.filter(e => !e.credit_card_id || e.is_fatura_cartao);
    const ccExpenses = expenses.filter(e => e.credit_card_id && !e.is_fatura_cartao);
    
    const totalRegular = regularExpenses.reduce((sum, e) => sum + Number(e.valor), 0);
    const totalCC = ccExpenses.reduce((sum, e) => sum + Number(e.valor), 0);
    
    const totalInvestments = investmentBoxes.reduce((sum, i) => sum + Number(i.saldo_atual), 0) 
      + stocks.reduce((sum, s) => sum + Number(s.saldo_atual), 0);

    const balance = totalIncome - totalRegular;

    let msg = `📊 *Resumo Financeiro de ${p}*\n\n`;
    msg += `💰 *Receitas:* ${formatter.format(totalIncome)}\n`;
    msg += `💸 *Despesas (Dinheiro/PIX/Débito):* ${formatter.format(totalRegular)}\n`;
    if (totalCC > 0) {
      msg += `💳 *Cartões de Crédito (Gasto no Mês):* ${formatter.format(totalCC)}\n`;
    }
    msg += `📈 *Investimentos/Caixinhas:* ${formatter.format(totalInvestments)}\n\n`;
    msg += `*Saldo do Mês:* ${formatter.format(balance)}`;

    await whatsappService.sendTextMessage(phone, msg);
    return;
  } catch (err) {
    console.error('Error generating report:', err);
    await whatsappService.sendTextMessage(phone, "Ocorreu um erro ao gerar seu relatório. Tente novamente mais tarde.");
  }
}

async function handleListExpensesRequest(user, family, dateParam, phone, session) {
  try {
    const searchDate = dateParam || new Date().toISOString().split('T')[0];
    
    const expenses = await prisma.expense.findMany({
      where: { family_id: family.id, data: searchDate },
      include: { category: true, creditCard: true },
      orderBy: { created_date: 'asc' }
    });

    if (expenses.length === 0) {
      return await whatsappService.sendTextMessage(phone, `Não encontrei nenhum lançamento para o dia ${searchDate}.`);
    }

    const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
    
    let msg = `📋 *Lançamentos do dia ${searchDate}*\n\n`;
    
    const listedItems = expenses.map((exp, idx) => {
      let forma = exp.forma_pagamento || '';
      if (exp.credit_card_id && exp.creditCard) forma = `Cartão ${exp.creditCard.nome}`;
      const cat = exp.category ? `[${exp.category.nome}]` : '';
      
      msg += `${idx + 1}. ${exp.descricao} - ${formatter.format(exp.valor)} (${forma}) ${cat}\n`;
      return { id: exp.id, descricao: exp.descricao };
    });
    
    msg += `\n💡 *Dica:* Para alterar algo, responda "Altere o lançamento X para..."`;

    // Save the list to session so we can update by index later
    const sessionData = {
      user_id: user.id,
      phone: phone,
      state: 'awaiting_command', // Generic state
      intent: 'list_expenses',
      extracted_data: { listed_items: listedItems },
      expires_at: new Date(Date.now() + 30 * 60000)
    };

    if (session) {
      await prisma.whatsappSession.update({ where: { id: session.id }, data: sessionData });
    } else {
      await prisma.whatsappSession.create({ data: sessionData });
    }

    await whatsappService.sendTextMessage(phone, msg);
  } catch (err) {
    console.error('Error listing expenses:', err);
    await whatsappService.sendTextMessage(phone, "Ocorreu um erro ao listar os lançamentos.");
  }
}

async function handleScheduleEventRequest(data, phone) {
  try {
    const title = encodeURIComponent(data.title || 'Compromisso');
    const details = encodeURIComponent(data.details || '');
    const startTime = data.start_time || new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const endTime = data.end_time || startTime;

    const googleLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startTime}/${endTime}&details=${details}`;
    
    // O iOS e o MacOS interpretam datas nativamente no WhatsApp, então podemos exibir os horários legíveis para o usuário clicar.
    // Mas também vamos enviar o link direto para o Google Calendar.
    
    // Tentar formatar a data de start_time (que vem no formato YYYYMMDDTHHmmssZ)
    let dataLegivel = startTime;
    if (startTime.length >= 15) {
      const year = startTime.substring(0, 4);
      const month = startTime.substring(4, 6);
      const day = startTime.substring(6, 8);
      const hour = startTime.substring(9, 11);
      const min = startTime.substring(11, 13);
      dataLegivel = `${day}/${month}/${year} às ${hour}:${min}`;
    }

    let msg = `📅 *Agendamento Criado!*\n\n`;
    msg += `📌 *${data.title}*\n`;
    msg += `⏰ *Quando:* ${dataLegivel}\n`;
    if (data.details) {
      msg += `📝 *Detalhes:* ${data.details}\n`;
    }
    msg += `\n*Para salvar na sua agenda, escolha uma das opções:*`;
    msg += `\n\n🍎 *Usuários Apple:*`;
    msg += `\nToque diretamente na data acima (${dataLegivel}) para adicionar ao calendário do iPhone/Mac.`;
    msg += `\n\n🌐 *Usuários Google / Android:*`;
    msg += `\n[Clique aqui para abrir no Google Calendar](${googleLink})`;

    await whatsappService.sendTextMessage(phone, msg);
  } catch (error) {
    console.error('Error scheduling event:', error);
    await whatsappService.sendTextMessage(phone, "Ocorreu um erro ao tentar gerar os links de agendamento.");
  }
}

module.exports = router;
