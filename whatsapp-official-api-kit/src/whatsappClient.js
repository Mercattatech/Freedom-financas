/**
 * Cliente para a WhatsApp Cloud API (API oficial da Meta).
 * Usa fetch nativo do Node (>=18) — zero dependências além do Express, que
 * só é necessário para o webhook.
 */

const CONFIG_KEYS = {
  accessToken: 'WHATSAPP_ACCESS_TOKEN',
  phoneNumberId: 'WHATSAPP_PHONE_NUMBER_ID',
  apiVersion: 'WHATSAPP_API_VERSION',
};

class WhatsAppOfficialClient {
  /**
   * @param {object} opts
   * @param {{get: Function}} opts.configStore - de configStore.js (ou um customizado)
   * @param {string} [opts.apiVersionFallback] - versão da Graph API se não vier do configStore
   */
  constructor({ configStore, apiVersionFallback = 'v21.0' }) {
    if (!configStore) throw new Error('WhatsAppOfficialClient requer um configStore.');
    this.configStore = configStore;
    this.apiVersionFallback = apiVersionFallback;
  }

  async _credentials() {
    const [accessToken, phoneNumberId, apiVersion] = await Promise.all([
      this.configStore.get(CONFIG_KEYS.accessToken),
      this.configStore.get(CONFIG_KEYS.phoneNumberId),
      this.configStore.get(CONFIG_KEYS.apiVersion, this.apiVersionFallback),
    ]);

    if (!accessToken || !phoneNumberId) {
      throw new Error(
        'WHATSAPP_ACCESS_TOKEN e/ou WHATSAPP_PHONE_NUMBER_ID não configurados. ' +
        'Veja o README.md deste kit para o passo a passo de configuração no Meta Developers.'
      );
    }

    return {
      accessToken,
      phoneNumberId,
      baseUrl: `https://graph.facebook.com/${apiVersion}/${phoneNumberId}`,
    };
  }

  async _post(path, body) {
    const { accessToken, baseUrl } = await this._credentials();
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data?.error?.message || `WhatsApp API error (${res.status})`);
      err.response = data;
      err.status = res.status;
      throw err;
    }
    return data;
  }

  /** Envia uma mensagem de texto simples. */
  async sendText(to, text, { previewUrl = false } = {}) {
    return this._post('/messages', {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body: text, preview_url: previewUrl },
    });
  }

  /**
   * Envia uma mensagem de template (obrigatório para iniciar conversa fora da
   * janela de 24h de atendimento, ou para o primeiro contato com um número).
   * Templates precisam ser criados e aprovados antes no Meta Business Manager.
   */
  async sendTemplate(to, templateName, languageCode = 'pt_BR', components = []) {
    return this._post('/messages', {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components,
      },
    });
  }

  /** Envia uma imagem por URL pública ou por media_id já enviado antes. */
  async sendImage(to, { link, id, caption } = {}) {
    return this._post('/messages', {
      messaging_product: 'whatsapp',
      to,
      type: 'image',
      image: { link, id, caption },
    });
  }

  /** Marca uma mensagem recebida como lida (mostra o duplo check azul). */
  async markAsRead(messageId) {
    return this._post('/messages', {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    });
  }

  /** Baixa uma mídia (áudio, imagem, documento) recebida via webhook pelo media id. */
  async downloadMedia(mediaId) {
    const { accessToken, apiVersion } = await this._credentials();
    const version = apiVersion || this.apiVersionFallback;

    const metaRes = await fetch(`https://graph.facebook.com/${version}/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!metaRes.ok) throw new Error(`Falha ao buscar metadados da mídia (${metaRes.status})`);
    const meta = await metaRes.json();

    const fileRes = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!fileRes.ok) throw new Error(`Falha ao baixar mídia (${fileRes.status})`);
    const arrayBuffer = await fileRes.arrayBuffer();

    return {
      buffer: Buffer.from(arrayBuffer),
      mimeType: meta.mime_type || fileRes.headers.get('content-type') || 'application/octet-stream',
    };
  }

  /** Testa se o token e o phone_number_id são válidos, sem enviar mensagem nenhuma. */
  async testConnection() {
    const { accessToken, baseUrl } = await this._credentials();
    const res = await fetch(baseUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data?.error?.message || `Credenciais inválidas (${res.status})`);
      err.response = data;
      throw err;
    }
    return data; // { id, display_phone_number, verified_name, ... }
  }
}

module.exports = { WhatsAppOfficialClient, CONFIG_KEYS };
