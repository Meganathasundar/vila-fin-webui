import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { createVehicle, updateVehicle, createVehiclePurchase } from "@/api/vehicles";
import { createCostIncurred } from "@/api/costsIncurred";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LookupSelectField } from "@/components/shared/LookupSelectField";
import type { Vehicle } from "@/types/api";

const vehicleSchema = z.object({
  registration_no: z.string().min(1, "Required"),
  make: z.string().min(1, "Required"),
  model: z.string().min(1, "Required"),
  year: z.coerce.number().int().min(1980, "Year must be 1980 or later").max(2100),
  color: z.string().optional(),
  fuel_type: z.enum(["petrol", "diesel", "electric", "hybrid", "cng", "other"]).optional(),
  vehicle_type: z.enum(["two_wheeler", "four_wheeler", "commercial"]).optional(),
  chassis_no: z.string().optional(),
  engine_no: z.string().optional(),
});

// Purchase fields only used on create
const createSchema = vehicleSchema.extend({
  vehicle_cost: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().positive("Must be a positive amount").optional()
  ),
  purchase_date: z.string().optional(),
  consultancy: z.string().nullable().optional(),
  asking_price: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().positive("Must be a positive amount").optional()
  ),
  final_price: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().positive("Must be a positive amount").optional()
  ),
});

type CreateFormValues = z.infer<typeof createSchema>;
type EditFormValues = z.infer<typeof vehicleSchema>;

interface VehicleFormProps {
  vehicle?: Vehicle;
  onSuccess?: (vehicle: Vehicle) => void;
  onCancel?: () => void;
}

export function VehicleForm({ vehicle, onSuccess, onCancel }: VehicleFormProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!vehicle;

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<CreateFormValues>({
    resolver: zodResolver(isEdit ? vehicleSchema : createSchema),
    defaultValues: vehicle
      ? {
          registration_no: vehicle.registration_no,
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
          color: vehicle.color ?? undefined,
          fuel_type: vehicle.fuel_type ?? undefined,
          vehicle_type: vehicle.vehicle_type ?? undefined,
          chassis_no: vehicle.chassis_no ?? undefined,
          engine_no: vehicle.engine_no ?? undefined,

        }
      : {
          purchase_date: new Date().toISOString().split("T")[0],
        },
  });

  const mutation = useMutation({
    mutationFn: async (data: CreateFormValues) => {
      const vehiclePayload = {
        registration_no: data.registration_no,
        make: data.make,
        model: data.model,
        year: data.year,
        color: data.color?.trim() || null,
        chassis_no: data.chassis_no?.trim() || null,
        engine_no: data.engine_no?.trim() || null,
        fuel_type: data.fuel_type,
        vehicle_type: data.vehicle_type,

      };

      if (isEdit && vehicle.id) {
        return updateVehicle(vehicle.id, {
          ...vehiclePayload,
          current_status: vehicle.current_status ?? "available",
        });
      }

      const saved = await createVehicle(vehiclePayload);

      // Post purchase sub-resource if any purchase data provided
      const hasPurchaseData = data.vehicle_cost || data.purchase_date || data.consultancy || data.asking_price || data.final_price;
      if (saved.id && hasPurchaseData) {
        await createVehiclePurchase(saved.id, {
          vehicle_cost: data.vehicle_cost ? String(Number(data.vehicle_cost).toFixed(2)) : null,
          purchase_date: data.purchase_date?.trim() || null,
          consultancy: data.consultancy || null,
          asking_price: data.asking_price ? String(Number(data.asking_price).toFixed(2)) : null,
          final_price: data.final_price ? String(Number(data.final_price).toFixed(2)) : null,
        });
      }

      // Auto-log purchasing_cost entry if vehicle_cost provided
      if (data.vehicle_cost && saved.id) {
        await createCostIncurred({
          vehicle_id: saved.id,
          cost_type: "purchasing_cost",
          cost: String(Number(data.vehicle_cost).toFixed(2)),
          service_date: data.purchase_date || new Date().toISOString().split("T")[0],
          description: "Vehicle purchase cost",
        });
      }

      return saved;
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["costs-incurred"] });
      toast.success(isEdit ? "Vehicle updated" : "Vehicle created");
      if (onSuccess) onSuccess(saved);
      else navigate(`/vehicles/${saved.id}`);
    },
    onError: (err: { response?: { status?: number } }) => {
      if (err?.response?.status === 409) {
        toast.error("A vehicle with that registration/chassis/engine number already exists.");
      } else {
        toast.error("Failed to save vehicle.");
      }
    },
  });

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4 max-w-lg">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Registration No *</Label>
          <Input {...register("registration_no")} disabled={isEdit} className={isEdit ? "bg-muted" : ""} />
          {errors.registration_no && <p className="text-xs text-destructive">{errors.registration_no.message}</p>}
        </div>
        <div className="space-y-1">
          <Label>Make *</Label>
          <Input {...register("make")} />
          {errors.make && <p className="text-xs text-destructive">{errors.make.message}</p>}
        </div>
        <div className="space-y-1">
          <Label>Model *</Label>
          <Input {...register("model")} />
          {errors.model && <p className="text-xs text-destructive">{errors.model.message}</p>}
        </div>
        <div className="space-y-1">
          <Label>Year *</Label>
          <Input {...register("year")} type="number" />
          {errors.year && <p className="text-xs text-destructive">{errors.year.message}</p>}
        </div>
        <div className="space-y-1">
          <Label>Color</Label>
          <Input {...register("color")} />
        </div>
        <div className="space-y-1">
          <Label>Fuel Type</Label>
          <Select value={watch("fuel_type")} onValueChange={(v) => setValue("fuel_type", v as CreateFormValues["fuel_type"])}>
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
          <Select value={watch("vehicle_type")} onValueChange={(v) => setValue("vehicle_type", v as CreateFormValues["vehicle_type"])}>
            <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="two_wheeler">Two Wheeler</SelectItem>
              <SelectItem value="four_wheeler">Four Wheeler</SelectItem>
              <SelectItem value="commercial">Commercial</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Chassis No</Label>
          <Input {...register("chassis_no")} />
          {errors.chassis_no && <p className="text-xs text-destructive">{errors.chassis_no.message}</p>}
        </div>
        <div className="space-y-1">
          <Label>Engine No</Label>
          <Input {...register("engine_no")} />
          {errors.engine_no && <p className="text-xs text-destructive">{errors.engine_no.message}</p>}
        </div>

        {/* Purchase details — only on create */}
        {!isEdit && (
          <>
            <div className="col-span-2 pt-2 border-t">
              <p className="text-sm font-medium text-muted-foreground">Purchase Details (optional)</p>
            </div>
            <div className="space-y-1">
              <Label>Consultancy Agency</Label>
              <LookupSelectField
                listCode="vehicle_consultancy"
                value={watch("consultancy")}
                onChange={(v) => setValue("consultancy", v)}
                placeholder="Select consultancy…"
                allowNone
              />
              <p className="text-xs text-muted-foreground">
                Manage in <a href="/lookups" className="text-primary hover:underline">Lookups →</a>
              </p>
            </div>
            <div className="space-y-1">
              <Label>Purchase Date</Label>
              <Input type="date" {...register("purchase_date")} />
              <p className="text-xs text-muted-foreground">Date vehicle was acquired</p>
            </div>
            <div className="space-y-1">
              <Label>Vehicle Cost (₹)</Label>
              <Input {...register("vehicle_cost")} type="number" step="0.01" placeholder="e.g. 350000" />
              {errors.vehicle_cost && <p className="text-xs text-destructive">{errors.vehicle_cost.message}</p>}
              <p className="text-xs text-muted-foreground">Auto-logged as purchasing cost</p>
            </div>
            <div className="space-y-1">
              <Label>Asking Price (₹)</Label>
              <Input {...register("asking_price")} type="number" step="0.01" placeholder="e.g. 380000.00" />
              {errors.asking_price && <p className="text-xs text-destructive">{errors.asking_price.message}</p>}
              <p className="text-xs text-muted-foreground">Listed asking price to the customer</p>
            </div>
            <div className="space-y-1">
              <Label>Final Price (₹)</Label>
              <Input {...register("final_price")} type="number" step="0.01" placeholder="e.g. 370000.00" />
              {errors.final_price && <p className="text-xs text-destructive">{errors.final_price.message}</p>}
              <p className="text-xs text-muted-foreground">Final negotiated price</p>
            </div>
          </>
        )}
      </div>
      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : isEdit ? "Update Vehicle" : "Create Vehicle"}
        </Button>
        <Button type="button" variant="outline" onClick={() => onCancel ? onCancel() : navigate(-1)}>Cancel</Button>
      </div>
    </form>
  );
}
