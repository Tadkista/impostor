import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(name, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Logowanie nie powiodło się');
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12 card p-6">
      <h2 className="text-2xl font-bold mb-6 text-center text-primary">Logowanie</h2>
      {error && error.trim() !== '' && <div className="bg-accent bg-opacity-20 text-accent p-3 rounded mb-4 text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Nazwa użytkownika</label>
          <input type="text" className="input" value={name} onChange={e => setName(e.target.value)} autoComplete="username" required />
        </div>
        <div>
          <label className="label">Hasło</label>
          <input type="password" className="input" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
        </div>
        <button type="submit" className="btn btn-primary w-full">Zaloguj się</button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        Nie masz konta? <Link to="/register" className="text-primary hover:underline">Zarejestruj się</Link>
      </p>
    </div>
  );
}
