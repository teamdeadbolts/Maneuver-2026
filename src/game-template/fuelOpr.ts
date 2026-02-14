import type { TBAMatchData } from '@/core/lib/tbaMatchData';

export interface FuelOPROptions {
    ridgeLambda?: number;
    includePlayoffs?: boolean;
}

export interface FuelOPRTeamResult {
    teamNumber: number;
    matchesPlayed: number;
    autoFuelOPR: number;
    teleopFuelOPR: number;
    totalFuelOPR: number;
}

export interface FuelOPRResult {
    lambda: number;
    teams: FuelOPRTeamResult[];
    matchCount: number;
    allianceSamples: number;
}

interface AllianceSample {
    teams: number[];
    autoFuel: number;
    teleopFuel: number;
    totalFuel: number;
}

const DEFAULT_LAMBDA = 0.75;

export function calculateFuelOPR(
    matches: TBAMatchData[],
    options: FuelOPROptions = {}
): FuelOPRResult {
    const lambda = options.ridgeLambda ?? DEFAULT_LAMBDA;
    const includePlayoffs = options.includePlayoffs ?? false;

    const { samples, matchCount } = buildAllianceSamples(matches, includePlayoffs);
    const teamSet = new Set<number>();
    const matchesByTeam = new Map<number, number>();

    for (const sample of samples) {
        for (const team of sample.teams) {
            teamSet.add(team);
            matchesByTeam.set(team, (matchesByTeam.get(team) ?? 0) + 1);
        }
    }

    const teamNumbers = [...teamSet].sort((a, b) => a - b);
    if (teamNumbers.length === 0 || samples.length === 0) {
        return {
            lambda,
            teams: [],
            matchCount: 0,
            allianceSamples: 0,
        };
    }

    const teamIndex = new Map<number, number>();
    for (let i = 0; i < teamNumbers.length; i++) {
        teamIndex.set(teamNumbers[i]!, i);
    }

    const A: number[][] = samples.map(sample => {
        const row = new Array(teamNumbers.length).fill(0);
        for (const team of sample.teams) {
            const index = teamIndex.get(team);
            if (index !== undefined) {
                row[index] = 1;
            }
        }
        return row;
    });

    const bAuto = samples.map(s => s.autoFuel);
    const bTeleop = samples.map(s => s.teleopFuel);
    const bTotal = samples.map(s => s.totalFuel);

    const autoFuelOPR = solveRidgeLeastSquares(A, bAuto, lambda);
    const teleopFuelOPR = solveRidgeLeastSquares(A, bTeleop, lambda);
    const totalFuelOPR = solveRidgeLeastSquares(A, bTotal, lambda);

    const teams: FuelOPRTeamResult[] = teamNumbers.map((teamNumber, i) => ({
        teamNumber,
        matchesPlayed: matchesByTeam.get(teamNumber) ?? 0,
        autoFuelOPR: autoFuelOPR[i] ?? 0,
        teleopFuelOPR: teleopFuelOPR[i] ?? 0,
        totalFuelOPR: totalFuelOPR[i] ?? 0,
    }));

    return {
        lambda,
        teams,
        matchCount,
        allianceSamples: samples.length,
    };
}

function buildAllianceSamples(matches: TBAMatchData[], includePlayoffs: boolean): { samples: AllianceSample[]; matchCount: number } {
    const samples: AllianceSample[] = [];
    let eligibleMatches = 0;

    for (const match of matches) {
        if (!includePlayoffs && match.comp_level !== 'qm') {
            continue;
        }

        const scoreBreakdown = match.score_breakdown as { red?: Record<string, unknown>; blue?: Record<string, unknown> } | null;
        if (!scoreBreakdown?.red || !scoreBreakdown?.blue) {
            continue;
        }

        const redSample = buildAllianceSample(match.alliances.red.team_keys, scoreBreakdown.red);
        const blueSample = buildAllianceSample(match.alliances.blue.team_keys, scoreBreakdown.blue);

        if (redSample) samples.push(redSample);
        if (blueSample) samples.push(blueSample);

        if (redSample || blueSample) {
            eligibleMatches++;
        }
    }

    return { samples, matchCount: eligibleMatches };
}

function buildAllianceSample(teamKeys: string[], breakdown: Record<string, unknown>): AllianceSample | null {
    const hubScore = breakdown.hubScore as Record<string, unknown> | undefined;
    if (!hubScore) {
        return null;
    }

    const teams = teamKeys
        .map(key => parseInt(key.replace('frc', ''), 10))
        .filter(number => Number.isFinite(number));

    if (teams.length !== 3) {
        return null;
    }

    const autoFuel = toNumber(hubScore.autoCount);
    const teleopFuel = toNumber(hubScore.teleopCount);
    const totalFuel = toNumber(hubScore.totalCount);

    return {
        teams,
        autoFuel,
        teleopFuel,
        totalFuel,
    };
}

function toNumber(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function solveRidgeLeastSquares(A: number[][], b: number[], lambda: number): number[] {
    const nTeams = A[0]?.length ?? 0;
    if (nTeams === 0) return [];

    const AtA = Array.from({ length: nTeams }, () => new Array(nTeams).fill(0));
    const Atb = new Array(nTeams).fill(0);

    for (let row = 0; row < A.length; row++) {
        const aRow = A[row]!;
        const bRow = b[row] ?? 0;

        for (let i = 0; i < nTeams; i++) {
            const ai = aRow[i] ?? 0;
            if (ai === 0) continue;

            Atb[i] += ai * bRow;

            for (let j = 0; j < nTeams; j++) {
                const aj = aRow[j] ?? 0;
                if (aj === 0) continue;
                AtA[i]![j] += ai * aj;
            }
        }
    }

    for (let i = 0; i < nTeams; i++) {
        AtA[i]![i] += lambda;
    }

    return gaussianEliminationSolve(AtA, Atb);
}

function gaussianEliminationSolve(matrix: number[][], vector: number[]): number[] {
    const n = matrix.length;
    const A = matrix.map(row => [...row]);
    const b = [...vector];

    for (let pivot = 0; pivot < n; pivot++) {
        let maxRow = pivot;
        let maxAbs = Math.abs(A[pivot]?.[pivot] ?? 0);

        for (let row = pivot + 1; row < n; row++) {
            const value = Math.abs(A[row]?.[pivot] ?? 0);
            if (value > maxAbs) {
                maxAbs = value;
                maxRow = row;
            }
        }

        if (maxAbs < 1e-12) {
            return new Array(n).fill(0);
        }

        if (maxRow !== pivot) {
            [A[pivot], A[maxRow]] = [A[maxRow]!, A[pivot]!];
            [b[pivot], b[maxRow]] = [b[maxRow]!, b[pivot]!];
        }

        const pivotValue = A[pivot]![pivot]!;
        for (let col = pivot; col < n; col++) {
            A[pivot]![col] = (A[pivot]![col] ?? 0) / pivotValue;
        }
        b[pivot] = (b[pivot] ?? 0) / pivotValue;

        for (let row = pivot + 1; row < n; row++) {
            const factor = A[row]![pivot] ?? 0;
            if (factor === 0) continue;

            for (let col = pivot; col < n; col++) {
                A[row]![col] = (A[row]![col] ?? 0) - factor * (A[pivot]![col] ?? 0);
            }
            b[row] = (b[row] ?? 0) - factor * (b[pivot] ?? 0);
        }
    }

    const x = new Array(n).fill(0);
    for (let row = n - 1; row >= 0; row--) {
        let sum = b[row] ?? 0;
        for (let col = row + 1; col < n; col++) {
            sum -= (A[row]![col] ?? 0) * (x[col] ?? 0);
        }
        x[row] = sum;
    }

    return x;
}
