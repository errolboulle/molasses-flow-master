import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { logAndJsonError } from "@/lib/api-auth";
import { z } from "zod";

const roleSchema = z.enum(["admin", "operator", "supervisor", "viewer"]);
type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

async function requireAdmin(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data: userData, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !userData.user) return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
  if (!isAdmin) return { error: Response.json({ error: "Forbidden" }, { status: 403 }) };
  return { userId: userData.user.id, email: userData.user.email ?? null };
}


const createUserSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(128),
  role: roleSchema,
});

const updateUserSchema = z.object({
  userId: z.string().uuid(),
  fullName: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email().max(255).optional(),
  role: roleSchema.optional(),
  status: z.enum(["active", "disabled"]).optional(),
});

export const Route = createFileRoute("/api/admin/users")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAdmin(request);
        if (auth.error) return auth.error;
        const parsed = createUserSchema.safeParse(await request.json());
        if (!parsed.success) return Response.json({ error: "Invalid user details" }, { status: 400 });
        const { fullName, email, password, role } = parsed.data;

        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName },
        });
        if (error || !data.user) return logAndJsonError("api/admin/users POST createUser", error, "Could not create user");

        await supabaseAdmin.from("profiles").upsert({ id: data.user.id, email, full_name: fullName, status: "active" });
        await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user.id);
        const { error: roleError } = await supabaseAdmin.from("user_roles").insert({ user_id: data.user.id, role });
        if (roleError) return logAndJsonError("api/admin/users POST role", roleError, "Could not assign user role");
        return Response.json({ ok: true });
      },
      PATCH: async ({ request }) => {
        const auth = await requireAdmin(request);
        if (auth.error) return auth.error;
        const parsed = updateUserSchema.safeParse(await request.json());
        if (!parsed.success) return Response.json({ error: "Invalid user details" }, { status: 400 });
        const { userId, fullName, email, role, status } = parsed.data;

        const profilePatch: ProfileUpdate = {};
        if (fullName) profilePatch.full_name = fullName;
        if (email) profilePatch.email = email;
        if (status) profilePatch.status = status;
        if (Object.keys(profilePatch).length) {
          const { error } = await supabaseAdmin.from("profiles").update(profilePatch).eq("id", userId);
          if (error) return logAndJsonError("api/admin/users PATCH profile", error, "Could not update user");
        }
        if (email || fullName) {
          const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            ...(email ? { email } : {}),
            ...(fullName ? { user_metadata: { full_name: fullName } } : {}),
          });
          if (error) return logAndJsonError("api/admin/users PATCH auth", error, "Could not update user");
        }
        if (status) {
          const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            ban_duration: status === "disabled" ? "87600h" : "none",
          } as any);
          if (error) return logAndJsonError("api/admin/users PATCH ban", error, "Could not update user status");
        }
        if (role) {
          await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
          const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: userId, role });
          if (error) return logAndJsonError("api/admin/users PATCH role", error, "Could not update user role");
        }
        return Response.json({ ok: true });
      },
      DELETE: async ({ request }) => {
        const auth = await requireAdmin(request);
        if (auth.error) return auth.error;

        const deleteSchema = z.object({
          userId: z.string().uuid(),
          mode: z.enum(["soft", "hard"]),
          password: z.string().min(1).max(256),
        });
        const parsed = deleteSchema.safeParse(await request.json());
        if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
        const { userId, mode, password } = parsed.data;

        if (userId === auth.userId) {
          return Response.json({ error: "You cannot delete your own account" }, { status: 400 });
        }

        // Re-verify admin's password
        if (!auth.email) return Response.json({ error: "Admin email missing" }, { status: 400 });
        const verifier = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });
        const { error: pwError } = await verifier.auth.signInWithPassword({ email: auth.email, password });
        if (pwError) return Response.json({ error: "Password is incorrect" }, { status: 401 });

        // Prevent removing the last admin
        const { data: targetRoles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
        const targetIsAdmin = (targetRoles ?? []).some((r) => r.role === "admin");
        if (targetIsAdmin) {
          const { count } = await supabaseAdmin
            .from("user_roles")
            .select("user_id", { count: "exact", head: true })
            .eq("role", "admin");
          if ((count ?? 0) <= 1) {
            return Response.json({ error: "Cannot delete the last remaining admin" }, { status: 400 });
          }
        }

        // Fetch profile for audit trail
        const { data: targetProfile } = await supabaseAdmin
          .from("profiles")
          .select("email, full_name")
          .eq("id", userId)
          .maybeSingle();

        if (mode === "soft") {
          // Revoke roles & sessions, mark inactive, anonymize display name
          await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
          const { error: profErr } = await supabaseAdmin
            .from("profiles")
            .update({ status: "disabled", full_name: "Deleted User" })
            .eq("id", userId);
          if (profErr) return logAndJsonError("api/admin/users DELETE soft profile", profErr, "Could not deactivate user");
          // Ban the auth user for 100 years — forces logout & blocks login
          const { error: banErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            ban_duration: "876000h",
          } as any);
          if (banErr) return logAndJsonError("api/admin/users DELETE soft ban", banErr, "Could not revoke user access");
        } else {
          // Hard delete: roles + profile + auth user. Historical references (created_by, user_id
          // in audit_logs, etc.) have no FK and become anonymous orphan UUIDs.
          await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
          await supabaseAdmin.from("profiles").delete().eq("id", userId);
          const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
          if (delErr) return logAndJsonError("api/admin/users DELETE hard auth", delErr, "Could not delete user account");
        }

        await supabaseAdmin.rpc("log_audit_event", {
          _log_type: "user",
          _action: mode === "soft" ? "soft_delete_user" : "hard_delete_user",
          _entity_type: "user",
          _entity_id: userId,
          _metadata: {
            mode,
            deleted_email: targetProfile?.email ?? null,
            deleted_full_name: targetProfile?.full_name ?? null,
            performed_by: auth.userId,
          },
          _status: "success",
        });

        return Response.json({ ok: true });
      },
    },
  },
});
