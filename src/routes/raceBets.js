const router = require('express').Router();
const pool = require('../db');

// POST /api/race-bets — хост создаёт гонку
router.post('/', async (req, res) => {
  const { sessionId, guestToken, title, description, options, minAmount, maxAmount, deadline } = req.body;
  if (!sessionId || !guestToken || !title || !options || options.length < 2 || !minAmount || !maxAmount)
    return res.status(400).json({ error: 'Нужны title, минимум 2 варианта, min/max' });

  try {
    const { rows: [host] } = await pool.query(
      `SELECT * FROM players WHERE guest_token=$1 AND session_id=$2 AND is_host=true`,
      [guestToken, sessionId]
    );
    if (!host) return res.status(403).json({ error: 'Только хост может создавать ставки' });

    const { rows: [bet] } = await pool.query(
      `INSERT INTO race_bets (session_id, title, description, min_amount, max_amount, deadline)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [sessionId, title, description || null, parseInt(minAmount), parseInt(maxAmount), deadline || null]
    );

    for (const label of options) {
      await pool.query(
        `INSERT INTO race_bet_options (race_bet_id, label) VALUES ($1,$2)`,
        [bet.id, label.trim()]
      );
    }

    res.json(bet);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/race-bets/:sessionId
router.get('/:sessionId', async (req, res) => {
  try {
    await pool.query(
      `UPDATE race_bets SET status='locked'
       WHERE session_id=$1 AND status='open' AND deadline IS NOT NULL AND deadline < NOW()`,
      [req.params.sessionId]
    );

    const { rows: bets } = await pool.query(
      `SELECT * FROM race_bets WHERE session_id=$1 ORDER BY created_at`,
      [req.params.sessionId]
    );
    const { rows: options } = await pool.query(
      `SELECT o.* FROM race_bet_options o
       JOIN race_bets b ON o.race_bet_id = b.id
       WHERE b.session_id=$1`,
      [req.params.sessionId]
    );
    const { rows: entries } = await pool.query(
      `SELECT e.*, p.nickname FROM race_bet_entries e
       JOIN players p ON e.player_id = p.id
       WHERE e.session_id=$1 ORDER BY e.created_at`,
      [req.params.sessionId]
    );
    res.json({ bets, options, entries });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/race-bets/:id/bet — игрок делает ставку
router.post('/:id/bet', async (req, res) => {
  const { guestToken, optionId, amount } = req.body;
  if (!guestToken || !optionId || !amount)
    return res.status(400).json({ error: 'Нужен guestToken, optionId и сумма' });

  try {
    const { rows: [bet] } = await pool.query(`SELECT * FROM race_bets WHERE id=$1`, [req.params.id]);
    if (!bet) return res.status(404).json({ error: 'Не найдено' });
    if (bet.status !== 'open') return res.status(400).json({ error: 'Приём ставок закрыт' });

    const amt = parseInt(amount);
    if (amt < bet.min_amount || amt > bet.max_amount)
      return res.status(400).json({ error: `Сумма от ${bet.min_amount} до ${bet.max_amount}` });

    const { rows: [player] } = await pool.query(
      `SELECT * FROM players WHERE guest_token=$1 AND session_id=$2`,
      [guestToken, bet.session_id]
    );
    if (!player) return res.status(404).json({ error: 'Игрок не найден' });
    if (player.balance < amt) return res.status(400).json({ error: 'Недостаточно баланса' });

    const { rows: [existing] } = await pool.query(
      `SELECT id FROM race_bet_entries WHERE race_bet_id=$1 AND player_id=$2`,
      [req.params.id, player.id]
    );
    if (existing) return res.status(400).json({ error: 'Ты уже поставил на эту гонку' });

    const { rows: [option] } = await pool.query(
      `SELECT id FROM race_bet_options WHERE id=$1 AND race_bet_id=$2`,
      [optionId, req.params.id]
    );
    if (!option) return res.status(400).json({ error: 'Вариант не найден' });

    await pool.query(`UPDATE players SET balance=balance-$1 WHERE id=$2`, [amt, player.id]);
    await pool.query(`UPDATE sessions SET bank=bank+$1 WHERE id=$2`, [amt, bet.session_id]);

    const { rows: [entry] } = await pool.query(
      `INSERT INTO race_bet_entries (race_bet_id, option_id, player_id, session_id, amount)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.params.id, optionId, player.id, bet.session_id, amt]
    );
    res.json(entry);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/race-bets/:id/lock
router.patch('/:id/lock', async (req, res) => {
  const { guestToken } = req.body;
  try {
    const { rows: [bet] } = await pool.query(`SELECT * FROM race_bets WHERE id=$1`, [req.params.id]);
    if (!bet) return res.status(404).json({ error: 'Не найдено' });

    const { rows: [host] } = await pool.query(
      `SELECT * FROM players WHERE guest_token=$1 AND session_id=$2 AND is_host=true`,
      [guestToken, bet.session_id]
    );
    if (!host) return res.status(403).json({ error: 'Только хост' });

    await pool.query(`UPDATE race_bets SET status='locked' WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/race-bets/:id/resolve — хост выбирает победивший вариант
router.patch('/:id/resolve', async (req, res) => {
  const { guestToken, winningOptionId } = req.body;
  if (!guestToken || !winningOptionId)
    return res.status(400).json({ error: 'Нужен guestToken и winningOptionId' });

  try {
    const { rows: [bet] } = await pool.query(`SELECT * FROM race_bets WHERE id=$1`, [req.params.id]);
    if (!bet) return res.status(404).json({ error: 'Не найдено' });

    const { rows: [host] } = await pool.query(
      `SELECT * FROM players WHERE guest_token=$1 AND session_id=$2 AND is_host=true`,
      [guestToken, bet.session_id]
    );
    if (!host) return res.status(403).json({ error: 'Только хост' });

    const { rows: entries } = await pool.query(
      `SELECT * FROM race_bet_entries WHERE race_bet_id=$1 AND status='pending'`,
      [req.params.id]
    );

    const totalPool = entries.reduce((s, e) => s + Number(e.amount), 0);
    const winners = entries.filter(e => e.option_id === winningOptionId);
    const totalWinningStake = winners.reduce((s, e) => s + Number(e.amount), 0);

    if (winners.length === 0) {
      await pool.query(`UPDATE race_bet_entries SET status='lost' WHERE race_bet_id=$1`, [req.params.id]);
    } else {
      let distributed = 0;
      for (let i = 0; i < winners.length; i++) {
        const isLast = i === winners.length - 1;
        const payout = isLast
          ? totalPool - distributed
          : Math.floor(totalPool * Number(winners[i].amount) / totalWinningStake);
        distributed += payout;
        await pool.query(`UPDATE race_bet_entries SET status='won', payout=$1 WHERE id=$2`, [payout, winners[i].id]);
        await pool.query(`UPDATE players SET balance=balance+$1 WHERE id=$2`, [payout, winners[i].player_id]);
      }
      await pool.query(
        `UPDATE race_bet_entries SET status='lost' WHERE race_bet_id=$1 AND option_id!=$2`,
        [req.params.id, winningOptionId]
      );
      await pool.query(`UPDATE sessions SET bank=bank-$1 WHERE id=$2`, [totalPool, bet.session_id]);
    }

    await pool.query(
      `UPDATE race_bets SET status='resolved', winning_option_id=$1 WHERE id=$2`,
      [winningOptionId, req.params.id]
    );
    res.json({ ok: true, pool: totalPool, winners: winners.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/race-bets/:id
router.delete('/:id', async (req, res) => {
  const { guestToken } = req.body;
  try {
    const { rows: [bet] } = await pool.query(`SELECT * FROM race_bets WHERE id=$1`, [req.params.id]);
    if (!bet) return res.status(404).json({ error: 'Не найдено' });

    const { rows: [host] } = await pool.query(
      `SELECT * FROM players WHERE guest_token=$1 AND session_id=$2 AND is_host=true`,
      [guestToken, bet.session_id]
    );
    if (!host) return res.status(403).json({ error: 'Только хост' });
    if (bet.status === 'resolved') return res.status(400).json({ error: 'Нельзя удалить завершённую' });

    const { rows: entries } = await pool.query(
      `SELECT * FROM race_bet_entries WHERE race_bet_id=$1`, [req.params.id]
    );
    for (const entry of entries) {
      await pool.query(`UPDATE players SET balance=balance+$1 WHERE id=$2`, [entry.amount, entry.player_id]);
      await pool.query(`UPDATE sessions SET bank=bank-$1 WHERE id=$2`, [entry.amount, bet.session_id]);
    }

    await pool.query(`DELETE FROM race_bets WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
