import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Columns } from "lucide-react";
import { listVehicles } from "@/api/vehicles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DateDisplay } from "@/components/shared/DateDisplay";
import { PageHeader } from "@/components/shared/PageHeader";
import { useDebounce } from "@/hooks/useDebounce";
import type { Vehicle } from "@/types/api";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
// Button kept for column chooser trigger only

const PAGE_SIZE = 20;

interface ColOption {
  id: string;
  label: string;
  always?: boolean;
}

const COL_OPTIONS: ColOption[] = [
  { id: "registration_no", label: "Reg No", always: true },
  { id: "make", label: "Make" },
  { id: "model", label: "Model" },
  { id: "year", label: "Year" },
  { id: "color", label: "Color" },
  { id: "fuel_type", label: "Fuel Type" },
  { id: "vehicle_type", label: "Vehicle Type" },
  { id: "vehicle_source", label: "Source" },
  { id: "current_status", label: "Status", always: true },
  { id: "purchase_date", label: "Purchase Date" },
];

const DEFAULT_VISIBLE = new Set(["registration_no", "make", "model", "year", "fuel_type", "vehicle_source", "current_status"]);

export default function VehicleList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: PAGE_SIZE });
  const [visibleCols, setVisibleCols] = useState<Set<string>>(DEFAULT_VISIBLE);
  const [colPickerOpen, setColPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebounce(search);

  // Close picker on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setColPickerOpen(false);
      }
    }
    if (colPickerOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [colPickerOpen]);

  const toggleCol = (id: string) => {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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

  const allColumns: ColumnDef<Vehicle, unknown>[] = [
    {
      id: "registration_no",
      header: "Reg No",
      accessorKey: "registration_no",
      cell: ({ getValue }) => <span className="font-mono text-xs">{String(getValue())}</span>,
    },
    { id: "make", header: "Make", accessorKey: "make" },
    { id: "model", header: "Model", accessorKey: "model" },
    { id: "year", header: "Year", accessorKey: "year" },
    {
      id: "color",
      header: "Color",
      accessorKey: "color",
      cell: ({ getValue }) => <span>{(getValue() as string) ?? "—"}</span>,
    },
    {
      id: "fuel_type",
      header: "Fuel Type",
      accessorKey: "fuel_type",
      cell: ({ getValue }) => <span className="capitalize">{(getValue() as string) ?? "—"}</span>,
    },
    {
      id: "vehicle_type",
      header: "Vehicle Type",
      accessorKey: "vehicle_type",
      cell: ({ getValue }) => (
        <span className="capitalize">{((getValue() as string) ?? "—").replace(/_/g, " ")}</span>
      ),
    },
    {
      id: "vehicle_source",
      header: "Source",
      accessorKey: "vehicle_source",
      cell: ({ getValue }) => <StatusBadge status={String(getValue())} />,
    },
    {
      id: "current_status",
      header: "Status",
      accessorKey: "current_status",
      cell: ({ getValue }) => <StatusBadge status={String(getValue())} />,
    },
    {
      id: "purchase_date",
      header: "Purchase Date",
      accessorKey: "purchase_date",
      cell: ({ getValue }) =>
        getValue() ? <DateDisplay value={getValue() as string} /> : <span className="text-muted-foreground">—</span>,
    },
  ];

  const columns = allColumns.filter((c) => visibleCols.has(c.id!));

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
      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <Input
          placeholder="Search by reg no…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPagination((p) => ({ ...p, pageIndex: 0 })); }}
          className="max-w-xs"
        />
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPagination((p) => ({ ...p, pageIndex: 0 })); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="loan_active">Loan Active</SelectItem>
            <SelectItem value="sold">Sold</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setPagination((p) => ({ ...p, pageIndex: 0 })); }}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Source" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="lender_stock">Lender Stock</SelectItem>
            <SelectItem value="external_collateral">External Collateral</SelectItem>
          </SelectContent>
        </Select>

        {/* Column chooser */}
        <div className="relative ml-auto" ref={pickerRef}>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setColPickerOpen((o) => !o)}
            className="gap-1.5"
          >
            <Columns className="h-4 w-4" />
            Columns
          </Button>
          {colPickerOpen && (
            <div className="absolute right-0 top-9 z-50 w-48 rounded-md border bg-white shadow-md py-1">
              {COL_OPTIONS.map((col) => (
                <label
                  key={col.id}
                  className={`flex items-center gap-2.5 px-3 py-1.5 text-sm cursor-pointer hover:bg-accent ${col.always ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={visibleCols.has(col.id)}
                    disabled={col.always}
                    onChange={() => !col.always && toggleCol(col.id)}
                    className="h-3.5 w-3.5 accent-primary"
                  />
                  {col.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {!isLoading && (data?.data ?? []).length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <svg className="mx-auto mb-4 h-12 w-12 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 2h8l2-2z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 6h2l2 4v6h-4V6z" />
          </svg>
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
          onRowClick={(v) => navigate(`/vehicles/${v.id}`)}
        />
      )}
    </div>
  );
}
