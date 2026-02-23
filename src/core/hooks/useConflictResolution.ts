import { useState } from 'react';
import { toast } from 'sonner';
import type { ConflictInfo } from '@/core/lib/scoutingDataUtils';
import type { ScoutingEntryBase } from '@/types/scouting-entry';
import { apiRequest } from '@/core/db/database';

// Debug logging helper - only logs in development
const DEBUG = import.meta.env.DEV;
const debugLog = (...args: unknown[]) => {
  if (DEBUG) console.log(...args);
};

export const useConflictResolution = () => {
  // Conflict resolution state
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [currentConflicts, setCurrentConflicts] = useState<ConflictInfo[]>([]);
  const [currentConflictIndex, setCurrentConflictIndex] = useState(0);
  const [conflictResolutions, setConflictResolutions] = useState<Map<string, 'replace' | 'skip'>>(
    new Map()
  );
  const [resolutionHistory, setResolutionHistory] = useState<
    Array<{ index: number; action: 'replace' | 'skip' }>
  >([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Generate conflict key from conflict info
  const getConflictKey = (conflict: ConflictInfo): string => {
    return `${conflict.local.matchNumber}-${conflict.local.teamNumber}-${conflict.local.eventKey}`;
  };

  // Handle individual conflict resolution
  const handleConflictResolution = async (action: 'replace' | 'skip') => {
    const currentConflict = currentConflicts[currentConflictIndex];
    if (!currentConflict) return;

    // Store the decision (using event, match, team as key)
    const conflictKey = getConflictKey(currentConflict);
    const updatedResolutions = new Map(conflictResolutions).set(conflictKey, action);
    setConflictResolutions(updatedResolutions);

    // Add to history
    setResolutionHistory(prev => [...prev, { index: currentConflictIndex, action }]);

    // Move to next conflict or finish
    if (currentConflictIndex < currentConflicts.length - 1) {
      setCurrentConflictIndex(currentConflictIndex + 1);
    } else {
      // All conflicts resolved, apply decisions with the updated map
      await applyConflictResolutions(updatedResolutions);
    }
  };

  /**
   * Applies conflict resolutions by sending decisions to the server.
   * The server handles the replacement/skipping atomically.
   */
  const applyConflictResolutions = async (resolutionsMap?: Map<string, 'replace' | 'skip'>) => {
    const resolutions = resolutionsMap || conflictResolutions;

    // Filter out only the entries we want to replace
    const entriesToReplace = currentConflicts
      .filter(conflict => resolutions.get(getConflictKey(conflict)) === 'replace')
      .map(conflict => conflict.incoming);

    const replacedCount = entriesToReplace.length;
    const keptCount = currentConflicts.length - replacedCount;

    try {
      if (replacedCount > 0) {
        // Send all replacements in one batch request
        // This endpoint should use "ON CONFLICT (id) DO UPDATE" logic
        await apiRequest('/matches/bulk-replace', {
          method: 'POST',
          body: JSON.stringify({ entries: entriesToReplace }),
        });
      }

      toast.success(
        `Conflict resolution complete! ${replacedCount} entries replaced, ${keptCount} entries kept.`
      );

      // Reset UI State
      setShowConflictDialog(false);
      setCurrentConflicts([]);
      setCurrentConflictIndex(0);
      setConflictResolutions(new Map());
      setResolutionHistory([]);
    } catch (error) {
      console.error('Failed to apply resolutions:', error);
      toast.error('Failed to save resolutions to the server.');
    }
  };

  /**
   * Batch resolves all remaining conflicts.
   * Offloads the heavy lifting of bulk replacement to the Postgres API.
   */
  const handleBatchResolve = async (action: 'replace' | 'skip') => {
    setIsProcessing(true);

    try {
      const remainingConflicts = currentConflicts.slice(currentConflictIndex);

      if (action === 'skip') {
        // Nothing to send to the server if we aren't replacing anything
        toast.success(`Batch skip complete! ${remainingConflicts.length} entries kept.`);
      } else {
        // Filter incoming data for all items marked for replacement
        const entriesToReplace = remainingConflicts.map(c => c.incoming);

        debugLog(`🔄 Batch replacing ${entriesToReplace.length} entries via API...`);

        // Use the bulk-replace endpoint we established earlier
        await apiRequest('/matches/bulk-replace', {
          method: 'POST',
          body: JSON.stringify({ entries: entriesToReplace }),
        });

        debugLog(`✅ Batch replacement complete.`);
        toast.success(`Batch operation complete! ${entriesToReplace.length} entries replaced.`);
      }

      // Reset UI state
      setShowConflictDialog(false);
      setCurrentConflicts([]);
      setCurrentConflictIndex(0);
      setConflictResolutions(new Map());
      setResolutionHistory([]);
    } catch (error) {
      console.error('Batch resolution failed:', error);
      toast.error('Failed to process batch resolution.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Undo last conflict resolution
  const handleUndo = () => {
    if (resolutionHistory.length === 0) return;

    const lastResolution = resolutionHistory[resolutionHistory.length - 1];
    if (!lastResolution) return; // Extra safety check

    // Remove last resolution from map
    const lastConflict = currentConflicts[lastResolution.index];
    if (!lastConflict) return; // Skip if conflict not found
    const conflictKey = getConflictKey(lastConflict);
    const newResolutions = new Map(conflictResolutions);
    newResolutions.delete(conflictKey);
    setConflictResolutions(newResolutions);

    // Remove from history
    setResolutionHistory(prev => prev.slice(0, -1));

    // Go back to that conflict
    setCurrentConflictIndex(lastResolution.index);
  };

  // Handle batch review decision (for duplicate entries)
  /**
   * Handles batch review decisions by interacting with the Postgres API.
   * Replaces O(N^2) client-side scans with efficient server-side batching.
   */
  const handleBatchReviewDecision = async (
    batchReviewEntries: ScoutingEntryBase[],
    pendingConflicts: ConflictInfo[],
    decision: 'replace-all' | 'skip-all' | 'review-each'
  ) => {
    setIsProcessing(true);

    try {
      if (decision === 'replace-all') {
        debugLog(`🔄 Batch replacing ${batchReviewEntries.length} entries via API...`);

        // We use our batch-replace endpoint which handles the "Delete existing + Insert new"
        // logic atomically on the server based on match/team/event keys.
        await apiRequest('/matches/bulk-replace', {
          method: 'POST',
          body: JSON.stringify({ entries: batchReviewEntries }),
        });

        toast.success(`Replaced ${batchReviewEntries.length} entries with incoming data`);

        // Resolve UI state for any remaining non-batch conflicts
        return processRemainingConflicts(pendingConflicts);
      } else if (decision === 'skip-all') {
        toast.success(`Kept local entries unchanged`);
        return processRemainingConflicts(pendingConflicts);
      } else if (decision === 'review-each') {
        // Instead of fetching every entry manually, we ask the server
        // to populate the conflict details (local vs incoming) for the review UI.
        const conflictsForReview = await apiRequest<ConflictInfo[]>(
          '/matches/resolve/prepare-review',
          {
            method: 'POST',
            body: JSON.stringify({ entries: batchReviewEntries }),
          }
        );

        return processRemainingConflicts([...conflictsForReview, ...pendingConflicts]);
      }

      return { hasMoreConflicts: false };
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Helper to update state if more conflicts exist
   */
  const processRemainingConflicts = (conflicts: ConflictInfo[]) => {
    if (conflicts.length > 0) {
      setCurrentConflicts(conflicts);
      setCurrentConflictIndex(0);
      setConflictResolutions(new Map());
      setShowConflictDialog(true);
      return { hasMoreConflicts: true };
    }
    return { hasMoreConflicts: false };
  };

  return {
    // State
    showConflictDialog,
    setShowConflictDialog,
    currentConflicts,
    setCurrentConflicts,
    currentConflictIndex,
    setCurrentConflictIndex,
    conflictResolutions,
    setConflictResolutions,
    resolutionHistory,
    setResolutionHistory,
    isProcessing,

    // Actions
    handleConflictResolution,
    handleBatchResolve,
    handleUndo,
    applyConflictResolutions,
    handleBatchReviewDecision,

    // Computed
    canUndo: resolutionHistory.length > 0,
    currentConflict: currentConflicts[currentConflictIndex],
    hasMoreConflicts: currentConflictIndex < currentConflicts.length - 1,
  };
};
