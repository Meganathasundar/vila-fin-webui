import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { listServiceExpenses } from "@/api/serviceExpenses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { DateDisplay } from "@/components/shared/DateDisplay";
import { PageHeader } from "@/components/shared/PageHeader";
import type { ServiceExpense } from "@/types/api";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";

const SERVICE_TYPES = ["maintenance", "repair", "insurance", "tax", "fitness_certificate", "pollution_check", "other"];
const PAGE_SIZE = 20;

export default function ServiceExpenseList() {
  const [searchParams] = useSearchParams();
  const [vehicleSearch, setVehicleSearch] = useState(searchParams.get("vehicle_id") ?? "");
  const [typeFilter, setTypeFilter] = useState("all");
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: PAGE_SIZE });

  const { data, isLoading } = useQuery({
    queryKey: ["service-expenses", { vehicleSearch, typeFilter, pagination }],
    queryFn: () =>
      listServiceExpenses({
        service_type: typeFilter === "all" ? undefined : typeFilter,
        limit: PAGE_SIZE,
        offset: pagination.pageIndex * PAGE_SIZE,
      }),
  });

  const columns: ColumnDef<ServiceExpense, unknown>[] = [
    { header: "Service Type", accessorKey: "service_type", cell: ({ getValue }) => <StatusBadge status={String(getValue())} /> },
    { header: "Description", accessorKey: "description" },
    { header: "Cost", accessorKey: "cost", cell: ({ getValue }) => <CurrencyDisplay value={getValue() as string} /> },
    { header: "Garage", accessorKey: "garage_name", cell: ({ getValue }) => <span>{(getValue() as string) ?? "—"}</span> },
    { header: "Date", accessorKey: "service_date", cell: ({ getValue }) => <DateDisplay value={getValue() as string} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Service Expenses"
        actions={
          <Link to="/service-expenses/new">
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />Log Expense</Button>
          </Link>
        }
      />

      <div className="flex gap-3 mb-4 flex-wrap">
        <Input
          placeholder="Search by vehicle reg no…"
          value={vehicleSearch}
          onChange={(e) => { setVehicleSearch(e.target.value); setPagination((p) => ({ ...p, pageIndex: 0 })); }}
          className="max-w-xs"
        />
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPagination((p) => ({ ...p, pageIndex: 0 })); }}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Service Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {SERVICE_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!isLoading && (data?.data ?? []).length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <svg className="mx-auto mb-4 h-12 w-12 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          <p>No service expenses recorded for this vehicle.</p>
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
