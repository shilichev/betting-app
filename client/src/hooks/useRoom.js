import { useState, useEffect, useCallback } from 'react';
import { getSessionFull, getScoreBets, getPropBets, getRaceBets, getDuels } from '../api';

export function useRoom(sessionId) {
  const [session,    setSession]    = useState(null);
  const [players,    setPlayers]    = useState([]);
  const [events,     setEvents]     = useState([]);
  const [scoreBets,  setScoreBets]  = useState([]);
  const [propBets,   setPropBets]   = useState({ bets: [], entries: [] });
  const [raceBets,   setRaceBets]   = useState({ bets: [], options: [], entries: [] });
  const [duels,      setDuels]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

  const refresh = useCallback(async () => {
    try {
      const [full, score, prop, race, duelList] = await Promise.all([
        getSessionFull(sessionId),
        getScoreBets(sessionId),
        getPropBets(sessionId),
        getRaceBets(sessionId),
        getDuels(sessionId),
      ]);
      setSession(full.session);
      setPlayers(full.players);
      setEvents(full.events);
      setScoreBets(score);
      setPropBets(prop);
      setRaceBets(race);
      setDuels(duelList);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { session, players, events, scoreBets, propBets, raceBets, duels, loading, error, refresh };
}
