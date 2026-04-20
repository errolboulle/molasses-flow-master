import { createFileRoute, Link } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/protected-layout";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { useMovements, useDams } from "@/lib/queries";
import { fmtTons, fmtDateTime } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/movements")({
  component: () => <ProtectedLayout><MovementsPage /></ProtectedLayout>,
});

function MovementsPage() {
  const { canEntry } = useAuth();
  const { data: movements = [] } = useMovements();
  const { data: dams = [] } = useDams();
  const damName = (id: string) => dams.find((d) => d.id === id)?.name ?? "—";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold">Truck movements</h1>
        <p className="text-sm text-muted-foreground mt-1">Log incoming deliveries and outgoing dispatches.</p>
      </div>

      {canEntry && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link to="/movements/new" search={{ type: "incoming" }}>
            <Card className="p-5 hover:border-success/50 transition-colors cursor-pointer h-full">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-success/10 text-success flex items-center justify-center"><ArrowDownToLine className="h-6 w-6" /></div>
                <div>
                  <h3 className="font-semibold">New incoming delivery</h3>
                  <p className="text-xs text-muted-foreground">Log a truck arrival from source mill.</p>
                </div>
              </div>
            </Card>
          </Link>
          <Link to="/movements/new" search={{ type: "outgoing" }}>
            <Card className="p-5 hover:border-purple/50 transition-colors cursor-pointer h-full">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-purple/10 text-purple flex items-center justify-center"><ArrowUpFromLine className="h-6 w-6" /></div>
                <div>
                  <h3 className="font-semibold">New outgoing dispatch</h3>
                  <p className="text-xs text-muted-foreground">Log a truck collecting from a dam.</p>
                </div>
              </div>
            </Card>
          </Link>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-3">Recent movements</h2>
        <div className="space-y-2">
          {movements.slice(0, 20).map((m) => (
            <Card key={m.id} className="p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`h-9 w-9 rounded-md flex items-center justify-center shrink-0 ${m.movement_type === "incoming" ? "bg-success/10 text-success" : "bg-purple/10 text-purple"}`}>
                    {m.movement_type === "incoming" ? <ArrowDownToLine className="h-4 w-4" /> : <ArrowUpFromLine className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold tabular-nums">{fmtTons(m.quantity_tons)} <Badge variant="outline" className="ml-2">{damName(m.dam_id)}</Badge></div>
                    <div className="text-xs text-muted-foreground truncate">{m.driver_or_company || m.src_haulier || m.fgc_haulier || "—"}</div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">{fmtDateTime(m.occurred_at)}</div>
              </div>
            </Card>
          ))}
          {movements.length === 0 && (
            <Card className="p-8 text-center text-sm text-muted-foreground">No movements yet.</Card>
          )}
        </div>
        {movements.length > 20 && (
          <div className="text-center mt-4">
            <Link to="/history"><Button variant="outline">View full history</Button></Link>
          </div>
        )}
      </div>
    </div>
  );
}
