const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  
  // Ex: "Bearer tokenxyz..."
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    return res.status(401).json({ status: 401, message: 'Authentication required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ status: 403, message: 'Invalid or expired token' });
    }
    
    // Anexa o usuario logado na requisição para as proximas rotas
    req.user = user;
    next();
  });
};

module.exports = { authenticateToken };
