import { createFileRoute } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/protected-layout";
import { useDams, useMovements, useSettings } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtTons, fmtLitres, fmtDateTime, tonsToLitres } from "@/lib/types";
import { ArrowDownToLine, ArrowUpFromLine, BarChart3, Database, Droplet, Truck } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { ReactNode } from "react";

export const Route = createFileRoute("/dashboard")({
  component: () => <ProtectedLayout><DashboardPage /></ProtectedLayout>,
});

function periodStart(kind: "today" | "yesterday" | "week" | "month" | "year") {
  const d = new Date();
  if (kind === "today") d.setHours(0, 0, 0, 0);
  if (kind === "yesterday") { d.setDate(d.getDate() - 1); d.setHours(0, 0, 0, 0); }
  if (kind === "week") { d.setDate(d.getDate() - 6); d.setHours(0, 0, 0, 0); }
  if (kind === "month") { d.setDate(1); d.setHours(0, 0, 0, 0); }
  if (kind === "year") { d.setMonth(0, 1); d.setHours(0, 0, 0, 0); }
  return d;
}

function DashboardPage() {
  const { data: dams = [] } = useDams();
  const { data: movements = [] } = useMovements();
  const { data: settings } = useSettings();
  const density = settings?.density_kg_per_l ?? 1.4;

  const monthStart = periodStart("month");
  const damStats = dams.map((dam) => {
    const monthMoves = movements.filter((m) => m.dam_id === dam.id && new Date(m.occurred_at) >= monthStart);
    const totalIn = monthMoves.filter((m) => m.movement_type === "incoming").reduce((s, m) => s + Number(m.quantity_tons), 0);
    const totalOut = monthMoves.filter((m) => m.movement_type === "outgoing").reduce((s, m) => s + Number(m.quantity_tons), 0);
    return { dam, totalIn, totalOut };
  });

  const totalCurrent = dams.reduce((s, d) => s + Number(d.current_volume_tons), 0);
  const totalIn = damStats.reduce((s, d) => s + d.totalIn, 0);
  const totalOut = damStats.reduce((s, d) => s + d.totalOut, 0);

  const varianceFor = (start: Date, end?: Date) => movements.filter((m) => {
    const at = new Date(m.occurred_at);
    return at >= start && (!end || at < end);
  }).reduce((sum, m) => sum + (m.movement_type === "incoming" ? Number(m.quantity_tons) : -Number(m.quantity_tons)), 0);

  const today = periodStart("today");
  const yesterday = periodStart("yesterday");
  const todayIn = movements.filter((m) => m.movement_type === "incoming" && new Date(m.occurred_at) >= today);
  const avgLoad = todayIn.length ? todayIn.reduce((s, m) => s + Number(m.quantity_tons), 0) / todayIn.length : 0;
  const insights = [
    ["Total variance today", varianceFor(today)],
    ["Total variance yesterday", varianceFor(yesterday, today)],
    ["Total variance this week", varianceFor(periodStart("week"))],
    ["Total variance this month", varianceFor(monthStart)],
    ["Total variance this year", varianceFor(periodStart("year"))],
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Live storage status, operations, and variance insights.</p>
      </div>

      <Tabs defaultValue="overview" className="space-y-5">
        <TabsList><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="insights">Insights</TabsTrigger></TabsList>
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SummaryCard label="Total stock" value={fmtTons(totalCurrent)} sub={fmtLitres(tonsToLitres(totalCurrent, density))} icon={<Database className="h-5 w-5" />} accent="primary" />
            <SummaryCard label="Received this month" value={fmtTons(totalIn)} icon={<ArrowDownToLine className="h-5 w-5" />} accent="success" />
            <SummaryCard label="Dispatched this month" value={fmtTons(totalOut)} icon={<ArrowUpFromLine className="h-5 w-5" />} accent="purple" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {damStats.map(({ dam, totalIn, totalOut }) => {
              const cap = Number(dam.capacity_tons ?? 0);
              const cur = Number(dam.current_volume_tons);
              const pct = cap > 0 ? Math.min(100, (cur / cap) * 100) : 0;
              return (
                <Card key={dam.id} className="p-5 bg-card border-border" style={{ background: "var(--gradient-industrial)" }}>
                  <div className="flex items-start justify-between"><div><div className="text-xs text-muted-foreground uppercase tracking-wider">Dam</div><h3 className="text-xl font-bold">{dam.name}</h3></div><div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center"><Droplet className="h-5 w-5" /></div></div>
                  <div className="mt-4"><div className="text-3xl font-bold tabular-nums">{fmtTons(cur)}</div><div className="text-sm text-muted-foreground">{fmtLitres(tonsToLitres(cur, density))}</div></div>
                  {cap > 0 && <div className="mt-4"><div className="flex justify-between text-xs text-muted-foreground mb-1"><span>Capacity</span><span>{pct.toFixed(0)}%</span></div><Progress value={pct} /><div className="text-xs text-muted-foreground mt-1">{fmtTons(cap)} max</div></div>}
                  <div className="mt-4 grid grid-cols-2 gap-3 pt-4 border-t border-border"><div><div className="text-xs text-muted-foreground flex items-center gap-1"><ArrowDownToLine className="h-3 w-3" /> In (mo)</div><div className="font-semibold text-success tabular-nums">{fmtTons(totalIn)}</div></div><div><div className="text-xs text-muted-foreground flex items-center gap-1"><ArrowUpFromLine className="h-3 w-3" /> Out (mo)</div><div className="font-semibold text-purple tabular-nums">{fmtTons(totalOut)}</div></div></div>
                  <div className="mt-3 text-xs text-muted-foreground">Updated {fmtDateTime(dam.updated_at)}</div>
                </Card>
              );
            })}
          </div>
        </TabsContent>
        <TabsContent value="insights" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {insights.map(([label, value]) => <VarianceCard key={label} label={label} value={value} />)}
            <SummaryCard label="Trucks processed today" value={String(movements.filter((m) => new Date(m.occurred_at) >= today).length)} icon={<Truck className="h-5 w-5" />} accent="primary" />
            <SummaryCard label="Avg load per truck today" value={fmtTons(avgLoad)} icon={<BarChart3 className="h-5 w-5" />} accent="success" />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function VarianceCard({ label, value }: { label: string; value: number }) {
  const positive = value >= 0;
  return <Card className="p-5"><div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div><div className={`mt-2 text-3xl font-bold tabular-nums ${positive ? "text-success" : "text-destructive"}`}>{positive ? "+" : ""}{fmtTons(value)}</div></Card>;
}

function SummaryCard({ label, value, sub, icon, accent }: { label: string; value: string; sub?: string; icon: ReactNode; accent: "primary" | "success" | "purple" }) {
  const accentClass = accent === "success" ? "bg-success/10 text-success" : accent === "purple" ? "bg-purple/10 text-purple" : "bg-primary/10 text-primary";
  return <Card className="p-5"><div className="flex items-center justify-between"><div><div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div><div className="text-2xl font-bold mt-1 tabular-nums">{value}</div>{sub && <div className="text-xs text-muted-foreground">{sub}</div>}</div><div className={`h-10 w-10 rounded-md flex items-center justify-center ${accentClass}`}>{icon}</div></div></Card>;
}
