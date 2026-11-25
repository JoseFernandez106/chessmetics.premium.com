import React, { useMemo } from 'react';
import { Chess, Square } from 'chess.js';
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Pause,
  Play,
  RotateCw,
} from 'lucide-react';
import { ChessPieceSvg } from './ChessPieceSvg.tsx';
import type { AnalyzedMove, MoveClassification } from '../types/chess.ts';

interface ChessBoardPanelProps {
  fen: string;
  orientation: 'w' | 'b';
  onFlip: () => void;
  currentMove: AnalyzedMove | null;
  showBestMoveArrow: boolean;
  onToggleBestMoveArrow: () => void;
  whiteUsername: string;
  blackUsername: string;
  whiteElo: number;
  blackElo: number;
  currentPly: number;
  totalPlies: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onGoToPly: (ply: number) => void;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

const CLASSIFICATION_GLYPHS: Record<
  MoveClassification,
  { symbol: string; label: string; bg: string }
> = {
  brillante: { symbol: '!!', label: 'Brillante', bg: 'bg-cyan-500 text-slate-950' },
  optima: { symbol: '★', label: 'Óptima', bg: 'bg-emerald-500 text-slate-950' },
  buena: { symbol: '✓', label: 'Buena', bg: 'bg-emerald-600 text-white' },
  libro: { symbol: 'B', label: 'Libro', bg: 'bg-amber-700 text-amber-50' },
  imprecision: { symbol: '?!', label: 'Imprecisión', bg: 'bg-amber-500 text-slate-950' },
  error: { symbol: '?', label: 'Error', bg: 'bg-orange-500 text-slate-950' },
  grave: { symbol: '??', label: 'Error grave', bg: 'bg-rose-600 text-white' },
};

function squareToCoords(sq: string, orientation: 'w' | 'b'): { x: number; y: number } {
  const fileIdx = FILES.indexOf(sq[0]);
  const rankIdx = RANKS.indexOf(sq[1]);
  const col = orientation === 'w' ? fileIdx : 7 - fileIdx;
  const row = orientation === 'w' ? rankIdx : 7 - rankIdx;
  return { x: col * 100 + 50, y: row * 100 + 50 };
}

function formatEvalText(evalCp: number, mateIn: number | null): string {
  if (mateIn !== null) {
    return `M${Math.abs(mateIn)}`;
  }
  const pawns = evalCp / 100;
  return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(1)}`;
}

export const ChessBoardPanel: React.FC<ChessBoardPanelProps> = React.memo(
  ({
    fen,
    orientation,
    onFlip,
    currentMove,
    showBestMoveArrow,
    onToggleBestMoveArrow,
    whiteUsername,
    blackUsername,
    whiteElo,
    blackElo,
    currentPly,
    totalPlies,
    isPlaying,
    onTogglePlay,
    onGoToPly,
  }) => {
    const { board, inCheckSquare } = useMemo(() => {
      const chess = new Chess(fen);
      let checkSq: string | null = null;
      if (chess.inCheck()) {
        const turn = chess.turn();
        const kingSquares = chess.findPiece({ type: 'k', color: turn });
        checkSq = kingSquares[0] ?? null;
      }
      return { board: chess.board(), inCheckSquare: checkSq };
    }, [fen]);

    const evalCp = currentMove ? currentMove.evalAfterCp : 15;
    const mateIn = currentMove ? currentMove.mateIn : null;

    const whitePercent = useMemo(() => {
      if (mateIn !== null) {
        return mateIn > 0 ? 96 : 4;
      }
      const clamped = Math.max(-900, Math.min(900, evalCp));
      const pct = 50 + (clamped / 900) * 44;
      return Math.max(6, Math.min(94, pct));
    }, [evalCp, mateIn]);

    const evalLabel = formatEvalText(evalCp, mateIn);

    const orderedRanks = orientation === 'w' ? RANKS : [...RANKS].reverse();
    const orderedFiles = orientation === 'w' ? FILES : [...FILES].reverse();

    const topPlayer =
      orientation === 'w'
        ? { name: blackUsername, elo: blackElo, color: 'Negras' }
        : { name: whiteUsername, elo: whiteElo, color: 'Blancas' };
    const bottomPlayer =
      orientation === 'w'
        ? { name: whiteUsername, elo: whiteElo, color: 'Blancas' }
        : { name: blackUsername, elo: blackElo, color: 'Negras' };

    const arrowCoords = useMemo(() => {
      if (!showBestMoveArrow || !currentMove?.bestMoveFrom || !currentMove?.bestMoveTo) {
        return null;
      }
      const from = squareToCoords(currentMove.bestMoveFrom, orientation);
      const to = squareToCoords(currentMove.bestMoveTo, orientation);
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      const tipX = to.x - (dx / len) * 18;
      const tipY = to.y - (dy / len) * 18;
      return { x1: from.x, y1: from.y, x2: tipX, y2: tipY };
    }, [showBestMoveArrow, currentMove, orientation]);

    const classInfo = currentMove ? CLASSIFICATION_GLYPHS[currentMove.classification] : null;

    return (
      <div className="flex flex-col gap-3 w-full max-w-[540px] mx-auto lg:max-w-none">
        {/* Top Player Strip */}
        <div className="flex items-center justify-between px-1 text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`w-3 h-3 rounded-sm border shrink-0 ${
                orientation === 'w'
                  ? 'bg-slate-900 border-slate-600'
                  : 'bg-stone-100 border-stone-400'
              }`}
            />
            <span className="font-medium truncate text-slate-900 dark:text-slate-100">
              {topPlayer.name}
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
              {topPlayer.elo}
            </span>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">{topPlayer.color}</span>
        </div>

        {/* Eval Bar + 8x8 Board */}
        <div className="flex items-stretch gap-2 sm:gap-2.5 w-full">
          {/* Evaluation Bar */}
          <div
            className="relative w-6 sm:w-7 shrink-0 rounded-md overflow-hidden border border-slate-300 dark:border-slate-700 bg-slate-900 flex flex-col justify-end select-none"
            title={`Evaluación del motor: ${evalLabel}`}
          >
            <div
              className="w-full bg-[#EDE8DC] transition-[height] duration-200 ease-out"
              style={{
                height: `${orientation === 'w' ? whitePercent : 100 - whitePercent}%`,
              }}
            />
            <span
              className={`absolute left-0 right-0 text-center font-mono text-[9px] sm:text-[10px] font-semibold tabular-nums leading-none px-0.5 ${
                (orientation === 'w' ? whitePercent >= 50 : 100 - whitePercent >= 50)
                  ? 'bottom-1.5 text-slate-900'
                  : 'top-1.5 text-slate-100'
              }`}
            >
              {evalLabel}
            </span>
          </div>

          {/* Board Grid */}
          <div className="relative flex-1 min-w-0 aspect-square rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 shadow-sm select-none">
            <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
              {orderedRanks.map((rankLabel, rIdx) =>
                orderedFiles.map((fileLabel, cIdx) => {
                  const sq = `${fileLabel}${rankLabel}` as Square;
                  const boardRow = RANKS.indexOf(rankLabel);
                  const boardCol = FILES.indexOf(fileLabel);
                  const isLight = (boardRow + boardCol) % 2 === 0;
                  const piece = board[boardRow]?.[boardCol] ?? null;

                  const isLastMoveFrom = currentMove?.from === sq;
                  const isLastMoveTo = currentMove?.to === sq;
                  const isInCheck = inCheckSquare === sq;

                  let squareBg = isLight ? 'bg-[#E8E0CE]' : 'bg-[#5B7562]';

                  if (isLastMoveFrom || isLastMoveTo) {
                    squareBg = isLight ? 'bg-[#E8D47C]' : 'bg-[#949B46]';
                  }
                  if (isInCheck) {
                    squareBg = 'bg-rose-600/85';
                  }

                  return (
                    <div
                      key={sq}
                      className={`relative flex items-center justify-center ${squareBg} transition-colors duration-150`}
                    >
                      {cIdx === 0 && (
                        <span
                          className={`absolute top-0.5 left-0.5 sm:left-1 text-[9px] sm:text-[10px] font-mono font-semibold leading-none ${
                            isLight ? 'text-[#5B7562]' : 'text-[#E8E0CE]'
                          }`}
                        >
                          {rankLabel}
                        </span>
                      )}
                      {rIdx === 7 && (
                        <span
                          className={`absolute bottom-0.5 right-0.5 sm:right-1 text-[9px] sm:text-[10px] font-mono font-semibold leading-none ${
                            isLight ? 'text-[#5B7562]' : 'text-[#E8E0CE]'
                          }`}
                        >
                          {fileLabel}
                        </span>
                      )}

                      {piece && (
                        <div className="w-[86%] h-[86%] flex items-center justify-center">
                          <ChessPieceSvg type={piece.type} color={piece.color} />
                        </div>
                      )}

                      {isLastMoveTo && classInfo && (
                        <span
                          title={classInfo.label}
                          className={`absolute -top-0.5 -right-0.5 z-20 px-1 min-w-[16px] sm:min-w-[18px] h-[16px] sm:h-[18px] rounded-bl-md flex items-center justify-center text-[9px] sm:text-[10px] font-mono font-bold shadow ${classInfo.bg}`}
                        >
                          {classInfo.symbol}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Best Move Arrow Overlay */}
            {arrowCoords && (
              <svg
                viewBox="0 0 800 800"
                className="absolute inset-0 w-full h-full pointer-events-none z-10"
              >
                <defs>
                  <marker
                    id="engine-arrowhead"
                    markerWidth="4.5"
                    markerHeight="4.5"
                    refX="2.3"
                    refY="2.25"
                    orient="auto"
                  >
                    <polygon points="0 0, 4.5 2.25, 0 4.5" fill="rgba(217, 119, 6, 0.9)" />
                  </marker>
                </defs>
                <line
                  x1={arrowCoords.x1}
                  y1={arrowCoords.y1}
                  x2={arrowCoords.x2}
                  y2={arrowCoords.y2}
                  stroke="rgba(217, 119, 6, 0.85)"
                  strokeWidth="16"
                  strokeLinecap="round"
                  markerEnd="url(#engine-arrowhead)"
                />
              </svg>
            )}
          </div>
        </div>

        {/* Bottom Player Strip */}
        <div className="flex items-center justify-between px-1 text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`w-3 h-3 rounded-sm border shrink-0 ${
                orientation === 'w'
                  ? 'bg-stone-100 border-stone-400'
                  : 'bg-slate-900 border-slate-600'
              }`}
            />
            <span className="font-medium truncate text-slate-900 dark:text-slate-100">
              {bottomPlayer.name}
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
              {bottomPlayer.elo}
            </span>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">{bottomPlayer.color}</span>
        </div>

        {/* Playback & Board Controls (Mobile >=44px touch targets) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-1 flex-1 sm:flex-initial">
            <button
              type="button"
              onClick={() => onGoToPly(0)}
              disabled={currentPly === 0}
              aria-label="Ir al inicio"
              className="min-h-[44px] min-w-[40px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors touch-manipulation"
            >
              <ChevronFirst className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onGoToPly(Math.max(0, currentPly - 1))}
              disabled={currentPly === 0}
              aria-label="Jugada anterior"
              className="min-h-[44px] min-w-[40px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors touch-manipulation"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onTogglePlay}
              aria-label={isPlaying ? 'Pausar reproducción' : 'Reproducir partida'}
              className="min-h-[44px] sm:min-h-[36px] px-3 flex-1 sm:flex-initial justify-center rounded-md bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 touch-manipulation"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlaying ? 'Pausar' : 'Reproducir'}</span>
            </button>
            <button
              type="button"
              onClick={() => onGoToPly(Math.min(totalPlies, currentPly + 1))}
              disabled={currentPly >= totalPlies}
              aria-label="Siguiente jugada"
              className="min-h-[44px] min-w-[40px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors touch-manipulation"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onGoToPly(totalPlies)}
              disabled={currentPly >= totalPlies}
              aria-label="Ir al final"
              className="min-h-[44px] min-w-[40px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors touch-manipulation"
            >
              <ChevronLast className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onToggleBestMoveArrow}
              className={`min-h-[44px] sm:min-h-[36px] px-3 rounded-md border text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 touch-manipulation ${
                showBestMoveArrow
                  ? 'border-amber-500/60 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {showBestMoveArrow ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>Flecha motor</span>
            </button>
            <button
              type="button"
              onClick={onFlip}
              aria-label="Girar tablero"
              className="min-h-[44px] sm:min-h-[36px] px-3 rounded-md border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 touch-manipulation"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Girar</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
);
