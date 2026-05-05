import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, User, Settings as SettingsIcon, Home, Users, Trophy, ShieldAlert } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  if (!user) return null;

  return (
    <nav className="bg-surface border-b border-border sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold text-primary flex items-center gap-2">
          Impostor
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/"           className="text-muted hover:text-text" title="Strona główna"><Home size={20} /></Link>
          <Link to="/friends"    className="text-muted hover:text-text" title="Znajomi"><Users size={20} /></Link>
          <Link to="/leaderboard"className="text-muted hover:text-text" title="Ranking"><Trophy size={20} /></Link>
          <Link to="/account"    className="text-muted hover:text-text" title="Konto"><User size={20} /></Link>
          <Link to="/settings"   className="text-muted hover:text-text" title="Ustawienia"><SettingsIcon size={20} /></Link>
          {user.role === 'admin' && (
            <Link to="/admin" className="text-muted hover:text-text" title="Panel admina"><ShieldAlert size={20} /></Link>
          )}
          <button onClick={handleLogout} className="text-muted hover:text-accent" title="Wyloguj">
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </nav>
  );
}
