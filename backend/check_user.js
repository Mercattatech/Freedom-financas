const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = 'matheus@grupomercatta.com.br';
  const user = await prisma.user.findUnique({ where: { email } });
  
  if (!user) {
    console.log("User not found!");
  } else {
    console.log("User found:", {
      id: user.id,
      email: user.email,
      role: user.role,
      is_verified: user.is_verified,
      disabled: user.disabled,
      passwordHash: user.password
    });
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
