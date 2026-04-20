import { createFileRoute } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/protected-layout";
import { useUsersAdmin } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fmtDateTime } from "@/lib/types";

export const Route = createFileRoute("/users")({
  component: () => <ProtectedLayout requireAdmin><UsersPage /></ProtectedLayout>,
});

const ROLES = ["admin", "operator", "viewer"] as const;

function UsersPage() {
  const { data: users = [] } = useUsersAdmin();
  const qc = useQueryClient();

  const setRole = async (userId: string, role: typeof ROLES[number]) => {
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) { toast.error(error.message); return; }
    toast.success("Role updated");
    qc.invalidateQueries({ queryKey: ["users-admin"] });
  };

  const toggleStatus = async (userId: string, current: string) => {
    const next = current === "active" ? "disabled" : "active";
    const { error } = await supabase.from("profiles").update({ status: next }).eq("id", userId);
    if (error) { toast.error(error.message); return; }
    toast.success(`User ${next}`);
    qc.invalidateQueries({ queryKey: ["users-admin"] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold">Users</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage roles and access.</p>
      </div>

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
                  <Badge variant={u.status === "active" ? "outline" : "destructive"}>{u.status}</Badge>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {ROLES.map((r) => (
                  <Button key={r} size="sm" variant={u.roles.includes(r) ? "default" : "outline"} onClick={() => setRole(u.id, r)}>
                    {r}
                  </Button>
                ))}
                <Button size="sm" variant={u.status === "active" ? "destructive" : "default"} onClick={() => toggleStatus(u.id, u.status)}>
                  {u.status === "active" ? "Disable" : "Enable"}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
