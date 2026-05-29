import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSession, getSessionByCode, joinSession } from '../api';

export default function LobbyPage() {
  const navigate = useNavigate();
  const savedCode = localStorage.getItem('lastRoomCode') || '';
  const [tab, setTab] = useState(savedCode ? 'join' : 'create');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shownPin, setShownPin] = useState(null);
  const [pendingRoom, setPendingRoom] = useState(null);

  const [createForm, setCreateForm] = useState({
    title: '', nickname: '', startingBalance: 1000, fixedBet: 100,
  });
  const [joinForm, setJoinForm] = useState({ code: savedCode, nickname: '', pin: '' });

  async function handleCreate(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const data = await createSession(createForm);
      localStorage.setItem('guestToken', data.guestToken);
      localStorage.setItem('playerId', data.player.id);
      localStorage.setItem('lastRoomCode', data.session.code);
      setShownPin(data.pin);
      setPendingRoom(data.session.id);
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
      const pin = joinForm.pin.trim();
      const data = await joinSession(session.id, pin
        ? { pin }
        : { nickname: joinForm.nickname }
      );
      localStorage.setItem('guestToken', data.guestToken);
      localStorage.setItem('playerId', data.player.id);
      localStorage.setItem('lastRoomCode', session.code);
      if (data.rejoin) {
        // Реджойн — PIN уже знаем, сразу в комнату
        navigate(`/room/${session.id}`);
      } else {
        setShownPin(data.pin);
        setPendingRoom(session.id);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (shownPin) {
    return (
      <div className="lobby">
        <div className="lobby-card">
          <h1 className="logo">Bet<span>Room</span></h1>
          <div className="pin-reveal">
            <p className="pin-reveal-label">Твой персональный PIN</p>
            <div className="pin-reveal-code">{shownPin}</div>
            <p className="pin-reveal-hint">
              Запомни или сделай скриншот — он нужен для восстановления сессии если закроешь вкладку
            </p>
            <button className="btn btn-primary btn-full" onClick={() => navigate(`/room/${pendingRoom}`)}>
              Войти в комнату →
            </button>
          </div>
        </div>
      </div>
    );
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
                <input type="number" value={createForm.startingBalance} min={0}
                  onChange={e => setCreateForm({ ...createForm, startingBalance: Number(e.target.value) })} />
              </div>
              <div className="field">
                <label>Фиксированная ставка</label>
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
            {joinForm.pin
              ? <div className="field">
                  <label>PIN (восстановление сессии)</label>
                  <input value={joinForm.pin} maxLength={6} className="code-input"
                    onChange={e => setJoinForm({ ...joinForm, pin: e.target.value.replace(/\D/g, '') })}
                    placeholder="738291" autoFocus />
                  <button type="button" className="link-btn" onClick={() => setJoinForm({ ...joinForm, pin: '' })}>
                    Войти как новый игрок
                  </button>
                </div>
              : <div className="field">
                  <label>Твой никнейм</label>
                  <input value={joinForm.nickname} onChange={e => setJoinForm({ ...joinForm, nickname: e.target.value })}
                    placeholder="Игрок" required maxLength={30} />
                  <button type="button" className="link-btn" onClick={() => setJoinForm({ ...joinForm, nickname: '', pin: ' ' })}>
                    Уже был в комнате? Войти по PIN
                  </button>
                </div>
            }
            {error && <div className="error-msg">{error}</div>}
            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? 'Входим...' : joinForm.pin ? 'Восстановить сессию' : 'Войти в комнату'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
