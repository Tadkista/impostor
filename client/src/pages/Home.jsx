import React from 'react';
import { Link } from 'react-router-dom';
import { Play, LogIn, Users, Trophy } from 'lucide-react';

export default function Home() {
  return (
    <div className="pt-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Impostor</h1>
        <p className="text-muted max-w-md">Znajdź Impostora wśród znajomych, albo sam ich oszukuj.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
        <Link to="/create-room" className="card p-6 flex flex-col items-center justify-center hover:bg-background/50 transition-colors gap-3 cursor-pointer border-primary/20">
          <Play size={24} className="text-primary" />
          <h2 className="text-lg font-medium">Stwórz pokój</h2>
        </Link>
        <Link to="/join-room" className="card p-6 flex flex-col items-center justify-center hover:bg-background/50 transition-colors gap-3 cursor-pointer">
          <LogIn size={24} className="text-secondary" />
          <h2 className="text-lg font-medium">Dołącz do pokoju</h2>
        </Link>
        <Link to="/friends" className="card p-4 flex items-center gap-3 hover:bg-background/50 transition-colors">
          <Users size={20} className="text-muted" />
          <span className="font-medium text-sm">Znajomi</span>
        </Link>
        <Link to="/leaderboard" className="card p-4 flex items-center gap-3 hover:bg-background/50 transition-colors">
          <Trophy size={20} className="text-muted" />
          <span className="font-medium text-sm">Ranking</span>
        </Link>
      </div>
    </div>
  );
}
