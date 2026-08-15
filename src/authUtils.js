const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;

function signAppJwt(user) {
  return jwt.sign(
    { uid: user.id, email: user.email, name: user.name, picture: user.picture },
    SECRET,
    { expiresIn: '30d' }
  );
}

// Возвращает payload ({uid, email, name, picture}) или null. Никогда не бросает.
function verifyAppJwt(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

module.exports = { signAppJwt, verifyAppJwt };
