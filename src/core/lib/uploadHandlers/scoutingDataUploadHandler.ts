import { toast } from "sonner";
import { 
  loadScoutingData, 
  saveScoutingData, 
  detectConflicts,
  type ConflictInfo
} from "@/core/lib/scoutingDataUtils";
import type { ImportResult, ScoutingEntryBase } from "@/types/scouting-entry";
import { apiRequest } from "@/core/db/database";

export type UploadMode = "append" | "overwrite" | "smart-merge";

interface RawScoutingData {
  entries: ScoutingEntryBase[];
}

// Return type for async upload operations that may have conflicts
export interface UploadResult {
  hasConflicts: boolean;
  hasBatchReview?: boolean;
  batchReviewEntries?: ScoutingEntryBase[];
  conflicts?: ConflictInfo[];
  autoProcessed?: {
    added: number;
    replaced: number;
  };
}

/**
 * Handles uploading scouting data from an external source (JSON/QR)
 * Offloads validation and merging logic to the Postgres API
 */
export const handleScoutingDataUpload = async (jsonData: unknown, mode: UploadMode): Promise<UploadResult> => {
  // 1. Basic Format Validation
  let newEntries: ScoutingEntryBase[] = [];
  if (
    typeof jsonData === "object" &&
    jsonData !== null &&
    "entries" in jsonData &&
    Array.isArray((jsonData as any).entries)
  ) {
    newEntries = (jsonData as any).entries;
  } else {
    toast.error("Invalid scouting data format.");
    return { hasConflicts: false };
  }

  if (newEntries.length === 0) {
    toast.error("No valid scouting data found");
    return { hasConflicts: false };
  }

  // 2. Handle Simple Modes via existing API endpoints
  if (mode === "overwrite") {
    await saveScoutingData(newEntries); // Our new API-based save function
    toast.success(`Overwritten with ${newEntries.length} entries`);
    return { hasConflicts: false };
  }

  if (mode === "append") {
    // We use the specialized import endpoint to let Postgres handle deduplication
    const result = await apiRequest<ImportResult>('/matches/import', {
      method: 'POST',
      body: JSON.stringify({ entries: newEntries, mode: 'append' }),
    });
    toast.success(`Appended data. Total imported: ${result.importedCount}`);
    return { hasConflicts: false };
  }

  // 3. Smart Merge via API
  if (mode === "smart-merge") {
    // Call our server-side conflict detector
    const conflictResult = await detectConflicts(newEntries);
    
    const results = { added: 0, replaced: 0 };

    // Process Auto-Imports and Auto-Replaces in a single batch
    const autoProcessList = [...conflictResult.autoImport, ...conflictResult.autoReplace];
    
    if (autoProcessList.length > 0) {
      await apiRequest('/matches/bulk-replace', {
        method: 'POST',
        body: JSON.stringify({ entries: autoProcessList }),
      });
      results.added = conflictResult.autoImport.length;
      results.replaced = conflictResult.autoReplace.length;
    }

    // Return to UI for manual review if necessary
    if (conflictResult.conflicts.length > 0 || conflictResult.batchReview.length > 0) {
      const batchMessage = conflictResult.batchReview.length > 0 ? ` ${conflictResult.batchReview.length} need review.` : '';
      const conflictMessage = conflictResult.conflicts.length > 0 ? ` ${conflictResult.conflicts.length} need review.` : '';
      
      toast.success(`Processed ${results.added + results.replaced} entries.` + batchMessage + conflictMessage);

      return {
        hasConflicts: conflictResult.conflicts.length > 0,
        hasBatchReview: conflictResult.batchReview.length > 0,
        batchReviewEntries: conflictResult.batchReview,
        conflicts: conflictResult.conflicts,
        autoProcessed: results
      };
    }

    toast.success(`Smart merge complete! ${results.added} new added, ${results.replaced} replaced.`);
    return { hasConflicts: false, autoProcessed: results };
  }

  return { hasConflicts: false };
};

// Apply conflict resolutions after user makes decisions
/**
 * Applies manual conflict resolutions to the Postgres database.
 * Sends only the 'replace' decisions to the server in a single batch.
 */
export const applyConflictResolutions = async (
  conflicts: ConflictInfo[],
  resolutions: Map<string, 'replace' | 'skip'>
): Promise<{ replaced: number; skipped: number }> => {
  let replacedCount = 0;
  let skippedCount = 0;

  // Filter out only the entries where the user chose 'replace'
  const entriesToUpsert: ScoutingEntryBase[] = [];

  for (const conflict of conflicts) {
    const conflictKey = `${conflict.local.matchNumber}-${conflict.local.teamNumber}-${conflict.local.eventKey}`;
    const decision = resolutions.get(conflictKey);

    if (decision === 'replace') {
      entriesToUpsert.push(conflict.incoming);
      replacedCount++;
    } else {
      skippedCount++;
    }
  }

  try {
    if (entriesToUpsert.length > 0) {
      // Use the bulk-replace endpoint to update Postgres in one transaction
      await apiRequest('/matches/bulk-replace', {
        method: 'POST',
        body: JSON.stringify({ entries: entriesToUpsert }),
      });
      
      console.log(`Successfully replaced ${replacedCount} entries in Postgres.`);
    }

    return { replaced: replacedCount, skipped: skippedCount };
  } catch (error) {
    console.error('Error applying resolutions to Postgres:', error);
    throw new Error('Failed to save conflict resolutions to the central database.');
  }
};