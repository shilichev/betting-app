const pool = require('./db');

async function runMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(6) UNIQUE NOT NULL,
      title VARCHAR(255) NOT NULL,
      mode VARCHAR(20) NOT NULL DEFAULT 'pvp',
      status VARCHAR(20) NOT NULL DEFAULT 'waiting',
      host_player_id UUID,
      starting_balance INTEGER DEFAULT 1000,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS players (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
      nickname VARCHAR(100) NOT NULL,
      guest_token VARCHAR(255) NOT NULL,
      is_host BOOLEAN DEFAULT false,
      balance INTEGER DEFAULT 1000,
      joined_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      option_a VARCHAR(255) NOT NULL,
      option_b VARCHAR(255) NOT NULL,
      odds_a FLOAT NOT NULL DEFAULT 2.0,
      odds_b FLOAT NOT NULL DEFAULT 2.0,
      status VARCHAR(20) DEFAULT 'open',
      outcome VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS bets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id UUID REFERENCES events(id) ON DELETE CASCADE,
      player_id UUID REFERENCES players(id) ON DELETE CASCADE,
      side VARCHAR(255) NOT NULL,
      amount INTEGER NOT NULL,
      odds FLOAT NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      payout INTEGER DEFAULT 0,
      placed_at TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log('Migrations done');
}

module.exports = { runMigrations };
