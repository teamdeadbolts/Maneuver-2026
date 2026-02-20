/**
 * Scouting Database - Query Functions
 * 
 * Provides query functions to retrieve scouting data from IndexedDB.
 */

import { apiRequest } from '@/core/db/database';
import type { ScoutingEntryBase } from '@/core/types/scouting-entry';

/**
 * Get all scouting entries for an event
 */
export async function getEntriesByEvent(
    eventKey: string
): Promise<Array<ScoutingEntryBase<Record<string, unknown>> & {
    matchKey: string;
    matchNumber: number;
    allianceColor: 'red' | 'blue';
    scoutName: string;
    gameData: Record<string, unknown>;
}>> {
    try {
        // Query only entries for this specific eventKey
        const entries = await apiRequest<Array<ScoutingEntryBase<Record<string, unknown>>>>(
            `/events/${eventKey.toLowerCase()}/matches`, 
            { method: 'GET' }
        );

        console.log(`[API] Found ${entries.length} entries for event ${eventKey}`);

        // The API should ideally return the transformed data, 
        // but we can maintain the mapping logic here for backward compatibility.
        return entries.map(entry => ({
            ...entry,
            matchKey: entry.matchKey || `${eventKey}_qm${entry.matchNumber}`,
            matchNumber: entry.matchNumber,
            allianceColor: entry.allianceColor,
            scoutName: entry.scoutName,
            gameData: (entry.gameData || {}) as Record<string, unknown>,
        }));
    } catch (error) {
        console.error('[API] Error loading entries by event:', error);
        return [];
    }
}