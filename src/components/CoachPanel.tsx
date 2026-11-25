import React, { useState } from 'react';
import { Compass, Loader2, Send, ShieldAlert, Swords, Target } from 'lucide-react';
import type {
  AnalyzedMove,
  CoachExplanationResponse,
  CoachPersona,
} from '../types/chess.ts';

interface CoachPanelProps {
  fen: string;
  currentMove: AnalyzedMove | null;
  playerColor: 'w' | 'b';
  openingName: string;
  persona: CoachPersona;
  onSelectPersona: (persona: CoachPersona) => void;
}

interface CoachMeta {
  id: CoachPersona;
  name: string;
  subtitle: string;
  focus: string;
  image?: string;
}

const COACH_OPTIONS: CoachMeta[] = [
  {
    id: 'fusion',
    name: 'Tres Mentes',
    subtitle: 'Fischer + Carlsen + Kasparov',
    focus: 'Consejo unificado: claridad clásica, presión práctica y plan de ataque.',
  },
  {
    id: 'fischer',
    name: 'Bobby Fischer',
    subtitle: 'Claridad Clásica',
    focus: 'Principios puros, centro activo y castigar errores de desarrollo.',
    image: '/src/assets/images/coach_fischer_portrait_1795560341382.jpg',
  },
  {
    id: 'carlsen',
    name: 'Magnus Carlsen',
    subtitle: 'Maestría Práctica',
    focus: 'Mejorar tu peor pieza, presionar debilidades y dominar finales.',
    image: '/src/assets/images/coach_carlsen_portrait_1795560340796.jpg',
  },
  {
    id: 'kasparov',
    name: 'Garry Kasparov',
    subtitle: 'Iniciativa y Ataque',
    focus: 'Energía dinámica, coordinación y construcción de ataques al rey.',
    image: '/src/assets/images/coach_kasparov_portrait_1795560341459.jpg',
  },
];

const QUICK_QUESTIONS = [
  '¿Cómo armo mi plan de ataque desde aquí?',
  '¿Cómo gano usando solo lo básico que ya sé?',
  '¿Por qué el motor prefiere otra jugada?',
];

export const CoachPanel: React.FC<CoachPanelProps> = ({
  fen,
  currentMove,
  playerColor,
  openingName,
  persona,
  onSelectPersona,
}) => {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<CoachExplanationResponse | null>(null);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  const requestExplanation = async (customQuestion?: string, overridePersona?: CoachPersona) => {
    const activePersona = overridePersona ?? persona;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/coach/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fen,
          moveSan: currentMove?.san ?? 'Posición inicial',
          bestMoveSan: currentMove?.bestMoveSan ?? '',
          pvSan: currentMove?.pvSan ?? [],
          evalBeforeCp: currentMove?.evalBeforeCp ?? 15,
          evalAfterCp: currentMove?.evalAfterCp ?? 15,
          classification: currentMove?.classification ?? 'libro',
          phase: currentMove?.phase ?? 'apertura',
          playerColor,
          moveNumber: currentMove?.moveNumber ?? 1,
          openingName,
          persona: activePersona,
          question: customQuestion?.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo obtener la explicación del coach.');
      }
      setExplanation(data as CoachExplanationResponse);
      if (customQuestion) setQuestion('');
    } catch (err: any) {
      setError(err?.message || 'Error al consultar al entrenador.');
    } finally {
      setLoading(false);
    }
  };

  const activeCoach = COACH_OPTIONS.find((c) => c.id === persona) ?? COACH_OPTIONS[0];

  return (
    <div className="bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 rounded-lg p-5 flex flex-col gap-5">
      {/* Header & Philosophy */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Entrenador Interactivo · Filosofía Tres Mentes
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Aprende a dominar con tus fundamentos y construir planes de ataque reales, sin memorizar teoría mecánica.
          </p>
        </div>
        <button
          type="button"
          onClick={() => requestExplanation()}
          disabled={loading}
          className="px-4 py-2 rounded-md bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-white text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Compass className="w-3.5 h-3.5" />
          )}
          <span>{loading ? 'Analizando posición...' : 'Explicar esta jugada'}</span>
        </button>
      </div>

      {/* Coach Persona Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
        {COACH_OPTIONS.map((opt) => {
          const isSelected = persona === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                onSelectPersona(opt.id);
                if (explanation) {
                  requestExplanation(undefined, opt.id);
                }
              }}
              className={`text-left p-3 rounded-lg border transition-colors flex items-center gap-3 ${
                isSelected
                  ? 'border-amber-500 bg-amber-500/10 dark:bg-amber-500/10'
                  : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              {opt.image && !imgErrors[opt.id] ? (
                <img
                  src={opt.image}
                  alt={`Retrato de ${opt.name}`}
                  referrerPolicy="no-referrer"
                  onError={() => setImgErrors((prev) => ({ ...prev, [opt.id]: true }))}
                  className="w-11 h-11 rounded-md object-cover shrink-0 border border-slate-300 dark:border-slate-700"
                />
              ) : (
                <div className="w-11 h-11 rounded-md shrink-0 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center font-display font-bold text-xs text-amber-600 dark:text-amber-400">
                  {opt.id === 'fusion' ? '3M' : opt.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {opt.name}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {opt.subtitle}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Coach Context Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-[#0F141A] px-3.5 py-2.5 rounded-md border border-slate-200/80 dark:border-slate-800">
        <span>
          <strong className="text-slate-900 dark:text-slate-200 font-medium">
            {activeCoach.name}:
          </strong>{' '}
          {activeCoach.focus}
        </span>
        {currentMove && (
          <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
            Jugada actual: {currentMove.moveNumber}
            {currentMove.color === 'w' ? '.' : '...'} {currentMove.san}
          </span>
        )}
      </div>

      {/* Interactive Question Input & Quick Prompts */}
      <div className="flex flex-col gap-2.5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!question.trim() || loading) return;
            requestExplanation(question);
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Pregunta sobre esta posición (ej. ¿Por qué debo mover el caballo al centro?)..."
            className="flex-1 px-3.5 py-2 text-sm rounded-md bg-slate-50 dark:bg-[#0D1117] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="px-4 py-2 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-medium flex items-center gap-1.5 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Preguntar</span>
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          {QUICK_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              disabled={loading}
              onClick={() => requestExplanation(q)}
              className="px-3 py-1.5 rounded-md text-xs border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-amber-500/60 hover:text-amber-600 dark:hover:text-amber-400 transition-colors whitespace-nowrap"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-3.5 rounded-md border border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Explanation Output */}
      {!explanation && !loading && !error && (
        <div className="py-6 px-4 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-md">
          <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">
            Selecciona una jugada en el tablero y pulsa «Explicar esta jugada»
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-lg mx-auto">
            Recibirás un plan de ataque paso a paso pensado para mejorar tu comprensión real, no para memorizar variantes.
          </p>
        </div>
      )}

      {loading && (
        <div className="space-y-3 py-4">
          <div className="h-5 w-2/3 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
          <div className="h-16 w-full bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
          <div className="h-24 w-full bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
        </div>
      )}

      {explanation && !loading && (
        <div className="space-y-5 pt-2">
          {/* Headline & Coach Voice */}
          <div>
            <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {explanation.headline}
            </h4>
            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 mt-2 whitespace-pre-line">
              {explanation.coachVoice}
            </p>
          </div>

          {/* Attack Plan & Fundamental Principle */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-4 rounded-md bg-slate-50 dark:bg-[#0F141A] border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400 mb-2.5">
                <Swords className="w-4 h-4" />
                <span>Plan de ataque y juego en 3 pasos</span>
              </div>
              <ol className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                {explanation.attackPlan?.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="font-mono text-xs font-semibold text-amber-600 dark:text-amber-400 mt-0.5 shrink-0">
                      0{idx + 1}.
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="flex flex-col gap-3">
              <div className="p-4 rounded-md bg-slate-50 dark:bg-[#0F141A] border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1.5">
                  <Target className="w-4 h-4" />
                  <span>Domina con lo que ya sabes</span>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {explanation.whatToMaster}
                </p>
              </div>

              <div className="p-4 rounded-md bg-slate-50 dark:bg-[#0F141A] border border-slate-200 dark:border-slate-800">
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-200 mb-1">
                  Lógica de la jugada recomendada
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {explanation.recommendedIdea}
                </p>
              </div>
            </div>
          </div>

          {/* Three Minds Synthesis Breakdown */}
          {explanation.threeMindsBreakdown && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">
                Perspectiva individual del Consejo de las Tres Mentes
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161D]">
                  <div className="flex items-center gap-2.5 mb-2">
                    <img
                      src="/src/assets/images/coach_fischer_portrait_1795560341382.jpg"
                      alt="Bobby Fischer"
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded object-cover"
                    />
                    <div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        Bobby Fischer
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Principios y claridad
                      </div>
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {explanation.threeMindsBreakdown.fischer}
                  </p>
                </div>

                <div className="p-3.5 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161D]">
                  <div className="flex items-center gap-2.5 mb-2">
                    <img
                      src="/src/assets/images/coach_carlsen_portrait_1795560340796.jpg"
                      alt="Magnus Carlsen"
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded object-cover"
                    />
                    <div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        Magnus Carlsen
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Presión práctica y finales
                      </div>
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {explanation.threeMindsBreakdown.carlsen}
                  </p>
                </div>

                <div className="p-3.5 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161D]">
                  <div className="flex items-center gap-2.5 mb-2">
                    <img
                      src="/src/assets/images/coach_kasparov_portrait_1795560341459.jpg"
                      alt="Garry Kasparov"
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded object-cover"
                    />
                    <div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        Garry Kasparov
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Iniciativa y ataque
                      </div>
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {explanation.threeMindsBreakdown.kasparov}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
