require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { runMigrations } = require('./migrations');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());

// API routes
app.use('/api/sessions',   require('./routes/sessions'));
app.use('/api/events',     require('./routes/events'));
app.use('/api/bets',       require('./routes/bets'));
app.use('/api/score-bets', require('./routes/scoreBets'));
app.use('/api/players',    require('./routes/players'));
app.use('/api/matches',    require('./routes/matches'));
app.use('/api/prop-bets',  require('./routes/propBets'));
app.use('/api/race-bets',  require('./routes/raceBets'));
app.use('/api/duels',      require('./routes/duels'));

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

async function start() {
  await runMigrations();
  app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
}

start().catch(console.error);
