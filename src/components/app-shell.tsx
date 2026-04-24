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
  Activity,
  CalendarClock,
  ChevronDown,
  UserCircle,
  Gauge,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "operator", "supervisor", "viewer"] },
  { to: "/dams", label: "Dams", icon: Database, roles: ["admin", "operator", "supervisor", "viewer"] },
  
  { to: "/weigh-bridge", label: "Weigh Bridge Mode", icon: Gauge, roles: ["admin", "operator", "supervisor"] },
  { to: "/history", label: "History", icon: History, roles: ["admin", "operator", "supervisor", "viewer"] },
  { to: "/reports", label: "Reports", icon: BarChart3, roles: ["admin", "operator", "supervisor", "viewer"] },
  { to: "/audit", label: "Audit Log", icon: ScrollText, roles: ["admin", "operator", "supervisor", "viewer"] },
  { to: "/users", label: "Users", icon: Users, roles: ["admin"] },
  { to: "/settings", label: "Settings", icon: Settings, roles: ["admin"] },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { user, roles, signOut, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const visibleNav = navItems.filter((n) => n.roles.some((r) => roles.includes(r as any)));
  const primaryRole = isAdmin ? "Admin" : roles[0] ?? "User";

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-background flex text-foreground">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-72 border-r border-sidebar-border bg-sidebar/90 backdrop-blur-xl">
        <div className="px-6 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-[var(--gradient-primary)] flex items-center justify-center font-black text-primary-foreground shadow-[var(--shadow-glow)]">F</div>
            <div>
              <div className="font-bold text-sm leading-tight">FGC Molasses</div>
              <div className="text-xs text-muted-foreground">Industrial Operations</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto">
          {visibleNav.map((item) => {
            const active = location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200",
                  active ? "bg-primary/14 text-foreground shadow-[inset_0_0_0_1px_var(--border)]" : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 py-4 border-t border-sidebar-border space-y-3">
          <div className="rounded-2xl border border-border bg-secondary/25 px-3 py-3 text-xs">
            <div className="font-semibold truncate">{user?.email}</div>
            <div className="mt-1 text-muted-foreground">{primaryRole}</div>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14 border-b border-border bg-background/90 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-[var(--gradient-primary)] flex items-center justify-center font-bold text-primary-foreground text-sm">F</div>
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

        <header className="hidden lg:flex h-16 items-center justify-between border-b border-border bg-background/72 px-8 backdrop-blur-xl">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">FGC Molasses</p>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><Activity className="h-3.5 w-3.5 text-success" /> System Live</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden xl:flex items-center gap-2 rounded-xl border border-border bg-secondary/30 px-3 py-2 text-sm text-muted-foreground">
              <CalendarClock className="h-4 w-4" /> {now.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short", year: "numeric" })} · {now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-3">
                  <UserCircle className="h-4 w-4" /> {primaryRole} <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>
                  <div className="truncate text-sm">{user?.email}</div>
                  <div className="text-xs font-normal text-muted-foreground">{primaryRole}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}><LogOut className="h-4 w-4" /> Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

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
