const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class ConfigService {
  async get(key, defaultValue = null) {
    try {
      const config = await prisma.systemConfig.findUnique({
        where: { key }
      });
      
      if (config && config.value) {
        return config.value;
      }
      
      // Fallback para variáveis de ambiente
      return process.env[key] || defaultValue;
    } catch (error) {
      console.error(`Error fetching config ${key}:`, error);
      return process.env[key] || defaultValue;
    }
  }

  async set(key, value, description = null) {
    return prisma.systemConfig.upsert({
      where: { key },
      update: { value, description },
      create: { key, value, description }
    });
  }
}

module.exports = new ConfigService();
