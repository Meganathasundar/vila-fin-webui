import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { getCustomer } from "@/api/customers";
import { listLoans } from "@/api/loans";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DateDisplay } from "@/components/shared/DateDisplay";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { PageHeader } from "@/components/shared/PageHeader";
import { CustomerForm } from "./CustomerForm";
import { usePermission } from "@/hooks/usePermission";
import type { Loan } from "@/types/api";

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const [editing, setEditing] = useState(false);
  const canEdit = usePermission("edit_customer");

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customers", id],
    queryFn: () => getCustomer(id!),
    enabled: !!id,
  });

  const { data: loans } = useQuery({
    queryKey: ["loans", { customer_id: id }],
    queryFn: () => listLoans({ limit: 50 }),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!customer) {
    return <p className="text-muted-foreground">Customer not found.</p>;
  }

  const customerLoans = (loans?.data ?? []).filter((l: Loan) => l.customer_id === id);

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title={customer.full_name ?? "Customer"}
        actions={
          canEdit && !editing ? (
            <Button size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4 mr-1" />Edit
            </Button>
          ) : undefined
        }
      />

      {editing ? (
        <Card>
          <CardHeader><CardTitle>Edit Customer</CardTitle></CardHeader>
          <CardContent>
            <CustomerForm customer={customer} onSuccess={() => setEditing(false)} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Customer Info</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {[
                ["Full Name", customer.full_name],
                ["Phone", customer.phone],
                ["Alt Phone", customer.alt_phone ?? "—"],
                ["Address", customer.address ?? "—"],
                ["City", customer.city ?? "—"],
                ["State", customer.state ?? "—"],
                ["Pincode", customer.pincode ?? "—"],
                ["ID Type", customer.id_type?.replace("_", " ")],
                ["ID Number", customer.id_number],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium capitalize">{value}</dd>
                </div>
              ))}
              <div>
                <dt className="text-muted-foreground">KYC Status</dt>
                <dd><StatusBadge status={customer.kyc_status ?? "pending"} /></dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Created</dt>
                <dd><DateDisplay value={customer.created_at} /></dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Linked Loans</CardTitle></CardHeader>
        <CardContent className="p-0">
          {customerLoans.length === 0 ? (
            <p className="px-6 py-4 text-sm text-muted-foreground">No loans linked to this customer.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-4 py-2 text-left">Loan No</th>
                  <th className="px-4 py-2 text-left">Principal</th>
                  <th className="px-4 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {customerLoans.map((loan: Loan) => (
                  <tr key={loan.id} className="border-b hover:bg-muted/20">
                    <td className="px-4 py-2">
                      <Link to={`/loans/${loan.id}`} className="text-primary hover:underline font-mono text-xs">
                        {loan.loan_number ?? "—"}
                      </Link>
                    </td>
                    <td className="px-4 py-2"><CurrencyDisplay value={loan.principal_amount} /></td>
                    <td className="px-4 py-2"><StatusBadge status={loan.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
