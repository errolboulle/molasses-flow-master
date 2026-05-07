import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import heroImage from "@/assets/molasses-yard-hero.jpg";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Database, FileSpreadsheet, LockKeyhole, SearchCheck, Truck } from "lucide-react";
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
  const [demoLoading, setDemoLoading] = useState(false);

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

  const handleDemo = async () => {
    setDemoLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: "demo@flowops.app", password: "Demo1234!" });
    setDemoLoading(false);
    if (error) {
      toast.error("Demo unavailable: " + error.message);
      return;
    }
    toast.success("Welcome to the demo");
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
        <div className="relative flex min-h-[68vh] items-end overflow-hidden px-6 pb-6 pt-10 sm:px-10 sm:pb-8 lg:min-h-screen lg:px-16 lg:pb-10 lg:pt-16">
          <img src={heroImage} alt="Large tanker truck entering an industrial molasses storage yard with sugar cane fields behind it" width={1920} height={1088} className="absolute inset-[-2%] h-[104%] w-[104%] max-w-none object-cover object-center saturate-110 motion-safe:animate-[industrial-pan_24s_ease-in-out_infinite_alternate]" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,oklch(0.08_0.018_258_/_0.46)_0%,oklch(0.11_0.018_258_/_0.28)_48%,transparent_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(0deg,oklch(0.08_0.018_258_/_0.34)_0%,oklch(0.12_0.018_258_/_0.16)_34%,transparent_100%)]" />
          <div className="relative z-10 max-w-4xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground shadow-[var(--shadow-elevated)] backdrop-blur-xl">
              <Truck className="h-3.5 w-3.5 text-primary" /> Yard operations platform
            </div>
            <h1 className="max-w-2xl text-2xl font-black leading-tight text-foreground drop-shadow-2xl sm:text-4xl lg:text-5xl">Flow Ops — Molasses Flow & Dam Management</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground drop-shadow sm:text-lg">Real-time tracking, audit logs, and automated reporting for industrial operations.</p>
          </div>
        </div>

        <aside className="relative flex min-h-[32vh] items-center justify-center overflow-hidden border-t border-border bg-background px-6 py-10 lg:min-h-screen lg:border-l lg:border-t-0 lg:px-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,oklch(0.63_0.16_248_/_0.20),transparent_18rem),radial-gradient(circle_at_90%_82%,oklch(0.55_0.09_170_/_0.16),transparent_22rem),linear-gradient(145deg,oklch(0.12_0.018_258),oklch(0.17_0.025_248)_52%,oklch(0.10_0.014_258))]" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,oklch(1_0_0_/_0.035)_1px,transparent_1px),linear-gradient(0deg,transparent,oklch(1_0_0_/_0.028)_1px,transparent_1px)] bg-[length:48px_48px] opacity-45" />
          <div className="relative flex w-full max-w-sm flex-col gap-6 rounded-3xl bg-card/58 p-7 shadow-[var(--shadow-glow)] backdrop-blur-2xl sm:p-8">
            <div className="mb-2">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><LockKeyhole className="h-4 w-4 text-primary" /> Secure Access</p>
              <h2 className="mt-3 text-3xl font-black leading-tight text-foreground">Sign in to operations</h2>
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
            <div className="grid grid-cols-2 gap-3 border-t border-border/70 pt-5">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div key={feature.title} className="rounded-2xl bg-secondary/24 p-3 transition-all duration-200 hover:bg-secondary/36">
                    <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/12 text-primary"><Icon className="h-4 w-4" /></div>
                    <h3 className="text-xs font-bold leading-snug">{feature.title}</h3>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
