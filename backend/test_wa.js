require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const whatsappService = require('./src/services/whatsappService');

async function main() {
  const user = await prisma.user.findUnique({ where: { email: 'matheus@grupomercatta.com.br' }});
  if (user && user.whatsapp_phone) {
    console.log("Found WA:", user.whatsapp_phone);
    try {
      await whatsappService.sendTextMessage(user.whatsapp_phone, "👋 Olá! Este é um teste do sistema Freedom API.");
      console.log("Message sent successfully via API.");
    } catch(err) {
      console.log("Error sending message:", err.response ? err.response.data : err.message);
    }
  } else {
    console.log("No WA number linked for user.");
  }
}
main().finally(() => prisma.$disconnect());
