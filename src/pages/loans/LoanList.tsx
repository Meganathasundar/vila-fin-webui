import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { listLoans } from "@/api/loans";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { DateDisplay } from "@/components/shared/DateDisplay";
import { PageHeader } from "@/components/shared/PageHeader";
import { useDebounce } from "@/hooks/useDebounce";
import { useLookups } from "@/context/LookupContext";
import { cn } from "@/lib/utils";
import type { Loan } from "@/types/api";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";

const PAGE_SIZE = 20;

// ── Per-status count (cheap query: limit 1, only meta.total is used) ──────────

function useStatusCount(status: string) {
  const { data } = useQuery({
    queryKey: ["loans-count", status],
    queryFn: () => listLoans({ status, limit: 1, offset: 0 }),
    staleTime: 60_000,
  });
  return data?.meta?.total ?? null;
}

// ── Overview status card ──────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { color: string; border: string; bg: string; ring: string }> = {
  active:    { color: "text-green-700",  border: "border-green-300",  bg: "bg-green-50",  ring: "ring-green-400"  },
  draft:     { color: "text-yellow-700", border: "border-yellow-300", bg: "bg-yellow-50", ring: "ring-yellow-400" },
  defaulted: { color: "text-red-700",    border: "border-red-300",    bg: "bg-red-50",    ring: "ring-red-400"    },
  closed:    { color: "text-blue-700",   border: "border-blue-300",   bg: "bg-blue-50",   ring: "ring-blue-400"   },
  cancelled: { color: "text-gray-500",   border: "border-gray-300",   bg: "bg-gray-50",   ring: "ring-gray-400"   },
};

function OverviewCard({
  label,
  status,
  selected,
  onClick,
}: {
  label: string;
  status: string;
  selected: boolean;
  onClick: () => void;
}) {
  const count = useStatusCount(status);
  const s = STATUS_STYLES[status];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 min-w-[7rem] rounded-lg border px-4 py-3 text-left transition-all",
        selected && s ? `${s.bg} ${s.border} ring-2 ring-offset-1 ${s.ring}` : "bg-white border-border hover:bg-muted/40"
      )}
    >
      <p className={cn("text-xs font-medium uppercase tracking-wide", selected && s ? s.color : "text-muted-foreground")}>
        {label}
      </p>
      <p className={cn("text-2xl font-bold mt-0.5 tabular-nums", selected && s ? s.color : "text-foreground")}>
        {count ?? "—"}
      </p>
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LoanList() {
  const navigate = useNavigate();
  const { getLookupLabel } = useLookups();
  const [search, setSearch] = useState("");
  // Default: active loans only
  const [statusFilter, setStatusFilter] = useState("active");
  const [typeFilter, setTypeFilter] = useState("all");
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: PAGE_SIZE });
  const debouncedSearch = useDebounce(search);

  const setStatus = (v: string) => {
    setStatusFilter(v);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  };

  const { data, isLoading } = useQuery({
    queryKey: ["loans", { search: debouncedSearch, statusFilter, typeFilter, pagination }],
    queryFn: () =>
      listLoans({
        loan_number: debouncedSearch || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
        loan_type: typeFilter === "all" ? undefined : typeFilter,
        limit: PAGE_SIZE,
        offset: pagination.pageIndex * PAGE_SIZE,
      }),
  });

  const columns: ColumnDef<Loan, unknown>[] = [
    {
      header: "Loan No",
      accessorKey: "loan_number",
      cell: ({ row }) => (
        <Link to={`/loans/${row.original.id}`} className="font-mono text-xs text-primary hover:underline">
          {row.original.loan_number ?? "—"}
        </Link>
      ),
    },
    { header: "Loan Source", accessorKey: "loan_source", cell: ({ getValue }) => { const v = getValue(); if (!v) return <span className="text-muted-foreground text-sm">—</span>; const label = getLookupLabel("loan_source", String(v)); return <span className="text-sm">{label || String(v)}</span>; } },
    { header: "Principal", accessorKey: "principal_amount", cell: ({ getValue }) => <CurrencyDisplay value={String(getValue())} /> },
    { header: "EMI", accessorKey: "emi_amount", cell: ({ getValue }) => <CurrencyDisplay value={String(getValue())} /> },
    { header: "Status", accessorKey: "status", cell: ({ getValue }) => <StatusBadge status={String(getValue())} /> },
    { header: "First Due", accessorKey: "first_due_date", cell: ({ getValue }) => <DateDisplay value={getValue() as string | undefined} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Loans"
        actions={
          <Link to="/loans/new">
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />Create Loan</Button>
          </Link>
        }
      />

      {/* ── Overview cards ────────────────────────────────────────────────────── */}
      <div className="flex gap-3 flex-wrap mb-5">
        {(["active", "draft", "defaulted", "closed", "cancelled"] as const).map((s) => (
          <OverviewCard
            key={s}
            label={s.charAt(0).toUpperCase() + s.slice(1)}
            status={s}
            selected={statusFilter === s}
            onClick={() => setStatus(s)}
          />
        ))}
        {/* All loans card */}
        <button
          type="button"
          onClick={() => setStatus("all")}
          className={cn(
            "flex-1 min-w-[7rem] rounded-lg border px-4 py-3 text-left transition-all",
            statusFilter === "all"
              ? "bg-primary/10 border-primary ring-2 ring-offset-1 ring-primary"
              : "bg-white border-border hover:bg-muted/40"
          )}
        >
          <p className={cn("text-xs font-medium uppercase tracking-wide", statusFilter === "all" ? "text-primary" : "text-muted-foreground")}>
            All
          </p>
          <p className={cn("text-2xl font-bold mt-0.5 tabular-nums", statusFilter === "all" ? "text-primary" : "text-foreground")}>
            {statusFilter === "all" ? (data?.meta?.total ?? "—") : ""}
          </p>
        </button>
      </div>

      {/* ── Filters ───────────────────────────────────────────────────────────── */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <Input
          placeholder="Search by loan number…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPagination((p) => ({ ...p, pageIndex: 0 })); }}
          className="max-w-xs"
        />
        <Select value={statusFilter} onValueChange={setStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="defaulted">Defaulted</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPagination((p) => ({ ...p, pageIndex: 0 })); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Loan Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="vehicle_sale">Vehicle Sale</SelectItem>
            <SelectItem value="external_purchase">External Purchase</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────────── */}
      {!isLoading && (data?.data ?? []).length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <svg className="mx-auto mb-4 h-12 w-12 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p>No {statusFilter !== "all" ? statusFilter : ""} loans found.</p>
        </div>
      ) : (
        <DataTable
          data={data?.data ?? []}
          columns={columns}
          total={data?.meta?.total ?? 0}
          pagination={pagination}
          onPaginationChange={setPagination}
          isLoading={isLoading}
          pageSize={PAGE_SIZE}
          onRowClick={(loan) => navigate(`/loans/${loan.id}`)}
        />
      )}
    </div>
  );
}
