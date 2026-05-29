const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const pool = require('../db');
const { v4: uuidv4 } = require('uuid');

const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

// Генерирует уникальный 6-значный PIN для сессии
async function generateUniquePin(sessionId) {
  let pin, exists;
  do {
    pin = Math.floor(100000 + Math.random() * 900000).toString();
    const { rows } = await pool.query(
      `SELECT id FROM players WHERE session_id=$1 AND pin=$2`, [sessionId, pin]
    );
    exists = rows.length > 0;
  } while (exists);
  return pin;
}

// Rate limit: 5 попыток за 5 минут с одного IP
const joinLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  message: { error: 'Слишком много попыток входа. Подожди 5 минут.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}-${req.params.id}`,
  skipSuccessfulRequests: true, // не считаем успешные входы
});

// POST /api/sessions — создать комнату
router.post('/', async (req, res) => {
  const { title, nickname, startingBalance = 1000, fixedBet = 100 } = req.body;
  if (!title || !nickname) return res.status(400).json({ error: 'title and nickname required' });

  const code = generateCode();
  const guestToken = uuidv4();

  try {
    const { rows: [session] } = await pool.query(
      `INSERT INTO sessions (code, title, mode, starting_balance, fixed_bet) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [code, title, 'bankroll', startingBalance, fixedBet]
    );

    const pin = await generateUniquePin(session.id);

    const { rows: [player] } = await pool.query(
      `INSERT INTO players (session_id, nickname, guest_token, is_host, balance, pin) VALUES ($1,$2,$3,true,$4,$5) RETURNING *`,
      [session.id, nickname, guestToken, startingBalance, pin]
    );
    await pool.query(`UPDATE sessions SET host_player_id=$1 WHERE id=$2`, [player.id, session.id]);

    res.json({ session: { ...session, host_player_id: player.id }, player, guestToken, pin });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/sessions/:code — найти по коду (должен быть раньше /:id)
router.get('/by-code/:code', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM sessions WHERE code=$1`, [req.params.code.toUpperCase()]);
    if (!rows[0]) return res.status(404).json({ error: 'Комната не найдена' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/sessions/:id/full
router.get('/:id/full', async (req, res) => {
  try {
    const { rows: [session] } = await pool.query(`SELECT * FROM sessions WHERE id=$1`, [req.params.id]);
    if (!session) return res.status(404).json({ error: 'Not found' });

    const { rows: players } = await pool.query(
      `SELECT id, nickname, is_host, balance, pin FROM players WHERE session_id=$1 ORDER BY joined_at`,
      [req.params.id]
    );
    const { rows: events } = await pool.query(
      `SELECT * FROM events WHERE session_id=$1 ORDER BY created_at`,
      [req.params.id]
    );

    res.json({ session, players, events });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/sessions/:id/join
// Без pin → новый игрок, сервер генерирует PIN
// С pin → rejoin по существующему PIN
router.post('/:id/join', joinLimiter, async (req, res) => {
  const { nickname, pin } = req.body;

  try {
    const { rows: [session] } = await pool.query(`SELECT * FROM sessions WHERE id=$1`, [req.params.id]);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    // Rejoin — пришёл PIN, ищем существующего игрока
    if (pin) {
      const { rows: [existing] } = await pool.query(
        `SELECT * FROM players WHERE session_id=$1 AND pin=$2`, [req.params.id, pin]
      );
      if (existing) {
        return res.json({ player: existing, guestToken: existing.guest_token, pin: existing.pin, rejoin: true });
      }
      return res.status(404).json({ error: 'Игрок с таким PIN не найден' });
    }

    // Новый игрок — сервер генерирует уникальный PIN
    if (!nickname) return res.status(400).json({ error: 'nickname required' });

    const generatedPin = await generateUniquePin(req.params.id);
    const guestToken = uuidv4();
    const { rows: [player] } = await pool.query(
      `INSERT INTO players (session_id, nickname, guest_token, balance, pin) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.params.id, nickname, guestToken, session.starting_balance, generatedPin]
    );
    res.json({ player, guestToken, pin: generatedPin });
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

// Обратная совместимость: GET /api/sessions/:code (старый путь)
router.get('/:code', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM sessions WHERE code=$1`, [req.params.code.toUpperCase()]);
    if (!rows[0]) return res.status(404).json({ error: 'Комната не найдена' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
