import React from 'react';
import { Award, Compass, Flag, Layers, Sparkles, Swords, Zap } from 'lucide-react';
import type { DiagnosticReport, MoveClassification } from '../types/chess.ts';

interface DiagnosticReportSectionProps {
  report: DiagnosticReport;
  whiteUsername: string;
  blackUsername: string;
  whiteElo: number;
  blackElo: number;
  playerColor: 'w' | 'b';
  onJumpToPly: (ply: number) => void;
}

const CLASSIFICATION_ORDER: Array<{
  key: MoveClassification;
  label: string;
  barClass: string;
}> = [
  { key: 'brillante', label: 'Brillantes', barClass: 'bg-cyan-500' },
  { key: 'optima', label: 'Óptimas', barClass: 'bg-emerald-500' },
  { key: 'buena', label: 'Buenas', barClass: 'bg-emerald-600' },
  { key: 'libro', label: 'Libro', barClass: 'bg-amber-600' },
  { key: 'imprecision', label: 'Imprecisiones', barClass: 'bg-amber-400' },
  { key: 'error', label: 'Errores', barClass: 'bg-orange-500' },
  { key: 'grave', label: 'Errores graves', barClass: 'bg-rose-600' },
];

function accuracyColor(val: number | null): string {
  if (val === null) return 'text-slate-400';
  if (val >= 84) return 'text-emerald-600 dark:text-emerald-400';
  if (val >= 70) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

export const DiagnosticReportSection: React.FC<DiagnosticReportSectionProps> = ({
  report,
  whiteUsername,
  blackUsername,
  whiteElo,
  blackElo,
  playerColor,
  onJumpToPly,
}) => {
  const totalClassified = Object.values(report.summary.counts).reduce((a, b) => a + b, 0) || 1;
  const analyzedSide = playerColor === 'w' ? whiteUsername : blackUsername;

  return (
    <section
      id="diagnostico"
      className="bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 rounded-lg p-4 sm:p-6 space-y-6"
    >
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Informe técnico post-partida · Jugador analizado: {analyzedSide}
          </p>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            Diagnóstico Integral de la Partida
          </h2>
        </div>

        <div className="grid grid-cols-3 gap-4 sm:flex sm:flex-wrap sm:items-center sm:gap-6 text-sm">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Blancas</div>
            <div className="text-base sm:text-lg font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {report.summary.whiteAccuracy.toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Negras</div>
            <div className="text-base sm:text-lg font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {report.summary.blackAccuracy.toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Pérdida media</div>
            <div className="text-base sm:text-lg font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {playerColor === 'w' ? report.summary.whiteAcpl : report.summary.blackAcpl} cp
            </div>
          </div>
        </div>
      </div>

      {/* Top Metrics: Elo Promedio, Punto de Inflexión, Movimientos Brillantes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Elo Promedio */}
        <div className="p-4 rounded-lg bg-slate-50 dark:bg-[#0F141A] border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Elo promedio de la partida</span>
            <Award className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-3xl font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100 mt-2">
            {report.eloPromedio}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-mono tabular-nums break-words">
            {whiteUsername} ({whiteElo}) vs {blackUsername} ({blackElo})
          </p>
        </div>

        {/* Punto de inflexión clave */}
        <div className="p-4 rounded-lg bg-slate-50 dark:bg-[#0F141A] border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Momento decisivo de la partida</span>
              <Zap className="w-4 h-4 text-amber-500" />
            </div>
            {report.turningPoint ? (
              <div className="mt-2 flex items-baseline gap-2.5 flex-wrap">
                <span className="text-2xl font-mono font-bold tabular-nums text-amber-600 dark:text-amber-400">
                  {report.turningPoint.moveNumber}
                  {report.turningPoint.color === 'w' ? '.' : '...'} {report.turningPoint.san}
                </span>
                <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  Variación {(report.turningPoint.swingCp / 100).toFixed(1)} peones
                </span>
              </div>
            ) : (
              <div className="text-2xl font-mono font-bold text-slate-500 mt-2">—</div>
            )}
          </div>
          {report.turningPoint ? (
            <button
              type="button"
              onClick={() => onJumpToPly(report.turningPoint!.ply)}
              className="mt-2.5 self-start px-3 py-1.5 rounded text-xs font-medium bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/40 hover:bg-amber-500/25 transition-colors"
            >
              Ir a esta jugada en el tablero
            </button>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Partida equilibrada sin cambios bruscos de evaluación.
            </p>
          )}
        </div>

        {/* Movimientos Brillantes */}
        <div className="p-4 rounded-lg bg-slate-50 dark:bg-[#0F141A] border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Movimientos brillantes</span>
            <Sparkles className="w-4 h-4 text-cyan-500" />
          </div>
          <div className="text-3xl font-mono font-bold tabular-nums text-cyan-600 dark:text-cyan-400 mt-2">
            {report.brillantes.count}
          </div>
          {report.brillantes.moves.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {report.brillantes.moves.map((m) => (
                <button
                  key={m.ply}
                  type="button"
                  onClick={() => onJumpToPly(m.ply)}
                  className="px-2.5 py-1.5 rounded text-xs font-mono font-semibold bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/25 transition-colors"
                >
                  {m.moveNumber}
                  {m.color === 'w' ? '.' : '...'} {m.san}!!
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              No se detectaron sacrificios brillantes en esta partida; enfócate en consistencia sólida.
            </p>
          )}
        </div>
      </div>

      {/* Four Phases Breakdown: Apertura, Táctica, Estrategia, Finales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Apertura */}
        <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
              <span>Apertura</span>
              <Compass className="w-4 h-4" />
            </div>
            <div className={`text-2xl font-mono font-bold tabular-nums mt-1.5 ${accuracyColor(report.apertura.precision)}`}>
              {report.apertura.precision.toFixed(1)}%
            </div>
            <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-1">
              {report.apertura.openingName} ({report.apertura.eco})
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {report.apertura.verdict}
          </p>
        </div>

        {/* Táctica */}
        <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
              <span>Táctica</span>
              <Swords className="w-4 h-4" />
            </div>
            <div className={`text-2xl font-mono font-bold tabular-nums mt-1.5 ${accuracyColor(report.tactica.precision)}`}>
              {report.tactica.precision.toFixed(1)}%
            </div>
            <div className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300 mt-1">
              {report.tactica.found} aciertos · {report.tactica.missed} omitidas ({report.tactica.sharpMoments} momentos clave)
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {report.tactica.verdict}
          </p>
        </div>

        {/* Estrategia */}
        <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
              <span>Estrategia</span>
              <Layers className="w-4 h-4" />
            </div>
            <div className={`text-2xl font-mono font-bold tabular-nums mt-1.5 ${accuracyColor(report.estrategia.precision)}`}>
              {report.estrategia.precision.toFixed(1)}%
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
              Medio juego y planes de ataque
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {report.estrategia.verdict}
          </p>
        </div>

        {/* Finales */}
        <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
              <span>Finales</span>
              <Flag className="w-4 h-4" />
            </div>
            <div className={`text-2xl font-mono font-bold tabular-nums mt-1.5 ${accuracyColor(report.finales.precision)}`}>
              {report.finales.reached && report.finales.precision !== null
                ? `${report.finales.precision.toFixed(1)}%`
                : 'N/A'}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
              {report.finales.reached ? 'Fase final evaluada' : 'Sin fase final'}
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {report.finales.verdict}
          </p>
        </div>
      </div>

      {/* Move Quality Distribution */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Distribución de calidad de jugadas ({analyzedSide})</span>
          <span className="font-mono tabular-nums">{totalClassified} jugadas evaluadas</span>
        </div>

        <div className="h-2.5 w-full rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 flex">
          {CLASSIFICATION_ORDER.map((item) => {
            const count = report.summary.counts[item.key] || 0;
            const widthPct = (count / totalClassified) * 100;
            if (widthPct <= 0) return null;
            return (
              <div
                key={item.key}
                style={{ width: `${widthPct}%` }}
                className={item.barClass}
                title={`${item.label}: ${count}`}
              />
            );
          })}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
          {CLASSIFICATION_ORDER.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-50 dark:bg-[#0F141A] border border-slate-200/70 dark:border-slate-800"
            >
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <span className={`w-2 h-2 rounded-xs ${item.barClass}`} />
                <span>{item.label}</span>
              </span>
              <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {report.summary.counts[item.key] || 0}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
