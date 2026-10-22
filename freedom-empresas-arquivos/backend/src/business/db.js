// Cliente Prisma único do módulo Empresas (evita esgotar conexões em serverless).
// Em testes, um cliente alternativo pode ser injetado via global.__bizPrisma.
const { PrismaClient } = require('@prisma/client');

const prisma = global.__bizPrisma || (global.__bizPrismaSingleton ||= new PrismaClient());

module.exports = prisma;
