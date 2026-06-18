const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const aiInterpreter = require('./src/services/aiInterpreterService');

async function test() {
  const categories = await prisma.category.findMany({ where: { ativo: true }, take: 2 });
  const creditCards = await prisma.creditCard.findMany({ where: { ativo: true }, take: 2 });
  
  const interpretationContext = {
    currentDate: new Date().toISOString().split('T')[0],
    userTimezone: 'America/Sao_Paulo',
    categories,
    creditCards,
    lastSession: null,
    base64Image: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", // tiny pixel
    mimeType: "image/png"
  };

  try {
    const aiResult = await aiInterpreter.interpretMessage(null, interpretationContext);
    console.log("AI Result:", aiResult);
  } catch (err) {
    console.error("Test error:", err);
  }
}
test();
