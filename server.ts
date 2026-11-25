import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { Chess } from 'chess.js';
import {
  analyzeFullGame,
  analyzeLongTermTrends,
  evaluatePosition,
  extractOpeningFromPgn,
} from './src/engine/chessEngine.ts';
import type {
  ChessComGameSummary,
  ChessComPlayer,
  CoachPersona,
  TimeClass,
  TimeControlStats,
} from './src/types/chess.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHESS_COM_HEADERS = {
  'User-Agent': 'TresMentesAjedrez/1.0 (contact: support@tresmentes.app)',
  Accept: 'application/json',
};

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY no está configurada en el entorno del servidor.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Empirical Chess.com rapid/blitz percentile estimation based on published player distributions
function estimateChessComPercentile(rating: number): number {
  if (!rating || rating <= 0) return 0;
  const anchors: Array<[number, number]> = [
    [200, 1.5],
    [400, 14.0],
    [600, 34.0],
    [800, 54.0],
    [1000, 71.0],
    [1200, 83.5],
    [1400, 91.2],
    [1600, 95.8],
    [1800, 98.1],
    [2000, 99.2],
    [2200, 99.7],
    [2500, 99.95],
  ];
  if (rating <= anchors[0][0]) return anchors[0][1];
  if (rating >= anchors[anchors.length - 1][0]) return 99.95;

  for (let i = 0; i < anchors.length - 1; i++) {
    const [r1, p1] = anchors[i];
    const [r2, p2] = anchors[i + 1];
    if (rating >= r1 && rating <= r2) {
      const t = (rating - r1) / (r2 - r1);
      return Number((p1 + t * (p2 - p1)).toFixed(1));
    }
  }
  return 50;
}

function mapChessComResult(
  resultCode: string
): { outcome: 'win' | 'draw' | 'loss'; label: string } {
  if (resultCode === 'win') {
    return { outcome: 'win', label: 'Victoria' };
  }
  const drawCodes = new Set([
    'agreed',
    'repetition',
    'stalemate',
    'insufficient',
    '50move',
    'timevsinsufficient',
  ]);
  if (drawCodes.has(resultCode)) {
    return { outcome: 'draw', label: 'Tablas' };
  }
  return { outcome: 'loss', label: 'Derrota' };
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: CHESS_COM_HEADERS,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  const playerCache = new Map<string, { expiresAt: number; payload: any }>();
  const analysisCache = new Map<string, any>();

  // 1. Chess.com Player Profile, Stats & Recent Games
  app.get('/api/chesscom/player/:username', async (req, res) => {
    const rawUsername = (req.params.username || '').trim().toLowerCase();
    if (!rawUsername || !/^[a-z0-9_-]{2,30}$/i.test(rawUsername)) {
      res.status(400).json({ error: 'Nombre de usuario de Chess.com inválido.' });
      return;
    }

    const cachedPlayer = playerCache.get(rawUsername);
    if (cachedPlayer && cachedPlayer.expiresAt > Date.now()) {
      res.json(cachedPlayer.payload);
      return;
    }

    try {
      const [profileRes, statsRes, archivesRes] = await Promise.all([
        fetchJsonWithTimeout(`https://api.chess.com/pub/player/${encodeURIComponent(rawUsername)}`),
        fetchJsonWithTimeout(`https://api.chess.com/pub/player/${encodeURIComponent(rawUsername)}/stats`),
        fetchJsonWithTimeout(`https://api.chess.com/pub/player/${encodeURIComponent(rawUsername)}/games/archives`),
      ]);

      if (profileRes.status === 404) {
        res.status(404).json({
          error: `No se encontró el usuario "${rawUsername}" en Chess.com. Verifica la ortografía exacta.`,
        });
        return;
      }

      if (!profileRes.ok || !statsRes.ok) {
        res.status(502).json({
          error: 'No fue posible consultar la API pública de Chess.com en este momento.',
        });
        return;
      }

      const profileData = (await profileRes.json()) as Record<string, any>;
      const statsData = (await statsRes.json()) as Record<string, any>;
      const archivesData = archivesRes.ok
        ? ((await archivesRes.json()) as { archives?: string[] })
        : { archives: [] };

      const modeConfigs: Array<{ key: string; timeClass: TimeClass; label: string }> = [
        { key: 'chess_rapid', timeClass: 'rapid', label: 'Rápidas' },
        { key: 'chess_blitz', timeClass: 'blitz', label: 'Blitz' },
        { key: 'chess_bullet', timeClass: 'bullet', label: 'Bullet' },
        { key: 'chess_daily', timeClass: 'daily', label: 'Diarias' },
      ];

      const statsByMode: TimeControlStats[] = [];
      let totalWins = 0;
      let totalDraws = 0;
      let totalLosses = 0;
      let highestRating = 0;
      let primaryTimeClass: TimeClass = 'blitz';
      let maxModeGames = -1;

      for (const cfg of modeConfigs) {
        const block = statsData[cfg.key];
        if (!block) continue;
        const rating = Number(block.last?.rating ?? 0);
        const bestRating = block.best?.rating ? Number(block.best.rating) : null;
        const wins = Number(block.record?.win ?? 0);
        const draws = Number(block.record?.draw ?? 0);
        const losses = Number(block.record?.loss ?? 0);
        const total = wins + draws + losses;

        totalWins += wins;
        totalDraws += draws;
        totalLosses += losses;

        if (rating > highestRating) highestRating = rating;
        if (total > maxModeGames && rating > 0) {
          maxModeGames = total;
          primaryTimeClass = cfg.timeClass;
        }

        statsByMode.push({
          timeClass: cfg.timeClass,
          label: cfg.label,
          rating,
          bestRating,
          wins,
          draws,
          losses,
          totalGames: total,
          percentile: estimateChessComPercentile(rating),
        });
      }

      const totalGames = totalWins + totalDraws + totalLosses;
      const primaryStats =
        statsByMode.find((s) => s.timeClass === primaryTimeClass) || statsByMode[0];

      let countryCode: string | undefined;
      if (typeof profileData.country === 'string') {
        countryCode = profileData.country.split('/').pop();
      }

      const player: ChessComPlayer = {
        username: profileData.username || rawUsername,
        name: profileData.name,
        title: profileData.title,
        avatar: profileData.avatar,
        countryCode,
        joined: Number(profileData.joined || 0),
        lastOnline: Number(profileData.last_online || 0),
        followers: Number(profileData.followers || 0),
        status: profileData.status || 'basic',
        url: profileData.url || `https://www.chess.com/member/${rawUsername}`,
        totals: {
          totalGames,
          wins: totalWins,
          draws: totalDraws,
          losses: totalLosses,
          winRate: totalGames > 0 ? Number(((totalWins / totalGames) * 100).toFixed(1)) : 0,
          drawRate: totalGames > 0 ? Number(((totalDraws / totalGames) * 100).toFixed(1)) : 0,
          lossRate: totalGames > 0 ? Number(((totalLosses / totalGames) * 100).toFixed(1)) : 0,
          highestRating,
          primaryTimeClass,
          overallPercentile: primaryStats ? primaryStats.percentile : 0,
        },
        statsByMode,
      };

      // Fetch most recent 1-2 monthly archives for up to 24 recent standard games
      const archiveUrls = Array.isArray(archivesData.archives) ? archivesData.archives : [];
      const recentUrls = archiveUrls.slice(-2).reverse();
      const rawGames: any[] = [];

      for (const archUrl of recentUrls) {
        if (rawGames.length >= 24) break;
        const gRes = await fetchJsonWithTimeout(archUrl, 9000);
        if (!gRes.ok) continue;
        const gJson = (await gRes.json()) as { games?: any[] };
        const list = Array.isArray(gJson.games) ? [...gJson.games].reverse() : [];
        for (const item of list) {
          if (item.rules === 'chess' && typeof item.pgn === 'string' && item.pgn.trim().length > 0) {
            rawGames.push(item);
            if (rawGames.length >= 24) break;
          }
        }
      }

      const games: ChessComGameSummary[] = rawGames.map((g, idx) => {
        const whiteName = g.white?.username || 'Blancas';
        const blackName = g.black?.username || 'Negras';
        const isWhite = whiteName.toLowerCase() === rawUsername;
        const playerColor: 'w' | 'b' = isWhite ? 'w' : 'b';
        const resInfo = mapChessComResult(isWhite ? g.white?.result : g.black?.result);
        const { eco, openingName } = extractOpeningFromPgn(g.pgn);

        // Quick move count from PGN
        const moveMatches = g.pgn.match(/\b\d+\./g);
        const totalMoves = moveMatches ? moveMatches.length : 0;

        return {
          id: g.uuid || `${g.end_time}-${idx}`,
          url: g.url || '',
          endTime: Number(g.end_time || 0),
          timeClass: (['bullet', 'blitz', 'rapid', 'daily'].includes(g.time_class)
            ? g.time_class
            : 'blitz') as TimeClass,
          timeControl: g.time_control || '',
          rated: Boolean(g.rated),
          rules: g.rules || 'chess',
          pgn: g.pgn,
          eco,
          openingName,
          white: {
            username: whiteName,
            rating: Number(g.white?.rating || 1200),
            result: g.white?.result || '',
          },
          black: {
            username: blackName,
            rating: Number(g.black?.rating || 1200),
            result: g.black?.result || '',
          },
          playerColor,
          playerResult: resInfo.outcome,
          playerResultLabel: resInfo.label,
          totalMoves,
        };
      });

      const payload = { player, games };
      if (playerCache.size >= 25) {
        const oldestKey = playerCache.keys().next().value;
        if (oldestKey) playerCache.delete(oldestKey);
      }
      playerCache.set(rawUsername, {
        expiresAt: Date.now() + 120_000,
        payload,
      });

      res.json(payload);
    } catch (err: any) {
      console.error('Error fetching Chess.com data:', err);
      res.status(500).json({
        error:
          err?.name === 'AbortError'
            ? 'Tiempo de espera agotado al conectar con Chess.com.'
            : 'Ocurrió un error al consultar los datos de Chess.com.',
      });
    }
  });

  // 2. Full Game Engine Analysis
  app.post('/api/engine/analyze-game', async (req, res) => {
    try {
      const { gameId, pgn, whiteUsername, blackUsername, whiteElo, blackElo, playerColor } =
        req.body || {};

      if (!pgn || typeof pgn !== 'string') {
        res.status(400).json({ error: 'Se requiere un PGN válido para analizar la partida.' });
        return;
      }

      const color = playerColor === 'b' ? 'b' : 'w';
      const cacheKey = `${gameId || 'custom'}:${color}:${pgn.length}:${pgn.slice(0, 60)}:${pgn.slice(-40)}`;
      const cached = analysisCache.get(cacheKey);
      if (cached) {
        res.json(cached);
        return;
      }

      const analysis = await analyzeFullGame({
        gameId: gameId || 'custom-pgn',
        pgn,
        whiteUsername,
        blackUsername,
        whiteElo: typeof whiteElo === 'number' ? whiteElo : undefined,
        blackElo: typeof blackElo === 'number' ? blackElo : undefined,
        playerColor: color,
      });

      if (analysisCache.size >= 40) {
        const oldest = analysisCache.keys().next().value;
        if (oldest) analysisCache.delete(oldest);
      }
      analysisCache.set(cacheKey, analysis);

      res.json(analysis);
    } catch (err: any) {
      console.error('Error analyzing game:', err);
      res.status(400).json({
        error: 'No se pudo procesar el PGN de la partida. Verifica que el formato sea estándar.',
      });
    }
  });

  // 3. Single Position Deeper Eval
  app.post('/api/engine/evaluate-fen', (req, res) => {
    try {
      const { fen } = req.body || {};
      if (!fen || typeof fen !== 'string') {
        res.status(400).json({ error: 'FEN requerido.' });
        return;
      }
      const evaluation = evaluatePosition(fen, 3, 6000);
      res.json(evaluation);
    } catch {
      res.status(400).json({ error: 'FEN inválido.' });
    }
  });

  // 4. Long-term Tactical & Precision Trends across Recent Games
  app.post('/api/engine/analyze-trends', async (req, res) => {
    try {
      const { games } = req.body || {};
      if (!Array.isArray(games) || games.length === 0) {
        res.status(400).json({ error: 'No hay partidas disponibles para calcular tendencias.' });
        return;
      }
      const trends = await analyzeLongTermTrends(games);
      res.json(trends);
    } catch (err) {
      console.error('Error analyzing trends:', err);
      res.status(500).json({ error: 'No se pudieron calcular las tendencias tácticas.' });
    }
  });

  // 5. Interactive AI Coach Explanation (Three Minds: Fischer, Carlsen, Kasparov or Selectable Coach)
  app.post('/api/coach/explain', async (req, res) => {
    try {
      const {
        fen,
        moveSan,
        bestMoveSan,
        pvSan,
        evalBeforeCp,
        evalAfterCp,
        classification,
        phase,
        playerColor,
        moveNumber,
        openingName,
        persona,
        question,
      } = req.body || {};

      if (!fen || typeof fen !== 'string') {
        res.status(400).json({ error: 'Posición FEN requerida para la explicación.' });
        return;
      }

      const chess = new Chess(fen);
      const legalMoves = chess.moves().slice(0, 35).join(', ');
      const sideToMove = chess.turn() === 'w' ? 'Blancas' : 'Negras';
      const userSide = playerColor === 'b' ? 'Negras' : 'Blancas';
      const chosenPersona: CoachPersona = ['fusion', 'fischer', 'carlsen', 'kasparov'].includes(
        persona
      )
        ? persona
        : 'fusion';

      const personaDirectiveMap: Record<CoachPersona, string> = {
        fusion: `Actúas como el Consejo Unificado de las Tres Mentes del Ajedrez:
- Bobby Fischer: aporta claridad lógica absoluta, actividad pura de piezas, respeto por los principios clásicos y evitar complicaciones artificiales.
- Magnus Carlsen: aporta visión práctica de medio juego y finales, cómo mejorar la peor pieza, crear presión sostenible y ganar partidas reales sin depender de trucos.
- Garry Kasparov: aporta dinamismo, iniciativa, coordinación para lanzar un plan de ataque al rey o al centro, y energía táctica.
Debes sintetizar estas tres mentes en un coaching claro para el alumno y también entregar la perspectiva individual breve de cada uno en 'threeMindsBreakdown'.`,
        fischer: `Actúas como Coach inspirado en la mente pedagógica de Bobby Fischer:
Enfócate en la claridad absoluta, el desarrollo rápido, el dominio del centro, líneas abiertas para torres/alfiles y cómo castigar jugadas lentas usando únicamente principios fundamentales y lógica directa.`,
        carlsen: `Actúas como Coach inspirado en la mente pedagógica de Magnus Carlsen:
Enfócate en la comprensión práctica, mejorar tu peor pieza, mantener la tensión, aprovechar debilidades estructurales a largo plazo y convertir ventajas en el medio juego y final con naturalidad.`,
        kasparov: `Actúas como Coach inspirado en la mente pedagógica de Garry Kasparov:
Enfócate en la iniciativa, el tiempo, la coordinación dinámica de piezas hacia el rey rival y cómo construir un plan de ataque paso a paso.`,
      };

      const systemInstruction = `Eres un maestro entrenador de ajedrez de élite hablando en español claro, cercano y formativo.
FILOSOFÍA OBLIGATORIA DE ENSEÑANZA:
- El objetivo NO es que el alumno memorice jugadas ni teoría interminable de aperturas.
- El objetivo es que aprenda a DOMINAR la partida con lo que ya sabe (reglas básicas, actividad de piezas, seguridad del rey, control del centro, ruptura de peones y coordinación) y sepa armar su propio plan de ataque o defensa como un buen jugador humano, no como una máquina.
- Nunca inventes jugadas ilegales; apoya tus ideas únicamente en la posición FEN actual y en las jugadas legales proporcionadas.
- Habla en segunda persona ("tu alfil", "tu plan", "tu rey") de forma práctica y accionable.

ESTILO ACTIVO:
${personaDirectiveMap[chosenPersona]}`;

      const evalBeforeStr =
        typeof evalBeforeCp === 'number' ? `${(evalBeforeCp / 100).toFixed(2)}` : '0.00';
      const evalAfterStr =
        typeof evalAfterCp === 'number' ? `${(evalAfterCp / 100).toFixed(2)}` : '0.00';

      const prompt = `Contexto de la posición:
- FEN actual del tablero: ${fen}
- Turno actual en el tablero: ${sideToMove} (el alumno juega con ${userSide})
- Fase de la partida: ${phase || 'mediojuego'}
- Apertura detectada: ${openingName || 'Variada'}
- Número de jugada: ${moveNumber || 1}
- Jugada realizada en la partida: ${moveSan || 'Posición inicial'} (Clasificación del motor: ${classification || 'N/A'})
- Mejor jugada sugerida por el motor: ${bestMoveSan || 'N/A'} (Línea principal: ${Array.isArray(pvSan) ? pvSan.slice(0, 5).join(' ') : 'N/A'})
- Evaluación antes -> después (en peones, positivo favorece a Blancas): ${evalBeforeStr} -> ${evalAfterStr}
- Jugadas legales disponibles ahora en el FEN: ${legalMoves}
${question ? `- Pregunta específica del alumno: "${question}"` : '- El alumno pide entender esta jugada y cómo armar su plan de ataque/juego aquí.'}

Responde en JSON siguiendo el esquema solicitado. En 'attackPlan' entrega exactamente 3 pasos concretos, claros y aplicables usando fundamentos básicos (sin jerga robótica).`;

      const ai = getAiClient();

      const schemaProperties: Record<string, any> = {
        headline: {
          type: Type.STRING,
          description: 'Titular breve y claro de la lección estratégica de esta posición (máx 12 palabras).',
        },
        coachVoice: {
          type: Type.STRING,
          description:
            'Explicación humana e intuitiva de la jugada y de la posición (2-3 párrafos cortos, sin memorización mecánica).',
        },
        attackPlan: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Lista exacta de 3 pasos concretos para ejecutar el plan de ataque o defensa con conceptos básicos.',
        },
        whatToMaster: {
          type: Type.STRING,
          description:
            'Principio fundamental del ajedrez que el alumno domina aquí usando lo que ya sabe (1-2 frases).',
        },
        recommendedIdea: {
          type: Type.STRING,
          description:
            'Por qué funciona la jugada recomendada del motor explicada con lógica humana.',
        },
      };

      if (chosenPersona === 'fusion') {
        schemaProperties.threeMindsBreakdown = {
          type: Type.OBJECT,
          properties: {
            fischer: {
              type: Type.STRING,
              description: 'Aporte breve de Bobby Fischer sobre claridad clásica y actividad de piezas (1-2 frases).',
            },
            carlsen: {
              type: Type.STRING,
              description: 'Aporte breve de Magnus Carlsen sobre presión práctica, mejora de piezas o finales (1-2 frases).',
            },
            kasparov: {
              type: Type.STRING,
              description: 'Aporte breve de Garry Kasparov sobre iniciativa y plan de ataque dinámico (1-2 frases).',
            },
          },
          required: ['fischer', 'carlsen', 'kasparov'],
        };
      }

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: schemaProperties,
            required: [
              'headline',
              'coachVoice',
              'attackPlan',
              'whatToMaster',
              'recommendedIdea',
              ...(chosenPersona === 'fusion' ? ['threeMindsBreakdown'] : []),
            ],
          },
        },
      });

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText);

      res.json({
        persona: chosenPersona,
        ...parsed,
      });
    } catch (err: any) {
      console.error('Error in /api/coach/explain:', err);
      const message = String(err?.message || '');
      if (message.includes('GEMINI_API_KEY')) {
        res.status(500).json({
          error: 'No se encontró GEMINI_API_KEY. Configúrala en Settings > Secrets.',
        });
        return;
      }
      if (message.includes('403') || message.includes('PERMISSION_DENIED') || message.includes('API_KEY_INVALID')) {
        res.status(403).json({
          error: 'La clave de Gemini API no es válida o no tiene permisos. Verifica Settings > Secrets.',
        });
        return;
      }
      res.status(500).json({
        error: 'No fue posible generar la explicación del coach en este momento. Inténtalo de nuevo.',
      });
    }
  });

  // Vite middleware in dev, static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
