/**
 * Database migration utilities
 * Handles data format changes and localStorage → Dexie migration
 */

import { db } from './database';
import type { ScoutingDataWithId, ScoutingDataCollection } from '../types/scouting-entry';
import { migrateToIdStructure, hasIdStructure } from './dataUtils';

/**
 * Check if migration is needed from localStorage
 */
export const checkMigrationNeeded = async (): Promise<{
  needsMigration: boolean;
  dexieCount: number;
  localStorageCount: number;
}> => {
  try {
    const dexieEntries = await db.scoutingData.count();
    
    let localStorageCount = 0;
    try {
      const existingDataStr = localStorage.getItem('scoutingData');
      if (existingDataStr) {
        const parsed = JSON.parse(existingDataStr);
        if (Array.isArray(parsed.data)) {
          localStorageCount = parsed.data.length;
        } else if (Array.isArray(parsed.entries)) {
          localStorageCount = parsed.entries.length;
        }
      }
    } catch (error) {
      console.log('No localStorage data found:', error);
    }
    
    const needsMigration = localStorageCount > 0 && dexieEntries === 0;
    
    return {
      needsMigration,
      dexieCount: dexieEntries,
      localStorageCount,
    };
  } catch (error) {
    console.error('Error checking migration status:', error);
    return {
      needsMigration: false,
      dexieCount: 0,
      localStorageCount: 0,
    };
  }
};

/**
 * Migrate data from localStorage to Dexie
 * Creates backup in localStorage before removing old data
 */
export const migrateFromLocalStorage = async (): Promise<{
  success: boolean;
  migratedCount: number;
  error?: string;
}> => {
  try {
    const existingDataStr = localStorage.getItem('scoutingData');
    if (!existingDataStr) {
      return { success: true, migratedCount: 0 };
    }
    
    const parsed = JSON.parse(existingDataStr);
    let dataToMigrate: ScoutingDataCollection;
    
    if (hasIdStructure(parsed)) {
      dataToMigrate = parsed;
    } else {
      dataToMigrate = migrateToIdStructure(parsed);
    }
    
    const { saveScoutingEntries } = await import('./database');
    await saveScoutingEntries(dataToMigrate.entries);
    
    // Create backup before removing
    localStorage.setItem('scoutingData_backup', existingDataStr);
    localStorage.removeItem('scoutingData');
    
    return {
      success: true,
      migratedCount: dataToMigrate.entries.length,
    };
  } catch (error) {
    console.error('Migration failed:', error);
    return {
      success: false,
      migratedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Clear old database versions
 * Removes legacy IndexedDB databases that are no longer used
 */
export const clearOldDatabases = async (): Promise<void> => {
  const oldDbNames = [
    'ScoutingAppDB',
    'SimpleScoutingDB_v1',
    'SimpleScoutingDB_v2',
    'ScoutingApp-DB',
    'ManeuverScoutingDB',
  ];
  
  const deletePromises = oldDbNames.map(dbName => {
    return new Promise<void>((resolve) => {
      const deleteRequest = indexedDB.deleteDatabase(dbName);
      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => resolve();
      deleteRequest.onblocked = () => resolve();
    });
  });
  
  await Promise.all(deletePromises);
};

/**
 * Regenerate IDs for all scouting entries
 * Converts old hash-based IDs to new composite key format (event::match::team::alliance)
 * 
 * This migration enables:
 * - Faster lookups (composite keys are indexed)
 * - Natural collision detection
 * - Better debugging (human-readable IDs)
 */
export const migrateScoutingEntryIds = async (): Promise<{
  updated: number;
  errors: number;
}> => {
  console.log('🔄 [Migration] Starting scouting entry ID migration...');
  
  try {
    const { loadAllScoutingEntries, deleteScoutingEntry, saveScoutingEntry } = await import('./database');
    const { generateDeterministicEntryId } = await import('./dataUtils');
    
    const allEntries = await loadAllScoutingEntries();
    console.log(`📊 [Migration] Found ${allEntries.length} entries to migrate`);
    
    let updated = 0;
    let errors = 0;
    
    for (const entry of allEntries) {
      try {
        // Skip entries missing required fields
        if (!entry.matchNumber || !entry.teamNumber || !entry.alliance || !entry.eventName) {
          console.warn(`⚠️ [Migration] Skipping entry ${entry.id} - missing required fields`);
          errors++;
          continue;
        }
        
        // Generate new composite ID
        const newId = generateDeterministicEntryId(
          entry.eventName,
          entry.matchNumber,
          entry.teamNumber,
          entry.alliance
        );
        
        // Only update if ID changed
        if (entry.id !== newId) {
          // Delete old entry
          await deleteScoutingEntry(entry.id);
          
          // Add with new ID
          const newEntry: ScoutingDataWithId = {
            id: newId,
            data: entry.data,
            timestamp: entry.timestamp,
          };
          
          await saveScoutingEntry(newEntry);
          
          updated++;
          
          if (updated % 100 === 0) {
            console.log(`✅ [Migration] Migrated ${updated} entries...`);
          }
        }
      } catch (error) {
        console.error(`❌ [Migration] Error migrating entry ${entry.id}:`, error);
        errors++;
      }
    }
    
    console.log(`✅ [Migration] Complete! Updated: ${updated}, Errors: ${errors}`);
    return { updated, errors };
  } catch (error) {
    console.error('❌ [Migration] Fatal error during migration:', error);
    throw error;
  }
};

/**
 * Migrate existing entries to populate top-level metadata fields
 * Fixes entries where scoutName/timestamp are only in data object
 * 
 * This improves query performance by ensuring indexed fields are populated
 */
export const migrateScoutingMetadata = async (): Promise<{
  updated: number;
  errors: number;
}> => {
  try {
    console.log('🔄 [Metadata Migration] Starting migration to populate top-level fields...');
    
    const allEntries = await db.scoutingData.toArray();
    console.log(`📊 [Metadata Migration] Found ${allEntries.length} entries to check`);
    
    let updated = 0;
    let errors = 0;
    
    for (const entry of allEntries) {
      try {
        const data = entry.data as Record<string, unknown>;
        let needsUpdate = false;
        const updates: Partial<typeof entry> = {};
        
        // Check if scoutName needs to be populated
        if (!entry.scoutName && data.scoutName) {
          updates.scoutName = String(data.scoutName);
          needsUpdate = true;
        }
        
        // Check if timestamp needs to be populated
        if (!entry.timestamp && data.timestamp) {
          updates.timestamp = Number(data.timestamp);
          needsUpdate = true;
        }
        
        if (needsUpdate) {
          await db.scoutingData.update(entry.id, updates);
          updated++;
          
          if (updated % 100 === 0) {
            console.log(`✅ [Metadata Migration] Updated ${updated} entries...`);
          }
        }
      } catch (error) {
        console.error(`❌ [Metadata Migration] Error updating entry ${entry.id}:`, error);
        errors++;
      }
    }
    
    console.log(`✅ [Metadata Migration] Complete! Updated: ${updated}, Errors: ${errors}`);
    return { updated, errors };
  } catch (error) {
    console.error('❌ [Metadata Migration] Fatal error:', error);
    throw error;
  }
};

/**
 * Run all necessary migrations on app startup
 */
export const runStartupMigrations = async (): Promise<void> => {
  console.log('🚀 [Startup] Checking for database migrations...');
  
  try {
    // Check if localStorage migration is needed
    const { needsMigration, localStorageCount, dexieCount } = await checkMigrationNeeded();
    
    if (needsMigration) {
      console.log(`📦 [Startup] Migrating ${localStorageCount} entries from localStorage...`);
      const result = await migrateFromLocalStorage();
      
      if (result.success) {
        console.log(`✅ [Startup] Successfully migrated ${result.migratedCount} entries`);
      } else {
        console.error(`❌ [Startup] Migration failed: ${result.error}`);
      }
    } else {
      console.log(`✅ [Startup] No migration needed (Dexie: ${dexieCount}, LocalStorage: ${localStorageCount})`);
    }
    
    // Clean up old databases
    await clearOldDatabases();
    console.log('✅ [Startup] Cleaned up old database versions');
    
  } catch (error) {
    console.error('❌ [Startup] Error during migrations:', error);
  }
};
