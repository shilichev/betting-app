import { useState } from 'react';
import { createEvent, deleteEvent } from '../api';
import DateTimePicker from './DateTimePicker';

export default function AddEventForm({ sessionId, events, fixedBet, onCreated }) {
  const [team1, setTeam1] = useState('');
  const [team2, setTeam2] = useState('');
  const [scoreBetAmount, setScoreBetAmount] = useState('');
  const [deadline, setDeadline] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await createEvent({
        sessionId,
        team1: team1.trim(),
        team2: team2.trim(),
        scoreBetAmount: scoreBetAmount ? parseInt(scoreBetAmount) : undefined,
        deadline: deadline ? deadline.toISOString() : undefined,
      });
      setTeam1('');
      setTeam2('');
      setScoreBetAmount('');
      setDeadline(null);
      onCreated();
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form className="card card-dashed" onSubmit={handleSubmit}>
        <div className="card-section-title">+ Добавить матч</div>
        <div className="row-2">
          <div className="field">
            <input value={team1} onChange={e => setTeam1(e.target.value)} placeholder="Арсенал" required />
          </div>
          <div className="field">
            <input value={team2} onChange={e => setTeam2(e.target.value)} placeholder="ПСЖ" required />
          </div>
        </div>
        <div className="field">
          <label className="field-label">Ставка за точный счёт</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={scoreBetAmount}
            onChange={e => setScoreBetAmount(e.target.value.replace(/\D/g, ''))}
            placeholder={`По умолчанию: ${fixedBet ?? 100}`}
          />
        </div>
        <div className="field">
          <label className="field-label">Закрыть приём до (необязательно)</label>
          <DateTimePicker value={deadline} onChange={setDeadline} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Добавляем...' : 'Добавить матч'}
        </button>
      </form>

      {events.map(ev => (
        <div key={ev.id} className="match-setup-row">
          <span>{ev.title}</span>
          {ev.score_bet_amount && (
            <span className="match-bet-tag">{ev.score_bet_amount} монет</span>
          )}
          <button className="btn btn-sm btn-danger"
            onClick={async () => { await deleteEvent(ev.id); onCreated(); }}>
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
