import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/molasses-yard-hero.jpg";
import { ArrowRight, Truck } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }
  if (user) return <Navigate to="/dashboard" />;

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <section className="grid min-h-screen lg:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <div className="relative flex min-h-[68vh] items-end overflow-hidden px-6 py-10 sm:px-10 lg:min-h-screen lg:px-14 lg:py-14">
          <img src={heroImage} alt="Large tanker truck entering an industrial molasses storage yard with sugar cane fields behind it" width={1920} height={1088} className="absolute inset-[-2%] h-[104%] w-[104%] max-w-none object-cover object-center motion-safe:animate-[industrial-pan_22s_ease-in-out_infinite_alternate]" />
          <div className="absolute inset-0 bg-background/10" />
          <div className="absolute inset-0 bg-[linear-gradient(0deg,var(--background)_0%,oklch(0.16_0.012_260_/_0.46)_42%,oklch(0.16_0.012_260_/_0.08)_100%)]" />
          <div className="relative z-10 max-w-4xl pb-4">
            <div className="mb-5 inline-flex items-center gap-2 border border-border bg-card/70 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground shadow-elevated backdrop-blur">
              <Truck className="h-3.5 w-3.5" /> Yard operations platform
            </div>
            <h1 className="max-w-4xl text-4xl font-black leading-tight text-foreground drop-shadow-2xl sm:text-6xl lg:text-7xl">FGC Molasses Flow Tracking</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground drop-shadow sm:text-lg">Control dam stock, truck movements, variance insights, audit records, and formatted Excel reports from one industrial-grade workspace.</p>
          </div>
        </div>

        <aside className="flex min-h-[32vh] items-center justify-center border-t border-border bg-card px-6 py-10 shadow-elevated lg:min-h-screen lg:border-l lg:border-t-0 lg:px-10">
          <div className="w-full max-w-sm">
            <div className="mb-8">
              <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Secure access</p>
              <h2 className="mt-3 text-3xl font-black leading-tight text-foreground">Sign in to operations</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">Open the live dashboard to manage molasses stock, reports, users, and movement history.</p>
            </div>
            <Link to="/auth" className="block">
              <Button size="lg" className="w-full justify-between">Sign in <ArrowRight className="h-4 w-4" /></Button>
            </Link>
            <div className="mt-8 space-y-3 border-t border-border pt-6 text-sm text-muted-foreground">
              <div className="flex items-center justify-between gap-4"><span>Dam tracking</span><span className="font-semibold text-foreground">Live</span></div>
              <div className="flex items-center justify-between gap-4"><span>Audit logs</span><span className="font-semibold text-foreground">Protected</span></div>
              <div className="flex items-center justify-between gap-4"><span>Excel output</span><span className="font-semibold text-foreground">Formatted</span></div>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
