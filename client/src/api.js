// ─────────────────────────────────────────────
//  api.js — все обращения к серверу в одном месте
//  Чтобы добавить новый запрос — просто допиши функцию сюда
// ─────────────────────────────────────────────

const BASE = '/api';

// Вспомогательные функции
async function request(method, url, body) {
  const appToken = localStorage.getItem('appToken');
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(appToken ? { Authorization: `Bearer ${appToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { error: text || `HTTP ${res.status}` }; }
  if (!res.ok) throw new Error(data.error || 'Server error');
  return data;
}

const get   = (url)        => request('GET',   url);
const post  = (url, body)  => request('POST',  url, body);
const patch = (url, body)  => request('PATCH', url, body);


// ── Auth ──────────────────────────────────────
export const googleLogin = (idToken) => post(`${BASE}/auth/google`, { idToken });
export const getMyRooms  = ()        => get(`${BASE}/users/me/sessions`);

// ── Sessions ──────────────────────────────────
export const createSession    = (data)       => post(`${BASE}/sessions`, data);
export const getSessionByCode = (code)       => get(`${BASE}/sessions/${code}`);
export const getSessionFull   = (id)         => get(`${BASE}/sessions/${id}/full`);
export const joinSession      = (id, data)   => post(`${BASE}/sessions/${id}/join`, data);
export const getMyPlayer      = (id)         => get(`${BASE}/sessions/${id}/my-player`);
export const startSession     = (id)         => patch(`${BASE}/sessions/${id}/start`);
export const finishSession    = (id)         => patch(`${BASE}/sessions/${id}/finish`);

// ── Events (матчи) ────────────────────────────
export const createEvent  = (data) => post(`${BASE}/events`, data);
export const lockEvent    = (id)   => patch(`${BASE}/events/${id}/lock`);
export const updateEvent  = (id, data) => patch(`${BASE}/events/${id}`, data);
export const deleteEvent  = (id)   => request('DELETE', `${BASE}/events/${id}`);

// ── Score bets ────────────────────────────────
export const getScoreBets    = (sessionId)                        => get(`${BASE}/score-bets/${sessionId}`);
export const placeScoreBet   = (data)                             => post(`${BASE}/score-bets`, data);
export const resolveScoreBet = (eventId, actualScore, guestToken) => patch(`${BASE}/score-bets/event/${eventId}/resolve`, { actualScore, guestToken });

// ── Duels ─────────────────────────────────────
export const getDuels       = (sessionId)              => get(`${BASE}/duels/${sessionId}`);
export const createDuel     = (data)                   => post(`${BASE}/duels`, data);
export const acceptDuel     = (id, token)              => patch(`${BASE}/duels/${id}/accept`, { guestToken: token });
export const declineDuel    = (id, token)              => patch(`${BASE}/duels/${id}/decline`, { guestToken: token });
export const cancelDuel     = (id, token)              => patch(`${BASE}/duels/${id}/cancel`, { guestToken: token });
export const resolveDuel    = (id, winnerId, token)    => patch(`${BASE}/duels/${id}/resolve`, { winnerId, guestToken: token });

// ── Race bets ─────────────────────────────────
export const getRaceBets      = (sessionId)                  => get(`${BASE}/race-bets/${sessionId}`);
export const createRaceBet    = (data)                       => post(`${BASE}/race-bets`, data);
export const placeRaceBetEntry = (id, data)                  => post(`${BASE}/race-bets/${id}/bet`, data);
export const lockRaceBet      = (id, token)                  => patch(`${BASE}/race-bets/${id}/lock`, { guestToken: token });
export const resolveRaceBet   = (id, winningOptionId, token) => patch(`${BASE}/race-bets/${id}/resolve`, { winningOptionId, guestToken: token });
export const deleteRaceBet    = (id, token)                  => request('DELETE', `${BASE}/race-bets/${id}`, { guestToken: token });

// ── Prop bets ─────────────────────────────────
export const getPropBets      = (sessionId)            => get(`${BASE}/prop-bets/${sessionId}`);
export const createPropBet    = (data)                 => post(`${BASE}/prop-bets`, data);
export const placePropBetEntry = (id, data)            => post(`${BASE}/prop-bets/${id}/bet`, data);
export const lockPropBet      = (id, token)            => patch(`${BASE}/prop-bets/${id}/lock`, { guestToken: token });
export const resolvePropBet   = (id, outcome, token)   => patch(`${BASE}/prop-bets/${id}/resolve`, { outcome, guestToken: token });
export const deletePropBet    = (id, token)            => request('DELETE', `${BASE}/prop-bets/${id}`, { guestToken: token });

// ── Players ───────────────────────────────────
export const adjustBalance = (id, delta, reason) =>
  patch(`${BASE}/players/${id}/balance`, { delta, reason });
export const kickPlayer = (id) => request('DELETE', `${BASE}/players/${id}`);

// ── Matches ───────────────────────────────────
export const getMatches    = (sessionId) => get(`${BASE}/matches/${sessionId}`);
export const createMatch   = (data)      => post(`${BASE}/matches`, data);
export const deleteMatch   = (id)        => request('DELETE', `${BASE}/matches/${id}`);
