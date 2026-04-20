import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Database,
  TruckIcon,
  History,
  BarChart3,
  Users,
  Settings,
  LogOut,
  ScrollText,
  Menu,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "operator", "viewer"] },
  { to: "/dams", label: "Dams", icon: Database, roles: ["admin", "operator", "viewer"] },
  { to: "/movements", label: "Movements", icon: TruckIcon, roles: ["admin", "operator", "viewer"] },
  { to: "/history", label: "History", icon: History, roles: ["admin", "operator", "viewer"] },
  { to: "/reports", label: "Reports", icon: BarChart3, roles: ["admin", "operator", "viewer"] },
  { to: "/audit", label: "Audit Log", icon: ScrollText, roles: ["admin", "operator", "viewer"] },
  { to: "/users", label: "Users", icon: Users, roles: ["admin"] },
  { to: "/settings", label: "Settings", icon: Settings, roles: ["admin"] },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { user, roles, signOut, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleNav = navItems.filter((n) => n.roles.some((r) => roles.includes(r as any)));
  const primaryRole = isAdmin ? "Admin" : roles[0] ?? "User";

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-border bg-sidebar">
        <div className="px-6 py-5 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-md bg-gradient-to-br from-primary to-purple flex items-center justify-center font-bold text-primary-foreground">F</div>
            <div>
              <div className="font-bold text-sm leading-tight">FGC Molasses</div>
              <div className="text-xs text-muted-foreground">Storage Manager</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {visibleNav.map((item) => {
            const active = location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 py-3 border-t border-border space-y-2">
          <div className="px-3 py-2 text-xs">
            <div className="font-medium truncate">{user?.email}</div>
            <div className="text-muted-foreground">{primaryRole}</div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14 border-b border-border bg-background/95 backdrop-blur">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-gradient-to-br from-primary to-purple flex items-center justify-center font-bold text-primary-foreground text-sm">F</div>
            <div className="font-semibold text-sm">FGC Molasses</div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </header>

        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 z-40 bg-background/95 backdrop-blur pt-14">
            <nav className="px-4 py-4 space-y-1">
              {visibleNav.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 rounded-md text-base font-medium text-foreground hover:bg-accent"
                  >
                    <Icon className="h-5 w-5" /> {item.label}
                  </Link>
                );
              })}
              <div className="pt-4 mt-4 border-t border-border">
                <div className="px-3 py-2 text-sm">
                  <div className="font-medium">{user?.email}</div>
                  <div className="text-muted-foreground text-xs">{primaryRole}</div>
                </div>
                <Button variant="ghost" className="w-full justify-start mt-2" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4" /> Sign out
                </Button>
              </div>
            </nav>
          </div>
        )}

        <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
          <div className="container max-w-7xl mx-auto px-4 py-6 lg:px-8 lg:py-8">{children}</div>
        </main>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur">
          <div className="grid grid-cols-5">
            {visibleNav.slice(0, 5).map((item) => {
              const active = location.pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
