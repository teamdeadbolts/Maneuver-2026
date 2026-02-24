/**
 * Generic Dexie database layer for maneuver-core
 *
 * This is the year-agnostic database infrastructure.
 * Game-specific data goes in the `gameData` field as JSON.
 *
 * Two separate databases:
 * 1. MatchScoutingDB - Match scouting entries
 * 2. PitScoutingDB - Pit scouting/robot capabilities
 */

import type {
  ScoutingEntryBase,
  ScoutingDataExport,
  ImportResult,
  DBStats,
  QueryFilters,
  PitScoutingEntryBase,
  PitScoutingStats,
} from '../types';

// const API_PORT = 3000;
// const url = new URL(window.location.origin);
// url.port = API_PORT.toString();
// const API_BASE = import.meta.env.VITE_API_BASE_URL || `${url.toString()}api`;

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return response.json();
}

// ============================================================================
// DATABASE CLASSES
// ============================================================================

/**
 * Main scouting database - stores match scouting entries
 */

// ============================================================================
// SCOUTING DATA CRUD OPERATIONS
// ============================================================================

/**
 * Save a single scouting entry
 */
export const saveScoutingEntry = async <TGameData = Record<string, unknown>>(
  entry: ScoutingEntryBase<TGameData>
): Promise<void> => {
  await apiRequest('/matches', {
    method: 'POST',
    body: JSON.stringify(entry),
  });
};

/**
 * Save multiple scouting entries (bulk operation)
 */
export const saveScoutingEntries = async <TGameData = Record<string, unknown>>(
  entries: ScoutingEntryBase<TGameData>[]
): Promise<void> => {
  await apiRequest('/matches/bulk', {
    method: 'POST',
    body: JSON.stringify(entries),
  });
};

/**
 * Load all scouting entries
 */
export const loadAllScoutingEntries = async <TGameData = Record<string, unknown>>(): Promise<
  ScoutingEntryBase<TGameData>[]
> => {
  return await apiRequest<ScoutingEntryBase<TGameData>[]>('/matches/query', { method: 'GET' });
};

/**
 * Load scouting entries for a specific team
 */
export const loadScoutingEntriesByTeam = async <TGameData = Record<string, unknown>>(
  teamNumber: number
): Promise<ScoutingEntryBase<TGameData>[]> => {
  return await apiRequest<ScoutingEntryBase<TGameData>[]>(`/matches/query`, {
    method: 'POST',
    body: JSON.stringify({ teamNumbers: [teamNumber] }),
  });
};

/**
 * Load scouting entries for a specific match
 */
export const loadScoutingEntriesByMatch = async <TGameData = Record<string, unknown>>(
  matchNumber: number
): Promise<ScoutingEntryBase<TGameData>[]> => {
  return await apiRequest<ScoutingEntryBase<TGameData>[]>(`/matches/query`, {
    method: 'POST',
    body: JSON.stringify({ matchNumbers: [matchNumber] }),
  });
};

/**
 * Load scouting entries for a specific event
 */
export const loadScoutingEntriesByEvent = async <TGameData = Record<string, unknown>>(
  eventKey: string
): Promise<ScoutingEntryBase<TGameData>[]> => {
  return await apiRequest<ScoutingEntryBase<TGameData>[]>(`/events/${eventKey}/matches`, {
    method: 'GET',
  });
};

/**
 * Load scouting entries for a team at a specific event
 */
export const loadScoutingEntriesByTeamAndEvent = async <TGameData = Record<string, unknown>>(
  teamNumber: number,
  eventKey: string
): Promise<ScoutingEntryBase<TGameData>[]> => {
  const filters: QueryFilters = { teamNumbers: [teamNumber], eventKeys: [eventKey] };
  return await apiRequest<ScoutingEntryBase<TGameData>[]>(`/matches/query`, {
    method: 'POST',
    body: JSON.stringify(filters),
  });
};

/**
 * Find existing entry by match/team/alliance/event
 */
export const findExistingScoutingEntry = async <TGameData = Record<string, unknown>>(
  matchNumber: number,
  teamNumber: number,
  allianceColor: 'red' | 'blue',
  eventKey: string
): Promise<ScoutingEntryBase<TGameData> | undefined> => {
  const filters: QueryFilters = {
    matchNumbers: [matchNumber],
    teamNumbers: [teamNumber],
    alliances: [allianceColor],
    eventKeys: [eventKey],
  };
  const entries = await apiRequest<ScoutingEntryBase<TGameData>[]>(`/matches/query`, {
    method: 'POST',
    body: JSON.stringify(filters),
  });
  return entries.length > 0 ? entries[0] : undefined;
};

/**
 * Update entry with correction metadata
 */
export const updateScoutingEntryWithCorrection = async <TGameData = Record<string, unknown>>(
  id: string,
  newData: ScoutingEntryBase<TGameData>,
  correctionNotes: string,
  correctedBy: string
): Promise<void> => {
  const entries = await apiRequest<ScoutingEntryBase<TGameData>[]>(`/matches/query`, {
    method: 'POST',
    body: JSON.stringify({ ids: [id] }),
  });
  const existingEntry = entries[0];

  if (!existingEntry) {
    throw new Error('Entry not found for correction');
  }

  const updatedEntry = {
    ...newData,
    timestamp: Date.now(),
    isCorrected: true,
    correctionCount: (existingEntry.correctionCount || 0) + 1,
    lastCorrectedAt: Date.now(),
    lastCorrectedBy: correctedBy,
    correctionNotes,
  };

  return saveScoutingEntry(updatedEntry);
};

/**
 * Delete a single scouting entry
 */
export const deleteScoutingEntry = async (id: string): Promise<void> => {
  await apiRequest(`/matches/${id}`, { method: 'DELETE' });
};

export const deleteScoutingEntriesByEvent = async (eventKey: string): Promise<void> => {
  await apiRequest(`/matches/events/${eventKey}`, { method: 'DELETE' });
};

/**
 * Clear all scouting data
 */
export const clearAllScoutingData = async (): Promise<void> => {
  await apiRequest('/matches/all', { method: 'DELETE' });
};

// ============================================================================
// STATISTICS AND UTILITIES
// ============================================================================

/**
 * Get database statistics
 */
export const getDBStats = async (): Promise<DBStats> => {
  return await apiRequest<DBStats>('/stats', { method: 'GET' });
};

/**
 * Advanced query with multiple filters
 */
export const queryScoutingEntries = async <TGameData = Record<string, unknown>>(
  filters: QueryFilters
): Promise<ScoutingEntryBase<TGameData>[]> => {
  return await apiRequest<ScoutingEntryBase<TGameData>[]>(`/matches/query`, {
    method: 'POST',
    body: JSON.stringify(filters),
  });
};

// ============================================================================
// IMPORT/EXPORT
// ============================================================================

export const exportScoutingData = async <TGameData = Record<string, unknown>>(): Promise<
  ScoutingDataExport<TGameData>
> => {
  const entries = (await loadAllScoutingEntries()) as ScoutingEntryBase<TGameData>[];
  return {
    entries,
    exportedAt: Date.now(),
    version: '3.0-maneuver-core',
  };
};

export const importScoutingData = async <TGameData = Record<string, unknown>>(
  importData: { entries: ScoutingEntryBase<TGameData>[] },
  mode: 'append' | 'overwrite' = 'append'
): Promise<ImportResult> => {
  try {
    // We send the mode and data to the API in one go.
    // The server handles the transaction (clearing if overwrite, or UPSERT if append).
    const result = await apiRequest<ImportResult>('/matches/import', {
      method: 'POST',
      body: JSON.stringify({
        entries: importData.entries,
        mode,
      }),
    });

    return result;
  } catch (error) {
    console.error('Import failed:', error);
    return {
      success: false,
      importedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};
// ============================================================================
// PIT SCOUTING OPERATIONS
// ============================================================================

export const savePitScoutingEntry = async (entry: PitScoutingEntryBase): Promise<void> => {
  await apiRequest('/pit', {
    method: 'POST',
    body: JSON.stringify(entry),
  });
};

export const savePitScoutingEntries = async (entries: PitScoutingEntryBase[]): Promise<void> => {
  await apiRequest('/pit/bulk', {
    method: 'POST',
    body: JSON.stringify(entries),
  });
};

export const loadAllPitScoutingEntries = async (): Promise<PitScoutingEntryBase[]> => {
  return await apiRequest<PitScoutingEntryBase[]>('/pit/query', { method: 'GET' });
};

export const loadPitScoutingByTeam = async (
  teamNumber: number
): Promise<PitScoutingEntryBase[]> => {
  return await apiRequest<PitScoutingEntryBase[]>(`/pit/query`, {
    method: 'POST',
    body: JSON.stringify({ teamNumber }),
  });
};

export const loadPitScoutingByTeamAndEvent = async (
  teamNumber: number,
  eventKey: string
): Promise<PitScoutingEntryBase | undefined> => {
  const results = await apiRequest<PitScoutingEntryBase[]>(`/pit/query`, {
    method: 'POST',
    body: JSON.stringify({ teamNumber, eventKey }),
  });
  return results[0];
};

export const loadPitScoutingByEvent = async (eventKey: string): Promise<PitScoutingEntryBase[]> => {
  return await apiRequest<PitScoutingEntryBase[]>(`/pit/event/${eventKey.toLowerCase()}`, {
    method: 'GET',
  });
};

export const deletePitScoutingEntry = async (id: string): Promise<void> => {
  await apiRequest(`/pit/${id}`, { method: 'DELETE' });
};

export const clearAllPitScoutingData = async (): Promise<void> => {
  await apiRequest('/pit/all', { method: 'DELETE' });
};

export const deletePitScoutingEntriesByEvent = async (eventKey: string): Promise<void> => {
  await apiRequest(`/pit/events/${eventKey.toLowerCase()}`, { method: 'DELETE' });
};

export const getPitScoutingStats = async (): Promise<PitScoutingStats> => {
  return await apiRequest<PitScoutingStats>('/pit/stats', { method: 'GET' });
};
