/**
 * Year-agnostic scouting data utilities
 * Works directly with ScoutingEntryBase - the core database format
 */

import type { ScoutingEntryBase } from '@/types/scouting-entry';
import { apiRequest, loadAllScoutingEntries } from '@/core/db/database';

/**
 * Normalize event key for consistent storage and comparison
 */
export const normalizeEventKey = (eventKey: string): string => {
  return String(eventKey).toLowerCase().trim();
};

/**
 * Generate a deterministic ID
 */
export const generateDeterministicEntryId = (
  eventKey: string,
  matchKey: string,
  teamNumber: number,
  allianceColor: 'red' | 'blue'
): string => {
  const event = normalizeEventKey(eventKey);
  const match = String(matchKey).toLowerCase().trim();
  const team = String(teamNumber).trim();
  const alliance = allianceColor.toLowerCase().trim();

  return `${event}::${match}::${team}::${alliance}`;
};

export const generateDataFingerprint = (entry: ScoutingEntryBase): string => {
  const sortedEntries = Object.entries(entry.gameData || {}).sort(([keyA], [keyB]) =>
    keyA.localeCompare(keyB)
  );

  const dataString = sortedEntries
    .map(([key, value]) => `${key}:${JSON.stringify(value)}`)
    .join('|');

  let hash = 2166136261;
  for (let i = 0; i < dataString.length; i++) {
    hash ^= dataString.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
};

const parseMatchKeyForSort = (
  matchKey: string
): { compOrder: number; setNumber: number; matchNumber: number; raw: string } => {
  const raw = String(matchKey || '').trim();
  const keyPart = raw.includes('_') ? raw.split('_')[1] || raw : raw;

  const qm = keyPart.match(/^qm(\d+)$/i);
  if (qm && qm[1]) {
    return { compOrder: 1, setNumber: 1, matchNumber: Number.parseInt(qm[1], 10), raw };
  }

  const sf = keyPart.match(/^sf(\d+)m(\d+)$/i);
  if (sf && sf[1] && sf[2]) {
    return {
      compOrder: 2,
      setNumber: Number.parseInt(sf[1], 10),
      matchNumber: Number.parseInt(sf[2], 10),
      raw,
    };
  }

  const f = keyPart.match(/^f(\d+)m(\d+)$/i);
  if (f && f[1] && f[2]) {
    return {
      compOrder: 3,
      setNumber: Number.parseInt(f[1], 10),
      matchNumber: Number.parseInt(f[2], 10),
      raw,
    };
  }

  const numericOnly = Number.parseInt(keyPart.replace(/\D/g, ''), 10);
  return {
    compOrder: 9,
    setNumber: 1,
    matchNumber: Number.isNaN(numericOnly) ? Number.MAX_SAFE_INTEGER : numericOnly,
    raw,
  };
};

const compareMatchKeys = (a: string, b: string): number => {
  const parsedA = parseMatchKeyForSort(a);
  const parsedB = parseMatchKeyForSort(b);

  if (parsedA.compOrder !== parsedB.compOrder) {
    return parsedA.compOrder - parsedB.compOrder;
  }

  if (parsedA.setNumber !== parsedB.setNumber) {
    return parsedA.setNumber - parsedB.setNumber;
  }

  if (parsedA.matchNumber !== parsedB.matchNumber) {
    return parsedA.matchNumber - parsedB.matchNumber;
  }

  return parsedA.raw.localeCompare(parsedB.raw);
};

/**
 * Loads all scouting entries from the Postgres API.
 * In a production app, you might consider adding pagination or event filters
 * here to avoid downloading the entire history of the team.
 */
export const loadScoutingData = async (): Promise<ScoutingEntryBase[]> => {
  // try {
  //   const entries = await apiRequest<ScoutingEntryBase[]>('/matches', {
  //     method: 'GET'
  //   });
  //   return entries;
  // } catch (error) {
  //   console.error('Error loading scouting data from API:', error);
  //   return [];
  // }
  return await loadAllScoutingEntries();
};

/**
 * Saves multiple scouting entries to the Postgres database.
 * Uses the bulk-upsert logic on the server to handle updates to existing records.
 */
export const saveScoutingData = async (entries: ScoutingEntryBase[]): Promise<void> => {
  try {
    await apiRequest('/matches/bulk', {
      method: 'POST',
      body: JSON.stringify(entries),
    });
  } catch (error) {
    console.error('Error saving scouting data via API:', error);
    throw error;
  }
};

/**
 * Get display summary for UI
 */
export const getDataSummary = async (): Promise<{
  totalEntries: number;
  teams: number[];
  matches: string[];
  scouts: string[];
  events: string[];
}> => {
  const entries = await loadScoutingData();

  const teams = new Set<number>();
  const matches = new Set<string>();
  const scouts = new Set<string>();
  const events = new Set<string>();

  entries.forEach(entry => {
    if (entry.teamNumber) teams.add(entry.teamNumber);
    if (entry.matchKey) matches.add(entry.matchKey);
    if (entry.scoutName) scouts.add(entry.scoutName);
    if (entry.eventKey) events.add(entry.eventKey);
  });

  return {
    totalEntries: entries.length,
    teams: Array.from(teams).sort((a, b) => a - b),
    matches: Array.from(matches).sort(compareMatchKeys),
    scouts: Array.from(scouts).sort(),
    events: Array.from(events).sort(),
  };
};

// ==============================================================================
// CONFLICT DETECTION FOR DATA IMPORTS
// ==============================================================================

export interface ConflictInfo {
  incoming: ScoutingEntryBase;
  local: ScoutingEntryBase;
  conflictType: 'corrected-vs-uncorrected' | 'corrected-vs-corrected';
  isNewerIncoming: boolean;
  changedFields?: Array<{ field: string; localValue: unknown; incomingValue: unknown }>;
}

export interface ConflictDetectionResult {
  autoImport: ScoutingEntryBase[];
  autoReplace: ScoutingEntryBase[];
  batchReview: ScoutingEntryBase[];
  conflicts: ConflictInfo[];
}

/**
 * Compare two entries and return list of gameData fields that differ
 * Flattens nested objects (auto, teleop, endgame) for detailed field-by-field comparison
 */
export const computeChangedFields = (
  localEntry: ScoutingEntryBase,
  incomingEntry: ScoutingEntryBase
): Array<{ field: string; localValue: unknown; incomingValue: unknown }> => {
  const changes: Array<{ field: string; localValue: unknown; incomingValue: unknown }> = [];

  const localData = localEntry.gameData || {};
  const incomingData = incomingEntry.gameData || {};

  /**
   * Recursively flatten nested objects into dot notation
   * e.g., { auto: { startPosition: 'Left' } } → { 'auto.startPosition': 'Left' }
   */
  const flattenObject = (obj: Record<string, unknown>, prefix = ''): Record<string, unknown> => {
    const flattened: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        // Recursively flatten nested objects
        Object.assign(flattened, flattenObject(value as Record<string, unknown>, fullKey));
      } else {
        // Primitive value or array - store as-is
        flattened[fullKey] = value;
      }
    }

    return flattened;
  };

  const flattenedLocal = flattenObject(localData);
  const flattenedIncoming = flattenObject(incomingData);

  const allFields = new Set([...Object.keys(flattenedLocal), ...Object.keys(flattenedIncoming)]);

  for (const field of allFields) {
    const localValue = flattenedLocal[field];
    const incomingValue = flattenedIncoming[field];

    // Skip if either value is null/undefined
    if (incomingValue === null || incomingValue === undefined) continue;
    if (localValue === null || localValue === undefined) continue;

    // Compare values
    if (JSON.stringify(localValue) !== JSON.stringify(incomingValue)) {
      changes.push({ field, localValue, incomingValue });
    }
  }

  return changes;
};

/**
 * Detects conflicts between incoming data and existing local data
 * Returns categorized results for UI handling
 */
/**
 * Detect conflicts by comparing incoming data against the Postgres database.
 * This sends the incoming batch to the server, which performs optimized
 * lookups to identify new, updated, or conflicting records.
 */
export const detectConflicts = async (
  incomingData: ScoutingEntryBase[]
): Promise<ConflictDetectionResult> => {
  try {
    // We send the incoming data to a dedicated conflict detection endpoint.
    // The server is much faster at cross-referencing IDs and field-based keys.
    const result = await apiRequest<ConflictDetectionResult>('/matches/detect-conflicts', {
      method: 'POST',
      body: JSON.stringify({ entries: incomingData }),
    });

    return result;
  } catch (error) {
    console.error('Error detecting conflicts via API:', error);
    // Return empty results on error to prevent data loss or UI crashes
    return {
      autoImport: [],
      autoReplace: [],
      batchReview: [],
      conflicts: [],
    };
  }
};
