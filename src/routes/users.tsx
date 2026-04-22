import { createFileRoute } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/protected-layout";
import { useUsersAdmin } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fmtDateTime } from "@/lib/types";
import { useState, type FormEvent } from "react";
import { Edit3, UserPlus } from "lucide-react";

export const Route = createFileRoute("/users")({
  component: () => <ProtectedLayout requireAdmin><UsersPage /></ProtectedLayout>,
});

const ROLES = ["admin", "operator", "viewer"] as const;
type Role = typeof ROLES[number];

type UserRow = { id: string; full_name: string | null; email: string; status: string; created_at: string; roles: string[] };

function UsersPage() {
  const { data: users = [] } = useUsersAdmin();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", password: "", role: "operator" as Role });

  const authHeaders = async () => {
    const { data } = await supabase.auth.getSession();
    return { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` };
  };

  const refresh = () => qc.invalidateQueries({ queryKey: ["users-admin"] });

  const createUser = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/admin/users", { method: "POST", headers: await authHeaders(), body: JSON.stringify(form) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not create user");
      toast.success("User added");
      setCreating(false);
      setForm({ fullName: "", email: "", password: "", role: "operator" });
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const updateUser = async (payload: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/users", { method: "PATCH", headers: await authHeaders(), body: JSON.stringify(payload) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not update user");
      toast.success("User updated");
      setEditing(null);
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (u: UserRow) => {
    setEditing(u);
    setCreating(false);
    setForm({ fullName: u.full_name || "", email: u.email, password: "", role: (u.roles[0] as Role) || "viewer" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Users</h1>
          <p className="text-sm text-muted-foreground mt-1">Add users, manage roles, edit details, and deactivate access.</p>
        </div>
        <Button onClick={() => { setCreating(true); setEditing(null); setForm({ fullName: "", email: "", password: "", role: "operator" }); }}>
          <UserPlus className="h-4 w-4" /> Add user
        </Button>
      </div>

      {(creating || editing) && (
        <Card className="p-5">
          <form onSubmit={creating ? createUser : (e) => { e.preventDefault(); if (editing) updateUser({ userId: editing.id, fullName: form.fullName, email: form.email, role: form.role }); }} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div className="space-y-1 md:col-span-1"><Label className="text-xs">Full name</Label><Input required value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} /></div>
            <div className="space-y-1 md:col-span-1"><Label className="text-xs">Email / username</Label><Input required type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
            {creating && <div className="space-y-1 md:col-span-1"><Label className="text-xs">Temporary password</Label><Input required minLength={6} type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} /></div>}
            <div className="space-y-1"><Label className="text-xs">Role</Label><select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
            <div className="flex gap-2"><Button type="submit" disabled={busy}>{busy ? "Saving…" : creating ? "Create" : "Save"}</Button><Button type="button" variant="outline" onClick={() => { setCreating(false); setEditing(null); }}>Cancel</Button></div>
          </form>
        </Card>
      )}

      <div className="space-y-2">
        {users.map((u) => (
          <Card key={u.id} className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-semibold">{u.full_name || u.email}</div>
                <div className="text-xs text-muted-foreground">{u.email} · joined {fmtDateTime(u.created_at)}</div>
                <div className="flex gap-1 mt-2 flex-wrap">
                  {u.roles.length === 0 && <Badge variant="outline">no role</Badge>}
                  {u.roles.map((r) => <Badge key={r} variant={r === "admin" ? "default" : "secondary"}>{r}</Badge>)}
                  <Badge variant={u.status === "active" ? "outline" : "destructive"}>{u.status === "active" ? "active" : "inactive"}</Badge>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => startEdit(u as UserRow)}><Edit3 className="h-4 w-4" /> Edit</Button>
                <Button size="sm" variant={u.status === "active" ? "destructive" : "default"} onClick={() => updateUser({ userId: u.id, status: u.status === "active" ? "disabled" : "active" })}>
                  {u.status === "active" ? "Deactivate" : "Restore"}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
