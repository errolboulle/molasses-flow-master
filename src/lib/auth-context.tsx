import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type AppRole = "admin" | "operator" | "supervisor" | "viewer" | "demo";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  loading: boolean;
  isAdmin: boolean;
  isOperator: boolean;
  isSupervisor: boolean;
  isViewer: boolean;
  isSupervisorOnly: boolean;
  canEntry: boolean;
  termsAcceptedAt: string | null;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
  isSupervisorOnly: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [status, setStatus] = useState<string>("active");
  const [termsAcceptedAt, setTermsAcceptedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRoles = async (userId: string) => {
    const [{ data }, profileResult] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("status, terms_accepted_at").eq("id", userId).maybeSingle(),
    ]);
    setRoles((data?.map((r) => r.role as AppRole)) ?? []);
    const profile = profileResult.data as { status?: string; terms_accepted_at?: string | null } | null;
    setStatus(profile?.status ?? "active");
    setTermsAcceptedAt(profile?.terms_accepted_at ?? null);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      if (sess?.user) {
        setTimeout(() => fetchRoles(sess.user.id), 0);
      } else {
        setRoles([]);
        setStatus("active");
      }
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      if (sess?.user) {
        fetchRoles(sess.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const isAdmin = roles.includes("admin");
  const isOperator = roles.includes("operator");
  const isSupervisor = roles.includes("supervisor");
  const isViewer = roles.includes("viewer");

  const disabled = status !== "active";

  const value: AuthContextValue = {
    session: disabled ? null : session,
    user: disabled ? null : (session?.user ?? null),
    roles,
    loading,
    isAdmin,
    isOperator,
    isSupervisor,
    isViewer,
    canEntry: isAdmin || isOperator,
    isSupervisorOnly: isSupervisor && !isAdmin && !isOperator,
    termsAcceptedAt,
    signOut: async () => { await supabase.auth.signOut(); },
    refreshRoles: async () => { if (session?.user) await fetchRoles(session.user.id); },
    refreshProfile: async () => { if (session?.user) await fetchRoles(session.user.id); },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
