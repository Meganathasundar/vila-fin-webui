import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { toast } from "sonner";
import { createCostIncurred, getCostIncurred, updateCostIncurred } from "@/api/costsIncurred";
import type { CostIncurredCreate, CostIncurredUpdate } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/PageHeader";
import { LookupSelectField } from "@/components/shared/LookupSelectField";

// ── Form schema ────────────────────────────────────────────────────────────────

const schema = z.object({
  vehicle_id: z.string().min(1, "Required"),
  cost_type: z.string().min(1, "Required"),
  description: z.string().optional(),
  cost: z.coerce.number().positive("Must be positive"),
  service_date: z.string().min(1, "Required"),
  // garage is x-field-type: lookup, x-lookup-list: garage
  garage: z.string().nullable().optional(),
  odometer_reading: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().int().nonnegative().optional()
  ),
});

type FormValues = z.infer<typeof schema>;

export default function CostIncurredForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const vehicleIdFromUrl = searchParams.get("vehicle_id") ?? "";
  const isEdit = !!id;

  // Fetch existing record when editing
  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ["costs-incurred", id],
    queryFn: () => getCostIncurred(id!),
    enabled: isEdit,
  });

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      vehicle_id: vehicleIdFromUrl,
      service_date: new Date().toISOString().split("T")[0],
    },
  });

  const costType = watch("cost_type");
  const garage = watch("garage");

  // Pre-fill form once existing record is loaded
  useEffect(() => {
    if (existing) {
      reset({
        vehicle_id: existing.vehicle_id,
        cost_type: existing.cost_type,
        description: existing.description ?? "",
        cost: parseFloat(existing.cost),
        service_date: existing.service_date,
        garage: existing.garage ?? null,
        odometer_reading: existing.odometer_reading ?? undefined,
      });
    }
  }, [existing, reset]);

  // Auto-fill vehicle_id from URL when creating
  useEffect(() => {
    if (!isEdit && vehicleIdFromUrl) setValue("vehicle_id", vehicleIdFromUrl);
  }, [vehicleIdFromUrl, setValue, isEdit]);

  const buildCreatePayload = (data: FormValues): CostIncurredCreate => ({
    vehicle_id: data.vehicle_id,
    cost_type: data.cost_type,
    cost: Number(data.cost).toFixed(2),
    service_date: data.service_date,
    ...(data.description?.trim() ? { description: data.description.trim() } : {}),
    ...(data.garage ? { garage: data.garage } : {}),
    ...(data.odometer_reading !== undefined ? { odometer_reading: data.odometer_reading } : {}),
  });

  const buildUpdatePayload = (data: FormValues): CostIncurredUpdate => ({
    cost_type: data.cost_type,
    cost: Number(data.cost).toFixed(2),
    service_date: data.service_date,
    ...(data.description?.trim() ? { description: data.description.trim() } : {}),
    garage: data.garage ?? null,
    ...(data.odometer_reading !== undefined ? { odometer_reading: data.odometer_reading } : {}),
  });

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      isEdit
        ? updateCostIncurred(id!, buildUpdatePayload(data))
        : createCostIncurred(buildCreatePayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["costs-incurred"] });
      toast.success(isEdit ? "Cost updated successfully" : "Cost logged successfully");
      navigate(-1);
    },
    onError: () => toast.error(isEdit ? "Failed to update cost." : "Failed to log cost."),
  });

  if (isEdit && loadingExisting) {
    return (
      <div className="max-w-lg space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <PageHeader title={isEdit ? "Edit Cost" : "Log Cost Incurred"} />
      <Card>
        <CardHeader>
          <CardTitle>{isEdit ? "Update Cost Details" : "Cost Details"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            {/* Vehicle ID */}
            <div className="space-y-1">
              <Label>Vehicle ID *</Label>
              <Input
                {...register("vehicle_id")}
                placeholder="Vehicle UUID"
                disabled={isEdit}
                className={isEdit ? "bg-muted" : ""}
              />
              {errors.vehicle_id && <p className="text-xs text-destructive">{errors.vehicle_id.message}</p>}
              {!isEdit && (
                <p className="text-xs text-muted-foreground">Tip: open this form from a vehicle's detail page to auto-fill.</p>
              )}
            </div>

            {/* Cost Type — x-field-type: lookup, x-lookup-list: cost_type */}
            <div className="space-y-1">
              <Label>Cost Type *</Label>
              <LookupSelectField
                listCode="cost_type"
                value={costType}
                onChange={(v) => setValue("cost_type", v ?? "")}
                placeholder="Select…"
              />
              {errors.cost_type && <p className="text-xs text-destructive">{errors.cost_type.message}</p>}
            </div>

            {/* Description */}
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea {...register("description")} rows={2} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Cost */}
              <div className="space-y-1">
                <Label>Cost (₹) *</Label>
                <Input type="number" step="0.01" {...register("cost")} />
                {errors.cost && <p className="text-xs text-destructive">{errors.cost.message}</p>}
              </div>

              {/* Service Date */}
              <div className="space-y-1">
                <Label>Date *</Label>
                <Input type="date" {...register("service_date")} />
                {errors.service_date && <p className="text-xs text-destructive">{errors.service_date.message}</p>}
              </div>

              {/* Garage — x-field-type: lookup, x-lookup-list: garage */}
              <div className="space-y-1 col-span-2">
                <Label>Garage</Label>
                <LookupSelectField
                  listCode="garage"
                  value={garage}
                  onChange={(v) => setValue("garage", v)}
                  placeholder="Select garage…"
                  allowNone
                />
                <p className="text-xs text-muted-foreground">
                  Manage garages in{" "}
                  <a href="/lookups" className="text-primary hover:underline">Lookups →</a>
                </p>
              </div>

              {/* Odometer */}
              <div className="space-y-1">
                <Label>Odometer (km)</Label>
                <Input type="number" {...register("odometer_reading")} />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving…" : isEdit ? "Update Cost" : "Log Cost"}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
