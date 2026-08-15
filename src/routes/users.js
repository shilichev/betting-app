const router = require('express').Router();
const pool = require('../db');
const { verifyAppJwt } = require('../authUtils');

// GET /api/users/me/sessions — комнаты, где у вызывающего есть строка в players
router.get('/me/sessions', async (req, res) => {
  const auth = verifyAppJwt(req);
  if (!auth) return res.status(401).json({ error: 'Не авторизован' });

  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.code, s.title, s.status, s.created_at,
              bool_or(p.is_host) AS is_host,
              (SELECT COUNT(*) FROM players p2 WHERE p2.session_id = s.id) AS player_count
       FROM sessions s
       JOIN players p ON p.session_id = s.id
       WHERE p.user_id = $1
       GROUP BY s.id
       ORDER BY (s.status = 'finished') ASC, s.created_at DESC`,
      [auth.uid]
    );
    res.json(rows.map(r => ({
      id: r.id,
      code: r.code,
      title: r.title,
      status: r.status,
      isHost: r.is_host,
      playerCount: Number(r.player_count),
      createdAt: r.created_at,
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
