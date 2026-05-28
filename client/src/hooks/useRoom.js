import { useState, useEffect, useCallback } from 'react';
import { getSessionFull, getScoreBets } from '../api';

export function useRoom(sessionId) {
  const [session,   setSession]   = useState(null);
  const [players,   setPlayers]   = useState([]);
  const [events,    setEvents]    = useState([]);
  const [scoreBets, setScoreBets] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  const refresh = useCallback(async () => {
    try {
      const [full, score] = await Promise.all([
        getSessionFull(sessionId),
        getScoreBets(sessionId),
      ]);
      setSession(full.session);
      setPlayers(full.players);
      setEvents(full.events);
      setScoreBets(score);
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

  return { session, players, events, scoreBets, loading, error, refresh };
}
