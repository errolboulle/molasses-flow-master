import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { RouteError } from "@/components/route-error";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [
    { title: "Sign in | Flow Ops" },
    { name: "description", content: "Flow Ops sign in for molasses storage and operations." },
    { property: "og:title", content: "Sign in | Flow Ops" },
    { property: "og:description", content: "Flow Ops sign in for molasses storage and operations." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AuthPage,
  errorComponent: RouteError,
});

function AuthPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (authLoading) return null;
  if (user) return <Navigate to="/dashboard" />;

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    if (data.user) {
      const { logUserLogin } = await import("@/lib/audit");
      logUserLogin({
        userId: data.user.id,
        email: data.user.email,
        fullName: (data.user.user_metadata as any)?.full_name,
        method: "email_password",
      });
    }
    toast.success("Signed in");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10" style={{ background: "var(--gradient-industrial)" }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 rounded-xl bg-gradient-to-br from-primary to-purple items-center justify-center font-bold text-2xl text-primary-foreground mb-4 shadow-xl">F</div>
          <h1 className="text-2xl font-bold">Flow Ops</h1>
          <p className="text-sm text-muted-foreground mt-1">Industrial molasses inventory & reconciliation</p>
        </div>
        <Card className="p-6 bg-card/80 backdrop-blur border-border">
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="si-email">Email</Label>
              <Input id="si-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="si-pw">Password</Label>
              <Input id="si-pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Accounts are created by an administrator. Contact your admin for access.
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}
