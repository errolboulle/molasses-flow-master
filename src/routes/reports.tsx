import { createFileRoute } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/protected-layout";
import { useDams, useMovements } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReportPreview } from "@/components/report-preview";
import { useMemo, useState } from "react";
import { fmtTons } from "@/lib/types";
import { Label } from "@/components/ui/label";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";

export const Route = createFileRoute("/reports")({
  component: () => <ProtectedLayout><ReportsPage /></ProtectedLayout>,
});

type Period = "weekly" | "monthly" | "yearly";

function startOf(period: Period) {
  const d = new Date();
  if (period === "weekly") {
    d.setDate(d.getDate() - 7);
  } else if (period === "monthly") {
    d.setMonth(d.getMonth() - 1);
  } else {
    d.setFullYear(d.getFullYear() - 1);
  }
  d.setHours(0, 0, 0, 0);
  return d;
}

function ReportsPage() {
  const { data: dams = [] } = useDams();
  const { data: movements = [] } = useMovements();
  const [period, setPeriod] = useState<Period>("monthly");
  const [damId, setDamId] = useState("");

  const since = useMemo(() => startOf(period), [period]);

  const damReports = useMemo(() => {
    const list = damId ? dams.filter((d) => d.id === damId) : dams;
    return list.map((dam) => {
      const inPeriod = movements.filter((m) => m.dam_id === dam.id && new Date(m.occurred_at) >= since);
      const totalIn = inPeriod.filter((m) => m.movement_type === "incoming").reduce((s, m) => s + Number(m.quantity_tons), 0);
      const totalOut = inPeriod.filter((m) => m.movement_type === "outgoing").reduce((s, m) => s + Number(m.quantity_tons), 0);
      return { dam, totalIn, totalOut, closing: Number(dam.current_volume_tons) };
    });
  }, [dams, movements, damId, since]);

  const chartData = damReports.map((r) => ({ name: r.dam.name, In: r.totalIn, Out: r.totalOut, Closing: r.closing }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">Period summaries with charts.</p>
      </div>

      <Card className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
          <div className="space-y-1">
            <Label className="text-xs">Period</Label>
            <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
              <option value="weekly">Last 7 days</option>
              <option value="monthly">Last 30 days</option>
              <option value="yearly">Last 12 months</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Dam</Label>
            <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={damId} onChange={(e) => setDamId(e.target.value)}>
              <option value="">All dams</option>
              {dams.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="charts" className="space-y-5">
        <TabsList>
          <TabsTrigger value="charts">Charts</TabsTrigger>
          <TabsTrigger value="preview">Report Preview</TabsTrigger>
        </TabsList>
        <TabsContent value="charts" className="space-y-5">
          <Card className="p-5">
            <h2 className="font-semibold mb-4">In vs Out</h2>
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={chartData}>
                  <CartesianGrid stroke="hsl(0 0% 100% / 0.06)" vertical={false} />
                  <XAxis dataKey="name" stroke="hsl(0 0% 100% / 0.5)" fontSize={12} />
                  <YAxis stroke="hsl(0 0% 100% / 0.5)" fontSize={12} />
                  <Tooltip contentStyle={{ background: "oklch(0.21 0.014 260)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="In" fill="oklch(0.65 0.16 155)" radius={[4,4,0,0]} />
                  <Bar dataKey="Out" fill="oklch(0.62 0.21 305)" radius={[4,4,0,0]} />
                  <Bar dataKey="Closing" fill="oklch(0.62 0.19 260)" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {damReports.map((r) => (
              <Card key={r.dam.id} className="p-5">
                <h3 className="font-bold text-lg">{r.dam.name}</h3>
                <div className="mt-4 space-y-3 text-sm">
                  <Stat label="Total received" value={fmtTons(r.totalIn)} color="text-success" />
                  <Stat label="Total dispatched" value={fmtTons(r.totalOut)} color="text-purple" />
                  <Stat label="Net change" value={fmtTons(r.totalIn - r.totalOut)} />
                  <Stat label="Closing balance" value={fmtTons(r.closing)} bold />
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="preview">
          <ReportPreview dams={dams} movements={movements} damId={damId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className={`tabular-nums ${color ?? ""} ${bold ? "font-bold text-base" : "font-semibold"}`}>{value}</span>
    </div>
  );
}
