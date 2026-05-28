const router = require('express').Router();
const pool = require('../db');

// POST /api/events — create event (host only)
router.post('/', async (req, res) => {
  const { sessionId, title, optionA, optionB, oddsA, oddsB } = req.body;
  if (!sessionId || !title || !optionA || !optionB) {
    return res.status(400).json({ error: 'sessionId, title, optionA, optionB required' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO events (session_id, title, option_a, option_b, odds_a, odds_b)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [sessionId, title, optionA, optionB, oddsA || 2.0, oddsB || 2.0]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/events/:id/lock
router.patch('/:id/lock', async (req, res) => {
  try {
    await pool.query(`UPDATE events SET status='locked' WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/events/:id/resolve
router.patch('/:id/resolve', async (req, res) => {
  const { outcome } = req.body; // 'a' or 'b'
  if (!outcome) return res.status(400).json({ error: 'outcome required (a or b)' });

  try {
    const eventRes = await pool.query(`SELECT * FROM events WHERE id=$1`, [req.params.id]);
    const ev = eventRes.rows[0];
    if (!ev) return res.status(404).json({ error: 'Event not found' });

    const winningOption = outcome === 'a' ? ev.option_a : ev.option_b;
    const winningOdds = outcome === 'a' ? ev.odds_a : ev.odds_b;

    await pool.query(`UPDATE events SET status='resolved', outcome=$1 WHERE id=$2`, [winningOption, ev.id]);

    // Update bets
    const bets = await pool.query(`SELECT * FROM bets WHERE event_id=$1`, [ev.id]);

    for (const bet of bets.rows) {
      const won = bet.side === winningOption;
      const payout = won ? Math.floor(bet.amount * bet.odds) : 0;
      await pool.query(`UPDATE bets SET status=$1, payout=$2 WHERE id=$3`, [won ? 'won' : 'lost', payout, bet.id]);

      if (won) {
        await pool.query(`UPDATE players SET balance=balance+$1 WHERE id=$2`, [payout, bet.player_id]);
      }
    }

    res.json({ ok: true, outcome: winningOption });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
