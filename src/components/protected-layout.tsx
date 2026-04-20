import { useAuth } from "@/lib/auth-context";
import { Navigate, Outlet } from "@tanstack/react-router";
import { useSettings } from "@/lib/queries";
import { AppShell } from "./app-shell";

export function ProtectedLayout({ requireAdmin = false }: { requireAdmin?: boolean }) {
  const { user, loading, isAdmin, roles } = useAuth();
  const { data: settings, isLoading: settingsLoading } = useSettings();

  if (loading || settingsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" />;
  if (roles.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h2 className="text-xl font-semibold">Awaiting role assignment</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account exists but no role is assigned yet. Contact an admin.
          </p>
        </div>
      </div>
    );
  }

  if (settings && !settings.onboarded && isAdmin) {
    return <Navigate to="/onboarding" />;
  }

  if (requireAdmin && !isAdmin) {
    return (
      <AppShell>
        <div className="text-center py-16">
          <h2 className="text-xl font-semibold">Admin access required</h2>
          <p className="mt-2 text-sm text-muted-foreground">You don't have permission to view this page.</p>
        </div>
      </AppShell>
    );
  }

  return <AppShell><Outlet /></AppShell>;
}
