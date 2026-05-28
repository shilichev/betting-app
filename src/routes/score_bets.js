const router = require('express').Router();
const pool = require('../db');

// POST /api/score-bets — игрок создаёт ставку на точный счёт
router.post('/', async (req, res) => {
  const { sessionId, guestToken, title, prediction, amount } = req.body;
  if (!sessionId || !guestToken || !title || !prediction || !amount) {
    return res.status(400).json({ error: 'sessionId, guestToken, title, prediction, amount required' });
  }
  try {
    const playerRes = await pool.query(`SELECT * FROM players WHERE guest_token=$1 AND session_id=$2`, [guestToken, sessionId]);
    const player = playerRes.rows[0];
    if (!player) return res.status(404).json({ error: 'Player not found' });
    if (player.balance < amount) return res.status(400).json({ error: 'Недостаточно баланса' });

    await pool.query(`UPDATE players SET balance=balance-$1 WHERE id=$2`, [amount, player.id]);

    const { rows } = await pool.query(
      `INSERT INTO score_bets (session_id, player_id, title, prediction, amount)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [sessionId, player.id, title, prediction, amount]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/score-bets/:sessionId — все ставки сессии
router.get('/:sessionId', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT sb.*, p.nickname FROM score_bets sb
       JOIN players p ON sb.player_id=p.id
       WHERE sb.session_id=$1
       ORDER BY sb.created_at DESC`,
      [req.params.sessionId]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/score-bets/:id/confirm — хост подтверждает ставку
router.patch('/:id/confirm', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE score_bets SET status='confirmed' WHERE id=$1 RETURNING *`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/score-bets/:id/won — хост отмечает выигрыш (победитель собирает банк)
router.patch('/:id/won', async (req, res) => {
  try {
    const betRes = await pool.query(`SELECT * FROM score_bets WHERE id=$1`, [req.params.id]);
    const bet = betRes.rows[0];
    if (!bet) return res.status(404).json({ error: 'Not found' });
    if (bet.status !== 'confirmed') return res.status(400).json({ error: 'Ставка должна быть подтверждена' });

    // Банк = сумма всех подтверждённых ставок с тем же title в этой сессии
    const bankRes = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as bank FROM score_bets
       WHERE session_id=$1 AND title=$2 AND status IN ('confirmed','won','lost')`,
      [bet.session_id, bet.title]
    );
    const bank = parseInt(bankRes.rows[0].bank);

    await pool.query(`UPDATE score_bets SET status='won', payout=$1 WHERE id=$2`, [bank, bet.id]);
    await pool.query(`UPDATE players SET balance=balance+$1 WHERE id=$2`, [bank, bet.player_id]);

    // Остальные — проиграли
    await pool.query(
      `UPDATE score_bets SET status='lost' WHERE session_id=$1 AND title=$2 AND id!=$3 AND status='confirmed'`,
      [bet.session_id, bet.title, bet.id]
    );

    res.json({ ok: true, payout: bank });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/score-bets/:id/lost — хост отмечает проигрыш
router.patch('/:id/lost', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE score_bets SET status='lost' WHERE id=$1 RETURNING *`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
