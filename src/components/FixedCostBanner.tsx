import React, { useState } from 'react';
import { Fuel, Clock, ShieldCheck, Car, Gauge, Edit3, Check, X } from 'lucide-react';
import { useData } from '../context/DataContext';

export const FixedCostBanner: React.FC = () => {
  const { technicalParameters, updateTechnicalParameters } = useData();
  const [editingParam, setEditingParam] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState<string>('');

  const handleStartEdit = (key: string, val: number) => {
    setEditingParam(key);
    setTempValue(val.toString());
  };

  const handleSave = (key: string) => {
    const num = parseFloat(tempValue);
    if (!isNaN(num) && num >= 0) {
      updateTechnicalParameters({ [key]: num });
    }
    setEditingParam(null);
  };

  const cards = [
    {
      key: 'dieselPrice',
      title: 'DIESEL ($/L)',
      value: technicalParameters.dieselPrice,
      format: (v: number) => `$${(v || 0).toLocaleString('es-AR')}`,
      icon: Fuel,
      color: 'from-amber-500/10 to-orange-500/10 text-amber-500 border-amber-500/30 dark:border-amber-500/20'
    },
    {
      key: 'horaBase',
      title: 'HORA BASE',
      value: technicalParameters.horaBase,
      format: (v: number) => `$${(v || 0).toLocaleString('es-AR')}`,
      icon: Clock,
      color: 'from-blue-500/10 to-cyan-500/10 text-cyan-500 border-cyan-500/30 dark:border-cyan-500/20'
    },
    {
      key: 'seguroViaje',
      title: 'SEGURO/VIAJE',
      value: technicalParameters.seguroViaje,
      format: (v: number) => `$${(v || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: ShieldCheck,
      color: 'from-emerald-500/10 to-teal-500/10 text-emerald-500 border-emerald-500/30 dark:border-emerald-500/20'
    },
    {
      key: 'amortizacionViaje',
      title: 'AMORTIZACIÓN',
      value: technicalParameters.amortizacionViaje,
      format: (v: number) => `$${(v || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: Car,
      color: 'from-purple-500/10 to-indigo-500/10 text-purple-500 border-purple-500/30 dark:border-purple-500/20'
    },
    {
      key: 'consumoLKm',
      title: 'CONSUMO L/KM',
      value: technicalParameters.consumoLKm,
      format: (v: number) => `${(v || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })} L/km`,
      icon: Gauge,
      color: 'from-rose-500/10 to-pink-500/10 text-rose-500 border-rose-500/30 dark:border-rose-500/20'
    }
  ];

  return (
    <div className="w-full bg-slate-900/90 dark:bg-slate-950/80 rounded-2xl p-3 sm:p-4 border border-slate-800 shadow-lg backdrop-blur-md">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
            Parámetros de Costos Fijos & Logística (Editables)
          </h4>
        </div>
        <span className="text-[11px] font-medium text-slate-400 hidden sm:inline">
          Haz clic en cualquier métrica para editarla y recalcular en tiempo real
        </span>
      </div>

      {/* Responsive Grid: 2 cols on mobile, 3 cols on tablet, 5 cols on desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {cards.map(card => {
          const isEditing = editingParam === card.key;
          const Icon = card.icon;

          return (
            <div
              key={card.key}
              onClick={() => !isEditing && handleStartEdit(card.key, card.value)}
              className={`relative group bg-slate-800/80 dark:bg-slate-900/90 rounded-xl p-3 border transition-all cursor-pointer hover:border-slate-600 hover:shadow-md ${card.color}`}
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 truncate">
                  {card.title}
                </span>
                <Icon className="w-3.5 h-3.5 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity" />
              </div>

              {isEditing ? (
                <div
                  className="flex items-center gap-1 mt-1"
                  onClick={e => e.stopPropagation()}
                >
                  <input
                    type="number"
                    step="any"
                    value={tempValue}
                    onChange={e => setTempValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSave(card.key);
                      if (e.key === 'Escape') setEditingParam(null);
                    }}
                    autoFocus
                    className="w-full px-2 py-1 text-xs font-black rounded-lg bg-slate-950 border border-amber-500 text-white focus:outline-none"
                  />
                  <button
                    onClick={() => handleSave(card.key)}
                    className="p-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                    title="Guardar"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setEditingParam(null)}
                    className="p-1 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-300 cursor-pointer"
                    title="Cancelar"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="flex items-baseline justify-between">
                  <span className="text-base sm:text-lg font-black text-white tracking-tight">
                    {card.format(card.value)}
                  </span>
                  <Edit3 className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
