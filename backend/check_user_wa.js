const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.user.findUnique({ where: { email: 'matheus@grupomercatta.com.br' }});
  console.log("User WA:", user.whatsapp_phone);
}
main().finally(() => prisma.$disconnect());
