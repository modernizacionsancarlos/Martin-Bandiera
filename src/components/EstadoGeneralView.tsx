import React, { useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, ChevronLeft, ChevronRight, Table2 } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  STAGES,
  Stage,
  agingAlerts,
  collectionRate,
  countInvalidDates,
  defaultMonth,
  listMonths,
  monthLabel,
  monthlySeries,
  pendingByClient,
  recordsOfMonth,
  shiftMonth,
  summarize
} from '../utils/dashboardMetrics';

/**
 * Panel de Estado: resumen gráfico de los remitos de la empresa por etapa
 * (Cargado, Facturado, Pasado, Cobrado y Archivado). Solo lectura: no modifica nada.
 *
 * Colores: son los de cada etapa en el menú (rojo, azul, ámbar, verde y gris), en versión validada
 * para claro y oscuro. Cada etapa tiene siempre el mismo color en todos los gráficos.
 */
const THEME = {
  light: {
    Cargado: '#e34948', Facturado: '#2a78d6', Pasado: '#eda100', Cobrado: '#1baf7a', Archivado: '#898781',
    surface: '#fcfcfb', ink: '#0b0b0b', ink2: '#52514e', muted: '#898781',
    grid: '#e1e0d9', axis: '#c3c2b7', border: 'rgba(11,11,11,0.10)', seq: '#2a78d6', seqTrack: '#cde2fb'
  },
  dark: {
    Cargado: '#e66767', Facturado: '#3987e5', Pasado: '#c98500', Cobrado: '#199e70', Archivado: '#898781',
    surface: '#1a1a19', ink: '#ffffff', ink2: '#c3c2b7', muted: '#898781',
    grid: '#2c2c2a', axis: '#383835', border: 'rgba(255,255,255,0.10)', seq: '#3987e5', seqTrack: '#104281'
  }
};

const STAGE_PLURAL: Record<Stage, string> = {
  Cargado: 'Cargados',
  Facturado: 'Facturados',
  Pasado: 'Pasados',
  Cobrado: 'Cobrados',
  Archivado: 'Archivados'
};
const STAGE_TAB: Partial<Record<Stage, string>> = {
  Cargado: 'auditoria',
  Facturado: 'facturado',
  Pasado: 'pasado',
  Cobrado: 'cobrado'
};

const money = (n: number) => `$ ${Math.round(n).toLocaleString('es-AR')}`;

interface TooltipState {
  x: number;
  y: number;
  title: string;
  rows: { label: string; value: string; color?: string }[];
}

interface EstadoGeneralViewProps {
  onNavigate?: (tab: string) => void;
}

export const EstadoGeneralView: React.FC<EstadoGeneralViewProps> = ({ onNavigate }) => {
  const { technicalAuditRecords } = useData();
  const { permissions, isSuperAdmin } = useAuth();
  const { darkMode } = useTheme();
  const c = darkMode ? THEME.dark : THEME.light;

  // Los importes se muestran solo a quienes ya ven finanzas, facturación o cobranzas.
  const canSeeAmounts =
    isSuperAdmin || permissions.viewFinancials || permissions.manageBilling || permissions.manageCollections;

  const [period, setPeriod] = useState<string | null>(null);
  const [monthlyView, setMonthlyView] = useState<'grafico' | 'tabla'>('grafico');
  const [amountsView, setAmountsView] = useState<'grafico' | 'tabla'>('grafico');
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const months = useMemo(() => listMonths(technicalAuditRecords), [technicalAuditRecords]);
  const initialMonth = useMemo(() => defaultMonth(technicalAuditRecords), [technicalAuditRecords]);
  const selected: string = period ?? initialMonth ?? 'all';
  const chartEnd = selected === 'all' ? months[months.length - 1] || null : selected;

  const periodRecords = useMemo(() => recordsOfMonth(technicalAuditRecords, selected), [technicalAuditRecords, selected]);
  const summary = useMemo(() => summarize(periodRecords), [periodRecords]);
  const total = STAGES.reduce((acc, s) => acc + summary[s].count, 0);
  const totalAmount = STAGES.reduce((acc, s) => acc + summary[s].amount, 0);
  const prevCount = useMemo(
    () => (selected === 'all' ? null : recordsOfMonth(technicalAuditRecords, shiftMonth(selected, -1)).length),
    [technicalAuditRecords, selected]
  );
  const series = useMemo(
    () => (chartEnd ? monthlySeries(technicalAuditRecords, chartEnd, 6) : []),
    [technicalAuditRecords, chartEnd]
  );
  const rate = collectionRate(summary);
  const pending = useMemo(() => pendingByClient(technicalAuditRecords, 6), [technicalAuditRecords]);
  const alerts = useMemo(() => agingAlerts(technicalAuditRecords), [technicalAuditRecords]);
  const invalidDates = countInvalidDates(technicalAuditRecords);

  const periodLabel = selected === 'all' ? 'todos los meses' : monthLabel(selected, true);
  const idx = months.indexOf(selected);
  const canPrev = selected !== 'all' && idx > 0;
  const canNext = selected !== 'all' && idx >= 0 && idx < months.length - 1;

  const showTip = (e: React.MouseEvent, title: string, rows: TooltipState['rows']) =>
    setTooltip({ x: e.clientX, y: e.clientY, title, rows });
  const hideTip = () => setTooltip(null);

  const cardStyle: React.CSSProperties = { background: c.surface, borderColor: c.border, color: c.ink };
  const cardClass = 'rounded-2xl border p-5 shadow-sm';
  const titleClass = 'text-sm font-black tracking-tight';
  const subStyle: React.CSSProperties = { color: c.ink2 };

  const ViewToggle = ({ value, onChange }: { value: 'grafico' | 'tabla'; onChange: (v: 'grafico' | 'tabla') => void }): React.ReactElement => (
    <div className="inline-flex rounded-lg border p-0.5 text-[11px] font-bold" style={{ borderColor: c.border }} role="group" aria-label="Cambiar entre gráfico y tabla">
      {(['grafico', 'tabla'] as const).map(v => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className="flex items-center gap-1 rounded-md px-2 py-1 cursor-pointer"
          style={value === v ? { background: c.grid, color: c.ink } : { color: c.ink2 }}
        >
          {v === 'grafico' ? <BarChart3 className="w-3 h-3" /> : <Table2 className="w-3 h-3" />}
          {v === 'grafico' ? 'Gráfico' : 'Tabla'}
        </button>
      ))}
    </div>
  );

  // ------------------------------------------------------------------ remitos por mes y etapa
  const MonthlyChart = () => {
    const W = 560, H = 230, L = 34, R = 8, T = 10, B = 30;
    const plotW = W - L - R, plotH = H - T - B;
    const maxTotal = Math.max(1, ...series.map(p => p.total));
    const step = maxTotal <= 4 ? 1 : Math.ceil(maxTotal / 4);
    const top = Math.ceil(maxTotal / step) * step;
    const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
    const slot = plotW / Math.max(series.length, 1);
    const barW = Math.min(44, slot * 0.6);
    const y = (v: number) => T + plotH - (v / top) * plotH;

    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img"
        aria-label={`Remitos por mes y etapa, ${series.length} meses. Pase el cursor por cada columna para ver el detalle o use la vista de tabla.`}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={t === 0 ? c.axis : c.grid} strokeWidth={t === 0 ? 1.5 : 1} />
            <text x={L - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill={c.muted} style={{ fontVariantNumeric: 'tabular-nums' }}>{t}</text>
          </g>
        ))}
        {series.map((p, i) => {
          const x = L + slot * i + (slot - barW) / 2;
          let acc = 0;
          const isSel = p.month === selected;
          return (
            <g
              key={p.month}
              className="cursor-pointer"
              onClick={() => setPeriod(p.month)}
              onMouseMove={e => showTip(e, monthLabel(p.month, true), [
                ...STAGES.filter(s => p.counts[s] > 0).map(s => ({ label: STAGE_PLURAL[s], value: String(p.counts[s]), color: c[s] })),
                { label: 'Total', value: String(p.total) }
              ])}
              onMouseLeave={hideTip}
            >
              <rect x={L + slot * i} y={T} width={slot} height={plotH + B} fill="transparent" />
              {STAGES.map(s => {
                const v = p.counts[s];
                if (!v) return null;
                const h = (v / top) * plotH;
                const yTop = y(acc + v);
                acc += v;
                return <rect key={s} x={x} y={yTop} width={barW} height={Math.max(h - 2, 1)} rx="2" fill={c[s]} />;
              })}
              {p.total > 0 && (
                <text x={x + barW / 2} y={y(p.total) - 5} textAnchor="middle" fontSize="10" fontWeight="700" fill={c.ink2}>{p.total}</text>
              )}
              <text x={x + barW / 2} y={H - 10} textAnchor="middle" fontSize="10" fontWeight={isSel ? 800 : 500} fill={isSel ? c.ink : c.muted}>
                {monthLabel(p.month)}
              </text>
              {isSel && <rect x={L + slot * i + 2} y={H - 22} width={slot - 4} height="2" rx="1" fill={c.ink} />}
            </g>
          );
        })}
      </svg>
    );
  };

  // ------------------------------------------------------------------ distribución del mes (100 %)
  const DistributionBar = () => {
    const W = 560, H = 44;
    let x = 0;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img"
        aria-label={`Distribución de ${total} remitos por etapa: ${STAGES.map(s => `${summary[s].count} ${STAGE_PLURAL[s].toLowerCase()}`).join(', ')}`}>
        {total === 0 && <rect x="0" y="8" width={W} height="28" rx="4" fill={c.grid} />}
        {STAGES.map(s => {
          const n = summary[s].count;
          if (!n || !total) return null;
          const w = (n / total) * W;
          const rect = (
            <g
              key={s}
              onMouseMove={e => showTip(e, STAGE_PLURAL[s], [
                { label: 'Remitos', value: `${n} (${Math.round((n / total) * 100)} %)`, color: c[s] },
                ...(canSeeAmounts ? [{ label: 'Importe', value: money(summary[s].amount) }] : [])
              ])}
              onMouseLeave={hideTip}
            >
              <rect x={x} y="8" width={Math.max(w - 2, 1)} height="28" rx="3" fill={c[s]} />
              {w > 54 && (
                <text x={x + (w - 2) / 2} y="26" textAnchor="middle" fontSize="12" fontWeight="800" fill={s === 'Pasado' ? '#0b0b0b' : '#ffffff'}>
                  {n}
                </text>
              )}
            </g>
          );
          x += w;
          return rect;
        })}
      </svg>
    );
  };

  // ------------------------------------------------------------------ barras horizontales (importes / clientes)
  const HBars = ({ rows, labelW = 96 }: { rows: { label: string; value: number; color: string; hint?: string }[]; labelW?: number }): React.ReactElement => {
    const rowH = 32, W = 560, valueW = 92;
    const max = Math.max(1, ...rows.map(r => r.value));
    const trackW = W - labelW - valueW - 8;
    return (
      <svg viewBox={`0 0 ${W} ${rows.length * rowH + 4}`} className="w-full h-auto" role="img"
        aria-label={rows.map(r => `${r.label}: ${money(r.value)}`).join('; ')}>
        {rows.map((r, i) => {
          const y = i * rowH + 4;
          const w = Math.max((r.value / max) * trackW, r.value > 0 ? 3 : 0);
          return (
            <g
              key={r.label}
              onMouseMove={e => showTip(e, r.label, [{ label: 'Importe', value: money(r.value), color: r.color }, ...(r.hint ? [{ label: 'Remitos', value: r.hint }] : [])])}
              onMouseLeave={hideTip}
            >
              <rect x="0" y={y - 2} width={W} height={rowH - 2} fill="transparent" />
              <text x="0" y={y + 15} fontSize="11" fontWeight="600" fill={c.ink2}>
                {r.label.length > 17 ? r.label.slice(0, 16) + '…' : r.label}
              </text>
              <rect x={labelW} y={y + 4} width={w} height="14" rx="3" fill={r.color} />
              <text x={labelW + w + 6} y={y + 15} fontSize="11" fontWeight="700" fill={c.ink} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {money(r.value)}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  const TableShell = ({ head, rows }: { head: string[]; rows: (string | number)[][] }): React.ReactElement => (
    <div className="overflow-x-auto">
      <table className="w-full text-xs" style={{ color: c.ink }}>
        <thead>
          <tr style={{ color: c.ink2 }}>
            {head.map((h, i) => (
              <th key={h} className={`py-1.5 font-bold ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-t" style={{ borderColor: c.grid }}>
              {r.map((cell, ci) => (
                <td key={ci} className={`py-1.5 ${ci === 0 ? 'text-left font-semibold' : 'text-right'}`} style={{ fontVariantNumeric: 'tabular-nums' }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (technicalAuditRecords.length === 0) {
    return (
      <div className={cardClass} style={cardStyle}>
        <h2 className={titleClass}>Panel de Estado</h2>
        <p className="mt-2 text-sm" style={subStyle}>Todavía no hay remitos cargados. Cuando los haya, acá se verá el resumen gráfico por etapa.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5" onMouseLeave={hideTip}>
      {/* Encabezado y selector de mes */}
      <div className={`${cardClass} flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3`} style={cardStyle}>
        <div>
          <h2 className="text-lg font-black tracking-tight">Panel de Estado</h2>
          <p className="text-xs mt-0.5" style={subStyle}>
            Resumen gráfico de los remitos por etapa: cargados, facturados, pasados, cobrados y archivados.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" disabled={!canPrev} onClick={() => setPeriod(shiftMonth(selected, -1))}
            className="p-1.5 rounded-lg border cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed" style={{ borderColor: c.border }} aria-label="Mes anterior">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <select
            value={selected}
            onChange={e => setPeriod(e.target.value)}
            className="px-3 py-1.5 rounded-lg border text-xs font-bold capitalize bg-transparent"
            style={{ borderColor: c.border, color: c.ink }}
            aria-label="Mes a mostrar"
          >
            <option value="all" style={{ color: '#0b0b0b' }}>Todos los meses</option>
            {[...months].reverse().map(m => (
              <option key={m} value={m} style={{ color: '#0b0b0b' }}>{monthLabel(m, true)}</option>
            ))}
          </select>
          <button type="button" disabled={!canNext} onClick={() => setPeriod(shiftMonth(selected, 1))}
            className="p-1.5 rounded-lg border cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed" style={{ borderColor: c.border }} aria-label="Mes siguiente">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Indicadores: remitos del mes y cada etapa */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <div className={`${cardClass} col-span-2 md:col-span-3 xl:col-span-1`} style={cardStyle}>
          <div className="text-[11px] font-bold uppercase tracking-wide" style={subStyle}>
            Remitos {selected === 'all' ? 'en total' : 'del mes'}
          </div>
          <div className="text-5xl font-black leading-none mt-2" style={{ fontVariantNumeric: 'tabular-nums' }}>{total}</div>
          <div className="text-xs mt-2 capitalize" style={subStyle}>{periodLabel}</div>
          {prevCount !== null && (
            <div className="text-[11px] mt-1 font-semibold" style={subStyle}>
              {total === prevCount ? 'Igual que el mes anterior' : `${total > prevCount ? '▲ +' : '▼ −'}${Math.abs(total - prevCount)} vs mes anterior (${prevCount})`}
            </div>
          )}
          {canSeeAmounts && <div className="text-xs mt-1 font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>{money(totalAmount)}</div>}
        </div>
        {STAGES.map(s => {
          const tab = STAGE_TAB[s];
          const clickable = Boolean(tab && onNavigate);
          return (
            <button
              key={s}
              type="button"
              disabled={!clickable}
              onClick={() => tab && onNavigate && onNavigate(tab)}
              title={clickable ? `Abrir ${STAGE_PLURAL[s].toLowerCase()}` : undefined}
              className={`${cardClass} text-left ${clickable ? 'cursor-pointer hover:brightness-105' : 'cursor-default'}`}
              style={cardStyle}
            >
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide" style={subStyle}>
                <span className="inline-block w-3 h-3 rounded-[3px]" style={{ background: c[s] }} aria-hidden="true" />
                {STAGE_PLURAL[s]}
              </div>
              <div className="text-3xl font-black leading-none mt-2" style={{ fontVariantNumeric: 'tabular-nums' }}>{summary[s].count}</div>
              <div className="text-[11px] mt-1.5 font-semibold" style={{ ...subStyle, fontVariantNumeric: 'tabular-nums' }}>
                {total > 0 ? `${Math.round((summary[s].count / total) * 100)} % del total` : '—'}
              </div>
              {canSeeAmounts && (
                <div className="text-xs mt-1 font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>{money(summary[s].amount)}</div>
              )}
            </button>
          );
        })}
      </div>

      {/* Distribución y efectividad de cobro */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className={`${cardClass} lg:col-span-2`} style={cardStyle}>
          <h3 className={titleClass}>Remitos por etapa</h3>
          <p className="text-xs mb-3 capitalize" style={subStyle}>{periodLabel}: cuántos remitos hay en cada etapa.</p>
          {DistributionBar()}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs" style={{ color: c.ink2 }}>
            {STAGES.map(s => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-[3px]" style={{ background: c[s] }} aria-hidden="true" />
                {STAGE_PLURAL[s]}: <strong style={{ color: c.ink }}>{summary[s].count}</strong>
              </span>
            ))}
          </div>
        </div>

        <div className={cardClass} style={cardStyle}>
          <h3 className={titleClass}>Efectividad de cobro</h3>
          <p className="text-xs mb-3 capitalize" style={subStyle}>{periodLabel}: cobrado sobre lo facturado.</p>
          {rate === null || !canSeeAmounts ? (
            <p className="text-xs" style={subStyle}>
              {canSeeAmounts ? 'Todavía no hay remitos facturados en este período.' : 'Los importes se muestran solo a quienes ven finanzas o facturación.'}
            </p>
          ) : (
            <>
              <div className="text-4xl font-black leading-none" style={{ fontVariantNumeric: 'tabular-nums' }}>{rate.toFixed(1)} %</div>
              <div className="mt-3 h-3 w-full rounded-full overflow-hidden" style={{ background: c.seqTrack }} role="img"
                aria-label={`Efectividad de cobro ${rate.toFixed(1)} por ciento`}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(rate, 100)}%`, background: c.seq }} />
              </div>
              <p className="text-xs mt-2" style={{ ...subStyle, fontVariantNumeric: 'tabular-nums' }}>
                Cobrado {money(summary.Cobrado.amount + summary.Archivado.amount)} de {money(summary.Facturado.amount + summary.Pasado.amount + summary.Cobrado.amount + summary.Archivado.amount)} facturado
              </p>
            </>
          )}
        </div>
      </div>

      {/* Evolución mensual y atención */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className={`${cardClass} lg:col-span-2`} style={cardStyle}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h3 className={titleClass}>Remitos por mes y etapa</h3>
              <p className="text-xs" style={subStyle}>Últimos 6 meses. Tocá una columna para ver ese mes.</p>
            </div>
            {ViewToggle({ value: monthlyView, onChange: setMonthlyView })}
          </div>
          {monthlyView === 'grafico' ? (
            <>
              {MonthlyChart()}
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: c.ink2 }}>
                {STAGES.map(s => (
                  <span key={s} className="inline-flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded-[3px]" style={{ background: c[s] }} aria-hidden="true" />
                    {STAGE_PLURAL[s]}
                  </span>
                ))}
              </div>
            </>
          ) : (
            TableShell({ head: ['Mes', ...STAGES.map(s => STAGE_PLURAL[s]), 'Total'], rows: series.map(p => [monthLabel(p.month, true), ...STAGES.map(s => p.counts[s]), p.total]) })
          )}
        </div>

        <div className={cardClass} style={cardStyle}>
          <h3 className={titleClass}>Requiere atención</h3>
          <p className="text-xs mb-3" style={subStyle}>Remitos que llevan demasiado tiempo en una etapa (todos los meses).</p>
          <ul className="space-y-3 text-sm">
            {[
              { n: alerts.cargadosSinFacturar.count, days: alerts.cargadosSinFacturar.oldestDays, text: 'Cargados hace más de 30 días sin facturar', tab: 'auditoria' },
              { n: alerts.facturadosSinCobrar.count, days: alerts.facturadosSinCobrar.oldestDays, text: 'Facturados hace más de 45 días sin cobrar', tab: 'facturado' }
            ].map(a => (
              <li key={a.text} className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: a.n > 0 ? c.ink : c.muted }} aria-hidden="true" />
                <div>
                  <div className="font-black text-lg leading-none" style={{ fontVariantNumeric: 'tabular-nums' }}>{a.n}</div>
                  <div className="text-xs mt-0.5" style={subStyle}>{a.text}</div>
                  {a.n > 0 && <div className="text-[11px] mt-0.5" style={{ color: c.muted }}>El más antiguo: {a.days} días</div>}
                  {a.n > 0 && onNavigate && (
                    <button type="button" onClick={() => onNavigate(a.tab)} className="text-[11px] font-bold underline mt-1 cursor-pointer" style={{ color: c.ink }}>
                      Ver remitos
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Importes */}
      {canSeeAmounts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className={cardClass} style={cardStyle}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className={titleClass}>Importe por etapa</h3>
                <p className="text-xs capitalize" style={subStyle}>{periodLabel}, en pesos.</p>
              </div>
              {ViewToggle({ value: amountsView, onChange: setAmountsView })}
            </div>
            {amountsView === 'grafico' ? (
              HBars({ rows: STAGES.map(s => ({ label: STAGE_PLURAL[s], value: summary[s].amount, color: c[s], hint: String(summary[s].count) })) })
            ) : (
              TableShell({ head: ['Etapa', 'Remitos', 'Importe'], rows: STAGES.map(s => [STAGE_PLURAL[s], summary[s].count, money(summary[s].amount)]) })
            )}
          </div>

          <div className={cardClass} style={cardStyle}>
            <h3 className={titleClass}>Clientes con importe pendiente de cobro</h3>
            <p className="text-xs mb-3" style={subStyle}>Facturado y pasado que todavía no se cobró (todos los meses).</p>
            {pending.length === 0 ? (
              <p className="text-xs" style={subStyle}>No hay importes pendientes de cobro.</p>
            ) : (
              HBars({ labelW: 130, rows: pending.map(p => ({ label: p.client, value: p.amount, color: c.seq, hint: String(p.count) })) })
            )}
          </div>
        </div>
      )}

      {invalidDates > 0 && (
        <p className="text-[11px]" style={{ color: c.muted }}>
          {invalidDates} {invalidDates === 1 ? 'remito tiene' : 'remitos tienen'} una fecha faltante o inválida y no entra{invalidDates === 1 ? '' : 'n'} en los gráficos por mes.
        </p>
      )}

      {tooltip && (
        <div
          role="tooltip"
          className="fixed z-[70] pointer-events-none rounded-lg border px-3 py-2 text-xs shadow-xl"
          style={{ left: tooltip.x + 14, top: tooltip.y + 14, background: c.surface, borderColor: c.border, color: c.ink }}
        >
          <div className="font-black capitalize mb-1">{tooltip.title}</div>
          {tooltip.rows.map(r => (
            <div key={r.label} className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-1.5" style={{ color: c.ink2 }}>
                {r.color && <span className="inline-block w-2.5 h-2.5 rounded-[3px]" style={{ background: r.color }} aria-hidden="true" />}
                {r.label}
              </span>
              <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{r.value}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
