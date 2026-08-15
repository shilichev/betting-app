import { useState, useEffect } from "react";
import { createRaceBet, placeRaceBetEntry, lockRaceBet, resolveRaceBet, deleteRaceBet } from "../api";
import DateTimePicker from "./DateTimePicker";

export default function RaceBetSection({
  sessionId, raceBets: { bets, options, entries },
  isHost, sessionStatus, guestToken, myPlayerId, myBalance, fixedBet,
  createOpen, onCreateClose, onUpdate,
}) {
  const activeBets   = bets.filter(b => b.status === "open" || b.status === "locked");
  const resolvedBets = bets.filter(b => b.status === "resolved");

  if (activeBets.length === 0 && resolvedBets.length === 0 && !createOpen) return null;

  return (
    <div className="race-section">
      {isHost && createOpen && (
        <CreateRaceForm
          sessionId={sessionId} guestToken={guestToken} fixedBet={fixedBet}
          onCreated={() => { onUpdate(); onCreateClose?.(); }}
          onCancel={onCreateClose}
        />
      )}

      {activeBets.map(bet => {
        const betOptions = options.filter(o => o.race_bet_id === bet.id);
        const betEntries = entries.filter(e => e.race_bet_id === bet.id);
        const myEntry    = betEntries.find(e => String(e.player_id) === String(myPlayerId));
        return (
          <RaceCard key={bet.id} bet={bet} options={betOptions} entries={betEntries}
            myEntry={myEntry} isHost={isHost} guestToken={guestToken}
            myBalance={myBalance} onUpdate={onUpdate} />
        );
      })}

      {resolvedBets.map(bet => {
        const betOptions = options.filter(o => o.race_bet_id === bet.id);
        const betEntries = entries.filter(e => e.race_bet_id === bet.id);
        return (
          <RaceCardResolved key={bet.id} bet={bet} options={betOptions} entries={betEntries} />
        );
      })}
    </div>
  );
}

function CreateRaceForm({ sessionId, guestToken, fixedBet, onCreated, onCancel }) {
  const [title, setTitle]       = useState("");
  const [description, setDesc]  = useState("");
  const [opts, setOpts]         = useState(["", ""]);
  const [minAmount, setMin]     = useState(String(fixedBet));
  const [maxAmount, setMax]     = useState(String(fixedBet * 5));
  const [deadline, setDeadline] = useState(null);
  const [loading, setLoading]   = useState(false);

  function addOpt()        { if (opts.length < 10) setOpts([...opts, ""]); }
  function removeOpt(i)    { if (opts.length > 2) setOpts(opts.filter((_, j) => j !== i)); }
  function setOpt(i, val)  { setOpts(opts.map((o, j) => j === i ? val : o)); }

  async function handleSubmit(e) {
    e.preventDefault();
    const clean = opts.map(o => o.trim()).filter(Boolean);
    if (clean.length < 2) return alert("Минимум 2 варианта");
    setLoading(true);
    try {
      await createRaceBet({
        sessionId, guestToken, title, description,
        options: clean,
        minAmount: parseInt(minAmount),
        maxAmount: parseInt(maxAmount),
        deadline: deadline ? deadline.toISOString() : undefined,
      });
      onCreated();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="card card-dashed" onSubmit={handleSubmit}>
      <div className="card-section-title">Гонка</div>

      <div className="field">
        <label>Название</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Кто забьёт первым?" required />
      </div>
      <div className="field">
        <label>Описание (необязательно)</label>
        <input value={description} onChange={e => setDesc(e.target.value)} placeholder="Дополнительный контекст" />
      </div>

      <div className="field">
        <label>Варианты</label>
        {opts.map((o, i) => (
          <div key={i} className="race-opt-row">
            <input
              value={o}
              onChange={e => setOpt(i, e.target.value)}
              placeholder={`Вариант ${i + 1}`}
              required
            />
            {opts.length > 2 && (
              <button type="button" className="btn btn-sm btn-danger race-opt-remove" onClick={() => removeOpt(i)}>✕</button>
            )}
          </div>
        ))}
        {opts.length < 10 && (
          <button type="button" className="btn btn-sm btn-outline" style={{ marginTop: 6 }} onClick={addOpt}>
            + Добавить вариант
          </button>
        )}
      </div>

      <div className="row-2">
        <div className="field">
          <label>Мин. ставка</label>
          <input type="text" inputMode="numeric" value={minAmount} onChange={e => setMin(e.target.value.replace(/\D/g, ""))} required />
        </div>
        <div className="field">
          <label>Макс. ставка</label>
          <input type="text" inputMode="numeric" value={maxAmount} onChange={e => setMax(e.target.value.replace(/\D/g, ""))} required />
        </div>
      </div>

      <div className="field">
        <label>Закрыть приём до (необязательно)</label>
        <DateTimePicker value={deadline} onChange={setDeadline} />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? "..." : "Создать"}</button>
        <button type="button" className="btn btn-outline" onClick={onCancel}>Отмена</button>
      </div>
    </form>
  );
}

function RaceCard({ bet, options, entries, myEntry, isHost, guestToken, myBalance, onUpdate }) {
  const pool     = entries.reduce((s, e) => s + e.amount, 0);
  const isLocked = bet.status === "locked";

  return (
    <div className="card race-card">
      <div className="prop-bet-header">
        <div className="bet-card-heading">
          <span className="bet-card-icon icon-race">🏁</span>
          <div className="bet-card-heading-text">
            <div className="prop-bet-title">{bet.title}</div>
            {bet.description && <div className="prop-bet-desc">{bet.description}</div>}
          </div>
        </div>
        <div className="prop-bet-meta">
          {isLocked && <span className="badge s-lost">Приём закрыт</span>}
        </div>
      </div>

      {bet.deadline && !isLocked && <Countdown deadline={bet.deadline} />}

      <div className="stat-row">
        <div className="stat-chip">
          <span className="stat-label">Мин. ставка</span>
          <span className="stat-value">🪙 {bet.min_amount.toLocaleString()}</span>
        </div>
        <div className="stat-chip">
          <span className="stat-label">Макс. ставка</span>
          <span className="stat-value">🪙 {bet.max_amount.toLocaleString()}</span>
        </div>
        {pool > 0 && (
          <div className="stat-chip">
            <span className="stat-label">Банк</span>
            <span className="stat-value accent">🪙 {pool.toLocaleString()}</span>
          </div>
        )}
      </div>

      <div className="race-options">
        {options.map(opt => {
          const optEntries = entries.filter(e => e.option_id === opt.id);
          const optPool    = optEntries.reduce((s, e) => s + e.amount, 0);
          const isMine     = myEntry?.option_id === opt.id;
          return (
            <div key={opt.id} className={`race-option${isMine ? " race-option-mine" : ""}`}>
              <div className="race-option-label">{opt.label}</div>
              <div className="race-option-stats">
                {optEntries.length > 0 && (
                  <span className="race-option-pool">{optPool.toLocaleString()}</span>
                )}
                {optEntries.length > 0 && (
                  <span className="race-option-count">{optEntries.length} ставок</span>
                )}
              </div>
              {optEntries.map(e => (
                <div key={e.id} className="race-entry-row">
                  <span className="score-bet-nick">{e.nickname}</span>
                  <span className="race-entry-amount">{e.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {!myEntry && !isHost && !isLocked && (
        <BetEntryForm bet={bet} options={options} guestToken={guestToken} myBalance={myBalance} onPlaced={onUpdate} />
      )}

      {!myEntry && !isHost && isLocked && (
        <div className="already-bet-msg">Приём ставок закрыт</div>
      )}

      {myEntry && (
        <div className="already-bet-msg">
          Ты поставил <strong>{myEntry.amount.toLocaleString()}</strong> на <strong>{options.find(o => o.id === myEntry.option_id)?.label}</strong>
        </div>
      )}

      {isHost && (
        <div className="host-btns" style={{ marginTop: 10 }}>
          {!isLocked && (
            <button className="btn btn-sm btn-outline"
              onClick={async () => { await lockRaceBet(bet.id, guestToken); onUpdate(); }}>
              🔒 Закрыть приём
            </button>
          )}
          {options.map(opt => (
            <button key={opt.id} className="btn btn-sm btn-success"
              onClick={async () => {
                if (confirm(`Победитель — "${opt.label}"?`)) {
                  await resolveRaceBet(bet.id, opt.id, guestToken);
                  onUpdate();
                }
              }}>
              ✓ {opt.label}
            </button>
          ))}
          <button className="btn btn-sm btn-outline"
            onClick={async () => {
              if (confirm("Удалить? Деньги вернутся.")) {
                await deleteRaceBet(bet.id, guestToken);
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

function BetEntryForm({ bet, options, guestToken, myBalance, onPlaced }) {
  const [selectedOption, setSelectedOption] = useState(null);
  const [amount, setAmount] = useState(String(bet.min_amount));
  const [loading, setLoading] = useState(false);

  const amt   = parseInt(amount) || 0;
  const valid = selectedOption && amt >= bet.min_amount && amt <= bet.max_amount;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!valid) return;
    if (myBalance < amt) return alert("Недостаточно баланса");
    setLoading(true);
    try {
      await placeRaceBetEntry(bet.id, { guestToken, optionId: selectedOption, amount: amt });
      onPlaced();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="race-entry-form" onSubmit={handleSubmit}>
      <div className="race-entry-options">
        {options.map(opt => (
          <button key={opt.id} type="button"
            className={`race-pick-btn${selectedOption === opt.id ? " selected" : ""}`}
            onClick={() => setSelectedOption(opt.id)}>
            {opt.label}
          </button>
        ))}
      </div>
      <div className="prop-entry-form" style={{ marginTop: 10 }}>
        <input
          type="text" inputMode="numeric"
          value={amount}
          onChange={e => setAmount(e.target.value.replace(/\D/g, ""))}
          className="prop-entry-input"
          placeholder={String(bet.min_amount)}
        />
        <span className="prop-payout-preview" style={{ fontSize: 12, color: "var(--muted)" }}>
          от {bet.min_amount.toLocaleString()} до {bet.max_amount.toLocaleString()}
        </span>
        <button type="submit" className="btn btn-primary btn-sm" disabled={loading || !valid || myBalance < amt}>
          {loading ? "..." : "Поставить"}
        </button>
      </div>
    </form>
  );
}

function RaceCardResolved({ bet, options, entries }) {
  const winOpt   = options.find(o => o.id === bet.winning_option_id);
  const totalPool = entries.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="card card-resolved race-card">
      <div className="prop-bet-header">
        <div className="bet-card-heading">
          <span className="bet-card-icon icon-race">🏁</span>
          <div className="bet-card-heading-text">
            <div className="prop-bet-title">{bet.title}</div>
            {bet.description && <div className="prop-bet-desc">{bet.description}</div>}
          </div>
        </div>
        <div className="prop-bet-meta">
          <span className="score-bank">Банк: <strong>{totalPool.toLocaleString()}</strong></span>
          <span className="badge s-won">Завершён</span>
        </div>
      </div>

      {winOpt && (
        <div className="winner-row" style={{ marginBottom: 10 }}>
          🏆 Победитель: <strong>{winOpt.label}</strong>
        </div>
      )}

      <div className="race-options">
        {options.map(opt => {
          const optEntries = entries.filter(e => e.option_id === opt.id);
          const isWinner   = opt.id === bet.winning_option_id;
          return (
            <div key={opt.id} className={`race-option${isWinner ? " race-option-winner" : ""}`}>
              <div className="race-option-label">{opt.label}</div>
              {optEntries.map(e => (
                <div key={e.id} className="race-entry-row">
                  <span className="score-bet-nick">{e.nickname}</span>
                  <span style={{ marginLeft: "auto", fontSize: 13, color: e.status === "won" ? "var(--green)" : "var(--muted)" }}>
                    {e.status === "won" ? `+${e.payout?.toLocaleString()}` : `-${e.amount.toLocaleString()}`}
                  </span>
                </div>
              ))}
              {optEntries.length === 0 && (
                <div className="race-entry-row" style={{ color: "var(--border)" }}>нет ставок</div>
              )}
            </div>
          );
        })}
      </div>
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
