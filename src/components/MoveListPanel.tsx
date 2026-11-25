import React, { useEffect, useMemo, useRef } from 'react';
import type { AnalyzedMove, MoveClassification } from '../types/chess.ts';

interface MoveListPanelProps {
  moves: AnalyzedMove[];
  currentPly: number;
  onSelectPly: (ply: number) => void;
  openingName: string;
  eco: string;
}

const CLASSIFICATION_STYLES: Record<
  MoveClassification,
  { tag: string; textClass: string; label: string }
> = {
  brillante: { tag: '!!', textClass: 'text-cyan-500 dark:text-cyan-400 font-semibold', label: 'Brillante' },
  optima: { tag: '', textClass: 'text-emerald-600 dark:text-emerald-400', label: 'Óptima' },
  buena: { tag: '', textClass: 'text-slate-800 dark:text-slate-200', label: 'Buena' },
  libro: { tag: '', textClass: 'text-amber-600 dark:text-amber-400', label: 'Libro' },
  imprecision: { tag: '?!', textClass: 'text-amber-500 dark:text-amber-400', label: 'Imprecisión' },
  error: { tag: '?', textClass: 'text-orange-500 dark:text-orange-400 font-medium', label: 'Error' },
  grave: { tag: '??', textClass: 'text-rose-600 dark:text-rose-400 font-semibold', label: 'Error grave' },
};

export const MoveListPanel: React.FC<MoveListPanelProps> = ({
  moves,
  currentPly,
  onSelectPly,
  openingName,
  eco,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const pairs = useMemo(() => {
    const rows: Array<{ moveNumber: number; white?: AnalyzedMove; black?: AnalyzedMove }> = [];
    for (let i = 0; i < moves.length; i += 2) {
      rows.push({
        moveNumber: Math.floor(i / 2) + 1,
        white: moves[i],
        black: moves[i + 1],
      });
    }
    return rows;
  }, [moves]);

  // Keep active move visible strictly inside the move-list container (never scrolling page)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || currentPly <= 0) return;
    const activeEl = container.querySelector<HTMLElement>(`[data-ply="${currentPly}"]`);
    if (!activeEl) return;

    const top = activeEl.offsetTop;
    const bottom = top + activeEl.offsetHeight;
    const viewTop = container.scrollTop;
    const viewBottom = viewTop + container.clientHeight;

    if (top < viewTop) {
      container.scrollTop = Math.max(0, top - 8);
    } else if (bottom > viewBottom) {
      container.scrollTop = bottom - container.clientHeight + 8;
    }
  }, [currentPly]);

  // SVG Advantage Profile across plies
  const evalGraph = useMemo(() => {
    if (moves.length === 0) return null;
    const width = 400;
    const height = 72;
    const mid = height / 2;

    const points = moves.map((m, idx) => {
      const x = moves.length === 1 ? width : (idx / (moves.length - 1)) * width;
      const clamped = Math.max(-700, Math.min(700, m.evalAfterCp));
      const y = mid - (clamped / 700) * (mid - 6);
      return { x, y, ply: m.ply };
    });

    const linePath = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');
    const areaPath = `${linePath} L ${width} ${mid} L 0 ${mid} Z`;

    const activePoint =
      currentPly > 0 && currentPly <= points.length ? points[currentPly - 1] : null;

    return { width, height, mid, linePath, areaPath, activePoint };
  }, [moves, currentPly]);

  const currentMove = currentPly > 0 ? moves[currentPly - 1] : null;

  return (
    <div className="flex flex-col bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
      {/* Opening Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            <span>Apertura detectada</span>
            <span aria-hidden="true" className="mx-1.5">·</span>
            <span className="font-mono">{eco}</span>
          </div>
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
            {openingName}
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            Jugada {currentPly} / {moves.length}
          </span>
        </div>
      </div>

      {/* Engine Evaluation Graph */}
      {evalGraph && (
        <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0F141A]">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 mb-1.5">
            <span>Perfil de evaluación</span>
            {currentMove ? (
              <span className="font-mono tabular-nums truncate max-w-full">
                {currentMove.moveNumber}
                {currentMove.color === 'w' ? '.' : '...'} {currentMove.san} ·{' '}
                {CLASSIFICATION_STYLES[currentMove.classification].label}
                {currentMove.bestMoveSan && currentMove.bestMoveSan !== currentMove.san
                  ? ` · Motor: ${currentMove.bestMoveSan}`
                  : ''}
              </span>
            ) : (
              <span className="font-mono">Posición inicial</span>
            )}
          </div>
          <svg
            viewBox={`0 0 ${evalGraph.width} ${evalGraph.height}`}
            className="w-full h-16 cursor-pointer rounded bg-slate-900/90 dark:bg-[#0A0D12] touch-manipulation"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              const targetPly = Math.max(1, Math.round(ratio * moves.length));
              onSelectPly(targetPly);
            }}
          >
            <line
              x1="0"
              y1={evalGraph.mid}
              x2={evalGraph.width}
              y2={evalGraph.mid}
              stroke="rgba(148,163,184,0.25)"
              strokeDasharray="3 3"
            />
            <path d={evalGraph.areaPath} fill="rgba(237, 232, 220, 0.22)" />
            <path
              d={evalGraph.linePath}
              fill="none"
              stroke="#E8E0CE"
              strokeWidth="1.8"
            />
            {evalGraph.activePoint && (
              <>
                <line
                  x1={evalGraph.activePoint.x}
                  y1="0"
                  x2={evalGraph.activePoint.x}
                  y2={evalGraph.height}
                  stroke="#D97706"
                  strokeWidth="1.5"
                />
                <circle
                  cx={evalGraph.activePoint.x}
                  cy={evalGraph.activePoint.y}
                  r="4"
                  fill="#D97706"
                  stroke="#0D1117"
                  strokeWidth="1.5"
                />
              </>
            )}
          </svg>
        </div>
      )}

      {/* Algebraic Move Grid */}
      <div
        ref={scrollContainerRef}
        className="relative min-h-[200px] max-h-[260px] sm:max-h-[320px] overflow-y-auto chess-scroll divide-y divide-slate-100 dark:divide-slate-800/70"
      >
        {pairs.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
            No hay jugadas registradas en esta partida.
          </div>
        ) : (
          pairs.map((row) => (
            <div
              key={row.moveNumber}
              className="grid grid-cols-[42px_1fr_1fr] items-center text-sm font-mono tabular-nums"
            >
              <div className="px-3 py-2 sm:py-1.5 text-xs text-slate-400 dark:text-slate-500 select-none">
                {row.moveNumber}.
              </div>

              {row.white ? (
                <button
                  type="button"
                  data-ply={row.white.ply}
                  onClick={() => onSelectPly(row.white!.ply)}
                  className={`px-3 py-2 sm:py-1.5 text-left flex items-center justify-between transition-colors ${
                    currentPly === row.white.ply
                      ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800/70'
                  }`}
                >
                  <span className={CLASSIFICATION_STYLES[row.white.classification].textClass}>
                    {row.white.san}
                    {CLASSIFICATION_STYLES[row.white.classification].tag}
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    {(row.white.evalAfterCp / 100).toFixed(1)}
                  </span>
                </button>
              ) : (
                <div />
              )}

              {row.black ? (
                <button
                  type="button"
                  data-ply={row.black.ply}
                  onClick={() => onSelectPly(row.black!.ply)}
                  className={`px-3 py-2 sm:py-1.5 text-left flex items-center justify-between transition-colors ${
                    currentPly === row.black.ply
                      ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800/70'
                  }`}
                >
                  <span className={CLASSIFICATION_STYLES[row.black.classification].textClass}>
                    {row.black.san}
                    {CLASSIFICATION_STYLES[row.black.classification].tag}
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    {(row.black.evalAfterCp / 100).toFixed(1)}
                  </span>
                </button>
              ) : (
                <div />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
