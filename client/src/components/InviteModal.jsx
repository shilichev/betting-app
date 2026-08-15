import { useState, useEffect } from 'react';
import QRCode from 'qrcode';

export default function InviteModal({ session, onClose }) {
  const [copiedKey, setCopiedKey] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');

  const link = session.is_private
    ? `${window.location.origin}/invite/${session.id}`
    : `${window.location.origin}/join/${session.code}`;

  useEffect(() => {
    QRCode.toDataURL(link, { margin: 1, width: 240, color: { dark: '#000000', light: '#ffffff' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [link]);

  function copy(text, key) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 1500);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Пригласить игроков</div>
        <div className="invite-panel-hint">Поделитесь кодом или ссылкой, чтобы пригласить друзей</div>

        <div className="invite-row">
          <div className="invite-row-label">Код комнаты</div>
          <div className="invite-row-value-wrap">
            <span className="invite-row-value mono">{session.code}</span>
            <button
              type="button" className={`icon-btn ${copiedKey === 'code' ? 'copied' : ''}`}
              onClick={() => copy(session.code, 'code')} title="Скопировать"
            >
              {copiedKey === 'code' ? '✓' : '⧉'}
            </button>
          </div>
        </div>

        <div className="invite-row">
          <div className="invite-row-label">Ссылка для приглашения</div>
          <div className="invite-row-value-wrap">
            <span className="invite-row-value mono">{link.replace(/^https?:\/\//, '')}</span>
            <button
              type="button" className={`icon-btn ${copiedKey === 'link' ? 'copied' : ''}`}
              onClick={() => copy(link, 'link')} title="Скопировать"
            >
              {copiedKey === 'link' ? '✓' : '⧉'}
            </button>
          </div>
        </div>

        <div className="invite-row">
          <div className="invite-row-label">QR-код</div>
          <div className="qr-box">
            {qrDataUrl
              ? <img className="qr-img" src={qrDataUrl} alt="QR-код приглашения" />
              : <div className="qr-placeholder">▦</div>}
          </div>
        </div>

        <div className="tip-box">
          <span>💡</span>
          <span>Поделитесь ссылкой или QR-кодом — друзья смогут быстро присоединиться</span>
        </div>

        <button className="btn btn-primary btn-full" onClick={onClose}>Готово</button>
      </div>
    </div>
  );
}
