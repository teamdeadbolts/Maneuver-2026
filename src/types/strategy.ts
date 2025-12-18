/**
 * Strategy-related types
 * 
 * Types for team analysis and strategy calculations.
 * Currently only basic statistics are implemented.
 */

/**
 * Team performance statistics (IMPLEMENTED)
 */
export interface TeamStats {
  teamNumber: number;
  matchesPlayed: number;
  averagePoints: {
    auto: number;
    teleop: number;
    endgame: number;
    total: number;
  };
  medianPoints: {
    auto: number;
    teleop: number;
    endgame: number;
    total: number;
  };
  consistency: number; // Standard deviation
  trend: 'improving' | 'declining' | 'stable';
}
