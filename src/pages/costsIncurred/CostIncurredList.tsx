import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, ArrowUpDown, ArrowUp, ArrowDown, Pencil } from "lucide-react";
import { listCostsIncurred } from "@/api/costsIncurred";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { DateDisplay } from "@/components/shared/DateDisplay";
import { LookupDisplay } from "@/components/shared/LookupDisplay";
import { PageHeader } from "@/components/shared/PageHeader";
import type { CostIncurred } from "@/types/api";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";

const COST_TYPES = [
  "purchasing_cost",
  "maintenance",
  "repair",
  "insurance",
  "tax",
  "fitness_certificate",
  "pollution_check",
  "other",
];

const PAGE_SIZE = 20;

type SortDir = "asc" | "desc";

export default function CostIncurredList() {
  const [searchParams] = useSearchParams();
  const [vehicleSearch, setVehicleSearch] = useState(searchParams.get("vehicle_id") ?? "");
  const [typeFilter, setTypeFilter] = useState("all");
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: PAGE_SIZE });
  const [dateSort, setDateSort] = useState<SortDir>("desc"); // newest first by default

  const { data, isLoading } = useQuery({
    queryKey: ["costs-incurred", { vehicleSearch, typeFilter, pagination }],
    queryFn: () =>
      listCostsIncurred({
        cost_type: typeFilter === "all" ? undefined : typeFilter,
        limit: PAGE_SIZE,
        offset: pagination.pageIndex * PAGE_SIZE,
      }),
  });

  // Client-side sort by service_date on the fetched page
  const sortedRows = useMemo(() => {
    const rows = [...(data?.data ?? [])];
    rows.sort((a, b) => {
      const diff = a.service_date.localeCompare(b.service_date);
      return dateSort === "desc" ? -diff : diff;
    });
    return rows;
  }, [data?.data, dateSort]);

  const toggleDateSort = () => setDateSort((d) => (d === "desc" ? "asc" : "desc"));

  const DateSortIcon = dateSort === "desc" ? ArrowDown : dateSort === "asc" ? ArrowUp : ArrowUpDown;

  const columns: ColumnDef<CostIncurred, unknown>[] = [
    {
      id: "index",
      header: "#",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs">
          {pagination.pageIndex * PAGE_SIZE + row.index + 1}
        </span>
      ),
    },
    {
      header: "Type",
      accessorKey: "cost_type",
      cell: ({ getValue }) => <StatusBadge status={String(getValue())} listName="cost_type" />,
    },
    {
      header: "Description",
      accessorKey: "description",
      cell: ({ getValue }) => <span>{(getValue() as string) ?? "—"}</span>,
    },
    {
      header: "Cost",
      accessorKey: "cost",
      cell: ({ getValue }) => <CurrencyDisplay value={getValue() as string} />,
    },
    {
      header: "Garage",
      accessorKey: "garage",
      cell: ({ getValue }) => (
        <LookupDisplay listCode="garage" id={getValue() as string | null} />
      ),
    },
    {
      id: "service_date",
      accessorKey: "service_date",
      header: () => (
        <button
          onClick={toggleDateSort}
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          Date
          <DateSortIcon className="h-3.5 w-3.5" />
        </button>
      ),
      cell: ({ getValue }) => <DateDisplay value={getValue() as string} />,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Link to={`/costs-incurred/${row.original.id}/edit`}>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Costs Incurred"
        actions={
          <Link to="/costs-incurred/new">
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />Log Cost</Button>
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
          <SelectTrigger className="w-52"><SelectValue placeholder="Cost Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {COST_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!isLoading && (data?.data ?? []).length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <svg className="mx-auto mb-4 h-12 w-12 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
          </svg>
          <p>No costs recorded yet.</p>
        </div>
      ) : (
        <DataTable
          data={sortedRows}
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
