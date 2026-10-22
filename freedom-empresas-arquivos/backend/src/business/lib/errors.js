class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const badRequest = (msg, details) => new HttpError(400, msg, details);
const notFound = (what = 'Registro') => new HttpError(404, `${what} não encontrado`);
const forbidden = (msg = 'Sem permissão para esta ação') => new HttpError(403, msg);

// Envolve handlers async e encaminha erros para o handler do módulo
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { HttpError, badRequest, notFound, forbidden, ah };
