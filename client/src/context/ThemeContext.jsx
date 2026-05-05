import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

const THEMES = {
  light: {
    'Pearl Minimal': { primary: '#0066cc', secondary: '#6610f2', accent: '#ff6b35', background: '#f8f9fa', surface: '#ffffff', text: '#212529', muted: '#6c757d', border: '#dee2e6' },
    'Cloud Canvas': { primary: '#2563eb', secondary: '#7c3aed', accent: '#dc2626', background: '#fafafa', surface: '#ffffff', text: '#0f172a', muted: '#64748b', border: '#e2e8f0' },
    'Ivory Studio': { primary: '#0891b2', secondary: '#06b6d4', accent: '#f59e0b', background: '#f5f5f4', surface: '#fafaf9', text: '#1c1917', muted: '#78716c', border: '#d6d3d1' },
    'Arctic Breeze': { primary: '#0284c7', secondary: '#0ea5e9', accent: '#f43f5e', background: '#f0f9ff', surface: '#f8fafc', text: '#0c4a6e', muted: '#475569', border: '#cbd5e1' },
    'Frost Bright': { primary: '#0f766e', secondary: '#14b8a6', accent: '#e11d48', background: '#f1f5f9', surface: '#f8fafc', text: '#0f172a', muted: '#64748b', border: '#cbd5e1' }
  },
  dark: {
    'Midnight Canvas': { primary: '#6c8eff', secondary: '#a78bfa', accent: '#f472b6', background: '#0a0e27', surface: '#151b3d', text: '#e2e8f0', muted: '#94a3b8', border: '#334155' },
    'Obsidian Depth': { primary: '#00d4aa', secondary: '#00a3cc', accent: '#ff6b9d', background: '#0f0f0f', surface: '#1a1a1a', text: '#f5f5f5', muted: '#a3a3a3', border: '#333333' },
    'Slate Noir': { primary: '#38bdf8', secondary: '#818cf8', accent: '#fb923c', background: '#0f172a', surface: '#1e293b', text: '#f1f5f9', muted: '#94a3b8', border: '#334155' },
    'Deep Ocean': { primary: '#4fc3f7', secondary: '#29b6f6', accent: '#ffa726', background: '#001e3c', surface: '#0a2744', text: '#eceff1', muted: '#b0bec5', border: '#263238' },
    'Void Space': { primary: '#58a6ff', secondary: '#79c0ff', accent: '#f78166', background: '#0d1117', surface: '#161b22', text: '#c9d1d9', muted: '#8b949e', border: '#30363d' }
  }
};

export const ThemeProvider = ({ children }) => {
  const [mode, setMode] = useState(localStorage.getItem('themeMode') || 'dark');
  const [activeTheme, setActiveTheme] = useState(localStorage.getItem('activeTheme') || 'Obsidian Depth');

  useEffect(() => {
    const root = window.document.documentElement;
    if (mode === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }

    const themeColors = THEMES[mode][activeTheme];
    if (themeColors) {
      Object.entries(themeColors).forEach(([key, value]) => {
        root.style.setProperty(`--${key}`, value);
      });
    }
    
    localStorage.setItem('themeMode', mode);
    localStorage.setItem('activeTheme', activeTheme);
  }, [mode, activeTheme]);

  return (
    <ThemeContext.Provider value={{ mode, setMode, activeTheme, setActiveTheme, themesList: Object.keys(THEMES[mode]) }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
