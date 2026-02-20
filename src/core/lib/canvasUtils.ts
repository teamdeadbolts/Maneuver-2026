/**
 * Canvas Utilities
 * 
 * Shared functions for drawing overlays and managing layered rendering.
 */

import { CANVAS_CONSTANTS } from "./canvasConstants";

type StrategyStageId = 'autonomous' | 'teleop' | 'endgame';

interface TeamSpotPoint {
    x: number;
    y: number;
}

interface TeamStageSpots {
    shooting: TeamSpotPoint[];
    passing: TeamSpotPoint[];
}

interface TeamSlotSpotVisibility {
    showShooting: boolean;
    showPassing: boolean;
}

const SLOT_COLORS = {
    red: ['#ef4444', '#dc2626', '#b91c1c'],
    blue: ['#3b82f6', '#2563eb', '#1d4ed8'],
} as const;

/**
 * Draws team numbers on the canvas based on alliance positions.
 */
export const drawTeamNumbers = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    selectedTeams: (number | null)[]
) => {
    if (!selectedTeams || selectedTeams.length !== 6) return;

    const {
        TEAM_LABEL_FONT_SIZE_RATIO,
        BLUE_ALLIANCE_X_POSITION,
        RED_ALLIANCE_X_POSITION,
        TEAM_POSITION_TOP_Y,
        TEAM_POSITION_MIDDLE_Y,
        TEAM_POSITION_BOTTOM_Y
    } = CANVAS_CONSTANTS;

    const fontSize = Math.floor(width * TEAM_LABEL_FONT_SIZE_RATIO);
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Blue alliance (left) - positions 3, 4, 5
    const blueX = width * BLUE_ALLIANCE_X_POSITION;
    const blueTeams = [
        { team: selectedTeams[3], y: height * TEAM_POSITION_TOP_Y },
        { team: selectedTeams[4], y: height * TEAM_POSITION_MIDDLE_Y },
        { team: selectedTeams[5], y: height * TEAM_POSITION_BOTTOM_Y },
    ];

    blueTeams.forEach(({ team, y }) => {
        if (team !== null && team !== undefined && team !== 0) {
            const teamStr = team.toString();
            ctx.save();
            ctx.translate(blueX, y);
            ctx.rotate(Math.PI / 2);
            ctx.fillStyle = 'white';
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 3;
            ctx.strokeText(teamStr, 0, 0);
            ctx.fillText(teamStr, 0, 0);
            ctx.restore();
        }
    });

    // Red alliance (right) - positions 0, 1, 2
    const redX = width * RED_ALLIANCE_X_POSITION;
    const redTeams = [
        { team: selectedTeams[0], y: height * TEAM_POSITION_BOTTOM_Y },
        { team: selectedTeams[1], y: height * TEAM_POSITION_MIDDLE_Y },
        { team: selectedTeams[2], y: height * TEAM_POSITION_TOP_Y },
    ];

    redTeams.forEach(({ team, y }) => {
        if (team !== null && team !== undefined && team !== 0) {
            const teamStr = team.toString();
            ctx.save();
            ctx.translate(redX, y);
            ctx.rotate(-Math.PI / 2);
            ctx.fillStyle = 'white';
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 3;
            ctx.strokeText(teamStr, 0, 0);
            ctx.fillText(teamStr, 0, 0);
            ctx.restore();
        }
    });
};

const getSlotColor = (slotIndex: number) => {
    if (slotIndex >= 3) {
        const colorIndex = Math.min(slotIndex - 3, 2);
        return SLOT_COLORS.blue[colorIndex] ?? SLOT_COLORS.blue[0];
    }

    const colorIndex = Math.min(slotIndex, 2);
    return SLOT_COLORS.red[colorIndex] ?? SLOT_COLORS.red[0];
};

const transformSpotForSlot = (spot: TeamSpotPoint, slotIndex: number): TeamSpotPoint => {
    // Red alliance slots are indices 0-2 and should be mirrored across the field center line
    if (slotIndex <= 2) {
        return {
            x: 1 - spot.x,
            y: spot.y,
        };
    }

    return spot;
};

const getSlotShapeIndex = (slotIndex: number): number => {
    // Keep same shape per slot position across alliances:
    // slot 1 -> circle, slot 2 -> triangle, slot 3 -> star
    return slotIndex % 3;
};

const drawSlotShapePath = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    slotIndex: number,
) => {
    const shapeIndex = getSlotShapeIndex(slotIndex);

    ctx.beginPath();

    if (shapeIndex === 0) {
        // Circle
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        return;
    }

    if (shapeIndex === 1) {
        // Triangle (pointing up)
        const angleOffset = -Math.PI / 2;
        for (let i = 0; i < 3; i++) {
            const angle = angleOffset + (i * (Math.PI * 2)) / 3;
            const px = x + Math.cos(angle) * radius;
            const py = y + Math.sin(angle) * radius;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        return;
    }

    // Star (5-point)
    const outerRadius = radius;
    const innerRadius = radius * 0.45;
    const startAngle = -Math.PI / 2;

    for (let i = 0; i < 10; i++) {
        const isOuter = i % 2 === 0;
        const currentRadius = isOuter ? outerRadius : innerRadius;
        const angle = startAngle + (i * Math.PI) / 5;
        const px = x + Math.cos(angle) * currentRadius;
        const py = y + Math.sin(angle) * currentRadius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
};

export const drawTeamNumbersAndSpots = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    selectedTeams: (number | null)[],
    stageId: StrategyStageId,
    teamSlotSpotVisibility: TeamSlotSpotVisibility[] = [],
    getTeamSpots?: (teamNumber: number | null, stageId: StrategyStageId) => TeamStageSpots,
) => {
    drawTeamNumbers(ctx, width, height, selectedTeams);

    if (!getTeamSpots) return;

    selectedTeams.forEach((teamNumber, slotIndex) => {
        if (!teamNumber) return;

        const visibility = teamSlotSpotVisibility[slotIndex] ?? {
            showShooting: true,
            showPassing: true,
        };

        if (!visibility.showShooting && !visibility.showPassing) return;

        const spots = getTeamSpots(teamNumber, stageId);
        const slotColor = getSlotColor(slotIndex);

        ctx.save();
        ctx.globalAlpha = 0.55;

        if (visibility.showShooting) {
            ctx.fillStyle = slotColor;
            spots.shooting.forEach((spot) => {
                const mappedSpot = transformSpotForSlot(spot, slotIndex);
                const x = mappedSpot.x * width;
                const y = mappedSpot.y * height;
                drawSlotShapePath(ctx, x, y, 6, slotIndex);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.lineWidth = 1.5;
                ctx.stroke();
                ctx.fill();
            });
        }

        if (visibility.showPassing) {
            ctx.strokeStyle = slotColor;
            spots.passing.forEach((spot) => {
                const mappedSpot = transformSpotForSlot(spot, slotIndex);
                const x = mappedSpot.x * width;
                const y = mappedSpot.y * height;
                drawSlotShapePath(ctx, x, y, 8, slotIndex);
                ctx.lineWidth = 4;
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.stroke();
                ctx.lineWidth = 2.5;
                ctx.strokeStyle = slotColor;
                ctx.stroke();
            });
        }

        ctx.restore();
    });
};

/**
 * Restores ONLY the background image for a specific area.
 * Used during active erasing to avoid clipped text artifacts.
 */
export const restoreBackgroundOnly = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    backgroundImage: HTMLImageElement,
    clipRect: { x: number; y: number; w: number; h: number }
) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(clipRect.x, clipRect.y, clipRect.w, clipRect.h);
    ctx.clip();
    ctx.drawImage(backgroundImage, 0, 0, width, height);
    ctx.restore();
};

/**
 * Redraws all overlays on the full canvas.
 * Call this once after erasing is complete to restore team numbers.
 */
export const redrawOverlays = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    selectedTeams: (number | null)[]
) => {
    drawTeamNumbers(ctx, width, height, selectedTeams);
};

/**
 * Restores the background and standard overlays for a specific area.
 * This is used by the eraser to avoid "punching holes" in overlays.
 */
export const restoreBackgroundWithOverlays = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    backgroundImage: HTMLImageElement,
    selectedTeams: (number | null)[],
    clipRect?: { x: number; y: number; w: number; h: number }
) => {
    ctx.save();

    if (clipRect) {
        ctx.beginPath();
        ctx.rect(clipRect.x, clipRect.y, clipRect.w, clipRect.h);
        ctx.clip();
    }

    // Draw background
    ctx.drawImage(backgroundImage, 0, 0, width, height);

    ctx.restore();

    // Draw overlays on full canvas (no clipping) to avoid artifacts
    drawTeamNumbers(ctx, width, height, selectedTeams);
};
