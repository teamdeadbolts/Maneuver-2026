import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Badge } from "@/core/components/ui/badge";
import { toast } from "sonner";
import { ArrowRight, Plus } from "lucide-react";

const AutoScoringPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const states = location.state;

  const getSavedState = () => {
    const saved = localStorage.getItem("autoStateStack");
    return saved ? JSON.parse(saved) : [];
  };

  const [scoringActions, setScoringActions] = useState(getSavedState());

  // Save state to localStorage whenever actions change
  useEffect(() => {
    localStorage.setItem("autoStateStack", JSON.stringify(scoringActions));
  }, [scoringActions]);

  const addScoringAction = (action: any) => {
    const newAction = { ...action, timestamp: Date.now() };
    setScoringActions((prev: any) => [...prev, newAction]);
    toast.success("Action recorded");
  };

  const undoLastAction = () => {
    if (scoringActions.length === 0) {
      toast.error("No actions to undo");
      return;
    }
    setScoringActions((prev: any) => prev.slice(0, -1));
    toast.success("Undid last action");
  };

  const handleBack = () => {
    navigate("/auto-start", {
      state: {
        inputs: states?.inputs,
        ...(states?.rescout && { rescout: states.rescout }),
      },
    });
  };

  const handleProceed = () => {
    navigate("/teleop-scoring", {
      state: {
        inputs: states?.inputs,
        autoStateStack: scoringActions,
        ...(states?.rescout && { rescout: states.rescout }),
      },
    });
  };

  return (
    <div className="h-fit w-full flex flex-col items-center px-4 pt-6 pb-8 md:pb-6">
      <div className="w-full max-w-7xl">
        <h1 className="text-2xl font-bold pb-4">Autonomous</h1>
      </div>
      <div className="flex flex-col-reverse lg:flex-row items-start gap-0 lg:gap-6 max-w-7xl w-full h-full min-h-0">
        
        {/* Main Scoring Section */}
        <div className="w-full lg:flex-1 space-y-4 min-h-0 overflow-y-auto">
          
          {/* Game Implementation: Add scoring components here */}
          <Card>
            <CardHeader>
              <CardTitle>Placeholder: Scoring Section 1</CardTitle>
              <p className="text-sm text-muted-foreground">
                Game Implementation: Replace with game-specific scoring (e.g., ReefScoringSection)
              </p>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => addScoringAction({ type: "placeholder", description: "Placeholder action" })}
                variant="outline"
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Placeholder Action
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Placeholder: Scoring Section 2</CardTitle>
              <p className="text-sm text-muted-foreground">
                Game Implementation: Replace with game-specific scoring (e.g., AlgaeSection)
              </p>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => addScoringAction({ type: "placeholder2", description: "Another action" })}
                variant="outline"
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Another Action
              </Button>
            </CardContent>
          </Card>

          {/* Action Buttons - Mobile Only */}
          <div className="flex lg:hidden gap-4 w-full">
            <Button
              variant="outline"
              onClick={handleBack}
              className="flex-1 h-12 text-lg"
            >
              Back
            </Button>
            <Button
              onClick={handleProceed}
              className="flex-2 h-12 text-lg font-semibold"
            >
              Continue to Teleop
              <ArrowRight className="ml-0.5" />
            </Button>
          </div>
        </div>

        {/* Info and Controls Sidebar */}
        <div className="flex flex-col gap-4 w-full lg:w-80 pb-4 lg:pb-0 min-h-0">
        {/* Info and Controls Sidebar */}
        <div className="flex flex-col gap-4 w-full lg:w-80 pb-4 lg:pb-0 min-h-0">

          {/* Match Info Card */}
          {states?.inputs && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Autonomous</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Match:</span>
                  <span className="font-medium">{states.inputs.matchNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Team:</span>
                  <span className="font-medium">{states.inputs.selectTeam}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Actions:</span>
                  <Badge variant="outline">{scoringActions.length}</Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Actions */}
          <Card className="h-64">
            <CardHeader>
              <CardTitle className="text-lg">Recent Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 h-40 overflow-y-auto pb-2">
                {scoringActions.slice(-8).reverse().map((action: any, index: number) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {action.type} {action.description && `- ${action.description}`}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      #{scoringActions.length - index}
                    </Badge>
                  </div>
                ))}
                {scoringActions.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    No actions recorded yet
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Robot Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Robot Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Game Implementation: Add robot status buttons here
              </p>
              <Button
                variant="outline"
                onClick={() => addScoringAction({ type: "status", description: "Status change" })}
                className="w-full h-10"
              >
                Placeholder Status Button
              </Button>
            </CardContent>
          </Card>

          {/* Undo Button */}
          <Button
            variant="outline"
            onClick={undoLastAction}
            disabled={scoringActions.length === 0}
            className="w-full"
          >
            Undo Last Action
          </Button>

          {/* Action Buttons - Desktop Only */}
          <div className="hidden lg:flex gap-4 w-full">
            <Button
              variant="outline"
              onClick={handleBack}
              className="flex-1 h-12 text-lg"
            >
              Back
            </Button>
            <Button
              onClick={handleProceed}
              className="flex-2 h-12 text-lg font-semibold"
            >
              Continue to Teleop
              <ArrowRight className="ml-0.5" />
            </Button>
          </div>
        </div>

      </div>
    </div>
    </div>
  );
};

export default AutoScoringPage;
