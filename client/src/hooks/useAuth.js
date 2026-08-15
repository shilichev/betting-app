import { useState, useEffect, useCallback } from 'react';
import { googleLogin } from '../api';

const GIS_SRC = 'https://accounts.google.com/gsi/client';

function loadGisScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
    if (existing) { existing.addEventListener('load', resolve); return; }
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export function useAuth() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('authUser') || 'null'); } catch { return null; }
  });
  const [gisReady, setGisReady] = useState(false);

  useEffect(() => {
    loadGisScript().then(() => setGisReady(true)).catch(() => {});
  }, []);

  const handleCredential = useCallback(async (response) => {
    const data = await googleLogin(response.credential);
    localStorage.setItem('appToken', data.token);
    localStorage.setItem('authUser', JSON.stringify(data.user));
    setUser(data.user);
  }, []);

  function signOut() {
    localStorage.removeItem('appToken');
    localStorage.removeItem('authUser');
    setUser(null);
  }

  return { user, gisReady, handleCredential, signOut };
}
