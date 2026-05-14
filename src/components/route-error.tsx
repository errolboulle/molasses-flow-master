import { useRouter } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export function RouteError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="max-w-lg w-full p-6 text-center space-y-4">
        <AlertTriangle className="h-10 w-10 mx-auto text-destructive" />
        <div>
          <h2 className="text-lg font-semibold">Something went wrong</h2>
          <p className="text-sm text-muted-foreground mt-1 break-words">
            {error?.message ?? "Unexpected error"}
          </p>
        </div>
        <div className="flex gap-2 justify-center">
          <Button
            variant="outline"
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            Try again
          </Button>
          <Button onClick={() => (window.location.href = "/")}>Go home</Button>
        </div>
      </Card>
    </div>
  );
}
