const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

// Helper: enrich post with interaction counts
async function enrichPost(post, userId) {
  const [r1, r2, r3, r4, r5, r6, author] = await Promise.all([
    db.get('SELECT COUNT(*) as c FROM likes WHERE post_id = ?', [post.id]),
    db.get('SELECT COUNT(*) as c FROM posts WHERE parent_id = ?', [post.id]),
    db.get('SELECT COUNT(*) as c FROM shares WHERE post_id = ?', [post.id]),
    userId ? db.get('SELECT 1 as found FROM likes WHERE user_id = ? AND post_id = ?', [userId, post.id]) : Promise.resolve(null),
    userId ? db.get('SELECT 1 as found FROM shares WHERE user_id = ? AND post_id = ?', [userId, post.id]) : Promise.resolve(null),
    userId ? db.get('SELECT 1 as found FROM saved_posts WHERE user_id = ? AND post_id = ?', [userId, post.id]) : Promise.resolve(null),
    db.get('SELECT id, username, handle, avatar_url FROM users WHERE id = ?', [post.user_id])
  ]);
  return {
    ...post,
    author,
    likes: r1.c,
    comments: r2.c,
    shares: r3.c,
    liked: !!r4?.found,
    shared: !!r5?.found,
    saved: !!r6?.found
  };
}

// GET /api/posts/feed  → só posts de quem você segue
router.get('/feed', authMiddleware, async (req, res) => {
  try {
    const posts = await db.all(`
      SELECT p.* FROM posts p
      INNER JOIN follows f ON f.following_id = p.user_id
      WHERE p.parent_id IS NULL
        AND f.follower_id = ?
      ORDER BY p.created_at DESC
      LIMIT 30 OFFSET ?
    `, [req.userId, parseInt(req.query.offset) || 0]);
    res.json(await Promise.all(posts.map(p => enrichPost(p, req.userId))));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno' }); }
});

// GET /api/posts/home  → todos os posts (sem filtro)
router.get('/home', authMiddleware, async (req, res) => {
  try {
    const posts = await db.all(`
      SELECT p.* FROM posts p
      WHERE p.parent_id IS NULL
      ORDER BY p.created_at DESC
      LIMIT 30 OFFSET ?
    `, [parseInt(req.query.offset) || 0]);
    res.json(await Promise.all(posts.map(p => enrichPost(p, req.userId))));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno' }); }
});

// GET /api/posts/popular  → posts com 2+ curtidas
router.get('/popular', authMiddleware, async (req, res) => {
  try {
    const posts = await db.all(`
      SELECT p.*, COUNT(l.post_id) as like_count FROM posts p
      LEFT JOIN likes l ON l.post_id = p.id
      WHERE p.parent_id IS NULL
      GROUP BY p.id
      HAVING like_count >= 2
      ORDER BY like_count DESC, p.created_at DESC
      LIMIT 30 OFFSET ?
    `, [parseInt(req.query.offset) || 0]);
    res.json(await Promise.all(posts.map(p => enrichPost(p, req.userId))));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno' }); }
});

// GET /api/posts/user/:userId
router.get('/user/:userId', authMiddleware, async (req, res) => {
  try {
    const { tab } = req.query;
    let posts;
    if (tab === 'comments') {
      posts = await db.all(
        'SELECT p.* FROM posts p WHERE p.user_id = ? AND p.parent_id IS NOT NULL ORDER BY p.created_at DESC LIMIT 30',
        [req.params.userId]
      );
    } else if (tab === 'saved') {
      posts = await db.all(
        'SELECT p.* FROM posts p INNER JOIN saved_posts sp ON sp.post_id = p.id WHERE sp.user_id = ? ORDER BY sp.created_at DESC LIMIT 30',
        [req.params.userId]
      );
    } else {
      posts = await db.all(
        'SELECT p.* FROM posts p WHERE p.user_id = ? AND p.parent_id IS NULL ORDER BY p.created_at DESC LIMIT 30',
        [req.params.userId]
      );
    }
    res.json(await Promise.all(posts.map(p => enrichPost(p, req.userId))));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno' }); }
});

// GET /api/posts/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const post = await db.get('SELECT * FROM posts WHERE id = ?', [req.params.id]);
    if (!post) return res.status(404).json({ error: 'Post não encontrado' });
    const replies = await db.all('SELECT * FROM posts WHERE parent_id = ? ORDER BY created_at ASC', [post.id]);
    const [enriched, enrichedReplies] = await Promise.all([
      enrichPost(post, req.userId),
      Promise.all(replies.map(r => enrichPost(r, req.userId)))
    ]);
    res.json({ ...enriched, replies: enrichedReplies });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno' }); }
});

// POST /api/posts
router.post('/', authMiddleware, async (req, res) => {
  const { content, image_url, parent_id } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Conteúdo obrigatório' });
  try {
    // Limita image_url a URLs externas (não base64 grande demais)
    let safeImageUrl = null;
    if (image_url) {
      if (image_url.startsWith('http://') || image_url.startsWith('https://')) {
        safeImageUrl = image_url;
      } else if (image_url.startsWith('data:image/')) {
        // Aceita base64 mas limita a 2MB
        if (image_url.length < 2 * 1024 * 1024) {
          safeImageUrl = image_url;
        }
      }
    }
    const result = await db.run(
      'INSERT INTO posts (user_id, content, image_url, parent_id) VALUES (?, ?, ?, ?)',
      [req.userId, content.trim(), safeImageUrl, parent_id || null]
    );
    if (parent_id) {
      const original = await db.get('SELECT user_id FROM posts WHERE id = ?', [parent_id]);
      if (original && original.user_id !== req.userId) {
        await db.run(
          'INSERT INTO notifications (user_id, actor_id, type, post_id) VALUES (?, ?, ?, ?)',
          [original.user_id, req.userId, 'comment', parent_id]
        );
      }
    }
    const post = await db.get('SELECT * FROM posts WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(await enrichPost(post, req.userId));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno' }); }
});

// DELETE /api/posts/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const post = await db.get('SELECT * FROM posts WHERE id = ?', [req.params.id]);
    if (!post) return res.status(404).json({ error: 'Post não encontrado' });
    if (post.user_id !== req.userId) return res.status(403).json({ error: 'Sem permissão' });
    await db.run('DELETE FROM posts WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno' }); }
});

// POST /api/posts/:id/like
router.post('/:id/like', authMiddleware, async (req, res) => {
  const postId = parseInt(req.params.id);
  try {
    const existing = await db.get('SELECT 1 FROM likes WHERE user_id = ? AND post_id = ?', [req.userId, postId]);
    if (existing) {
      await db.run('DELETE FROM likes WHERE user_id = ? AND post_id = ?', [req.userId, postId]);
      return res.json({ liked: false });
    }
    await db.run('INSERT INTO likes (user_id, post_id) VALUES (?, ?)', [req.userId, postId]);
    const post = await db.get('SELECT user_id FROM posts WHERE id = ?', [postId]);
    if (post && post.user_id !== req.userId) {
      await db.run(
        'INSERT INTO notifications (user_id, actor_id, type, post_id) VALUES (?, ?, ?, ?)',
        [post.user_id, req.userId, 'like', postId]
      );
    }
    res.json({ liked: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno' }); }
});

// POST /api/posts/:id/share
router.post('/:id/share', authMiddleware, async (req, res) => {
  const postId = parseInt(req.params.id);
  try {
    const existing = await db.get('SELECT 1 FROM shares WHERE user_id = ? AND post_id = ?', [req.userId, postId]);
    if (existing) {
      await db.run('DELETE FROM shares WHERE user_id = ? AND post_id = ?', [req.userId, postId]);
      return res.json({ shared: false });
    }
    await db.run('INSERT INTO shares (user_id, post_id) VALUES (?, ?)', [req.userId, postId]);
    const post = await db.get('SELECT user_id FROM posts WHERE id = ?', [postId]);
    if (post && post.user_id !== req.userId) {
      await db.run(
        'INSERT INTO notifications (user_id, actor_id, type, post_id) VALUES (?, ?, ?, ?)',
        [post.user_id, req.userId, 'share', postId]
      );
    }
    res.json({ shared: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno' }); }
});

// POST /api/posts/:id/save
router.post('/:id/save', authMiddleware, async (req, res) => {
  const postId = parseInt(req.params.id);
  try {
    const existing = await db.get('SELECT 1 FROM saved_posts WHERE user_id = ? AND post_id = ?', [req.userId, postId]);
    if (existing) {
      await db.run('DELETE FROM saved_posts WHERE user_id = ? AND post_id = ?', [req.userId, postId]);
      return res.json({ saved: false });
    }
    await db.run('INSERT INTO saved_posts (user_id, post_id) VALUES (?, ?)', [req.userId, postId]);
    res.json({ saved: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno' }); }
});

module.exports = router;