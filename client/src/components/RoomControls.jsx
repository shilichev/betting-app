export default function RoomControls({
  isHost, sessionStatus, eventsCount, activeCreate, onToggleCreate, onStart, onFinish,
}) {
  const showStartStop = isHost && (sessionStatus === 'waiting' || sessionStatus === 'active');
  const showBetCreators = sessionStatus === 'active';

  if (!showStartStop && !showBetCreators) return null;

  return (
    <div className="card room-controls">
      {showStartStop && (
        sessionStatus === 'waiting' ? (
          <button
            className="btn btn-success btn-full"
            onClick={onStart}
            disabled={eventsCount === 0}
            title={eventsCount === 0 ? 'Добавь хотя бы один матч' : ''}
          >
            ▶ Начать игру
          </button>
        ) : (
          <button className="btn btn-danger btn-full" onClick={onFinish}>■ Завершить</button>
        )
      )}

      {showBetCreators && (
        <>
          {showStartStop && <div className="room-controls-divider" />}
          <div className="section-label">Создать ставку</div>
          <div className="create-bet-stack">
            {isHost && (
              <>
                <button
                  type="button"
                  className={`create-bet-btn${activeCreate === 'score' ? ' active' : ''}`}
                  onClick={() => onToggleCreate('score')}
                >
                  🎯 Точный счёт
                </button>
                <button
                  type="button"
                  className={`create-bet-btn${activeCreate === 'prop' ? ' active' : ''}`}
                  onClick={() => onToggleCreate('prop')}
                >
                  📊 С коэффициентом
                </button>
                <button
                  type="button"
                  className={`create-bet-btn${activeCreate === 'race' ? ' active' : ''}`}
                  onClick={() => onToggleCreate('race')}
                >
                  🏁 Гонка
                </button>
              </>
            )}
            <button
              type="button"
              className={`create-bet-btn${activeCreate === 'duel' ? ' active' : ''}`}
              onClick={() => onToggleCreate('duel')}
            >
              ⚔️ Дуэль
            </button>
          </div>
        </>
      )}
    </div>
  );
}
