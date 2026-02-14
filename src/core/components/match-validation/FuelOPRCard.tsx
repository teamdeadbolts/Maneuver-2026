import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/core/components/ui/table';

export interface FuelOPRDisplayRow {
  teamNumber: number;
  matchesPlayed: number;
  autoFuelOPR: number;
  teleopFuelOPR: number;
  totalFuelOPR: number;
  scaledAutoAvg: number;
  scaledTeleopAvg: number;
  scaledTotalAvg: number;
}

interface FuelOPRCardProps {
  rows: FuelOPRDisplayRow[];
  lambda: number | null;
  isLoading: boolean;
}

const formatValue = (value: number) => value.toFixed(1);

export const FuelOPRCard: React.FC<FuelOPRCardProps> = ({ rows, lambda, isLoading }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span>Fuel OPR & Scaled Fuel</span>
          {lambda !== null && (
            <span className="text-xs font-normal text-muted-foreground">Ridge λ={lambda}</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading OPR and scaled fuel...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No OPR/scaled fuel data yet. Validate the event first.
          </p>
        ) : (
          <div className="max-h-96 overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team</TableHead>
                  <TableHead>Matches</TableHead>
                  <TableHead>Auto OPR</TableHead>
                  <TableHead>Teleop OPR</TableHead>
                  <TableHead>Total OPR</TableHead>
                  <TableHead>Scaled Auto Avg</TableHead>
                  <TableHead>Scaled Teleop Avg</TableHead>
                  <TableHead>Scaled Total Avg</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(row => (
                  <TableRow key={row.teamNumber}>
                    <TableCell className="font-medium">{row.teamNumber}</TableCell>
                    <TableCell>{row.matchesPlayed}</TableCell>
                    <TableCell>{formatValue(row.autoFuelOPR)}</TableCell>
                    <TableCell>{formatValue(row.teleopFuelOPR)}</TableCell>
                    <TableCell>{formatValue(row.totalFuelOPR)}</TableCell>
                    <TableCell>{formatValue(row.scaledAutoAvg)}</TableCell>
                    <TableCell>{formatValue(row.scaledTeleopAvg)}</TableCell>
                    <TableCell>{formatValue(row.scaledTotalAvg)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
