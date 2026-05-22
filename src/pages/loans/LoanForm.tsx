import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { createLoan } from "@/api/loans";
import { listCustomers } from "@/api/customers";
import { listVehicles } from "@/api/vehicles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { PageHeader } from "@/components/shared/PageHeader";
import { useDebounce } from "@/hooks/useDebounce";
import { calculateEMI, calculateTotalPayable, calculateTotalInterest } from "@/utils/emi";
import { formatINR } from "@/utils/currency";
import type { Customer, Vehicle } from "@/types/api";

// ── Step schemas ──────────────────────────────────────────────────────────────
const step1Schema = z.object({
  customer_id: z.string().min(1, "Select a customer"),
  vehicle_id: z.string().min(1, "Select a vehicle"),
});

const step2Schema = z.object({
  loan_type: z.enum(["vehicle_sale", "external_purchase"]),
  principal_amount: z.coerce.number().positive("Must be positive"),
  interest_rate: z.coerce.number().positive("Must be positive"),
  tenure_months: z.coerce.number().int().positive("Must be positive"),
  notes: z.string().optional(),
});

type Step1Values = z.infer<typeof step1Schema>;
type Step2Values = z.infer<typeof step2Schema>;

// ── Sub-components ────────────────────────────────────────────────────────────
function CustomerSearch({
  value,
  onSelect,
  error,
}: {
  value: string;
  onSelect: (c: Customer) => void;
  error?: string;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);
  const debouncedQ = useDebounce(query);

  const { data } = useQuery({
    queryKey: ["customers", "search", debouncedQ],
    queryFn: () => listCustomers({ phone: debouncedQ || undefined, limit: 10 }),
    enabled: debouncedQ.length > 0,
  });

  if (selected && selected.id === value) {
    return (
      <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
        <span>{selected.full_name} · {selected.phone}</span>
        <Button size="sm" variant="ghost" onClick={() => { setSelected(null); onSelect({ id: "" } as Customer); }}>
          Change
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1 relative">
      <Input
        placeholder="Search by phone or name…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {(data?.data ?? []).length > 0 && (
        <div className="absolute z-10 w-full rounded-md border bg-white shadow-md max-h-48 overflow-y-auto">
          {(data?.data ?? []).map((c) => (
            <button
              key={c.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
              onClick={() => { setSelected(c); onSelect(c); setQuery(""); }}
            >
              {c.full_name} · {c.phone}
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function VehicleSearch({
  value,
  onSelect,
  error,
}: {
  value: string;
  onSelect: (v: Vehicle) => void;
  error?: string;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const debouncedQ = useDebounce(query);

  const { data } = useQuery({
    queryKey: ["vehicles", "search", debouncedQ],
    queryFn: () => listVehicles({ registration_no: debouncedQ || undefined, current_status: "available", limit: 10 }),
    enabled: debouncedQ.length > 0,
  });

  if (selected && selected.id === value) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
          <span className="font-mono">{selected.registration_no}</span>
          <span className="text-muted-foreground">{selected.make} {selected.model}</span>
          <Button size="sm" variant="ghost" onClick={() => { setSelected(null); onSelect({ id: "" } as Vehicle); }}>Change</Button>
        </div>
        {selected.vehicle_source === "external_collateral" && (
          <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700">
            This is an external collateral vehicle. No ownership transfer will be recorded.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1 relative">
      <Input
        placeholder="Search by registration number…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {(data?.data ?? []).length > 0 && (
        <div className="absolute z-10 w-full rounded-md border bg-white shadow-md max-h-48 overflow-y-auto">
          {(data?.data ?? []).map((v) => (
            <button
              key={v.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex justify-between"
              onClick={() => { setSelected(v); onSelect(v); setQuery(""); }}
            >
              <span className="font-mono">{v.registration_no}</span>
              <span className="text-muted-foreground">{v.make} {v.model} · <StatusBadge status={v.current_status ?? "available"} /></span>
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────
export default function LoanForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [step1Data, setStep1Data] = useState<Step1Values & { customer?: Customer; vehicle?: Vehicle }>({
    customer_id: "",
    vehicle_id: "",
  });

  const step1Form = useForm<Step1Values>({ resolver: zodResolver(step1Schema) });
  const step2Form = useForm<Step2Values>({
    resolver: zodResolver(step2Schema),
    defaultValues: { loan_type: "vehicle_sale", tenure_months: 12, interest_rate: 12 },
  });

  const { watch: watchStep2, setValue: setStep2Value } = step2Form;
  const principal = watchStep2("principal_amount") ?? 0;
  const rate = watchStep2("interest_rate") ?? 0;
  const tenure = watchStep2("tenure_months") ?? 0;
  const emi = calculateEMI(Number(principal), Number(rate), Number(tenure));

  const mutation = useMutation({
    mutationFn: (s2: Step2Values) =>
      createLoan({
        customer_id: step1Data.customer_id,
        vehicle_id: step1Data.vehicle_id,
        loan_type: s2.loan_type,
        principal_amount: String(s2.principal_amount),
        interest_rate: String(s2.interest_rate),
        tenure_months: s2.tenure_months,
        emi_amount: String(emi),
        notes: s2.notes,
      }),
    onSuccess: (loan) => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      toast.success("Loan created (draft)");
      navigate(`/loans/${loan.id}`);
    },
    onError: () => toast.error("Failed to create loan."),
  });

  const handleStep1Submit = (data: Step1Values) => {
    setStep1Data((prev) => ({ ...prev, ...data }));
    // Auto-set loan type from vehicle source
    const source = step1Data.vehicle?.vehicle_source;
    if (source === "external_collateral") setStep2Value("loan_type", "external_purchase");
    else setStep2Value("loan_type", "vehicle_sale");
    setStep(2);
  };

  const s2 = step2Form.watch();
  const reviewEmi = calculateEMI(Number(s2.principal_amount), Number(s2.interest_rate), Number(s2.tenure_months));
  const reviewTotal = calculateTotalPayable(reviewEmi, Number(s2.tenure_months));
  const reviewInterest = calculateTotalInterest(Number(s2.principal_amount), reviewEmi, Number(s2.tenure_months));

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Create Loan" />

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex items-center gap-2">
            <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold ${step >= n ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>{n}</div>
            {n < 3 && <div className={`h-px w-8 ${step > n ? "bg-primary" : "bg-muted"}`} />}
          </div>
        ))}
        <span className="ml-2 text-muted-foreground">{["Select Customer & Vehicle", "Loan Details", "Review & Submit"][step - 1]}</span>
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <Card>
          <CardHeader><CardTitle>Step 1 — Select Customer & Vehicle</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={step1Form.handleSubmit(handleStep1Submit)} className="space-y-4">
              <div className="space-y-1">
                <Label>Customer *</Label>
                <CustomerSearch
                  value={step1Form.watch("customer_id")}
                  onSelect={(c) => {
                    step1Form.setValue("customer_id", c.id ?? "");
                    setStep1Data((p) => ({ ...p, customer: c }));
                  }}
                  error={step1Form.formState.errors.customer_id?.message}
                />
              </div>
              <div className="space-y-1">
                <Label>Vehicle *</Label>
                <VehicleSearch
                  value={step1Form.watch("vehicle_id")}
                  onSelect={(v) => {
                    step1Form.setValue("vehicle_id", v.id ?? "");
                    setStep1Data((p) => ({ ...p, vehicle: v }));
                  }}
                  error={step1Form.formState.errors.vehicle_id?.message}
                />
              </div>
              <Button type="submit">Next →</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <Card>
          <CardHeader><CardTitle>Step 2 — Loan Details</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={step2Form.handleSubmit(() => setStep(3))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1">
                  <Label>Loan Type</Label>
                  <Select value={s2.loan_type} onValueChange={(v) => setStep2Value("loan_type", v as "vehicle_sale" | "external_purchase")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vehicle_sale">Vehicle Sale</SelectItem>
                      <SelectItem value="external_purchase">External Purchase</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Principal Amount (₹) *</Label>
                  <Input type="number" {...step2Form.register("principal_amount")} />
                  {step2Form.formState.errors.principal_amount && <p className="text-xs text-destructive">{step2Form.formState.errors.principal_amount.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Interest Rate (% p.a.) *</Label>
                  <Input type="number" step="0.01" {...step2Form.register("interest_rate")} />
                  {step2Form.formState.errors.interest_rate && <p className="text-xs text-destructive">{step2Form.formState.errors.interest_rate.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Tenure (months) *</Label>
                  <Input type="number" {...step2Form.register("tenure_months")} />
                  {step2Form.formState.errors.tenure_months && <p className="text-xs text-destructive">{step2Form.formState.errors.tenure_months.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Notes</Label>
                  <Textarea {...step2Form.register("notes")} rows={2} />
                </div>
              </div>

              {emi > 0 && (
                <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 text-sm">
                  <span className="text-muted-foreground">Estimated EMI: </span>
                  <span className="text-lg font-bold text-primary">{formatINR(emi)}/month</span>
                </div>
              )}

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setStep(1)}>← Back</Button>
                <Button type="submit">Next →</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Step 3 — Review */}
      {step === 3 && (
        <Card>
          <CardHeader><CardTitle>Step 3 — Review & Submit</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div><dt className="text-muted-foreground">Customer</dt><dd className="font-medium">{step1Data.customer?.full_name} · {step1Data.customer?.phone}</dd></div>
              <div><dt className="text-muted-foreground">Vehicle</dt><dd className="font-mono text-xs">{step1Data.vehicle?.registration_no} — {step1Data.vehicle?.make} {step1Data.vehicle?.model}</dd></div>
              <div><dt className="text-muted-foreground">Loan Type</dt><dd><StatusBadge status={s2.loan_type} /></dd></div>
              <div><dt className="text-muted-foreground">Principal</dt><dd className="font-semibold"><CurrencyDisplay value={s2.principal_amount} /></dd></div>
              <div><dt className="text-muted-foreground">Interest Rate</dt><dd>{s2.interest_rate}% p.a.</dd></div>
              <div><dt className="text-muted-foreground">Tenure</dt><dd>{s2.tenure_months} months</dd></div>
              <div><dt className="text-muted-foreground">EMI</dt><dd className="font-semibold"><CurrencyDisplay value={reviewEmi} /></dd></div>
              <div><dt className="text-muted-foreground">Total Payable</dt><dd><CurrencyDisplay value={reviewTotal} /></dd></div>
              <div><dt className="text-muted-foreground">Total Interest</dt><dd><CurrencyDisplay value={reviewInterest} /></dd></div>
              {s2.notes && <div className="col-span-2"><dt className="text-muted-foreground">Notes</dt><dd>{s2.notes}</dd></div>}
            </dl>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setStep(2)}>← Back</Button>
              <Button
                onClick={() => step2Form.handleSubmit((d) => mutation.mutate(d))()}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? "Creating…" : "Create Loan (Draft)"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
