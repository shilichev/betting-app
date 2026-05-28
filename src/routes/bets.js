const router = require('express').Router();
const pool = require('../db');

// POST /api/bets — сделать ставку
router.post('/', async (req, res) => {
  const { eventId, guestToken, side, amount } = req.body;
  if (!eventId || !guestToken || !side || !amount)
    return res.status(400).json({ error: 'eventId, guestToken, side, amount required' });

  try {
    const { rows: [ev] } = await pool.query(`SELECT * FROM events WHERE id=$1`, [eventId]);
    if (!ev) return res.status(404).json({ error: 'Event not found' });
    if (ev.status !== 'open') return res.status(400).json({ error: 'Приём ставок закрыт' });

    const { rows: [player] } = await pool.query(`SELECT * FROM players WHERE guest_token=$1`, [guestToken]);
    if (!player) return res.status(404).json({ error: 'Player not found' });
    if (player.balance < amount) return res.status(400).json({ error: 'Недостаточно баланса' });

    const { rows: [existing] } = await pool.query(
      `SELECT id FROM bets WHERE event_id=$1 AND player_id=$2`, [eventId, player.id]
    );
    if (existing) return res.status(400).json({ error: 'Ставка уже сделана' });

    const odds = side === ev.option_a ? ev.odds_a : ev.odds_b;
    await pool.query(`UPDATE players SET balance=balance-$1 WHERE id=$2`, [amount, player.id]);
    const { rows: [bet] } = await pool.query(
      `INSERT INTO bets (event_id, player_id, side, amount, odds) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [eventId, player.id, side, amount, odds]
    );
    res.json(bet);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
