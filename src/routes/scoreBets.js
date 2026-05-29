const router = require('express').Router();
const pool = require('../db');

// POST /api/score-bets — игрок делает ставку на матч
router.post('/', async (req, res) => {
  const { sessionId, guestToken, eventId, prediction, predictedWinner } = req.body;
  if (!sessionId || !guestToken || !eventId || !prediction || !predictedWinner)
    return res.status(400).json({ error: 'Все поля обязательны' });

  try {
    const { rows: [player] } = await pool.query(
      `SELECT * FROM players WHERE guest_token=$1 AND session_id=$2`, [guestToken, sessionId]
    );
    if (!player) return res.status(404).json({ error: 'Player not found' });

    const { rows: [session] } = await pool.query(
      `SELECT * FROM sessions WHERE id=$1`, [sessionId]
    );
    const amount = session.fixed_bet || 100;

    if (player.balance < amount)
      return res.status(400).json({ error: 'Недостаточно баланса' });

    // Проверка на дублирующий счёт
    const { rows: [duplicate] } = await pool.query(
      `SELECT id FROM score_bets WHERE event_id=$1 AND prediction=$2`,
      [eventId, prediction]
    );
    if (duplicate)
      return res.status(400).json({ error: `Счёт ${prediction} уже занят` });

    const { rows: [event] } = await pool.query(
      `SELECT * FROM events WHERE id=$1`, [eventId]
    );
    if (!event) return res.status(404).json({ error: 'Event not found' });

    await pool.query(`UPDATE players SET balance=balance-$1 WHERE id=$2`, [amount, player.id]);
    await pool.query(`UPDATE sessions SET bank=bank+$1 WHERE id=$2`, [amount, sessionId]);

    const { rows: [bet] } = await pool.query(
      `INSERT INTO score_bets (session_id, player_id, event_id, title, prediction, predicted_winner, amount)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [sessionId, player.id, eventId, event.title, prediction, predictedWinner, amount]
    );
    res.json(bet);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/score-bets/:sessionId
router.get('/:sessionId', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT sb.*, p.nickname
       FROM score_bets sb
       JOIN players p ON sb.player_id=p.id
       WHERE sb.session_id=$1
       ORDER BY sb.created_at`,
      [req.params.sessionId]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/score-bets/:id/won — победитель забирает банк матча
router.patch('/:id/won', async (req, res) => {
  try {
    const { rows: [bet] } = await pool.query(`SELECT * FROM score_bets WHERE id=$1`, [req.params.id]);
    if (!bet) return res.status(404).json({ error: 'Not found' });

    // Банк берём из сессии (сохраняется даже при удалении матчей)
    const { rows: [session] } = await pool.query(
      `SELECT bank FROM sessions WHERE id=$1`, [bet.session_id]
    );
    const bank = session.bank;

    await pool.query(`UPDATE score_bets SET status='won', payout=$1 WHERE id=$2`, [bank, bet.id]);
    await pool.query(`UPDATE players SET balance=balance+$1 WHERE id=$2`, [bank, bet.player_id]);
    await pool.query(`UPDATE sessions SET bank=0 WHERE id=$1`, [bet.session_id]);
    await pool.query(
      `UPDATE score_bets SET status='lost' WHERE event_id=$1 AND id!=$2 AND status!='won'`,
      [bet.event_id, bet.id]
    );
    await pool.query(`UPDATE events SET status='resolved', outcome='manual' WHERE id=$1`, [bet.event_id]);

    res.json({ ok: true, payout: bank });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/score-bets/:id/lost
router.patch('/:id/lost', async (req, res) => {
  try {
    await pool.query(`UPDATE score_bets SET status='lost' WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
