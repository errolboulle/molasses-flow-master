import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

export function PaginationControls({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100, 200],
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : page * pageSize + 1;
  const end = Math.min(total, (page + 1) * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mt-3 text-sm">
      <div className="text-muted-foreground">
        Showing <span className="font-medium text-foreground">{start.toLocaleString()}–{end.toLocaleString()}</span> of{" "}
        <span className="font-medium text-foreground">{total.toLocaleString()}</span>
      </div>
      <div className="flex items-center gap-2">
        {onPageSizeChange && (
          <select
            className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            aria-label="Rows per page"
          >
            {pageSizeOptions.map((s) => (
              <option key={s} value={s}>{s} / page</option>
            ))}
          </select>
        )}
        <Button variant="outline" size="sm" disabled={page <= 0} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs tabular-nums text-muted-foreground">
          {page + 1} / {totalPages}
        </span>
        <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
