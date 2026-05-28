export default function TopBar({ session, bank, onCopyCode }) {
  const statusLabel = {
    waiting:  'Ожидание',
    active:   'Идёт игра',
    finished: 'Завершена',
  }[session.status] ?? session.status;

  return (
    <header className="topbar">
      <h1 className="logo">Bet<span>Room</span></h1>
      <div className="topbar-right">
        {session.status === 'active' && bank > 0 && (
          <span className="bank-display">Банк: <strong>{bank.toLocaleString()}</strong></span>
        )}
        <div className="status-dot-wrap">
          {session.status === 'active' && <div className="status-dot" />}
          <span className="status-text">{statusLabel}</span>
        </div>
        <button className="room-code-btn" onClick={onCopyCode} title="Нажми чтобы скопировать">
          {session.code}
        </button>
      </div>
    </header>
  );
}
