const router = require('express').Router();
const pool = require('../db');
const { v4: uuidv4 } = require('uuid');

const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

// POST /api/sessions — создать комнату
router.post('/', async (req, res) => {
  const { title, nickname, startingBalance = 1000, fixedBet = 100, pin } = req.body;
  if (!title || !nickname || !pin) return res.status(400).json({ error: 'title, nickname, pin required' });

  const code = generateCode();
  const guestToken = uuidv4();

  try {
    const { rows: [session] } = await pool.query(
      `INSERT INTO sessions (code, title, mode, starting_balance, fixed_bet) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [code, title, 'bankroll', startingBalance, fixedBet]
    );
    const { rows: [player] } = await pool.query(
      `INSERT INTO players (session_id, nickname, guest_token, is_host, balance, pin) VALUES ($1,$2,$3,true,$4,$5) RETURNING *`,
      [session.id, nickname, guestToken, startingBalance, pin]
    );
    await pool.query(`UPDATE sessions SET host_player_id=$1 WHERE id=$2`, [player.id, session.id]);

    res.json({ session: { ...session, host_player_id: player.id }, player, guestToken });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/sessions/:code — найти по коду
router.get('/:code', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM sessions WHERE code=$1`, [req.params.code.toUpperCase()]);
    if (!rows[0]) return res.status(404).json({ error: 'Комната не найдена' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/sessions/:id/full — полное состояние (сессия + игроки + события + ставки)
router.get('/:id/full', async (req, res) => {
  try {
    const { rows: [session] } = await pool.query(`SELECT * FROM sessions WHERE id=$1`, [req.params.id]);
    if (!session) return res.status(404).json({ error: 'Not found' });

    const { rows: players } = await pool.query(
      `SELECT id, nickname, is_host, balance, pin FROM players WHERE session_id=$1 ORDER BY joined_at`,
      [req.params.id]
    );
    const { rows: events } = await pool.query(
      `SELECT * FROM events WHERE session_id=$1 ORDER BY created_at DESC`,
      [req.params.id]
    );

    // Подтягиваем ставки к каждому событию
    const eventsWithBets = await Promise.all(events.map(async (ev) => {
      const { rows: bets } = await pool.query(
        `SELECT b.*, p.nickname FROM bets b JOIN players p ON b.player_id=p.id WHERE b.event_id=$1`,
        [ev.id]
      );
      return { ...ev, bets };
    }));

    res.json({ session, players, events: eventsWithBets });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/sessions/:id/join — войти или восстановить сессию по PIN
router.post('/:id/join', async (req, res) => {
  const { nickname, pin } = req.body;
  if (!pin) return res.status(400).json({ error: 'pin required' });
  try {
    const { rows: [session] } = await pool.query(`SELECT * FROM sessions WHERE id=$1`, [req.params.id]);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    // Если игрок с таким PIN уже есть — возвращаем его данные (rejoin)
    const { rows: [existing] } = await pool.query(
      `SELECT * FROM players WHERE session_id=$1 AND pin=$2`, [req.params.id, pin]
    );
    if (existing) {
      return res.json({ player: existing, guestToken: existing.guest_token });
    }

    if (!nickname) return res.status(400).json({ error: 'nickname required for new player' });

    const guestToken = uuidv4();
    const { rows: [player] } = await pool.query(
      `INSERT INTO players (session_id, nickname, guest_token, balance, pin) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.params.id, nickname, guestToken, session.starting_balance, pin]
    );
    res.json({ player, guestToken });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/sessions/:id/start
router.patch('/:id/start', async (req, res) => {
  try {
    await pool.query(`UPDATE sessions SET status='active' WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/sessions/:id/finish
router.patch('/:id/finish', async (req, res) => {
  try {
    await pool.query(`UPDATE sessions SET status='finished' WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
