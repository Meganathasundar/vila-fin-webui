import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus, Eye } from "lucide-react";
import { listCustomers } from "@/api/customers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DateDisplay } from "@/components/shared/DateDisplay";
import { PageHeader } from "@/components/shared/PageHeader";
import { useDebounce } from "@/hooks/useDebounce";
import type { Customer } from "@/types/api";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";

const PAGE_SIZE = 20;

export default function CustomerList() {
  const [phone, setPhone] = useState("");
  const [kycStatus, setKycStatus] = useState("all");
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: PAGE_SIZE });
  const debouncedPhone = useDebounce(phone);

  const { data, isLoading } = useQuery({
    queryKey: ["customers", { phone: debouncedPhone, kycStatus, pagination }],
    queryFn: () =>
      listCustomers({
        phone: debouncedPhone || undefined,
        kyc_status: kycStatus === "all" ? undefined : kycStatus,
        limit: PAGE_SIZE,
        offset: pagination.pageIndex * PAGE_SIZE,
      }),
  });

  const columns: ColumnDef<Customer, unknown>[] = [
    { header: "Full Name", accessorKey: "full_name" },
    { header: "Phone", accessorKey: "phone" },
    { header: "ID Type", accessorKey: "id_type", cell: ({ getValue }) => <span className="capitalize">{String(getValue()).replace("_", " ")}</span> },
    { header: "ID Number", accessorKey: "id_number" },
    { header: "KYC Status", accessorKey: "kyc_status", cell: ({ getValue }) => <StatusBadge status={String(getValue())} /> },
    { header: "Created", accessorKey: "created_at", cell: ({ getValue }) => <DateDisplay value={String(getValue())} /> },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <Link to={`/customers/${row.original.id}`}>
          <Button size="sm" variant="ghost"><Eye className="h-4 w-4" /></Button>
        </Link>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Customers"
        actions={
          <Link to="/customers/new">
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Customer</Button>
          </Link>
        }
      />

      <div className="flex gap-3 mb-4">
        <Input
          placeholder="Search by phone…"
          value={phone}
          onChange={(e) => { setPhone(e.target.value); setPagination((p) => ({ ...p, pageIndex: 0 })); }}
          className="max-w-xs"
        />
        <Select value={kycStatus} onValueChange={(v) => { setKycStatus(v); setPagination((p) => ({ ...p, pageIndex: 0 })); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="KYC Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="uploaded">Uploaded</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!isLoading && (data?.data ?? []).length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <svg className="mx-auto mb-4 h-12 w-12 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          <p>No customers yet. Add your first customer to get started.</p>
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
