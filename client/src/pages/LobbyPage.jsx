import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSession, getSessionByCode, joinSession } from '../api';

export default function LobbyPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('create'); // 'create' | 'join'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [createForm, setCreateForm] = useState({
    title: '', nickname: '', startingBalance: 1000, fixedBet: 100,
  });
  const [joinForm, setJoinForm] = useState({ code: '', nickname: '' });

  async function handleCreate(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const data = await createSession(createForm);
      localStorage.setItem('guestToken', data.guestToken);
      localStorage.setItem('playerId', data.player.id);
      navigate(`/room/${data.session.id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const session = await getSessionByCode(joinForm.code);
      const data = await joinSession(session.id, { nickname: joinForm.nickname });
      localStorage.setItem('guestToken', data.guestToken);
      localStorage.setItem('playerId', data.player.id);
      navigate(`/room/${session.id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="lobby">
      <div className="lobby-card">
        <h1 className="logo">Bet<span>Room</span></h1>
        <p className="subtitle">Ставки между друзьями</p>

        <div className="tabs">
          <button className={`tab ${tab === 'create' ? 'active' : ''}`} onClick={() => { setTab('create'); setError(''); }}>
            Создать комнату
          </button>
          <button className={`tab ${tab === 'join' ? 'active' : ''}`} onClick={() => { setTab('join'); setError(''); }}>
            Войти по коду
          </button>
        </div>

        {tab === 'create' ? (
          <form onSubmit={handleCreate}>
            <div className="field">
              <label>Название комнаты</label>
              <input value={createForm.title} onChange={e => setCreateForm({ ...createForm, title: e.target.value })}
                placeholder="Финал ЛЧ у Кирилла" required maxLength={60} />
            </div>
            <div className="field">
              <label>Твой никнейм</label>
              <input value={createForm.nickname} onChange={e => setCreateForm({ ...createForm, nickname: e.target.value })}
                placeholder="Хост" required maxLength={30} />
            </div>
            <div className="row-2">
              <div className="field">
                <label>Стартовый баланс</label>
                <input type="number" value={createForm.startingBalance} min={100}
                  onChange={e => setCreateForm({ ...createForm, startingBalance: Number(e.target.value) })} />
              </div>
              <div className="field">
                <label>Фиксированная ставка на счёт</label>
                <input type="number" value={createForm.fixedBet} min={10}
                  onChange={e => setCreateForm({ ...createForm, fixedBet: Number(e.target.value) })} />
              </div>
            </div>
            {error && <div className="error-msg">{error}</div>}
            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? 'Создаём...' : 'Создать комнату'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleJoin}>
            <div className="field">
              <label>Код комнаты</label>
              <input value={joinForm.code} maxLength={6}
                onChange={e => setJoinForm({ ...joinForm, code: e.target.value.toUpperCase() })}
                placeholder="ABC123" className="code-input" required />
            </div>
            <div className="field">
              <label>Твой никнейм</label>
              <input value={joinForm.nickname} onChange={e => setJoinForm({ ...joinForm, nickname: e.target.value })}
                placeholder="Игрок" required maxLength={30} />
            </div>
            {error && <div className="error-msg">{error}</div>}
            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? 'Входим...' : 'Войти в комнату'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
