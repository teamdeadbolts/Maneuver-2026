/**
 * Data manipulation utilities for scouting entries
 * Provides ID generation, conflict detection, and data transformation
 */

import type {
  ScoutingEntryBase,
  ScoutingDataWithId,
  ScoutingDataCollection,
} from '../types/scouting-entry';
import { db } from './database';

/**
 * Generate deterministic composite ID from entry fields
 * Format: event::match::team::alliance
 * 
 * This creates natural collision detection - duplicate entries
 * for the same match will have the same ID.
 * 
 * @example
 * generateDeterministicEntryId("2025mrcmp", "qm42", "3314", "red")
 * // Returns: "2025mrcmp::qm42::3314::red"
 */
export const generateDeterministicEntryId = (
  eventName: string,
  matchNumber: string,
  teamNumber: string,
  alliance: string
): string => {
  // Normalize values
  const normalizedEvent = eventName.toLowerCase().trim();
  const normalizedMatch = matchNumber.trim();
  const normalizedTeam = teamNumber.trim();
  const normalizedAlliance = alliance.toLowerCase().replace('alliance', '').trim();
  
  return `${normalizedEvent}::${normalizedMatch}::${normalizedTeam}::${normalizedAlliance}`;
};

/**
 * Generate entry ID from game data object
 * Extracts match info from data and creates composite ID
 */
export const generateEntryId = (data: Record<string, unknown>): string => {
  const eventName = String(data.eventName || '');
  const matchNumber = String(data.matchNumber || '');
  const teamNumber = String(data.selectTeam || data.teamNumber || '');
  const alliance = String(data.alliance || '');
  
  if (!eventName || !matchNumber || !teamNumber || !alliance) {
    // Fallback to hash-based ID if missing required fields
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `entry-${timestamp}-${random}`;
  }
  
  return generateDeterministicEntryId(eventName, matchNumber, teamNumber, alliance);
};

/**
 * Add IDs to entries that don't have them
 */
export const addIdsToScoutingData = <TGameData = Record<string, unknown>>(
  data: ScoutingDataCollection<TGameData>
): ScoutingDataCollection<TGameData> => {
  const entriesWithIds = data.entries.map(entry => {
    if (entry.id) {
      return entry;
    }
    
    const id = generateEntryId(entry.data as Record<string, unknown>);
    return {
      ...entry,
      id,
      timestamp: entry.timestamp || Date.now(),
    };
  });
  
  return {
    ...data,
    entries: entriesWithIds,
  };
};

/**
 * Check if data has the new ID structure
 */
export const hasIdStructure = (data: unknown): data is ScoutingDataCollection => {
  if (!data || typeof data !== 'object') {
    return false;
  }
  
  const obj = data as Record<string, unknown>;
  return 'entries' in obj && Array.isArray(obj.entries);
};

/**
 * Migrate old array format to new ID structure
 * Legacy format: { data: [...] } → New format: { entries: [...] }
 */
export const migrateToIdStructure = (legacyData: unknown): ScoutingDataCollection => {
  if (!legacyData || typeof legacyData !== 'object') {
    return { entries: [] };
  }
  
  const obj = legacyData as Record<string, unknown>;
  
  // Handle new format (already has entries)
  if ('entries' in obj && Array.isArray(obj.entries)) {
    return addIdsToScoutingData(obj as unknown as ScoutingDataCollection);
  }
  
  // Handle old format (has data array)
  if ('data' in obj && Array.isArray(obj.data)) {
    const entries = obj.data.map((item: unknown) => {
      if (typeof item !== 'object' || !item) {
        return null;
      }
      
      const data = item as Record<string, unknown>;
      const id = generateEntryId(data);
      
      return {
        id,
        data,
        timestamp: Date.now(),
      };
    }).filter(Boolean) as ScoutingDataWithId[];
    
    return { entries };
  }
  
  return { entries: [] };
};

/**
 * Conflict resolution strategies for data imports
 */
export type ConflictResolution =
  | 'autoImport'    // No conflict, safe to import
  | 'autoReplace'   // Incoming is newer, auto-replace
  | 'manualReview'; // User must decide

export interface ConflictResult<TGameData = Record<string, unknown>> {
  autoImport: ScoutingDataWithId<TGameData>[];
  autoReplace: ScoutingDataWithId<TGameData>[];
  manualReview: Array<{
    existing: ScoutingEntryBase<TGameData>;
    incoming: ScoutingDataWithId<TGameData>;
  }>;
}

/**
 * Detect conflicts between incoming and existing data
 * 
 * Logic:
 * - No existing entry → autoImport
 * - Incoming is correction (has correction metadata) → autoReplace
 * - Incoming is newer by >30 seconds → autoReplace  
 * - Otherwise → manualReview
 */
export const detectConflicts = async <TGameData = Record<string, unknown>>(
  incomingEntries: ScoutingDataWithId<TGameData>[]
): Promise<ConflictResult<TGameData>> => {
  const result: ConflictResult<TGameData> = {
    autoImport: [],
    autoReplace: [],
    manualReview: [],
  };
  
  for (const incoming of incomingEntries) {
    const existing = await db.scoutingData.get(incoming.id);
    
    if (!existing) {
      // No conflict - new entry
      result.autoImport.push(incoming);
      continue;
    }
    
    // Check if incoming is a correction
    const incomingEntry = incoming as Partial<ScoutingEntryBase<TGameData>>;
    if (incomingEntry.isCorrected) {
      result.autoReplace.push(incoming);
      continue;
    }
    
    // Check timestamps (auto-replace if incoming is significantly newer)
    const timeDiff = incoming.timestamp - existing.timestamp;
    const THIRTY_SECONDS = 30 * 1000;
    
    if (timeDiff > THIRTY_SECONDS) {
      result.autoReplace.push(incoming);
    } else if (timeDiff < -THIRTY_SECONDS) {
      // Existing is newer - don't import
      continue;
    } else {
      // Similar timestamps - manual review needed
      result.manualReview.push({
        existing: existing as ScoutingEntryBase<TGameData>,
        incoming,
      });
    }
  }
  
  return result;
};

/**
 * Merge scouting data collections with deduplication
 */
export const mergeScoutingData = <TGameData = Record<string, unknown>>(
  existingData: ScoutingDataWithId<TGameData>[],
  newData: ScoutingDataWithId<TGameData>[]
): {
  merged: ScoutingDataWithId<TGameData>[];
  stats: {
    existing: number;
    new: number;
    duplicates: number;
    final: number;
  };
} => {
  if (existingData.length === 0) {
    return {
      merged: newData,
      stats: {
        existing: 0,
        new: newData.length,
        duplicates: 0,
        final: newData.length,
      },
    };
  }
  
  const existingIds = new Set(existingData.map(entry => entry.id));
  const uniqueNewData = newData.filter(entry => !existingIds.has(entry.id));
  const duplicateCount = newData.length - uniqueNewData.length;
  
  const merged = [...existingData, ...uniqueNewData];
  
  return {
    merged,
    stats: {
      existing: existingData.length,
      new: uniqueNewData.length,
      duplicates: duplicateCount,
      final: merged.length,
    },
  };
};

/**
 * Find existing entry in database that matches incoming data
 * Supports fallback matching when eventName is missing
 */
export const findExistingEntry = async (
  incomingData: Record<string, unknown>
): Promise<ScoutingEntryBase | undefined> => {
  const matchNumber = String(incomingData.matchNumber || '');
  const teamNumber = String(incomingData.selectTeam || incomingData.teamNumber || '');
  const alliance = String(incomingData.alliance || '')
    .toLowerCase()
    .replace('alliance', '')
    .trim();
  const eventName = String(incomingData.eventName || '').toLowerCase();
  
  if (!matchNumber || !teamNumber || !alliance) {
    return undefined;
  }
  
  // Try with event name first (fastest)
  if (eventName) {
    const entry = await db.scoutingData
      .where({ matchNumber, teamNumber, alliance, eventName })
      .first();
    
    if (entry) {
      return entry;
    }
  }
  
  // Fallback: search without event name
  const entries = await db.scoutingData
    .where({ matchNumber, teamNumber, alliance })
    .toArray();
  
  return entries[0];
};

/**
 * Extract legacy data format from entries (for backward compatibility)
 * Converts { entries: [...] } → [...data objects...]
 */
export const extractLegacyData = <TGameData = Record<string, unknown>>(
  entries: ScoutingDataWithId<TGameData>[]
): Record<string, unknown>[] => {
  return entries.map(entry => entry.data as Record<string, unknown>);
};

/**
 * Load scouting data from database
 */
export const loadScoutingData = async <TGameData = Record<string, unknown>>(): Promise<
  ScoutingDataCollection<TGameData>
> => {
  try {
    const { loadAllScoutingEntries } = await import('./database');
    const entries = await loadAllScoutingEntries<TGameData>();
    
    // Convert to ScoutingDataWithId format
    const dataWithIds: ScoutingDataWithId<TGameData>[] = entries.map(entry => ({
      id: entry.id,
      data: entry.data,
      timestamp: entry.timestamp,
    }));
    
    return { entries: dataWithIds };
  } catch (error) {
    console.error('Error loading scouting data:', error);
    return { entries: [] };
  }
};

/**
 * Load legacy format data for backward compatibility
 */
export const loadLegacyScoutingData = async (): Promise<Record<string, unknown>[]> => {
  const data = await loadScoutingData();
  return extractLegacyData(data.entries);
};

/**
 * Save scouting data to database
 */
export const saveScoutingData = async <TGameData = Record<string, unknown>>(
  data: ScoutingDataCollection<TGameData>
): Promise<void> => {
  try {
    const { saveScoutingEntries } = await import('./database');
    await saveScoutingEntries(data.entries);
  } catch (error) {
    console.error('Error saving scouting data:', error);
    throw error;
  }
};
