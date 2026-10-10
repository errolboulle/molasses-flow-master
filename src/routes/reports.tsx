import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { BarChart3, FileText, TrendingDown, TrendingUp } from "lucide-react";
import { ProtectedLayout } from "@/components/protected-layout";
import { ReportPreview } from "@/components/report-preview";
import { Card } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdjustments, useDams, useMovements, useSettings } from "@/lib/queries";
import { fmtTons, tonsToLitres } from "@/lib/types";
import { RouteError } from "@/components/route-error";
import { computeCurrentTons } from "@/lib/report-layout";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [
    { title: "Reports | Flow Ops" },
    { name: "description", content: "Flow Ops reports for molasses storage and operations." },
    { property: "og:title", content: "Reports | Flow Ops" },
    { property: "og:description", content: "Flow Ops reports for molasses storage and operations." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <ProtectedLayout><ReportsPage /></ProtectedLayout>,
  errorComponent: RouteError,
});

const movementConfig = {
  incoming: { label: "Incoming", color: "var(--success)" },
  outgoing: { label: "Outgoing", color: "var(--destructive)" },
} satisfies ChartConfig;

const stockConfig = {
  stock: { label: "Stock", color: "var(--primary)" },
} satisfies ChartConfig;

function ReportsPage() {
  const { data: dams = [] } = useDams();
  const { data: movements = [] } = useMovements();
  const { data: adjustments = [] } = useAdjustments();
  const { data: settings } = useSettings();
  const density = settings?.density_kg_per_l ?? 1.4;
  const [selectedDam, setSelectedDam] = useState("");

  const filteredMovements = selectedDam ? movements.filter((movement) => movement.dam_id === selectedDam) : movements;
  const selectedDams = selectedDam ? dams.filter((dam) => dam.id === selectedDam) : dams;
  const totalIn = filteredMovements.filter((movement) => movement.movement_type === "incoming").reduce((sum, movement) => sum + Number(movement.quantity_tons ?? 0), 0);
  const totalOut = filteredMovements.filter((movement) => movement.movement_type === "outgoing").reduce((sum, movement) => sum + Number(movement.quantity_tons ?? 0), 0);
  const totalStock = selectedDams.reduce((sum, dam) => sum + computeCurrentTons(dam, movements, adjustments as any), 0);

  const movementChartData = buildMovementChartData(filteredMovements);
  const stockChartData = selectedDams.map((dam) => ({ name: dam.name, stock: computeCurrentTons(dam, movements, adjustments as any) }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Operations reports</p>
          <h1 className="mt-1 text-3xl font-black lg:text-4xl">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">Report preview, movement graphs, and dam stock summaries.</p>
        </div>
        <select
          value={selectedDam}
          onChange={(event) => setSelectedDam(event.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All dams</option>
          {dams.map((dam) => <option key={dam.id} value={dam.id}>{dam.name}</option>)}
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Total stock" value={fmtTons(totalStock)} sub={`${Math.round(tonsToLitres(totalStock, density)).toLocaleString()} L`} icon={<FileText className="h-5 w-5" />} />
        <MetricCard label="Total incoming" value={fmtTons(totalIn)} icon={<TrendingUp className="h-5 w-5" />} />
        <MetricCard label="Total outgoing" value={fmtTons(totalOut)} icon={<TrendingDown className="h-5 w-5" />} />
      </div>

      <Tabs defaultValue="preview" className="space-y-5">
        <TabsList>
          <TabsTrigger value="preview">Report Preview</TabsTrigger>
          <TabsTrigger value="graphs">Graphs</TabsTrigger>
        </TabsList>
        <TabsContent value="preview">
          <ReportPreview dams={dams} movements={movements} adjustments={adjustments as any} damId={selectedDam} />
        </TabsContent>
        <TabsContent value="graphs" className="grid gap-4 xl:grid-cols-2">
          <Card className="p-5">
            <div className="mb-4 flex items-center gap-2 font-bold"><BarChart3 className="h-5 w-5 text-primary" /> Monthly movement</div>
            <ChartContainer config={movementConfig} className="h-[320px] w-full">
              <AreaChart data={movementChartData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `${value}t`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area dataKey="incoming" type="monotone" fill="var(--color-incoming)" fillOpacity={0.25} stroke="var(--color-incoming)" />
                <Area dataKey="outgoing" type="monotone" fill="var(--color-outgoing)" fillOpacity={0.2} stroke="var(--color-outgoing)" />
              </AreaChart>
            </ChartContainer>
          </Card>
          <Card className="p-5">
            <div className="mb-4 flex items-center gap-2 font-bold"><FileText className="h-5 w-5 text-primary" /> Stock by dam</div>
            <ChartContainer config={stockConfig} className="h-[320px] w-full">
              <LineChart data={stockChartData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `${value}t`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line dataKey="stock" type="monotone" stroke="var(--color-stock)" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ChartContainer>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon: React.ReactNode }) {
  return <Card className="p-5"><div className="flex items-center justify-between gap-4"><div><div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-black tabular-nums">{value}</div>{sub && <div className="text-xs text-muted-foreground">{sub}</div>}</div><div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">{icon}</div></div></Card>;
}

function buildMovementChartData(movements: Array<{ occurred_at: string; movement_type: string; quantity_tons: number }>) {
  const months = new Map<string, { month: string; incoming: number; outgoing: number }>();
  [...movements].reverse().forEach((movement) => {
    const month = new Date(movement.occurred_at).toLocaleDateString(undefined, { month: "short", year: "2-digit" });
    const row = months.get(month) ?? { month, incoming: 0, outgoing: 0 };
    if (movement.movement_type === "incoming") row.incoming += Number(movement.quantity_tons ?? 0);
    if (movement.movement_type === "outgoing") row.outgoing += Number(movement.quantity_tons ?? 0);
    months.set(month, row);
  });
  return Array.from(months.values()).slice(-12);
}