import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { jsonError } from "@/lib/api-auth";

const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(128),
});

export const Route = createFileRoute("/api/auth/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = loginSchema.safeParse(await request.json());
        if (!parsed.success) return jsonError("Invalid login details", 400);
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!url || !key) return jsonError("Backend is not configured", 500);
        const client = createClient(url, key, { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } });
        const { data, error } = await client.auth.signInWithPassword(parsed.data);
        if (error || !data.session) return jsonError("Invalid email or password", 401);
        return Response.json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token, user: data.user });
      },
    },
  },
});
