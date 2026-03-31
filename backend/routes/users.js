const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

async function enrichUser(user, requesterId) {
  if (!user) return null;
  const [r1, r2, r3, r4] = await Promise.all([
    db.get('SELECT COUNT(*) as c FROM follows WHERE following_id = ?', [user.id]),
    db.get('SELECT COUNT(*) as c FROM follows WHERE follower_id = ?', [user.id]),
    db.get('SELECT COUNT(*) as c FROM posts WHERE user_id = ? AND parent_id IS NULL', [user.id]),
    requesterId
      ? db.get('SELECT 1 as found FROM follows WHERE follower_id = ? AND following_id = ?', [requesterId, user.id])
      : Promise.resolve(null)
  ]);
  return {
    ...user,
    followers: r1.c,
    following: r2.c,
    posts_count: r3.c,
    isFollowing: !!r4?.found
  };
}

// GET /api/users/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await db.get(
      'SELECT id, username, handle, bio, avatar_url, banner_url, is_admin, created_at FROM users WHERE id = ?',
      [req.userId]
    );
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json(await enrichUser(user, req.userId));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno' }); }
});

// GET /api/users?q=
router.get('/', authMiddleware, async (req, res) => {
  try {
    const q = `%${req.query.q || ''}%`;
    const users = await db.all(
      'SELECT id, username, handle, bio, avatar_url FROM users WHERE username LIKE ? OR handle LIKE ? LIMIT 20',
      [q, q]
    );
    res.json(await Promise.all(users.map(u => enrichUser(u, req.userId))));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno' }); }
});

// GET /api/users/:id — busca por ID numérico OU handle
router.get('/:idOrHandle', authMiddleware, async (req, res) => {
  try {
    const param = req.params.idOrHandle;
    let user;
    if (/^\d+$/.test(param)) {
      user = await db.get(
        'SELECT id, username, handle, bio, avatar_url, banner_url, created_at FROM users WHERE id = ?',
        [parseInt(param)]
      );
    } else {
      user = await db.get(
        'SELECT id, username, handle, bio, avatar_url, banner_url, created_at FROM users WHERE handle = ?',
        [param]
      );
    }
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json(await enrichUser(user, req.userId));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno' }); }
});

// PUT /api/users/me
router.put('/me', authMiddleware, async (req, res) => {
  try {
    const { username, bio, avatar_url, banner_url } = req.body;
    await db.run(
      `UPDATE users SET
        username   = COALESCE(?, username),
        bio        = COALESCE(?, bio),
        avatar_url = COALESCE(?, avatar_url),
        banner_url = COALESCE(?, banner_url)
       WHERE id = ?`,
      [username || null, bio !== undefined ? bio : null, avatar_url || null, banner_url || null, req.userId]
    );
    const user = await db.get(
      'SELECT id, username, handle, bio, avatar_url, banner_url, created_at FROM users WHERE id = ?',
      [req.userId]
    );
    res.json(await enrichUser(user, req.userId));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno' }); }
});

// GET /api/users/:id/followers
router.get('/:id/followers', authMiddleware, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const users = await db.all(
      `SELECT u.id, u.username, u.handle, u.bio, u.avatar_url
       FROM users u
       INNER JOIN follows f ON f.follower_id = u.id
       WHERE f.following_id = ?
       ORDER BY f.created_at DESC`,
      [userId]
    );
    res.json(await Promise.all(users.map(u => enrichUser(u, req.userId))));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno' }); }
});

// GET /api/users/:id/following
router.get('/:id/following', authMiddleware, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const users = await db.all(
      `SELECT u.id, u.username, u.handle, u.bio, u.avatar_url
       FROM users u
       INNER JOIN follows f ON f.following_id = u.id
       WHERE f.follower_id = ?
       ORDER BY f.created_at DESC`,
      [userId]
    );
    res.json(await Promise.all(users.map(u => enrichUser(u, req.userId))));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno' }); }
});

// POST /api/users/:id/follow
router.post('/:id/follow', authMiddleware, async (req, res) => {
  const targetId = parseInt(req.params.id);
  if (targetId === req.userId) return res.status(400).json({ error: 'Não pode seguir a si mesmo' });
  try {
    const existing = await db.get(
      'SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?',
      [req.userId, targetId]
    );
    if (existing) {
      await db.run('DELETE FROM follows WHERE follower_id = ? AND following_id = ?', [req.userId, targetId]);
      return res.json({ following: false });
    }
    await db.run('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)', [req.userId, targetId]);
    await db.run(
      'INSERT INTO notifications (user_id, actor_id, type) VALUES (?, ?, ?)',
      [targetId, req.userId, 'follow']
    );
    res.json({ following: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno' }); }
});

module.exports = router;