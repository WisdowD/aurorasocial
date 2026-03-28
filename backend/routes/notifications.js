const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

// GET /api/notifications
router.get('/', authMiddleware, async (req, res) => {
  try {
    const notifications = await db.all(`
      SELECT n.*,
             u.username as actor_name, u.handle as actor_handle, u.avatar_url as actor_avatar,
             p.content as post_preview
      FROM notifications n
      JOIN users u ON u.id = n.actor_id
      LEFT JOIN posts p ON p.id = n.post_id
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC
      LIMIT 50
    `, [req.userId]);
    res.json(notifications);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno' }); }
});

// PUT /api/notifications/read
router.put('/read', authMiddleware, async (req, res) => {
  try {
    await db.run('UPDATE notifications SET read = 1 WHERE user_id = ?', [req.userId]);
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno' }); }
});

// GET /api/notifications/unread-count
router.get('/unread-count', authMiddleware, async (req, res) => {
  try {
    const row = await db.get('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND read = 0', [req.userId]);
    res.json({ count: row.c });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno' }); }
});

module.exports = router;