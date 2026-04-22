import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type AppRole = "admin" | "operator" | "supervisor" | "viewer";

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function requireApiAuth(request: Request, allowedRoles?: AppRole[]) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { error: jsonError("Unauthorized", 401) } as const;

  const { data: userData, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !userData.user) return { error: jsonError("Unauthorized", 401) } as const;

  const { data: rolesData } = await (supabaseAdmin as any)
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id);

  const roles = ((rolesData ?? []).map((row: { role: AppRole }) => row.role)) as AppRole[];
  if (allowedRoles?.length && !roles.some((role) => allowedRoles.includes(role))) {
    return { error: jsonError("Forbidden", 403) } as const;
  }

  return { user: userData.user, userId: userData.user.id, roles, token } as const;
}

export function getAuthedClient(token: string) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Missing backend configuration");
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  }) as any;
}

export function paginationFromUrl(request: Request) {
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 50)));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return { url, page, pageSize, from, to };
}
