import { useState } from 'react';

const KIND_ICON = { score: '⚽', prop: '📊', race: '🏁', duel: '⚔️' };
const STATUS_LABEL = { pending: 'Ожидает', won: 'Выиграна', lost: 'Проиграна', cancelled: 'Отменена' };
const STATUS_CLASS = { pending: 's-created', won: 's-won', lost: 's-lost', cancelled: 's-lost' };

function normalizeMyBets(myPlayerId, { scoreBets, propBets, raceBets, duels }) {
  const mine = id => String(id) === String(myPlayerId);
  const items = [];

  scoreBets.filter(b => mine(b.player_id)).forEach(b => {
    items.push({
      id: `score-${b.id}`, kind: 'score', title: b.title, pick: b.prediction,
      amount: Number(b.amount), payout: Number(b.payout || 0),
      status: b.status === 'won' ? 'won' : b.status === 'lost' ? 'lost' : 'pending',
      createdAt: b.created_at,
    });
  });

  propBets.entries.filter(e => mine(e.player_id)).forEach(e => {
    const bet = propBets.bets.find(b => b.id === e.prop_bet_id);
    items.push({
      id: `prop-${e.id}`, kind: 'prop', title: bet?.title ?? 'Ставка с коэффициентом', pick: bet ? `x${bet.odds}` : '—',
      amount: Number(e.amount), payout: Number(e.payout || 0),
      status: e.status === 'won' ? 'won' : e.status === 'lost' ? 'lost' : 'pending',
      createdAt: e.created_at,
    });
  });

  raceBets.entries.filter(e => mine(e.player_id)).forEach(e => {
    const bet = raceBets.bets.find(b => b.id === e.race_bet_id);
    const opt = raceBets.options.find(o => o.id === e.option_id);
    items.push({
      id: `race-${e.id}`, kind: 'race', title: bet?.title ?? 'Гонка', pick: opt?.label ?? '—',
      amount: Number(e.amount), payout: Number(e.payout || 0),
      status: e.status === 'won' ? 'won' : e.status === 'lost' ? 'lost' : 'pending',
      createdAt: e.created_at,
    });
  });

  duels.filter(d => mine(d.challenger_id) || mine(d.challenged_id)).forEach(d => {
    const isChallenger = mine(d.challenger_id);
    const opponent = isChallenger ? d.challenged_nickname : d.challenger_nickname;
    const won = d.status === 'resolved' && mine(d.winner_id);
    const lost = d.status === 'resolved' && !mine(d.winner_id);
    const isDead = d.status === 'declined' || d.status === 'cancelled';
    items.push({
      id: `duel-${d.id}`, kind: 'duel', title: `Дуэль с ${opponent}`, pick: d.title,
      amount: Number(d.amount), payout: won ? Number(d.amount) * 2 : 0,
      status: won ? 'won' : lost ? 'lost' : isDead ? 'cancelled' : 'pending',
      createdAt: d.created_at,
    });
  });

  return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export default function ActivityPanel({ myPlayerId, myBalance, scoreBets, propBets, raceBets, duels }) {
  const [expanded, setExpanded] = useState(false);
  const items = normalizeMyBets(myPlayerId, { scoreBets, propBets, raceBets, duels });

  const activeBetsCount = items.filter(i => i.status === 'pending').length;
  const wonTotal = items.filter(i => i.status === 'won').reduce((s, i) => s + (i.payout - i.amount), 0);
  const lostTotal = items.filter(i => i.status === 'lost').reduce((s, i) => s + i.amount, 0);
  const visibleItems = expanded ? items : items.slice(0, 5);

  return (
    <>
      <div className="card activity-card">
        <div className="section-label">Моя активность</div>
        <div className="activity-stats">
          <div className="activity-stat-row">
            <span className="activity-stat-label">Текущий баланс</span>
            <span className="activity-stat-value">{(myBalance ?? 0).toLocaleString()} 🪙</span>
          </div>
          <div className="activity-stat-row">
            <span className="activity-stat-label">Активные ставки</span>
            <span className="activity-stat-value">{activeBetsCount}</span>
          </div>
          <div className="activity-stat-row">
            <span className="activity-stat-label">Выиграно</span>
            <span className="activity-stat-value positive">+{wonTotal.toLocaleString()} 🪙</span>
          </div>
          <div className="activity-stat-row">
            <span className="activity-stat-label">Проиграно</span>
            <span className="activity-stat-value negative">-{lostTotal.toLocaleString()} 🪙</span>
          </div>
        </div>
      </div>

      <div className="card activity-card">
        <div className="section-label">Мои последние ставки</div>
        {items.length === 0 ? (
          <div className="activity-empty">Пока нет ставок</div>
        ) : (
          <>
            <div className="activity-bets-list">
              {visibleItems.map(item => (
                <div key={item.id} className="activity-bet-item">
                  <div className="activity-bet-top">
                    <span className="activity-bet-title">{KIND_ICON[item.kind]} {item.title}</span>
                    <span className={`badge ${STATUS_CLASS[item.status]}`}>{STATUS_LABEL[item.status]}</span>
                  </div>
                  <div className="activity-bet-bottom">
                    <div>
                      <div className="activity-bet-pick-label">Моя ставка</div>
                      <div className="activity-bet-pick">{item.pick}</div>
                    </div>
                    <div className="activity-bet-amount-wrap">
                      <div className="activity-bet-pick-label">Сумма</div>
                      <div className="activity-bet-amount">{item.amount.toLocaleString()} 🪙</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {items.length > 5 && (
              <button type="button" className="btn btn-outline btn-full activity-toggle-btn" onClick={() => setExpanded(v => !v)}>
                {expanded ? 'Свернуть' : `Показать все (${items.length})`}
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}
