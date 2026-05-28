import { useState } from 'react';
import { placeScoreBet, wonScoreBet, lostScoreBet } from '../api';

const WINNER_LABELS = {
  team1: (t1) => t1,
  draw:  ()   => 'Ничья',
  team2: (t2, _, t2name) => t2name,
};

export default function ScoreBetSection({ sessionId, events, scoreBets, isHost, sessionStatus, guestToken, myBalance, fixedBet, onUpdate }) {
  const openEvents = events.filter(ev => ev.status !== 'resolved');
  const resolvedEvents = events.filter(ev => ev.status === 'resolved');

  if (events.length === 0) return <div className="empty">Матчей нет</div>;

  return (
    <div>
      {openEvents.map(ev => {
        const bets = scoreBets.filter(b => b.event_id === ev.id);
        const bank = bets.reduce((s, b) => s + b.amount, 0);
        return (
          <MatchCard
            key={ev.id}
            event={ev}
            bets={bets}
            bank={bank}
            isHost={isHost}
            sessionId={sessionId}
            guestToken={guestToken}
            myBalance={myBalance}
            fixedBet={fixedBet}
            sessionStatus={sessionStatus}
            onUpdate={onUpdate}
          />
        );
      })}

      {resolvedEvents.map(ev => {
        const bets = scoreBets.filter(b => b.event_id === ev.id);
        const winner = bets.find(b => b.status === 'won');
        return (
          <div key={ev.id} className="card card-resolved">
            <div className="score-group-header">
              <span className="score-group-title">{ev.title}</span>
              <span className="badge s-won">Завершён</span>
            </div>
            {winner && (
              <div className="winner-row">
                🏆 {winner.nickname} — {winner.prediction} ({winnerLabel(winner.predicted_winner, ev)}) +{winner.payout.toLocaleString()}
              </div>
            )}
            <div className="bets-list">
              {bets.filter(b => b.status !== 'won').map(b => (
                <div key={b.id} className="score-bet-card">
                  <span className="score-bet-nick">{b.nickname}</span>
                  <span className="score-bet-prediction">{b.prediction} ({winnerLabel(b.predicted_winner, ev)})</span>
                  <span className={`badge s-${b.status}`}>{b.status === 'lost' ? 'Не зашло' : b.status}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function winnerLabel(predicted_winner, event) {
  if (predicted_winner === 'team1') return event.option_a;
  if (predicted_winner === 'team2') return event.option_b;
  return 'Ничья';
}

function MatchCard({ event, bets, bank, isHost, sessionId, guestToken, myBalance, fixedBet, sessionStatus, onUpdate }) {
  return (
    <div className="card">
      <div className="score-group-header">
        <span className="score-group-title">{event.title}</span>
        <span className="score-bank">Банк: <strong>{bank.toLocaleString()}</strong></span>
      </div>

      {sessionStatus === 'active' && (
        <BetForm
          event={event}
          sessionId={sessionId}
          guestToken={guestToken}
          myBalance={myBalance}
          fixedBet={fixedBet}
          onCreated={onUpdate}
        />
      )}

      <div className="bets-list">
        {bets.length === 0
          ? <div className="empty" style={{ padding: '12px 0' }}>Ставок пока нет</div>
          : bets.map(bet => (
              <BetRow key={bet.id} bet={bet} event={event} isHost={isHost} onUpdate={onUpdate} />
            ))
        }
      </div>
    </div>
  );
}

function BetForm({ event, sessionId, guestToken, myBalance, fixedBet, onCreated }) {
  const [prediction, setPrediction] = useState('');
  const [predictedWinner, setPredictedWinner] = useState('team1');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (myBalance < fixedBet) return alert('Недостаточно баланса');
    setLoading(true);
    try {
      await placeScoreBet({ sessionId, guestToken, eventId: event.id, prediction, predictedWinner });
      setPrediction('');
      setPredictedWinner('team1');
      onCreated();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="bet-form" onSubmit={handleSubmit}>
      <div className="bet-form-row">
        <div className="field" style={{ flex: 1 }}>
          <label>Счёт</label>
          <input value={prediction} onChange={e => setPrediction(e.target.value)}
            placeholder="2:1" className="score-input" required />
        </div>
        <div className="field" style={{ flex: 2 }}>
          <label>Победитель</label>
          <div className="winner-radio">
            {[
              { value: 'team1', label: event.option_a },
              { value: 'draw',  label: 'Ничья' },
              { value: 'team2', label: event.option_b },
            ].map(opt => (
              <label key={opt.value} className={`radio-btn ${predictedWinner === opt.value ? 'active' : ''}`}>
                <input type="radio" name={`winner-${event.id}`} value={opt.value}
                  checked={predictedWinner === opt.value}
                  onChange={() => setPredictedWinner(opt.value)} />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="bet-submit-row">
        <span className="fixed-bet-label">Ставка: <strong>{fixedBet.toLocaleString()}</strong> монет</span>
        <button type="submit" className="btn btn-primary btn-sm" disabled={loading || myBalance < fixedBet}>
          {loading ? '...' : 'Поставить'}
        </button>
      </div>
    </form>
  );
}

function BetRow({ bet, event, isHost, onUpdate }) {
  const label = winnerLabel(bet.predicted_winner, event);
  const statusMap = { created: 'Принято', confirmed: 'Подтверждено', won: 'Победитель 🏆', lost: 'Не зашло' };

  return (
    <div className="score-bet-card">
      <div className="score-bet-top">
        <div>
          <div className="score-bet-nick">{bet.nickname}</div>
          <div className="score-bet-prediction">{bet.prediction} · {label}</div>
        </div>
        <div className="score-bet-right">
          <span className="bet-amount">{bet.amount.toLocaleString()}</span>
          <span className={`badge s-${bet.status}`}>{statusMap[bet.status] ?? bet.status}</span>
          {bet.status === 'won' && <span className="text-win">+{bet.payout.toLocaleString()}</span>}
        </div>
      </div>

      {isHost && bet.status === 'created' && (
        <div className="host-btns">
          <button className="btn btn-sm btn-success"
            onClick={async () => { await wonScoreBet(bet.id); onUpdate(); }}>
            ✓ Зашла — забирает банк
          </button>
          <button className="btn btn-sm btn-danger"
            onClick={async () => { await lostScoreBet(bet.id); onUpdate(); }}>
            ✗ Не зашла
          </button>
        </div>
      )}
    </div>
  );
}
