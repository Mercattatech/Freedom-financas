const express = require('express');
const crypto = require('crypto');

const VERIFY_TOKEN_KEY = 'WHATSAPP_VERIFY_TOKEN';
const APP_SECRET_KEY = 'WHATSAPP_APP_SECRET';

/**
 * Cria o router Express que implementa o webhook oficial do WhatsApp Cloud API:
 *   GET  /  -> handshake de verificação (chamado pelo Meta ao salvar a URL)
 *   POST /  -> recebimento de mensagens e status de entrega
 *
 * IMPORTANTE: monte este router ANTES de qualquer `app.use(express.json())`
 * global, porque ele precisa ler o corpo raw da requisição para validar a
 * assinatura HMAC (X-Hub-Signature-256). Ex:
 *
 *   app.use('/webhooks/whatsapp', createWhatsAppWebhookRouter({ configStore, onMessage }));
 *   app.use(express.json()); // outras rotas do sistema, depois do webhook
 *
 * @param {object} opts
 * @param {{get: Function}} opts.configStore
 * @param {(message: object, ctx: object) => Promise<void>|void} opts.onMessage
 *        Chamado para cada mensagem recebida (texto, áudio, imagem, etc).
 *        `message` é o objeto de mensagem cru do payload da Meta.
 *        `ctx` traz { contact, rawBody } para contexto adicional.
 * @param {(status: object) => Promise<void>|void} [opts.onStatus]
 *        Chamado para eventos de status de entrega (sent/delivered/read/failed).
 * @param {boolean} [opts.requireSignature=false]
 *        Se true, rejeita (403) requisições cuja assinatura HMAC não bate com
 *        WHATSAPP_APP_SECRET. Recomendado para produção. Exige que o App
 *        Secret do app Meta esteja configurado no configStore.
 */
function createWhatsAppWebhookRouter({ configStore, onMessage, onStatus, requireSignature = false }) {
  if (!configStore) throw new Error('createWhatsAppWebhookRouter requer um configStore.');
  if (typeof onMessage !== 'function') throw new Error('createWhatsAppWebhookRouter requer um onMessage(message, ctx).');

  const router = express.Router();

  router.use(
    express.json({
      verify: (req, res, buf) => {
        req.rawBody = buf;
      },
    })
  );

  // Handshake de verificação: o Meta faz essa chamada quando você salva a
  // URL do webhook no painel, para confirmar que você é o dono do endpoint.
  router.get('/', async (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const expectedToken = await configStore.get(VERIFY_TOKEN_KEY);

    if (mode === 'subscribe' && expectedToken && token === expectedToken) {
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  });

  router.post('/', async (req, res) => {
    // Sempre responder 200 rápido para o Meta não ficar reenviando o evento.
    // Erros de processamento são tratados internamente / logados, nunca
    // propagados como resposta de erro para o webhook.
    try {
      if (requireSignature) {
        const valid = await verifySignature(req, configStore);
        if (!valid) return res.sendStatus(403);
      }

      const entry = req.body?.entry?.[0]?.changes?.[0]?.value;
      if (!entry) return res.sendStatus(200);

      const message = entry.messages?.[0];
      const status = entry.statuses?.[0];

      if (message) {
        const contact = entry.contacts?.[0];
        await onMessage(message, { contact, rawBody: req.rawBody, value: entry });
      } else if (status && typeof onStatus === 'function') {
        await onStatus(status);
      }

      return res.sendStatus(200);
    } catch (err) {
      console.error('[whatsapp-official-api-kit] Erro processando webhook:', err);
      return res.sendStatus(200);
    }
  });

  return router;
}

async function verifySignature(req, configStore) {
  const appSecret = await configStore.get(APP_SECRET_KEY);
  if (!appSecret) {
    console.warn(
      '[whatsapp-official-api-kit] requireSignature=true mas WHATSAPP_APP_SECRET não está configurado — recusando por segurança.'
    );
    return false;
  }

  const signatureHeader = req.get('x-hub-signature-256');
  if (!signatureHeader || !req.rawBody) return false;

  const expected =
    'sha256=' + crypto.createHmac('sha256', appSecret).update(req.rawBody).digest('hex');

  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = { createWhatsAppWebhookRouter, VERIFY_TOKEN_KEY, APP_SECRET_KEY };
