import { useState, useEffect } from "react";
import { placeScoreBet, resolveScoreBet, lockEvent } from "../api";

export default function ScoreBetSection({
  sessionId,
  events,
  scoreBets,
  isHost,
  sessionStatus,
  guestToken,
  myBalance,
  fixedBet,
  myPlayerId,
  onUpdate,
}) {
  const openEvents = events.filter((ev) => ev.status === "open" || ev.status === "locked");
  const resolvedEvents = events.filter((ev) => ev.status === "resolved");
  const BET_LIMIT = 3;

  if (events.length === 0) return <div className="empty">Матчей нет</div>;

  return (
    <div>
      {openEvents.map((ev) => {
        const bets = scoreBets.filter((b) => b.event_id === ev.id);
        const bank = bets.reduce((s, b) => s + Number(b.amount), 0);
        const eventBetAmount = ev.score_bet_amount ?? fixedBet;
        return (
          <MatchCard
            key={ev.id}
            event={ev}
            bets={bets}
            bank={bank}
            isHost={isHost}
            sessionId={sessionId}
            guestToken={guestToken}
            myBalance={myBalance}
            fixedBet={eventBetAmount}
            myPlayerId={myPlayerId}
            betLimit={BET_LIMIT}
            sessionStatus={sessionStatus}
            onUpdate={onUpdate}
          />
        );
      })}

      {resolvedEvents.map((ev) => {
        const bets = scoreBets.filter((b) => b.event_id === ev.id);
        const winners = bets.filter((b) => b.status === "won");
        const losers = bets.filter((b) => b.status !== "won");
        const totalBank = bets.reduce((s, b) => s + Number(b.amount), 0);
        return (
          <div key={ev.id} className="card card-resolved">
            <div className="score-group-header">
              <span className="score-group-title">{ev.title}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {ev.outcome && (
                  <span className="score-actual">Счёт: <strong>{ev.outcome}</strong></span>
                )}
                <span className="score-bank">Банк: <strong>{totalBank.toLocaleString()}</strong></span>
                <span className="badge s-won">Завершён</span>
              </div>
            </div>
            {winners.length > 0 ? (
              <div className="winners-list">
                {winners.map((w) => (
                  <div key={w.id} className="winner-row">
                    🏆 {w.nickname} — {w.prediction} +{w.payout.toLocaleString()}
                  </div>
                ))}
              </div>
            ) : (
              <div className="winner-row no-winner">Никто не угадал — {totalBank.toLocaleString()} уходит в джекпот</div>
            )}
            {losers.length > 0 && (
              <div className="bets-list">
                {losers.map((b) => (
                  <div key={b.id} className="score-bet-card">
                    <span className="score-bet-nick">{b.nickname}</span>
                    <span className="score-bet-prediction">{b.prediction}</span>
                    <span className="badge s-lost">Не зашло</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MatchCard({
  event,
  bets,
  bank,
  isHost,
  sessionId,
  guestToken,
  myBalance,
  fixedBet,
  myPlayerId,
  betLimit,
  sessionStatus,
  onUpdate,
}) {
  const myMatchBets = bets.filter((b) => String(b.player_id) === String(myPlayerId));
  const myMatchBetsCount = myMatchBets.length;
  const limitReached = myMatchBetsCount >= betLimit;
  const isLocked = event.status === "locked";

  return (
    <div className="card">
      <div className="score-group-header">
        <span className="score-group-title">{event.title}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {!isHost && sessionStatus === "active" && !isLocked && (
            <span className="bets-counter">{myMatchBetsCount} / {betLimit}</span>
          )}
          {isLocked && <span className="badge s-lost" style={{ fontSize: 11 }}>Приём закрыт</span>}
          <span className="score-bank">
            Банк: <strong>{bank.toLocaleString()}</strong>
          </span>
        </div>
      </div>

      {event.deadline && !isLocked && <Countdown deadline={event.deadline} />}

      {sessionStatus === "active" && !isLocked && !limitReached && (
        <BetForm
          event={event}
          sessionId={sessionId}
          guestToken={guestToken}
          myBalance={myBalance}
          fixedBet={fixedBet}
          onCreated={onUpdate}
        />
      )}

      {sessionStatus === "active" && isLocked && !isHost && (
        <div className="already-bet-msg">Приём ставок закрыт</div>
      )}

      {sessionStatus === "active" && !isLocked && limitReached && (
        <div className="already-bet-msg">Лимит ставок на матч: {betLimit}/{betLimit}</div>
      )}

      <div className="bets-list">
        {bets.length === 0 ? (
          <div className="empty" style={{ padding: "12px 0" }}>
            Ставок пока нет
          </div>
        ) : (
          bets.map((bet) => <BetRow key={bet.id} bet={bet} />)
        )}
      </div>

      {isHost && sessionStatus === "active" && (
        <ResolveForm event={event} guestToken={guestToken} isLocked={isLocked} onResolved={onUpdate} onLocked={onUpdate} />
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

function BetForm({ event, sessionId, guestToken, myBalance, fixedBet, onCreated }) {
  const [score1, setScore1] = useState("");
  const [score2, setScore2] = useState("");
  const [loading, setLoading] = useState(false);

  const n1 = parseInt(score1), n2 = parseInt(score2);
  const predictedWinner =
    isNaN(n1) || isNaN(n2) ? "team1" : n1 > n2 ? "team1" : n2 > n1 ? "team2" : "draw";

  async function handleSubmit(e) {
    e.preventDefault();
    if (myBalance < fixedBet) return alert("Недостаточно баланса");
    setLoading(true);
    try {
      await placeScoreBet({
        sessionId,
        guestToken,
        eventId: event.id,
        prediction: `${score1}:${score2}`,
        predictedWinner,
      });
      setScore1("");
      setScore2("");
      onCreated();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="bet-form" onSubmit={handleSubmit}>
      <div className="score-inputs-row">
        <div className="score-team-label">{event.option_a}</div>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={2}
          value={score1}
          onChange={(e) => setScore1(e.target.value.replace(/\D/g, ""))}
          className="score-num-input"
          placeholder="0"
          required
        />
        <span className="score-dash">—</span>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={2}
          value={score2}
          onChange={(e) => setScore2(e.target.value.replace(/\D/g, ""))}
          className="score-num-input"
          placeholder="0"
          required
        />
        <div className="score-team-label">{event.option_b}</div>
      </div>
      <div className="bet-submit-row" style={{ marginTop: 12 }}>
        <span className="fixed-bet-label">
          Ставка: <strong>{fixedBet.toLocaleString()}</strong> монет
        </span>
        <button
          type="submit"
          className="btn btn-primary btn-sm"
          disabled={loading || myBalance < fixedBet || score1 === "" || score2 === ""}
        >
          {loading ? "..." : "Поставить"}
        </button>
      </div>
    </form>
  );
}

function ResolveForm({ event, guestToken, isLocked, onResolved, onLocked }) {
  const [score1, setScore1] = useState("");
  const [score2, setScore2] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleResolve(e) {
    e.preventDefault();
    if (!confirm(`Завершить матч со счётом ${score1}:${score2}?`)) return;
    setLoading(true);
    try {
      await resolveScoreBet(event.id, `${score1}:${score2}`, guestToken);
      onResolved();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="resolve-form-wrapper">
      {!isLocked && (
        <button
          type="button"
          className="btn btn-sm btn-outline"
          onClick={async () => { await lockEvent(event.id); onLocked(); }}
        >
          🔒 Закрыть приём
        </button>
      )}
      <form className="resolve-form" onSubmit={handleResolve}>
        <span className="resolve-label">Реальный счёт:</span>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={2}
          value={score1}
          onChange={(e) => setScore1(e.target.value.replace(/\D/g, ""))}
          className="score-num-input resolve-input"
          placeholder="0"
          required
        />
        <span className="score-dash">:</span>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={2}
          value={score2}
          onChange={(e) => setScore2(e.target.value.replace(/\D/g, ""))}
          className="score-num-input resolve-input"
          placeholder="0"
          required
        />
        <button
          type="submit"
          className="btn btn-danger btn-sm"
          disabled={loading || score1 === "" || score2 === ""}
        >
          {loading ? "..." : "Завершить матч"}
        </button>
      </form>
    </div>
  );
}

function BetRow({ bet }) {
  const statusMap = {
    created: "Принято",
    confirmed: "Подтверждено",
    won: "Победитель 🏆",
    lost: "Не зашло",
  };

  return (
    <div className="score-bet-card">
      <div className="score-bet-top">
        <div>
          <div className="score-bet-nick">{bet.nickname}</div>
          <div className="score-bet-prediction">{bet.prediction}</div>
        </div>
        <div className="score-bet-right">
          <span className="bet-amount">{bet.amount.toLocaleString()}</span>
          <span className={`badge s-${bet.status}`}>{statusMap[bet.status] ?? bet.status}</span>
          {bet.status === "won" && (
            <span className="text-win">+{bet.payout.toLocaleString()}</span>
          )}
        </div>
      </div>
    </div>
  );
}
