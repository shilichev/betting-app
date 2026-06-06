const router = require('express').Router();
const pool = require('../db');

// POST /api/prop-bets — хост создаёт ставку
router.post('/', async (req, res) => {
  const { sessionId, guestToken, title, description, odds, minAmount, maxAmount, deadline } = req.body;
  if (!sessionId || !guestToken || !title || !odds || !minAmount || !maxAmount)
    return res.status(400).json({ error: 'Не все поля заполнены' });

  try {
    const { rows: [player] } = await pool.query(
      `SELECT * FROM players WHERE guest_token=$1 AND session_id=$2 AND is_host=true`,
      [guestToken, sessionId]
    );
    if (!player) return res.status(403).json({ error: 'Только хост может создавать ставки' });

    if (maxAmount % minAmount !== 0)
      return res.status(400).json({ error: 'Максимум должен быть кратен минимуму' });

    const { rows: [bet] } = await pool.query(
      `INSERT INTO prop_bets (session_id, title, description, odds, min_amount, max_amount, deadline)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [sessionId, title, description || null, parseFloat(odds), parseInt(minAmount), parseInt(maxAmount), deadline || null]
    );
    res.json(bet);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/prop-bets/:sessionId — получить все с записями игроков (авто-лок по дедлайну)
router.get('/:sessionId', async (req, res) => {
  try {
    // Авто-лок ставок у которых истёк дедлайн
    await pool.query(
      `UPDATE prop_bets SET status='locked'
       WHERE session_id=$1 AND status='open' AND deadline IS NOT NULL AND deadline < NOW()`,
      [req.params.sessionId]
    );

    const { rows: bets } = await pool.query(
      `SELECT * FROM prop_bets WHERE session_id=$1 ORDER BY created_at`,
      [req.params.sessionId]
    );
    const { rows: entries } = await pool.query(
      `SELECT e.*, p.nickname
       FROM prop_bet_entries e
       JOIN players p ON e.player_id = p.id
       WHERE e.session_id=$1
       ORDER BY e.created_at`,
      [req.params.sessionId]
    );
    res.json({ bets, entries });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/prop-bets/:id/lock — хост вручную закрывает приём
router.patch('/:id/lock', async (req, res) => {
  const { guestToken } = req.body;
  try {
    const { rows: [bet] } = await pool.query(`SELECT * FROM prop_bets WHERE id=$1`, [req.params.id]);
    if (!bet) return res.status(404).json({ error: 'Не найдено' });

    const { rows: [host] } = await pool.query(
      `SELECT * FROM players WHERE guest_token=$1 AND session_id=$2 AND is_host=true`,
      [guestToken, bet.session_id]
    );
    if (!host) return res.status(403).json({ error: 'Только хост' });

    await pool.query(`UPDATE prop_bets SET status='locked' WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/prop-bets/:id/bet — игрок делает ставку
router.post('/:id/bet', async (req, res) => {
  const { guestToken, amount } = req.body;
  if (!guestToken || !amount)
    return res.status(400).json({ error: 'Нужен guestToken и сумма' });

  try {
    const { rows: [bet] } = await pool.query(
      `SELECT * FROM prop_bets WHERE id=$1`, [req.params.id]
    );
    if (!bet) return res.status(404).json({ error: 'Ставка не найдена' });
    if (bet.status !== 'open') return res.status(400).json({ error: 'Ставка закрыта' });

    const amt = parseInt(amount);
    if (amt < bet.min_amount || amt > bet.max_amount)
      return res.status(400).json({ error: `Сумма должна быть от ${bet.min_amount} до ${bet.max_amount}` });

    const { rows: [player] } = await pool.query(
      `SELECT * FROM players WHERE guest_token=$1 AND session_id=$2`,
      [guestToken, bet.session_id]
    );
    if (!player) return res.status(404).json({ error: 'Игрок не найден' });
    if (player.balance < amt) return res.status(400).json({ error: 'Недостаточно баланса' });

    const { rows: [existing] } = await pool.query(
      `SELECT id FROM prop_bet_entries WHERE prop_bet_id=$1 AND player_id=$2`,
      [req.params.id, player.id]
    );
    if (existing) return res.status(400).json({ error: 'Ты уже поставил на эту ставку' });

    await pool.query(`UPDATE players SET balance=balance-$1 WHERE id=$2`, [amt, player.id]);
    await pool.query(`UPDATE sessions SET bank=bank+$1 WHERE id=$2`, [amt, bet.session_id]);

    const { rows: [entry] } = await pool.query(
      `INSERT INTO prop_bet_entries (prop_bet_id, player_id, session_id, amount)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.params.id, player.id, bet.session_id, amt]
    );
    res.json(entry);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/prop-bets/:id/resolve — хост разрешает
router.patch('/:id/resolve', async (req, res) => {
  const { outcome, guestToken } = req.body; // outcome: 'won' | 'lost'
  if (!outcome || !guestToken)
    return res.status(400).json({ error: 'Нужен outcome и guestToken' });

  try {
    const { rows: [bet] } = await pool.query(
      `SELECT * FROM prop_bets WHERE id=$1`, [req.params.id]
    );
    if (!bet) return res.status(404).json({ error: 'Ставка не найдена' });

    const { rows: [host] } = await pool.query(
      `SELECT * FROM players WHERE guest_token=$1 AND session_id=$2 AND is_host=true`,
      [guestToken, bet.session_id]
    );
    if (!host) return res.status(403).json({ error: 'Только хост' });

    const { rows: entries } = await pool.query(
      `SELECT * FROM prop_bet_entries WHERE prop_bet_id=$1 AND status='pending'`,
      [req.params.id]
    );

    if (outcome === 'won') {
      for (const entry of entries) {
        const payout = Math.floor(entry.amount * bet.odds);
        await pool.query(`UPDATE prop_bet_entries SET status='won', payout=$1 WHERE id=$2`, [payout, entry.id]);
        await pool.query(`UPDATE players SET balance=balance+$1 WHERE id=$2`, [payout, entry.player_id]);
        await pool.query(`UPDATE sessions SET bank=bank-$1 WHERE id=$2`, [payout, bet.session_id]);
      }
    } else {
      await pool.query(`UPDATE prop_bet_entries SET status='lost' WHERE prop_bet_id=$1`, [req.params.id]);
    }

    await pool.query(`UPDATE prop_bets SET status=$1 WHERE id=$2`, [outcome, req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/prop-bets/:id — хост удаляет (пока открыта)
router.delete('/:id', async (req, res) => {
  const { guestToken } = req.body;
  try {
    const { rows: [bet] } = await pool.query(`SELECT * FROM prop_bets WHERE id=$1`, [req.params.id]);
    if (!bet) return res.status(404).json({ error: 'Не найдено' });

    const { rows: [host] } = await pool.query(
      `SELECT * FROM players WHERE guest_token=$1 AND session_id=$2 AND is_host=true`,
      [guestToken, bet.session_id]
    );
    if (!host) return res.status(403).json({ error: 'Только хост' });
    if (bet.status !== 'open') return res.status(400).json({ error: 'Нельзя удалить закрытую ставку' });

    // Возвращаем деньги игрокам
    const { rows: entries } = await pool.query(
      `SELECT * FROM prop_bet_entries WHERE prop_bet_id=$1`, [req.params.id]
    );
    for (const entry of entries) {
      await pool.query(`UPDATE players SET balance=balance+$1 WHERE id=$2`, [entry.amount, entry.player_id]);
      await pool.query(`UPDATE sessions SET bank=bank-$1 WHERE id=$2`, [entry.amount, bet.session_id]);
    }

    await pool.query(`DELETE FROM prop_bets WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
