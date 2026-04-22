import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

const roleSchema = z.enum(["admin", "operator", "viewer"]);
type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

async function requireAdmin(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data: userData, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !userData.user) return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
  if (!isAdmin) return { error: Response.json({ error: "Forbidden" }, { status: 403 }) };
  return { userId: userData.user.id };
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
        if (error || !data.user) return Response.json({ error: error?.message ?? "Could not create user" }, { status: 400 });

        await supabaseAdmin.from("profiles").upsert({ id: data.user.id, email, full_name: fullName, status: "active" });
        await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user.id);
        const { error: roleError } = await supabaseAdmin.from("user_roles").insert({ user_id: data.user.id, role });
        if (roleError) return Response.json({ error: roleError.message }, { status: 400 });
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
          if (error) return Response.json({ error: error.message }, { status: 400 });
        }
        if (email || fullName) {
          const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            ...(email ? { email } : {}),
            ...(fullName ? { user_metadata: { full_name: fullName } } : {}),
          });
          if (error) return Response.json({ error: error.message }, { status: 400 });
        }
        if (role) {
          await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
          const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: userId, role });
          if (error) return Response.json({ error: error.message }, { status: 400 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
