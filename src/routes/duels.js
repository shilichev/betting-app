const router = require('express').Router();
const pool = require('../db');

// POST /api/duels — игрок бросает дуэль
router.post('/', async (req, res) => {
  const { sessionId, guestToken, challengedId, title, amount } = req.body;
  if (!sessionId || !guestToken || !challengedId || !title || !amount)
    return res.status(400).json({ error: 'Не все поля заполнены' });

  try {
    const { rows: [challenger] } = await pool.query(
      `SELECT * FROM players WHERE guest_token=$1 AND session_id=$2`,
      [guestToken, sessionId]
    );
    if (!challenger) return res.status(404).json({ error: 'Игрок не найден' });
    const { rows: [challenged] } = await pool.query(
      `SELECT * FROM players WHERE id=$1 AND session_id=$2`,
      [challengedId, sessionId]
    );
    if (!challenged) return res.status(404).json({ error: 'Соперник не найден' });
    if (challenged.id === challenger.id) return res.status(400).json({ error: 'Нельзя вызвать самого себя' });

    const amt = parseInt(amount);
    if (challenger.balance < amt) return res.status(400).json({ error: 'Недостаточно баланса' });

    // Блокируем деньги у челленджера сразу
    await pool.query(`UPDATE players SET balance=balance-$1 WHERE id=$2`, [amt, challenger.id]);

    const { rows: [duel] } = await pool.query(
      `INSERT INTO duels (session_id, challenger_id, challenged_id, title, amount)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [sessionId, challenger.id, challengedId, title, amt]
    );
    res.json(duel);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/duels/:sessionId
router.get('/:sessionId', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT d.*,
        c.nickname AS challenger_nickname,
        ch.nickname AS challenged_nickname,
        w.nickname AS winner_nickname
       FROM duels d
       JOIN players c  ON d.challenger_id = c.id
       JOIN players ch ON d.challenged_id = ch.id
       LEFT JOIN players w ON d.winner_id = w.id
       WHERE d.session_id=$1
       ORDER BY d.created_at DESC`,
      [req.params.sessionId]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/duels/:id/accept — принять дуэль
router.patch('/:id/accept', async (req, res) => {
  const { guestToken } = req.body;
  try {
    const { rows: [duel] } = await pool.query(`SELECT * FROM duels WHERE id=$1`, [req.params.id]);
    if (!duel) return res.status(404).json({ error: 'Дуэль не найдена' });
    if (duel.status !== 'pending') return res.status(400).json({ error: 'Дуэль уже не ожидает ответа' });

    const { rows: [player] } = await pool.query(
      `SELECT * FROM players WHERE guest_token=$1 AND id=$2`,
      [guestToken, duel.challenged_id]
    );
    if (!player) return res.status(403).json({ error: 'Только вызванный игрок может принять дуэль' });
    if (player.balance < duel.amount) return res.status(400).json({ error: 'Недостаточно баланса' });

    await pool.query(`UPDATE players SET balance=balance-$1 WHERE id=$2`, [duel.amount, player.id]);
    await pool.query(`UPDATE duels SET status='active' WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/duels/:id/decline — отклонить дуэль
router.patch('/:id/decline', async (req, res) => {
  const { guestToken } = req.body;
  try {
    const { rows: [duel] } = await pool.query(`SELECT * FROM duels WHERE id=$1`, [req.params.id]);
    if (!duel) return res.status(404).json({ error: 'Дуэль не найдена' });
    if (duel.status !== 'pending') return res.status(400).json({ error: 'Дуэль уже не ожидает ответа' });

    const { rows: [player] } = await pool.query(
      `SELECT * FROM players WHERE guest_token=$1 AND id=$2`,
      [guestToken, duel.challenged_id]
    );
    if (!player) return res.status(403).json({ error: 'Только вызванный игрок может отклонить дуэль' });

    // Возвращаем деньги челленджеру
    await pool.query(`UPDATE players SET balance=balance+$1 WHERE id=$2`, [duel.amount, duel.challenger_id]);
    await pool.query(`UPDATE duels SET status='declined' WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/duels/:id/cancel — отменить дуэль (только челленджер, пока pending)
router.patch('/:id/cancel', async (req, res) => {
  const { guestToken } = req.body;
  try {
    const { rows: [duel] } = await pool.query(`SELECT * FROM duels WHERE id=$1`, [req.params.id]);
    if (!duel) return res.status(404).json({ error: 'Дуэль не найдена' });
    if (duel.status !== 'pending') return res.status(400).json({ error: 'Отменить можно только ожидающую дуэль' });

    const { rows: [player] } = await pool.query(
      `SELECT * FROM players WHERE guest_token=$1 AND id=$2`,
      [guestToken, duel.challenger_id]
    );
    if (!player) return res.status(403).json({ error: 'Только вызывающий может отменить дуэль' });

    await pool.query(`UPDATE players SET balance=balance+$1 WHERE id=$2`, [duel.amount, duel.challenger_id]);
    await pool.query(`UPDATE duels SET status='cancelled' WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/duels/:id/resolve — хост выбирает победителя
router.patch('/:id/resolve', async (req, res) => {
  const { guestToken, winnerId } = req.body;
  if (!guestToken || !winnerId) return res.status(400).json({ error: 'Нужен guestToken и winnerId' });

  try {
    const { rows: [duel] } = await pool.query(`SELECT * FROM duels WHERE id=$1`, [req.params.id]);
    if (!duel) return res.status(404).json({ error: 'Дуэль не найдена' });
    if (duel.status !== 'active') return res.status(400).json({ error: 'Дуэль не активна' });

    const { rows: [host] } = await pool.query(
      `SELECT * FROM players WHERE guest_token=$1 AND session_id=$2 AND is_host=true`,
      [guestToken, duel.session_id]
    );
    if (!host) return res.status(403).json({ error: 'Только хост может завершить дуэль' });

    if (winnerId !== duel.challenger_id && winnerId !== duel.challenged_id)
      return res.status(400).json({ error: 'Победитель должен быть участником дуэли' });

    const prize = duel.amount * 2;
    await pool.query(`UPDATE players SET balance=balance+$1 WHERE id=$2`, [prize, winnerId]);
    await pool.query(`UPDATE duels SET status='resolved', winner_id=$1 WHERE id=$2`, [winnerId, req.params.id]);
    res.json({ ok: true, prize });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
