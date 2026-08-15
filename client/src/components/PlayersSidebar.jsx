import { useState } from 'react';
import { adjustBalance, kickPlayer } from '../api';
import InviteModal from './InviteModal';

const AVATAR_COLORS = [
  '#7c6ff7', '#5dcaa5', '#4f9fe0', '#ef9f27', '#e0637a',
  '#9b6fe0', '#3fb6a8', '#38b6d9', '#c968c9', '#8fae3f',
];

function avatarColor(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function pluralBets(n) {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'активная ставка';
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'активные ставки';
  return 'активных ставок';
}

function countOpenBets(playerId, { scoreBets, propBets, raceBets, duels }) {
  let n = 0;
  n += scoreBets.filter(b => b.player_id === playerId && b.status === 'created').length;
  n += propBets.entries.filter(e => e.player_id === playerId && e.status === 'pending').length;
  n += raceBets.entries.filter(e => e.player_id === playerId && e.status === 'pending').length;
  n += duels.filter(d =>
    (d.challenger_id === playerId || d.challenged_id === playerId) &&
    (d.status === 'pending' || d.status === 'active')
  ).length;
  return n;
}

export default function PlayersSidebar({
  players, myPlayerId, isHost, sessionStatus,
  scoreBets = [], propBets = { entries: [] }, raceBets = { entries: [] }, duels = [],
  session, onAdjust,
}) {
  const [showInvite, setShowInvite] = useState(false);
  const [collapsed, setCollapsed] = useState(true); // на мобилке свёрнуто по умолчанию; на десктопе игнорируется через CSS
  const showActivity = sessionStatus === 'active';

  return (
    <div className={`players-sidebar-block${collapsed ? ' collapsed' : ''}`}>
      <button type="button" className="players-section-toggle" onClick={() => setCollapsed(c => !c)}>
        <span className="section-label">Игроки ({players.length})</span>
        <span className="players-chevron">{collapsed ? '▾' : '▴'}</span>
      </button>
      <div className="players-list">
        {players.map(p => (
          <PlayerItem
            key={p.id}
            player={p}
            isMe={p.id === myPlayerId}
            isHost={isHost}
            sessionStatus={sessionStatus}
            openBets={showActivity ? countOpenBets(p.id, { scoreBets, propBets, raceBets, duels }) : null}
            onAdjust={onAdjust}
          />
        ))}
      </div>
      {session && (
        <button type="button" className="invite-players-btn" onClick={() => setShowInvite(true)}>
          👤+ Пригласить игроков
        </button>
      )}
      {showInvite && <InviteModal session={session} onClose={() => setShowInvite(false)} />}
    </div>
  );
}

function PlayerItem({ player, isMe, isHost, sessionStatus, openBets, onAdjust }) {
  const [expanded, setExpanded] = useState(false);
  const [amount, setAmount] = useState('');

  const canManage = isHost && (sessionStatus === 'active' || sessionStatus === 'waiting');
  const initial = (player.nickname.trim()[0] || '?').toUpperCase();

  async function handle(sign) {
    const val = parseInt(amount);
    if (!val || val <= 0) return alert('Введи сумму');
    await adjustBalance(player.id, sign * val);
    setAmount('');
    onAdjust();
  }

  return (
    <div className={`player-card-v2 ${isMe ? 'player-card-me' : ''}`}>
      <div className="player-top-row">
        <div className="player-avatar" style={{ background: avatarColor(player.id) }}>{initial}</div>
        <span className="player-name-v2">{player.nickname}</span>
        {player.is_host && <span className="badge badge-host">HOST</span>}
        {isMe && <span className="player-you-tag">ты</span>}
        {canManage && (
          <button
            type="button" className="player-admin-toggle"
            onClick={() => setExpanded(v => !v)}
            title="Управление игроком"
          >
            ⚙
          </button>
        )}
      </div>

      <div className="player-bottom-row">
        <span className="player-balance-v2">🪙 {player.balance.toLocaleString()}</span>
        {openBets !== null && (
          <span className="player-status">
            <span className={`player-status-text ${openBets > 0 ? 'status-active' : 'status-idle'}`}>
              {openBets === 0 ? 'Не ставил' : openBets === 1 ? 'Сделал ставку' : `${openBets} ${pluralBets(openBets)}`}
            </span>
            <span className={`player-status-dot ${openBets > 0 ? 'dot-green' : 'dot-gray'}`} />
          </span>
        )}
      </div>

      {canManage && expanded && (
        <div className="player-admin">
          {player.pin && <div className="player-pin-row">PIN: <span>{player.pin}</span></div>}
          <div className="balance-controls">
            <input type="number" placeholder="±" value={amount} min="1" onChange={e => setAmount(e.target.value)} />
            <button className="btn btn-sm btn-success" onClick={() => handle(1)}>+</button>
            <button className="btn btn-sm btn-danger" onClick={() => handle(-1)}>−</button>
          </div>
          {!player.is_host && (
            <button
              className="btn btn-sm btn-danger btn-full"
              onClick={async () => {
                if (!confirm(`Удалить ${player.nickname}?`)) return;
                await kickPlayer(player.id);
                onAdjust();
              }}
            >
              Удалить игрока
            </button>
          )}
        </div>
      )}
    </div>
  );
}
