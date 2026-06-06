import { useState } from "react";
import { createDuel, acceptDuel, declineDuel, cancelDuel, resolveDuel } from "../api";

export default function DuelSection({
  sessionId, duels, players,
  isHost, guestToken, myPlayerId, myBalance, fixedBet,
  createOpen, onCreateClose, onUpdate,
}) {
  const myId = String(myPlayerId);

  const pending  = duels.filter(d => d.status === "pending");
  const active   = duels.filter(d => d.status === "active");
  const resolved = duels.filter(d => ["resolved", "declined", "cancelled"].includes(d.status));

  if (duels.length === 0 && !createOpen) return null;

  return (
    <div className="duel-section">
      {createOpen && (
        <CreateDuelForm
          sessionId={sessionId} guestToken={guestToken}
          players={players} myPlayerId={myPlayerId} myBalance={myBalance} fixedBet={fixedBet}
          onCreated={() => { onUpdate(); onCreateClose?.(); }}
          onCancel={onCreateClose}
        />
      )}

      {pending.map(d => (
        <DuelCard key={d.id} duel={d} myId={myId} isHost={isHost}
          guestToken={guestToken} onUpdate={onUpdate} />
      ))}
      {active.map(d => (
        <DuelCard key={d.id} duel={d} myId={myId} isHost={isHost}
          guestToken={guestToken} onUpdate={onUpdate} />
      ))}
      {resolved.map(d => (
        <DuelCard key={d.id} duel={d} myId={myId} isHost={isHost}
          guestToken={guestToken} onUpdate={onUpdate} />
      ))}
    </div>
  );
}

function CreateDuelForm({ sessionId, guestToken, players, myPlayerId, myBalance, fixedBet, onCreated, onCancel }) {
  const [challengedId, setChallengedId] = useState("");
  const [title, setTitle]               = useState("");
  const [amount, setAmount]             = useState(String(fixedBet));
  const [loading, setLoading]           = useState(false);

  const opponents = players.filter(p => String(p.id) !== String(myPlayerId));
  const amt = parseInt(amount) || 0;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!challengedId) return alert("Выбери соперника");
    if (amt <= 0) return alert("Укажи сумму ставки");
    if (myBalance < amt) return alert("Недостаточно баланса");
    setLoading(true);
    try {
      await createDuel({ sessionId, guestToken, challengedId, title, amount: amt });
      onCreated();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="card card-dashed" onSubmit={handleSubmit}>
      <div className="card-section-title">⚔️ Бросить дуэль</div>

      <div className="field">
        <label>Соперник</label>
        <div className="duel-opponents">
          {opponents.length === 0 && <div className="empty">Нет доступных игроков</div>}
          {opponents.map(p => (
            <button key={p.id} type="button"
              className={`race-pick-btn${String(challengedId) === String(p.id) ? " selected" : ""}`}
              onClick={() => setChallengedId(p.id)}>
              {p.nickname}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>Условие дуэли</label>
        <input value={title} onChange={e => setTitle(e.target.value)}
          placeholder="Кто наберёт больше очков в следующем туре?" required />
      </div>

      <div className="field">
        <label>Ставка (с каждого)</label>
        <input type="text" inputMode="numeric" value={amount}
          onChange={e => setAmount(e.target.value.replace(/\D/g, ""))}
          placeholder={String(fixedBet)} required />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="btn btn-primary" disabled={loading || !challengedId || amt <= 0}>
          {loading ? "..." : "Бросить дуэль"}
        </button>
        <button type="button" className="btn btn-outline" onClick={onCancel}>Отмена</button>
      </div>
    </form>
  );
}

function DuelCard({ duel, myId, isHost, guestToken, onUpdate }) {
  const isMyChallenged  = String(duel.challenged_id) === myId;
  const isMyChallenger  = String(duel.challenger_id) === myId;
  const prize           = duel.amount * 2;

  const statusLabel = {
    pending:   "Ожидает ответа",
    active:    "Идёт дуэль",
    resolved:  "Завершена",
    declined:  "Отклонена",
    cancelled: "Отменена",
  }[duel.status] ?? duel.status;

  const statusClass = {
    pending:   "s-created",
    active:    "s-confirmed",
    resolved:  "s-won",
    declined:  "s-lost",
    cancelled: "s-lost",
  }[duel.status] ?? "";

  return (
    <div className={`card duel-card${["declined","cancelled"].includes(duel.status) ? " card-resolved" : ""}`}>
      <div className="duel-header">
        <div className="duel-vs">
          <span className="duel-player challenger">{duel.challenger_nickname}</span>
          <span className="duel-sword">⚔️</span>
          <span className="duel-player challenged">{duel.challenged_nickname}</span>
        </div>
        <div className="duel-meta">
          <span className="prop-odds" style={{ fontSize: 16 }}>{duel.amount.toLocaleString()} × 2</span>
          <span className={`badge ${statusClass}`}>{statusLabel}</span>
        </div>
      </div>

      <div className="duel-title">"{duel.title}"</div>

      {duel.status === "resolved" && (
        <div className="winner-row" style={{ marginTop: 8 }}>
          🏆 {duel.winner_nickname} забирает {prize.toLocaleString()}
        </div>
      )}

      {/* Вызванный игрок принимает/отклоняет */}
      {duel.status === "pending" && isMyChallenged && (
        <div className="host-btns" style={{ marginTop: 10 }}>
          <button className="btn btn-sm btn-success"
            onClick={async () => { await acceptDuel(duel.id, guestToken); onUpdate(); }}>
            ✓ Принять
          </button>
          <button className="btn btn-sm btn-danger"
            onClick={async () => { await declineDuel(duel.id, guestToken); onUpdate(); }}>
            ✗ Отклонить
          </button>
        </div>
      )}

      {/* Вызывающий может отменить пока ожидает */}
      {duel.status === "pending" && isMyChallenger && (
        <div className="host-btns" style={{ marginTop: 10 }}>
          <button className="btn btn-sm btn-outline"
            onClick={async () => {
              if (confirm("Отменить дуэль? Деньги вернутся.")) {
                await cancelDuel(duel.id, guestToken);
                onUpdate();
              }
            }}>
            Отменить
          </button>
        </div>
      )}

      {/* Хост-судья выбирает победителя */}
      {duel.status === "active" && isHost && (
        <div className="host-btns" style={{ marginTop: 10 }}>
          <span style={{ fontSize: 12, color: "var(--muted)", alignSelf: "center" }}>Судья:</span>
          <button className="btn btn-sm btn-success"
            onClick={async () => {
              if (confirm(`Победитель — ${duel.challenger_nickname}?`)) {
                await resolveDuel(duel.id, duel.challenger_id, guestToken);
                onUpdate();
              }
            }}>
            🏆 {duel.challenger_nickname}
          </button>
          <button className="btn btn-sm btn-success"
            onClick={async () => {
              if (confirm(`Победитель — ${duel.challenged_nickname}?`)) {
                await resolveDuel(duel.id, duel.challenged_id, guestToken);
                onUpdate();
              }
            }}>
            🏆 {duel.challenged_nickname}
          </button>
        </div>
      )}
    </div>
  );
}
