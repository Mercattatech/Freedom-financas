#!/usr/bin/env node
/**
 * Testa se as credenciais configuradas (via .env) estão válidas e,
 * opcionalmente, envia uma mensagem de teste.
 *
 * Uso:
 *   node scripts/test-connection.js
 *   node scripts/test-connection.js 5511999999999          (envia texto de teste)
 *   node scripts/test-connection.js 5511999999999 hello_world pt_BR   (envia template)
 */

require('dotenv').config();
const path = require('path');
const { createWhatsAppOfficialApi } = require(path.join(__dirname, '..', 'src'));

async function main() {
  const [to, templateName, languageCode] = process.argv.slice(2);
  const { client } = createWhatsAppOfficialApi();

  console.log('🔎 Verificando credenciais (WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID)...');
  try {
    const info = await client.testConnection();
    console.log('✅ Credenciais válidas!');
    console.log(`   Número: ${info.display_phone_number || '(desconhecido)'}`);
    console.log(`   Nome verificado: ${info.verified_name || '(desconhecido)'}`);
    console.log(`   Qualidade: ${info.quality_rating || '(desconhecido)'}`);
  } catch (err) {
    console.error('❌ Credenciais inválidas ou não configuradas.');
    console.error('   ', err.message);
    if (err.response) console.error('   Detalhe da API:', JSON.stringify(err.response, null, 2));
    process.exit(1);
  }

  if (!to) {
    console.log('\nℹ️  Nenhum número informado — pulando envio de teste.');
    console.log('   Rode: node scripts/test-connection.js 55DDDNUMERO [template] [idioma]');
    return;
  }

  try {
    if (templateName) {
      console.log(`\n📨 Enviando template "${templateName}" (${languageCode || 'pt_BR'}) para ${to}...`);
      const result = await client.sendTemplate(to, templateName, languageCode || 'pt_BR');
      console.log('✅ Template enviado:', result.messages?.[0]?.id);
    } else {
      console.log(`\n📨 Enviando mensagem de texto de teste para ${to}...`);
      console.log('   (se este for o primeiro contato ou já passaram 24h da última mensagem do usuário,');
      console.log('    a Meta vai recusar texto livre — use um template aprovado nesse caso.)');
      const result = await client.sendText(to, '✅ Kit de API oficial do WhatsApp conectado com sucesso!');
      console.log('✅ Mensagem enviada:', result.messages?.[0]?.id);
    }
  } catch (err) {
    console.error('❌ Falha ao enviar mensagem:', err.message);
    if (err.response) console.error('   Detalhe da API:', JSON.stringify(err.response, null, 2));
    process.exit(1);
  }
}

main();
