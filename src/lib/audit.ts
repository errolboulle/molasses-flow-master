import { supabase } from "@/integrations/supabase/client";

export type AuditLogType =
  | "user_login"
  | "excel_import"
  | "dam_adjustment"
  | "movement"
  | "system";

export type AuditStatus = "success" | "partial" | "failed" | null;

export interface LogAuditEventInput {
  log_type: AuditLogType;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  metadata?: Record<string, unknown>;
  status?: AuditStatus;
}

export async function logAuditEvent(input: LogAuditEventInput): Promise<void> {
  try {
    const { error } = await (supabase as any).rpc("log_audit_event", {
      _log_type: input.log_type,
      _action: input.action,
      _entity_type: input.entity_type ?? null,
      _entity_id: input.entity_id ?? null,
      _metadata: input.metadata ?? {},
      _status: input.status ?? null,
    });
    if (error) console.error("[audit] failed:", error.message);
  } catch (e) {
    console.error("[audit] threw:", e);
  }
}

function getBrowserInfo(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  // Compact summary: browser + OS
  return ua.length > 200 ? ua.slice(0, 200) : ua;
}

export async function logUserLogin(args: {
  userId: string;
  email: string | null | undefined;
  fullName?: string | null;
  method?: string;
}) {
  await logAuditEvent({
    log_type: "user_login",
    action: "login",
    entity_type: "user",
    entity_id: args.userId,
    status: "success",
    metadata: {
      user_id: args.userId,
      email: args.email,
      full_name: args.fullName ?? null,
      method: args.method ?? "email_password",
      user_agent: getBrowserInfo(),
      logged_at: new Date().toISOString(),
    },
  });
}
