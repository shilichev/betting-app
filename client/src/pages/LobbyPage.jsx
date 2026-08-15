import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { createSession, getSessionByCode, getSessionFull, joinSession } from '../api';
import { useAuth } from '../hooks/useAuth';
import GoogleSignInButton from '../components/GoogleSignInButton';
import MyRooms from '../components/MyRooms';

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      className={`toggle ${checked ? 'toggle-on' : ''}`}
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
    >
      <span className="toggle-knob" />
    </button>
  );
}

function CopyRow({ label, value, displayValue, onCopy, copied, disabled }) {
  return (
    <div className={`invite-row ${disabled ? 'disabled' : ''}`}>
      <div className="invite-row-label">{label}</div>
      <div className="invite-row-value-wrap">
        <span className="invite-row-value mono">{displayValue ?? value}</span>
        <button
          type="button"
          className={`icon-btn ${copied ? 'copied' : ''}`}
          onClick={() => !disabled && onCopy(value)}
          disabled={disabled}
          title="Скопировать"
        >
          {copied ? '✓' : '⧉'}
        </button>
      </div>
    </div>
  );
}

function InvitePanel({ preview, code, link, qrDataUrl, isPrivate }) {
  const [copiedKey, setCopiedKey] = useState('');

  function copy(text, key) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 1500);
  }

  return (
    <div className="card invite-panel">
      <div className="invite-panel-title">Что получат игроки после создания</div>
      <div className="invite-panel-hint">Поделитесь кодом или ссылкой, чтобы пригласить друзей</div>

      <CopyRow
        label="Код комнаты"
        value={code}
        displayValue={preview ? '——————' : (isPrivate ? 'скрыт (приватная комната)' : code)}
        onCopy={v => copy(v, 'code')}
        copied={copiedKey === 'code'}
        disabled={preview || isPrivate}
      />
      <CopyRow
        label="Ссылка для приглашения"
        value={link}
        displayValue={preview
          ? `${window.location.host}/${isPrivate ? 'invite/••••••••…' : 'join/••••••'}`
          : link.replace(/^https?:\/\//, '')}
        onCopy={v => copy(v, 'link')}
        copied={copiedKey === 'link'}
        disabled={preview}
      />

      <div className="invite-row">
        <div className="invite-row-label">QR-код</div>
        <div className="qr-box">
          {preview || !qrDataUrl
            ? <div className="qr-placeholder">▦</div>
            : <img className="qr-img" src={qrDataUrl} alt="QR-код приглашения" />}
        </div>
      </div>

      <div className="tip-box">
        <span>💡</span>
        <span>Поделитесь ссылкой или QR-кодом — друзья смогут быстро присоединиться</span>
      </div>
    </div>
  );
}

function HelpModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Как это работает</div>
        <div className="modal-body">
          <p>1. Создай комнату — задай название, стартовый баланс и границы ставок.</p>
          <p>2. Поделись кодом, ссылкой или QR-кодом с друзьями.</p>
          <p>3. Делайте прогнозы на матчи, вызывайте друг друга на дуэли и следите за балансом — всё на виртуальные монеты.</p>
          <p>4. Потерял вкладку? Восстанови сессию по PIN, который получаешь при входе.</p>
        </div>
        <button className="btn btn-primary btn-full" onClick={onClose}>Понятно</button>
      </div>
    </div>
  );
}

export default function LobbyPage() {
  const navigate = useNavigate();
  const { code: inviteCode, sessionId: inviteSessionId } = useParams();
  const savedCode = localStorage.getItem('lastRoomCode') || '';
  const initialCode = (inviteCode || savedCode || '').toUpperCase();

  const { user, gisReady, handleCredential, signOut } = useAuth();

  const [tab, setTab] = useState(inviteCode || inviteSessionId || savedCode ? 'join' : 'create');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [createdRoom, setCreatedRoom] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [inviteSession, setInviteSession] = useState(null); // резолвится по /invite/:sessionId (приватные комнаты)

  const [createForm, setCreateForm] = useState({
    title: '', nickname: '', startingBalance: 1000,
    minBet: 50, maxBet: 500, betStep: 50, isPrivate: false,
  });
  const [joinForm, setJoinForm] = useState({ code: initialCode, nickname: '', pin: '' });

  // Ссылка-приглашение для приватной комнаты ведёт по session.id, а не по короткому коду
  useEffect(() => {
    if (!inviteSessionId) return;
    setTab('join');
    getSessionFull(inviteSessionId)
      .then(data => setInviteSession(data.session))
      .catch(() => setError('Ссылка недействительна или комната была удалена'));
  }, [inviteSessionId]);

  useEffect(() => {
    if (!createdRoom) return;
    const link = createdRoom.session.is_private
      ? `${window.location.origin}/invite/${createdRoom.session.id}`
      : `${window.location.origin}/join/${createdRoom.session.code}`;
    QRCode.toDataURL(link, { margin: 1, width: 240, color: { dark: '#000000', light: '#ffffff' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [createdRoom]);

  // Подставляем имя из гугл-профиля, если поле ника ещё не тронуто
  useEffect(() => {
    if (user && !createForm.nickname) {
      setCreateForm(f => ({ ...f, nickname: user.name || '' }));
    }
  }, [user]);

  async function handleGoogleCredential(response) {
    setError('');
    try {
      await handleCredential(response);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const data = await createSession(createForm);
      localStorage.setItem('guestToken', data.guestToken);
      localStorage.setItem('playerId', data.player.id);
      localStorage.setItem('lastRoomCode', data.session.code);
      setCreatedRoom(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const session = inviteSession || await getSessionByCode(joinForm.code);
      const pin = joinForm.pin.trim();
      const data = await joinSession(session.id, pin
        ? { pin }
        : { nickname: joinForm.nickname }
      );
      localStorage.setItem('guestToken', data.guestToken);
      localStorage.setItem('playerId', data.player.id);
      localStorage.setItem('lastRoomCode', session.code);
      if (data.rejoin) {
        navigate(`/room/${session.id}`);
      } else {
        setCreatedRoom({ ...data, session });
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (createdRoom) {
    const link = createdRoom.session.is_private
      ? `${window.location.origin}/invite/${createdRoom.session.id}`
      : `${window.location.origin}/join/${createdRoom.session.code}`;
    return (
      <div className="lobby-page">
        <header className="lobby-header">
          <h1 className="logo">Bet<span>Room</span></h1>
        </header>
        <div className="lobby-grid">
          <div className="card lobby-panel">
            <div className="pin-reveal">
              <p className="pin-reveal-label">Твой персональный PIN</p>
              <div className="pin-reveal-code">{createdRoom.pin}</div>
              <p className="pin-reveal-hint">
                Запомни или сделай скриншот — он нужен для восстановления сессии если закроешь вкладку
              </p>
              <button className="btn btn-primary btn-full" onClick={() => navigate(`/room/${createdRoom.session.id}`)}>
                Войти в комнату →
              </button>
            </div>
          </div>
          <InvitePanel preview={false} code={createdRoom.session.code} link={link} qrDataUrl={qrDataUrl} isPrivate={createdRoom.session.is_private} />
        </div>
      </div>
    );
  }

  return (
    <div className="lobby-page">
      <header className="lobby-header">
        <h1 className="logo">Bet<span>Room</span></h1>
        <div className="lobby-header-right">
          <button type="button" className="help-link" onClick={() => setShowHelp(true)}>
            <span className="help-icon">?</span> Как это работает
          </button>
          {user
            ? (
              <div className="user-chip">
                {user.picture && <img src={user.picture} alt="" className="user-chip-avatar" />}
                <span className="user-chip-name">{user.name}</span>
                <button type="button" className="link-btn" onClick={signOut}>Выйти</button>
              </div>
            )
            : <GoogleSignInButton gisReady={gisReady} onCredential={handleGoogleCredential} />}
        </div>
      </header>

      <div className="lobby-hero">
        <h2>Создайте комнату или войдите по коду</h2>
        <p className="subtitle">Играйте с друзьями, делайте прогнозы и побеждайте</p>
      </div>

      <div className="lobby-grid">
        <div className="card lobby-panel">
          <div className="tabs">
            <button className={`tab ${tab === 'create' ? 'active' : ''}`} onClick={() => { setTab('create'); setError(''); }}>
              👥 Создать комнату
            </button>
            <button className={`tab ${tab === 'join' ? 'active' : ''}`} onClick={() => { setTab('join'); setError(''); }}>
              🔑 Войти по коду
            </button>
          </div>

          {tab === 'create' ? (
            !user ? (
              <div className="auth-gate">
                <p className="auth-gate-text">Создавать комнаты могут только зарегистрированные пользователи — войди через Google.</p>
                <GoogleSignInButton gisReady={gisReady} onCredential={handleGoogleCredential} />
              </div>
            ) : (
            <form onSubmit={handleCreate}>
              <div className="field">
                <label className="field-label-row">
                  <span>Название комнаты 🔒</span>
                  <span className="field-counter">{createForm.title.length}/50</span>
                </label>
                <input value={createForm.title} onChange={e => setCreateForm({ ...createForm, title: e.target.value })}
                  placeholder="Финал ЛЧ у Кирилла" required maxLength={50} />
              </div>
              <div className="field">
                <label>Твой никнейм</label>
                <input value={createForm.nickname} onChange={e => setCreateForm({ ...createForm, nickname: e.target.value })}
                  placeholder="Хост" required maxLength={30} />
              </div>
              <div className="row-4">
                <div className="field">
                  <label>Стартовый баланс</label>
                  <div className="input-icon-wrap">
                    <input type="number" value={createForm.startingBalance} min={0}
                      onChange={e => setCreateForm({ ...createForm, startingBalance: Number(e.target.value) })} />
                    <span className="input-icon">🪙</span>
                  </div>
                </div>
                <div className="field">
                  <label>Мин. ставка</label>
                  <div className="input-icon-wrap">
                    <input type="number" value={createForm.minBet} min={1}
                      onChange={e => setCreateForm({ ...createForm, minBet: Number(e.target.value) })} />
                    <span className="input-icon">🪙</span>
                  </div>
                </div>
                <div className="field">
                  <label>Макс. ставка</label>
                  <div className="input-icon-wrap">
                    <input type="number" value={createForm.maxBet} min={1}
                      onChange={e => setCreateForm({ ...createForm, maxBet: Number(e.target.value) })} />
                    <span className="input-icon">🪙</span>
                  </div>
                </div>
                <div className="field">
                  <label>Шаг ставки</label>
                  <div className="input-icon-wrap">
                    <input type="number" value={createForm.betStep} min={1}
                      onChange={e => setCreateForm({ ...createForm, betStep: Number(e.target.value) })} />
                    <span className="input-icon">🪙</span>
                  </div>
                </div>
              </div>

              <div className="toggle-row">
                <div>
                  <div className="toggle-row-title">Только по приглашению 🔒</div>
                  <div className="toggle-row-hint">Присоединиться смогут только те, у кого есть ссылка-приглашение</div>
                </div>
                <Toggle checked={createForm.isPrivate} onChange={v => setCreateForm({ ...createForm, isPrivate: v })} />
              </div>

              <div className="info-box">
                <span className="info-icon">ℹ️</span>
                <div>
                  <strong>В BetRoom используются только виртуальные монеты.</strong>
                  Никаких реальных денег — только спорт, прогнозы и соревнование с друзьями.
                </div>
              </div>

              {error && <div className="error-msg">{error}</div>}
              <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                {loading ? 'Создаём...' : '➕ Создать комнату'}
              </button>
            </form>
            )
          ) : (
            <form onSubmit={handleJoin}>
              {inviteSession ? (
                <div className="field">
                  <label>Комната</label>
                  <div className="invite-resolved">🔒 «{inviteSession.title}» — вход по приглашению</div>
                </div>
              ) : (
                <div className="field">
                  <label>Код комнаты</label>
                  <input value={joinForm.code} maxLength={6}
                    onChange={e => setJoinForm({ ...joinForm, code: e.target.value.toUpperCase() })}
                    placeholder="ABC123" className="code-input" required />
                </div>
              )}
              {joinForm.pin
                ? <div className="field">
                    <label>PIN (восстановление сессии)</label>
                    <input value={joinForm.pin} maxLength={6} className="code-input"
                      onChange={e => setJoinForm({ ...joinForm, pin: e.target.value.replace(/\D/g, '') })}
                      placeholder="738291" autoFocus />
                    <button type="button" className="link-btn" onClick={() => setJoinForm({ ...joinForm, pin: '' })}>
                      Войти как новый игрок
                    </button>
                  </div>
                : <div className="field">
                    <label>Твой никнейм</label>
                    <input value={joinForm.nickname} onChange={e => setJoinForm({ ...joinForm, nickname: e.target.value })}
                      placeholder="Игрок" required maxLength={30} />
                    <button type="button" className="link-btn" onClick={() => setJoinForm({ ...joinForm, nickname: '', pin: ' ' })}>
                      Уже был в комнате? Войти по PIN
                    </button>
                  </div>
              }
              {error && <div className="error-msg">{error}</div>}
              <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                {loading ? 'Входим...' : joinForm.pin ? 'Восстановить сессию' : 'Войти в комнату'}
              </button>
            </form>
          )}
        </div>

        {tab === 'create' && <InvitePanel preview code="" link="" qrDataUrl="" isPrivate={createForm.isPrivate} />}
      </div>

      {user && (
        <div className="lobby-grid">
          <MyRooms refreshKey={user.id} />
        </div>
      )}

      <p className="lobby-footer">BetRoom — ставки между друзьями на спорт.</p>

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}
