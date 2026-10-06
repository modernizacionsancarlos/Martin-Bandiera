import React, { useState, useEffect, useRef } from 'react';
import { Check } from 'lucide-react';

interface EditableNumberCellProps {
  value: number;
  onSave: (val: number) => void;
  prefix?: string;
  suffix?: string;
  isColoredRow?: boolean;
  min?: number;
  step?: number | string;
  className?: string;
  title?: string;
}

export const EditableNumberCell: React.FC<EditableNumberCellProps> = ({
  value,
  onSave,
  prefix = '',
  suffix = '',
  isColoredRow = false,
  min = 0,
  step = 'any',
  className = '',
  title = 'Clic para editar valor'
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localVal, setLocalVal] = useState<string>(String(value ?? 0));
  const [savedFlash, setSavedFlash] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) {
      setLocalVal(String(value ?? 0));
    }
  }, [value, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleCommit = () => {
    setIsEditing(false);
    let raw = localVal.trim();
    if (raw.includes('.') && raw.includes(',')) {
      if (raw.lastIndexOf(',') > raw.lastIndexOf('.')) {
        // Argentine format: 1.250,50 -> 1250.50
        raw = raw.replace(/\./g, '').replace(',', '.');
      } else {
        // US format: 1,250.50 -> 1250.50
        raw = raw.replace(/,/g, '');
      }
    } else {
      raw = raw.replace(',', '.');
    }
    const num = parseFloat(raw);
    const cleanNum = isNaN(num) ? 0 : Math.max(min, num);
    const rounded = Math.round((cleanNum + Number.EPSILON) * 100) / 100;
    if (rounded !== value) {
      onSave(rounded);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1200);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCommit();
    } else if (e.key === 'Escape') {
      setLocalVal(String(value ?? 0));
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className="relative inline-flex items-center min-w-[70px] max-w-[120px]">
        {prefix && (
          <span className={`text-[10px] font-mono mr-0.5 select-none ${isColoredRow ? 'text-white/80' : 'text-slate-400'}`}>
            {prefix}
          </span>
        )}
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={localVal}
          onChange={e => setLocalVal(e.target.value)}
          onBlur={handleCommit}
          onKeyDown={handleKeyDown}
          className={`w-full px-1.5 py-0.5 rounded font-mono font-bold text-xs text-right focus:outline-none transition-all ${
            isColoredRow
              ? 'bg-white text-slate-900 shadow-md ring-2 ring-white/80'
              : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-cyan-500 ring-2 ring-cyan-500/20'
          }`}
        />
        {suffix && (
          <span className={`text-[10px] font-mono ml-0.5 select-none ${isColoredRow ? 'text-white/80' : 'text-slate-400'}`}>
            {suffix}
          </span>
        )}
      </div>
    );
  }

  const hasDecimals = !Number.isInteger(Number(value || 0));
  const formattedDisplay = `${prefix}${Number(value || 0).toLocaleString('es-AR', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2
  })}${suffix ? ` ${suffix}` : ''}`;

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      title={title}
      className={`group relative inline-flex items-center justify-end gap-1 px-1.5 py-0.5 rounded transition-all cursor-pointer select-none text-right font-mono ${
        savedFlash
          ? 'bg-emerald-400/30 text-emerald-300 ring-1 ring-emerald-400'
          : isColoredRow
          ? 'hover:bg-white/15 hover:ring-1 hover:ring-white/40'
          : 'hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:ring-1 hover:ring-slate-300 dark:hover:ring-slate-600'
      } ${className}`}
    >
      <span>{formattedDisplay}</span>
      {savedFlash ? (
        <Check className="w-2.5 h-2.5 text-emerald-300 shrink-0 animate-in fade-in" />
      ) : (
        <span className={`opacity-0 group-hover:opacity-40 text-[9px] transition-opacity ml-0.5 ${isColoredRow ? 'text-white' : 'text-slate-400'}`}>
          ✎
        </span>
      )}
    </button>
  );
};

interface EditableTextCellProps {
  value: string;
  onSave: (val: string) => void;
  isColoredRow?: boolean;
  placeholder?: string;
  className?: string;
  title?: string;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
  uppercase?: boolean;
}

export const EditableTextCell: React.FC<EditableTextCellProps> = ({
  value,
  onSave,
  isColoredRow = false,
  placeholder = '-',
  className = '',
  title = 'Clic para editar',
  align = 'left',
  bold = false,
  uppercase = false
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localVal, setLocalVal] = useState<string>(value ?? '');
  const [savedFlash, setSavedFlash] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) {
      setLocalVal(value ?? '');
    }
  }, [value, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleCommit = () => {
    setIsEditing(false);
    const trimmed = uppercase ? localVal.trim().toUpperCase() : localVal.trim();
    if (trimmed !== (value ?? '')) {
      onSave(trimmed);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1200);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCommit();
    } else if (e.key === 'Escape') {
      setLocalVal(value ?? '');
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={localVal}
        placeholder={placeholder}
        onChange={e => setLocalVal(e.target.value)}
        onBlur={handleCommit}
        onKeyDown={handleKeyDown}
        className={`w-full min-w-[90px] px-2 py-0.5 rounded text-xs focus:outline-none transition-all ${
          bold ? 'font-bold' : ''
        } ${align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'} ${
          isColoredRow
            ? 'bg-white text-slate-900 shadow-md ring-2 ring-white/80'
            : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-cyan-500 ring-2 ring-cyan-500/20'
        }`}
      />
    );
  }

  const display = (value && value.trim()) ? value : placeholder;

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      title={title}
      className={`group relative inline-flex items-center gap-1 px-1.5 py-0.5 rounded transition-all cursor-pointer select-none text-xs ${
        bold ? 'font-bold' : ''
      } ${
        savedFlash
          ? 'bg-emerald-400/30 text-emerald-300 ring-1 ring-emerald-400'
          : isColoredRow
          ? 'hover:bg-white/15 hover:ring-1 hover:ring-white/40'
          : 'hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:ring-1 hover:ring-slate-300 dark:hover:ring-slate-600'
      } ${className}`}
    >
      <span className="truncate max-w-[200px]">{display}</span>
      {savedFlash ? (
        <Check className="w-2.5 h-2.5 text-emerald-300 shrink-0" />
      ) : (
        <span className={`opacity-0 group-hover:opacity-40 text-[9px] transition-opacity ${isColoredRow ? 'text-white' : 'text-slate-400'}`}>
          ✎
        </span>
      )}
    </button>
  );
};

interface EditableDateCellProps {
  value: string;
  onSave: (val: string) => void;
  isColoredRow?: boolean;
}

export const EditableDateCell: React.FC<EditableDateCellProps> = ({
  value,
  onSave,
  isColoredRow = false
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localVal, setLocalVal] = useState<string>(value || '');
  const [savedFlash, setSavedFlash] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) {
      setLocalVal(value || '');
    }
  }, [value, isEditing]);

  const handleCommit = (newDateStr: string) => {
    setIsEditing(false);
    if (newDateStr && newDateStr !== value) {
      onSave(newDateStr);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1200);
    }
  };

  const formatDisplay = (dStr: string) => {
    if (!dStr) return '-';
    const parts = dStr.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}/${parts[1]}/${parts[0].slice(-2)}`;
    }
    return dStr;
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="date"
        autoFocus
        value={localVal}
        onChange={e => {
          setLocalVal(e.target.value);
          handleCommit(e.target.value);
        }}
        onBlur={() => setIsEditing(false)}
        className={`px-1.5 py-0.5 rounded text-xs font-mono font-bold focus:outline-none ${
          isColoredRow
            ? 'bg-white text-slate-900 shadow-md'
            : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-cyan-500'
        }`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      title="Clic para cambiar fecha"
      className={`group relative inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono font-bold text-xs transition-all cursor-pointer select-none ${
        savedFlash
          ? 'bg-emerald-400/30 text-emerald-300 ring-1 ring-emerald-400'
          : isColoredRow
          ? 'hover:bg-white/15 hover:ring-1 hover:ring-white/40 text-white'
          : 'hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:ring-1 hover:ring-slate-300 dark:hover:ring-slate-600 text-slate-700 dark:text-slate-300'
      }`}
    >
      <span>{formatDisplay(value)}</span>
      {savedFlash ? (
        <Check className="w-2.5 h-2.5 text-emerald-300 shrink-0" />
      ) : (
        <span className={`opacity-0 group-hover:opacity-40 text-[9px] ${isColoredRow ? 'text-white' : 'text-slate-400'}`}>
          ✎
        </span>
      )}
    </button>
  );
};
