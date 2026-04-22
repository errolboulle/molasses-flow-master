import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/molasses-yard-hero.jpg";
import { ArrowRight, BarChart3, FileSpreadsheet, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

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
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <img src={heroImage} alt="Large tanker truck entering an industrial molasses storage yard with sugar cane fields behind it" width={1920} height={1088} className="absolute inset-0 h-full w-full object-cover object-center motion-safe:animate-[industrial-pan_22s_ease-in-out_infinite_alternate]" />
      <div className="absolute inset-0 bg-background/35" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--background)_0%,oklch(0.16_0.012_260_/_0.88)_30%,oklch(0.16_0.012_260_/_0.42)_58%,oklch(0.16_0.012_260_/_0.14)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(0deg,var(--background)_0%,transparent_100%)]" />
      <section className="relative z-10 flex min-h-screen items-center px-6 py-12 lg:px-14">
        <div className="max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 border border-border bg-card/70 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground shadow-elevated backdrop-blur">
            Industrial inventory control
          </div>
          <h1 className="max-w-3xl text-4xl font-black leading-tight text-foreground drop-shadow-2xl sm:text-6xl lg:text-7xl">FGC Molasses Flow Tracking</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground drop-shadow sm:text-lg">Professional dam stock control, truck movement logging, variance analytics, audit records, and formatted Excel reporting for molasses operations.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/auth"><Button size="lg">Sign in <ArrowRight className="h-4 w-4" /></Button></Link>
          </div>
          <div className="mt-12 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
            <HeroMetric icon={<ShieldCheck className="h-4 w-4" />} label="Audit controlled" />
            <HeroMetric icon={<BarChart3 className="h-4 w-4" />} label="Live insights" />
            <HeroMetric icon={<FileSpreadsheet className="h-4 w-4" />} label="Excel preview" />
          </div>
        </div>
      </section>
    </main>
  );
}

function HeroMetric({ icon, label }: { icon: ReactNode; label: string }) {
  return <div className="flex items-center gap-2 border border-border bg-card/65 px-3 py-3 text-sm font-semibold backdrop-blur">{icon}{label}</div>;
}
