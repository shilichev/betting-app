import { useState } from 'react';
import { adjustBalance, kickPlayer } from '../api';

export default function PlayersSidebar({ players, myPlayerId, isHost, sessionStatus, onAdjust }) {
  const sorted = [...players].sort((a, b) => b.balance - a.balance);

  return (
    <aside className="sidebar">
      <div className="section-label">Игроки</div>
      {sorted.map(p => (
        <PlayerItem
          key={p.id}
          player={p}
          isMe={p.id === myPlayerId}
          isHost={isHost}
          sessionStatus={sessionStatus}
          onAdjust={onAdjust}
        />
      ))}
    </aside>
  );
}

function PlayerItem({ player, isMe, isHost, sessionStatus, onAdjust }) {
  const [amount, setAmount] = useState('');

  async function handle(sign) {
    const val = parseInt(amount);
    if (!val || val <= 0) return alert('Введи сумму');
    await adjustBalance(player.id, sign * val);
    setAmount('');
    onAdjust();
  }

  return (
    <div className="player-card">
      <div className="player-row">
        <div className="player-name">
          {player.is_host && <span className="badge badge-host">HOST</span>}
          {isMe         && <span className="badge badge-you">ТЫ</span>}
          <span>{player.nickname}</span>
          {isHost && player.pin && <span className="player-pin">PIN: {player.pin}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="player-balance">{player.balance.toLocaleString()}</span>
          {isHost && !player.is_host && (
            <button className="btn btn-sm btn-danger" style={{ padding: '2px 7px', fontSize: 12 }}
              onClick={async () => {
                if (!confirm(`Удалить ${player.nickname}?`)) return;
                await kickPlayer(player.id);
                onAdjust();
              }}>✕</button>
          )}
        </div>
      </div>

      {/* Управление балансом — только хосту, только в активной сессии */}
      {isHost && (sessionStatus === 'active' || sessionStatus === 'waiting') && (
        <div className="balance-controls">
          <input
            type="number" placeholder="±" value={amount} min="1"
            onChange={e => setAmount(e.target.value)}
          />
          <button className="btn btn-sm btn-success" onClick={() => handle(1)}>+</button>
          <button className="btn btn-sm btn-danger"  onClick={() => handle(-1)}>−</button>
        </div>
      )}
    </div>
  );
}
