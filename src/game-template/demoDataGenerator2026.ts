/**
 * 2026 Game-Specific Demo Data Generator
 * 
 * Generates realistic 2026 FUEL game data based on team skill profiles.
 * Outputs raw match data that gets transformed through gameDataTransformation.
 */

import type { GameDataGenerator } from '@/core/lib/demoDataGenerator';
import { gameDataTransformation } from './transformation';

// Field element positions (normalized 0-1) for realistic waypoint placement
const POSITIONS = {
    hub: { x: 0.31, y: 0.50 },
    depot: { x: 0.09, y: 0.29 },
    outpost: { x: 0.09, y: 0.87 },
    tower: { x: 0.10, y: 0.53 },
    trench1: { x: 0.31, y: 0.13 },
    bump1: { x: 0.31, y: 0.32 },
    bump2: { x: 0.31, y: 0.68 },
    trench2: { x: 0.31, y: 0.87 },
    pass: { x: 0.50, y: 0.50 },
} as const;

/** Add small random jitter to a position (stays within 0-1 range) */
function jitter(pos: { x: number; y: number }, spread = 0.05): { x: number; y: number } {
    return {
        x: Math.max(0, Math.min(1, pos.x + (Math.random() - 0.5) * spread)),
        y: Math.max(0, Math.min(1, pos.y + (Math.random() - 0.5) * spread)),
    };
}

/**
 * Generate realistic 2026 game data based on team skill profile
 */
export const generate2026GameData: GameDataGenerator = (profile, matchKey) => {
    const isPlayoff = matchKey.includes('qf') || matchKey.includes('sf') || matchKey.includes('f');

    // =========================================================================
    // Auto Phase - Generate PathWaypoint-style actions
    // =========================================================================
    const autoActions: any[] = [];

    // Start position (required by transformation)
    const startPositionIndex = Math.floor(Math.random() * 5); // 0-4: trench1, bump1, hub, bump2, trench2
    const startPositions = ['trench1', 'bump1', 'hub', 'bump2', 'trench2'] as const;
    const startKey = startPositions[startPositionIndex]!;
    autoActions.push({
        type: 'start',
        action: startKey,
        timestamp: Date.now(),
        position: POSITIONS[startKey],
    });

    // Auto fuel scoring - Elite teams can score 100-150 in auto
    // Elite: 100-150, Strong: 60-100, Average: 30-60, Developing: 10-30
    let autoFuelCount = 0;
    if (profile.skillLevel === 'elite') {
        autoFuelCount = 100 + Math.floor(Math.random() * 51);
    } else if (profile.skillLevel === 'strong') {
        autoFuelCount = 60 + Math.floor(Math.random() * 41);
    } else if (profile.skillLevel === 'average') {
        autoFuelCount = 30 + Math.floor(Math.random() * 31);
    } else {
        autoFuelCount = 10 + Math.floor(Math.random() * 21);
    }

    // Apply consistency variance and accuracy
    const variance = 1 - profile.consistency;
    autoFuelCount = Math.max(0, Math.floor(autoFuelCount * (1 + (Math.random() - 0.5) * variance)));
    autoFuelCount = Math.floor(autoFuelCount * profile.autoAccuracy);

    // Add fuel scored waypoints (near hub with jitter)
    for (let i = 0; i < autoFuelCount; i++) {
        autoActions.push({
            type: 'score',
            action: 'fuelScored',
            timestamp: Date.now() + i * 1000,
            position: jitter(POSITIONS.hub, 0.08),
            fuelDelta: -1,
        });
    }

    // Some robots collect from depot/outpost
    if (Math.random() < 0.4) {
        const collectCount = Math.floor(Math.random() * 3);
        for (let i = 0; i < collectCount; i++) {
            const isDepot = Math.random() < 0.5;
            autoActions.push({
                type: 'collect',
                action: isDepot ? 'depot' : 'outpost',
                timestamp: Date.now() + i * 1500,
                position: isDepot ? POSITIONS.depot : POSITIONS.outpost,
            });
        }
    }

    // =========================================================================
    // Teleop Phase - Generate PathWaypoint-style actions
    // =========================================================================
    const teleopActions: any[] = [];

    // Determine robot role - some robots are passers
    const isPasser = Math.random() < 0.25; // 25% chance to be a passer

    // Teleop fuel activity - Best robots ~400-500 total
    // Elite: 250-400, Strong: 180-280, Average: 100-200, Developing: 50-120
    let teleopFuelActivity = 0;
    if (profile.skillLevel === 'elite') {
        teleopFuelActivity = 250 + Math.floor(Math.random() * 151);
    } else if (profile.skillLevel === 'strong') {
        teleopFuelActivity = 180 + Math.floor(Math.random() * 101);
    } else if (profile.skillLevel === 'average') {
        teleopFuelActivity = 100 + Math.floor(Math.random() * 101);
    } else {
        teleopFuelActivity = 50 + Math.floor(Math.random() * 71);
    }

    // Apply variance and accuracy
    teleopFuelActivity = Math.max(0, Math.floor(teleopFuelActivity * (1 + (Math.random() - 0.5) * variance)));
    teleopFuelActivity = Math.floor(teleopFuelActivity * profile.teleopAccuracy);

    // In playoffs, teams push harder
    if (isPlayoff) {
        teleopFuelActivity = Math.floor(teleopFuelActivity * 1.15);
    }

    // Split between scoring and passing based on role
    let teleopFuelCount = 0;
    let teleopPassCount = 0;

    if (isPasser) {
        // Passers: 30% score, 70% pass
        teleopFuelCount = Math.floor(teleopFuelActivity * 0.3);
        teleopPassCount = Math.floor(teleopFuelActivity * 0.7);
    } else {
        // Scorers: 85% score, 15% pass
        teleopFuelCount = Math.floor(teleopFuelActivity * 0.85);
        teleopPassCount = Math.floor(teleopFuelActivity * 0.15);
    }

    // Add fuel scored waypoints (near hub with jitter)
    for (let i = 0; i < teleopFuelCount; i++) {
        teleopActions.push({
            type: 'score',
            action: 'fuelScored',
            timestamp: Date.now() + i * 500,
            position: jitter(POSITIONS.hub, 0.08),
            fuelDelta: -1,
        });
    }

    // Add fuel passed waypoints (near pass zone)
    for (let i = 0; i < teleopPassCount; i++) {
        teleopActions.push({
            type: 'pass',
            action: 'fuelPassed',
            timestamp: Date.now() + i * 800,
            position: jitter(POSITIONS.pass, 0.06),
            fuelDelta: -1,
        });
    }

    // =========================================================================
    // Robot Status (Toggles)
    // =========================================================================
    const autoRobotStatus: Record<string, boolean> = {
        // Auto climb L1 (15 pts) - elite teams sometimes do this
        autoClimbL1: profile.skillLevel === 'elite' && Math.random() < 0.2,
    };

    const teleopRobotStatus: Record<string, boolean> = {
        // Defense play
        playedDefense: Math.random() < 0.2,
    };

    // =========================================================================
    // Endgame Robot Status (Tower Climbing + Roles)
    // =========================================================================
    const endgameRobotStatus: Record<string, boolean> = {
        // Tower climb (mutually exclusive)
        climbL1: false,
        climbL2: false,
        climbL3: false,
        climbFailed: false,
    };

    // Determine climb level based on skill and endgame success
    const endgameRoll = Math.random();

    if (endgameRoll < profile.endgameSuccess) {
        // Successful climb - pick level based on skill
        if (profile.skillLevel === 'elite' && Math.random() < 0.7) {
            // Elite teams often go for level 3
            endgameRobotStatus.climbL3 = true;
        } else if (profile.skillLevel === 'strong' || (profile.skillLevel === 'elite' && Math.random() < 0.9)) {
            // Strong teams usually level 2
            endgameRobotStatus.climbL2 = true;
        } else {
            // Average/developing teams go for level 1
            endgameRobotStatus.climbL1 = true;
        }
    } else {
        // Failed climb
        endgameRobotStatus.climbFailed = true;
    }

    // Active phase roles (multi-select) - favor passer role if isPasser
    const activeRoles = ['roleActiveCycler', 'roleActiveCleanUp', 'roleActivePasser', 'roleActiveDefense', 'roleActiveThief'];
    let selectedActiveRole;
    if (isPasser && Math.random() < 0.7) {
        selectedActiveRole = 'roleActivePasser';
    } else {
        selectedActiveRole = activeRoles[Math.floor(Math.random() * activeRoles.length)];
    }
    if (selectedActiveRole) {
        endgameRobotStatus[selectedActiveRole] = true;
    }

    // Inactive phase roles (multi-select)
    const inactiveRoles = ['roleInactiveCycler', 'roleInactiveCleanUp', 'roleInactivePasser'];
    let selectedInactiveRole;
    if (isPasser && Math.random() < 0.7) {
        selectedInactiveRole = 'roleInactivePasser';
    } else {
        selectedInactiveRole = inactiveRoles[Math.floor(Math.random() * inactiveRoles.length)];
    }
    if (selectedInactiveRole) {
        endgameRobotStatus[selectedInactiveRole] = true;
    }

    // Passing zones (multi-select) - passers more likely to have these
    if (isPasser || Math.random() < 0.3) {
        endgameRobotStatus.passedToAlliance = true;
    }
    if (isPasser && Math.random() < 0.6) {
        endgameRobotStatus.passedToNeutral = true;
    }

    // Accuracy (mutually exclusive)
    const accuracyLevels = ['accuracyAll', 'accuracyMost', 'accuracySome', 'accuracyFew', 'accuracyLittle'];
    let accuracyIndex = 2; // Default to "some"
    if (profile.teleopAccuracy > 0.9) accuracyIndex = 0; // All
    else if (profile.teleopAccuracy > 0.75) accuracyIndex = 1; // Most
    else if (profile.teleopAccuracy > 0.5) accuracyIndex = 2; // Some
    else if (profile.teleopAccuracy > 0.25) accuracyIndex = 3; // Few
    else accuracyIndex = 4; // Little

    const selectedAccuracy = accuracyLevels[accuracyIndex];
    if (selectedAccuracy) {
        endgameRobotStatus[selectedAccuracy] = true;
    }

    // Corral usage
    endgameRobotStatus.usedCorral = Math.random() < 0.3;

    // =========================================================================
    // Optional Stalls and Stuck states (Obstacles)
    // =========================================================================

    // Auto stuck chance (5%)
    if (Math.random() < 0.05) {
        const obstacleKey = Math.random() < 0.5 ? 'trench1' : 'bump1';
        const obstacleType = obstacleKey.includes('trench') ? 'trench' : 'bump';
        const duration = 2000 + Math.floor(Math.random() * 5000);
        const timestamp = Date.now() + 5000;

        autoActions.push({
            type: 'stuck',
            action: `stuck-${obstacleType}`,
            timestamp,
            position: POSITIONS[obstacleKey],
            obstacleType
        });

        autoActions.push({
            type: 'unstuck',
            action: `unstuck-${obstacleType}`,
            timestamp: timestamp + duration,
            position: POSITIONS[obstacleKey],
            duration,
            obstacleType,
            amountLabel: `${Math.round(duration / 1000)}s`
        });
    }

    // Teleop stuck chance (15%)
    if (Math.random() < 0.15) {
        const obstacleKey = Math.random() < 0.5 ? 'trench2' : 'bump2';
        const obstacleType = obstacleKey.includes('trench') ? 'trench' : 'bump';
        const duration = 3000 + Math.floor(Math.random() * 15000);
        const timestamp = Date.now() + 30000;

        teleopActions.push({
            type: 'stuck',
            action: `stuck-${obstacleType}`,
            timestamp,
            position: POSITIONS[obstacleKey],
            obstacleType
        });

        teleopActions.push({
            type: 'unstuck',
            action: `unstuck-${obstacleType}`,
            timestamp: timestamp + duration,
            position: POSITIONS[obstacleKey],
            duration,
            obstacleType,
            amountLabel: `${Math.round(duration / 1000)}s`
        });
    }

    // Start position as boolean array (transformation also checks this)
    const startPosition = [false, false, false, false, false];
    startPosition[startPositionIndex] = true;

    // =========================================================================
    // Transform to database format using game transformation
    // =========================================================================
    const rawMatchData = {
        autoActions,
        teleopActions,
        autoRobotStatus,
        teleopRobotStatus,
        endgameRobotStatus,
        startPosition,
    };

    return gameDataTransformation.transformActionsToCounters(rawMatchData);
};
