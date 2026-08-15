import { useEffect, useRef } from 'react';

export default function GoogleSignInButton({ gisReady, onCredential }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!gisReady || !ref.current || !window.google?.accounts?.id) return;
    window.google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      callback: onCredential,
    });
    window.google.accounts.id.renderButton(ref.current, {
      theme: 'filled_black', size: 'medium', shape: 'pill', text: 'signin_with',
    });
  }, [gisReady, onCredential]);

  return <div ref={ref} className="google-signin-btn" />;
}
