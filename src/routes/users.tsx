import { createFileRoute } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/protected-layout";
import { useUsersAdmin } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fmtDateTime } from "@/lib/types";
import { useState, type FormEvent } from "react";
import { Edit3, Trash2, UserPlus } from "lucide-react";
import { RouteError } from "@/components/route-error";
import { useAuth } from "@/lib/auth-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export const Route = createFileRoute("/users")({
  head: () => ({ meta: [
    { title: "Users | Flow Ops" },
    { name: "description", content: "Flow Ops users for molasses storage and operations." },
    { property: "og:title", content: "Users | Flow Ops" },
    { property: "og:description", content: "Flow Ops users for molasses storage and operations." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <ProtectedLayout requireAdmin allowSupervisor><UsersPage /></ProtectedLayout>,
  errorComponent: RouteError,
});

const ROLES = ["admin", "operator", "supervisor", "viewer"] as const;
type Role = typeof ROLES[number];

type UserRow = { id: string; full_name: string | null; email: string; status: string; created_at: string; roles: string[] };

function UsersPage() {
  const { data: users = [] } = useUsersAdmin();
  const qc = useQueryClient();
  const { user: currentUser, isAdmin } = useAuth();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState<UserRow | null>(null);
  const [deleteMode, setDeleteMode] = useState<"soft" | "hard">("soft");
  const [deletePassword, setDeletePassword] = useState("");
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

  const startDelete = (u: UserRow) => {
    setDeleting(u);
    setDeleteMode("soft");
    setDeletePassword("");
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    if (!deletePassword) { toast.error("Enter your password to confirm"); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: await authHeaders(),
        body: JSON.stringify({ userId: deleting.id, mode: deleteMode, password: deletePassword }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not delete user");
      toast.success("User successfully deleted and access removed");
      setDeleting(null);
      setDeletePassword("");
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Access control</p>
          <h1 className="mt-1 text-3xl font-black lg:text-4xl">Users</h1>
          <p className="text-sm text-muted-foreground mt-1">Add users, manage roles, edit details, and deactivate access.</p>
        </div>
        {isAdmin && <Button disabled={!isAdmin} onClick={() => { setCreating(true); setEditing(null); setForm({ fullName: "", email: "", password: "", role: "operator" }); }}>
          <UserPlus className="h-4 w-4" /> Add user
        </Button>}
      </div>

      {isAdmin && (creating || editing) && (
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

      <Table>
        <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Roles</TableHead><TableHead>Status</TableHead><TableHead>Joined</TableHead>{isAdmin && <TableHead className="text-right">Actions</TableHead>}</TableRow></TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell><div className="font-semibold">{u.full_name || u.email}</div><div className="text-xs text-muted-foreground">{u.email}</div></TableCell>
              <TableCell><div className="flex gap-1 flex-wrap">{u.roles.length === 0 && <Badge variant="outline">no role</Badge>}{u.roles.map((r) => <Badge key={r} variant={r === "admin" ? "default" : "secondary"}>{r}</Badge>)}</div></TableCell>
              <TableCell><Badge variant={u.status === "active" ? "outline" : "destructive"}>{u.status === "active" ? "active" : "inactive"}</Badge></TableCell>
              <TableCell className="text-muted-foreground">{fmtDateTime(u.created_at)}</TableCell>
              {isAdmin && <TableCell><div className="flex justify-end gap-2 flex-wrap"><Button disabled={!isAdmin} size="sm" variant="outline" onClick={() => startEdit(u as UserRow)}><Edit3 className="h-4 w-4" /> Edit</Button><Button disabled={!isAdmin} size="sm" variant={u.status === "active" ? "destructive" : "default"} onClick={() => updateUser({ userId: u.id, status: u.status === "active" ? "disabled" : "active" })}>{u.status === "active" ? "Deactivate" : "Restore"}</Button> {currentUser?.id !== u.id && <Button disabled={!isAdmin} size="sm" variant="destructive" onClick={() => startDelete(u as UserRow)}><Trash2 className="h-4 w-4" /> Delete</Button>}</div></TableCell>}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!deleting} onOpenChange={(open) => { if (!open) { setDeleting(null); setDeletePassword(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete user</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete this user? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {deleting && (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <div className="font-semibold">{deleting.full_name || deleting.email}</div>
                <div className="text-xs text-muted-foreground">{deleting.email}</div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider">Deletion type</Label>
                <RadioGroup value={deleteMode} onValueChange={(v) => setDeleteMode(v as "soft" | "hard")} className="gap-2">
                  <label className="flex items-start gap-2 rounded-md border p-3 cursor-pointer hover:bg-accent">
                    <RadioGroupItem value="soft" id="del-soft" className="mt-0.5" />
                    <div className="text-sm">
                      <div className="font-medium">Soft delete (recommended)</div>
                      <div className="text-xs text-muted-foreground">Revokes login and all roles, anonymizes name to "Deleted User", keeps historical records.</div>
                    </div>
                  </label>
                  <label className="flex items-start gap-2 rounded-md border p-3 cursor-pointer hover:bg-accent">
                    <RadioGroupItem value="hard" id="del-hard" className="mt-0.5" />
                    <div className="text-sm">
                      <div className="font-medium">Hard delete</div>
                      <div className="text-xs text-muted-foreground">Permanently removes profile, authentication, and personal info. Historical records remain but the user reference is anonymized.</div>
                    </div>
                  </label>
                </RadioGroup>
              </div>

              <div className="space-y-1">
                <Label htmlFor="del-pw" className="text-xs">Confirm your password</Label>
                <Input id="del-pw" type="password" autoComplete="current-password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setDeleting(null); setDeletePassword(""); }}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={busy || !deletePassword}>
              {busy ? "Deleting…" : "Delete Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
