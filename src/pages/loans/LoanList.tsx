import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus, Eye } from "lucide-react";
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
import type { Loan } from "@/types/api";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";

const PAGE_SIZE = 20;

export default function LoanList() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: PAGE_SIZE });
  const debouncedSearch = useDebounce(search);

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
    { header: "Loan Type", accessorKey: "loan_type", cell: ({ getValue }) => <StatusBadge status={String(getValue())} /> },
    { header: "Principal", accessorKey: "principal_amount", cell: ({ getValue }) => <CurrencyDisplay value={String(getValue())} /> },
    { header: "EMI", accessorKey: "emi_amount", cell: ({ getValue }) => <CurrencyDisplay value={String(getValue())} /> },
    { header: "Status", accessorKey: "status", cell: ({ getValue }) => <StatusBadge status={String(getValue())} /> },
    { header: "Disbursed", accessorKey: "disbursement_date", cell: ({ getValue }) => <DateDisplay value={getValue() as string | undefined} /> },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <Link to={`/loans/${row.original.id}`}>
          <Button size="sm" variant="ghost"><Eye className="h-4 w-4" /></Button>
        </Link>
      ),
    },
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
      <div className="flex gap-3 mb-4 flex-wrap">
        <Input
          placeholder="Search by loan number…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPagination((p) => ({ ...p, pageIndex: 0 })); }}
          className="max-w-xs"
        />
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPagination((p) => ({ ...p, pageIndex: 0 })); }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
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

      {!isLoading && (data?.data ?? []).length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <svg className="mx-auto mb-4 h-12 w-12 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          <p>No loans found. Create a loan to get started.</p>
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
        />
      )}
    </div>
  );
}
