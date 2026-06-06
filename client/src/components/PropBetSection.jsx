import { useState, useEffect } from "react";
import { createPropBet, placePropBetEntry, lockPropBet, resolvePropBet, deletePropBet } from "../api";
import DateTimePicker from "./DateTimePicker";

export default function PropBetSection({
  sessionId,
  propBets: { bets, entries },
  isHost,
  sessionStatus,
  guestToken,
  myPlayerId,
  myBalance,
  fixedBet,
  createOpen = false,
  onCreateClose,
  onUpdate,
}) {
  const openBets = bets.filter((b) => b.status === "open" || b.status === "locked");
  const resolvedBets = bets.filter((b) => b.status === "won" || b.status === "lost");

  if (openBets.length === 0 && resolvedBets.length === 0 && !createOpen) return null;

  return (
    <div className="prop-bet-section">
      {isHost && createOpen && (
        <CreatePropBetForm
          sessionId={sessionId}
          guestToken={guestToken}
          fixedBet={fixedBet}
          onCreated={() => { onUpdate(); onCreateClose?.(); }}
          onCancel={onCreateClose}
        />
      )}

      {openBets.map((bet) => {
        const betEntries = entries.filter((e) => e.prop_bet_id === bet.id);
        const myEntry = betEntries.find((e) => String(e.player_id) === String(myPlayerId));
        return (
          <PropBetCard
            key={bet.id}
            bet={bet}
            entries={betEntries}
            myEntry={myEntry}
            isHost={isHost}
            guestToken={guestToken}
            myBalance={myBalance}
            myPlayerId={myPlayerId}
            onUpdate={onUpdate}
          />
        );
      })}

      {resolvedBets.map((bet) => {
        const betEntries = entries.filter((e) => e.prop_bet_id === bet.id);
        return (
          <PropBetCardResolved key={bet.id} bet={bet} entries={betEntries} />
        );
      })}
    </div>
  );
}

function CreatePropBetForm({ sessionId, guestToken, fixedBet, onCreated, onCancel }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [odds, setOdds] = useState("");
  const [minAmount, setMinAmount] = useState(String(fixedBet));
  const [maxAmount, setMaxAmount] = useState(String(fixedBet * 5));
  const [deadline, setDeadline] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const min = parseInt(minAmount);
    const max = parseInt(maxAmount);
    if (max % min !== 0) return alert("Максимум должен быть кратен минимуму");
    if (parseFloat(odds) <= 1) return alert("Коэффициент должен быть больше 1");
    setLoading(true);
    try {
      await createPropBet({
        sessionId, guestToken, title, description, odds,
        minAmount: min, maxAmount: max,
        deadline: deadline ? deadline.toISOString() : undefined,
      });
      setTitle(""); setDescription(""); setOdds(""); setDeadline(null);
      onCreated();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="card card-dashed" onSubmit={handleSubmit}>
      <div className="card-section-title">Ставка с коэффициентом</div>

      <div className="field">
        <label>Название</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Забьёт ли Роналду?" required />
      </div>

      <div className="field">
        <label>Описание (необязательно)</label>
        <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Дополнительный контекст" />
      </div>

      <div className="row-2">
        <div className="field">
          <label>Мин. ставка</label>
          <input type="text" inputMode="numeric" value={minAmount}
            onChange={e => setMinAmount(e.target.value.replace(/\D/g, ""))} required />
        </div>
        <div className="field">
          <label>Макс. ставка</label>
          <input type="text" inputMode="numeric" value={maxAmount}
            onChange={e => setMaxAmount(e.target.value.replace(/\D/g, ""))} required />
        </div>
      </div>

      <div className="field">
        <label>Коэффициент</label>
        <input type="text" inputMode="decimal" value={odds}
          onChange={e => setOdds(e.target.value.replace(/[^0-9.]/g, ""))}
          placeholder="2.5" required />
      </div>

      <div className="field">
        <label>Закрыть приём до (необязательно)</label>
        <DateTimePicker value={deadline} onChange={setDeadline} />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "..." : "Создать"}
        </button>
        <button type="button" className="btn btn-outline" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </form>
  );
}

function PropBetCard({ bet, entries, myEntry, isHost, guestToken, myBalance, onUpdate }) {
  const pool = entries.reduce((s, e) => s + e.amount, 0);
  const isLocked = bet.status === "locked";

  return (
    <div className="card prop-bet-card">
      <div className="prop-bet-header">
        <div>
          <div className="prop-bet-title">{bet.title}</div>
          {bet.description && <div className="prop-bet-desc">{bet.description}</div>}
        </div>
        <div className="prop-bet-meta">
          <span className="prop-odds">x{bet.odds}</span>
          {pool > 0 && <span className="score-bank">Пул: <strong>{pool.toLocaleString()}</strong></span>}
          {isLocked && <span className="badge s-lost" style={{ fontSize: 11 }}>Приём закрыт</span>}
        </div>
      </div>

      {bet.deadline && !isLocked && <Countdown deadline={bet.deadline} />}

      <div className="prop-bet-limits">
        {bet.min_amount === bet.max_amount
          ? `Ставка: ${bet.min_amount.toLocaleString()}`
          : `От ${bet.min_amount.toLocaleString()} до ${bet.max_amount.toLocaleString()}`}
      </div>

      {!myEntry && !isHost && !isLocked && (
        <BetEntryForm bet={bet} guestToken={guestToken} myBalance={myBalance} onPlaced={onUpdate} />
      )}

      {!myEntry && !isHost && isLocked && (
        <div className="already-bet-msg">Приём ставок закрыт</div>
      )}

      {myEntry && (
        <div className="already-bet-msg">
          Ты поставил: <strong>{myEntry.amount.toLocaleString()}</strong> → потенциальный выигрыш <strong>{Math.floor(myEntry.amount * bet.odds).toLocaleString()}</strong>
        </div>
      )}

      {entries.length > 0 && (
        <div className="bets-list" style={{ marginTop: 8 }}>
          {entries.map((e) => (
            <div key={e.id} className="score-bet-card" style={{ padding: "8px 12px" }}>
              <span className="score-bet-nick">{e.nickname}</span>
              <span style={{ marginLeft: "auto", fontSize: 13 }}>{e.amount.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      {isHost && (
        <div className="host-btns" style={{ marginTop: 10 }}>
          {!isLocked && (
            <button className="btn btn-sm btn-outline"
              onClick={async () => { await lockPropBet(bet.id, guestToken); onUpdate(); }}>
              🔒 Закрыть приём
            </button>
          )}
          <button className="btn btn-sm btn-success"
            onClick={async () => {
              if (confirm("Засчитать — все участники получают выплату?")) {
                await resolvePropBet(bet.id, "won", guestToken);
                onUpdate();
              }
            }}>
            ✓ Зашло
          </button>
          <button className="btn btn-sm btn-danger"
            onClick={async () => {
              if (confirm("Не зашло — ставки уходят в банк?")) {
                await resolvePropBet(bet.id, "lost", guestToken);
                onUpdate();
              }
            }}>
            ✗ Не зашло
          </button>
          <button className="btn btn-sm btn-outline"
            onClick={async () => {
              if (confirm("Удалить ставку? Деньги вернутся игрокам.")) {
                await deletePropBet(bet.id, guestToken);
                onUpdate();
              }
            }}>
            Удалить
          </button>
        </div>
      )}
    </div>
  );
}

function Countdown({ deadline }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    function update() {
      const diff = new Date(deadline) - new Date();
      if (diff <= 0) { setTimeLeft(""); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(h > 0 ? `${h}ч ${m}м` : m > 0 ? `${m}м ${s}с` : `${s}с`);
    }
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [deadline]);

  if (!timeLeft) return null;
  return <div className="prop-countdown">⏱ Закроется через {timeLeft}</div>;
}

function BetEntryForm({ bet, guestToken, myBalance, onPlaced }) {
  const [amount, setAmount] = useState(String(bet.min_amount));
  const [loading, setLoading] = useState(false);

  const amt = parseInt(amount) || 0;
  const payout = Math.floor(amt * bet.odds);
  const valid = amt >= bet.min_amount && amt <= bet.max_amount;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!valid) return alert(`Сумма должна быть от ${bet.min_amount} до ${bet.max_amount}`);
    if (myBalance < amt) return alert("Недостаточно баланса");
    setLoading(true);
    try {
      await placePropBetEntry(bet.id, { guestToken, amount: amt });
      onPlaced();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="prop-entry-form" onSubmit={handleSubmit}>
      <input
        type="text" inputMode="numeric"
        value={amount}
        onChange={e => setAmount(e.target.value.replace(/\D/g, ""))}
        className="prop-entry-input"
        placeholder={String(bet.min_amount)}
      />
      {amt > 0 && (
        <span className="prop-payout-preview">→ выиграю {payout.toLocaleString()}</span>
      )}
      <button type="submit" className="btn btn-primary btn-sm" disabled={loading || !valid || myBalance < amt}>
        {loading ? "..." : "Поставить"}
      </button>
    </form>
  );
}

function PropBetCardResolved({ bet, entries }) {
  const won = bet.status === "won";
  const totalPool = entries.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="card card-resolved prop-bet-card">
      <div className="prop-bet-header">
        <div>
          <div className="prop-bet-title">{bet.title}</div>
          {bet.description && <div className="prop-bet-desc">{bet.description}</div>}
        </div>
        <div className="prop-bet-meta">
          <span className="prop-odds">x{bet.odds}</span>
          <span className={`badge ${won ? "s-won" : "s-lost"}`}>{won ? "Зашло" : "Не зашло"}</span>
        </div>
      </div>

      {entries.length > 0 && (
        <div className="bets-list" style={{ marginTop: 8 }}>
          {entries.map((e) => (
            <div key={e.id} className="score-bet-card" style={{ padding: "8px 12px" }}>
              <span className="score-bet-nick">{e.nickname}</span>
              <span style={{ marginLeft: "auto", fontSize: 13, color: won ? "var(--green)" : "var(--muted)" }}>
                {won ? `+${e.payout?.toLocaleString()}` : `-${e.amount.toLocaleString()}`}
              </span>
            </div>
          ))}
        </div>
      )}

      {entries.length === 0 && (
        <div className="empty" style={{ padding: "8px 0" }}>Никто не поставил</div>
      )}
    </div>
  );
}
