import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getLoan, activateLoan, closeLoan, defaultLoan, cancelLoan } from "@/api/loans";
import { getCustomer } from "@/api/customers";
import { getVehicle } from "@/api/vehicles";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { DateDisplay } from "@/components/shared/DateDisplay";
import { PageHeader } from "@/components/shared/PageHeader";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { usePermission } from "@/hooks/usePermission";
import { calculateEMI, calculateTotalPayable, calculateTotalInterest } from "@/utils/emi";

type DialogType = "activate" | "close" | "default" | "cancel" | null;

const DIALOG_CONFIG: Record<
  NonNullable<DialogType>,
  { title: string; description: string; confirmLabel: string; destructive?: boolean }
> = {
  activate: {
    title: "Activate Loan",
    description: "Activating this loan will generate the full repayment schedule and mark the vehicle as Loan Active. This cannot be undone.",
    confirmLabel: "Activate",
  },
  close: {
    title: "Close Loan",
    description: "Are you sure you want to close this loan? This marks it as fully repaid.",
    confirmLabel: "Close Loan",
  },
  default: {
    title: "Mark as Defaulted",
    description: "This will mark the loan as defaulted. Are you sure?",
    confirmLabel: "Mark Defaulted",
    destructive: true,
  },
  cancel: {
    title: "Cancel Loan",
    description: "Are you sure you want to cancel this loan? This action cannot be undone.",
    confirmLabel: "Cancel Loan",
    destructive: true,
  },
};

export default function LoanDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<DialogType>(null);
  const canActivate = usePermission("activate_loan");
  const canClose = usePermission("close_loan");
  const canCancel = usePermission("cancel_loan");

  const { data: loan, isLoading } = useQuery({
    queryKey: ["loans", id],
    queryFn: () => getLoan(id!),
    enabled: !!id,
  });

  const { data: customer } = useQuery({
    queryKey: ["customers", loan?.customer_id],
    queryFn: () => getCustomer(loan!.customer_id!),
    enabled: !!loan?.customer_id,
  });

  const { data: vehicle } = useQuery({
    queryKey: ["vehicles", loan?.vehicle_id],
    queryFn: () => getVehicle(loan!.vehicle_id!),
    enabled: !!loan?.vehicle_id,
  });

  const mutation = useMutation({
    mutationFn: (action: NonNullable<DialogType>) => {
      if (!loan || !id) throw new Error("No loan");
      if (action === "activate") return activateLoan(id, loan);
      if (action === "close") return closeLoan(id, loan);
      if (action === "default") return defaultLoan(id, loan);
      return cancelLoan(id, loan);
    },
    onSuccess: (_, action) => {
      queryClient.invalidateQueries({ queryKey: ["loans", id] });
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      toast.success(
        action === "activate" ? "Loan activated" :
        action === "close" ? "Loan closed" :
        action === "default" ? "Loan marked as defaulted" : "Loan cancelled"
      );
      setDialog(null);
    },
    onError: () => toast.error("Action failed. Please try again."),
  });

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-4xl">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!loan) return <p className="text-muted-foreground">Loan not found.</p>;

  const principal = parseFloat(loan.principal_amount ?? "0");
  const rate = parseFloat(loan.interest_rate ?? "0");
  const tenure = loan.tenure_months ?? 0;
  const emi = parseFloat(loan.emi_amount ?? "0") || calculateEMI(principal, rate, tenure);
  const totalPayable = calculateTotalPayable(emi, tenure);
  const totalInterest = calculateTotalInterest(principal, emi, tenure);

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader title={`Loan ${loan.loan_number ?? "—"}`} />

      {/* Status action bar */}
      <div className="flex items-center gap-3 flex-wrap p-4 rounded-lg border bg-white">
        <StatusBadge status={loan.status} />
        {loan.status === "draft" && canActivate && (
          <Button size="sm" onClick={() => setDialog("activate")}>Activate Loan</Button>
        )}
        {loan.status === "active" && canClose && (
          <>
            <Button size="sm" variant="outline" onClick={() => setDialog("close")}>Close Loan</Button>
            <Button size="sm" variant="destructive" onClick={() => setDialog("default")}>Mark as Defaulted</Button>
          </>
        )}
        {loan.status === "draft" && canCancel && (
          <Button size="sm" variant="outline" onClick={() => setDialog("cancel")}>Cancel Loan</Button>
        )}
      </div>

      {/* Loan summary */}
      <Card>
        <CardHeader><CardTitle>Loan Summary</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div><dt className="text-muted-foreground">Loan Type</dt><dd><StatusBadge status={loan.loan_type} /></dd></div>
            <div><dt className="text-muted-foreground">Principal</dt><dd className="font-semibold"><CurrencyDisplay value={loan.principal_amount} /></dd></div>
            <div><dt className="text-muted-foreground">Interest Rate</dt><dd>{loan.interest_rate}% p.a.</dd></div>
            <div><dt className="text-muted-foreground">Tenure</dt><dd>{loan.tenure_months} months</dd></div>
            <div><dt className="text-muted-foreground">EMI</dt><dd className="font-semibold"><CurrencyDisplay value={emi} /></dd></div>
            <div><dt className="text-muted-foreground">Total Payable</dt><dd><CurrencyDisplay value={totalPayable} /></dd></div>
            <div><dt className="text-muted-foreground">Total Interest</dt><dd><CurrencyDisplay value={totalInterest} /></dd></div>
            <div><dt className="text-muted-foreground">Disbursement Date</dt><dd><DateDisplay value={loan.disbursement_date} /></dd></div>
            <div><dt className="text-muted-foreground">Maturity Date</dt><dd><DateDisplay value={loan.maturity_date} /></dd></div>
            {loan.notes && <div className="col-span-2"><dt className="text-muted-foreground">Notes</dt><dd>{loan.notes}</dd></div>}
          </dl>
        </CardContent>
      </Card>

      {/* Linked customer */}
      {customer && (
        <Card>
          <CardHeader><CardTitle>Customer</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{customer.full_name}</p>
                <p className="text-sm text-muted-foreground">{customer.phone}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={customer.kyc_status ?? "pending"} />
                <Link to={`/customers/${customer.id}`}>
                  <Button size="sm" variant="outline">View</Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Linked vehicle */}
      {vehicle && (
        <Card>
          <CardHeader><CardTitle>Vehicle</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium font-mono text-sm">{vehicle.registration_no}</p>
                <p className="text-sm text-muted-foreground">{vehicle.make} {vehicle.model} · {vehicle.year}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={vehicle.vehicle_source ?? "lender_stock"} />
                <Link to={`/vehicles/${vehicle.id}`}>
                  <Button size="sm" variant="outline">View</Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Repayment schedule placeholder */}
      <Card>
        <CardHeader><CardTitle>Repayment Schedule</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {loan.status === "draft"
              ? "Activate the loan to generate the repayment schedule."
              : "Repayment schedule will appear here once available from the API."}
          </p>
        </CardContent>
      </Card>

      {dialog && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          title={DIALOG_CONFIG[dialog].title}
          description={DIALOG_CONFIG[dialog].description}
          confirmLabel={DIALOG_CONFIG[dialog].confirmLabel}
          destructive={DIALOG_CONFIG[dialog].destructive}
          onConfirm={() => mutation.mutate(dialog)}
          loading={mutation.isPending}
        />
      )}
    </div>
  );
}
