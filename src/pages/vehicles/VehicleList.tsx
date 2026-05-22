import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus, Eye } from "lucide-react";
import { listVehicles } from "@/api/vehicles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { useDebounce } from "@/hooks/useDebounce";
import type { Vehicle } from "@/types/api";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";

const PAGE_SIZE = 20;

export default function VehicleList() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: PAGE_SIZE });
  const debouncedSearch = useDebounce(search);

  const { data, isLoading } = useQuery({
    queryKey: ["vehicles", { search: debouncedSearch, statusFilter, sourceFilter, pagination }],
    queryFn: () =>
      listVehicles({
        registration_no: debouncedSearch || undefined,
        current_status: statusFilter === "all" ? undefined : statusFilter,
        vehicle_source: sourceFilter === "all" ? undefined : sourceFilter,
        limit: PAGE_SIZE,
        offset: pagination.pageIndex * PAGE_SIZE,
      }),
  });

  const columns: ColumnDef<Vehicle, unknown>[] = [
    { header: "Reg No", accessorKey: "registration_no", cell: ({ getValue }) => <span className="font-mono text-xs">{String(getValue())}</span> },
    { header: "Make", accessorKey: "make" },
    { header: "Model", accessorKey: "model" },
    { header: "Year", accessorKey: "year" },
    { header: "Fuel Type", accessorKey: "fuel_type", cell: ({ getValue }) => <span className="capitalize">{String(getValue())}</span> },
    { header: "Source", accessorKey: "vehicle_source", cell: ({ getValue }) => <StatusBadge status={String(getValue())} /> },
    { header: "Status", accessorKey: "current_status", cell: ({ getValue }) => <StatusBadge status={String(getValue())} /> },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <Link to={`/vehicles/${row.original.id}`}>
          <Button size="sm" variant="ghost"><Eye className="h-4 w-4" /></Button>
        </Link>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Vehicles"
        actions={
          <Link to="/vehicles/new">
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Vehicle</Button>
          </Link>
        }
      />
      <div className="flex gap-3 mb-4 flex-wrap">
        <Input
          placeholder="Search by reg no…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPagination((p) => ({ ...p, pageIndex: 0 })); }}
          className="max-w-xs"
        />
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPagination((p) => ({ ...p, pageIndex: 0 })); }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="loan_active">Loan Active</SelectItem>
            <SelectItem value="sold">Sold</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setPagination((p) => ({ ...p, pageIndex: 0 })); }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="lender_stock">Lender Stock</SelectItem>
            <SelectItem value="external_collateral">External Collateral</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!isLoading && (data?.data ?? []).length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <svg className="mx-auto mb-4 h-12 w-12 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 2h8l2-2z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 6h2l2 4v6h-4V6z"/></svg>
          <p>No vehicles registered. Add a vehicle to begin.</p>
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
