import React from 'react';
import { useTheme } from '../context/ThemeContext';

export default function Settings() {
  const { mode, setMode, activeTheme, setActiveTheme, themesList } = useTheme();

  return (
    <div className="max-w-xl mx-auto mt-8">
      <h1 className="text-2xl font-bold mb-6 text-primary">Ustawienia</h1>

      <div className="card p-6 mb-6">
        <h2 className="text-lg font-medium mb-4">Motyw</h2>
        <div className="flex gap-4">
          <button className={`btn flex-1 ${mode === 'light' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMode('light')}>Jasny</button>
          <button className={`btn flex-1 ${mode === 'dark' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMode('dark')}>Ciemny</button>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-medium mb-4">Paleta kolorów</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {themesList.map(theme => (
            <button
              key={theme}
              className={`p-3 rounded-md border text-left transition-colors ${activeTheme === theme ? 'border-primary bg-primary/10' : 'border-border hover:bg-surface/80'}`}
              onClick={() => setActiveTheme(theme)}
            >
              {theme}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
