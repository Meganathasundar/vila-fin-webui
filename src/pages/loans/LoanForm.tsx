import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { createLoan } from "@/api/loans";
import { createPerson, listPersons } from "@/api/persons";
import { createVehicle, listVehicles } from "@/api/vehicles";
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
import { PersonMatchDialog } from "@/components/shared/PersonMatchDialog";
import { VehicleMatchDialog } from "@/components/shared/VehicleMatchDialog";
import { calculateEMI, calculateTotalPayable, calculateTotalInterest } from "@/utils/emi";
import { formatINR } from "@/utils/currency";
import type { Person, Vehicle } from "@/types/api";

// ── Schemas ────────────────────────────────────────────────────────────────────

const personSchema = z.object({
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
  interest_split_method: z.enum(["equal", "rule_of_78", "reducing_balance"]).default("reducing_balance"),
  principal_amount: z.coerce.number().positive("Must be positive"),
  interest_rate: z.coerce.number().positive("Must be positive"),
  tenure_months: z.coerce.number().int().positive("Must be positive"),
  notes: z.string().optional(),
});

type PersonValues = z.infer<typeof personSchema>;
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

function dedupePersons(list: Person[]): Person[] {
  return Array.from(new Map(list.map((p) => [p.id, p])).values());
}

// ── ExistingPersonBanner — shown when user selected a person from lookup ───────

function ExistingPersonBanner({ person, onClear }: { person: Person; onClear: () => void }) {
  return (
    <div className="rounded-md border border-primary/30 bg-primary/5 p-4 flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <p className="font-medium text-sm">{person.full_name}</p>
        <p className="text-xs text-muted-foreground">
          {person.phone}
          {person.alt_phone ? ` · ${person.alt_phone}` : ""}
          {person.city ? ` · ${person.city}` : ""}
        </p>
        <p className="text-xs text-muted-foreground capitalize">
          {person.id_type?.replace(/_/g, " ")} · {person.id_number}
        </p>
        <div className="pt-0.5">
          <StatusBadge status={person.kyc_status ?? "pending"} />
        </div>
      </div>
      <Button size="sm" variant="outline" className="shrink-0" onClick={onClear}>
        Change
      </Button>
    </div>
  );
}

// ── ExistingVehicleBanner — shown when user selected a vehicle from lookup ─────

function ExistingVehicleBanner({ vehicle, onClear }: { vehicle: Vehicle; onClear: () => void }) {
  return (
    <div className="rounded-md border border-primary/30 bg-primary/5 p-4 flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <p className="font-mono font-semibold text-sm">{vehicle.registration_no}</p>
        <p className="text-sm text-muted-foreground">
          {vehicle.make} {vehicle.model}
          {vehicle.year ? ` · ${vehicle.year}` : ""}
          {vehicle.color ? ` · ${vehicle.color}` : ""}
        </p>
        <div className="flex items-center gap-1.5 pt-0.5">
          {vehicle.vehicle_source && <StatusBadge status={vehicle.vehicle_source} />}
          {vehicle.current_status && <StatusBadge status={vehicle.current_status} />}
        </div>
      </div>
      <Button size="sm" variant="outline" className="shrink-0" onClick={onClear}>
        Change
      </Button>
    </div>
  );
}

// ── PersonFields — shared fields with on-blur duplicate lookup ─────────────────

function PersonFields({
  form,
  onExistingSelected,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: ReturnType<typeof useForm<any>>;
  onExistingSelected: (person: Person) => void;
}) {
  const f = form;
  const errors = f.formState.errors;

  // Search params — set on blur, drive the queries below
  const [phoneSearch, setPhoneSearch] = useState("");
  const [idSearch, setIdSearch] = useState({ id_type: "", id_number: "" });

  // Persons to display in the dialog; cleared on dismiss or selection
  const [matchedPersons, setMatchedPersons] = useState<Person[]>([]);

  const { data: phoneData } = useQuery({
    queryKey: ["persons-lookup", "phone", phoneSearch],
    queryFn: () => listPersons({ phone: phoneSearch, limit: 5 }),
    enabled: phoneSearch.length >= 6,
    staleTime: 60_000,
  });

  const { data: idData } = useQuery({
    queryKey: ["persons-lookup", "id", idSearch.id_type, idSearch.id_number],
    queryFn: () => listPersons({ id_type: idSearch.id_type, id_number: idSearch.id_number, limit: 5 }),
    enabled: !!(idSearch.id_type && idSearch.id_number.length >= 3),
    staleTime: 60_000,
  });

  // Open dialog when query results arrive with matches
  useEffect(() => {
    const persons = phoneData?.data ?? [];
    if (persons.length > 0) setMatchedPersons((prev) => dedupePersons([...prev, ...persons]));
  }, [phoneData]);

  useEffect(() => {
    const persons = idData?.data ?? [];
    if (persons.length > 0) setMatchedPersons((prev) => dedupePersons([...prev, ...persons]));
  }, [idData]);

  const clearSearch = () => {
    setPhoneSearch("");
    setIdSearch({ id_type: "", id_number: "" });
    setMatchedPersons([]);
  };

  const handlePhoneBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    f.register("phone").onBlur(e);
    const val = e.target.value.trim();
    if (val.length >= 6) setPhoneSearch(val);
  };

  const handleIdTypeChange = (v: string) => {
    f.setValue("id_type", v);
    const id_number = (f.getValues("id_number") as string) ?? "";
    if (id_number.length >= 3) setIdSearch({ id_type: v, id_number });
  };

  const handleIdNumberBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    f.register("id_number").onBlur(e);
    const id_number = e.target.value.trim();
    const id_type = (f.getValues("id_type") as string) ?? "";
    if (id_type && id_number.length >= 3) setIdSearch({ id_type, id_number });
  };

  const handleSelect = (person: Person) => {
    clearSearch();
    onExistingSelected(person);
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1 col-span-2">
          <Label>Full Name *</Label>
          <Input {...f.register("full_name")} placeholder="Ravi Kumar" />
          {errors.full_name && <p className="text-xs text-destructive">{errors.full_name.message}</p>}
        </div>

        <div className="space-y-1">
          <Label>Phone *</Label>
          <Input
            {...f.register("phone")}
            onBlur={handlePhoneBlur}
            placeholder="9876543210"
          />
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
          <Select value={f.watch("id_type")} onValueChange={handleIdTypeChange}>
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
          <Input
            {...f.register("id_number")}
            onBlur={handleIdNumberBlur}
            placeholder="XXXX XXXX XXXX"
            className="uppercase"
          />
          {errors.id_number && <p className="text-xs text-destructive">{errors.id_number.message}</p>}
        </div>
      </div>

      <PersonMatchDialog
        open={matchedPersons.length > 0}
        persons={matchedPersons}
        onSelect={handleSelect}
        onDismiss={clearSearch}
      />
    </>
  );
}

// ── Main form ──────────────────────────────────────────────────────────────────

export default function LoanForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);

  // Form data for new persons
  const [customerData, setCustomerData] = useState<PersonValues | null>(null);
  const [guarantorData, setGuarantorData] = useState<PersonValues | null | undefined>(null); // undefined = skipped

  // Existing persons selected from lookup (bypasses createPerson on submit)
  const [existingCustomer, setExistingCustomer] = useState<Person | null>(null);
  const [existingGuarantor, setExistingGuarantor] = useState<Person | null>(null);

  // Existing vehicle selected from lookup (bypasses createVehicle on submit)
  const [existingVehicle, setExistingVehicle] = useState<Vehicle | null>(null);

  const [vehicleData, setVehicleData] = useState<VehicleValues | null>(null);

  // ── Vehicle registration number lookup ──────────────────────────────────────
  const [regNoSearch, setRegNoSearch] = useState("");
  const [vehicleMatches, setVehicleMatches] = useState<Vehicle[]>([]);

  const { data: regNoData } = useQuery({
    queryKey: ["vehicles-lookup", "reg", regNoSearch],
    queryFn: () => listVehicles({ registration_no: regNoSearch, limit: 5 }),
    enabled: regNoSearch.length >= 3,
    staleTime: 60_000,
  });

  useEffect(() => {
    const found = regNoData?.data ?? [];
    if (found.length > 0) setVehicleMatches(found);
  }, [regNoData]);

  // ── Per-step forms ──────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customerForm = useForm<any>({
    resolver: zodResolver(personSchema),
    defaultValues: customerData ?? undefined,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const guarantorForm = useForm<any>({
    resolver: zodResolver(personSchema),
    defaultValues: (guarantorData ?? undefined) as PersonValues | undefined,
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
    defaultValues: { loan_type: "vehicle_sale", interest_split_method: "reducing_balance", tenure_months: 12, interest_rate: 12 },
  });

  const s2 = loanForm.watch();
  const emi = calculateEMI(Number(s2.principal_amount), Number(s2.interest_rate), Number(s2.tenure_months));
  const reviewTotal = calculateTotalPayable(emi, Number(s2.tenure_months));
  const reviewInterest = calculateTotalInterest(Number(s2.principal_amount), emi, Number(s2.tenure_months));

  // ── Submission ──────────────────────────────────────────────────────────────

  const mutation = useMutation({
    mutationFn: async (loan: LoanValues) => {
      // 1. Customer — use existing or create new
      const customerId = existingCustomer?.id
        ?? (await createPerson({
            full_name: customerData!.full_name,
            phone: customerData!.phone,
            alt_phone: customerData!.alt_phone || undefined,
            address: customerData!.address || undefined,
            city: customerData!.city || undefined,
            state: customerData!.state || undefined,
            pincode: customerData!.pincode || undefined,
            id_type: customerData!.id_type,
            id_number: customerData!.id_number,
          })).id!;

      // 2. Guarantor — use existing, create new, or skip
      let guarantorId: string | null = null;
      if (existingGuarantor?.id) {
        guarantorId = existingGuarantor.id;
      } else if (guarantorData) {
        const g = await createPerson({
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
        guarantorId = g.id ?? null;
      }

      // 3. Vehicle — use existing or create new
      let vehicleId: string;
      if (existingVehicle?.id) {
        vehicleId = existingVehicle.id;
      } else {
        const vd = vehicleData!;
        const vehicle = await createVehicle({
          registration_no: vd.registration_no,
          make: vd.make,
          model: vd.model,
          year: vd.year,
          color: vd.color?.trim() || null,
          fuel_type: vd.fuel_type || undefined,
          vehicle_type: vd.vehicle_type || undefined,
          vehicle_source: vd.vehicle_source ?? "lender_stock",
          chassis_no: vd.chassis_no?.trim() || null,
          engine_no: vd.engine_no?.trim() || null,
          purchase_date: vd.purchase_date?.trim() || null,
          consultancy: vd.consultancy || null,
          sale_price: vd.sale_price ? String(Number(vd.sale_price).toFixed(2)) : null,
          vehicle_cost: vd.vehicle_cost ? String(Number(vd.vehicle_cost).toFixed(2)) : undefined,
        });

        if (vd.vehicle_cost && vehicle.id) {
          await createCostIncurred({
            vehicle_id: vehicle.id,
            cost_type: "purchasing_cost",
            cost: String(Number(vd.vehicle_cost).toFixed(2)),
            service_date: vd.purchase_date || new Date().toISOString().split("T")[0],
            description: "Vehicle purchase cost",
          });
        }
        vehicleId = vehicle.id!;
      }

      // 4. Create loan
      return createLoan({
        customer_id: customerId,
        vehicle_id: vehicleId,
        guarantor_id: guarantorId,
        loan_type: loan.loan_type,
        interest_split_method: loan.interest_split_method,
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
      queryClient.invalidateQueries({ queryKey: ["persons"] });
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

  const handleCustomerNext = (data: PersonValues) => {
    setCustomerData(data);
    setStep(2);
  };

  const handleStep1Next = () => {
    if (existingCustomer) {
      setStep(2);
    } else {
      customerForm.handleSubmit(handleCustomerNext)();
    }
  };

  const handleGuarantorNext = (data: PersonValues) => {
    setGuarantorData(data);
    setStep(3);
  };

  const handleStep2Next = () => {
    if (existingGuarantor) {
      setStep(3);
    } else {
      guarantorForm.handleSubmit(handleGuarantorNext)();
    }
  };

  const handleGuarantorSkip = () => {
    setGuarantorData(undefined);
    setExistingGuarantor(null);
    setStep(3);
  };

  const handleVehicleNext = (data: VehicleValues) => {
    setVehicleData(data);
    const loanType = data.vehicle_source === "external_collateral" ? "external_purchase" : "vehicle_sale";
    loanForm.setValue("loan_type", loanType);
    setStep(4);
  };

  const handleVehicleStepNext = () => {
    if (existingVehicle) {
      // Auto-set loan type from existing vehicle's source
      const loanType = existingVehicle.vehicle_source === "external_collateral" ? "external_purchase" : "vehicle_sale";
      loanForm.setValue("loan_type", loanType);
      setStep(4);
    } else {
      vehicleForm.handleSubmit(handleVehicleNext)();
    }
  };

  // For review: resolve the display object regardless of new/existing path
  const reviewCustomer = existingCustomer ?? customerData;
  const reviewGuarantor = existingGuarantor ?? (guarantorData !== undefined ? guarantorData : undefined);

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
          <CardContent className="space-y-4">
            {existingCustomer ? (
              <ExistingPersonBanner
                person={existingCustomer}
                onClear={() => setExistingCustomer(null)}
              />
            ) : (
              <PersonFields
                form={customerForm}
                onExistingSelected={(p) => {
                  setExistingCustomer(p);
                  setCustomerData(null);
                }}
              />
            )}
            <Button onClick={handleStep1Next}>Next →</Button>
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Guarantor (optional) ──────────────────────────────────────── */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2 — Guarantor Information</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              A guarantor is registered as a person record and linked to this loan.
              Skip if no guarantor is required.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {existingGuarantor ? (
              <ExistingPersonBanner
                person={existingGuarantor}
                onClear={() => setExistingGuarantor(null)}
              />
            ) : (
              <PersonFields
                form={guarantorForm}
                onExistingSelected={(p) => {
                  setExistingGuarantor(p);
                  setGuarantorData(null);
                }}
              />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>← Back</Button>
              <Button onClick={handleStep2Next}>Save Guarantor & Next →</Button>
              <Button type="button" variant="ghost" onClick={handleGuarantorSkip}>
                Skip (No Guarantor)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 3: Vehicle ───────────────────────────────────────────────────── */}
      {step === 3 && (
        <Card>
          <CardHeader><CardTitle>Step 3 — Vehicle Information</CardTitle></CardHeader>
          <CardContent>
            {existingVehicle ? (
              <div className="space-y-4">
                <ExistingVehicleBanner
                  vehicle={existingVehicle}
                  onClear={() => { setExistingVehicle(null); setRegNoSearch(""); setVehicleMatches([]); }}
                />
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setStep(2)}>← Back</Button>
                  <Button onClick={handleVehicleStepNext}>Next →</Button>
                </div>
              </div>
            ) : (
            <form onSubmit={vehicleForm.handleSubmit(handleVehicleNext)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Registration No *</Label>
                  <Input
                    {...vehicleForm.register("registration_no")}
                    onBlur={(e) => {
                      vehicleForm.register("registration_no").onBlur(e);
                      const val = e.target.value.trim();
                      if (val.length >= 3) setRegNoSearch(val);
                    }}
                    placeholder="TN01AB1234"
                    className="uppercase"
                  />
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
            )}

            <VehicleMatchDialog
              open={vehicleMatches.length > 0}
              vehicles={vehicleMatches}
              onSelect={(v) => {
                setExistingVehicle(v);
                setVehicleMatches([]);
                setRegNoSearch("");
              }}
              onDismiss={() => { setVehicleMatches([]); setRegNoSearch(""); }}
            />
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

                <div className="col-span-2 space-y-1">
                  <Label>Amortization Method</Label>
                  <Select
                    value={s2.interest_split_method}
                    onValueChange={(v) => loanForm.setValue("interest_split_method", v as LoanValues["interest_split_method"])}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="reducing_balance">Reducing Balance (Actuarial)</SelectItem>
                      <SelectItem value="equal">Equal — Flat Rate</SelectItem>
                      <SelectItem value="rule_of_78">Rule of 78 — Sum-of-Digits</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Cannot be changed after the loan is activated.</p>
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
      {step === 5 && reviewCustomer && (existingVehicle || vehicleData) && (
        <Card>
          <CardHeader><CardTitle>Step 5 — Review & Submit</CardTitle></CardHeader>
          <CardContent className="space-y-5">

            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Customer</h3>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div><dt className="text-muted-foreground">Name</dt><dd className="font-medium">{reviewCustomer.full_name}</dd></div>
                <div><dt className="text-muted-foreground">Phone</dt><dd>{reviewCustomer.phone}{reviewCustomer.alt_phone ? ` / ${reviewCustomer.alt_phone}` : ""}</dd></div>
                <div><dt className="text-muted-foreground">ID</dt><dd>{ID_TYPE_LABELS[reviewCustomer.id_type ?? ""] ?? reviewCustomer.id_type} · {reviewCustomer.id_number}</dd></div>
                {reviewCustomer.city && (
                  <div><dt className="text-muted-foreground">City</dt><dd>{reviewCustomer.city}{reviewCustomer.state ? `, ${reviewCustomer.state}` : ""}</dd></div>
                )}
                {existingCustomer && <div className="col-span-2"><dd className="text-xs text-primary">Existing person record</dd></div>}
              </dl>
            </div>

            <hr />

            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Guarantor</h3>
              {reviewGuarantor ? (
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div><dt className="text-muted-foreground">Name</dt><dd className="font-medium">{reviewGuarantor.full_name}</dd></div>
                  <div><dt className="text-muted-foreground">Phone</dt><dd>{reviewGuarantor.phone}{reviewGuarantor.alt_phone ? ` / ${reviewGuarantor.alt_phone}` : ""}</dd></div>
                  <div><dt className="text-muted-foreground">ID</dt><dd>{ID_TYPE_LABELS[reviewGuarantor.id_type ?? ""] ?? reviewGuarantor.id_type} · {reviewGuarantor.id_number}</dd></div>
                  {reviewGuarantor.city && (
                    <div><dt className="text-muted-foreground">City</dt><dd>{reviewGuarantor.city}{reviewGuarantor.state ? `, ${reviewGuarantor.state}` : ""}</dd></div>
                  )}
                  {existingGuarantor && <div className="col-span-2"><dd className="text-xs text-primary">Existing person record</dd></div>}
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground italic">No guarantor — skipped</p>
              )}
            </div>

            <hr />

            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Vehicle</h3>
              {existingVehicle ? (
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div><dt className="text-muted-foreground">Reg No</dt><dd className="font-mono">{existingVehicle.registration_no}</dd></div>
                  <div><dt className="text-muted-foreground">Vehicle</dt><dd>{existingVehicle.make} {existingVehicle.model} ({existingVehicle.year})</dd></div>
                  {existingVehicle.color && <div><dt className="text-muted-foreground">Color</dt><dd>{existingVehicle.color}</dd></div>}
                  {existingVehicle.vehicle_source && (
                    <div><dt className="text-muted-foreground">Source</dt><dd><StatusBadge status={existingVehicle.vehicle_source} /></dd></div>
                  )}
                  {existingVehicle.current_status && (
                    <div><dt className="text-muted-foreground">Status</dt><dd><StatusBadge status={existingVehicle.current_status} /></dd></div>
                  )}
                  <div className="col-span-2"><dd className="text-xs text-primary">Existing vehicle record</dd></div>
                </dl>
              ) : vehicleData && (
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
              )}
            </div>

            <hr />

            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Loan</h3>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div><dt className="text-muted-foreground">Loan Type</dt><dd><StatusBadge status={s2.loan_type} /></dd></div>
                <div><dt className="text-muted-foreground">Amortization</dt><dd className="capitalize">{(s2.interest_split_method ?? "reducing_balance").replace(/_/g, " ")}</dd></div>
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
                Creating {existingCustomer ? "" : "customer, "}{existingGuarantor ? "" : reviewGuarantor ? "guarantor, " : ""}vehicle and loan record…
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
