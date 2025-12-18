/**
 * GameContext - Game implementation provider
 * Framework context - game-agnostic
 * 
 * This context provides access to game-specific implementations
 * of the framework interfaces (scoring, validation, analysis, etc.)
 */

import { createContext, useContext, type ReactNode } from 'react';
import type {
  GameConfig,
  ScoutingEntryBase,
  ScoringCalculations,
  ValidationRules,
  StrategyAnalysis,
  UIComponents
} from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface GameContextValue {
  config: GameConfig;
  scoring: ScoringCalculations<any>;
  validation: ValidationRules<any>;
  analysis: StrategyAnalysis<any>;
  ui: UIComponents<any>;
}

const GameContext = createContext<GameContextValue | null>(null);

export function useGame<T extends ScoutingEntryBase = ScoutingEntryBase>(): GameContextValue {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}

interface GameProviderProps<T extends ScoutingEntryBase = ScoutingEntryBase> {
  children: ReactNode;
  config: GameConfig;
  scoring: ScoringCalculations<T>;
  validation: ValidationRules<T>;
  analysis: StrategyAnalysis<T>;
  ui: UIComponents<T>;
}

export function GameProvider<T extends ScoutingEntryBase = ScoutingEntryBase>({
  children,
  config,
  scoring,
  validation,
  analysis,
  ui
}: GameProviderProps<T>) {
  const value: GameContextValue = {
    config,
    scoring,
    validation,
    analysis,
    ui
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
}
