import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { createVehicle, updateVehicle } from "@/api/vehicles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Vehicle } from "@/types/api";

const schema = z.object({
  registration_no: z.string().min(1, "Required"),
  make: z.string().min(1, "Required"),
  model: z.string().min(1, "Required"),
  year: z.coerce.number().int().min(1900).max(2100),
  color: z.string().optional(),
  fuel_type: z.enum(["petrol", "diesel", "electric", "hybrid", "cng", "other"]).optional(),
  vehicle_type: z.string().optional(),
  chassis_no: z.string().min(1, "Required"),
  engine_no: z.string().min(1, "Required"),
  vehicle_source: z.enum(["lender_stock", "external_collateral"]).optional(),
});

type FormValues = z.infer<typeof schema>;

interface VehicleFormProps {
  vehicle?: Vehicle;
  onSuccess?: (vehicle: Vehicle) => void;
}

export function VehicleForm({ vehicle, onSuccess }: VehicleFormProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!vehicle;

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: vehicle
      ? {
          registration_no: vehicle.registration_no,
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
          color: vehicle.color,
          fuel_type: vehicle.fuel_type,
          vehicle_type: vehicle.vehicle_type,
          chassis_no: vehicle.chassis_no,
          engine_no: vehicle.engine_no,
          vehicle_source: vehicle.vehicle_source,
        }
      : { vehicle_source: "lender_stock" },
  });

  const mutation = useMutation({
    mutationFn: (data: FormValues) => {
      if (isEdit && vehicle.id) {
        return updateVehicle(vehicle.id, { ...data, current_status: vehicle.current_status ?? "available" } as Parameters<typeof updateVehicle>[1]);
      }
      return createVehicle(data as Parameters<typeof createVehicle>[0]);
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
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
          <Select value={watch("fuel_type")} onValueChange={(v) => setValue("fuel_type", v as FormValues["fuel_type"])}>
            <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              {["petrol","diesel","electric","hybrid","cng","other"].map((f) => (
                <SelectItem key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Vehicle Type</Label>
          <Select value={watch("vehicle_type")} onValueChange={(v) => setValue("vehicle_type", v)}>
            <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="two_wheeler">Two Wheeler</SelectItem>
              <SelectItem value="four_wheeler">Four Wheeler</SelectItem>
              <SelectItem value="commercial">Commercial</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {!isEdit && (
          <div className="space-y-1">
            <Label>Vehicle Source</Label>
            <Select value={watch("vehicle_source")} onValueChange={(v) => setValue("vehicle_source", v as FormValues["vehicle_source"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lender_stock">Lender Stock</SelectItem>
                <SelectItem value="external_collateral">External Collateral</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1">
          <Label>Chassis No *</Label>
          <Input {...register("chassis_no")} />
          {errors.chassis_no && <p className="text-xs text-destructive">{errors.chassis_no.message}</p>}
        </div>
        <div className="space-y-1">
          <Label>Engine No *</Label>
          <Input {...register("engine_no")} />
          {errors.engine_no && <p className="text-xs text-destructive">{errors.engine_no.message}</p>}
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : isEdit ? "Update Vehicle" : "Create Vehicle"}
        </Button>
        <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
      </div>
    </form>
  );
}
