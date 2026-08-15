const router = require('express').Router();
const { OAuth2Client } = require('google-auth-library');
const pool = require('../db');
const { signAppJwt } = require('../authUtils');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// POST /api/auth/google — обмен Google ID-токена на свой JWT
router.post('/google', async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ error: 'idToken required' });

  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    const { rows: [user] } = await pool.query(
      `INSERT INTO users (google_sub, email, name, picture)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (google_sub) DO UPDATE SET email=$2, name=$3, picture=$4
       RETURNING *`,
      [payload.sub, payload.email, payload.name, payload.picture]
    );

    const token = signAppJwt(user);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, picture: user.picture } });
  } catch (e) {
    res.status(401).json({ error: 'Не удалось подтвердить вход через Google' });
  }
});

module.exports = router;
