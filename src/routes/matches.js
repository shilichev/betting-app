const router = require('express').Router();
const pool = require('../db');

// POST /api/matches
router.post('/', async (req, res) => {
  const { sessionId, title } = req.body;
  if (!sessionId || !title) return res.status(400).json({ error: 'sessionId and title required' });
  try {
    const { rows: [match] } = await pool.query(
      `INSERT INTO matches (session_id, title) VALUES ($1,$2) RETURNING *`,
      [sessionId, title]
    );
    res.json(match);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/matches/:id
router.delete('/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM matches WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/matches/:sessionId
router.get('/:sessionId', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM matches WHERE session_id=$1 ORDER BY created_at`,
      [req.params.sessionId]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
