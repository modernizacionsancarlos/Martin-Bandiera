import React, { createContext, useContext, useState, useEffect } from 'react';
import { ColorTheme } from '../types';

interface ThemeContextType {
  darkMode: boolean;
  toggleDarkMode: () => void;
  colorTheme: ColorTheme;
  setColorTheme: (theme: ColorTheme) => void;
  themeClasses: {
    primaryBg: string;
    primaryText: string;
    primaryBorder: string;
    badgeBg: string;
    badgeText: string;
    accentGradient: string;
    buttonClass: string;
    glowClass: string;
  };
}

const THEME_STORAGE_KEY = 'job_martin_bandiera_color_theme';
const DARK_MODE_STORAGE_KEY = 'job_martin_bandiera_dark_mode';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(DARK_MODE_STORAGE_KEY);
      if (saved !== null) {
        return saved === 'true';
      }
    } catch {
      // ignore
    }
    return document.documentElement.classList.contains('dark');
  });

  const [colorTheme, setColorTheme] = useState<ColorTheme>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved) {
        return saved as ColorTheme;
      }
    } catch {
      // ignore
    }
    return 'cyan'; // Matching the vibrant cyan/sky "GESTIÓN EMPRESARIAL" in the uploaded screenshot!
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    try {
      localStorage.setItem(DARK_MODE_STORAGE_KEY, darkMode.toString());
    } catch {
      // ignore
    }
  }, [darkMode]);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, colorTheme);
    } catch {
      // ignore
    }
  }, [colorTheme]);

  const toggleDarkMode = () => setDarkMode(prev => !prev);

  // Theme color maps
  const getThemeClasses = () => {
    switch (colorTheme) {
      case 'blue':
        return {
          primaryBg: 'bg-blue-600',
          primaryText: 'text-blue-600 dark:text-blue-400',
          primaryBorder: 'border-blue-500',
          badgeBg: 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800',
          badgeText: 'text-blue-700 dark:text-blue-300',
          accentGradient: 'from-blue-600 to-indigo-600',
          buttonClass: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20',
          glowClass: 'shadow-[0_10px_30px_-10px_rgba(37,99,235,0.25)]'
        };
      case 'emerald':
        return {
          primaryBg: 'bg-emerald-600',
          primaryText: 'text-emerald-600 dark:text-emerald-400',
          primaryBorder: 'border-emerald-500',
          badgeBg: 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800',
          badgeText: 'text-emerald-700 dark:text-emerald-300',
          accentGradient: 'from-emerald-600 to-teal-600',
          buttonClass: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20',
          glowClass: 'shadow-[0_10px_30px_-10px_rgba(16,185,129,0.25)]'
        };
      case 'amber':
        return {
          primaryBg: 'bg-amber-500',
          primaryText: 'text-amber-600 dark:text-amber-400',
          primaryBorder: 'border-amber-500',
          badgeBg: 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800',
          badgeText: 'text-amber-700 dark:text-amber-300',
          accentGradient: 'from-amber-500 to-orange-600',
          buttonClass: 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20',
          glowClass: 'shadow-[0_10px_30px_-10px_rgba(245,158,11,0.25)]'
        };
      case 'slate':
        return {
          primaryBg: 'bg-slate-800 dark:bg-slate-700',
          primaryText: 'text-slate-800 dark:text-slate-200',
          primaryBorder: 'border-slate-500',
          badgeBg: 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700',
          badgeText: 'text-slate-800 dark:text-slate-200',
          accentGradient: 'from-slate-700 to-slate-900',
          buttonClass: 'bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-700 dark:hover:bg-slate-600 shadow-slate-500/20',
          glowClass: 'shadow-[0_10px_30px_-10px_rgba(71,85,105,0.25)]'
        };
      case 'cyan':
      default:
        return {
          primaryBg: 'bg-cyan-500',
          primaryText: 'text-cyan-600 dark:text-cyan-400',
          primaryBorder: 'border-cyan-400',
          badgeBg: 'bg-cyan-50 dark:bg-cyan-950/60 border-cyan-200 dark:border-cyan-800',
          badgeText: 'text-cyan-700 dark:text-cyan-300',
          accentGradient: 'from-cyan-500 to-blue-600',
          buttonClass: 'bg-cyan-500 hover:bg-cyan-600 text-white shadow-cyan-500/25',
          glowClass: 'shadow-[0_10px_30px_-10px_rgba(6,182,212,0.3)]'
        };
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        darkMode,
        toggleDarkMode,
        colorTheme,
        setColorTheme,
        themeClasses: getThemeClasses()
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
