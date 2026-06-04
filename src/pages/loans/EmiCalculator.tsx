import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Calculator, ArrowRight, Info } from "lucide-react";
import { calculateEmi } from "@/api/loans";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/PageHeader";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import type { EMICalculateRequest, EMICalculateResponse, InterestSplitMethod } from "@/types/api";

const SPLIT_METHOD_LABELS: Record<InterestSplitMethod, string> = {
  reducing_balance: "Reducing Balance",
  equal: "Equal (Flat Rate)",
  rule_of_78: "Rule of 78",
};

const schema = z.object({
  vehicle_value: z.coerce
    .number({ invalid_type_error: "Required" })
    .positive("Must be a positive amount"),
  document_charge_pct: z.coerce
    .number({ invalid_type_error: "Required" })
    .min(0, "Cannot be negative"),
  monthly_interest_rate: z.coerce
    .number({ invalid_type_error: "Required" })
    .positive("Must be a positive rate"),
  number_of_months: z.coerce
    .number({ invalid_type_error: "Required" })
    .int()
    .min(1, "Minimum 1 month"),
  interest_split_method: z.enum(["equal", "rule_of_78", "reducing_balance"]).optional(),
  first_due_date: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function buildRequest(values: FormValues, desiredEmi?: string): EMICalculateRequest {
  return {
    vehicle_value: String(Number(values.vehicle_value).toFixed(2)),
    document_charge_pct: String(Number(values.document_charge_pct).toFixed(2)),
    monthly_interest_rate: String(Number(values.monthly_interest_rate).toFixed(4)),
    number_of_months: values.number_of_months,
    interest_split_method: values.interest_split_method,
    first_due_date: values.first_due_date || null,
    ...(desiredEmi ? { desired_emi: desiredEmi } : {}),
  };
}

export default function EmiCalculator() {
  const navigate = useNavigate();

  // Step 1 = form only, Step 2 = initial result shown, Step 3 = desired EMI applied
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [result, setResult] = useState<EMICalculateResponse | null>(null);
  const [desiredEmi, setDesiredEmi] = useState("");
  // track last submitted form values so we can re-submit with desired_emi
  const [lastFormValues, setLastFormValues] = useState<FormValues | null>(null);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { interest_split_method: "rule_of_78" },
  });

  // Step 2 — initial calculation (no desired_emi)
  const calcMutation = useMutation({
    mutationFn: (values: FormValues) => calculateEmi(buildRequest(values)),
    onSuccess: (data, values) => {
      setResult(data);
      setDesiredEmi(data.emi ?? "");
      setLastFormValues(values);
      setStep(2);
    },
  });

  // Step 3 — recalculate with desired_emi
  const recalcMutation = useMutation({
    mutationFn: () => {
      if (!lastFormValues) throw new Error("No form values");
      return calculateEmi(buildRequest(lastFormValues, desiredEmi));
    },
    onSuccess: (data) => {
      setResult(data);
      setStep(3);
    },
  });

  // When form inputs change after a result is shown, reset back to step 1 state
  const watchedValues = watch();
  useEffect(() => {
    if (step !== 1) {
      setStep(1);
      setResult(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    watchedValues.vehicle_value,
    watchedValues.document_charge_pct,
    watchedValues.monthly_interest_rate,
    watchedValues.number_of_months,
    watchedValues.interest_split_method,
  ]);

  // Effective interest rate to use when creating a loan
  const effectiveAnnualRate = result?.implied_annual_rate ?? result?.annual_interest_rate;

  const handleCreateLoan = () => {
    if (!result) return;
    const params = new URLSearchParams({
      principal_amount: result.principal_amount ?? "",
      interest_rate: effectiveAnnualRate ?? "",
      tenure_months: String(result.number_of_months ?? ""),
      emi_amount: result.emi ?? "",
      interest_split_method: result.interest_split_method ?? "reducing_balance",
    });
    navigate(`/loans/new?${params.toString()}`);
  };

  const isDesiredEmiChanged = result && desiredEmi && desiredEmi !== result.emi;

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="EMI Calculator" />

      {/* ── Step 1: Input form ── */}
      <Card>
        <CardHeader>
          <CardTitle>Loan Parameters</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit((v) => calcMutation.mutate(v))}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Vehicle Loan (₹) *</Label>
                <Input {...register("vehicle_value")} type="number" step="0.01" placeholder="e.g. 36000" />
                {errors.vehicle_value && <p className="text-xs text-destructive">{errors.vehicle_value.message}</p>}
                <p className="text-xs text-muted-foreground">On-road / agreed vehicle price</p>
              </div>

              <div className="space-y-1">
                <Label>Documentation Charge (%) *</Label>
                <Input {...register("document_charge_pct")} type="number" step="0.01" placeholder="e.g. 5 — enter 0 if none" />
                {errors.document_charge_pct && <p className="text-xs text-destructive">{errors.document_charge_pct.message}</p>}
                <p className="text-xs text-muted-foreground">% of vehicle value added to principal</p>
              </div>

              <div className="space-y-1">
                <Label>Monthly Interest Rate (%) *</Label>
                <Input {...register("monthly_interest_rate")} type="number" step="0.01" placeholder="e.g. 2" />
                {errors.monthly_interest_rate && <p className="text-xs text-destructive">{errors.monthly_interest_rate.message}</p>}
                <p className="text-xs text-muted-foreground">
                  {watchedValues.monthly_interest_rate
                    ? `= ${(Number(watchedValues.monthly_interest_rate) * 12).toFixed(2)}% per annum`
                    : "Multiplied by 12 for annual rate"}
                </p>
              </div>

              <div className="space-y-1">
                <Label>Tenure (months) *</Label>
                <Input {...register("number_of_months")} type="number" min={1} placeholder="e.g. 20" />
                {errors.number_of_months && <p className="text-xs text-destructive">{errors.number_of_months.message}</p>}
              </div>

              <div className="space-y-1">
                <Label>Amortization Method</Label>
                <Select
                  value={watchedValues.interest_split_method}
                  onValueChange={(v) => setValue("interest_split_method", v as InterestSplitMethod)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(SPLIT_METHOD_LABELS) as [InterestSplitMethod, string][]).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>First Due Date</Label>
                <Input type="date" {...register("first_due_date")} />
                <p className="text-xs text-muted-foreground">Optional — defaults to today + 1 month</p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={calcMutation.isPending} className="gap-2">
                <Calculator className="h-4 w-4" />
                {calcMutation.isPending ? "Calculating…" : "Calculate EMI"}
              </Button>
              {calcMutation.isError && (
                <p className="text-sm text-destructive">Calculation failed. Please check your inputs.</p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ── Steps 2 & 3: Result ── */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Repayment Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Computed EMI highlight */}
            <div className="rounded-lg bg-primary/5 border border-primary/20 px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Monthly EMI</p>
                <p className="text-3xl font-bold text-primary">
                  <CurrencyDisplay value={result.emi ?? "0"} />
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">for</p>
                <p className="text-xl font-semibold">{result.number_of_months} months</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {SPLIT_METHOD_LABELS[result.interest_split_method ?? "reducing_balance"]}
                </p>
              </div>
            </div>

            {/* Breakdown */}
            <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Vehicle Value</dt>
                <dd className="font-medium"><CurrencyDisplay value={result.vehicle_value ?? "0"} /></dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Documentation Charge</dt>
                <dd className="font-medium"><CurrencyDisplay value={result.document_charge ?? "0"} /></dd>
              </div>
              <div className="flex justify-between font-semibold border-t pt-2">
                <dt>Loan Principal</dt>
                <dd><CurrencyDisplay value={result.principal_amount ?? "0"} /></dd>
              </div>
              <div className="flex justify-between border-t pt-2">
                <dt className="text-muted-foreground">Annual Interest Rate</dt>
                <dd className="font-medium">{result.annual_interest_rate}% p.a.</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total Interest</dt>
                <dd className="font-medium"><CurrencyDisplay value={result.total_interest ?? "0"} /></dd>
              </div>
              <div className="flex justify-between font-bold text-base border-t pt-2">
                <dt>Total Payable</dt>
                <dd className="text-primary"><CurrencyDisplay value={result.total_payable ?? "0"} /></dd>
              </div>
            </dl>

            {/* ── Step 3: Desired EMI adjustment ── */}
            <div className="border-t pt-4 space-y-3">
              <div>
                <p className="text-sm font-medium">Adjust to a Round EMI</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Enter a rounded EMI amount to back-calculate the implied interest rate. This keeps
                  the borrower's monthly payment clean while the loan is created with the exact matching rate.
                </p>
              </div>
              <div className="flex items-end gap-3">
                <div className="flex-1 space-y-1">
                  <Label>Desired EMI (₹)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={desiredEmi}
                    onChange={(e) => setDesiredEmi(e.target.value)}
                    placeholder="e.g. 2500"
                  />
                </div>
                <Button
                  onClick={() => recalcMutation.mutate()}
                  disabled={recalcMutation.isPending || !desiredEmi || !isDesiredEmiChanged}
                  variant="outline"
                  className="gap-1.5"
                >
                  {recalcMutation.isPending ? "Recalculating…" : "Apply"}
                </Button>
              </div>
              {recalcMutation.isError && (
                <p className="text-xs text-destructive">Recalculation failed. Check the desired EMI value.</p>
              )}

              {/* Implied rates — only shown after desired EMI was applied */}
              {step === 3 && result.implied_annual_rate && (
                <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 space-y-1.5 text-sm">
                  <div className="flex items-center gap-1.5 font-medium text-amber-800">
                    <Info className="h-4 w-4 shrink-0" />
                    Implied Interest Rate
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-amber-900">
                    <div className="flex justify-between">
                      <span className="text-amber-700">Monthly rate</span>
                      <span className="font-semibold">{Number(result.implied_monthly_rate).toFixed(4)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-amber-700">Annual rate</span>
                      <span className="font-semibold">{Number(result.implied_annual_rate).toFixed(4)}% p.a.</span>
                    </div>
                  </div>
                  <p className="text-xs text-amber-700 pt-0.5">
                    This rate will be used when creating the loan to ensure the borrower pays exactly{" "}
                    <strong><CurrencyDisplay value={result.emi ?? "0"} /></strong> per month.
                  </p>
                </div>
              )}
            </div>

            {/* ── Step 4: Proceed to create loan ── */}
            <div className="border-t pt-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Ready to proceed?</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Loan form will be pre-filled with these details.
                  {step === 3 && result.implied_annual_rate
                    ? ` Using implied rate ${Number(result.implied_annual_rate).toFixed(4)}% p.a.`
                    : ` Using rate ${result.annual_interest_rate}% p.a.`}
                </p>
              </div>
              <Button onClick={handleCreateLoan} className="gap-2 shrink-0">
                Create Loan
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

          </CardContent>
        </Card>
      )}
    </div>
  );
}
