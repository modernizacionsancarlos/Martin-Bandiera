import React, { useState, useEffect } from 'react';
import {
  X,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Building,
  Calendar,
  Trash2,
  CheckCheck,
  Bell,
  Sparkles,
  Save
} from 'lucide-react';
import { TechnicalAuditRecord } from '../types';

interface RemitoMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: TechnicalAuditRecord | null;
  onSave: (recordId: string, message: string, messageRead: boolean) => void;
}

export const RemitoMessageModal: React.FC<RemitoMessageModalProps> = ({
  isOpen,
  onClose,
  record,
  onSave
}) => {
  const [text, setText] = useState<string>('');
  const [isRead, setIsRead] = useState<boolean>(false);

  useEffect(() => {
    if (record) {
      setText(record.message || '');
      setIsRead(Boolean(record.messageRead));
    } else {
      setText('');
      setIsRead(false);
    }
  }, [record, isOpen]);

  if (!isOpen || !record) return null;

  const handleSaveOnly = () => {
    onSave(record.id, text.trim(), isRead);
    onClose();
  };

  const handleMarkAsReadAndSave = () => {
    onSave(record.id, text.trim(), true);
    setIsRead(true);
    onClose();
  };

  const handleToggleReadStatus = () => {
    const nextRead = !isRead;
    setIsRead(nextRead);
    onSave(record.id, text.trim(), nextRead);
  };

  const handleDeleteMessage = () => {
    onSave(record.id, '', true);
    setText('');
    onClose();
  };

  const hasMessage = Boolean(text.trim());

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700/60 rounded-2xl sm:rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 px-6 py-4 flex items-center justify-between text-white shrink-0 shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/20 backdrop-blur-xs">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-wide flex items-center gap-2">
                <span>MENSAJE DEL REMITO</span>
                <span className="font-mono bg-white/25 px-2 py-0.5 rounded text-xs">
                  {record.remitoId}
                </span>
              </h2>
              <p className="text-white/80 text-[11px] font-medium">
                Notificación persistente con alerta titilante en tabla
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto text-xs flex-1">
          
          {/* Metadata Card */}
          <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                <Building className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>{record.clientName}</span>
              </div>
              {record.remitoPapel && (
                <span className="bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 font-mono font-bold text-[10px] px-2 py-0.5 rounded border border-amber-300 dark:border-amber-700">
                  Papel: #{record.remitoPapel}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px]">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Fecha: {record.date}
              </span>
              <span>
                Estado: <strong>{record.status}</strong>
              </span>
            </div>
          </div>

          {/* Current Status Badge */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <span className="font-bold text-slate-700 dark:text-slate-300">
              Estado de la Notificación:
            </span>
            {hasMessage ? (
              !isRead ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-400 text-slate-950 shadow-sm animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                  🟡 Titilando (No leído)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                  🟢 Leído (Persistente)
                </span>
              )
            ) : (
              <span className="text-slate-400 text-[11px] italic">
                Sin mensaje guardado
              </span>
            )}
          </div>

          {/* Text Area */}
          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
              Contenido del Mensaje u Observación:
            </label>
            <textarea
              rows={4}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Escribe aquí observaciones, novedades de cobro, instrucciones de entrega o notas importantes..."
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium text-xs shadow-xs focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all placeholder:text-slate-400"
            />
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              ✨ Al guardar un mensaje, el icono al lado del semáforo quedará <strong>titilando activamente</strong> hasta que se marque como leído. Una vez marcado, deja de titilar pero el mensaje continúa persistiendo.
            </p>
          </div>

          {/* Quick toggle read / unread */}
          {hasMessage && (
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={handleToggleReadStatus}
                className="text-xs font-bold text-amber-700 dark:text-amber-300 hover:underline flex items-center gap-1 cursor-pointer"
              >
                {isRead ? (
                  <>
                    <Bell className="w-3.5 h-3.5" />
                    <span>Cambiar a No Leído (hacer que vuelva a titilar)</span>
                  </>
                ) : (
                  <>
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Marcar como Leído ahora</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800">
            {record.message ? (
              <button
                type="button"
                onClick={handleDeleteMessage}
                className="px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                title="Eliminar este mensaje"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar Mensaje</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              {hasMessage && !isRead && (
                <button
                  type="button"
                  onClick={handleMarkAsReadAndSave}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                  title="Marcar como leído para que deje de titilar"
                >
                  <CheckCheck className="w-4 h-4" />
                  <span>Marcar como Leído</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleSaveOnly}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:brightness-105 text-white font-black uppercase text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>Guardar Mensaje</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
