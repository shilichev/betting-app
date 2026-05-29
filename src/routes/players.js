const router = require('express').Router();
const pool = require('../db');

// PATCH /api/players/:id/balance — хост корректирует баланс
router.patch('/:id/balance', async (req, res) => {
  const { delta, reason = 'Корректировка хостом' } = req.body;
  if (delta === undefined) return res.status(400).json({ error: 'delta required' });
  try {
    const { rows: [player] } = await pool.query(
      `UPDATE players SET balance=GREATEST(0, balance+$1) WHERE id=$2 RETURNING *`,
      [delta, req.params.id]
    );
    if (!player) return res.status(404).json({ error: 'Player not found' });
    await pool.query(
      `INSERT INTO balance_log (player_id, delta, reason) VALUES ($1,$2,$3)`,
      [req.params.id, delta, reason]
    );
    res.json(player);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/players/:id — хост удаляет игрока
router.delete('/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM players WHERE id=$1 AND is_host=false`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
