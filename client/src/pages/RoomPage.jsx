import { useParams } from 'react-router-dom';
import { useRoom } from '../hooks/useRoom';
import { startSession, finishSession } from '../api';

import TopBar          from '../components/TopBar';
import PlayersSidebar  from '../components/PlayersSidebar';
import AddEventForm    from '../components/AddEventForm';
import ScoreBetSection from '../components/ScoreBetSection';

export default function RoomPage() {
  const { id: sessionId } = useParams();
  const { session, players, events, scoreBets, loading, refresh } = useRoom(sessionId);

  const myPlayerId = localStorage.getItem('playerId');
  const me = players.find(p => p.id === myPlayerId);
  const isHost = me?.is_host ?? false;

  if (loading) return <div className="loading">Загрузка...</div>;
  if (!session) return <div className="loading">Комната не найдена</div>;

  const fixedBet = session.fixed_bet ?? 100;

  // Общий банк = сумма всех незавершённых ставок
  // Банк = все ставки кроме уже выигранных (деньги ушли из балансов)
  const totalBank = scoreBets
    .filter(b => b.status !== 'won')
    .reduce((s, b) => s + b.amount, 0);

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
        onCopyCode={() => navigator.clipboard.writeText(session.code)}
      />

      <div className="room-layout">
        <PlayersSidebar
          players={players}
          myPlayerId={myPlayerId}
          isHost={isHost}
          sessionStatus={session.status}
          onAdjust={refresh}
        />

        <div className="room-main">
          {session.status === 'waiting' && (
            <div className="invite-bar">
              Пригласи друзей — код: <strong>{session.code}</strong>
              <button className="btn btn-sm btn-primary" onClick={() => navigator.clipboard.writeText(session.code)}>
                Скопировать
              </button>
            </div>
          )}

          {isHost && (
            <div className="host-actions">
              {session.status === 'waiting' && (
                <button
                  className="btn btn-success"
                  onClick={handleStart}
                  disabled={events.length === 0}
                  title={events.length === 0 ? 'Добавь хотя бы один матч' : ''}
                >
                  ▶ Начать игру
                </button>
              )}
              {session.status === 'active' && (
                <button className="btn btn-danger" onClick={handleFinish}>■ Завершить</button>
              )}
            </div>
          )}

          {/* Хост добавляет матчи */}
          {isHost && (session.status === 'waiting' || session.status === 'active') && (
            <AddEventForm sessionId={sessionId} events={events} onCreated={refresh} />
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

          {/* Ставки */}
          {session.status !== 'waiting' && (
            <ScoreBetSection
              sessionId={sessionId}
              events={events}
              scoreBets={scoreBets}
              isHost={isHost}
              sessionStatus={session.status}
              guestToken={localStorage.getItem('guestToken')}
              myBalance={me?.balance ?? 0}
              fixedBet={fixedBet}
              onUpdate={refresh}
            />
          )}
        </div>
      </div>
    </div>
  );
}
