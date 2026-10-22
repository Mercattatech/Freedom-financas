// Matriz de permissões por papel dentro da empresa
const MATRIX = {
  OWNER: ['*'],
  ADMIN: ['*'],
  FINANCEIRO: ['financeiro:write', 'cadastros:write', 'contratos:write', 'relatorios:read', 'operacional:write', 'comercial:write'],
  COMERCIAL: ['comercial:write', 'clientes:write'],
  OPERACIONAL: ['operacional:write'],
  LEITURA: ['relatorios:read'],
};

const can = (papel, perm) => {
  const list = MATRIX[papel] || [];
  if (list.includes('*') || list.includes(perm)) return true;
  if (perm === 'clientes:write' && list.includes('cadastros:write')) return true;
  return false;
};

const PAPEIS = Object.keys(MATRIX);

module.exports = { can, PAPEIS };
