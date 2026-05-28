import { useState } from 'react';
import { placeBet, lockEvent, resolveEvent } from '../api';

export default function EventCard({ event: ev, myPlayerId, myBalance, isHost, guestToken, sessionStatus, onUpdate }) {
  const [side, setSide]     = useState(ev.option_a);
  const [amount, setAmount] = useState(100);

  const myBet  = ev.bets.find(b => b.player_id === myPlayerId);
  const canBet = !myBet && ev.status === 'open' && sessionStatus === 'active';
  const pool   = ev.bets.reduce((s, b) => s + b.amount, 0);

  async function handleBet() {
    if (amount > myBalance) return alert('Недостаточно баланса');
    await placeBet({ eventId: ev.id, guestToken, side, amount });
    onUpdate();
  }

  return (
    <div className="card">
      {/* Заголовок */}
      <div className="card-header">
        <div className="card-title">
          {ev.title}
          <StatusBadge status={ev.status} />
        </div>
        {isHost && ev.status === 'open' && (
          <button className="btn btn-sm btn-amber" onClick={async () => { await lockEvent(ev.id); onUpdate(); }}>
            Закрыть ставки
          </button>
        )}
      </div>

      {ev.outcome && (
        <div className="outcome-label">Победитель: <strong>{ev.outcome}</strong></div>
      )}

      {/* Варианты */}
      <div className="options">
        <Option label={ev.option_a} odds={ev.odds_a} won={ev.outcome === ev.option_a} />
        <Option label={ev.option_b} odds={ev.odds_b} won={ev.outcome === ev.option_b} />
      </div>

      {/* Форма ставки */}
      {canBet && (
        <div className="bet-form">
          <select value={side} onChange={e => setSide(e.target.value)}>
            <option value={ev.option_a}>{ev.option_a} ×{ev.odds_a}</option>
            <option value={ev.option_b}>{ev.option_b} ×{ev.odds_b}</option>
          </select>
          <input type="number" value={amount} min={1} max={myBalance} onChange={e => setAmount(Number(e.target.value))} />
          <button className="btn btn-primary btn-sm" onClick={handleBet}>Поставить</button>
        </div>
      )}

      {/* Моя ставка */}
      {myBet && (
        <div className="my-bet">
          Ставка: <strong>{myBet.side}</strong> на <strong>{myBet.amount.toLocaleString()}</strong>
          {myBet.status === 'won'  && <span className="text-win"> → +{myBet.payout.toLocaleString()} 🎉</span>}
          {myBet.status === 'lost' && <span className="text-loss"> — проиграл</span>}
        </div>
      )}

      {/* Кнопки хоста — объявить победителя */}
      {isHost && ev.status === 'locked' && (
        <div className="host-btns">
          <button className="btn btn-sm btn-success" onClick={async () => { await resolveEvent(ev.id, 'a'); onUpdate(); }}>
            ✓ {ev.option_a}
          </button>
          <button className="btn btn-sm btn-success" onClick={async () => { await resolveEvent(ev.id, 'b'); onUpdate(); }}>
            ✓ {ev.option_b}
          </button>
        </div>
      )}

      {/* Список ставок */}
      {ev.bets.length > 0 && (
        <div className="bets-list">
          {ev.bets.map(b => (
            <div key={b.id} className={`bet-row ${b.status}`}>
              <span className="bet-nick">{b.nickname}</span>
              <span>
                {b.side} · {b.amount.toLocaleString()}
                {b.status === 'won' && <span className="text-win"> +{b.payout.toLocaleString()}</span>}
              </span>
            </div>
          ))}
          <div className="pool-total">Пул: {pool.toLocaleString()}</div>
        </div>
      )}
    </div>
  );
}

function Option({ label, odds, won }) {
  return (
    <div className={`option ${won ? 'option-won' : ''}`}>
      <div className="option-label">{label}</div>
      <div className="option-odds">×{odds}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    open:     ['s-open',     'Открыто'],
    locked:   ['s-locked',   'Закрыто'],
    resolved: ['s-resolved', 'Завершено'],
  };
  const [cls, label] = map[status] ?? ['s-open', status];
  return <span className={`badge ${cls}`}>{label}</span>;
}
