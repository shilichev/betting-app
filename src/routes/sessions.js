const router = require('express').Router();
const pool = require('../db');
const { v4: uuidv4 } = require('uuid');

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// POST /api/sessions — create room
router.post('/', async (req, res) => {
  const { title, mode, nickname, startingBalance } = req.body;
  if (!title || !nickname) return res.status(400).json({ error: 'title and nickname required' });

  const code = generateCode();
  const guestToken = uuidv4();
  const balance = startingBalance || 1000;

  try {
    const sessionRes = await pool.query(
      `INSERT INTO sessions (code, title, mode, starting_balance) VALUES ($1,$2,$3,$4) RETURNING *`,
      [code, title, mode || 'pvp', balance]
    );
    const session = sessionRes.rows[0];

    const playerRes = await pool.query(
      `INSERT INTO players (session_id, nickname, guest_token, is_host, balance) VALUES ($1,$2,$3,true,$4) RETURNING *`,
      [session.id, nickname, guestToken, balance]
    );
    const player = playerRes.rows[0];

    await pool.query(`UPDATE sessions SET host_player_id=$1 WHERE id=$2`, [player.id, session.id]);

    res.json({ session: { ...session, host_player_id: player.id }, player, guestToken });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/sessions/:code — get session by code
router.get('/:code', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM sessions WHERE code=$1`, [req.params.code.toUpperCase()]);
    if (!rows[0]) return res.status(404).json({ error: 'Session not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/sessions/:id/full — full session state
router.get('/:id/full', async (req, res) => {
  try {
    const sessionRes = await pool.query(`SELECT * FROM sessions WHERE id=$1`, [req.params.id]);
    if (!sessionRes.rows[0]) return res.status(404).json({ error: 'Not found' });

    const players = await pool.query(`SELECT id, nickname, is_host, balance FROM players WHERE session_id=$1 ORDER BY joined_at`, [req.params.id]);
    const events = await pool.query(`SELECT * FROM events WHERE session_id=$1 ORDER BY created_at DESC`, [req.params.id]);

    const eventsWithBets = await Promise.all(events.rows.map(async (ev) => {
      const bets = await pool.query(
        `SELECT b.*, p.nickname FROM bets b JOIN players p ON b.player_id=p.id WHERE b.event_id=$1`,
        [ev.id]
      );
      return { ...ev, bets: bets.rows };
    }));

    res.json({ session: sessionRes.rows[0], players: players.rows, events: eventsWithBets });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/sessions/:id/join
router.post('/:id/join', async (req, res) => {
  const { nickname } = req.body;
  if (!nickname) return res.status(400).json({ error: 'nickname required' });

  try {
    const sessionRes = await pool.query(`SELECT * FROM sessions WHERE id=$1`, [req.params.id]);
    if (!sessionRes.rows[0]) return res.status(404).json({ error: 'Session not found' });
    const session = sessionRes.rows[0];

    const guestToken = uuidv4();
    const { rows } = await pool.query(
      `INSERT INTO players (session_id, nickname, guest_token, balance) VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.params.id, nickname, guestToken, session.starting_balance]
    );
    res.json({ player: rows[0], guestToken });
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
