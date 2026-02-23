/**
 * submitMatch - Shared match submission logic
 *
 * This utility can be called from any page that needs to submit match data.
 * It handles data transformation, database saving, and cleanup.
 */

import { apiRequest } from '@/core/db/database';
import { clearScoutingLocalStorage } from '@/core/lib/utils';
import { toast } from 'sonner';
import type { DataTransformation } from '@/types';

interface MatchInputs {
  eventKey: string;
  matchNumber: string;
  matchType: 'qm' | 'sf' | 'f';
  selectTeam: string;
  alliance: 'red' | 'blue';
  scoutName: string;
  startPosition?: boolean[];
}

interface SubmitOptions {
  /** Match inputs from navigation state */
  inputs: MatchInputs;
  /** Game-specific data transformation */
  transformation: DataTransformation;
  /** Optional comment */
  comment?: string;
  /** Flag for no-show submission (robot did not appear for match) */
  noShow?: boolean;
  /** Callback on successful submission */
  onSuccess?: () => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

/**
 * Get action array from localStorage
 */
function getActionsFromLocalStorage(phase: string): unknown[] {
  const saved = localStorage.getItem(`${phase}StateStack`);
  return saved ? JSON.parse(saved) : [];
}

/**
 * Get robot status from localStorage
 */
function getRobotStatusFromLocalStorage(phase: string): Record<string, unknown> {
  const saved = localStorage.getItem(`${phase}RobotStatus`);
  return saved ? JSON.parse(saved) : {};
}

/**
 * Build match key from match type and number
 */
function buildMatchKey(
  matchType: string,
  matchNumber: string
): { matchKey: string; numericMatch: number } {
  const numericMatch = parseInt(matchNumber) || 0;

  if (matchType === 'sf') {
    // Semifinal: user enters "1" → becomes "sf1m1"
    return { matchKey: `sf${matchNumber}m1`, numericMatch };
  } else if (matchType === 'f') {
    // Final: user enters "2" → becomes "f1m2"
    return { matchKey: `f1m${matchNumber}`, numericMatch };
  } else {
    // Qualification match: qm24
    return { matchKey: `qm${matchNumber}`, numericMatch };
  }
}

/**
 * Submit match data to database
 *
 * This function:
 * 1. Retrieves all action/status data from localStorage
 * 2. Transforms actions to counter fields using game transformation
 * 3. Saves the entry to IndexedDB
 * 4. Clears localStorage and increments match number
 *
 * @param options.noShow - If true, submits a minimal entry with noShow flag and skips data collection
 */
/**
 * Submits match data to the Postgres API.
 * Replaces the local Dexie 'put' with a network POST request.
 */
export async function submitMatchData({
  inputs,
  transformation,
  comment = '',
  noShow = false,
  onSuccess,
  onError,
}: SubmitOptions): Promise<boolean> {
  try {
    const { matchKey, numericMatch } = buildMatchKey(inputs.matchType || 'qm', inputs.matchNumber);

    // Common fields for both regular and no-show entries
    const baseEntry = {
      id: `${inputs.eventKey}::${matchKey}::${inputs.selectTeam}::${inputs.alliance}`,
      scoutName: inputs.scoutName || '',
      teamNumber: parseInt(inputs.selectTeam) || 0,
      matchNumber: numericMatch,
      eventKey: inputs.eventKey,
      matchKey: matchKey,
      allianceColor: inputs.alliance,
      timestamp: Date.now(),
      comments: comment,
    };

    let finalEntry: Record<string, unknown>;

    if (noShow) {
      finalEntry = {
        ...baseEntry,
        noShow: true,
        comments: comment || 'No Show - Robot did not appear for this match',
        gameData: {
          auto: { startPosition: inputs.startPosition },
          teleop: {},
          endgame: {},
        },
      };
    } else {
      // Collect and transform local session data
      const autoActions = getActionsFromLocalStorage('auto');
      const teleopActions = getActionsFromLocalStorage('teleop');
      const autoRobotStatus = getRobotStatusFromLocalStorage('auto');
      const teleopRobotStatus = getRobotStatusFromLocalStorage('teleop');
      const endgameRobotStatus = getRobotStatusFromLocalStorage('endgame');

      const transformedGameData = transformation.transformActionsToCounters({
        autoActions,
        teleopActions,
        autoRobotStatus,
        teleopRobotStatus,
        endgameRobotStatus,
        startPosition: inputs.startPosition,
      });

      finalEntry = {
        ...baseEntry,
        gameData: transformedGameData,
      };
    }

    // POST the completed entry to the Postgres API
    await apiRequest('/matches', {
      method: 'POST',
      body: JSON.stringify(finalEntry),
    });

    // Cleanup local session state
    clearScoutingLocalStorage();

    // Increment local match counter for the scout's workflow
    const currentMatchNumber = localStorage.getItem('currentMatchNumber') || '1';
    const nextMatchNumber = (parseInt(currentMatchNumber) + 1).toString();
    localStorage.setItem('currentMatchNumber', nextMatchNumber);

    toast.success(noShow ? 'No-show match submitted' : 'Match data saved successfully!');
    onSuccess?.();
    return true;
  } catch (error) {
    console.error('Error submitting match data:', error);
    toast.error('Error submitting match data to server');
    onError?.(error as Error);
    return false;
  }
}
