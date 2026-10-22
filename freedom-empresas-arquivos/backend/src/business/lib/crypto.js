const crypto = require('crypto');

// Chave de criptografia dos segredos de integração (ex.: API key do Asaas)
const key = () =>
  crypto.createHash('sha256').update(process.env.BIZ_ENCRYPTION_KEY || process.env.JWT_SECRET || 'freedom-dev-key').digest();

const encrypt = (plain) => {
  if (!plain) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return `v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${enc.toString('base64')}`;
};

const decrypt = (payload) => {
  if (!payload) return null;
  if (!String(payload).startsWith('v1:')) return payload; // legado em texto puro
  const [, iv, tag, data] = String(payload).split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
};

const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const randomToken = (bytes = 24) => crypto.randomBytes(bytes).toString('base64url');
const safeEqual = (a, b) => {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const mask = (s) => (s ? `${String(s).slice(0, 6)}…${String(s).slice(-4)}` : null);

module.exports = { encrypt, decrypt, sha256, randomToken, safeEqual, mask };
