import { createFileRoute } from "@tanstack/react-router";
import { jsonError } from "@/lib/api-auth";

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
