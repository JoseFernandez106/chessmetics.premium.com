import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Moon, Search, ShieldAlert, Sun } from 'lucide-react';
import { ChessBoardPanel } from './components/ChessBoardPanel.tsx';
import { CoachPanel } from './components/CoachPanel.tsx';
import { DiagnosticReportSection } from './components/DiagnosticReportSection.tsx';
import { MoveListPanel } from './components/MoveListPanel.tsx';
import { PlayerOverviewSection } from './components/PlayerOverviewSection.tsx';
import { TrendsAnalyticsSection } from './components/TrendsAnalyticsSection.tsx';
import type {
  ChessComGameSummary,
  ChessComPlayer,
  CoachPersona,
  FullGameAnalysis,
  LongTermTrends,
} from './types/chess.ts';

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const QUICK_USERNAMES = ['Hikaru', 'MagnusCarlsen', 'GothamChess', 'DanielNaroditsky'];

export default function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [usernameInput, setUsernameInput] = useState('Hikaru');
  const [loadingPlayer, setLoadingPlayer] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);

  const [player, setPlayer] = useState<ChessComPlayer | null>(null);
  const [games, setGames] = useState<ChessComGameSummary[]>([]);

  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [analyzingGameId, setAnalyzingGameId] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [gameAnalysis, setGameAnalysis] = useState<FullGameAnalysis | null>(null);

  const [currentPly, setCurrentPly] = useState(0);
  const [boardOrientation, setBoardOrientation] = useState<'w' | 'b'>('w');
  const [showBestMoveArrow, setShowBestMoveArrow] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  const [coachPersona, setCoachPersona] = useState<CoachPersona>('fusion');

  const [trends, setTrends] = useState<LongTermTrends | null>(null);
  const [loadingTrends, setLoadingTrends] = useState(false);
  const [trendsError, setTrendsError] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const gameCacheRef = useRef<Map<string, FullGameAnalysis>>(new Map());
  const accountAbortRef = useRef<AbortController | null>(null);
  const analysisAbortRef = useRef<AbortController | null>(null);
  const trendsAbortRef = useRef<AbortController | null>(null);

  // Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [darkMode]);

  const analyzeGame = useCallback(async (game: ChessComGameSummary) => {
    setSelectedGameId(game.id);
    setAnalysisError(null);
    setIsPlaying(false);

    // Instant 0ms switch if already analyzed in session cache
    const cached = gameCacheRef.current.get(game.id);
    if (cached) {
      setGameAnalysis(cached);
      setBoardOrientation(cached.playerColor);
      setCurrentPly(Math.min(10, cached.moves.length));
      setAnalyzingGameId(null);
      return;
    }

    analysisAbortRef.current?.abort();
    const controller = new AbortController();
    analysisAbortRef.current = controller;

    setAnalyzingGameId(game.id);

    try {
      const res = await fetch('/api/engine/analyze-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          gameId: game.id,
          pgn: game.pgn,
          whiteUsername: game.white.username,
          blackUsername: game.black.username,
          whiteElo: game.white.rating,
          blackElo: game.black.rating,
          playerColor: game.playerColor,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo analizar la partida.');
      }
      const parsed = data as FullGameAnalysis;
      if (gameCacheRef.current.size >= 30) {
        const oldest = gameCacheRef.current.keys().next().value;
        if (oldest) gameCacheRef.current.delete(oldest);
      }
      gameCacheRef.current.set(game.id, parsed);

      setGameAnalysis(parsed);
      setBoardOrientation(parsed.playerColor);
      setCurrentPly(Math.min(10, parsed.moves.length));
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setAnalysisError(err?.message || 'Error al analizar la partida.');
    } finally {
      if (analysisAbortRef.current === controller) {
        setAnalyzingGameId(null);
      }
    }
  }, []);

  const analyzeCustomPgn = useCallback(async (pgn: string) => {
    analysisAbortRef.current?.abort();
    const controller = new AbortController();
    analysisAbortRef.current = controller;

    setSelectedGameId('custom-pgn');
    setAnalyzingGameId('custom-pgn');
    setAnalysisError(null);
    setIsPlaying(false);

    try {
      const res = await fetch('/api/engine/analyze-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          gameId: 'custom-pgn',
          pgn,
          playerColor: 'w',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'PGN inválido.');
      }
      const parsed = data as FullGameAnalysis;
      setGameAnalysis(parsed);
      setBoardOrientation('w');
      setCurrentPly(Math.min(8, parsed.moves.length));
      document.getElementById('revision')?.scrollIntoView({ behavior: 'smooth' });
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setAnalysisError(err?.message || 'Error al procesar el PGN.');
    } finally {
      if (analysisAbortRef.current === controller) {
        setAnalyzingGameId(null);
      }
    }
  }, []);

  const computeTrends = useCallback(async (gamesList: ChessComGameSummary[]) => {
    if (gamesList.length === 0) return;
    trendsAbortRef.current?.abort();
    const controller = new AbortController();
    trendsAbortRef.current = controller;

    setLoadingTrends(true);
    setTrendsError(null);
    try {
      const res = await fetch('/api/engine/analyze-trends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ games: gamesList.slice(0, 10) }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error calculando tendencias.');
      }
      setTrends(data as LongTermTrends);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setTrendsError(err?.message || 'Error calculando tendencias.');
    } finally {
      if (trendsAbortRef.current === controller) {
        setLoadingTrends(false);
      }
    }
  }, []);

  const fetchChessComAccount = useCallback(
    async (targetUsername: string) => {
      const clean = targetUsername.trim();
      if (!clean) return;

      accountAbortRef.current?.abort();
      const controller = new AbortController();
      accountAbortRef.current = controller;

      setLoadingPlayer(true);
      setPlayerError(null);
      setTrends(null);

      try {
        const res = await fetch(`/api/chesscom/player/${encodeURIComponent(clean)}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'No se pudo cargar la cuenta de Chess.com.');
        }

        const fetchedPlayer = data.player as ChessComPlayer;
        const fetchedGames = (data.games || []) as ChessComGameSummary[];

        setPlayer(fetchedPlayer);
        setGames(fetchedGames);

        if (fetchedGames.length > 0) {
          await analyzeGame(fetchedGames[0]);
          void computeTrends(fetchedGames);
        } else {
          setGameAnalysis(null);
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        setPlayerError(err?.message || 'Error de red al consultar Chess.com.');
      } finally {
        if (accountAbortRef.current === controller) {
          setLoadingPlayer(false);
        }
      }
    },
    [analyzeGame, computeTrends]
  );

  // Load initial account on mount
  useEffect(() => {
    void fetchChessComAccount('Hikaru');
    return () => {
      accountAbortRef.current?.abort();
      analysisAbortRef.current?.abort();
      trendsAbortRef.current?.abort();
    };
  }, [fetchChessComAccount]);

  // Playback timer
  useEffect(() => {
    if (!isPlaying || !gameAnalysis) return;
    if (currentPly >= gameAnalysis.moves.length) {
      setIsPlaying(false);
      return;
    }
    const timer = setTimeout(() => {
      setCurrentPly((p) => Math.min(gameAnalysis.moves.length, p + 1));
    }, 900);
    return () => clearTimeout(timer);
  }, [isPlaying, currentPly, gameAnalysis]);

  // Keyboard navigation for moves
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (!gameAnalysis) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setIsPlaying(false);
        setCurrentPly((p) => Math.min(gameAnalysis.moves.length, p + 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setIsPlaying(false);
        setCurrentPly((p) => Math.max(0, p - 1));
      } else if (e.key === 'Home') {
        e.preventDefault();
        setIsPlaying(false);
        setCurrentPly(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setIsPlaying(false);
        setCurrentPly(gameAnalysis.moves.length);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameAnalysis]);

  const currentMove =
    gameAnalysis && currentPly > 0 ? gameAnalysis.moves[currentPly - 1] ?? null : null;
  const currentFen = currentMove ? currentMove.fenAfter : INITIAL_FEN;

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-900 dark:bg-[#0D1117] dark:text-[#E6EDF3] transition-colors">
      {/* Top Bar: 3-Zone Contract (Compact h-14 on mobile to respect 15% sticky cap) */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0D1117]/95 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-element Brand Wordmark */}
          <a
            href="#top"
            className="text-lg font-display font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0"
          >
            Tres Mentes
          </a>

          {/* Zone 2: 4 concise single-line nav links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-400">
            <a
              href="#resumen"
              className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors whitespace-nowrap shrink-0"
            >
              Resumen
            </a>
            <a
              href="#revision"
              className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors whitespace-nowrap shrink-0"
            >
              Revisión
            </a>
            <a
              href="#diagnostico"
              className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors whitespace-nowrap shrink-0"
            >
              Diagnóstico
            </a>
            <a
              href="#tendencias"
              className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors whitespace-nowrap shrink-0"
            >
              Tendencias
            </a>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                setTimeout(() => searchInputRef.current?.focus(), 200);
              }}
              className="px-4 py-2 text-xs font-semibold rounded-md bg-amber-600 hover:bg-amber-500 text-white transition-colors whitespace-nowrap shrink-0"
            >
              Buscar cuenta
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8 sm:space-y-10">
        {/* Adaptive Mobile Quick-Jump Strip (non-sticky) */}
        <nav
          aria-label="Navegación rápida móvil"
          className="flex md:hidden items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1"
        >
          {[
            { href: '#resumen', label: 'Resumen' },
            { href: '#revision', label: 'Tablero y Coach' },
            { href: '#diagnostico', label: 'Diagnóstico' },
            { href: '#tendencias', label: 'Tendencias' },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="min-h-[38px] px-3.5 py-2 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161B22] text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center whitespace-nowrap shrink-0"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Hero & Chess.com Account Lookup Toolbar */}
        <section className="space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
            <div className="max-w-2xl space-y-2">
              <h1 className="text-2xl sm:text-4xl font-display font-bold tracking-tight text-slate-900 dark:text-slate-100 text-balance">
                Domina el ajedrez con lo que ya sabes, partida a partida
              </h1>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
                Conecta tu usuario de Chess.com para revisar tus partidas con motor táctico, medir tu precisión histórica y entrenar tu plan de ataque con las mentes de Fischer, Carlsen y Kasparov.
              </p>
            </div>

            <div className="flex items-center gap-3 self-start lg:self-auto">
              <button
                type="button"
                onClick={() => setDarkMode((d) => !d)}
                aria-label="Cambiar tema claro u oscuro"
                className="min-h-[40px] px-3.5 py-2 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161B22] text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
              >
                {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                <span>{darkMode ? 'Modo claro' : 'Modo oscuro'}</span>
              </button>
            </div>
          </div>

          {/* Search Form */}
          <div className="bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 rounded-lg p-4 sm:p-5 space-y-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void fetchChessComAccount(usernameInput);
              }}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
            >
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="Ingresa tu nombre de usuario en Chess.com (ej. Hikaru)..."
                  className="w-full min-h-[44px] pl-10 pr-4 py-2.5 text-sm rounded-md bg-slate-50 dark:bg-[#0D1117] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
                />
              </div>
              <button
                type="submit"
                disabled={loadingPlayer || !usernameInput.trim()}
                className="min-h-[44px] px-5 py-2.5 rounded-md bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
              >
                {loadingPlayer ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                <span>{loadingPlayer ? 'Consultando...' : 'Buscar en Chess.com'}</span>
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>Cuentas de ejemplo:</span>
              {QUICK_USERNAMES.map((u, idx) => (
                <React.Fragment key={u}>
                  <button
                    type="button"
                    onClick={() => {
                      setUsernameInput(u);
                      void fetchChessComAccount(u);
                    }}
                    className="py-1 font-medium text-slate-700 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 underline-offset-4 hover:underline transition-colors"
                  >
                    {u}
                  </button>
                  {idx < QUICK_USERNAMES.length - 1 && <span aria-hidden="true">·</span>}
                </React.Fragment>
              ))}
            </div>

            {playerError && (
              <div className="p-3.5 rounded-md border border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{playerError}</span>
              </div>
            )}
          </div>
        </section>

        {/* Loading Skeleton when switching accounts */}
        {loadingPlayer && !player && (
          <div className="space-y-4">
            <div className="h-44 rounded-lg bg-slate-200 dark:bg-slate-800/60 animate-pulse" />
            <div className="h-72 rounded-lg bg-slate-200 dark:bg-slate-800/60 animate-pulse" />
          </div>
        )}

        {/* Section 1: Chess.com Account Stats, Percentile, W/D/L & Recent Games */}
        {player && (
          <PlayerOverviewSection
            player={player}
            games={games}
            selectedGameId={selectedGameId}
            analyzingGameId={analyzingGameId}
            onAnalyzeGame={(g) => {
              void analyzeGame(g);
              document.getElementById('revision')?.scrollIntoView({ behavior: 'smooth' });
            }}
            onAnalyzeCustomPgn={analyzeCustomPgn}
          />
        )}

        {/* Section 2: Interactive Game Review, Engine Board & AI Three-Minds Coach */}
        <section id="revision" className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tablero de análisis táctico · Navega con botones o flechas del teclado (← / →)
              </p>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                Revisión de Partida y Coaching Interactivo
              </h2>
            </div>
            {analyzingGameId && (
              <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 font-medium">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Evaluando todas las jugadas con el motor...</span>
              </div>
            )}
          </div>

          {analysisError && (
            <div className="p-4 rounded-md border border-rose-500/40 bg-rose-500/10 text-xs text-rose-600 dark:text-rose-300">
              {analysisError}
            </div>
          )}

          {gameAnalysis ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-6 xl:col-span-5 bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 sm:p-5">
                <ChessBoardPanel
                  fen={currentFen}
                  orientation={boardOrientation}
                  onFlip={() => setBoardOrientation((o) => (o === 'w' ? 'b' : 'w'))}
                  currentMove={currentMove}
                  showBestMoveArrow={showBestMoveArrow}
                  onToggleBestMoveArrow={() => setShowBestMoveArrow((v) => !v)}
                  whiteUsername={gameAnalysis.whiteUsername}
                  blackUsername={gameAnalysis.blackUsername}
                  whiteElo={gameAnalysis.whiteElo}
                  blackElo={gameAnalysis.blackElo}
                  currentPly={currentPly}
                  totalPlies={gameAnalysis.moves.length}
                  isPlaying={isPlaying}
                  onTogglePlay={() => {
                    if (currentPly >= gameAnalysis.moves.length) {
                      setCurrentPly(0);
                    }
                    setIsPlaying((p) => !p);
                  }}
                  onGoToPly={(ply) => {
                    setIsPlaying(false);
                    setCurrentPly(ply);
                  }}
                />
              </div>

              <div className="lg:col-span-6 xl:col-span-7 flex flex-col gap-6 min-w-0">
                <MoveListPanel
                  moves={gameAnalysis.moves}
                  currentPly={currentPly}
                  onSelectPly={(ply) => {
                    setIsPlaying(false);
                    setCurrentPly(ply);
                  }}
                  openingName={gameAnalysis.openingName}
                  eco={gameAnalysis.eco}
                />

                <CoachPanel
                  fen={currentFen}
                  currentMove={currentMove}
                  playerColor={gameAnalysis.playerColor}
                  openingName={gameAnalysis.openingName}
                  persona={coachPersona}
                  onSelectPersona={setCoachPersona}
                />
              </div>
            </div>
          ) : (
            <div className="p-10 text-center bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 rounded-lg">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Busca una cuenta de Chess.com o pega un PGN para iniciar el análisis del tablero.
              </p>
            </div>
          )}
        </section>

        {/* Section 3: Dedicated Post-Game Diagnostic Report */}
        {gameAnalysis && (
          <DiagnosticReportSection
            report={gameAnalysis.report}
            whiteUsername={gameAnalysis.whiteUsername}
            blackUsername={gameAnalysis.blackUsername}
            whiteElo={gameAnalysis.whiteElo}
            blackElo={gameAnalysis.blackElo}
            playerColor={gameAnalysis.playerColor}
            onJumpToPly={(ply) => {
              setIsPlaying(false);
              setCurrentPly(ply);
              document.getElementById('revision')?.scrollIntoView({ behavior: 'smooth' });
            }}
          />
        )}

        {/* Section 4: Long-Term Precision & Tactical Trends */}
        {player && (
          <TrendsAnalyticsSection
            trends={trends}
            loading={loadingTrends}
            error={trendsError}
            onRefreshTrends={() => void computeTrends(games)}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>Tres Mentes Ajedrez · Entrenamiento estratégico y análisis de Chess.com</span>
          <span>Datos obtenidos de la API pública de Chess.com</span>
        </div>
      </footer>
    </div>
  );
}
