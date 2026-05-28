# BetRoom 🎲

Система ставок между друзьями. Node.js + Express + PostgreSQL.

## Локальный запуск

```bash
npm install
# создай .env файл:
# DATABASE_URL=postgresql://user:pass@localhost:5432/betting
# NODE_ENV=development
npm start
```

## Деплой на Render

1. Залить репозиторий на GitHub
2. Render → New Postgres (Free) → скопировать Internal Database URL
3. Render → New Web Service → подключить репозиторий
   - Build: `npm install`
   - Start: `node src/index.js`
   - Env: `DATABASE_URL=...`, `NODE_ENV=production`

## Игровой процесс

1. Хост создаёт комнату, получает 6-значный код
2. Друзья заходят по коду, вводят никнейм
3. Хост нажимает "Начать игру"
4. Хост создаёт события с двумя исходами и коэффициентами
5. Игроки делают ставки пока открыты
6. Хост закрывает ставки и объявляет победителя
7. Балансы пересчитываются автоматически
