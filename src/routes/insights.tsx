import { createFileRoute } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/protected-layout";
import { useDams, useMovements } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useMemo, useState } from "react";
import { fmtTons, fmtNum } from "@/lib/types";
import { ArrowDownToLine, ArrowUpFromLine, Activity, Scale, Layers, Sigma } from "lucide-react";
import {
import { RouteError } from "@/components/route-error";
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

export const Route = createFileRoute("/insights")({
  component: () => <ProtectedLayout><InsightsPage /></ProtectedLayout>,
  errorComponent: RouteError,
});

type RangeKey = "today" | "yesterday" | "7d" | "30d" | "3m" | "1y" | "custom";

function computeRange(key: RangeKey, customFrom?: string, customTo?: string): { from: Date; to: Date } {
  const now = new Date();
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  switch (key) {
    case "today": return { from: start, to: end };
    case "yesterday": {
      const s = new Date(start); s.setDate(s.getDate() - 1);
      const e = new Date(end); e.setDate(e.getDate() - 1);
      return { from: s, to: e };
    }
    case "7d": { const s = new Date(start); s.setDate(s.getDate() - 6); return { from: s, to: end }; }
    case "30d": { const s = new Date(start); s.setDate(s.getDate() - 29); return { from: s, to: end }; }
    case "3m": { const s = new Date(start); s.setMonth(s.getMonth() - 3); return { from: s, to: end }; }
    case "1y": { const s = new Date(start); s.setFullYear(s.getFullYear() - 1); return { from: s, to: end }; }
    case "custom": {
      const s = customFrom ? new Date(customFrom + "T00:00:00") : start;
      const e = customTo ? new Date(customTo + "T23:59:59") : end;
      return { from: s, to: e };
    }
  }
}

function InsightsPage() {
  const [rangeKey, setRangeKey] = useState<RangeKey>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const { from, to } = useMemo(() => computeRange(rangeKey, customFrom, customTo), [rangeKey, customFrom, customTo]);
  const { data: movements = [] } = useMovements({ from: from.toISOString(), to: to.toISOString() });
  const { data: dams = [] } = useDams();

  const stats = useMemo(() => {
    const inc = movements.filter((m) => m.movement_type === "incoming");
    const out = movements.filter((m) => m.movement_type === "outgoing");
    const sum = (arr: typeof movements) => arr.reduce((s, m) => s + Number(m.quantity_tons || 0), 0);
    const totalIn = sum(inc);
    const totalOut = sum(out);
    const all = movements.map((m) => Number(m.quantity_tons || 0));
    const min = all.length ? Math.min(...all) : 0;
    const max = all.length ? Math.max(...all) : 0;
    const avg = all.length ? all.reduce((a, b) => a + b, 0) / all.length : 0;
    const variance = all.length
      ? all.reduce((s, v) => s + (v - avg) ** 2, 0) / all.length
      : 0;
    return { totalIn, totalOut, net: totalIn - totalOut, count: movements.length, avg, min, max, variance, std: Math.sqrt(variance) };
  }, [movements]);

  const chartData = useMemo(() => {
    const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86_400_000));
    const useDay = days <= 92;
    const buckets = new Map<string, { label: string; incoming: number; outgoing: number; net: number }>();
    for (const m of movements) {
      const d = new Date(m.occurred_at);
      const key = useDay
        ? d.toISOString().slice(0, 10)
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = useDay ? d.toLocaleDateString(undefined, { month: "short", day: "2-digit" }) : d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
      const b = buckets.get(key) ?? { label, incoming: 0, outgoing: 0, net: 0 };
      const q = Number(m.quantity_tons || 0);
      if (m.movement_type === "incoming") b.incoming += q; else b.outgoing += q;
      buckets.set(key, b);
    }
    const sorted = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b));
    let running = 0;
    return sorted.map(([, b]) => {
      running += b.incoming - b.outgoing;
      return { ...b, net: Math.round(running * 1000) / 1000 };
    });
  }, [movements, from, to]);

  const totalStock = dams.reduce((s, d) => s + Number(d.current_volume_tons || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold">Insights</h1>
        <p className="text-sm text-muted-foreground mt-1">Movement analytics for the selected period.</p>
      </div>

      <Card className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Date range</Label>
            <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={rangeKey} onChange={(e) => setRangeKey(e.target.value as RangeKey)}>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="7d">Last 7 days (this week)</option>
              <option value="30d">Last 30 days (last month)</option>
              <option value="3m">Last 3 months</option>
              <option value="1y">Last year</option>
              <option value="custom">Custom range</option>
            </select>
          </div>
          {rangeKey === "custom" && (
            <>
              <div className="space-y-1"><Label className="text-xs">From</Label><Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">To</Label><Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} /></div>
            </>
          )}
          <div className="space-y-1 sm:col-span-2 lg:col-span-1 lg:col-start-4">
            <Label className="text-xs">Period</Label>
            <div className="text-sm h-9 flex items-center text-muted-foreground">
              {from.toLocaleDateString()} → {to.toLocaleDateString()}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard icon={<ArrowDownToLine className="h-5 w-5 text-success" />} label="Total Incoming" value={fmtTons(stats.totalIn)} sub={`${stats.count ? Math.round((stats.totalIn / (stats.totalIn + stats.totalOut || 1)) * 100) : 0}% of flow`} />
        <MetricCard icon={<ArrowUpFromLine className="h-5 w-5 text-purple" />} label="Total Outgoing" value={fmtTons(stats.totalOut)} sub={`${stats.count ? Math.round((stats.totalOut / (stats.totalIn + stats.totalOut || 1)) * 100) : 0}% of flow`} />
        <MetricCard icon={<Sigma className="h-5 w-5 text-primary" />} label="Net Movement" value={fmtTons(stats.net)} sub={stats.net >= 0 ? "Stock gained" : "Stock reduced"} />
        <MetricCard icon={<Scale className="h-5 w-5 text-primary" />} label="Average Load" value={fmtTons(stats.avg)} sub={`min ${fmtNum(stats.min)} · max ${fmtNum(stats.max)} t`} />
        <MetricCard icon={<Activity className="h-5 w-5 text-warning" />} label="Load Variance" value={`${fmtNum(stats.variance)} t²`} sub={`std dev ${fmtNum(stats.std)} t`} />
        <MetricCard icon={<Layers className="h-5 w-5 text-primary" />} label="Total Movements" value={String(stats.count)} sub={`Current stock ${fmtTons(totalStock)}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="font-semibold mb-3">Incoming vs Outgoing</h3>
          <div className="h-72">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="incoming" fill="hsl(var(--success, 142 76% 36%))" name="Incoming (t)" />
                  <Bar dataKey="outgoing" fill="hsl(var(--purple, 270 70% 60%))" name="Outgoing (t)" />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold mb-3">Net stock trend (cumulative)</h3>
          <div className="h-72">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="net" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Net (t)" />
                </LineChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
          <div className="text-2xl font-bold mt-1 tabular-nums">{value}</div>
          {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
        </div>
        <div className="rounded-lg bg-secondary/40 p-2">{icon}</div>
      </div>
    </Card>
  );
}

function EmptyChart() {
  return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No movements in selected range</div>;
}
