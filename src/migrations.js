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

    CREATE TABLE IF NOT EXISTS score_bets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
      player_id UUID REFERENCES players(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      prediction VARCHAR(50) NOT NULL,
      amount INTEGER NOT NULL,
      status VARCHAR(20) DEFAULT 'created',
      payout INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS matches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS balance_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      player_id UUID REFERENCES players(id) ON DELETE CASCADE,
      delta INTEGER NOT NULL,
      reason VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      google_sub VARCHAR(255) UNIQUE NOT NULL,
      email VARCHAR(255),
      name VARCHAR(255),
      picture TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Новые колонки (безопасно, IF NOT EXISTS)
  await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS fixed_bet INTEGER DEFAULT 100`);
  await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS bank INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS pin VARCHAR(10)`);
  await pool.query(`ALTER TABLE score_bets ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE CASCADE`);
  await pool.query(`ALTER TABLE score_bets ADD COLUMN IF NOT EXISTS predicted_winner VARCHAR(20) DEFAULT 'draw'`);
  await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS score_bet_amount INTEGER DEFAULT NULL`);
  await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS deadline TIMESTAMP DEFAULT NULL`);
  await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS min_bet INTEGER DEFAULT 50`);
  await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS max_bet INTEGER DEFAULT 500`);
  await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS bet_step INTEGER DEFAULT 50`);
  await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false`);
  await pool.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_players_user_id ON players(user_id) WHERE user_id IS NOT NULL`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS duels (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
      challenger_id UUID REFERENCES players(id) ON DELETE CASCADE,
      challenged_id UUID REFERENCES players(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      amount INTEGER NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      winner_id UUID REFERENCES players(id),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS race_bets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      min_amount INTEGER NOT NULL,
      max_amount INTEGER NOT NULL,
      status VARCHAR(20) DEFAULT 'open',
      winning_option_id UUID,
      deadline TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS race_bet_options (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      race_bet_id UUID REFERENCES race_bets(id) ON DELETE CASCADE,
      label VARCHAR(255) NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS race_bet_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      race_bet_id UUID REFERENCES race_bets(id) ON DELETE CASCADE,
      option_id UUID REFERENCES race_bet_options(id) ON DELETE CASCADE,
      player_id UUID REFERENCES players(id) ON DELETE CASCADE,
      session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL,
      payout INTEGER,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS prop_bets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      odds FLOAT NOT NULL,
      min_amount INTEGER NOT NULL,
      max_amount INTEGER NOT NULL,
      status VARCHAR(20) DEFAULT 'open',
      deadline TIMESTAMP DEFAULT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS prop_bet_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      prop_bet_id UUID REFERENCES prop_bets(id) ON DELETE CASCADE,
      player_id UUID REFERENCES players(id) ON DELETE CASCADE,
      session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL,
      payout INTEGER,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  console.log('✅ Migrations done');
}

module.exports = { runMigrations };
