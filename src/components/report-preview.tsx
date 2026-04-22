import { Card } from "@/components/ui/card";
import { buildDamReportRows, LEFT_COLS, RIGHT_COLS } from "@/lib/report-layout";
import { fmtNum, type Dam, type Movement } from "@/lib/types";

export function ReportPreview({ dams, movements, damId }: { dams: Dam[]; movements: Movement[]; damId: string }) {
  const visibleDams = damId ? dams.filter((d) => d.id === damId) : dams;

  return (
    <div className="space-y-6">
      {visibleDams.map((dam) => {
        const report = buildDamReportRows(dam, movements.filter((m) => m.dam_id === dam.id));
        return (
          <Card key={dam.id} className="overflow-hidden border-border bg-card">
            <div className="overflow-x-auto">
              <div className="min-w-[2200px] bg-popover p-4 text-[10px] text-popover-foreground">
                <div className="grid grid-cols-[12fr_32px_17fr]">
                  <div className="border-2 border-foreground/80 bg-primary/25 px-3 py-2 text-left text-sm font-bold text-primary">SOURCE MILL</div>
                  <div />
                  <div className="border-2 border-foreground/80 bg-success/25 px-3 py-2 text-right text-sm font-bold text-success">FGC</div>
                </div>
                <div className="border-x-2 border-b-2 border-foreground/80 bg-warning/80 py-3 text-center text-lg font-black text-warning-foreground">MOLASSES RECORDS FOR FGC 2025/26</div>
                <div className="border-x border-b border-foreground/50 bg-muted py-2 text-center font-bold">{dam.name.toUpperCase()}</div>
                <div className="h-3" />
                <div className="grid grid-cols-[12fr_32px_17fr]">
                  <div className="grid" style={{ gridTemplateColumns: `repeat(${LEFT_COLS.length}, minmax(0, 1fr))` }}>
                    {LEFT_COLS.map((c) => <HeaderCell key={c.header} tone="source">{c.header}</HeaderCell>)}
                  </div>
                  <div />
                  <div className="grid" style={{ gridTemplateColumns: `repeat(${RIGHT_COLS.length}, minmax(0, 1fr))` }}>
                    {RIGHT_COLS.map((c) => <HeaderCell key={c.header} tone={c.header === "IN" || c.header === "OUT" || c.header === "NETT" ? "balance" : "fgc"}>{c.header}</HeaderCell>)}
                  </div>
                </div>
                <div className="grid grid-cols-[12fr_32px_17fr]">
                  <div className="border border-foreground/50 bg-muted px-2 py-2 font-bold italic">Opening Balance</div>
                  <div />
                  <div className="grid" style={{ gridTemplateColumns: `repeat(${RIGHT_COLS.length}, minmax(0, 1fr))` }}>
                    <div className="col-span-16 border border-foreground/50 bg-muted px-2 py-2 text-right font-bold italic">Opening NETT →</div>
                    <div className="border-2 border-foreground/80 bg-muted px-2 py-2 text-right font-bold tabular-nums">{fmtNum(report.opening)}</div>
                  </div>
                </div>
                {report.rows.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-[12fr_32px_17fr]">
                    <div className="grid" style={{ gridTemplateColumns: `repeat(${LEFT_COLS.length}, minmax(0, 1fr))` }}>
                      {row.left.map((v, i) => <BodyCell key={i} value={v} />)}
                    </div>
                    <div />
                    <div className="grid" style={{ gridTemplateColumns: `repeat(${RIGHT_COLS.length}, minmax(0, 1fr))` }}>
                      {row.right.map((v, i) => <BodyCell key={i} value={v} balance={i >= RIGHT_COLS.length - 3} />)}
                    </div>
                  </div>
                ))}
                <div className="grid grid-cols-[12fr_32px_17fr]">
                  <div className="border-2 border-foreground/80 bg-muted px-2 py-2" />
                  <div />
                  <div className="grid" style={{ gridTemplateColumns: `repeat(${RIGHT_COLS.length}, minmax(0, 1fr))` }}>
                    <div className="col-span-14 border-2 border-foreground/80 bg-warning/70 px-2 py-2 text-right font-black text-warning-foreground">TOTALS</div>
                    <BodyCell value={report.totalIn} balance strong />
                    <BodyCell value={report.totalOut} balance strong />
                    <BodyCell value={report.closing} balance strong />
                  </div>
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function HeaderCell({ children, tone }: { children: React.ReactNode; tone: "source" | "fgc" | "balance" }) {
  const cls = tone === "source" ? "bg-primary/25 text-primary" : tone === "fgc" ? "bg-success/25 text-success" : "bg-warning/70 text-warning-foreground";
  return <div className={`min-h-12 border-2 border-foreground/80 px-1 py-2 text-center font-black leading-tight ${cls}`}>{children}</div>;
}

function BodyCell({ value, balance, strong }: { value: string | number; balance?: boolean; strong?: boolean }) {
  const display = typeof value === "number" ? fmtNum(value) : value;
  return <div className={`min-h-8 border border-foreground/45 px-1 py-1 ${typeof value === "number" ? "text-right tabular-nums" : "text-left"} ${balance ? "bg-muted" : "bg-popover"} ${strong ? "font-black" : ""}`}>{display}</div>;
}
