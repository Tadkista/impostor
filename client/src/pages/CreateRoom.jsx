import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function CreateRoom() {
  const { user } = useAuth();
  const [maxPlayers, setMaxPlayers] = useState(5);
  const [impostorsCount, setImpostorsCount] = useState(1);
  const [timePerPlayer, setTimePerPlayer] = useState(60);
  const [multiDeviceMode, setMultiDeviceMode] = useState(false);

  const [nickConfirmed, setNickConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleCreate = async (e) => {
    e?.preventDefault();
    const maxImpostors = Math.floor(Number(maxPlayers) / 2);
    if (Number(impostorsCount) > maxImpostors)
      return setError(`Liczba impostorów nie może przekraczać 50% graczy (maks. ${maxImpostors})`);
    setLoading(true);
    setError('');
    try {
      const res = await axios.post('/api/rooms/create', {
        maxPlayers: Number(maxPlayers),
        impostorsCount: Number(impostorsCount),
        timePerPlayer: Number(timePerPlayer),
        multiDeviceMode
      });
      navigate(`/game/${res.data.room.code}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Nie udało się stworzyć pokoju');
    } finally {
      setLoading(false);
    }
  };

  if (!nickConfirmed) return (
    <div className="max-w-md mx-auto mt-12 card p-6">
      <h2 className="text-xl font-bold mb-4">Potwierdź pseudonim</h2>
      <p className="text-muted mb-2">Będziesz widoczny w grze jako:</p>
      <div className="bg-surface border border-border p-3 rounded mb-6 text-center text-xl font-bold">{user.nick}</div>
      <button className="btn btn-primary w-full" onClick={() => setNickConfirmed(true)}>Wygląda dobrze, kontynuuj</button>
    </div>
  );

  return (
    <div className="max-w-md mx-auto mt-8 card p-6">
      <h1 className="text-2xl font-bold mb-6 text-primary">Stwórz pokój</h1>
      {error && <div className="bg-accent/20 text-accent p-3 rounded mb-4 text-sm">{error}</div>}
      <form onSubmit={handleCreate} className="space-y-4">
        <div className="flex items-center gap-2 mt-4 mb-2">
          <input 
            type="checkbox" 
            id="multiDeviceMode" 
            checked={multiDeviceMode} 
            onChange={e => setMultiDeviceMode(e.target.checked)} 
            className="w-5 h-5 accent-primary" 
          />
          <label htmlFor="multiDeviceMode" className="label mb-0 cursor-pointer">
            Gra na jednym urządzeniu (wiele osób)
          </label>
        </div>
        <div>
          <label className="label">Maks. graczy <span className="text-muted font-normal">(min 3)</span></label>
          <input type="number" min="3" max="20" className="input" value={maxPlayers} onChange={e => setMaxPlayers(e.target.value)} required />
        </div>
        <div>
          <label className="label">Liczba impostorów <span className="text-muted font-normal">(maks. {Math.floor(maxPlayers / 2)})</span></label>
          <input type="number" min="1" max={Math.floor(maxPlayers / 2)} className="input" value={impostorsCount} onChange={e => setImpostorsCount(e.target.value)} required />
        </div>
        <div>
          <label className="label">Czas na gracza <span className="text-muted font-normal">(sekundy, min 10)</span></label>
          <input type="number" min="10" max="300" className="input" value={timePerPlayer} onChange={e => setTimePerPlayer(e.target.value)} required />
        </div>
        <button type="submit" className="btn btn-primary w-full" disabled={loading}>
          {loading ? 'Tworzenie...' : 'Stwórz pokój'}
        </button>
      </form>
    </div>
  );
}
