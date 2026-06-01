/**
 * Script de Teste para o Fluxo do WhatsApp
 * Simula payloads da Meta Cloud API para testar a lógica do backend.
 */
const axios = require('axios');
require('dotenv').config();

const API_URL = `http://localhost:${process.env.PORT || 3000}/api/webhooks/whatsapp`;

async function simulateMessage(phone, text) {
  console.log(`\n--- Simulando Mensagem: "${text}" de ${phone} ---`);
  
  const payload = {
    object: 'whatsapp_business_account',
    entry: [{
      id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
      changes: [{
        value: {
          messaging_product: 'whatsapp',
          metadata: { display_phone_number: '123456789', phone_number_id: 'PHONE_NUMBER_ID' },
          contacts: [{ profile: { name: 'Usuário Teste' }, wa_id: phone }],
          messages: [{
            from: phone,
            id: `wamid.test_${Date.now()}`,
            timestamp: Math.floor(Date.now() / 1000),
            text: { body: text },
            type: 'text'
          }]
        },
        field: 'messages'
      }]
    }]
  };

  try {
    const response = await axios.post(API_URL, payload);
    console.log('Status da Resposta:', response.status);
    console.log('Lógica processada com sucesso no backend.');
  } catch (error) {
    console.error('Erro ao simular mensagem:', error.response?.data || error.message);
  }
}

// Exemplos de uso (Descomente para testar)
async function runTests() {
  console.log('Certifique-se de que o servidor está rodando (npm run dev no backend)');
  
  // 1. Testar despesa simples
  // await simulateMessage('5511999999999', 'Gastei R$ 45 no almoço hoje no pix');
  
  // 2. Testar confirmação
  // await simulateMessage('5511999999999', 'sim');
  
  // 3. Testar despesa cartão
  // await simulateMessage('5511999999999', 'Comprei R$ 320 de mercado no cartão Nubank');
}

runTests();
