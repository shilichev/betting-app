import { useNavigate } from 'react-router-dom';

export default function TopBar({ session, bank, onCopyCode }) {
  const navigate = useNavigate();
  const statusLabel = {
    waiting:  'Ожидание',
    active:   'Идёт игра',
    finished: 'Завершена',
  }[session.status] ?? session.status;

  return (
    <header className="topbar">
      <h1 className="logo" style={{ cursor: 'pointer' }} onClick={() => {
        localStorage.removeItem('guestToken');
        localStorage.removeItem('playerId');
        navigate('/');
      }}>Bet<span>Room</span></h1>
      <div className="topbar-right">
        {session.status === 'active' && bank > 0 && (
          <span className="bank-display">🎰 Джекпот: <strong>{bank.toLocaleString()}</strong></span>
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
