import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";
import { jsonError } from "@/lib/api-auth";

const registerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
});

export const Route = createFileRoute("/api/auth/register")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = registerSchema.safeParse(await request.json());
        if (!parsed.success) return jsonError("Invalid registration details", 400);
        const { name, email, password } = parsed.data;
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: false,
          user_metadata: { full_name: name },
        });
        if (error || !data.user) return jsonError(error?.message ?? "Could not register user", 400);
        return Response.json({ ok: true, user_id: data.user.id }, { status: 201 });
      },
    },
  },
});
