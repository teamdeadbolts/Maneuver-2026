import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/core/components/ui/card';
import { GenericSelector } from '@/core/components/ui/generic-selector';
import { ChartContainer } from '@/core/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { TrendingUp } from 'lucide-react';

interface MatchResult {
  matchNumber: string;
  totalPoints: number;
  autoPoints: number;
  teleopPoints: number;
  endgamePoints: number;
  autoFuel?: number;
  teleopFuel?: number;
  fuelPassed?: number;
  climbLevel?: number;
  [key: string]: unknown;
}

interface MatchProgressionChartProps {
  matchResults: MatchResult[];
  compareMatchResults?: MatchResult[];
  teamNumber: number;
  compareTeamNumber?: number;
}

// Custom hook for container dimensions
function useContainerDimensions() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const updateDimensions = useCallback(() => {
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      setDimensions({ width, height });
    }
  }, []);

  useEffect(() => {
    updateDimensions();

    const resizeObserver = new ResizeObserver(() => {
      updateDimensions();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [updateDimensions]);

  return { containerRef, ...dimensions };
}

const metricOptions = [
  { key: 'totalPoints', label: 'Total Points' },
  { key: 'autoPoints', label: 'Auto Points' },
  { key: 'teleopPoints', label: 'Teleop Points' },
  { key: 'endgamePoints', label: 'Endgame Points' },
  { key: 'autoFuel', label: 'Auto Fuel' },
  { key: 'teleopFuel', label: 'Teleop Fuel' },
  { key: 'fuelPassed', label: 'Fuel Passed' },
  { key: 'climbLevel', label: 'Climb Level' },
];

export function MatchProgressionChart({
  matchResults,
  compareMatchResults,
  teamNumber,
  compareTeamNumber,
}: MatchProgressionChartProps) {
  const [selectedMetric, setSelectedMetric] = useState('totalPoints');
  const { containerRef, width, height } = useContainerDimensions();

  // Prepare chart data
  const chartData = matchResults.map((match, index) => {
    const compareMatch = compareMatchResults?.[index];
    return {
      match: match.matchNumber,
      matchIndex: index + 1,
      [teamNumber]: match[selectedMetric as keyof MatchResult] || 0,
      ...(compareMatch && compareTeamNumber
        ? {
            [compareTeamNumber]: compareMatch[selectedMetric as keyof MatchResult] || 0,
          }
        : {}),
    };
  });

  const chartConfig = {
    [teamNumber]: {
      label: `Team ${teamNumber}`,
      color: 'hsl(0, 0%, 100%)', // White for main team
    },
    ...(compareTeamNumber
      ? {
          [compareTeamNumber]: {
            label: `Team ${compareTeamNumber}`,
            color: 'hsl(270, 95%, 75%)', // Purple for comparison team
          },
        }
      : {}),
  };

  const metricLabel = metricOptions.find(m => m.key === selectedMetric)?.label || selectedMetric;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Match Progression
            </CardTitle>
            <CardDescription>Performance trends across matches</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {/* Metric Selector */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium whitespace-nowrap">Metric:</label>
              <GenericSelector
                label="Select Metric"
                value={selectedMetric}
                availableOptions={metricOptions.map(m => m.key)}
                onValueChange={setSelectedMetric}
                placeholder="Select metric"
                displayFormat={(key: string) =>
                  metricOptions.find(m => m.key === key)?.label || key
                }
                className="w-48"
              />
            </div>
            {/* Legend */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: chartConfig[teamNumber]?.color }}
                />
                <span className="text-sm font-medium">Team {teamNumber}</span>
              </div>
              {compareTeamNumber && (
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: chartConfig[compareTeamNumber]?.color }}
                  />
                  <span className="text-sm font-medium">Team {compareTeamNumber}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-87.5 w-full">
          <ChartContainer config={chartConfig} className="h-full w-full aspect-auto!">
            <div ref={containerRef} className="h-full w-full">
              {width > 0 && height > 0 ? (
                <LineChart
                  data={chartData}
                  width={width}
                  height={height}
                  margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="match"
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    tick={{ fontSize: 12 }}
                    label={{ value: 'Match Number', position: 'insideBottom', offset: -15 }}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    label={{ value: metricLabel, angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-sm">
                          <div className="grid gap-2">
                            <div className="font-medium">Match {payload[0].payload.match}</div>
                            {payload.map((entry: any, index: number) => (
                              <div key={index} className="flex items-center gap-2">
                                <div
                                  className="h-2 w-2 rounded-full"
                                  style={{ backgroundColor: entry.color }}
                                />
                                <span className="text-sm text-muted-foreground">{entry.name}:</span>
                                <span className="font-bold">{entry.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey={teamNumber.toString()}
                    stroke={chartConfig[teamNumber]?.color}
                    strokeWidth={2}
                    dot={{
                      r: 4,
                      fill: chartConfig[teamNumber]?.color,
                      stroke: chartConfig[teamNumber]?.color,
                      strokeWidth: 2,
                    }}
                    activeDot={{
                      r: 6,
                      fill: chartConfig[teamNumber]?.color,
                      stroke: chartConfig[teamNumber]?.color,
                      strokeWidth: 2,
                    }}
                    connectNulls={false}
                  />
                  {compareTeamNumber && (
                    <Line
                      type="monotone"
                      dataKey={compareTeamNumber.toString()}
                      stroke={chartConfig[compareTeamNumber]?.color}
                      strokeWidth={2}
                      dot={{
                        r: 4,
                        fill: chartConfig[compareTeamNumber]?.color,
                        stroke: chartConfig[compareTeamNumber]?.color,
                        strokeWidth: 2,
                      }}
                      activeDot={{
                        r: 6,
                        fill: chartConfig[compareTeamNumber]?.color,
                        stroke: chartConfig[compareTeamNumber]?.color,
                        strokeWidth: 2,
                      }}
                      connectNulls={false}
                    />
                  )}
                </LineChart>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Loading chart...
                </div>
              )}
            </div>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
}
