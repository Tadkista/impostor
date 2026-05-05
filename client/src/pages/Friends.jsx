import React, { useState } from 'react';
import axios from 'axios';

export default function Friends() {
  const [friends, setFriends] = useState([]);
  const [friendCode, setFriendCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const fetchFriends = async () => {
    try {
      const res = await axios.get('/api/friends');
      setFriends(res.data.friends);
      setFetched(true);
    } catch (err) {
      console.error('Nie udało się załadować znajomych:', err);
    }
  };

  React.useEffect(() => { fetchFriends(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!friendCode || friendCode.length !== 6) return setError('Kod znajomego musi mieć dokładnie 6 znaków');
    setLoading(true);
    try {
      await axios.post('/api/friends/add', { friendCode: friendCode.toUpperCase() });
      setSuccess('Znajomy dodany pomyślnie!');
      setFriendCode('');
      fetchFriends();
    } catch (err) {
      setError(err.response?.data?.message || 'Nie udało się dodać znajomego');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-8">
      <h1 className="text-2xl font-bold mb-6 text-primary">Znajomi</h1>
      <div className="card p-4 mb-6">
        <form onSubmit={handleAdd} className="flex gap-2">
          <input type="text" placeholder="Kod znajomego (6 znaków)" className="input flex-1 uppercase font-mono tracking-widest" value={friendCode} onChange={e => setFriendCode(e.target.value.toUpperCase())} maxLength={6} required />
          <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? '...' : 'Dodaj'}</button>
        </form>
        {error && <p className="text-accent text-sm mt-2">{error}</p>}
        {success && <p className="text-primary text-sm mt-2">{success}</p>}
      </div>
      <div className="card">
        {!fetched ? (
          <p className="p-6 text-center text-muted">Ładowanie...</p>
        ) : friends.length === 0 ? (
          <p className="p-6 text-center text-muted">Nie masz jeszcze żadnych znajomych.</p>
        ) : (
          <ul className="divide-y divide-border">
            {friends.map(friend => (
              <li key={friend._id} className="p-4 flex justify-between items-center">
                <div>
                  <p className="font-medium text-text">{friend.nick}</p>
                  <p className="text-sm text-muted">@{friend.name} · Kod: <span className="font-mono">{friend.friendCode}</span></p>
                </div>
                <div className="text-sm font-medium text-primary">{friend.globalPoints} pkt</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
