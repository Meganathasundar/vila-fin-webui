import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getLoan, updateLoan, closeLoan, defaultLoan, cancelLoan,
  getLoanSchedule, updateInstallment,
} from "@/api/loans";
import { getPerson } from "@/api/persons";
import { getVehicle } from "@/api/vehicles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { DateDisplay } from "@/components/shared/DateDisplay";
import { PageHeader } from "@/components/shared/PageHeader";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { usePermission } from "@/hooks/usePermission";
import { calculateEMI, calculateTotalPayable, calculateTotalInterest } from "@/utils/emi";
import type { ScheduleItem, UpdateInstallmentRequest } from "@/types/api";

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

// ── Sub-components ─────────────────────────────────────────────────────────────

function ScheduleSummaryGrid({ summary }: { summary: NonNullable<ReturnType<typeof getLoanSchedule> extends Promise<infer R> ? R["summary"] : never> }) {
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
  const canActivate = usePermission("activate_loan");
  const canClose = usePermission("close_loan");
  const canCancel = usePermission("cancel_loan");

  // ── Activate dialog state (collects disbursement_date before PUT) ───────────
  const [activateOpen, setActivateOpen] = useState(false);
  const [disbursementDate, setDisbursementDate] = useState(new Date().toISOString().split("T")[0]);

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
        // disbursement_date (required for activation) and override status.
        return updateLoan(id, {
          ...loan,
          status: "active",
          disbursement_date: disbursementDate,
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
      </div>

      {/* Loan summary */}
      <Card>
        <CardHeader><CardTitle>Loan Summary</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div><dt className="text-muted-foreground">Loan Type</dt><dd><StatusBadge status={loan.loan_type} /></dd></div>
            <div><dt className="text-muted-foreground">Amortization</dt><dd>{SPLIT_METHOD_LABELS[loan.interest_split_method ?? ""] ?? "—"}</dd></div>
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
                <StatusBadge status={vehicle.vehicle_source ?? "lender_stock"} />
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

      {/* ── Activate loan dialog (collects disbursement date) ──────────────── */}
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
              <Label>Disbursement Date *</Label>
              <Input
                type="date"
                value={disbursementDate}
                onChange={(e) => setDisbursementDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Date the loan amount was disbursed to the borrower.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => loanMutation.mutate("activate")}
              disabled={!disbursementDate || loanMutation.isPending}
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
    </div>
  );
}
