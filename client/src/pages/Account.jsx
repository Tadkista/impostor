import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function Account() {
  const { user } = useAuth();
  if (!user) return null;
  const totalScore = (user.totalGamePoints || 0) + (user.globalPoints || 0);

  return (
    <div className="max-w-md mx-auto mt-8 card p-6">
      <h1 className="text-2xl font-bold mb-6 text-primary">Konto</h1>
      <div className="space-y-4">
        <div>
          <label className="text-sm text-muted">Nazwa użytkownika</label>
          <p className="font-medium">{user.name}</p>
        </div>
        <div>
          <label className="text-sm text-muted">Pseudonim w grze</label>
          <p className="font-medium">{user.nick}</p>
        </div>
        <div>
          <label className="text-sm text-muted">Kod znajomego</label>
          <p className="font-mono bg-surface border border-border p-2 rounded text-lg text-center tracking-widest">{user.friendCode}</p>
        </div>
        <div className="pt-4 border-t border-border">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <label className="text-xs text-muted block mb-1">Punkty za grę</label>
              <p className="font-mono font-medium text-lg">{user.totalGamePoints || 0}</p>
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Punkty za głosowanie</label>
              <p className="font-mono font-medium text-lg">{user.globalPoints || 0}</p>
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Łączny wynik</label>
              <p className="font-mono font-bold text-lg text-primary">{totalScore}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
