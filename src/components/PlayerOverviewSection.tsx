import React, { useMemo, useState } from 'react';
import { ExternalLink, FileText, Flame, Play, Search, Shield, Trophy, User } from 'lucide-react';
import type { ChessComGameSummary, ChessComPlayer, TimeClass } from '../types/chess.ts';

interface PlayerOverviewSectionProps {
  player: ChessComPlayer;
  games: ChessComGameSummary[];
  selectedGameId: string | null;
  analyzingGameId: string | null;
  onAnalyzeGame: (game: ChessComGameSummary) => void;
  onAnalyzeCustomPgn: (pgn: string) => void;
}

const TIME_CLASS_LABELS: Record<TimeClass, string> = {
  rapid: 'Rápidas',
  blitz: 'Blitz',
  bullet: 'Bullet',
  daily: 'Diarias',
};

function formatDate(unixSec: number): string {
  if (!unixSec) return '—';
  return new Date(unixSec * 1000).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export const PlayerOverviewSection: React.FC<PlayerOverviewSectionProps> = ({
  player,
  games,
  selectedGameId,
  analyzingGameId,
  onAnalyzeGame,
  onAnalyzeCustomPgn,
}) => {
  const [timeFilter, setTimeFilter] = useState<'all' | TimeClass>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [showCustomPgn, setShowCustomPgn] = useState(false);
  const [customPgnText, setCustomPgnText] = useState('');

  const filteredGames = useMemo(() => {
    return games.filter((g) => {
      if (timeFilter !== 'all' && g.timeClass !== timeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const opp = (g.playerColor === 'w' ? g.black.username : g.white.username).toLowerCase();
        const op = g.openingName.toLowerCase();
        if (!opp.includes(q) && !op.includes(q)) return false;
      }
      return true;
    });
  }, [games, timeFilter, searchQuery]);

  // Real narrative highlights computed from fetched Chess.com games
  const highlights = useMemo(() => {
    if (games.length === 0) return null;

    let bestWin: { opponent: string; rating: number; opening: string; game: ChessComGameSummary } | null = null;
    let recentWins = 0;
    let recentDraws = 0;
    let recentLosses = 0;
    const openingWins = new Map<string, { wins: number; total: number }>();

    for (const g of games) {
      const opp = g.playerColor === 'w' ? g.black : g.white;
      if (g.playerResult === 'win') {
        recentWins++;
        if (!bestWin || opp.rating > bestWin.rating) {
          bestWin = {
            opponent: opp.username,
            rating: opp.rating,
            opening: g.openingName,
            game: g,
          };
        }
      } else if (g.playerResult === 'draw') {
        recentDraws++;
      } else {
        recentLosses++;
      }

      const opKey = g.openingName.split(':')[0].split(',')[0].trim() || 'Apertura Variada';
      const entry = openingWins.get(opKey) ?? { wins: 0, total: 0 };
      entry.total++;
      if (g.playerResult === 'win') entry.wins++;
      openingWins.set(opKey, entry);
    }

    let topOpening: { name: string; wins: number; total: number } | null = null;
    for (const [name, stats] of openingWins.entries()) {
      if (stats.total >= 2) {
        if (
          !topOpening ||
          stats.wins / stats.total > topOpening.wins / topOpening.total ||
          (stats.wins / stats.total === topOpening.wins / topOpening.total && stats.total > topOpening.total)
        ) {
          topOpening = { name, wins: stats.wins, total: stats.total };
        }
      }
    }

    return {
      bestWin,
      recentRecord: `${recentWins}V · ${recentDraws}E · ${recentLosses}D`,
      recentWinRate: Math.round((recentWins / games.length) * 100),
      topOpening,
    };
  }, [games]);

  const topPercent = Math.max(0.1, 100 - player.totals.overallPercentile).toFixed(1);

  return (
    <section id="resumen" className="space-y-6">
      {/* Player Header & Core Record */}
      <div className="bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 rounded-lg p-4 sm:p-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-200 dark:border-slate-800">
          {/* Identity */}
          <div className="flex items-center gap-4 min-w-0">
            {player.avatar && !avatarFailed ? (
              <img
                src={player.avatar}
                alt={`Avatar de ${player.username}`}
                referrerPolicy="no-referrer"
                onError={() => setAvatarFailed(true)}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
              />
            ) : (
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                <User className="w-7 h-7 text-slate-400" />
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {player.title && (
                  <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
                    {player.title}
                  </span>
                )}
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 truncate">
                  {player.username}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-1">
                {player.name && <span>{player.name}</span>}
                {player.name && <span aria-hidden="true">·</span>}
                {player.countryCode && <span>País: {player.countryCode}</span>}
                {player.countryCode && <span aria-hidden="true">·</span>}
                <span>Miembro desde {formatDate(player.joined)}</span>
                <span aria-hidden="true">·</span>
                <a
                  href={player.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 hover:underline"
                >
                  <span>Perfil Chess.com</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Primary KPI Row: Porcentil, Partidas, Victorias, Tablas, Derrotas */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 lg:gap-6">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Percentil global</div>
              <div className="text-xl sm:text-2xl font-mono font-bold tabular-nums text-amber-600 dark:text-amber-400 mt-0.5">
                {player.totals.overallPercentile.toFixed(1)}%
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                Top {topPercent}% ({TIME_CLASS_LABELS[player.totals.primaryTimeClass]})
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Partidas totales</div>
              <div className="text-xl sm:text-2xl font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
                {player.totals.totalGames.toLocaleString('es-ES')}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Historial oficial
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Victorias</div>
              <div className="text-xl sm:text-2xl font-mono font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
                {player.totals.wins.toLocaleString('es-ES')}
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {player.totals.winRate}%
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Tablas</div>
              <div className="text-xl sm:text-2xl font-mono font-bold tabular-nums text-slate-700 dark:text-slate-300 mt-0.5">
                {player.totals.draws.toLocaleString('es-ES')}
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {player.totals.drawRate}%
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <div className="text-xs text-slate-500 dark:text-slate-400">Derrotas</div>
              <div className="text-xl sm:text-2xl font-mono font-bold tabular-nums text-rose-600 dark:text-rose-400 mt-0.5">
                {player.totals.losses.toLocaleString('es-ES')}
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {player.totals.lossRate}%
              </div>
            </div>
          </div>
        </div>

        {/* Win / Draw / Loss Distribution Bar */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Balance global de resultados</span>
            <span className="font-mono tabular-nums">
              {player.totals.winRate}% V · {player.totals.drawRate}% E · {player.totals.lossRate}% D
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 flex">
            <div
              style={{ width: `${player.totals.winRate}%` }}
              className="bg-emerald-500"
              title={`Victorias: ${player.totals.winRate}%`}
            />
            <div
              style={{ width: `${player.totals.drawRate}%` }}
              className="bg-slate-400 dark:bg-slate-500"
              title={`Tablas: ${player.totals.drawRate}%`}
            />
            <div
              style={{ width: `${player.totals.lossRate}%` }}
              className="bg-rose-500"
              title={`Derrotas: ${player.totals.lossRate}%`}
            />
          </div>
        </div>

        {/* Ratings by Time Control */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {player.statsByMode.map((mode) => (
            <div
              key={mode.timeClass}
              className="p-4 rounded-lg bg-slate-50 dark:bg-[#0F141A] border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {mode.label}
                </span>
                <span className="text-xs font-mono tabular-nums text-amber-600 dark:text-amber-400">
                  Percentil {mode.percentile.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100">
                  {mode.rating || '—'}
                </span>
                {mode.bestRating && (
                  <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 inline-flex items-center gap-1">
                    <Trophy className="w-3 h-3 text-amber-500" />
                    Máx {mode.bestRating}
                  </span>
                )}
              </div>
              <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {mode.totalGames.toLocaleString('es-ES')} partidas · {mode.wins}G / {mode.draws}E / {mode.losses}P
              </div>
            </div>
          ))}
        </div>

        {/* Narrative Highlights Strip (derived from real Chess.com games) */}
        {highlights && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-start justify-between gap-3 p-3.5 rounded-lg bg-slate-50 dark:bg-[#0F141A] border border-slate-200/80 dark:border-slate-800">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>Victoria frente a mayor Elo reciente</span>
                </div>
                {highlights.bestWin ? (
                  <div className="mt-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {highlights.bestWin.opponent} ({highlights.bestWin.rating})
                    </p>
                    <button
                      type="button"
                      onClick={() => onAnalyzeGame(highlights.bestWin!.game)}
                      className="text-xs text-amber-600 dark:text-amber-400 hover:underline mt-0.5"
                    >
                      Revisar esta victoria
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 mt-1">Sin victorias en la muestra reciente.</p>
                )}
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-[#0F141A] border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <Flame className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Forma en últimas {games.length} partidas</span>
              </div>
              <p className="text-sm font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                {highlights.recentRecord} · {highlights.recentWinRate}% victorias
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Tendencia inmediata de resultados
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-[#0F141A] border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <Shield className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                <span>Apertura más rentable reciente</span>
              </div>
              {highlights.topOpening ? (
                <>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate mt-1">
                    {highlights.topOpening.name}
                  </p>
                  <p className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-0.5">
                    {highlights.topOpening.wins} de {highlights.topOpening.total} ganadas
                  </p>
                </>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Repertorio variado entre aperturas
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Recent Games List (Adaptive: Mobile List + Desktop Table) */}
      <div className="bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
        <div className="p-4 sm:px-6 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Partidas Recientes en Chess.com
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Elige cualquier partida para ejecutar el análisis del motor y entrenar con tu coach.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Time Class Filter */}
            <div className="flex items-center gap-1 p-1 rounded-md bg-slate-100 dark:bg-[#0D1117] border border-slate-200 dark:border-slate-800 overflow-x-auto">
              {(['all', 'rapid', 'blitz', 'bullet'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setTimeFilter(mode)}
                  className={`min-h-[34px] px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                    timeFilter === mode
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {mode === 'all' ? 'Todas' : TIME_CLASS_LABELS[mode]}
                </button>
              ))}
            </div>

            {/* Search Opponent / Opening */}
            <div className="relative flex-1 sm:flex-initial min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar rival o apertura..."
                className="w-full pl-8 pr-3 py-2 text-xs rounded-md bg-slate-50 dark:bg-[#0D1117] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowCustomPgn((v) => !v)}
              className="min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Cargar PGN</span>
            </button>
          </div>
        </div>

        {/* Optional Custom PGN Box */}
        {showCustomPgn && (
          <div className="p-4 sm:px-6 bg-slate-50 dark:bg-[#0F141A] border-b border-slate-200 dark:border-slate-800 space-y-2.5">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Pega cualquier PGN estándar para analizarlo en el tablero y con el Coach Tres Mentes
            </label>
            <textarea
              rows={4}
              value={customPgnText}
              onChange={(e) => setCustomPgnText(e.target.value)}
              placeholder='[Event "Partida de estudio"]&#10;1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 ...'
              className="w-full p-3 text-xs font-mono rounded-md bg-white dark:bg-[#0D1117] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCustomPgn(false)}
                className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!customPgnText.trim()}
                onClick={() => {
                  onAnalyzeCustomPgn(customPgnText.trim());
                  setShowCustomPgn(false);
                }}
                className="px-4 py-2 text-xs font-semibold rounded-md bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50"
              >
                Analizar PGN
              </button>
            </div>
          </div>
        )}

        {/* Mobile Adaptive List (< md) */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800/70">
          {filteredGames.length === 0 ? (
            <div className="py-8 px-4 text-center text-sm text-slate-500 dark:text-slate-400">
              No hay partidas recientes que coincidan con este filtro.
            </div>
          ) : (
            filteredGames.map((g) => {
              const opp = g.playerColor === 'w' ? g.black : g.white;
              const playerSide = g.playerColor === 'w' ? 'Blancas' : 'Negras';
              const isSelected = selectedGameId === g.id;
              const isAnalyzing = analyzingGameId === g.id;
              const resultColor =
                g.playerResult === 'win'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : g.playerResult === 'draw'
                    ? 'text-slate-500 dark:text-slate-400'
                    : 'text-rose-600 dark:text-rose-400';

              return (
                <div
                  key={g.id}
                  className={`p-4 flex flex-col gap-2.5 ${
                    isSelected ? 'bg-amber-500/8 dark:bg-amber-500/10' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        <span className="truncate">{opp.username}</span>
                        <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
                          ({opp.rating})
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {TIME_CLASS_LABELS[g.timeClass]} · Con {playerSide} · {g.totalMoves} jug. · {formatDate(g.endTime)}
                      </div>
                    </div>
                    <span className={`text-xs font-semibold shrink-0 ${resultColor}`}>
                      {g.playerResultLabel}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-600 dark:text-slate-300 truncate">
                      {g.openingName}
                    </span>
                    <button
                      type="button"
                      onClick={() => onAnalyzeGame(g)}
                      disabled={isAnalyzing}
                      className={`min-h-[40px] px-3.5 py-2 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 touch-manipulation ${
                        isSelected
                          ? 'bg-amber-600 text-white'
                          : 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Play className="w-3 h-3" />
                      <span>
                        {isAnalyzing ? 'Analizando...' : isSelected ? 'En revisión' : 'Analizar'}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Data Table (md+) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-4 sm:px-6">Modalidad</th>
                <th className="py-2.5 px-4">Rival y Elo</th>
                <th className="py-2.5 px-4">Apertura</th>
                <th className="py-2.5 px-4">Resultado</th>
                <th className="py-2.5 px-4 text-right">Jugadas</th>
                <th className="py-2.5 px-4">Fecha</th>
                <th className="py-2.5 px-4 sm:px-6 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-sm">
              {filteredGames.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                  >
                    No hay partidas recientes que coincidan con este filtro.
                  </td>
                </tr>
              ) : (
                filteredGames.map((g) => {
                  const opp = g.playerColor === 'w' ? g.black : g.white;
                  const playerSide = g.playerColor === 'w' ? 'Blancas' : 'Negras';
                  const isSelected = selectedGameId === g.id;
                  const isAnalyzing = analyzingGameId === g.id;

                  const resultColor =
                    g.playerResult === 'win'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : g.playerResult === 'draw'
                        ? 'text-slate-500 dark:text-slate-400'
                        : 'text-rose-600 dark:text-rose-400';

                  return (
                    <tr
                      key={g.id}
                      className={`transition-colors ${
                        isSelected
                          ? 'bg-amber-500/8 dark:bg-amber-500/10'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="py-3 px-4 sm:px-6 whitespace-nowrap">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {TIME_CLASS_LABELS[g.timeClass]}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Con {playerSide}
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {opp.username}
                        </div>
                        <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                          Elo {opp.rating}
                        </div>
                      </td>

                      <td className="py-3 px-4 max-w-[260px]">
                        <div className="text-xs text-slate-800 dark:text-slate-200 truncate">
                          {g.openingName}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          {g.eco}
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`text-xs font-semibold ${resultColor}`}>
                          {g.playerResultLabel}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-600 dark:text-slate-300">
                        {g.totalMoves}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(g.endTime)}
                      </td>

                      <td className="py-3 px-4 sm:px-6 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onAnalyzeGame(g)}
                          disabled={isAnalyzing}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                            isSelected
                              ? 'bg-amber-600 text-white'
                              : 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <Play className="w-3 h-3" />
                          <span>
                            {isAnalyzing
                              ? 'Analizando...'
                              : isSelected
                                ? 'En revisión'
                                : 'Analizar'}
                          </span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
