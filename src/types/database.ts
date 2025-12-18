/**
 * Maneuver Core - Database Schema Types
 * 
 * Defines the structure for IndexedDB storage using Dexie.
 * 
 * STORAGE ARCHITECTURE:
 * - Separate Dexie databases for different concerns:
 *   1. MatchScoutingDB: Match scouting entries
 *   2. PitScoutingDB: Pit scouting entries
 *   3. TBACacheDB: TBA match validation data cache
 *   4. ScoutProfileDB: Gamification (scouts, predictions, achievements)
 * 
 * Framework provides base interfaces; game implementations extend with game-specific fields.
 */

import type { ScoutingEntryBase } from './scouting-entry';

// ============================================================================
// Match Scouting Database
// ============================================================================

/**
 * Match scouting database schema
 */
export interface ScoutingDatabaseSchema {
  scoutingData: ScoutingEntryBase;
}

// ============================================================================
// Pit Scouting Database
// ============================================================================

/**
 * Standard FRC drivetrain types
 * Most teams use swerve, but tank and mecanum are also common
 */
export type DrivetrainType = 'swerve' | 'tank' | 'mecanum' | 'other';

/**
 * Standard FRC programming languages
 * Java is the most common, followed by C++ and Python
 */
export type ProgrammingLanguage = 'Java' | 'C++' | 'Python' | 'LabVIEW' | 'other';

/**
 * Base interface for pit scouting entries
 * 
 * DESIGN PRINCIPLES:
 * - Framework defines universal fields (photo, weight, drivetrain, language, notes)
 * - Game-specific data stored in `gameData` object (same pattern as ScoutingEntryBase)
 * - ID format: "pit-{teamNumber}-{eventKey}-{timestamp}-{random}" for natural collision detection
 * 
 * EXTENSION EXAMPLE (maneuver-2025):
 * interface PitScoutingEntry2025 extends PitScoutingEntryBase {
 *   gameData: {
 *     groundPickupCapabilities?: {
 *       coralGround: boolean;
 *       algaeGround: boolean;
 *     };
 *     reportedAutoScoring?: {
 *       canScoreL1: boolean;
 *       canScoreL2: boolean;
 *       // etc.
 *     };
 *     reportedTeleopScoring?: object;
 *     reportedEndgame?: object;
 *   };
 * }
 */
export interface PitScoutingEntryBase {
  id: string;                    // "pit-{teamNumber}-{eventKey}-{timestamp}-{random}"
  teamNumber: number;             // Team number (matches ScoutingEntryBase): 3314
  eventKey: string;               // TBA event key: "2025mrcmp"
  scoutName: string;              // Scout who recorded this entry
  timestamp: number;              // Unix milliseconds (not ISO string) for efficient comparison
  
  // Universal pit scouting fields (not game-specific)
  robotPhoto?: string;            // Base64 or URL
  weight?: number;                // Robot weight in pounds
  drivetrain?: DrivetrainType;    // Standard FRC drivetrain types
  programmingLanguage?: ProgrammingLanguage; // Standard FRC programming languages
  notes?: string;                 // General observations
  
  // Game-specific data (defined by game implementation)
  gameData?: Record<string, unknown>; // Game implementations define typed structure here
}

/**
 * Pit scouting database schema
 */
export interface PitScoutingDatabaseSchema {
  pitScoutingData: PitScoutingEntryBase;
}

// ============================================================================
// TBA Cache Database (Match Validation)
// ============================================================================

/**
 * Cached TBA match data with expiration metadata
 * Used for match validation and offline-first functionality
 */
export interface CachedTBAMatch {
  matchKey: string;         // Primary key: "2025mrcmp_qm1"
  eventKey: string;         // For querying by event: "2025mrcmp"
  matchNumber: number;      // Match number for sorting
  compLevel: string;        // Competition level: "qm", "ef", "qf", "sf", "f"
  data: Record<string, unknown>;  // Complete TBA match data (game-agnostic)
  cachedAt: number;         // Timestamp when cached
  expiresAt: number;        // Timestamp when cache expires (offline-first: return even if expired)
}

/**
 * Metadata for TBA event cache
 * Tracks cache freshness and statistics
 */
export interface TBACacheMetadata {
  eventKey: string;         // Primary key: "2025mrcmp"
  lastFetchedAt: number;    // Timestamp of last TBA fetch
  matchCount: number;       // Total matches cached
  qualMatchCount: number;   // Qualification matches cached
  playoffMatchCount: number; // Playoff matches cached
}

/**
 * Validation result stored in database
 * Links match validation results to TBA cache
 * 
 * NOTE: Full interface definition in src/types/validation.ts
 * This is referenced here for database schema documentation only.
 * Import from validation.ts when using this type.
 */
export interface ValidationResultDB {
  id: string;               // Primary key: "{eventKey}_{matchKey}"
  eventKey: string;         // Event key for querying
  matchKey: string;         // TBA match key
  matchNumber: string;      // Match number for display
  result: Record<string, unknown>; // Complete MatchValidationResult (see validation.ts)
  timestamp: number;        // When validation was performed
}

/**
 * TBA cache database schema
 * Used for match validation and offline-first functionality
 */
export interface TBACacheDatabaseSchema {
  matches: CachedTBAMatch;
  metadata: TBACacheMetadata;
  validationResults: ValidationResultDB;
}

// ============================================================================
// Scout Profile Database (Gamification)
// ============================================================================

/**
 * Scout profile for gamification system
 * Tracks prediction accuracy, stakes, and achievements
 */
export interface Scout {
  name: string;              // Primary key - matches nav-user sidebar
  stakes: number;            // Total stakes (predictions + achievements)
  stakesFromPredictions: number; // Stakes earned only from predictions
  totalPredictions: number;  // Total predictions made
  correctPredictions: number; // Correct predictions
  currentStreak: number;     // Current consecutive correct predictions
  longestStreak: number;     // Best streak ever achieved
  createdAt: number;         // Scout creation timestamp
  lastUpdated: number;       // Last activity timestamp
}

/**
 * Match prediction for scout gamification
 * Links scouts to their match outcome predictions
 */
export interface MatchPrediction {
  id: string;                // Primary key: "prediction_{timestamp}_{random}"
  scoutName: string;         // Scout who made prediction
  eventName: string;         // Event name
  matchNumber: string;       // Match number
  predictedWinner: 'red' | 'blue'; // Predicted winner alliance
  actualWinner?: 'red' | 'blue' | 'tie'; // Actual winner (after verification)
  isCorrect?: boolean;       // Whether prediction was correct
  pointsAwarded?: number;    // Stakes awarded for this prediction
  timestamp: number;         // When prediction was made
  verified: boolean;         // Whether prediction has been verified
}

/**
 * Scout achievement record
 * Tracks unlocked achievements for gamification
 */
export interface ScoutAchievement {
  scoutName: string;         // Scout who unlocked achievement
  achievementId: string;     // Achievement identifier
  unlockedAt: number;        // When achievement was unlocked
  progress?: number;         // Progress towards achievement (0-100)
}

/**
 * Scout profile database schema
 * Used for gamification features
 */
export interface ScoutProfileDatabaseSchema {
  scouts: Scout;
  predictions: MatchPrediction;
  scoutAchievements: ScoutAchievement;
}
