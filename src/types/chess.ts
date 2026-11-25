export type TimeClass = 'bullet' | 'blitz' | 'rapid' | 'daily';

export type CoachPersona = 'fusion' | 'fischer' | 'carlsen' | 'kasparov';

export type MoveClassification =
  | 'brillante'
  | 'optima'
  | 'buena'
  | 'imprecision'
  | 'error'
  | 'grave'
  | 'libro';

export type GamePhase = 'apertura' | 'mediojuego' | 'final';

export interface TimeControlStats {
  timeClass: TimeClass;
  label: string;
  rating: number;
  bestRating: number | null;
  wins: number;
  draws: number;
  losses: number;
  totalGames: number;
  percentile: number; // Estimated Chess.com percentile (0 - 99.9)
}

export interface ChessComPlayer {
  username: string;
  name?: string;
  title?: string;
  avatar?: string;
  countryCode?: string;
  countryName?: string;
  joined: number;
  lastOnline: number;
  followers: number;
  status: string;
  url: string;
  totals: {
    totalGames: number;
    wins: number;
    draws: number;
    losses: number;
    winRate: number;
    drawRate: number;
    lossRate: number;
    highestRating: number;
    primaryTimeClass: TimeClass;
    overallPercentile: number;
  };
  statsByMode: TimeControlStats[];
}

export interface ChessComGameSummary {
  id: string;
  url: string;
  endTime: number;
  timeClass: TimeClass;
  timeControl: string;
  rated: boolean;
  rules: string;
  pgn: string;
  eco?: string;
  openingName: string;
  white: {
    username: string;
    rating: number;
    result: string;
  };
  black: {
    username: string;
    rating: number;
    result: string;
  };
  playerColor: 'w' | 'b';
  playerResult: 'win' | 'draw' | 'loss';
  playerResultLabel: string;
  totalMoves: number;
}

export interface AnalyzedMove {
  ply: number; // 1-based ply index (0 is starting position)
  moveNumber: number;
  color: 'w' | 'b';
  san: string;
  from: string;
  to: string;
  fenBefore: string;
  fenAfter: string;
  evalBeforeCp: number; // From White's perspective
  evalAfterCp: number;  // From White's perspective
  mateIn: number | null; // Positive = White mates, Negative = Black mates
  bestMoveSan: string;
  bestMoveFrom: string;
  bestMoveTo: string;
  pvSan: string[];
  cpLoss: number; // Always >= 0 for the side that moved
  classification: MoveClassification;
  phase: GamePhase;
  isSacrifice: boolean;
  isCheck: boolean;
  isCapture: boolean;
}

export interface DiagnosticReport {
  apertura: {
    precision: number;
    openingName: string;
    eco: string;
    verdict: string;
  };
  tactica: {
    precision: number;
    sharpMoments: number;
    found: number;
    missed: number;
    verdict: string;
  };
  estrategia: {
    precision: number;
    verdict: string;
  };
  finales: {
    precision: number | null;
    reached: boolean;
    verdict: string;
  };
  brillantes: {
    count: number;
    moves: Array<{
      ply: number;
      moveNumber: number;
      color: 'w' | 'b';
      san: string;
    }>;
  };
  eloPromedio: number;
  turningPoint: {
    ply: number;
    moveNumber: number;
    color: 'w' | 'b';
    san: string;
    swingCp: number;
  } | null;
  summary: {
    whiteAccuracy: number;
    blackAccuracy: number;
    playerAccuracy: number;
    whiteAcpl: number;
    blackAcpl: number;
    counts: Record<MoveClassification, number>;
  };
}

export interface FullGameAnalysis {
  gameId: string;
  whiteUsername: string;
  blackUsername: string;
  whiteElo: number;
  blackElo: number;
  playerColor: 'w' | 'b';
  openingName: string;
  eco: string;
  moves: AnalyzedMove[];
  report: DiagnosticReport;
  engineSource: 'local-alphabeta' | 'hybrid-cloud';
}

export interface GameTrendPoint {
  gameId: string;
  dateLabel: string;
  endTime: number;
  timeClass: TimeClass;
  opponent: string;
  playerColor: 'w' | 'b';
  playerResult: 'win' | 'draw' | 'loss';
  playerRating: number;
  precision: number;
  tacticalScore: number;
  openingScore: number;
  blunders: number;
  mistakes: number;
  openingName: string;
}

export interface LongTermTrends {
  gamesAnalyzed: number;
  averagePrecision: number;
  averageTacticalScore: number;
  averageOpeningScore: number;
  blunderRatePerGame: number;
  points: GameTrendPoint[];
  openingBreakdown: Array<{
    openingName: string;
    games: number;
    wins: number;
    draws: number;
    losses: number;
    avgPrecision: number;
  }>;
  phaseProfile: {
    apertura: number;
    tactica: number;
    mediojuego: number;
    finales: number;
  };
}

export interface CoachExplanationResponse {
  persona: CoachPersona;
  headline: string;
  coachVoice: string;
  attackPlan: string[];
  whatToMaster: string;
  recommendedIdea: string;
  threeMindsBreakdown?: {
    fischer: string;
    carlsen: string;
    kasparov: string;
  };
}
