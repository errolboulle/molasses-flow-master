import { createFileRoute } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/protected-layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDateTime, fmtTons } from "@/lib/types";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Lock, Search } from "lucide-react";

export const Route = createFileRoute("/audit")({
  component: () => <ProtectedLayout><AuditPage /></ProtectedLayout>,
});

type LogType = "all" | "user_login" | "excel_import" | "dam_adjustment" | "movement";

interface AuditRow {
  id: string;
  timestamp: string;
  user_id: string | null;
  user_email: string | null;
  log_type: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  status: string | null;
  metadata: Record<string, any>;
}

function useAuditLogs() {
  return useQuery({
    queryKey: ["audit_logs"],
    queryFn: async (): Promise<AuditRow[]> => {
      const { data, error } = await (supabase as any)
        .from("audit_logs")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
  });
}

function statusVariant(s: string | null): "default" | "secondary" | "destructive" | "outline" {
  if (s === "success") return "default";
  if (s === "partial") return "secondary";
  if (s === "failed") return "destructive";
  return "outline";
}

function categoryLabel(t: string) {
  switch (t) {
    case "user_login": return "User Login";
    case "excel_import": return "Excel Import";
    case "dam_adjustment": return "Dam Adjustment";
    case "movement": return "Movement";
    default: return t;
  }
}

function detailsFor(row: AuditRow): string {
  const m = row.metadata ?? {};
  switch (row.log_type) {
    case "user_login":
      return `${m.method ?? "login"} • ${m.user_agent ? String(m.user_agent).slice(0, 60) : ""}`;
    case "excel_import":
      return `${m.file_name ?? "file"} — ${m.rows_imported ?? 0}/${m.rows_detected ?? 0} imported, ${m.duplicates_detected ?? 0} dup, ${m.rows_failed ?? 0} failed`;
    case "dam_adjustment": {
      const prev = Number(m.previous_volume_tons ?? 0);
      const next = Number(m.new_volume_tons ?? 0);
      return `${m.dam_name ?? "dam"}: ${fmtTons(prev)} → ${fmtTons(next)} — ${m.reason ?? ""}`;
    }
    case "movement":
      return `${m.dam_name ?? "—"} • ${m.movement_type ?? ""} • ${m.vehicle_registration ?? "—"} • ${m.fgc_net_mass != null ? fmtTons(Number(m.fgc_net_mass)) : ""}`;
    default:
      return JSON.stringify(m).slice(0, 120);
  }
}

function searchHaystack(row: AuditRow): string {
  const m = row.metadata ?? {};
  return [
    row.user_email,
    row.action,
    m.dam_name,
    m.vehicle_registration,
    m.file_name,
    m.src_delivery_note,
    m.fgc_consignment_note_number,
    m.reason,
  ].filter(Boolean).join(" ").toLowerCase();
}

function AuditPage() {
  const { isAdmin } = useAuth();
  const { data: logs = [], isLoading, error } = useAuditLogs();
  const [tab, setTab] = useState<LogType>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const users = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => l.user_email && set.add(l.user_email));
    return Array.from(set).sort();
  }, [logs]);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (tab !== "all" && l.log_type !== tab) return false;
      if (from && new Date(l.timestamp) < new Date(from)) return false;
      if (to && new Date(l.timestamp) > new Date(to + "T23:59:59")) return false;
      if (userFilter && l.user_email !== userFilter) return false;
      if (statusFilter && (l.status ?? "") !== statusFilter) return false;
      if (search && !searchHaystack(l).includes(search.toLowerCase())) return false;
      return true;
    });
  }, [logs, tab, from, to, userFilter, statusFilter, search]);

  const counts = useMemo(() => ({
    all: logs.length,
    user_login: logs.filter((l) => l.log_type === "user_login").length,
    excel_import: logs.filter((l) => l.log_type === "excel_import").length,
    dam_adjustment: logs.filter((l) => l.log_type === "dam_adjustment").length,
    movement: logs.filter((l) => l.log_type === "movement").length,
  }), [logs]);

  if (!isAdmin) {
    return (
      <Card className="p-8 text-center">
        <Lock className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <h2 className="text-lg font-semibold">Admin only</h2>
        <p className="text-sm text-muted-foreground">Audit logs are restricted to administrators.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Audit control</p>
        <h1 className="mt-1 text-3xl font-black lg:text-4xl">Audit logs</h1>
        <p className="text-sm text-muted-foreground mt-1">Every login, import, dam adjustment, and movement change.</p>
      </div>

      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">User</Label>
            <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
              <option value="">All users</option>
              {users.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Any</option>
              <option value="success">Success</option>
              <option value="partial">Partial</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Search</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="vehicle, dam, file, ref…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </div>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as LogType)}>
        <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full">
          <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
          <TabsTrigger value="user_login">User Logins ({counts.user_login})</TabsTrigger>
          <TabsTrigger value="excel_import">Excel Imports ({counts.excel_import})</TabsTrigger>
          <TabsTrigger value="dam_adjustment">Dam Adjustments ({counts.dam_adjustment})</TabsTrigger>
          <TabsTrigger value="movement">Movements ({counts.movement})</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">Loading…</Card>
          ) : error ? (
            <Card className="p-8 text-center text-sm text-destructive">Failed to load: {(error as Error).message}</Card>
          ) : filtered.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">No audit entries match these filters.</Card>
          ) : (
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[170px]">Date / Time</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-xs text-muted-foreground tabular-nums">{fmtDateTime(row.timestamp)}</TableCell>
                      <TableCell className="text-sm">{row.user_email ?? <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell><Badge variant="outline">{row.action}</Badge></TableCell>
                      <TableCell className="text-sm">{categoryLabel(row.log_type)}</TableCell>
                      <TableCell className="text-sm max-w-md truncate" title={detailsFor(row)}>{detailsFor(row)}</TableCell>
                      <TableCell>{row.status ? <Badge variant={statusVariant(row.status)}>{row.status}</Badge> : <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
