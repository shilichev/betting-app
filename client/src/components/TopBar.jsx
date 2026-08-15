import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export default function TopBar({ session, bank, playerCount, myBalance, onCopyCode }) {
  const navigate = useNavigate();
  const [showDetails, setShowDetails] = useState(false);
  const statusLabel = {
    waiting:  'Ожидание',
    active:   'Идёт игра',
    finished: 'Завершена',
  }[session.status] ?? session.status;

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1 className="logo" style={{ cursor: 'pointer' }} onClick={() => {
          localStorage.removeItem('guestToken');
          localStorage.removeItem('playerId');
          navigate('/');
        }}>Bet<span>Room</span></h1>

        {session.status === 'active' && <div className="topbar-mobile-dot" title="Идёт игра" />}

        <button
          type="button"
          className="topbar-info-btn"
          onClick={() => setShowDetails(v => !v)}
          aria-expanded={showDetails}
          title="Детали комнаты"
        >
          ⓘ
        </button>

        <span className="topbar-divider" />
        <span className="topbar-room-title">{session.title}</span>
        {playerCount != null && <span className="topbar-player-count">👥 {playerCount} игроков</span>}
      </div>
      <div className="topbar-right">
        {myBalance != null && (
          <span className="topbar-balance">🪙 {myBalance.toLocaleString()}</span>
        )}
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

      {showDetails && (
        <div className="topbar-dropdown">
          <div className="topbar-dropdown-row">
            <span className="topbar-dropdown-label">Комната</span>
            <span className="topbar-dropdown-value">{session.title}</span>
          </div>
          {playerCount != null && (
            <div className="topbar-dropdown-row">
              <span className="topbar-dropdown-label">Игроков</span>
              <span className="topbar-dropdown-value">👥 {playerCount}</span>
            </div>
          )}
          {myBalance != null && (
            <div className="topbar-dropdown-row">
              <span className="topbar-dropdown-label">Мой баланс</span>
              <span className="topbar-dropdown-value">🪙 {myBalance.toLocaleString()}</span>
            </div>
          )}
          {session.status === 'active' && bank > 0 && (
            <div className="topbar-dropdown-row">
              <span className="topbar-dropdown-label">Джекпот</span>
              <span className="topbar-dropdown-value">🎰 {bank.toLocaleString()}</span>
            </div>
          )}
          <div className="topbar-dropdown-row">
            <span className="topbar-dropdown-label">Статус</span>
            <span className="topbar-dropdown-value">{statusLabel}</span>
          </div>
          <button type="button" className="room-code-btn topbar-dropdown-code" onClick={onCopyCode}>
            {session.code} · скопировать
          </button>
        </div>
      )}
    </header>
  );
}
