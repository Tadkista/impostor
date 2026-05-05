import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/leaderboard')
      .then(res => setLeaderboard(res.data.leaderboard))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-2xl mx-auto mt-8">
      <h1 className="text-2xl font-bold mb-6 text-primary">Ranking</h1>
      <div className="card">
        {loading ? (
          <p className="p-6 text-center text-muted">Ładowanie...</p>
        ) : leaderboard.length === 0 ? (
          <p className="p-6 text-center text-muted">Brak danych. Dodaj znajomych i zagraj kilka gier!</p>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-border flex items-center text-xs text-muted uppercase tracking-wide">
              <span className="w-8"></span>
              <span className="flex-1">Gracz</span>
              <span className="w-24 text-right">Gra</span>
              <span className="w-24 text-right">Głos</span>
              <span className="w-24 text-right">Łącznie</span>
            </div>
            <ul className="divide-y divide-border">
              {leaderboard.map(u => (
                <li key={u.id} className={`px-4 py-3 flex items-center ${u.isCurrentUser ? 'bg-primary/5' : ''}`}>
                  <span className={`font-bold text-lg w-8 text-center shrink-0 ${u.rank <= 3 ? 'text-primary' : 'text-muted'}`}>
                    {u.rank <= 3 ? ['🥇','🥈','🥉'][u.rank - 1] : u.rank}
                  </span>
                  <span className={`flex-1 font-medium truncate ${u.isCurrentUser ? 'text-primary' : 'text-text'}`}>
                    {u.nick}
                    {u.isCurrentUser && <span className="text-xs text-muted ml-1">(Ty)</span>}
                  </span>
                  <span className="w-24 text-right font-mono text-sm text-muted">{u.totalGamePoints >= 0 ? '+' : ''}{u.totalGamePoints}</span>
                  <span className={`w-24 text-right font-mono text-sm ${u.globalPoints < 0 ? 'text-accent' : 'text-muted'}`}>{u.globalPoints >= 0 ? '+' : ''}{u.globalPoints}</span>
                  <span className={`w-24 text-right font-mono font-bold ${u.totalScore < 0 ? 'text-accent' : 'text-primary'}`}>{u.totalScore}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
