const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'supersecret';

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, SECRET);
    req.userId = payload.userId;

    const db = require('../db');
    const user = await db.get('SELECT banned, ban_reason FROM users WHERE id = ?', [req.userId]);
    if (user?.banned) {
      return res.status(403).json({ error: `Sua conta foi banida. Motivo: ${user.ban_reason || 'não informado'}` });
    }

    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

module.exports = { authMiddleware, SECRET };