/**
 * Config store plugável.
 *
 * Por padrão, as credenciais vêm de variáveis de ambiente (process.env),
 * o que funciona em qualquer sistema sem precisar de banco de dados.
 *
 * Se o sistema onde você está instalando o kit já tem um jeito de guardar
 * configuração (uma tabela SystemConfig, um KV store, etc.), implemente a
 * mesma interface { get(key, defaultValue), set(key, value) } e passe essa
 * implementação em vez do envConfigStore. Isso permite trocar as credenciais
 * pelo painel admin sem precisar reiniciar o servidor / redeployar.
 */

function createEnvConfigStore() {
  return {
    async get(key, defaultValue = null) {
      const value = process.env[key];
      return value !== undefined && value !== '' ? value : defaultValue;
    },
    async set() {
      throw new Error(
        `configStore.set() não é suportado pelo envConfigStore (somente leitura). ` +
        `Para permitir salvar credenciais em runtime (ex: via painel admin), forneça um ` +
        `configStore próprio (banco de dados, arquivo, etc) implementando get()/set().`
      );
    },
  };
}

module.exports = { createEnvConfigStore };
