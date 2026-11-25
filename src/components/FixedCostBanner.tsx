import React, { useState } from 'react';
import { Fuel, Clock, ShieldCheck, Car, Gauge, Pencil, Check, X } from 'lucide-react';
import { useData } from '../context/DataContext';

// Cost parameters that price every remito. Read-only until "Editar parámetros", and each change asks for confirmation.
export const FixedCostBanner: React.FC = () => {
  const { technicalParameters, updateTechnicalParameters } = useData();
  const [editMode, setEditMode] = useState(false);
  const [editingParam, setEditingParam] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState<string>('');

  const cards = [
    {
      key: 'dieselPrice',
      title: 'Diésel ($/L)',
      value: technicalParameters.dieselPrice,
      format: (v: number) => `$${(v || 0).toLocaleString('es-AR')}`,
      icon: Fuel
    },
    {
      key: 'horaBase',
      title: 'Hora base',
      value: technicalParameters.horaBase,
      format: (v: number) => `$${(v || 0).toLocaleString('es-AR')}`,
      icon: Clock
    },
    {
      key: 'seguroViaje',
      title: 'Seguro por viaje',
      value: technicalParameters.seguroViaje,
      format: (v: number) => `$${(v || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: ShieldCheck
    },
    {
      key: 'amortizacionViaje',
      title: 'Amortización por viaje',
      value: technicalParameters.amortizacionViaje,
      format: (v: number) => `$${(v || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: Car
    },
    {
      key: 'consumoLKm',
      title: 'Consumo (L/km)',
      value: technicalParameters.consumoLKm,
      format: (v: number) => `${(v || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })} L/km`,
      icon: Gauge
    }
  ];

  const startEdit = (key: string, val: number) => {
    setEditingParam(key);
    setTempValue(String(val ?? ''));
  };

  const save = (card: (typeof cards)[number]) => {
    const num = parseFloat(tempValue.replace(',', '.'));
    if (isNaN(num) || num < 0) return;
    if (num !== card.value) {
      const ok = window.confirm(
        `¿Cambiar ${card.title} de ${card.format(card.value)} a ${card.format(num)}?\n\nSe usa para calcular los remitos nuevos y los que se editen. Los ya cargados no cambian.`
      );
      if (!ok) return;
      updateTechnicalParameters({ [card.key]: num });
    }
    setEditingParam(null);
  };

  return (
    <section className="w-full bg-slate-900 rounded-2xl p-3 sm:p-4 border border-slate-800" aria-labelledby="cost-params-title">
      <div className="flex items-center justify-between gap-3 mb-3 px-1">
        <h2 id="cost-params-title" className="text-sm font-bold text-slate-200">
          Parámetros de costos
        </h2>
        <button
          type="button"
          onClick={() => {
            setEditMode(m => !m);
            setEditingParam(null);
          }}
          aria-pressed={editMode}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
            editMode ? 'bg-white text-slate-900 hover:bg-slate-200' : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
          }`}
        >
          {editMode ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
          {editMode ? 'Listo' : 'Editar parámetros'}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {cards.map(card => {
          const isEditing = editingParam === card.key;
          const Icon = card.icon;
          const label = (
            <span className="flex items-center justify-between gap-1 mb-1">
              <span className="text-xs font-semibold text-slate-400 truncate">{card.title}</span>
              <Icon className="w-3.5 h-3.5 shrink-0 text-slate-500" aria-hidden="true" />
            </span>
          );

          if (isEditing) {
            return (
              <div key={card.key} className="rounded-xl p-3 bg-slate-800 border border-amber-500">
                {label}
                <div className="flex items-center gap-1 mt-1">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    aria-label={card.title}
                    value={tempValue}
                    onChange={e => setTempValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') save(card);
                      if (e.key === 'Escape') setEditingParam(null);
                    }}
                    autoFocus
                    className="w-full min-w-0 px-2 py-1 text-sm font-bold tabular-nums rounded-lg bg-slate-950 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button type="button" onClick={() => save(card)} className="p-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer" title="Guardar">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => setEditingParam(null)} className="p-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200 cursor-pointer" title="Cancelar">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          }

          const value = <span className="block text-base sm:text-lg font-bold text-white tabular-nums">{card.format(card.value)}</span>;

          return editMode ? (
            <button
              key={card.key}
              type="button"
              onClick={() => startEdit(card.key, card.value)}
              className="text-left rounded-xl p-3 bg-slate-800 border border-slate-600 hover:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer transition-colors"
              title={`Cambiar ${card.title}`}
            >
              {label}
              {value}
            </button>
          ) : (
            <div key={card.key} className="rounded-xl p-3 bg-slate-800/60 border border-slate-800">
              {label}
              {value}
            </div>
          );
        })}
      </div>
    </section>
  );
};
