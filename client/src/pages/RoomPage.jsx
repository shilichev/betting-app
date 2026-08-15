import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useRoom } from '../hooks/useRoom';
import { startSession, finishSession, joinSession, getMyPlayer } from '../api';

import TopBar          from '../components/TopBar';
import PlayersSidebar  from '../components/PlayersSidebar';
import RoomControls    from '../components/RoomControls';
import ActivityPanel   from '../components/ActivityPanel';
import AddEventForm    from '../components/AddEventForm';
import ScoreBetSection from '../components/ScoreBetSection';
import PropBetSection  from '../components/PropBetSection';
import RaceBetSection  from '../components/RaceBetSection';
import DuelSection     from '../components/DuelSection';

function RejoinForm({ sessionId, onRejoin }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const data = await joinSession(sessionId, { pin });
      localStorage.setItem('guestToken', data.guestToken);
      localStorage.setItem('playerId', data.player.id);
      onRejoin();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="lobby">
      <div className="lobby-card">
        <h1 className="logo">Bet<span>Room</span></h1>
        <p className="subtitle">Введи свой PIN чтобы войти обратно</p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Твой PIN</label>
            <input value={pin} maxLength={6} className="code-input"
              onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="738291" required autoFocus />
          </div>
          {error && <div className="error-msg">{error}</div>}
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? '...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function RoomPage() {
  const { id: sessionId } = useParams();
  const { session, players, events, scoreBets, propBets, raceBets, duels, loading, refresh } = useRoom(sessionId);
  const [activeCreate, setActiveCreate] = useState(null); // null | 'score' | 'prop'
  const [recoveryDone, setRecoveryDone] = useState(false);

  // Если гостевой сессии в этой комнате нет, но человек авторизован через Google —
  // пробуем тихо восстановить его игрока по аккаунту, без PIN
  useEffect(() => {
    if (localStorage.getItem('guestToken') || !localStorage.getItem('appToken')) {
      setRecoveryDone(true);
      return;
    }
    getMyPlayer(sessionId)
      .then(data => {
        localStorage.setItem('guestToken', data.guestToken);
        localStorage.setItem('playerId', data.player.id);
      })
      .catch(() => {})
      .finally(() => setRecoveryDone(true));
  }, [sessionId]);

  function toggleCreate(type) {
    setActiveCreate(prev => prev === type ? null : type);
  }

  const myPlayerId = localStorage.getItem('playerId');
  const me = players.find(p => String(p.id) === String(myPlayerId));
  const isHost = me?.is_host ?? false;

  if (loading || !recoveryDone) return <div className="loading">Загрузка...</div>;
  if (!session) return <div className="loading">Комната не найдена</div>;

  // Нет сессии в localStorage — показываем форму восстановления по PIN
  if (!localStorage.getItem('guestToken')) {
    return <RejoinForm sessionId={sessionId} onRejoin={refresh} />;
  }

  const fixedBet = session.fixed_bet ?? 100;

  const totalBank = session.bank ?? 0;

  async function handleStart() {
    await startSession(sessionId);
    refresh();
  }

  async function handleFinish() {
    if (!confirm('Завершить сессию?')) return;
    await finishSession(sessionId);
    refresh();
  }

  return (
    <div className="room">
      <TopBar
        session={session}
        bank={totalBank}
        playerCount={players.length}
        myBalance={me?.balance}
        onCopyCode={() => navigator.clipboard.writeText(session.code)}
      />

      <div className="room-layout">
        <aside className="sidebar">
          <RoomControls
            isHost={isHost}
            sessionStatus={session.status}
            eventsCount={events.length}
            activeCreate={activeCreate}
            onToggleCreate={toggleCreate}
            onStart={handleStart}
            onFinish={handleFinish}
          />
          <PlayersSidebar
            players={players}
            myPlayerId={myPlayerId}
            isHost={isHost}
            sessionStatus={session.status}
            scoreBets={scoreBets}
            propBets={propBets}
            raceBets={raceBets}
            duels={duels}
            session={session}
            onAdjust={refresh}
          />
        </aside>

        <div className="room-main">
          {session.status === 'waiting' && (
            <div className="invite-bar">
              Пригласи друзей — код: <strong>{session.code}</strong>
              <button className="btn btn-sm btn-primary" onClick={() => navigator.clipboard.writeText(session.code)}>
                Скопировать
              </button>
            </div>
          )}

          {/* Хост настраивает матчи в ожидании */}
          {isHost && session.status === 'waiting' && (
            <AddEventForm sessionId={sessionId} events={events} fixedBet={fixedBet} onCreated={refresh} />
          )}

          {/* Игроки видят список матчей в ожидании */}
          {!isHost && session.status === 'waiting' && (
            <div>
              {events.length === 0
                ? <div className="empty">Хост настраивает матчи...</div>
                : events.map(ev => (
                    <div key={ev.id} className="match-setup-row">
                      <span>{ev.title}</span>
                    </div>
                  ))
              }
            </div>
          )}

          {session.status === 'active' && (
            <>
              {isHost && activeCreate === 'score' && (
                <AddEventForm
                  sessionId={sessionId}
                  events={events}
                  fixedBet={fixedBet}
                  onCreated={() => { refresh(); setActiveCreate(null); }}
                />
              )}

              <DuelSection
                sessionId={sessionId}
                duels={duels}
                players={players}
                isHost={isHost}
                guestToken={localStorage.getItem('guestToken')}
                myPlayerId={myPlayerId}
                myBalance={me?.balance ?? 0}
                fixedBet={fixedBet}
                createOpen={activeCreate === 'duel'}
                onCreateClose={() => setActiveCreate(null)}
                onUpdate={refresh}
              />

              <RaceBetSection
                sessionId={sessionId}
                raceBets={raceBets}
                isHost={isHost}
                sessionStatus={session.status}
                guestToken={localStorage.getItem('guestToken')}
                myPlayerId={myPlayerId}
                myBalance={me?.balance ?? 0}
                fixedBet={fixedBet}
                createOpen={activeCreate === 'race'}
                onCreateClose={() => setActiveCreate(null)}
                onUpdate={refresh}
              />

              <PropBetSection
                sessionId={sessionId}
                propBets={propBets}
                isHost={isHost}
                sessionStatus={session.status}
                guestToken={localStorage.getItem('guestToken')}
                myPlayerId={myPlayerId}
                myBalance={me?.balance ?? 0}
                fixedBet={fixedBet}
                createOpen={activeCreate === 'prop'}
                onCreateClose={() => setActiveCreate(null)}
                onUpdate={refresh}
              />

              <ScoreBetSection
                sessionId={sessionId}
                events={events}
                scoreBets={scoreBets}
                isHost={isHost}
                sessionStatus={session.status}
                guestToken={localStorage.getItem('guestToken')}
                myBalance={me?.balance ?? 0}
                fixedBet={fixedBet}
                myPlayerId={myPlayerId}
                onUpdate={refresh}
              />
            </>
          )}

          {session.status === 'finished' && (
            <>
              <RaceBetSection
                sessionId={sessionId}
                raceBets={raceBets}
                isHost={isHost}
                sessionStatus={session.status}
                guestToken={localStorage.getItem('guestToken')}
                myPlayerId={myPlayerId}
                myBalance={me?.balance ?? 0}
                fixedBet={fixedBet}
                onUpdate={refresh}
              />
              <PropBetSection
                sessionId={sessionId}
                propBets={propBets}
                isHost={isHost}
                sessionStatus={session.status}
                guestToken={localStorage.getItem('guestToken')}
                myPlayerId={myPlayerId}
                myBalance={me?.balance ?? 0}
                fixedBet={fixedBet}
                onUpdate={refresh}
              />
              <ScoreBetSection
                sessionId={sessionId}
                events={events}
                scoreBets={scoreBets}
                isHost={isHost}
                sessionStatus={session.status}
                guestToken={localStorage.getItem('guestToken')}
                myBalance={me?.balance ?? 0}
                fixedBet={fixedBet}
                myPlayerId={myPlayerId}
                onUpdate={refresh}
              />
            </>
          )}
        </div>

        <aside className="activity-sidebar">
          <ActivityPanel
            myPlayerId={myPlayerId}
            myBalance={me?.balance}
            scoreBets={scoreBets}
            propBets={propBets}
            raceBets={raceBets}
            duels={duels}
          />
        </aside>
      </div>
    </div>
  );
}
