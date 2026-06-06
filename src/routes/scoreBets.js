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
    const { rows: [eventForAmount] } = await pool.query(
      `SELECT score_bet_amount FROM events WHERE id=$1`, [eventId]
    );
    const amount = eventForAmount?.score_bet_amount ?? session.fixed_bet ?? 100;

    if (player.balance < amount)
      return res.status(400).json({ error: 'Недостаточно баланса' });

    const { rows: [dupScore] } = await pool.query(
      `SELECT id FROM score_bets WHERE event_id=$1 AND player_id=$2 AND prediction=$3`,
      [eventId, player.id, prediction]
    );
    if (dupScore)
      return res.status(400).json({ error: 'Ты уже поставил на этот счёт' });

    const { rows: [{ count: matchBetsCount }] } = await pool.query(
      `SELECT COUNT(*) FROM score_bets WHERE event_id=$1 AND player_id=$2`,
      [eventId, player.id]
    );
    if (parseInt(matchBetsCount) >= 3)
      return res.status(400).json({ error: 'Максимум 3 ставки на один матч' });

    const { rows: [event] } = await pool.query(
      `SELECT * FROM events WHERE id=$1`, [eventId]
    );
    if (!event) return res.status(404).json({ error: 'Event not found' });

    await pool.query(`UPDATE players SET balance=balance-$1 WHERE id=$2`, [amount, player.id]);

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

// PATCH /api/score-bets/event/:eventId/resolve — хост вводит реальный счёт, банк делится между угадавшими
router.patch('/event/:eventId/resolve', async (req, res) => {
  const { actualScore, guestToken } = req.body;
  if (!actualScore || !guestToken)
    return res.status(400).json({ error: 'Нужен счёт и guestToken' });

  try {
    const { rows: [event] } = await pool.query(`SELECT * FROM events WHERE id=$1`, [req.params.eventId]);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const { rows: [host] } = await pool.query(
      `SELECT * FROM players WHERE guest_token=$1 AND session_id=$2 AND is_host=true`,
      [guestToken, event.session_id]
    );
    if (!host) return res.status(403).json({ error: 'Только хост может завершить матч' });

    const { rows: bets } = await pool.query(
      `SELECT * FROM score_bets WHERE event_id=$1 AND status='created'`,
      [req.params.eventId]
    );
    const { rows: [session] } = await pool.query(
      `SELECT bank FROM sessions WHERE id=$1`, [event.session_id]
    );

    const matchBank = bets.reduce((s, b) => s + Number(b.amount), 0);
    const winners = bets.filter(b => b.prediction === actualScore);

    if (winners.length === 0) {
      await pool.query(`UPDATE score_bets SET status='lost' WHERE event_id=$1`, [req.params.eventId]);
      await pool.query(`UPDATE sessions SET bank=bank+$1 WHERE id=$2`, [matchBank, event.session_id]);
    } else {
      const payoutEach = Math.floor(matchBank / winners.length);
      const remainder = matchBank - payoutEach * winners.length;

      for (let i = 0; i < winners.length; i++) {
        const payout = payoutEach + (i === 0 ? remainder : 0);
        await pool.query(`UPDATE score_bets SET status='won', payout=$1 WHERE id=$2`, [payout, winners[i].id]);
        await pool.query(`UPDATE players SET balance=balance+$1 WHERE id=$2`, [payout, winners[i].player_id]);
      }

      const winnerIds = winners.map(w => w.id);
      await pool.query(
        `UPDATE score_bets SET status='lost' WHERE event_id=$1 AND id != ALL($2)`,
        [req.params.eventId, winnerIds]
      );
      // jackpot (session.bank) stays unchanged — it only grows when nobody wins
    }

    await pool.query(
      `UPDATE events SET status='resolved', outcome=$1 WHERE id=$2`,
      [actualScore, req.params.eventId]
    );

    res.json({ ok: true, winners: winners.length, jackpot: Number(session.bank) || 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
