import React, { useMemo, useState } from 'react';
import { BarChart3, Loader2, RefreshCw, TrendingUp } from 'lucide-react';
import type { GameTrendPoint, LongTermTrends } from '../types/chess.ts';

interface TrendsAnalyticsSectionProps {
  trends: LongTermTrends | null;
  loading: boolean;
  error: string | null;
  onRefreshTrends: () => void;
}

export const TrendsAnalyticsSection: React.FC<TrendsAnalyticsSectionProps> = ({
  trends,
  loading,
  error,
  onRefreshTrends,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const chartData = useMemo(() => {
    if (!trends || trends.points.length === 0) return null;
    const pts = trends.points;
    const width = 680;
    const height = 220;
    const padX = 36;
    const padY = 24;
    const innerW = width - padX * 2;
    const innerH = height - padY * 2;

    const toX = (i: number) =>
      pts.length === 1 ? padX + innerW / 2 : padX + (i / (pts.length - 1)) * innerW;
    const toY = (val: number) =>
      padY + innerH - (Math.max(0, Math.min(100, val)) / 100) * innerH;

    const precisionCoords = pts.map((p, i) => ({ x: toX(i), y: toY(p.precision), p }));
    const tacticalCoords = pts.map((p, i) => ({ x: toX(i), y: toY(p.tacticalScore), p }));

    const precisionPath = precisionCoords
      .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
      .join(' ');
    const precisionArea = `${precisionPath} L ${precisionCoords[precisionCoords.length - 1].x.toFixed(1)} ${
      padY + innerH
    } L ${precisionCoords[0].x.toFixed(1)} ${padY + innerH} Z`;

    const tacticalPath = tacticalCoords
      .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
      .join(' ');

    return {
      width,
      height,
      padX,
      padY,
      innerH,
      precisionCoords,
      tacticalCoords,
      precisionPath,
      precisionArea,
      tacticalPath,
      toY,
    };
  }, [trends]);

  const hoveredPoint: GameTrendPoint | null =
    trends && hoveredIdx !== null && trends.points[hoveredIdx]
      ? trends.points[hoveredIdx]
      : null;

  return (
    <section
      id="tendencias"
      className="bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Tendencia histórica sobre partidas recientes de Chess.com
          </p>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            Estadísticas Avanzadas de Rendimiento
          </h2>
        </div>

        <button
          type="button"
          onClick={onRefreshTrends}
          disabled={loading}
          className="px-4 py-2 rounded-md border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          <span>{loading ? 'Calculando tendencias...' : 'Recalcular tendencias'}</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-md border border-rose-500/40 bg-rose-500/10 text-xs text-rose-600 dark:text-rose-300">
          {error}
        </div>
      )}

      {loading && !trends && (
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 rounded-md bg-slate-200 dark:bg-slate-800 animate-pulse" />
            ))}
          </div>
          <div className="h-56 rounded-md bg-slate-200 dark:bg-slate-800 animate-pulse" />
        </div>
      )}

      {trends && (
        <>
          {/* Summary KPI Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-[#0F141A] border border-slate-200 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400">Precisión promedio</div>
              <div className="text-2xl font-mono font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
                {trends.averagePrecision.toFixed(1)}%
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono tabular-nums">
                Últimas {trends.gamesAnalyzed} partidas
              </div>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 dark:bg-[#0F141A] border border-slate-200 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400">Tendencia táctica</div>
              <div className="text-2xl font-mono font-bold tabular-nums text-amber-600 dark:text-amber-400 mt-1">
                {trends.averageTacticalScore.toFixed(1)}%
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Capturas, jaques y cálculo
              </div>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 dark:bg-[#0F141A] border border-slate-200 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400">Solidez de apertura</div>
              <div className="text-2xl font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                {trends.averageOpeningScore.toFixed(1)}%
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Primeras jugadas de desarrollo
              </div>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 dark:bg-[#0F141A] border border-slate-200 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400">Errores graves / partida</div>
              <div className="text-2xl font-mono font-bold tabular-nums text-rose-600 dark:text-rose-400 mt-1">
                {trends.blunderRatePerGame.toFixed(2)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Promedio de blunders (&gt;2.2 peones)
              </div>
            </div>
          </div>

          {/* Main Precision & Tactical Trend Chart */}
          {chartData && (
            <div className="p-4 sm:p-5 rounded-lg bg-slate-50 dark:bg-[#0F141A] border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  <TrendingUp className="w-4 h-4 text-amber-500" />
                  <span>Curva de Precisión y Tendencia Táctica</span>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-0.5 bg-emerald-500 inline-block" />
                    <span>Precisión general (%)</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-0.5 bg-amber-500 inline-block" />
                    <span>Precisión táctica (%)</span>
                  </span>
                </div>
              </div>

              {/* Hover Telemetry Strip */}
              <div className="min-h-[22px] text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
                {hoveredPoint ? (
                  <span>
                    vs {hoveredPoint.opponent} ({hoveredPoint.playerRating}) · {hoveredPoint.dateLabel} · Precisión{' '}
                    <strong className="text-emerald-500">{hoveredPoint.precision}%</strong> · Táctica{' '}
                    <strong className="text-amber-500">{hoveredPoint.tacticalScore}%</strong> · Errores graves:{' '}
                    {hoveredPoint.blunders} · {hoveredPoint.openingName}
                  </span>
                ) : (
                  <span className="text-slate-500 dark:text-slate-400">
                    Pasa el cursor sobre cualquier punto del gráfico para inspeccionar esa partida.
                  </span>
                )}
              </div>

              <svg
                viewBox={`0 0 ${chartData.width} ${chartData.height}`}
                className="w-full h-56 overflow-visible"
              >
                {/* Y-axis horizontal gridlines */}
                {[25, 50, 75, 100].map((tick) => {
                  const y = chartData.toY(tick);
                  return (
                    <g key={tick}>
                      <line
                        x1={chartData.padX}
                        y1={y}
                        x2={chartData.width - chartData.padX}
                        y2={y}
                        stroke="currentColor"
                        className="text-slate-200 dark:text-slate-800"
                        strokeDasharray="3 3"
                      />
                      <text
                        x={chartData.padX - 8}
                        y={y + 4}
                        textAnchor="end"
                        className="fill-slate-400 text-[10px] font-mono"
                      >
                        {tick}%
                      </text>
                    </g>
                  );
                })}

                {/* Area & Lines */}
                <path d={chartData.precisionArea} fill="rgba(16, 185, 129, 0.12)" />
                <path
                  d={chartData.precisionPath}
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                />
                <path
                  d={chartData.tacticalPath}
                  fill="none"
                  stroke="#D97706"
                  strokeWidth="1.8"
                  strokeDasharray="5 3"
                  strokeLinejoin="round"
                />

                {/* Interactive Data Points */}
                {chartData.precisionCoords.map((c, idx) => {
                  const tCoord = chartData.tacticalCoords[idx];
                  const isActive = hoveredIdx === idx;
                  return (
                    <g
                      key={c.p.gameId}
                      onMouseEnter={() => setHoveredIdx(idx)}
                      onMouseLeave={() => setHoveredIdx(null)}
                      className="cursor-pointer"
                    >
                      <rect
                        x={c.x - 16}
                        y={chartData.padY}
                        width={32}
                        height={chartData.innerH}
                        fill="transparent"
                      />
                      {isActive && (
                        <line
                          x1={c.x}
                          y1={chartData.padY}
                          x2={c.x}
                          y2={chartData.padY + chartData.innerH}
                          stroke="rgba(148, 163, 184, 0.4)"
                        />
                      )}
                      <circle
                        cx={c.x}
                        cy={c.y}
                        r={isActive ? 5 : 3.5}
                        fill={
                          c.p.playerResult === 'win'
                            ? '#10B981'
                            : c.p.playerResult === 'draw'
                              ? '#94A3B8'
                              : '#F43F5E'
                        }
                        stroke="#0D1117"
                        strokeWidth="1.5"
                      />
                      <circle
                        cx={tCoord.x}
                        cy={tCoord.y}
                        r={isActive ? 4.5 : 3}
                        fill="#D97706"
                        stroke="#0D1117"
                        strokeWidth="1.2"
                      />
                      <text
                        x={c.x}
                        y={chartData.height - 4}
                        textAnchor="middle"
                        className="fill-slate-400 text-[10px] font-mono"
                      >
                        {c.p.dateLabel}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}

          {/* Phase Profile & Opening Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Phase Profile */}
            <div className="p-5 rounded-lg border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                <BarChart3 className="w-4 h-4 text-amber-500" />
                <span>Perfil de Dominio por Fase</span>
              </div>

              <div className="space-y-3.5">
                {[
                  { label: 'Apertura (desarrollo inicial)', val: trends.phaseProfile.apertura },
                  { label: 'Táctica (cálculo y golpes directos)', val: trends.phaseProfile.tactica },
                  { label: 'Medio Juego (planes y coordinación)', val: trends.phaseProfile.mediojuego },
                  { label: 'Finales (técnica de conversión)', val: trends.phaseProfile.finales },
                ].map((phase) => (
                  <div key={phase.label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-700 dark:text-slate-300">{phase.label}</span>
                      <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                        {phase.val.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          phase.val >= 82
                            ? 'bg-emerald-500'
                            : phase.val >= 68
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(100, phase.val)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Opening Families Breakdown */}
            <div className="p-5 rounded-lg border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Rendimiento por Apertura Jugada
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                      <th className="py-2 pr-3">Apertura</th>
                      <th className="py-2 px-2 text-right">Partidas</th>
                      <th className="py-2 px-2 text-right">V / E / D</th>
                      <th className="py-2 pl-2 text-right">Precisión</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                    {trends.openingBreakdown.map((op) => (
                      <tr key={op.openingName}>
                        <td className="py-2.5 pr-3 font-medium text-slate-800 dark:text-slate-200 max-w-[200px] truncate">
                          {op.openingName}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                          {op.games}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                          {op.wins}/{op.draws}/{op.losses}
                        </td>
                        <td className="py-2.5 pl-2 text-right font-mono font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                          {op.avgPrecision.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
};
