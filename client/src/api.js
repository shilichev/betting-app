// ─────────────────────────────────────────────
//  api.js — все обращения к серверу в одном месте
//  Чтобы добавить новый запрос — просто допиши функцию сюда
// ─────────────────────────────────────────────

const BASE = '/api';

// Вспомогательные функции
async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
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


// ── Sessions ──────────────────────────────────
export const createSession    = (data)       => post(`${BASE}/sessions`, data);
export const getSessionByCode = (code)       => get(`${BASE}/sessions/${code}`);
export const getSessionFull   = (id)         => get(`${BASE}/sessions/${id}/full`);
export const joinSession      = (id, data)   => post(`${BASE}/sessions/${id}/join`, data);
export const startSession     = (id)         => patch(`${BASE}/sessions/${id}/start`);
export const finishSession    = (id)         => patch(`${BASE}/sessions/${id}/finish`);

// ── Events (матчи) ────────────────────────────
export const createEvent  = (data) => post(`${BASE}/events`, data);
export const deleteEvent  = (id)   => request('DELETE', `${BASE}/events/${id}`);

// ── Score bets ────────────────────────────────
export const getScoreBets  = (sessionId) => get(`${BASE}/score-bets/${sessionId}`);
export const placeScoreBet = (data)      => post(`${BASE}/score-bets`, data);
export const wonScoreBet   = (id)        => patch(`${BASE}/score-bets/${id}/won`);
export const lostScoreBet  = (id)        => patch(`${BASE}/score-bets/${id}/lost`);

// ── Players ───────────────────────────────────
export const adjustBalance = (id, delta, reason) =>
  patch(`${BASE}/players/${id}/balance`, { delta, reason });
export const kickPlayer = (id) => request('DELETE', `${BASE}/players/${id}`);

// ── Matches ───────────────────────────────────
export const getMatches    = (sessionId) => get(`${BASE}/matches/${sessionId}`);
export const createMatch   = (data)      => post(`${BASE}/matches`, data);
export const deleteMatch   = (id)        => request('DELETE', `${BASE}/matches/${id}`);
