const express = require('express');
const cors = require('cors');
const path = require('path');
const { runMigrations } = require('./migrations');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/events', require('./routes/events'));
app.use('/api/bets', require('./routes/bets'));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

async function start() {
  await runMigrations();
  app.listen(PORT, () => console.log(`Server on port ${PORT}`));
}

start().catch(console.error);
