import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Pencil, Lock } from "lucide-react";
import {
  getLoan, updateLoan, closeLoan, defaultLoan, cancelLoan,
  getLoanSchedule, updateInstallment,
} from "@/api/loans";
import { getPerson, listPersons } from "@/api/persons";
import { getVehicle } from "@/api/vehicles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { DateDisplay } from "@/components/shared/DateDisplay";
import { PageHeader } from "@/components/shared/PageHeader";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { LookupSelectField } from "@/components/shared/LookupSelectField";
import { PersonMatchDialog } from "@/components/shared/PersonMatchDialog";
import { EmiCalculator } from "@/components/shared/EmiCalculator";
import { useLookups } from "@/context/LookupContext";
import { usePermission } from "@/hooks/usePermission";
import { calculateEMI, calculateTotalPayable, calculateTotalInterest } from "@/utils/emi";
import type { Loan, Person, ScheduleItem, ScheduleSummary, UpdateInstallmentRequest } from "@/types/api";

// ── Constants ──────────────────────────────────────────────────────────────────

// "activate" is handled by its own date-collection dialog, not here
type LoanDialogType = "close" | "default" | "cancel" | null;

const DIALOG_CONFIG: Record<
  NonNullable<LoanDialogType>,
  { title: string; description: string; confirmLabel: string; destructive?: boolean }
> = {
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

const SPLIT_METHOD_LABELS: Record<string, string> = {
  equal: "Equal (Flat Rate)",
  rule_of_78: "Rule of 78",
  reducing_balance: "Reducing Balance",
};

const INSTALLMENT_STATUS_TERMINAL = new Set(["paid", "waived"]);

// ── Edit Loan Dialog ───────────────────────────────────────────────────────────

const editLoanSchema = z.object({
  customer_id: z.string().nullable().optional(),
  loan_source: z.string().nullable().optional(),
  loan_type: z.enum(["vehicle_sale", "external_purchase"]),
  principal_amount: z.coerce.number().positive("Must be positive"),
  interest_rate: z.coerce.number().positive("Must be positive"),
  tenure_months: z.coerce.number().int().positive("Must be positive"),
  emi_amount: z.coerce.number().positive("Must be positive"),
  interest_split_method: z.enum(["equal", "rule_of_78", "reducing_balance"]),
  first_due_date: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
type EditLoanForm = z.infer<typeof editLoanSchema>;

function EditLoanDialog({ loan, onClose }: { loan: Loan; onClose: () => void }) {
  const queryClient = useQueryClient();
  const isActive = loan.status === "active";

  const [showEmiCalc, setShowEmiCalc] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Person | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerMatches, setCustomerMatches] = useState<Person[]>([]);

  const { data: customerSearchData } = useQuery({
    queryKey: ["persons-lookup", "phone", customerSearch],
    queryFn: () => listPersons({ phone: customerSearch, limit: 5 }),
    enabled: customerSearch.length >= 6,
    staleTime: 60_000,
  });

  useEffect(() => {
    const persons = customerSearchData?.data ?? [];
    if (persons.length > 0) setCustomerMatches((prev) => {
      const map = new Map([...prev, ...persons].map((p) => [p.id, p]));
      return Array.from(map.values());
    });
  }, [customerSearchData]);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<EditLoanForm>({
    resolver: zodResolver(editLoanSchema),
    defaultValues: {
      customer_id: loan.customer_id ?? null,
      loan_source: loan.loan_source ?? null,
      loan_type: loan.loan_type ?? "vehicle_sale",
      principal_amount: parseFloat(loan.principal_amount ?? "0"),
      interest_rate: parseFloat(loan.interest_rate ?? "0"),
      tenure_months: loan.tenure_months ?? 12,
      emi_amount: parseFloat(loan.emi_amount ?? "0"),
      interest_split_method: loan.interest_split_method ?? "rule_of_78",
      first_due_date: loan.first_due_date ?? null,
      notes: loan.notes ?? null,
    },
  });

  const mutation = useMutation({
    mutationFn: (data: EditLoanForm) =>
      updateLoan(loan.id!, {
        customer_id: data.customer_id ?? null,
        status: loan.status!,
        guarantor_id: loan.guarantor_id ?? null,
        loan_source: data.loan_source ?? null,
        loan_type: data.loan_type,
        principal_amount: String(Number(data.principal_amount).toFixed(2)),
        interest_rate: String(Number(data.interest_rate).toFixed(6)),
        tenure_months: data.tenure_months,
        emi_amount: String(Number(data.emi_amount).toFixed(2)),
        interest_split_method: data.interest_split_method,
        first_due_date: data.first_due_date ?? undefined,
        maturity_date: loan.maturity_date ?? undefined,
        notes: data.notes ?? undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans", loan.id] });
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      toast.success("Loan updated");
      onClose();
    },
    onError: (err: { response?: { status?: number; data?: { error?: { message?: string } } } }) => {
      if (err?.response?.status === 409) {
        toast.error(err.response?.data?.error?.message ?? "Cannot modify locked fields on an active loan.");
      } else {
        toast.error(err?.response?.data?.error?.message ?? "Failed to update loan.");
      }
    },
  });

  // Helper: locked field shows a lock badge in its label
  const LockedBadge = () => (
    <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1 py-0.5 rounded">
      <Lock className="h-2.5 w-2.5" /> Locked
    </span>
  );

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
      {isActive && (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
          This loan is <strong>active</strong>. Schedule-affecting fields are locked and cannot be changed.
        </div>
      )}

      {!isActive && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Recalculate EMI to update principal, rate, tenure and method.</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs shrink-0"
              onClick={() => setShowEmiCalc((v) => !v)}
            >
              {showEmiCalc ? "Hide Calculator" : "EMI Calculator"}
            </Button>
          </div>
          {showEmiCalc && (
            <EmiCalculator
              applyLabel="Apply to loan fields ↓"
              onApply={(result) => {
                const rate = result.implied_annual_rate ?? result.annual_interest_rate;
                if (result.principal_amount) setValue("principal_amount", Number(result.principal_amount));
                if (rate) setValue("interest_rate", Number(Number(rate).toFixed(6)));
                if (result.number_of_months) setValue("tenure_months", result.number_of_months);
                if (result.interest_split_method) setValue("interest_split_method", result.interest_split_method);
                if (result.emi) setValue("emi_amount", Number(result.emi));
                setShowEmiCalc(false);
              }}
              onClose={() => setShowEmiCalc(false)}
            />
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Customer — editable only on draft loans */}
        {!isActive && (
          <div className="space-y-2 col-span-2 pb-2 border-b">
            <Label className="font-semibold">Customer</Label>
            {selectedCustomer ? (
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-sm">{selectedCustomer.full_name}</p>
                  <p className="text-xs text-muted-foreground">{selectedCustomer.phone}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedCustomer(null);
                    setValue("customer_id", loan.customer_id ?? null);
                  }}
                >
                  Change
                </Button>
              </div>
            ) : watch("customer_id") ? (
              <div className="rounded-md border bg-muted/30 p-3 flex items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">Customer ID: <span className="font-mono text-xs">{watch("customer_id")}</span></p>
                <Button type="button" size="sm" variant="outline" onClick={() => setValue("customer_id", null)}>
                  Clear
                </Button>
              </div>
            ) : (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                No customer assigned. Search by phone to assign one.
              </div>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="Search by phone (6+ digits)…"
                className="h-8 text-sm"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
              />
            </div>
            <PersonMatchDialog
              open={customerMatches.length > 0}
              persons={customerMatches}
              onSelect={(p) => {
                setSelectedCustomer(p);
                setValue("customer_id", p.id!);
                setCustomerMatches([]);
                setCustomerSearch("");
              }}
              onDismiss={() => { setCustomerMatches([]); setCustomerSearch(""); }}
            />
          </div>
        )}

        {/* Always editable */}
        <div className="space-y-1 col-span-2">
          <Label>Loan Source</Label>
          <LookupSelectField
            listCode="loan_source"
            value={watch("loan_source") ?? null}
            onChange={(v) => setValue("loan_source", v)}
            placeholder="Select loan source…"
            allowNone
          />
        </div>

        <div className="space-y-1 col-span-2">
          <Label>Loan Type</Label>
          <Select
            value={watch("loan_type")}
            onValueChange={(v) => setValue("loan_type", v as EditLoanForm["loan_type"])}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="vehicle_sale">Vehicle Sale</SelectItem>
              <SelectItem value="external_purchase">External Purchase</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Locked when active */}
        <div className="space-y-1">
          <Label>
            Principal Amount (₹)
            {isActive && <LockedBadge />}
          </Label>
          <Input
            type="number"
            step="0.01"
            {...register("principal_amount")}
            disabled={isActive}
            className={isActive ? "bg-muted text-muted-foreground cursor-not-allowed" : ""}
          />
          {errors.principal_amount && <p className="text-xs text-destructive">{errors.principal_amount.message}</p>}
        </div>

        <div className="space-y-1">
          <Label>
            Interest Rate (% p.a.)
            {isActive && <LockedBadge />}
          </Label>
          <Input
            type="number"
            step="0.000001"
            {...register("interest_rate")}
            disabled={isActive}
            className={isActive ? "bg-muted text-muted-foreground cursor-not-allowed" : ""}
          />
          {errors.interest_rate && <p className="text-xs text-destructive">{errors.interest_rate.message}</p>}
        </div>

        <div className="space-y-1">
          <Label>
            Tenure (months)
            {isActive && <LockedBadge />}
          </Label>
          <Input
            type="number"
            {...register("tenure_months")}
            disabled={isActive}
            className={isActive ? "bg-muted text-muted-foreground cursor-not-allowed" : ""}
          />
          {errors.tenure_months && <p className="text-xs text-destructive">{errors.tenure_months.message}</p>}
        </div>

        <div className="space-y-1">
          <Label>
            EMI Amount (₹)
            {isActive && <LockedBadge />}
          </Label>
          <Input
            type="number"
            step="0.01"
            {...register("emi_amount")}
            disabled={isActive}
            className={isActive ? "bg-muted text-muted-foreground cursor-not-allowed" : ""}
          />
          {errors.emi_amount && <p className="text-xs text-destructive">{errors.emi_amount.message}</p>}
        </div>

        <div className="space-y-1 col-span-2">
          <Label>
            Amortization Method
            {isActive && <LockedBadge />}
          </Label>
          <Select
            value={watch("interest_split_method")}
            onValueChange={(v) => setValue("interest_split_method", v as EditLoanForm["interest_split_method"])}
            disabled={isActive}
          >
            <SelectTrigger className={isActive ? "bg-muted text-muted-foreground cursor-not-allowed" : ""}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="reducing_balance">Reducing Balance (Actuarial)</SelectItem>
              <SelectItem value="equal">Equal — Flat Rate</SelectItem>
              <SelectItem value="rule_of_78">Rule of 78 — Sum-of-Digits</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1 col-span-2">
          <Label>
            First Due Date
            {isActive && <LockedBadge />}
          </Label>
          <Input
            type="date"
            {...register("first_due_date")}
            disabled={isActive}
            className={isActive ? "bg-muted text-muted-foreground cursor-not-allowed" : ""}
          />
        </div>

        {/* Always editable */}
        <div className="space-y-1 col-span-2">
          <Label>Notes</Label>
          <Textarea {...register("notes")} rows={2} placeholder="Optional notes…" />
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save Changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ScheduleSummaryGrid({ summary }: { summary: ScheduleSummary }) {
  if (!summary) return null;
  return (
    <div className="rounded-lg border bg-muted/30 p-4 mb-5">
      <div className="grid grid-cols-3 gap-x-6 gap-y-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Total Principal</p>
          <p className="font-semibold"><CurrencyDisplay value={summary.total_principal ?? "0"} /></p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total Interest</p>
          <p className="font-semibold"><CurrencyDisplay value={summary.total_interest ?? "0"} /></p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total Payable</p>
          <p className="font-bold text-primary"><CurrencyDisplay value={summary.total_payable ?? "0"} /></p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Outstanding</p>
          <p className="font-semibold"><CurrencyDisplay value={summary.outstanding ?? "0"} /></p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Next Due</p>
          <p className="font-medium">
            {summary.next_due_date
              ? <DateDisplay value={summary.next_due_date} />
              : <span className="text-muted-foreground">—</span>}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Method</p>
          <p className="font-medium">{SPLIT_METHOD_LABELS[summary.interest_split_method ?? ""] ?? summary.interest_split_method ?? "—"}</p>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function LoanDetail() {
  const { id } = useParams<{ id: string }>();

  const queryClient = useQueryClient();
  const [loanDialog, setLoanDialog] = useState<LoanDialogType>(null);
  const [editOpen, setEditOpen] = useState(false);

  const { getLookupLabel } = useLookups();
  const canActivate = usePermission("activate_loan");
  const canClose = usePermission("close_loan");
  const canCancel = usePermission("cancel_loan");
  const canEdit = usePermission("edit_vehicle"); // admin + manager


  // ── Activate dialog state (collects first_due_date before PUT) ──────────────
  const [activateOpen, setActivateOpen] = useState(false);
  const [firstDueDate, setFirstDueDate] = useState(new Date().toISOString().split("T")[0]);

  // ── Pay installment dialog state ────────────────────────────────────────────
  const [payItem, setPayItem] = useState<ScheduleItem | null>(null);
  const [paidAmount, setPaidAmount] = useState("");
  const [paidDate, setPaidDate] = useState("");
  const [waiveItem, setWaiveItem] = useState<ScheduleItem | null>(null);

  // ── Queries ─────────────────────────────────────────────────────────────────

  const { data: loan, isLoading } = useQuery({
    queryKey: ["loans", id],
    queryFn: () => getLoan(id!),
    enabled: !!id,
  });

  const { data: customer } = useQuery({
    queryKey: ["persons", loan?.customer_id],
    queryFn: () => getPerson(loan!.customer_id!),
    enabled: !!loan?.customer_id,
  });

  const { data: guarantor } = useQuery({
    queryKey: ["persons", loan?.guarantor_id],
    queryFn: () => getPerson(loan!.guarantor_id!),
    enabled: !!loan?.guarantor_id,
  });

  const { data: vehicle } = useQuery({
    queryKey: ["vehicles", loan?.vehicle_id],
    queryFn: () => getVehicle(loan!.vehicle_id!),
    enabled: !!loan?.vehicle_id,
  });

  const { data: schedule, isLoading: scheduleLoading } = useQuery({
    queryKey: ["loan-schedule", id],
    queryFn: () => getLoanSchedule(id!),
    enabled: !!id && !!loan,
    // Refresh after lifecycle transitions
    staleTime: 30_000,
  });

  // ── Loan lifecycle mutation ─────────────────────────────────────────────────

  const loanMutation = useMutation({
    mutationFn: (action: "activate" | NonNullable<LoanDialogType>) => {
      if (!loan || !id) throw new Error("No loan");
      if (action === "activate") {
        // Match the same spread pattern used by close/cancel/default — the backend
        // ignores unknown fields (Go's json.Unmarshal default). We add
        // first_due_date (required for activation) and override status.
        return updateLoan(id, {
          ...loan,
          status: "active",
          first_due_date: firstDueDate,
        } as Parameters<typeof updateLoan>[1]);
      }
      if (action === "close") return closeLoan(id, loan);
      if (action === "default") return defaultLoan(id, loan);
      return cancelLoan(id, loan);
    },
    onSuccess: (_, action) => {
      queryClient.invalidateQueries({ queryKey: ["loans", id] });
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      queryClient.invalidateQueries({ queryKey: ["loan-schedule", id] });
      toast.success(
        action === "activate" ? "Loan activated — repayment schedule generated" :
        action === "close" ? "Loan closed" :
        action === "default" ? "Loan marked as defaulted" : "Loan cancelled"
      );
      setActivateOpen(false);
      setLoanDialog(null);
    },
    onError: (err: { response?: { status?: number; data?: { error?: { code?: string; message?: string } } } }) => {
      const apiErr = err?.response?.data?.error;
      const msg = apiErr?.message || apiErr?.code || `Action failed (HTTP ${err?.response?.status ?? "?"}). Please try again.`;
      toast.error(msg);
    },
  });

  // ── Installment mutation ────────────────────────────────────────────────────

  const installmentMutation = useMutation({
    mutationFn: ({ installmentId, data }: { installmentId: string; data: UpdateInstallmentRequest }) =>
      updateInstallment(id!, installmentId, data),
    onSuccess: (_, { data }) => {
      queryClient.invalidateQueries({ queryKey: ["loan-schedule", id] });
      queryClient.invalidateQueries({ queryKey: ["loans", id] });
      toast.success(data.status === "paid" ? "Payment recorded" : "Installment waived");
      setPayItem(null);
      setWaiveItem(null);
    },
    onError: (err: { response?: { status?: number } }) => {
      if (err?.response?.status === 409) {
        toast.error("Invalid status transition — installment may already be closed.");
      } else {
        toast.error("Failed to update installment.");
      }
    },
  });

  const openPayDialog = (item: ScheduleItem) => {
    setPayItem(item);
    setPaidAmount(item.emi ?? "");
    setPaidDate(new Date().toISOString().split("T")[0]);
  };

  const submitPayment = () => {
    if (!payItem?.id || !paidAmount || !paidDate) return;
    installmentMutation.mutate({
      installmentId: payItem.id,
      data: {
        status: "paid",
        paid_amount: paidAmount,
        paid_date: new Date(paidDate).toISOString(),
      },
    });
  };

  // ── Loading / not found ─────────────────────────────────────────────────────

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

  const installments = schedule?.installments ?? [];
  const isActive = loan.status === "active";


  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader title={`Loan ${loan.loan_number ?? "—"}`} />

      {/* Status action bar */}
      <div className="flex items-center gap-3 flex-wrap p-4 rounded-lg border bg-white">
        <StatusBadge status={loan.status} />
        {loan.status === "draft" && canActivate && (
          <Button size="sm" onClick={() => setActivateOpen(true)}>Activate Loan</Button>
        )}
        {loan.status === "active" && canClose && (
          <>
            <Button size="sm" variant="outline" onClick={() => setLoanDialog("close")}>Close Loan</Button>
            <Button size="sm" variant="destructive" onClick={() => setLoanDialog("default")}>Mark as Defaulted</Button>
          </>
        )}
        {loan.status === "draft" && canCancel && (
          <Button size="sm" variant="outline" onClick={() => setLoanDialog("cancel")}>Cancel Loan</Button>
        )}
        {/* Edit button — available for draft and active loans */}
        {(loan.status === "draft" || loan.status === "active") && canEdit && (
          <Button size="sm" variant="outline" className="ml-auto gap-1.5" onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5" />
            Edit Loan
          </Button>
        )}

      </div>

      {/* Loan summary */}
      <Card>
        <CardHeader><CardTitle>Loan Summary</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {loan.loan_source && <div><dt className="text-muted-foreground">Loan Source</dt><dd>{getLookupLabel("loan_source", loan.loan_source) || loan.loan_source}</dd></div>}
            <div><dt className="text-muted-foreground">Amortization</dt><dd>{SPLIT_METHOD_LABELS[loan.interest_split_method ?? ""] ?? "—"}</dd></div>
            <div><dt className="text-muted-foreground">Principal</dt><dd className="font-semibold"><CurrencyDisplay value={loan.principal_amount} /></dd></div>
            <div><dt className="text-muted-foreground">Interest Rate</dt><dd>{loan.interest_rate}% p.a.</dd></div>
            <div><dt className="text-muted-foreground">Tenure</dt><dd>{loan.tenure_months} months</dd></div>
            <div><dt className="text-muted-foreground">EMI</dt><dd className="font-semibold"><CurrencyDisplay value={emi} /></dd></div>
            <div><dt className="text-muted-foreground">Total Payable</dt><dd><CurrencyDisplay value={totalPayable} /></dd></div>
            <div><dt className="text-muted-foreground">Total Interest</dt><dd><CurrencyDisplay value={totalInterest} /></dd></div>
            <div><dt className="text-muted-foreground">First Due Date</dt><dd><DateDisplay value={loan.first_due_date} /></dd></div>
            <div><dt className="text-muted-foreground">Maturity Date</dt><dd><DateDisplay value={loan.maturity_date} /></dd></div>
            {loan.loan_date && <div><dt className="text-muted-foreground">Loan Date</dt><dd><DateDisplay value={loan.loan_date} /></dd></div>}
            {loan.commission && <div><dt className="text-muted-foreground">Commission</dt><dd><CurrencyDisplay value={loan.commission} /></dd></div>}
            {loan.document_charge && <div><dt className="text-muted-foreground">Document Charge</dt><dd><CurrencyDisplay value={loan.document_charge} /></dd></div>}
            {loan.notes && <div className="col-span-2"><dt className="text-muted-foreground">Notes</dt><dd>{loan.notes}</dd></div>}
          </dl>
        </CardContent>
      </Card>

      {/* No-customer warning for draft loans */}
      {loan.status === "draft" && !loan.customer_id && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-center justify-between gap-4">
          <span>No customer assigned. Assign a customer before activating this loan.</span>
          {canEdit && (
            <Button size="sm" variant="outline" className="shrink-0" onClick={() => setEditOpen(true)}>
              Assign Customer
            </Button>
          )}
        </div>
      )}

      {/* Linked persons */}
      {(customer || guarantor) && (
        <Card>
          <CardHeader><CardTitle>Persons</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {customer && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Borrower</p>
                  <p className="font-medium">{customer.full_name}</p>
                  <p className="text-sm text-muted-foreground">{customer.phone}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={customer.kyc_status ?? "pending"} />
                  <Link to={`/persons/${customer.id}`}>
                    <Button size="sm" variant="outline">View</Button>
                  </Link>
                </div>
              </div>
            )}
            {customer && guarantor && <div className="border-t" />}
            {guarantor && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Guarantor</p>
                  <p className="font-medium">{guarantor.full_name}</p>
                  <p className="text-sm text-muted-foreground">{guarantor.phone}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={guarantor.kyc_status ?? "pending"} />
                  <Link to={`/persons/${guarantor.id}`}>
                    <Button size="sm" variant="outline">View</Button>
                  </Link>
                </div>
              </div>
            )}
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
                <Link to={`/vehicles/${vehicle.id}`}>
                  <Button size="sm" variant="outline">View</Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Repayment Schedule ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Repayment Schedule</CardTitle>
          {schedule?.summary && (
            <span className="text-xs text-muted-foreground">
              {schedule.summary.no_of_dues} installments
            </span>
          )}
        </CardHeader>
        <CardContent>
          {scheduleLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <>
              {/* Summary totals */}
              {schedule?.summary && <ScheduleSummaryGrid summary={schedule.summary} />}

              {/* Draft — no schedule yet */}
              {loan.status === "draft" && (
                <p className="text-sm text-muted-foreground">
                  Activate the loan to generate the full repayment schedule. The totals above are projected values based on the configured terms.
                </p>
              )}

              {/* Cancelled / closed without installments */}
              {(loan.status === "cancelled" || loan.status === "closed") && installments.length === 0 && (
                <p className="text-sm text-muted-foreground">No repayment schedule available.</p>
              )}

              {/* Installment table */}
              {installments.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="px-2 py-2 text-left font-medium text-muted-foreground">#</th>
                        <th className="px-2 py-2 text-left font-medium text-muted-foreground">Due Date</th>
                        <th className="px-2 py-2 text-right font-medium text-muted-foreground">EMI</th>
                        <th className="px-2 py-2 text-right font-medium text-muted-foreground">Principal</th>
                        <th className="px-2 py-2 text-right font-medium text-muted-foreground">Interest</th>
                        <th className="px-2 py-2 text-right font-medium text-muted-foreground">Balance</th>
                        <th className="px-2 py-2 text-center font-medium text-muted-foreground">Status</th>
                        {isActive && <th className="px-2 py-2 text-right font-medium text-muted-foreground">Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {installments.map((item) => {
                        const isTerminal = INSTALLMENT_STATUS_TERMINAL.has(item.status ?? "");
                        const canAct = isActive && !isTerminal;
                        return (
                          <tr key={item.id} className="border-b hover:bg-muted/20 transition-colors">
                            <td className="px-2 py-2 text-muted-foreground font-mono">{item.seq}</td>
                            <td className="px-2 py-2">
                              <DateDisplay value={item.due_date} />
                            </td>
                            <td className="px-2 py-2 text-right font-medium">
                              <CurrencyDisplay value={item.emi ?? "0"} />
                            </td>
                            <td className="px-2 py-2 text-right text-muted-foreground">
                              <CurrencyDisplay value={item.principal ?? "0"} />
                            </td>
                            <td className="px-2 py-2 text-right text-muted-foreground">
                              <CurrencyDisplay value={item.interest ?? "0"} />
                            </td>
                            <td className="px-2 py-2 text-right text-muted-foreground">
                              <CurrencyDisplay value={item.balance ?? "0"} />
                            </td>
                            <td className="px-2 py-2 text-center">
                              <StatusBadge status={item.status ?? "pending"} />
                              {item.paid_date && (
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  <DateDisplay value={item.paid_date} />
                                </p>
                              )}
                            </td>
                            {isActive && (
                              <td className="px-2 py-2 text-right">
                                {canAct && (
                                  <div className="flex justify-end gap-1">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 px-2 text-xs"
                                      onClick={() => openPayDialog(item)}
                                    >
                                      Pay
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 px-2 text-xs text-muted-foreground"
                                      onClick={() => setWaiveItem(item)}
                                    >
                                      Waive
                                    </Button>
                                  </div>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Activate loan dialog (collects first due date) ─────────────────── */}
      <Dialog open={activateOpen} onOpenChange={(o) => !o && setActivateOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activate Loan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Activating will generate the full repayment schedule and mark the vehicle as <strong>Loan Active</strong>.
              This cannot be undone.
            </p>
            <div className="space-y-1">
              <Label>First Due Date *</Label>
              <Input
                type="date"
                value={firstDueDate}
                onChange={(e) => setFirstDueDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Due date of the first installment; anchors all installment due dates.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => loanMutation.mutate("activate")}
              disabled={!firstDueDate || loanMutation.isPending}
            >
              {loanMutation.isPending ? "Activating…" : "Activate Loan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Mark as Paid dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!payItem} onOpenChange={(o) => !o && setPayItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment — Installment #{payItem?.seq}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Amount Paid (₹) *</Label>
              <Input
                type="number"
                step="0.01"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                placeholder={payItem?.emi ?? "0.00"}
              />
              <p className="text-xs text-muted-foreground">
                EMI due: <CurrencyDisplay value={payItem?.emi ?? "0"} />
              </p>
            </div>
            <div className="space-y-1">
              <Label>Payment Date *</Label>
              <Input
                type="date"
                value={paidDate}
                onChange={(e) => setPaidDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayItem(null)}>Cancel</Button>
            <Button
              onClick={submitPayment}
              disabled={!paidAmount || !paidDate || installmentMutation.isPending}
            >
              {installmentMutation.isPending ? "Saving…" : "Confirm Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Waive confirm dialog ────────────────────────────────────────────── */}
      {waiveItem && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setWaiveItem(null)}
          title={`Waive Installment #${waiveItem.seq}`}
          description={`This will waive the installment of ${waiveItem.emi ? `₹${parseFloat(waiveItem.emi).toLocaleString("en-IN")}` : "this amount"} due on ${waiveItem.due_date ? new Date(waiveItem.due_date).toLocaleDateString("en-IN") : "—"}. Are you sure?`}
          confirmLabel="Waive Installment"
          destructive
          onConfirm={() =>
            installmentMutation.mutate({
              installmentId: waiveItem.id!,
              data: { status: "waived" },
            })
          }
          loading={installmentMutation.isPending}
        />
      )}

      {/* ── Loan lifecycle dialogs ──────────────────────────────────────────── */}
      {loanDialog && DIALOG_CONFIG[loanDialog] && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setLoanDialog(null)}
          title={DIALOG_CONFIG[loanDialog].title}
          description={DIALOG_CONFIG[loanDialog].description}
          confirmLabel={DIALOG_CONFIG[loanDialog].confirmLabel}
          destructive={DIALOG_CONFIG[loanDialog].destructive}
          onConfirm={() => loanMutation.mutate(loanDialog)}
          loading={loanMutation.isPending}
        />
      )}

      {/* ── Edit Loan dialog ────────────────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={(o) => !o && setEditOpen(false)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Edit Loan — {loan.loan_number}
              {loan.status === "active" && (
                <span className="ml-2 text-xs font-normal text-amber-600">(some fields locked)</span>
              )}
            </DialogTitle>
          </DialogHeader>
          <EditLoanDialog key={loan.updated_at} loan={loan} onClose={() => setEditOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
