import { Chess, Move, PieceSymbol, Square } from 'chess.js';
import type {
  AnalyzedMove,
  ChessComGameSummary,
  DiagnosticReport,
  FullGameAnalysis,
  GamePhase,
  GameTrendPoint,
  LongTermTrends,
  MoveClassification,
} from '../types/chess.ts';

const MATE_SCORE = 30000;

const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// Piece-square tables from White's perspective (rank 8 at index 0, rank 1 at index 7)
const PAWN_PST = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5, 5, 10, 27, 27, 10, 5, 5],
  [0, 0, 0, 24, 24, 0, 0, 0],
  [5, -5, -10, 0, 0, -10, -5, 5],
  [5, 10, 10, -22, -22, 10, 10, 5],
  [0, 0, 0, 0, 0, 0, 0, 0],
];

const KNIGHT_PST = [
  [-50, -40, -30, -30, -30, -30, -40, -50],
  [-40, -20, 0, 0, 0, 0, -20, -40],
  [-30, 0, 12, 16, 16, 12, 0, -30],
  [-30, 5, 16, 22, 22, 16, 5, -30],
  [-30, 0, 16, 22, 22, 16, 0, -30],
  [-30, 5, 12, 16, 16, 12, 5, -30],
  [-40, -20, 0, 5, 5, 0, -20, -40],
  [-50, -40, -30, -30, -30, -30, -40, -50],
];

const BISHOP_PST = [
  [-20, -10, -10, -10, -10, -10, -10, -20],
  [-10, 0, 0, 0, 0, 0, 0, -10],
  [-10, 0, 8, 12, 12, 8, 0, -10],
  [-10, 6, 6, 12, 12, 6, 6, -10],
  [-10, 0, 12, 12, 12, 12, 0, -10],
  [-10, 10, 10, 10, 10, 10, 10, -10],
  [-10, 6, 0, 0, 0, 0, 6, -10],
  [-20, -10, -10, -10, -10, -10, -10, -20],
];

const ROOK_PST = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [6, 12, 12, 12, 12, 12, 12, 6],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [0, 0, 4, 8, 8, 4, 0, 0],
];

const QUEEN_PST = [
  [-20, -10, -10, -5, -5, -10, -10, -20],
  [-10, 0, 0, 0, 0, 0, 0, -10],
  [-10, 0, 6, 6, 6, 6, 0, -10],
  [-5, 0, 6, 6, 6, 6, 0, -5],
  [0, 0, 6, 6, 6, 6, 0, -5],
  [-10, 5, 6, 6, 6, 6, 0, -10],
  [-10, 0, 5, 0, 0, 0, 0, -10],
  [-20, -10, -10, -5, -5, -10, -10, -20],
];

const KING_MG_PST = [
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-20, -30, -30, -40, -40, -30, -30, -20],
  [-10, -20, -20, -20, -20, -20, -20, -10],
  [20, 20, 0, 0, 0, 0, 20, 20],
  [20, 32, 12, 0, 0, 12, 32, 20],
];

const KING_EG_PST = [
  [-50, -40, -30, -20, -20, -30, -40, -50],
  [-30, -20, -10, 0, 0, -10, -20, -30],
  [-30, -10, 20, 30, 30, 20, -10, -30],
  [-30, -10, 30, 40, 40, 30, -10, -30],
  [-30, -10, 30, 40, 40, 30, -10, -30],
  [-30, -10, 20, 30, 30, 20, -10, -30],
  [-30, -30, 0, 0, 0, 0, -30, -30],
  [-50, -30, -30, -30, -30, -30, -30, -50],
];

function evaluateBoardStatic(chess: Chess): number {
  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? -MATE_SCORE : MATE_SCORE;
  }
  if (chess.isDraw()) {
    return 0;
  }

  const board = chess.board();
  let whiteNonPawn = 0;
  let blackNonPawn = 0;
  let whiteBishops = 0;
  let blackBishops = 0;

  const whitePawnFiles = new Array<number>(8).fill(0);
  const blackPawnFiles = new Array<number>(8).fill(0);

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = board[r][c];
      if (!cell) continue;
      if (cell.type !== 'p' && cell.type !== 'k') {
        if (cell.color === 'w') whiteNonPawn += PIECE_VALUES[cell.type];
        else blackNonPawn += PIECE_VALUES[cell.type];
      }
      if (cell.type === 'b') {
        if (cell.color === 'w') whiteBishops++;
        else blackBishops++;
      }
      if (cell.type === 'p') {
        if (cell.color === 'w') whitePawnFiles[c]++;
        else blackPawnFiles[c]++;
      }
    }
  }

  const totalNonPawn = whiteNonPawn + blackNonPawn;
  // Tapered phase: 1 = opening/middlegame, 0 = endgame
  const mgWeight = Math.min(1, totalNonPawn / 5400);
  const egWeight = 1 - mgWeight;

  let score = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = board[r][c];
      if (!cell) continue;

      const isWhite = cell.color === 'w';
      const pstRow = isWhite ? r : 7 - r;
      let val = PIECE_VALUES[cell.type];

      switch (cell.type) {
        case 'p':
          val += PAWN_PST[pstRow][c];
          // Doubled pawn penalty
          if (isWhite && whitePawnFiles[c] > 1) val -= 12;
          if (!isWhite && blackPawnFiles[c] > 1) val -= 12;
          // Isolated pawn penalty
          if (
            isWhite &&
            (c === 0 || whitePawnFiles[c - 1] === 0) &&
            (c === 7 || whitePawnFiles[c + 1] === 0)
          ) {
            val -= 14;
          }
          if (
            !isWhite &&
            (c === 0 || blackPawnFiles[c - 1] === 0) &&
            (c === 7 || blackPawnFiles[c + 1] === 0)
          ) {
            val -= 14;
          }
          // Passed pawn bonus in endgame/middlegame
          if (isWhite && blackPawnFiles[c] === 0) {
            val += Math.round((6 - r) * (6 + egWeight * 12));
          }
          if (!isWhite && whitePawnFiles[c] === 0) {
            val += Math.round((r - 1) * (6 + egWeight * 12));
          }
          break;
        case 'n':
          val += KNIGHT_PST[pstRow][c];
          break;
        case 'b':
          val += BISHOP_PST[pstRow][c];
          break;
        case 'r':
          val += ROOK_PST[pstRow][c];
          // Rook on open or semi-open file
          if (isWhite) {
            if (whitePawnFiles[c] === 0 && blackPawnFiles[c] === 0) val += 20;
            else if (whitePawnFiles[c] === 0) val += 10;
          } else {
            if (blackPawnFiles[c] === 0 && whitePawnFiles[c] === 0) val += 20;
            else if (blackPawnFiles[c] === 0) val += 10;
          }
          break;
        case 'q':
          val += QUEEN_PST[pstRow][c];
          break;
        case 'k':
          val += Math.round(
            KING_MG_PST[pstRow][c] * mgWeight + KING_EG_PST[pstRow][c] * egWeight
          );
          break;
      }

      score += isWhite ? val : -val;
    }
  }

  // Bishop pair bonus
  if (whiteBishops >= 2) score += 32;
  if (blackBishops >= 2) score -= 32;

  return score;
}

function scoreMoveOrder(move: Move): number {
  let score = 0;
  if (move.captured) {
    // MVV-LVA
    score += 10 * PIECE_VALUES[move.captured] - PIECE_VALUES[move.piece];
  }
  if (move.promotion) {
    score += PIECE_VALUES[move.promotion];
  }
  if (move.san.includes('+')) {
    score += 65;
  }
  if (move.san === 'O-O' || move.san === 'O-O-O') {
    score += 55;
  }
  return score;
}

interface SearchContext {
  nodes: number;
  maxNodes: number;
}

function quiescence(
  chess: Chess,
  alpha: number,
  beta: number,
  maximizing: boolean,
  qDepth: number,
  ctx: SearchContext
): number {
  ctx.nodes++;
  const standPat = evaluateBoardStatic(chess);

  if (qDepth <= 0 || chess.isGameOver() || ctx.nodes >= ctx.maxNodes) {
    return standPat;
  }

  if (maximizing) {
    if (standPat >= beta) return beta;
    if (alpha < standPat) alpha = standPat;

    const moves = chess
      .moves({ verbose: true })
      .filter((m) => m.captured || m.promotion)
      .sort((a, b) => scoreMoveOrder(b) - scoreMoveOrder(a));

    for (const m of moves) {
      chess.move(m);
      const score = quiescence(chess, alpha, beta, false, qDepth - 1, ctx);
      chess.undo();
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  } else {
    if (standPat <= alpha) return alpha;
    if (beta > standPat) beta = standPat;

    const moves = chess
      .moves({ verbose: true })
      .filter((m) => m.captured || m.promotion)
      .sort((a, b) => scoreMoveOrder(b) - scoreMoveOrder(a));

    for (const m of moves) {
      chess.move(m);
      const score = quiescence(chess, alpha, beta, true, qDepth - 1, ctx);
      chess.undo();
      if (score <= alpha) return alpha;
      if (score < beta) beta = score;
    }
    return beta;
  }
}

function alphabeta(
  chess: Chess,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  plyFromRoot: number,
  ctx: SearchContext
): { score: number; pv: Move[] } {
  ctx.nodes++;

  if (chess.isCheckmate()) {
    return {
      score: chess.turn() === 'w' ? -MATE_SCORE + plyFromRoot : MATE_SCORE - plyFromRoot,
      pv: [],
    };
  }
  if (chess.isDraw()) {
    return { score: 0, pv: [] };
  }
  if (depth <= 0 || ctx.nodes >= ctx.maxNodes) {
    const qScore = quiescence(chess, alpha, beta, maximizing, 3, ctx);
    return { score: qScore, pv: [] };
  }

  const moves = chess.moves({ verbose: true }).sort((a, b) => scoreMoveOrder(b) - scoreMoveOrder(a));
  if (moves.length === 0) {
    return { score: evaluateBoardStatic(chess), pv: [] };
  }

  let bestPv: Move[] = [];

  if (maximizing) {
    let maxEval = -Infinity;
    for (const m of moves) {
      chess.move(m);
      const res = alphabeta(chess, depth - 1, alpha, beta, false, plyFromRoot + 1, ctx);
      chess.undo();

      if (res.score > maxEval) {
        maxEval = res.score;
        bestPv = [m, ...res.pv];
      }
      if (res.score > alpha) alpha = res.score;
      if (beta <= alpha) break;
    }
    return { score: maxEval, pv: bestPv };
  } else {
    let minEval = Infinity;
    for (const m of moves) {
      chess.move(m);
      const res = alphabeta(chess, depth - 1, alpha, beta, true, plyFromRoot + 1, ctx);
      chess.undo();

      if (res.score < minEval) {
        minEval = res.score;
        bestPv = [m, ...res.pv];
      }
      if (res.score < beta) beta = res.score;
      if (beta <= alpha) break;
    }
    return { score: minEval, pv: bestPv };
  }
}

export interface PositionEvaluation {
  evalCp: number;
  mateIn: number | null;
  bestMoveSan: string;
  bestMoveFrom: string;
  bestMoveTo: string;
  pvSan: string[];
}

export function evaluatePosition(
  fen: string,
  depth = 3,
  maxNodes = 4000
): PositionEvaluation {
  const chess = new Chess(fen);
  const legal = chess.moves({ verbose: true });

  if (legal.length === 0) {
    const evalCp = evaluateBoardStatic(chess);
    return {
      evalCp,
      mateIn: chess.isCheckmate() ? (chess.turn() === 'w' ? -1 : 1) : null,
      bestMoveSan: '',
      bestMoveFrom: '',
      bestMoveTo: '',
      pvSan: [],
    };
  }

  const effectiveDepth = legal.length > 36 && depth > 2 ? 2 : depth;
  const ctx: SearchContext = { nodes: 0, maxNodes };
  const maximizing = chess.turn() === 'w';
  const result = alphabeta(
    chess,
    effectiveDepth,
    -Infinity,
    Infinity,
    maximizing,
    0,
    ctx
  );

  const bestMove = result.pv[0] ?? legal[0];
  let mateIn: number | null = null;
  if (Math.abs(result.score) > MATE_SCORE - 100) {
    const plies = MATE_SCORE - Math.abs(result.score);
    const movesToMate = Math.max(1, Math.ceil(plies / 2));
    mateIn = result.score > 0 ? movesToMate : -movesToMate;
  }

  return {
    evalCp: Math.max(-2500, Math.min(2500, result.score)),
    mateIn,
    bestMoveSan: bestMove.san,
    bestMoveFrom: bestMove.from,
    bestMoveTo: bestMove.to,
    pvSan: result.pv.map((m) => m.san),
  };
}

function getGamePhase(chess: Chess, ply: number): GamePhase {
  if (ply <= 14) {
    const board = chess.board();
    let minorMajorCount = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.type !== 'p' && p.type !== 'k') minorMajorCount++;
      }
    }
    if (minorMajorCount >= 11) return 'apertura';
  }

  const board = chess.board();
  let nonPawnMaterial = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.type !== 'p' && p.type !== 'k') {
        nonPawnMaterial += PIECE_VALUES[p.type];
      }
    }
  }
  if (nonPawnMaterial <= 2600) return 'final';
  return 'mediojuego';
}

function cpToWinProb(cp: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

function accuracyFromWinProbLoss(winProbLoss: number): number {
  const clamped = Math.max(0, winProbLoss - 1.2);
  const acc = 103.1668 * Math.exp(-0.04354 * clamped) - 3.1669;
  return Math.max(5, Math.min(100, acc));
}

function classifyMove(
  cpLoss: number,
  ply: number,
  isSacrifice: boolean,
  playedBest: boolean,
  evalAfterForMover: number
): MoveClassification {
  if (ply <= 8 && cpLoss <= 35) {
    return 'libro';
  }
  if (isSacrifice && cpLoss <= 35 && evalAfterForMover >= -40) {
    return 'brillante';
  }
  if (playedBest || cpLoss <= 15) {
    return 'optima';
  }
  if (cpLoss <= 45) {
    return 'buena';
  }
  if (cpLoss <= 105) {
    return 'imprecision';
  }
  if (cpLoss <= 220) {
    return 'error';
  }
  return 'grave';
}

function countMaterial(chess: Chess, color: 'w' | 'b'): number {
  const board = chess.board();
  let sum = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = board[r][c];
      if (cell && cell.color === color && cell.type !== 'k') {
        sum += PIECE_VALUES[cell.type];
      }
    }
  }
  return sum;
}

export function extractOpeningFromPgn(pgn: string): { openingName: string; eco: string } {
  const ecoMatch = pgn.match(/\[ECO\s+"([^"]+)"\]/);
  const ecoUrlMatch = pgn.match(/\[ECOUrl\s+"https?:\/\/[^/]+\/openings\/([^"]+)"\]/);
  const openingTagMatch = pgn.match(/\[Opening\s+"([^"]+)"\]/);

  const eco = ecoMatch?.[1] ?? '—';
  let openingName = openingTagMatch?.[1] ?? '';

  if (!openingName && ecoUrlMatch?.[1]) {
    openingName = decodeURIComponent(ecoUrlMatch[1])
      .replace(/\.\.\./g, ' ')
      .replace(/-/g, ' ')
      .replace(/\b\d+\b.*$/, '')
      .trim();
  }

  return {
    eco,
    openingName: openingName || 'Apertura Clásica / Variada',
  };
}

const yieldEventLoop = (): Promise<void> =>
  new Promise((resolve) => setImmediate(resolve));

export async function analyzeFullGame(params: {
  gameId: string;
  pgn: string;
  whiteUsername?: string;
  blackUsername?: string;
  whiteElo?: number;
  blackElo?: number;
  playerColor?: 'w' | 'b';
}): Promise<FullGameAnalysis> {
  const parser = new Chess();
  parser.loadPgn(params.pgn);

  const headers = parser.getHeaders();
  const whiteUsername = params.whiteUsername || headers.White || 'Blancas';
  const blackUsername = params.blackUsername || headers.Black || 'Negras';
  const whiteElo = params.whiteElo || parseInt(headers.WhiteElo || '1200', 10) || 1200;
  const blackElo = params.blackElo || parseInt(headers.BlackElo || '1200', 10) || 1200;
  const playerColor = params.playerColor || 'w';
  const { openingName, eco } = extractOpeningFromPgn(params.pgn);

  const history = parser.history({ verbose: true });
  const replay = new Chess();

  const analyzedMoves: AnalyzedMove[] = [];
  let cachedBeforeEval: PositionEvaluation | null = null;

  for (let i = 0; i < history.length; i++) {
    const move = history[i];
    const ply = i + 1;
    const fenBefore = replay.fen();
    const evalBefore =
      cachedBeforeEval ?? evaluatePosition(fenBefore, 2, 2600);

    const matMoverBefore = countMaterial(replay, move.color);
    const matOppBefore = countMaterial(replay, move.color === 'w' ? 'b' : 'w');

    replay.move(move);
    const fenAfter = replay.fen();

    const evalAfter = evaluatePosition(fenAfter, 2, 2600);
    cachedBeforeEval = evalAfter;

    const moverSign = move.color === 'w' ? 1 : -1;
    const beforeForMover = evalBefore.evalCp * moverSign;
    const afterForMover = evalAfter.evalCp * moverSign;
    const cpLoss = Math.max(0, Math.round(beforeForMover - afterForMover));

    // Check if move involved a genuine material sacrifice (lost >= 150cp material on board)
    const matMoverAfter = countMaterial(replay, move.color);
    const matOppAfter = countMaterial(replay, move.color === 'w' ? 'b' : 'w');
    const netMatChange = (matMoverAfter - matMoverBefore) - (matOppAfter - matOppBefore);
    const oppAttacksDest = replay.isAttacked(move.to as Square, move.color === 'w' ? 'b' : 'w');
    const isSacrifice =
      (netMatChange <= -180 || (oppAttacksDest && PIECE_VALUES[move.piece] >= 320 && !move.captured)) &&
      ply > 8;

    const playedBest =
      evalBefore.bestMoveSan === move.san ||
      (evalBefore.bestMoveFrom === move.from && evalBefore.bestMoveTo === move.to);

    const classification = classifyMove(
      cpLoss,
      ply,
      isSacrifice,
      playedBest,
      afterForMover
    );

    const phase = getGamePhase(replay, ply);

    analyzedMoves.push({
      ply,
      moveNumber: Math.floor(i / 2) + 1,
      color: move.color,
      san: move.san,
      from: move.from,
      to: move.to,
      fenBefore,
      fenAfter,
      evalBeforeCp: evalBefore.evalCp,
      evalAfterCp: evalAfter.evalCp,
      mateIn: evalAfter.mateIn,
      bestMoveSan: evalBefore.bestMoveSan,
      bestMoveFrom: evalBefore.bestMoveFrom,
      bestMoveTo: evalBefore.bestMoveTo,
      pvSan: evalBefore.pvSan,
      cpLoss,
      classification,
      phase,
      isSacrifice,
      isCheck: move.san.includes('+'),
      isCapture: Boolean(move.captured),
    });

    if (i % 6 === 5) {
      await yieldEventLoop();
    }
  }

  // Build accuracy & diagnostics
  const calcAccuracy = (moves: AnalyzedMove[]) => {
    if (moves.length === 0) return 100;
    let sum = 0;
    for (const m of moves) {
      if (m.classification === 'libro') {
        sum += 96.5;
        continue;
      }
      const sign = m.color === 'w' ? 1 : -1;
      const wpBefore = cpToWinProb(m.evalBeforeCp * sign);
      const wpAfter = cpToWinProb(m.evalAfterCp * sign);
      sum += accuracyFromWinProbLoss(wpBefore - wpAfter);
    }
    return Number((sum / moves.length).toFixed(1));
  };

  const whiteMoves = analyzedMoves.filter((m) => m.color === 'w');
  const blackMoves = analyzedMoves.filter((m) => m.color === 'b');
  const playerMoves = analyzedMoves.filter((m) => m.color === playerColor);

  const whiteAccuracy = calcAccuracy(whiteMoves);
  const blackAccuracy = calcAccuracy(blackMoves);
  const playerAccuracy = playerColor === 'w' ? whiteAccuracy : blackAccuracy;

  const whiteAcpl = whiteMoves.length
    ? Math.round(whiteMoves.reduce((s, m) => s + m.cpLoss, 0) / whiteMoves.length)
    : 0;
  const blackAcpl = blackMoves.length
    ? Math.round(blackMoves.reduce((s, m) => s + m.cpLoss, 0) / blackMoves.length)
    : 0;

  const counts: Record<MoveClassification, number> = {
    brillante: 0,
    optima: 0,
    buena: 0,
    imprecision: 0,
    error: 0,
    grave: 0,
    libro: 0,
  };
  for (const m of playerMoves) {
    counts[m.classification]++;
  }

  // Phase metrics for the player
  const openingMoves = playerMoves.filter((m) => m.phase === 'apertura');
  const middlegameMoves = playerMoves.filter((m) => m.phase === 'mediojuego');
  const endgameMoves = playerMoves.filter((m) => m.phase === 'final');
  const tacticalMoves = playerMoves.filter(
    (m) => m.isCapture || m.isCheck || m.cpLoss >= 90 || m.classification === 'brillante'
  );

  const aperturaPrecision = calcAccuracy(openingMoves);
  const estrategiaPrecision = calcAccuracy(middlegameMoves.length ? middlegameMoves : playerMoves);
  const tacticaPrecision = calcAccuracy(tacticalMoves.length ? tacticalMoves : playerMoves);
  const endgameReached = endgameMoves.length >= 2;
  const finalesPrecision = endgameReached ? calcAccuracy(endgameMoves) : null;

  const sharpMoments = tacticalMoves.length;
  const tacticalFound = tacticalMoves.filter(
    (m) => m.classification === 'brillante' || m.classification === 'optima' || m.classification === 'buena'
  ).length;
  const tacticalMissed = sharpMoments - tacticalFound;

  const brillantesList = playerMoves
    .filter((m) => m.classification === 'brillante')
    .map((m) => ({
      ply: m.ply,
      moveNumber: m.moveNumber,
      color: m.color,
      san: m.san,
    }));

  const eloPromedio = Math.round((whiteElo + blackElo) / 2);

  let turningPoint: DiagnosticReport['turningPoint'] = null;
  let maxSwing = 0;
  for (const m of analyzedMoves) {
    const swing = Math.abs(m.evalAfterCp - m.evalBeforeCp);
    if (swing > maxSwing && m.ply > 4) {
      maxSwing = swing;
      turningPoint = {
        ply: m.ply,
        moveNumber: m.moveNumber,
        color: m.color,
        san: m.san,
        swingCp: Math.round(swing),
      };
    }
  }

  const report: DiagnosticReport = {
    apertura: {
      precision: aperturaPrecision,
      openingName,
      eco,
      verdict:
        aperturaPrecision >= 85
          ? 'Desarrollo sólido y control central desde las primeras jugadas.'
          : aperturaPrecision >= 70
            ? 'Salida jugable, aunque cediste pequeños tiempos en el desarrollo.'
            : 'Incongruencias tempranas: prioriza sacar piezas y asegurar tu rey antes de atacar.',
    },
    tactica: {
      precision: tacticaPrecision,
      sharpMoments,
      found: tacticalFound,
      missed: tacticalMissed,
      verdict:
        tacticaPrecision >= 82
          ? 'Buen cálculo en capturas y amenazas directas.'
          : 'Se escaparon golpes tácticos clave; revisa jaques y piezas sin defensa antes de mover.',
    },
    estrategia: {
      precision: estrategiaPrecision,
      verdict:
        estrategiaPrecision >= 82
          ? 'Buena coordinación de piezas y planes coherentes en el medio juego.'
          : 'Falta un plan unificado en el medio juego: mejora tu peor pieza y busca rupturas de peón.',
    },
    finales: {
      precision: finalesPrecision,
      reached: endgameReached,
      verdict: endgameReached
        ? (finalesPrecision ?? 0) >= 80
          ? 'Técnica limpia para activar el rey y convertir ventaja en el final.'
          : 'En el final la actividad del rey y los peones pasados deciden; evita jugar pasivo.'
        : 'La partida se resolvió antes de alcanzar una fase de final pura.',
    },
    brillantes: {
      count: brillantesList.length,
      moves: brillantesList,
    },
    eloPromedio,
    turningPoint,
    summary: {
      whiteAccuracy,
      blackAccuracy,
      playerAccuracy,
      whiteAcpl,
      blackAcpl,
      counts,
    },
  };

  return {
    gameId: params.gameId,
    whiteUsername,
    blackUsername,
    whiteElo,
    blackElo,
    playerColor,
    openingName,
    eco,
    moves: analyzedMoves,
    report,
    engineSource: 'local-alphabeta',
  };
}

export async function analyzeLongTermTrends(
  games: ChessComGameSummary[]
): Promise<LongTermTrends> {
  const slice = games.slice(0, 10);
  const points: GameTrendPoint[] = [];
  const openingMap = new Map<
    string,
    { games: number; wins: number; draws: number; losses: number; precisionSum: number }
  >();

  let sumPrecision = 0;
  let sumTactical = 0;
  let sumOpening = 0;
  let sumMiddlegame = 0;
  let sumEndgame = 0;
  let endgameCount = 0;
  let totalBlunders = 0;

  for (const g of slice) {
    try {
      const parser = new Chess();
      parser.loadPgn(g.pgn);
      const history = parser.history({ verbose: true });
      const replay = new Chess();

      let openingAccSum = 0;
      let openingMoves = 0;
      let tacticalAccSum = 0;
      let tacticalMoves = 0;
      let middleAccSum = 0;
      let middleMoves = 0;
      let endAccSum = 0;
      let endMoves = 0;
      let allAccSum = 0;
      let playerMoves = 0;
      let blunders = 0;
      let mistakes = 0;

      // Sample player moves cleanly at depth 2 with bounded node budget & yield
      let prevEval = evaluatePosition(replay.fen(), 1, 500);

      for (let i = 0; i < history.length; i++) {
        const m = history[i];
        const ply = i + 1;
        const isPlayer = m.color === g.playerColor;

        if (isPlayer) {
          prevEval = evaluatePosition(replay.fen(), 2, 650);
        }
        replay.move(m);
        if (isPlayer) {
          const afterEval = evaluatePosition(replay.fen(), 2, 650);
          const sign = m.color === 'w' ? 1 : -1;
          const cpBefore = prevEval.evalCp * sign;
          const cpAfter = afterEval.evalCp * sign;
          const cpLoss = Math.max(0, cpBefore - cpAfter);
          const wpLoss = Math.max(0, cpToWinProb(cpBefore) - cpToWinProb(cpAfter));
          const acc =
            ply <= 8 && cpLoss <= 35 ? 96.5 : accuracyFromWinProbLoss(wpLoss);

          playerMoves++;
          allAccSum += acc;

          const phase = getGamePhase(replay, ply);
          if (phase === 'apertura') {
            openingMoves++;
            openingAccSum += acc;
          } else if (phase === 'mediojuego') {
            middleMoves++;
            middleAccSum += acc;
          } else {
            endMoves++;
            endAccSum += acc;
          }

          if (m.captured || m.san.includes('+') || cpLoss > 90) {
            tacticalMoves++;
            tacticalAccSum += acc;
          }

          if (cpLoss > 220) blunders++;
          else if (cpLoss > 105) mistakes++;
        }
      }

      const precision = playerMoves > 0 ? Number((allAccSum / playerMoves).toFixed(1)) : 75;
      const tacticalScore =
        tacticalMoves > 0 ? Number((tacticalAccSum / tacticalMoves).toFixed(1)) : precision;
      const openingScore =
        openingMoves > 0 ? Number((openingAccSum / openingMoves).toFixed(1)) : precision;
      const middleScore =
        middleMoves > 0 ? Number((middleAccSum / middleMoves).toFixed(1)) : precision;

      sumPrecision += precision;
      sumTactical += tacticalScore;
      sumOpening += openingScore;
      sumMiddlegame += middleScore;
      if (endMoves > 0) {
        sumEndgame += endAccSum / endMoves;
        endgameCount++;
      }
      totalBlunders += blunders;

      const date = new Date(g.endTime * 1000);
      const dateLabel = `${date.getDate()}/${date.getMonth() + 1}`;
      const opponent = g.playerColor === 'w' ? g.black.username : g.white.username;
      const playerRating = g.playerColor === 'w' ? g.white.rating : g.black.rating;

      points.push({
        gameId: g.id,
        dateLabel,
        endTime: g.endTime,
        timeClass: g.timeClass,
        opponent,
        playerColor: g.playerColor,
        playerResult: g.playerResult,
        playerRating,
        precision,
        tacticalScore,
        openingScore,
        blunders,
        mistakes,
        openingName: g.openingName,
      });

      const opKey = g.openingName.split(':')[0].split(',')[0].trim() || 'Apertura Variada';
      const existing = openingMap.get(opKey) ?? {
        games: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        precisionSum: 0,
      };
      existing.games++;
      if (g.playerResult === 'win') existing.wins++;
      else if (g.playerResult === 'draw') existing.draws++;
      else existing.losses++;
      existing.precisionSum += precision;
      openingMap.set(opKey, existing);
      await yieldEventLoop();
    } catch {
      // Skip malformed PGNs safely
    }
  }

  // Chronological order for charts (oldest -> newest)
  const chronological = [...points].reverse();
  const n = points.length || 1;

  const openingBreakdown = Array.from(openingMap.entries())
    .map(([openingName, d]) => ({
      openingName,
      games: d.games,
      wins: d.wins,
      draws: d.draws,
      losses: d.losses,
      avgPrecision: Number((d.precisionSum / d.games).toFixed(1)),
    }))
    .sort((a, b) => b.games - a.games)
    .slice(0, 6);

  return {
    gamesAnalyzed: points.length,
    averagePrecision: Number((sumPrecision / n).toFixed(1)),
    averageTacticalScore: Number((sumTactical / n).toFixed(1)),
    averageOpeningScore: Number((sumOpening / n).toFixed(1)),
    blunderRatePerGame: Number((totalBlunders / n).toFixed(2)),
    points: chronological,
    openingBreakdown,
    phaseProfile: {
      apertura: Number((sumOpening / n).toFixed(1)),
      tactica: Number((sumTactical / n).toFixed(1)),
      mediojuego: Number((sumMiddlegame / n).toFixed(1)),
      finales:
        endgameCount > 0
          ? Number((sumEndgame / endgameCount).toFixed(1))
          : Number((sumPrecision / n).toFixed(1)),
    },
  };
}
