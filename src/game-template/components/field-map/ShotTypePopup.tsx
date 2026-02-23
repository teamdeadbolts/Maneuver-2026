import { Button } from '@/core/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Badge } from '@/core/components/ui/badge';
import { cn } from '@/core/lib/utils';
import type { ShotType } from './types';

interface ShotTypePopupProps {
  isFieldRotated: boolean;
  onSelect: (shotType: ShotType) => void;
  onCancel: () => void;
}

export function ShotTypePopup({ isFieldRotated, onSelect, onCancel }: ShotTypePopupProps) {
  return (
    <div
      className={cn(
        'absolute inset-0 z-40 flex items-center justify-center p-2 pointer-events-none'
      )}
    >
      <Card
        className={cn(
          'w-full max-w-sm pointer-events-auto shadow-xl',
          isFieldRotated && 'rotate-180'
        )}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-center gap-2">
            <Badge variant="outline" className="text-green-500 border-green-500/50">
              SHOT
            </Badge>
            <CardTitle className="text-lg font-bold">Shot Type</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground text-center">
            Was this shot on the move or stationary?
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-14 font-semibold"
              onClick={() => onSelect('onTheMove')}
            >
              On the Move
            </Button>
            <Button
              variant="outline"
              className="h-14 font-semibold"
              onClick={() => onSelect('stationary')}
            >
              Stationary
            </Button>
          </div>
          <Button variant="ghost" className="w-full" onClick={onCancel}>
            Cancel
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
