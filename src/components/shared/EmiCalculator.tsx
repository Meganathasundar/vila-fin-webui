import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { calculateEmi } from "@/api/loans";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import type { EMICalculateResponse, InterestSplitMethod } from "@/types/api";

const SPLIT_LABELS: Record<InterestSplitMethod, string> = {
  reducing_balance: "Reducing Balance",
  equal: "Equal (Flat Rate)",
  rule_of_78: "Rule of 78",
};

const emiCalcSchema = z.object({
  vehicle_value: z.coerce.number({ invalid_type_error: "Required" }).positive("Required"),
  document_charge_pct: z.coerce.number({ invalid_type_error: "Required" }).min(0, "Cannot be negative"),
  monthly_interest_rate: z.coerce.number({ invalid_type_error: "Required" }).positive("Required"),
  number_of_months: z.coerce.number({ invalid_type_error: "Required" }).int().min(1, "Min 1"),
  interest_split_method: z.enum(["equal", "rule_of_78", "reducing_balance"]).optional(),
});

export type EmiCalcValues = z.infer<typeof emiCalcSchema>;

export interface EmiCalcSnapshot {
  formValues: Partial<EmiCalcValues>;
  result: EMICalculateResponse | null;
  desiredEmi: string;
}

interface EmiCalculatorProps {
  snapshot?: EmiCalcSnapshot;
  onSnapshot?: (snap: EmiCalcSnapshot) => void;
  onApply: (result: EMICalculateResponse) => void;
  onClose?: () => void;
  applyLabel?: string;
}

export function EmiCalculator({
  snapshot,
  onSnapshot,
  onApply,
  onClose,
  applyLabel = "Use this EMI — populate loan fields",
}: EmiCalculatorProps) {
  const [result, setResult] = useState<EMICalculateResponse | null>(snapshot?.result ?? null);
  const [desiredEmi, setDesiredEmi] = useState(snapshot?.desiredEmi ?? "");
  const [lastValues, setLastValues] = useState<EmiCalcValues | null>(
    snapshot?.formValues ? (snapshot.formValues as EmiCalcValues) : null
  );

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<EmiCalcValues>({
    resolver: zodResolver(emiCalcSchema),
    defaultValues: {
      vehicle_value: snapshot?.formValues?.vehicle_value ?? undefined,
      document_charge_pct: snapshot?.formValues?.document_charge_pct ?? 0,
      monthly_interest_rate: snapshot?.formValues?.monthly_interest_rate ?? undefined,
      number_of_months: snapshot?.formValues?.number_of_months ?? 12,
      interest_split_method: snapshot?.formValues?.interest_split_method ?? "rule_of_78",
    },
  });

  const resultRef = useRef(result);
  const desiredEmiRef = useRef(desiredEmi);
  useEffect(() => { resultRef.current = result; }, [result]);
  useEffect(() => { desiredEmiRef.current = desiredEmi; }, [desiredEmi]);
  const watchedValues = watch();
  const watchedRef = useRef(watchedValues);
  useEffect(() => { watchedRef.current = watchedValues; });
  useEffect(() => {
    return () => {
      onSnapshot?.({
        formValues: watchedRef.current,
        result: resultRef.current,
        desiredEmi: desiredEmiRef.current,
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const calcMutation = useMutation({
    mutationFn: (values: EmiCalcValues) =>
      calculateEmi({
        vehicle_value: String(Number(values.vehicle_value).toFixed(2)),
        document_charge_pct: String(Number(values.document_charge_pct).toFixed(2)),
        monthly_interest_rate: String(Number(values.monthly_interest_rate).toFixed(4)),
        number_of_months: values.number_of_months,
        interest_split_method: values.interest_split_method,
      }),
    onSuccess: (data, values) => {
      setResult(data);
      setDesiredEmi(data.emi ?? "");
      setLastValues(values);
    },
  });

  const recalcMutation = useMutation({
    mutationFn: () => {
      if (!lastValues) throw new Error();
      return calculateEmi({
        vehicle_value: String(Number(lastValues.vehicle_value).toFixed(2)),
        document_charge_pct: String(Number(lastValues.document_charge_pct).toFixed(2)),
        monthly_interest_rate: String(Number(lastValues.monthly_interest_rate).toFixed(4)),
        number_of_months: lastValues.number_of_months,
        interest_split_method: lastValues.interest_split_method,
        desired_emi: desiredEmi,
      });
    },
    onSuccess: (data) => setResult(data),
  });

  const isDesiredChanged = result && desiredEmi && desiredEmi !== result.emi;
  const effectiveRate = result?.implied_annual_rate ?? result?.annual_interest_rate;

  return (
    <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">EMI Calculator</p>
        {onClose && (
          <Button type="button" size="sm" variant="ghost" onClick={onClose} className="h-7 text-xs">
            Close ✕
          </Button>
        )}
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Vehicle Loan (₹) *</Label>
            <Input {...register("vehicle_value")} type="number" step="0.01" placeholder="e.g. 36000" className="h-8 text-sm" />
            {errors.vehicle_value && <p className="text-xs text-destructive">{errors.vehicle_value.message}</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Doc. Charge (%)</Label>
            <Input {...register("document_charge_pct")} type="number" step="0.01" placeholder="0" className="h-8 text-sm" />
            {errors.document_charge_pct && <p className="text-xs text-destructive">{errors.document_charge_pct.message}</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Monthly Interest Rate (%) *</Label>
            <Input {...register("monthly_interest_rate")} type="number" step="0.01" placeholder="e.g. 2" className="h-8 text-sm" />
            {errors.monthly_interest_rate && <p className="text-xs text-destructive">{errors.monthly_interest_rate.message}</p>}
            {watch("monthly_interest_rate") && (
              <p className="text-xs text-muted-foreground">= {(Number(watch("monthly_interest_rate")) * 12).toFixed(2)}% p.a.</p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tenure (months) *</Label>
            <Input {...register("number_of_months")} type="number" min={1} className="h-8 text-sm" />
            {errors.number_of_months && <p className="text-xs text-destructive">{errors.number_of_months.message}</p>}
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Amortization Method</Label>
            <Select
              value={watch("interest_split_method")}
              onValueChange={(v) => setValue("interest_split_method", v as InterestSplitMethod)}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(SPLIT_LABELS) as [InterestSplitMethod, string][]).map(([v, l]) => (
                  <SelectItem key={v} value={v} className="text-sm">{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={calcMutation.isPending}
          className="gap-1.5"
          onClick={() => handleSubmit((v) => calcMutation.mutate(v))()}
        >
          Calculate EMI {calcMutation.isPending && "…"}
        </Button>
      </div>

      {result && (
        <div className="space-y-3 border-t pt-3">
          <div className="rounded-md bg-primary/5 border border-primary/20 px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Monthly EMI</p>
              <p className="text-xl font-bold text-primary"><CurrencyDisplay value={result.emi ?? "0"} /></p>
            </div>
            <div className="text-right text-xs text-muted-foreground space-y-0.5">
              <p>Principal <span className="font-medium text-foreground"><CurrencyDisplay value={result.principal_amount ?? "0"} /></span></p>
              <p>Total Interest <span className="font-medium text-foreground"><CurrencyDisplay value={result.total_interest ?? "0"} /></span></p>
              <p>Total Payable <span className="font-semibold text-foreground"><CurrencyDisplay value={result.total_payable ?? "0"} /></span></p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium">Adjust to a round EMI (optional)</p>
            <div className="flex gap-2 items-end">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Desired EMI (₹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={desiredEmi}
                  onChange={(e) => setDesiredEmi(e.target.value)}
                  className="h-8 text-sm"
                  placeholder="e.g. 2500"
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => recalcMutation.mutate()}
                disabled={recalcMutation.isPending || !isDesiredChanged}
              >
                {recalcMutation.isPending ? "…" : "Apply"}
              </Button>
            </div>
            {result.implied_annual_rate && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                Implied rate: <strong>{Number(result.implied_monthly_rate).toFixed(4)}%/month</strong> ({Number(result.implied_annual_rate).toFixed(4)}% p.a.) —
                will be used as the loan interest rate.
              </p>
            )}
          </div>

          <Button
            type="button"
            size="sm"
            className="w-full"
            onClick={() => onApply(result)}
          >
            {applyLabel}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Sets principal, interest rate ({effectiveRate}% p.a.), tenure &amp; method in the loan details.
          </p>
        </div>
      )}
    </div>
  );
}
