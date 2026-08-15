const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const pool = require('../db');
const { v4: uuidv4 } = require('uuid');
const { verifyAppJwt } = require('../authUtils');

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
  keyGenerator: (req) => `${ipKeyGenerator(req)}-${req.params.id}`,
  skipSuccessfulRequests: true, // не считаем успешные входы
});

// POST /api/sessions — создать комнату (только для авторизованных через Google)
router.post('/', async (req, res) => {
  const auth = verifyAppJwt(req);
  if (!auth) return res.status(401).json({ error: 'Войдите через Google, чтобы создать комнату' });

  const {
    title, nickname, startingBalance = 1000,
    minBet = 50, maxBet = 500, betStep = 50, isPrivate = false,
  } = req.body;
  const finalNickname = nickname || auth.name || 'Хост';
  if (!title) return res.status(400).json({ error: 'title required' });
  if (minBet <= 0 || betStep <= 0) return res.status(400).json({ error: 'Мин. ставка и шаг должны быть больше нуля' });
  if (maxBet < minBet) return res.status(400).json({ error: 'Макс. ставка не может быть меньше минимальной' });

  const code = generateCode();
  const guestToken = uuidv4();

  try {
    const { rows: [session] } = await pool.query(
      `INSERT INTO sessions (code, title, mode, starting_balance, fixed_bet, min_bet, max_bet, bet_step, is_private)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [code, title, 'bankroll', startingBalance, minBet, minBet, maxBet, betStep, !!isPrivate]
    );

    const pin = await generateUniquePin(session.id);

    const { rows: [player] } = await pool.query(
      `INSERT INTO players (session_id, nickname, guest_token, is_host, balance, pin, user_id) VALUES ($1,$2,$3,true,$4,$5,$6) RETURNING *`,
      [session.id, finalNickname, guestToken, startingBalance, pin, auth.uid]
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
    if (rows[0].is_private) return res.status(403).json({ error: 'Комната приватная — нужна ссылка-приглашение' });
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
    // Авто-лок матчей у которых истёк дедлайн
    await pool.query(
      `UPDATE events SET status='locked'
       WHERE session_id=$1 AND status='open' AND deadline IS NOT NULL AND deadline < NOW()`,
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
  const auth = verifyAppJwt(req); // опционально — гость может входить и без Google

  try {
    const { rows: [session] } = await pool.query(`SELECT * FROM sessions WHERE id=$1`, [req.params.id]);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    // Rejoin — пришёл PIN, ищем существующего игрока
    if (pin) {
      const { rows: [existing] } = await pool.query(
        `SELECT * FROM players WHERE session_id=$1 AND pin=$2`, [req.params.id, pin]
      );
      if (!existing) return res.status(404).json({ error: 'Игрок с таким PIN не найден' });

      // Если игрок раньше был анонимным, а сейчас вошёл через Google — привязываем аккаунт
      if (auth && !existing.user_id) {
        await pool.query(`UPDATE players SET user_id=$1 WHERE id=$2`, [auth.uid, existing.id]);
        existing.user_id = auth.uid;
      }
      return res.json({ player: existing, guestToken: existing.guest_token, pin: existing.pin, rejoin: true });
    }

    // Новый игрок — сервер генерирует уникальный PIN
    if (!nickname) return res.status(400).json({ error: 'nickname required' });

    const generatedPin = await generateUniquePin(req.params.id);
    const guestToken = uuidv4();
    const { rows: [player] } = await pool.query(
      `INSERT INTO players (session_id, nickname, guest_token, balance, pin, user_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.params.id, nickname, guestToken, session.starting_balance, generatedPin, auth ? auth.uid : null]
    );
    res.json({ player, guestToken, pin: generatedPin });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/sessions/:id/my-player — авторизованный пользователь восстанавливает свою
// игровую личность в комнате без PIN (личность уже подтверждена Google-логином)
router.get('/:id/my-player', async (req, res) => {
  const auth = verifyAppJwt(req);
  if (!auth) return res.status(401).json({ error: 'Не авторизован' });

  try {
    const { rows: [player] } = await pool.query(
      `SELECT * FROM players WHERE session_id=$1 AND user_id=$2 ORDER BY joined_at DESC LIMIT 1`,
      [req.params.id, auth.uid]
    );
    if (!player) return res.status(404).json({ error: 'В этой комнате нет твоего игрока' });
    res.json({ player, guestToken: player.guest_token, pin: player.pin });
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
    if (rows[0].is_private) return res.status(403).json({ error: 'Комната приватная — нужна ссылка-приглашение' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
