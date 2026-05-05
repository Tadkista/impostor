import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function JoinRoom() {
  const [code, setCode] = useState('');
  const [confirmStep, setConfirmStep] = useState(false);
  const [customNick, setCustomNick] = useState('');
  const [useCustomNick, setUseCustomNick] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);

  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchRooms = async () => {
    try {
      const res = await axios.get('/api/rooms/available');
      setAvailableRooms(res.data);
    } catch (err) {
      console.error('Failed to fetch available rooms:', err);
    } finally {
      setLoadingRooms(false);
    }
  };

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 3000); // Auto-refresh every 3s
    return () => clearInterval(interval);
  }, []);

  const handleCodeSubmit = (e) => {
    e.preventDefault();
    if (!code || code.length !== 6) return setError('Wprowadź 6-znakowy kod pokoju');
    setCustomNick(user.nick);
    setConfirmStep(true);
    setError('');
  };

  const handleJoin = async () => {
    const nickToUse = useCustomNick ? customNick.trim() : user.nick;
    if (!nickToUse || nickToUse.length < 2) return setError('Pseudonim musi mieć co najmniej 2 znaki');
    if (nickToUse.length > 20) return setError('Pseudonim może mieć maksymalnie 20 znaków');
    setLoading(true);
    setError('');
    try {
      await axios.post('/api/rooms/join', { code, nick: nickToUse });
      navigate(`/game/${code}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Nie udało się dołączyć do pokoju');
    } finally {
      setLoading(false);
    }
  };

  const handleDirectJoin = (roomCode) => {
    setCode(roomCode);
    setCustomNick(user.nick);
    setConfirmStep(true);
    setError('');
  };

  if (confirmStep) return (
    <div className="max-w-md mx-auto mt-12 card p-6">
      <h2 className="text-xl font-bold mb-4">Potwierdź pseudonim</h2>
      <p className="text-muted mb-4">Dołączasz do pokoju <span className="font-mono font-bold text-primary">{code}</span> jako:</p>
      {!useCustomNick ? (
        <>
          <div className="bg-surface border border-border p-3 rounded mb-4 text-center text-lg font-bold">{user.nick}</div>
          <div className="flex gap-3">
            <button className="btn btn-primary flex-1" onClick={handleJoin} disabled={loading}>
              {loading ? 'Dołączanie...' : `Dołącz jako ${user.nick}`}
            </button>
            <div className="flex flex-col gap-2">
              <button className="btn btn-secondary text-xs py-1" onClick={() => setUseCustomNick(true)}>Zmień nick</button>
              <button className="btn btn-secondary text-xs py-1 text-accent" onClick={() => setConfirmStep(false)}>Anuluj</button>
            </div>
          </div>
        </>
      ) : (
        <>
          <input type="text" className="input mb-4" placeholder="Pseudonim (2–20 znaków)" value={customNick} onChange={e => setCustomNick(e.target.value)} maxLength={20} autoFocus />
          <div className="flex gap-3">
            <button className="btn btn-primary flex-1" onClick={handleJoin} disabled={loading || customNick.trim().length < 2}>
              {loading ? 'Dołączanie...' : 'Dołącz'}
            </button>
            <button className="btn btn-secondary" onClick={() => { setUseCustomNick(false); setConfirmStep(false); }}>Anuluj</button>
          </div>
        </>
      )}
      {error && <p className="mt-4 text-accent text-sm">{error}</p>}
    </div>
  );

  return (
    <div className="max-w-md mx-auto mt-12 space-y-6">
      <div className="card p-6">
        <h1 className="text-2xl font-bold mb-6 text-primary">Dołącz do pokoju</h1>
        {error && <div className="bg-accent/20 text-accent p-3 rounded mb-4 text-sm">{error}</div>}
        <form onSubmit={handleCodeSubmit} className="space-y-4">
          <div>
            <label className="label">Kod pokoju</label>
            <input type="text" className="input text-center text-xl tracking-widest uppercase font-mono" maxLength={6} value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="XXXXXX" required />
          </div>
          <button type="submit" className="btn btn-primary w-full" disabled={code.length !== 6 || loading}>Dalej</button>
        </form>
      </div>

      <div className="card p-6">
        <h2 className="text-xl font-bold mb-4 text-primary">Dostępne pokoje</h2>
        {loadingRooms ? (
          <p className="text-center text-muted text-sm">Szukanie pokojów...</p>
        ) : availableRooms.length === 0 ? (
          <p className="text-center text-muted text-sm">Brak otwartych pokojów. Stwórz własny!</p>
        ) : (
          <ul className="space-y-3">
            {availableRooms.map((room) => (
              <li key={room.roomCode} className="border border-border rounded p-3 flex items-center justify-between bg-surface/50">
                <div>
                  <p className="font-bold text-text">Host: <span className="text-primary">{room.host}</span></p>
                  <p className="text-xs text-muted">
                    Gracze: {room.players}/{room.maxPlayers} • Pokój: <span className="font-mono tracking-widest">{room.roomCode}</span>
                  </p>
                </div>
                <button
                  className="btn btn-primary text-sm px-4"
                  onClick={() => handleDirectJoin(room.roomCode)}
                  disabled={loading}
                >
                  Dołącz
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
