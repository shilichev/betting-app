import { useState } from 'react';
import { createEvent, deleteEvent } from '../api';

export default function AddEventForm({ sessionId, events, onCreated }) {
  const [team1, setTeam1] = useState('');
  const [team2, setTeam2] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await createEvent({ sessionId, team1: team1.trim(), team2: team2.trim() });
      setTeam1('');
      setTeam2('');
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
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Добавляем...' : 'Добавить матч'}
        </button>
      </form>

      {events.map(ev => (
        <div key={ev.id} className="match-setup-row">
          <span>{ev.title}</span>
          <button className="btn btn-sm btn-danger"
            onClick={async () => { await deleteEvent(ev.id); onCreated(); }}>
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
