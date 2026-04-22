import { createFileRoute } from "@tanstack/react-router";
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
        await request.json().catch(() => null);
        return jsonError("Use the standard sign-up page to create an account", 410);
      },
    },
  },
});
