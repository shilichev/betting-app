import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyRooms } from '../api';

const STATUS_LABEL = { waiting: 'Ожидание', active: 'Идёт игра', finished: 'Завершена' };

export default function MyRooms({ refreshKey }) {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getMyRooms()
      .then(data => { if (!cancelled) setRooms(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshKey]);

  if (loading || !rooms.length) return null;

  return (
    <section className="my-rooms">
      <div className="my-rooms-title">Твои комнаты</div>
      <div className="my-rooms-list">
        {rooms.map(r => (
          <div key={r.id} className="my-rooms-item">
            <div className="my-rooms-item-main">
              <span className="my-rooms-item-title">{r.title}</span>
              <span className={`badge s-${r.status}`}>{STATUS_LABEL[r.status] || r.status}</span>
            </div>
            <div className="my-rooms-item-meta">
              {r.isHost ? 'Хост' : 'Участник'} · {r.playerCount} игрок(ов) · код {r.code}
            </div>
            <button type="button" className="btn btn-outline btn-sm btn-full" onClick={() => navigate(`/room/${r.id}`)}>
              Войти →
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
