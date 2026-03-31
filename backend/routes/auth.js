const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { SECRET } = require('../middleware/auth');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { username, handle, email, password } = req.body;
  if (!username || !handle || !email || !password)
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' });

  const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle;

  try {
    const hash = bcrypt.hashSync(password, 10);
    const result = await db.run(
      'INSERT INTO users (username, handle, email, password) VALUES (?, ?, ?, ?)',
      [username, cleanHandle, email, hash]
    );
    const token = jwt.sign({ userId: result.lastInsertRowid }, SECRET, { expiresIn: '7d' });
    const user = await db.get(
      'SELECT id, username, handle, bio, avatar_url, banner_url, is_admin, created_at FROM users WHERE id = ?',
      [result.lastInsertRowid]
    );
    res.status(201).json({ token, user });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Username, handle ou e-mail já existe' });
    }
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'E-mail e senha obrigatórios' });

  try {
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user || !bcrypt.compareSync(password, user.password))
      return res.status(401).json({ error: 'Credenciais inválidas' });

    if (user.banned)
      return res.status(403).json({ error: `Sua conta foi banida. Motivo: ${user.ban_reason || 'não informado'}` });

    const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: '7d' });
    const { password: _, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

module.exports = router;