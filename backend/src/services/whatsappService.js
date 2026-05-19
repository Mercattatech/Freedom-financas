const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const configService = require('./configService');

class WhatsAppService {
  async sendTextMessage(to, text, userId = null) {
    const accessToken = await configService.get('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = await configService.get('WHATSAPP_PHONE_NUMBER_ID');
    const apiVersion = await configService.get('WHATSAPP_API_VERSION', 'v21.0');
    const baseUrl = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}`;

    try {
      const response = await axios.post(
        `${baseUrl}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: to,
          type: 'text',
          text: { body: text },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Registrar mensagem enviada
      await prisma.whatsappMessage.create({
        data: {
          user_id: userId,
          phone: to,
          meta_message_id: response.data.messages[0].id,
          direction: 'outgoing',
          message_type: 'text',
          message_text: text,
          raw_payload: response.data,
          status: 'sent'
        }
      });

      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error sending WhatsApp message:', error.response?.data || error.message);
      
      // Registrar falha no envio (opcional, sem meta_message_id ainda)
      await prisma.whatsappMessage.create({
        data: {
          user_id: userId,
          phone: to,
          meta_message_id: `error-${Date.now()}`,
          direction: 'outgoing',
          message_type: 'text',
          message_text: text,
          raw_payload: error.response?.data || { error: error.message },
          status: 'error',
          error_message: error.message
        }
      });

      return { success: false, error: error.response?.data || error.message };
    }
  }
}

module.exports = new WhatsAppService();
