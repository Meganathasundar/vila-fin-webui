import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { createLoan } from "@/api/loans";
import { createCustomer } from "@/api/customers";
import { createVehicle } from "@/api/vehicles";
import { createCostIncurred } from "@/api/costsIncurred";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { PageHeader } from "@/components/shared/PageHeader";
import { LookupSelectField } from "@/components/shared/LookupSelectField";
import { calculateEMI, calculateTotalPayable, calculateTotalInterest } from "@/utils/emi";
import { formatINR } from "@/utils/currency";

// ── Schemas ────────────────────────────────────────────────────────────────────

const customerSchema = z.object({
  full_name: z.string().min(1, "Required"),
  phone: z.string().min(1, "Required"),
  alt_phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  id_type: z.enum(["aadhaar", "pan", "passport", "driving_licence", "voter_id"], {
    errorMap: () => ({ message: "Select an ID type" }),
  }),
  id_number: z.string().min(1, "Required"),
});

// Guarantor has same shape as customer but every field is optional so the step
// can be skipped entirely by clicking "Skip".
const guarantorSchema = z.object({
  full_name: z.string().min(1, "Required"),
  phone: z.string().min(1, "Required"),
  alt_phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  id_type: z.enum(["aadhaar", "pan", "passport", "driving_licence", "voter_id"], {
    errorMap: () => ({ message: "Select an ID type" }),
  }),
  id_number: z.string().min(1, "Required"),
});

const vehicleSchema = z.object({
  registration_no: z.string().min(1, "Required"),
  make: z.string().min(1, "Required"),
  model: z.string().min(1, "Required"),
  year: z.coerce.number().int().min(1980, "Year must be 1980 or later").max(2100),
  color: z.string().optional(),
  fuel_type: z.enum(["petrol", "diesel", "electric", "hybrid", "cng", "other"]).optional(),
  vehicle_type: z.enum(["two_wheeler", "four_wheeler", "commercial"]).optional(),
  vehicle_source: z.enum(["lender_stock", "external_collateral"]).optional(),
  chassis_no: z.string().optional(),
  engine_no: z.string().optional(),
  purchase_date: z.string().optional(),
  consultancy: z.string().nullable().optional(),
  sale_price: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().positive("Must be positive").optional()
  ),
  vehicle_cost: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().positive("Must be positive").optional()
  ),
});

const loanSchema = z.object({
  loan_type: z.enum(["vehicle_sale", "external_purchase"]),
  principal_amount: z.coerce.number().positive("Must be positive"),
  interest_rate: z.coerce.number().positive("Must be positive"),
  tenure_months: z.coerce.number().int().positive("Must be positive"),
  notes: z.string().optional(),
});

type CustomerValues = z.infer<typeof customerSchema>;
type GuarantorValues = z.infer<typeof guarantorSchema>;
type VehicleValues = z.infer<typeof vehicleSchema>;
type LoanValues = z.infer<typeof loanSchema>;

// ── Constants ──────────────────────────────────────────────────────────────────

const ID_TYPE_LABELS: Record<string, string> = {
  aadhaar: "Aadhaar",
  pan: "PAN",
  passport: "Passport",
  driving_licence: "Driving Licence",
  voter_id: "Voter ID",
};

const STEPS = ["Customer", "Guarantor", "Vehicle", "Loan Details", "Review & Submit"];

// ── Reusable person-info form fields ──────────────────────────────────────────

function PersonFields<T extends CustomerValues | GuarantorValues>({
  form,
}: {
  form: ReturnType<typeof useForm<T>>;
}) {
  // Cast to any for generic field access — validated by schemas above
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const f = form as ReturnType<typeof useForm<any>>;
  const errors = f.formState.errors;

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-1 col-span-2">
        <Label>Full Name *</Label>
        <Input {...f.register("full_name")} placeholder="Ravi Kumar" />
        {errors.full_name && <p className="text-xs text-destructive">{errors.full_name.message}</p>}
      </div>

      <div className="space-y-1">
        <Label>Phone *</Label>
        <Input {...f.register("phone")} placeholder="9876543210" />
        {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
      </div>

      <div className="space-y-1">
        <Label>Alternate Phone</Label>
        <Input {...f.register("alt_phone")} placeholder="Optional" />
      </div>

      <div className="space-y-1 col-span-2">
        <Label>Address</Label>
        <Input {...f.register("address")} placeholder="Door No, Street Name" />
      </div>

      <div className="space-y-1">
        <Label>City</Label>
        <Input {...f.register("city")} placeholder="Chennai" />
      </div>

      <div className="space-y-1">
        <Label>State</Label>
        <Input {...f.register("state")} placeholder="Tamil Nadu" />
      </div>

      <div className="space-y-1">
        <Label>Pincode</Label>
        <Input {...f.register("pincode")} placeholder="600001" />
      </div>

      <div className="space-y-1">
        <Label>ID Type *</Label>
        <Select
          value={f.watch("id_type")}
          onValueChange={(v: string) => f.setValue("id_type", v)}
        >
          <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
          <SelectContent>
            {Object.entries(ID_TYPE_LABELS).map(([val, label]) => (
              <SelectItem key={val} value={val}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.id_type && <p className="text-xs text-destructive">{errors.id_type.message}</p>}
      </div>

      <div className="space-y-1">
        <Label>ID Number *</Label>
        <Input {...f.register("id_number")} placeholder="XXXX XXXX XXXX" className="uppercase" />
        {errors.id_number && <p className="text-xs text-destructive">{errors.id_number.message}</p>}
      </div>
    </div>
  );
}

// ── Main form ──────────────────────────────────────────────────────────────────

export default function LoanForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);

  // Completed step data
  const [customerData, setCustomerData] = useState<CustomerValues | null>(null);
  // null = not yet decided; undefined = skipped
  const [guarantorData, setGuarantorData] = useState<GuarantorValues | null | undefined>(null);
  const [vehicleData, setVehicleData] = useState<VehicleValues | null>(null);

  // ── Per-step forms ──────────────────────────────────────────────────────────

  const customerForm = useForm<CustomerValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: customerData ?? undefined,
  });

  const guarantorForm = useForm<GuarantorValues>({
    resolver: zodResolver(guarantorSchema),
    defaultValues: (guarantorData ?? undefined) as GuarantorValues | undefined,
  });

  const vehicleForm = useForm<VehicleValues>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: vehicleData ?? {
      vehicle_source: "lender_stock",
      purchase_date: new Date().toISOString().split("T")[0],
    },
  });

  const loanForm = useForm<LoanValues>({
    resolver: zodResolver(loanSchema),
    defaultValues: { loan_type: "vehicle_sale", tenure_months: 12, interest_rate: 12 },
  });

  const s2 = loanForm.watch();
  const emi = calculateEMI(Number(s2.principal_amount), Number(s2.interest_rate), Number(s2.tenure_months));
  const reviewTotal = calculateTotalPayable(emi, Number(s2.tenure_months));
  const reviewInterest = calculateTotalInterest(Number(s2.principal_amount), emi, Number(s2.tenure_months));

  // ── Submission (sequential: customer → guarantor? → vehicle → loan) ─────────

  const mutation = useMutation({
    mutationFn: async (loan: LoanValues) => {
      // 1. Create customer
      const customer = await createCustomer({
        full_name: customerData!.full_name,
        phone: customerData!.phone,
        alt_phone: customerData!.alt_phone || undefined,
        address: customerData!.address || undefined,
        city: customerData!.city || undefined,
        state: customerData!.state || undefined,
        pincode: customerData!.pincode || undefined,
        id_type: customerData!.id_type,
        id_number: customerData!.id_number,
      });

      // 2. Create guarantor (if not skipped)
      let guarantorId: string | null = null;
      if (guarantorData) {
        const guarantor = await createCustomer({
          full_name: guarantorData.full_name,
          phone: guarantorData.phone,
          alt_phone: guarantorData.alt_phone || undefined,
          address: guarantorData.address || undefined,
          city: guarantorData.city || undefined,
          state: guarantorData.state || undefined,
          pincode: guarantorData.pincode || undefined,
          id_type: guarantorData.id_type,
          id_number: guarantorData.id_number,
        });
        guarantorId = guarantor.id ?? null;
      }

      // 3. Create vehicle
      const vd = vehicleData!;
      const vehicle = await createVehicle({
        registration_no: vd.registration_no,
        make: vd.make,
        model: vd.model,
        year: vd.year,
        color: vd.color || undefined,
        fuel_type: vd.fuel_type || undefined,
        vehicle_type: vd.vehicle_type || undefined,
        vehicle_source: vd.vehicle_source ?? "lender_stock",
        chassis_no: vd.chassis_no || undefined,
        engine_no: vd.engine_no || undefined,
        purchase_date: vd.purchase_date || undefined,
        consultancy: vd.consultancy || null,
        sale_price: vd.sale_price ? String(Number(vd.sale_price).toFixed(2)) : undefined,
        vehicle_cost: vd.vehicle_cost ? String(Number(vd.vehicle_cost).toFixed(2)) : undefined,
      });

      // 3a. Auto-log purchasing cost if provided
      if (vd.vehicle_cost && vehicle.id) {
        await createCostIncurred({
          vehicle_id: vehicle.id,
          cost_type: "purchasing_cost",
          cost: String(Number(vd.vehicle_cost).toFixed(2)),
          service_date: vd.purchase_date || new Date().toISOString().split("T")[0],
          description: "Vehicle purchase cost",
        });
      }

      // 4. Create loan
      return createLoan({
        customer_id: customer.id!,
        vehicle_id: vehicle.id!,
        guarantor_id: guarantorId,
        loan_type: loan.loan_type,
        principal_amount: String(loan.principal_amount),
        interest_rate: String(loan.interest_rate),
        tenure_months: loan.tenure_months,
        emi_amount: String(emi),
        notes: loan.notes,
      });
    },
    onSuccess: (loan) => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Loan created (draft)");
      navigate(`/loans/${loan.id}`);
    },
    onError: (err: { response?: { status?: number; data?: { error?: { message?: string } } } }) => {
      if (err?.response?.status === 409) {
        toast.error("A record with that phone / registration number already exists.");
      } else {
        toast.error(err?.response?.data?.error?.message ?? "Failed to create loan.");
      }
    },
  });

  // ── Step nav helpers ────────────────────────────────────────────────────────

  const handleCustomerNext = (data: CustomerValues) => {
    setCustomerData(data);
    setStep(2);
  };

  const handleGuarantorNext = (data: GuarantorValues) => {
    setGuarantorData(data);
    setStep(3);
  };

  const handleGuarantorSkip = () => {
    setGuarantorData(undefined); // explicitly skipped
    setStep(3);
  };

  const handleVehicleNext = (data: VehicleValues) => {
    setVehicleData(data);
    const loanType = data.vehicle_source === "external_collateral" ? "external_purchase" : "vehicle_sale";
    loanForm.setValue("loan_type", loanType);
    setStep(4);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Create Loan" />

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm flex-wrap">
        {STEPS.map((_, idx) => {
          const n = idx + 1;
          return (
            <div key={n} className="flex items-center gap-2">
              <div
                className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0
                  ${step >= n ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}
              >
                {step > n ? "✓" : n}
              </div>
              {n < STEPS.length && <div className={`h-px w-8 ${step > n ? "bg-primary" : "bg-muted"}`} />}
            </div>
          );
        })}
        <span className="ml-2 text-muted-foreground">{STEPS[step - 1]}</span>
      </div>

      {/* ── Step 1: Customer ──────────────────────────────────────────────────── */}
      {step === 1 && (
        <Card>
          <CardHeader><CardTitle>Step 1 — Customer Information</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={customerForm.handleSubmit(handleCustomerNext)} className="space-y-4">
              <PersonFields form={customerForm} />
              <Button type="submit">Next →</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Guarantor (optional) ──────────────────────────────────────── */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2 — Guarantor Information</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              A guarantor is registered as a customer record and linked to this loan.
              Skip if no guarantor is required.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={guarantorForm.handleSubmit(handleGuarantorNext)} className="space-y-4">
              <PersonFields form={guarantorForm} />
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setStep(1)}>← Back</Button>
                <Button type="submit">Save Guarantor & Next →</Button>
                <Button type="button" variant="ghost" onClick={handleGuarantorSkip}>
                  Skip (No Guarantor)
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── Step 3: Vehicle ───────────────────────────────────────────────────── */}
      {step === 3 && (
        <Card>
          <CardHeader><CardTitle>Step 3 — Vehicle Information</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={vehicleForm.handleSubmit(handleVehicleNext)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Registration No *</Label>
                  <Input {...vehicleForm.register("registration_no")} placeholder="TN01AB1234" className="uppercase" />
                  {vehicleForm.formState.errors.registration_no && (
                    <p className="text-xs text-destructive">{vehicleForm.formState.errors.registration_no.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label>Make *</Label>
                  <Input {...vehicleForm.register("make")} placeholder="Honda" />
                  {vehicleForm.formState.errors.make && (
                    <p className="text-xs text-destructive">{vehicleForm.formState.errors.make.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label>Model *</Label>
                  <Input {...vehicleForm.register("model")} placeholder="Activa 6G" />
                  {vehicleForm.formState.errors.model && (
                    <p className="text-xs text-destructive">{vehicleForm.formState.errors.model.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label>Year *</Label>
                  <Input type="number" {...vehicleForm.register("year")} placeholder="2022" />
                  {vehicleForm.formState.errors.year && (
                    <p className="text-xs text-destructive">{vehicleForm.formState.errors.year.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label>Color</Label>
                  <Input {...vehicleForm.register("color")} placeholder="Pearl White" />
                </div>

                <div className="space-y-1">
                  <Label>Fuel Type</Label>
                  <Select
                    value={vehicleForm.watch("fuel_type")}
                    onValueChange={(v) => vehicleForm.setValue("fuel_type", v as VehicleValues["fuel_type"])}
                  >
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      {["petrol", "diesel", "electric", "hybrid", "cng", "other"].map((f) => (
                        <SelectItem key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Vehicle Type</Label>
                  <Select
                    value={vehicleForm.watch("vehicle_type")}
                    onValueChange={(v) => vehicleForm.setValue("vehicle_type", v as VehicleValues["vehicle_type"])}
                  >
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="two_wheeler">Two Wheeler</SelectItem>
                      <SelectItem value="four_wheeler">Four Wheeler</SelectItem>
                      <SelectItem value="commercial">Commercial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Vehicle Source</Label>
                  <Select
                    value={vehicleForm.watch("vehicle_source")}
                    onValueChange={(v) => vehicleForm.setValue("vehicle_source", v as VehicleValues["vehicle_source"])}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lender_stock">Lender Stock</SelectItem>
                      <SelectItem value="external_collateral">External Collateral</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Chassis No</Label>
                  <Input {...vehicleForm.register("chassis_no")} placeholder="Optional" />
                </div>

                <div className="space-y-1">
                  <Label>Engine No</Label>
                  <Input {...vehicleForm.register("engine_no")} placeholder="Optional" />
                </div>

                <div className="space-y-1">
                  <Label>Purchase Date</Label>
                  <Input type="date" {...vehicleForm.register("purchase_date")} />
                  <p className="text-xs text-muted-foreground">Date vehicle was acquired</p>
                </div>

                <div className="space-y-1">
                  <Label>Vehicle Cost (₹)</Label>
                  <Input type="number" step="0.01" {...vehicleForm.register("vehicle_cost")} placeholder="e.g. 350000" />
                  {vehicleForm.formState.errors.vehicle_cost && (
                    <p className="text-xs text-destructive">{vehicleForm.formState.errors.vehicle_cost.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">Auto-logged as purchasing cost</p>
                </div>

                <div className="space-y-1">
                  <Label>Sale Price (₹)</Label>
                  <Input type="number" step="0.01" {...vehicleForm.register("sale_price")} placeholder="e.g. 400000" />
                  {vehicleForm.formState.errors.sale_price && (
                    <p className="text-xs text-destructive">{vehicleForm.formState.errors.sale_price.message}</p>
                  )}
                </div>

                <div className="space-y-1 col-span-2">
                  <Label>Consultancy Agency</Label>
                  <LookupSelectField
                    listCode="vehicle_consultancy"
                    value={vehicleForm.watch("consultancy")}
                    onChange={(v) => vehicleForm.setValue("consultancy", v)}
                    placeholder="Select consultancy…"
                    allowNone
                  />
                </div>
              </div>

              {vehicleForm.watch("vehicle_source") === "external_collateral" && (
                <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700">
                  External collateral vehicle — loan type will be set to <strong>External Purchase</strong> automatically.
                </div>
              )}

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setStep(2)}>← Back</Button>
                <Button type="submit">Next →</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── Step 4: Loan Details ──────────────────────────────────────────────── */}
      {step === 4 && (
        <Card>
          <CardHeader><CardTitle>Step 4 — Loan Details</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={loanForm.handleSubmit(() => setStep(5))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1">
                  <Label>Loan Type</Label>
                  <Select
                    value={s2.loan_type}
                    onValueChange={(v) => loanForm.setValue("loan_type", v as LoanValues["loan_type"])}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vehicle_sale">Vehicle Sale</SelectItem>
                      <SelectItem value="external_purchase">External Purchase</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Principal Amount (₹) *</Label>
                  <Input type="number" {...loanForm.register("principal_amount")} />
                  {loanForm.formState.errors.principal_amount && (
                    <p className="text-xs text-destructive">{loanForm.formState.errors.principal_amount.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label>Interest Rate (% p.a.) *</Label>
                  <Input type="number" step="0.01" {...loanForm.register("interest_rate")} />
                  {loanForm.formState.errors.interest_rate && (
                    <p className="text-xs text-destructive">{loanForm.formState.errors.interest_rate.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label>Tenure (months) *</Label>
                  <Input type="number" {...loanForm.register("tenure_months")} />
                  {loanForm.formState.errors.tenure_months && (
                    <p className="text-xs text-destructive">{loanForm.formState.errors.tenure_months.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label>Notes</Label>
                  <Textarea {...loanForm.register("notes")} rows={2} />
                </div>
              </div>

              {emi > 0 && (
                <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 text-sm">
                  <span className="text-muted-foreground">Estimated EMI: </span>
                  <span className="text-lg font-bold text-primary">{formatINR(emi)}/month</span>
                </div>
              )}

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setStep(3)}>← Back</Button>
                <Button type="submit">Next →</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── Step 5: Review & Submit ───────────────────────────────────────────── */}
      {step === 5 && customerData && vehicleData && (
        <Card>
          <CardHeader><CardTitle>Step 5 — Review & Submit</CardTitle></CardHeader>
          <CardContent className="space-y-5">

            {/* Customer */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Customer</h3>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div><dt className="text-muted-foreground">Name</dt><dd className="font-medium">{customerData.full_name}</dd></div>
                <div><dt className="text-muted-foreground">Phone</dt><dd>{customerData.phone}{customerData.alt_phone ? ` / ${customerData.alt_phone}` : ""}</dd></div>
                <div><dt className="text-muted-foreground">ID</dt><dd>{ID_TYPE_LABELS[customerData.id_type]} · {customerData.id_number}</dd></div>
                {customerData.city && (
                  <div><dt className="text-muted-foreground">City</dt><dd>{customerData.city}{customerData.state ? `, ${customerData.state}` : ""}</dd></div>
                )}
              </dl>
            </div>

            <hr />

            {/* Guarantor */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Guarantor
              </h3>
              {guarantorData ? (
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div><dt className="text-muted-foreground">Name</dt><dd className="font-medium">{guarantorData.full_name}</dd></div>
                  <div><dt className="text-muted-foreground">Phone</dt><dd>{guarantorData.phone}{guarantorData.alt_phone ? ` / ${guarantorData.alt_phone}` : ""}</dd></div>
                  <div><dt className="text-muted-foreground">ID</dt><dd>{ID_TYPE_LABELS[guarantorData.id_type]} · {guarantorData.id_number}</dd></div>
                  {guarantorData.city && (
                    <div><dt className="text-muted-foreground">City</dt><dd>{guarantorData.city}{guarantorData.state ? `, ${guarantorData.state}` : ""}</dd></div>
                  )}
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground italic">No guarantor — skipped</p>
              )}
            </div>

            <hr />

            {/* Vehicle */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Vehicle</h3>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div><dt className="text-muted-foreground">Reg No</dt><dd className="font-mono">{vehicleData.registration_no}</dd></div>
                <div><dt className="text-muted-foreground">Vehicle</dt><dd>{vehicleData.make} {vehicleData.model} ({vehicleData.year})</dd></div>
                {vehicleData.color && <div><dt className="text-muted-foreground">Color</dt><dd>{vehicleData.color}</dd></div>}
                {vehicleData.vehicle_source && (
                  <div><dt className="text-muted-foreground">Source</dt><dd><StatusBadge status={vehicleData.vehicle_source} /></dd></div>
                )}
                {vehicleData.sale_price && (
                  <div><dt className="text-muted-foreground">Sale Price</dt><dd><CurrencyDisplay value={vehicleData.sale_price} /></dd></div>
                )}
                {vehicleData.vehicle_cost && (
                  <div><dt className="text-muted-foreground">Purchase Cost</dt><dd><CurrencyDisplay value={vehicleData.vehicle_cost} /></dd></div>
                )}
              </dl>
            </div>

            <hr />

            {/* Loan */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Loan</h3>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div><dt className="text-muted-foreground">Loan Type</dt><dd><StatusBadge status={s2.loan_type} /></dd></div>
                <div><dt className="text-muted-foreground">Principal</dt><dd className="font-semibold"><CurrencyDisplay value={s2.principal_amount} /></dd></div>
                <div><dt className="text-muted-foreground">Interest Rate</dt><dd>{s2.interest_rate}% p.a.</dd></div>
                <div><dt className="text-muted-foreground">Tenure</dt><dd>{s2.tenure_months} months</dd></div>
                <div><dt className="text-muted-foreground">EMI</dt><dd className="font-semibold"><CurrencyDisplay value={emi} /></dd></div>
                <div><dt className="text-muted-foreground">Total Payable</dt><dd><CurrencyDisplay value={reviewTotal} /></dd></div>
                <div><dt className="text-muted-foreground">Total Interest</dt><dd><CurrencyDisplay value={reviewInterest} /></dd></div>
                {s2.notes && <div className="col-span-2"><dt className="text-muted-foreground">Notes</dt><dd>{s2.notes}</dd></div>}
              </dl>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setStep(4)}>← Back</Button>
              <Button
                onClick={() => loanForm.handleSubmit((d) => mutation.mutate(d))()}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? "Creating…" : "Create Loan (Draft)"}
              </Button>
            </div>

            {mutation.isPending && (
              <p className="text-xs text-muted-foreground">
                Creating customer{guarantorData ? ", guarantor" : ""}, vehicle and loan record…
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
