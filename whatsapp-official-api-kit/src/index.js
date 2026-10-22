const { createEnvConfigStore } = require('./configStore');
const { WhatsAppOfficialClient, CONFIG_KEYS } = require('./whatsappClient');
const { createWhatsAppWebhookRouter, VERIFY_TOKEN_KEY, APP_SECRET_KEY } = require('./webhookRouter');

/**
 * Atalho: monta client + router com um configStore comum.
 *
 * const { client, router } = createWhatsAppOfficialApi({ onMessage: async (msg, ctx) => {...} });
 * app.use('/webhooks/whatsapp', router);
 */
function createWhatsAppOfficialApi({ configStore, onMessage, onStatus, requireSignature, apiVersionFallback } = {}) {
  const store = configStore || createEnvConfigStore();
  const client = new WhatsAppOfficialClient({ configStore: store, apiVersionFallback });
  const router = createWhatsAppWebhookRouter({ configStore: store, onMessage, onStatus, requireSignature });
  return { client, router, configStore: store };
}

module.exports = {
  createWhatsAppOfficialApi,
  createEnvConfigStore,
  WhatsAppOfficialClient,
  createWhatsAppWebhookRouter,
  CONFIG_KEYS,
  VERIFY_TOKEN_KEY,
  APP_SECRET_KEY,
};
