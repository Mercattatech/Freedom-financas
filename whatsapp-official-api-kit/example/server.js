/**
 * Exemplo mínimo de como plugar o kit num sistema novo do zero.
 * Rode com: node example/server.js
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const { createWhatsAppOfficialApi } = require(path.join(__dirname, '..', 'src'));

const app = express();

const { client, router } = createWhatsAppOfficialApi({
  // requireSignature: true, // ative em produção (exige WHATSAPP_APP_SECRET)
  onMessage: async (message, ctx) => {
    const from = message.from;

    if (message.type === 'text') {
      console.log(`📩 Mensagem de ${from}: ${message.text.body}`);
      await client.sendText(from, `Recebi: "${message.text.body}"`);
    } else {
      console.log(`📩 Mensagem de ${from} do tipo ${message.type} (não tratada neste exemplo)`);
    }
  },
  onStatus: async (status) => {
    console.log(`📡 Status da mensagem ${status.id}: ${status.status}`);
  },
});

// O webhook precisa vir ANTES de qualquer express.json() global.
app.use('/webhooks/whatsapp', router);

// Demais rotas do sistema, normalmente:
app.use(express.json());
app.get('/health', (req, res) => res.json({ ok: true }));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor de exemplo rodando em http://localhost:${port}`);
  console.log(`Webhook URL local: http://localhost:${port}/webhooks/whatsapp`);
  console.log('Use ngrok/localtunnel para expor essa URL publicamente durante os testes.');
});
