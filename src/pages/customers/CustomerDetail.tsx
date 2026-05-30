import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { getPerson } from "@/api/persons";
import { listLoans } from "@/api/loans";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DateDisplay } from "@/components/shared/DateDisplay";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { PageHeader } from "@/components/shared/PageHeader";
import { PersonForm } from "./CustomerForm";
import { usePermission } from "@/hooks/usePermission";
import type { Loan } from "@/types/api";

export default function PersonDetail() {
  const { id } = useParams<{ id: string }>();
  const [editing, setEditing] = useState(false);
  const canEdit = usePermission("edit_person");

  const { data: person, isLoading } = useQuery({
    queryKey: ["persons", id],
    queryFn: () => getPerson(id!),
    enabled: !!id,
  });

  const { data: loans } = useQuery({
    queryKey: ["loans", { customer_id: id }],
    queryFn: () => listLoans({ customer_id: id, limit: 50 }),
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

  if (!person) {
    return <p className="text-muted-foreground">Person not found.</p>;
  }

  const personLoans = loans?.data ?? [];

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title={person.full_name ?? "Person"}
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
          <CardHeader><CardTitle>Edit Person</CardTitle></CardHeader>
          <CardContent>
            <PersonForm person={person} onSuccess={() => setEditing(false)} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Person Info</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {[
                ["Full Name", person.full_name],
                ["Phone", person.phone],
                ["Alt Phone", person.alt_phone ?? "—"],
                ["Address", person.address ?? "—"],
                ["City", person.city ?? "—"],
                ["State", person.state ?? "—"],
                ["Pincode", person.pincode ?? "—"],
                ["ID Type", person.id_type?.replace("_", " ")],
                ["ID Number", person.id_number],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium capitalize">{value}</dd>
                </div>
              ))}
              <div>
                <dt className="text-muted-foreground">KYC Status</dt>
                <dd><StatusBadge status={person.kyc_status ?? "pending"} /></dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Created</dt>
                <dd><DateDisplay value={person.created_at} /></dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Linked Loans</CardTitle></CardHeader>
        <CardContent className="p-0">
          {personLoans.length === 0 ? (
            <p className="px-6 py-4 text-sm text-muted-foreground">No loans linked to this person.</p>
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
                {personLoans.map((loan: Loan) => (
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
