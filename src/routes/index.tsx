import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import heroImage from "@/assets/molasses-yard-hero.jpg";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, ClipboardCheck, Database, FileSpreadsheet, LockKeyhole, SearchCheck, Truck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  const handleSignIn = async (event: FormEvent) => {
    event.preventDefault();
    setSigningIn(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSigningIn(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Signed in");
    navigate({ to: "/dashboard" });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }
  if (user) return <Navigate to="/dashboard" />;

  const features = [
    { icon: Truck, title: "Real-Time Truck Logging", description: "Capture incoming and outgoing loads as operations happen." },
    { icon: Database, title: "Multi-Dam Tracking", description: "Monitor storage levels, capacity, and balance changes." },
    { icon: FileSpreadsheet, title: "Automated Excel Reports", description: "Generate clean operational reports with dam summaries." },
    { icon: SearchCheck, title: "Full Audit History", description: "Trace adjustments and edits with controlled accountability." },
  ];

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <section className="grid min-h-screen lg:grid-cols-[minmax(0,1.32fr)_minmax(390px,0.68fr)]">
        <div className="relative flex min-h-[68vh] items-end overflow-hidden px-6 py-10 sm:px-10 lg:min-h-screen lg:px-16 lg:py-16">
          <img src={heroImage} alt="Large tanker truck entering an industrial molasses storage yard with sugar cane fields behind it" width={1920} height={1088} className="absolute inset-[-2%] h-[104%] w-[104%] max-w-none object-cover object-center blur-[1.5px] saturate-110 motion-safe:animate-[industrial-pan_24s_ease-in-out_infinite_alternate]" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,oklch(0.08_0.018_258_/_0.88)_0%,oklch(0.11_0.018_258_/_0.62)_48%,oklch(0.08_0.018_258_/_0.38)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(0deg,var(--background)_0%,oklch(0.12_0.018_258_/_0.50)_36%,transparent_100%)]" />
          <div className="relative z-10 max-w-4xl pb-4">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground shadow-[var(--shadow-elevated)] backdrop-blur-xl">
              <Truck className="h-3.5 w-3.5 text-primary" /> Yard operations platform
            </div>
            <h1 className="max-w-4xl text-4xl font-black leading-tight text-foreground drop-shadow-2xl sm:text-6xl lg:text-7xl">Molasses Flow & Dam Management Platform</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground drop-shadow sm:text-lg">Real-time tracking, audit logs, and automated reporting for industrial operations.</p>
          </div>
        </div>

        <aside className="relative flex min-h-[32vh] items-center justify-center border-t border-border bg-background px-6 py-10 lg:min-h-screen lg:border-l lg:border-t-0 lg:px-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,oklch(0.32_0.08_255_/_0.32),transparent_28rem)]" />
          <div className="relative w-full max-w-sm rounded-3xl border border-border bg-card/64 p-7 shadow-[var(--shadow-glow)] backdrop-blur-2xl sm:p-8">
            <div className="mb-8">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><LockKeyhole className="h-4 w-4 text-primary" /> Secure Access</p>
              <h2 className="mt-3 text-3xl font-black leading-tight text-foreground">Sign in to operations</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">Open the live dashboard for stock, reports, users, and movement history.</p>
            </div>
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="home-email">Email</Label>
                <Input id="home-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="home-password">Password</Label>
                <Input id="home-password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
              </div>
              <Button type="submit" size="lg" className="w-full justify-between" disabled={signingIn}>
                {signingIn ? "Signing in…" : "Sign in"} <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </aside>
      </section>

      <section className="border-t border-border bg-background px-6 py-16 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Built for industrial operations</p>
              <h2 className="mt-2 text-2xl font-black sm:text-3xl">Control, visibility, and reporting in one workspace.</h2>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><ClipboardCheck className="h-4 w-4 text-success" /> Audit-ready operating records</div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="group rounded-2xl border border-border bg-card/70 p-5 shadow-[var(--shadow-elevated)] transition-all duration-200 hover:-translate-y-1 hover:border-primary/35 hover:bg-card">
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/12 text-primary"><Icon className="h-5 w-5" /></div>
                  <h3 className="font-bold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
