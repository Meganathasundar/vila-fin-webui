import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { createServiceExpense } from "@/api/serviceExpenses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";

const SERVICE_TYPES = ["maintenance", "repair", "insurance", "tax", "fitness_certificate", "pollution_check", "other"];

const schema = z.object({
  vehicle_id: z.string().min(1, "Required"),
  service_type: z.string().min(1, "Required"),
  description: z.string().optional(),
  cost: z.coerce.number().positive("Must be positive"),
  service_date: z.string().min(1, "Required"),
  garage_name: z.string().optional(),
  odometer_reading: z.coerce.number().int().nonnegative().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function ServiceExpenseForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const vehicleIdFromUrl = searchParams.get("vehicle_id") ?? "";

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      vehicle_id: vehicleIdFromUrl,
      service_date: new Date().toISOString().split("T")[0],
    },
  });

  const serviceType = watch("service_type");

  useEffect(() => {
    if (vehicleIdFromUrl) setValue("vehicle_id", vehicleIdFromUrl);
  }, [vehicleIdFromUrl, setValue]);

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      createServiceExpense({
        ...data,
        cost: String(data.cost),
        odometer_reading: data.odometer_reading,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-expenses"] });
      toast.success("Service expense logged successfully");
      navigate("/service-expenses");
    },
    onError: () => toast.error("Failed to log expense."),
  });

  return (
    <div className="max-w-lg">
      <PageHeader title="Log Service Expense" />
      <Card>
        <CardHeader><CardTitle>Expense Details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <div className="space-y-1">
              <Label>Vehicle ID *</Label>
              <Input {...register("vehicle_id")} placeholder="Vehicle UUID" />
              {errors.vehicle_id && <p className="text-xs text-destructive">{errors.vehicle_id.message}</p>}
              <p className="text-xs text-muted-foreground">Tip: open this form from a vehicle's detail page to auto-fill.</p>
            </div>

            <div className="space-y-1">
              <Label>Service Type *</Label>
              <Select value={serviceType} onValueChange={(v) => setValue("service_type", v)}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.service_type && <p className="text-xs text-destructive">{errors.service_type.message}</p>}
            </div>

            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea {...register("description")} rows={2} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Cost (₹) *</Label>
                <Input type="number" step="0.01" {...register("cost")} />
                {errors.cost && <p className="text-xs text-destructive">{errors.cost.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Service Date *</Label>
                <Input type="date" {...register("service_date")} />
                {errors.service_date && <p className="text-xs text-destructive">{errors.service_date.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Garage Name</Label>
                <Input {...register("garage_name")} />
              </div>
              <div className="space-y-1">
                <Label>Odometer (km)</Label>
                <Input type="number" {...register("odometer_reading")} />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving…" : "Log Expense"}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
