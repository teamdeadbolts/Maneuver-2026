import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useGame } from '@/core/contexts/GameContext';
import {
  loadAllScoutingEntries,
  loadAllPitScoutingEntries,
  loadScoutingEntriesByTeamAndEvent,
  loadScoutingEntriesByTeam,
} from '@/core/db/database';
import type { TeamStats } from '@/types/game-interfaces';
import type { ScoutingEntryBase } from '@/types/scouting-entry';
import { getCachedTBAEventMatches } from '@/core/lib/tbaCache';
import { calculateFuelOPR } from '@/game-template/fuelOpr';

/**
 * useTeamStats - Hook for the Team Statistics page
 *
 * Handles loading available teams, events, and calculating
 * statistics using the game-specific StrategyAnalysis implementation.
 */
export const useTeamStats = () => {
  const { analysis } = useGame();

  const [availableTeams, setAvailableTeams] = useState<string[]>([]);
  const [availableEvents, setAvailableEvents] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const fuelOprCacheRef = useRef<
    Map<string, Map<number, { auto: number; teleop: number; total: number }>>
  >(new Map());

  // Load basic metadata (teams and events)
  useEffect(() => {
    const loadMetadata = async () => {
      setIsLoading(true);
      try {
        const [entries, pitEntries] = await Promise.all([
          loadAllScoutingEntries(),
          loadAllPitScoutingEntries(),
        ]);

        // Extract unique teams (sorted)
        const teams = [
          ...new Set([
            ...entries.map(e => String(e.teamNumber)).filter(Boolean),
            ...pitEntries.map(e => String(e.teamNumber)).filter(Boolean),
          ]),
        ];
        teams.sort((a, b) => parseInt(a) - parseInt(b));
        setAvailableTeams(teams);

        // Extract unique events (sorted)
        const events = [
          ...new Set([
            ...entries.map(e => e.eventKey).filter(Boolean),
            ...pitEntries.map(e => e.eventKey).filter(Boolean),
          ]),
        ];
        events.sort();
        setAvailableEvents(events);
      } catch (error) {
        console.error('Error loading team stats metadata:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMetadata();
  }, []);

  /**
   * Calculate stats for a specific team and optional event
   */
  const calculateStats = useCallback(
    async (teamNumber: string, eventFilter?: string): Promise<TeamStats | null> => {
      if (!teamNumber) return null;

      try {
        let entries: ScoutingEntryBase[];
        const teamNum = parseInt(teamNumber);

        if (eventFilter && eventFilter !== 'all') {
          entries = await loadScoutingEntriesByTeamAndEvent(teamNum, eventFilter);
        } else {
          entries = await loadScoutingEntriesByTeam(teamNum);
        }

        if (entries.length === 0) {
          // Return a basic object with matchesPlayed: 0
          return {
            teamNumber: teamNum,
            eventKey: eventFilter || '',
            matchCount: 0,
            totalPoints: 0,
            autoPoints: 0,
            teleopPoints: 0,
            endgamePoints: 0,
            overall: {
              avgTotalPoints: 0,
              totalPiecesScored: 0,
              avgGamePiece1: 0,
              avgGamePiece2: 0,
            },
            auto: {
              avgPoints: 0,
              avgGamePiece1: 0,
              avgGamePiece2: 0,
              mobilityRate: 0,
              startPositions: [],
            },
            teleop: { avgPoints: 0, avgGamePiece1: 0, avgGamePiece2: 0 },
            endgame: { avgPoints: 0, climbRate: 0, parkRate: 0 },
            matchesPlayed: 0,
          } as TeamStats;
        }

        // Use the game-specific analysis implementation
        const baseStats = analysis.calculateBasicStats(entries) as TeamStats & {
          fuelAutoOPR?: number;
          fuelTeleopOPR?: number;
          fuelTotalOPR?: number;
        };

        const cacheKey = eventFilter && eventFilter !== 'all' ? eventFilter : 'all';
        let oprByTeam = fuelOprCacheRef.current.get(cacheKey);

        if (!oprByTeam) {
          const eventKeys =
            eventFilter && eventFilter !== 'all'
              ? [eventFilter]
              : [...new Set(entries.map(entry => entry.eventKey).filter(Boolean))];

          const allMatches = (
            await Promise.all(eventKeys.map(eventKey => getCachedTBAEventMatches(eventKey, true)))
          ).flat();

          const oprResult = calculateFuelOPR(allMatches, {
            ridgeLambda: 0.75,
            includePlayoffs: false,
          });

          oprByTeam = new Map(
            oprResult.teams.map(team => [
              team.teamNumber,
              {
                auto: team.autoFuelOPR,
                teleop: team.teleopFuelOPR,
                total: team.totalFuelOPR,
              },
            ])
          );

          fuelOprCacheRef.current.set(cacheKey, oprByTeam);
        }

        const teamOpr = oprByTeam.get(teamNum);

        const round1 = (value: number) => Math.round(value * 10) / 10;

        baseStats.fuelAutoOPR = round1(teamOpr?.auto ?? 0);
        baseStats.fuelTeleopOPR = round1(teamOpr?.teleop ?? 0);
        baseStats.fuelTotalOPR = round1(teamOpr?.total ?? 0);

        return baseStats;
      } catch (error) {
        console.error(`Error calculating stats for team ${teamNumber}:`, error);
        return null;
      }
    },
    [analysis]
  );

  // Provide display configurations from analysis
  const displayConfig = useMemo(
    () => ({
      statSections: analysis.getStatSections(),
      rateSections: analysis.getRateSections(),
      matchBadges: analysis.getMatchBadges(),
      startPositionConfig: analysis.getStartPositionConfig(),
    }),
    [analysis]
  );

  return {
    availableTeams,
    availableEvents,
    displayConfig,
    calculateStats,
    isLoading,
  };
};
