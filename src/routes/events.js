const router = require('express').Router();
const pool = require('../db');

// POST /api/events — хост создаёт матч
router.post('/', async (req, res) => {
  const { sessionId, team1, team2 } = req.body;
  if (!sessionId || !team1 || !team2)
    return res.status(400).json({ error: 'sessionId, team1, team2 required' });
  try {
    const title = `${team1} — ${team2}`;
    const { rows: [event] } = await pool.query(
      `INSERT INTO events (session_id, title, option_a, option_b, odds_a, odds_b)
       VALUES ($1,$2,$3,$4,1,1) RETURNING *`,
      [sessionId, title, team1, team2]
    );
    res.json(event);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/events/:id — удалить матч (только пока waiting)
router.delete('/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM events WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/events/:id/resolve — хост указывает победителя
router.patch('/:id/resolve', async (req, res) => {
  const { outcome } = req.body; // 'a', 'b', или 'draw'
  if (!outcome) return res.status(400).json({ error: 'outcome required (a | b | draw)' });
  try {
    await pool.query(
      `UPDATE events SET status='resolved', outcome=$1 WHERE id=$2`,
      [outcome, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
