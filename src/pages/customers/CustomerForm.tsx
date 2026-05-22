import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { createCustomer, updateCustomer } from "@/api/customers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermission } from "@/hooks/usePermission";
import type { Customer } from "@/types/api";

const schema = z.object({
  full_name: z.string().min(1, "Required"),
  phone: z.string().length(10, "Must be 10 digits").regex(/^\d+$/, "Digits only"),
  alt_phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  id_type: z.enum(["aadhaar", "pan", "passport", "driving_licence", "voter_id"]),
  id_number: z.string().min(1, "Required"),
  kyc_status: z.enum(["pending", "uploaded", "verified", "rejected"]).optional(),
});

type FormValues = z.infer<typeof schema>;

interface CustomerFormProps {
  customer?: Customer;
  onSuccess?: (customer: Customer) => void;
}

export function CustomerForm({ customer, onSuccess }: CustomerFormProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canEditKyc = usePermission("edit_kyc_status");
  const isEdit = !!customer;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: customer
      ? {
          full_name: customer.full_name,
          phone: customer.phone,
          alt_phone: customer.alt_phone,
          address: customer.address,
          city: customer.city,
          state: customer.state,
          pincode: customer.pincode,
          id_type: customer.id_type,
          id_number: customer.id_number,
          kyc_status: customer.kyc_status,
        }
      : { kyc_status: "pending" },
  });

  const idType = watch("id_type");

  const mutation = useMutation({
    mutationFn: (data: FormValues) => {
      if (isEdit && customer.id) {
        return updateCustomer(customer.id, { ...data, kyc_status: data.kyc_status ?? "pending" } as Parameters<typeof updateCustomer>[1]);
      }
      return createCustomer(data as Parameters<typeof createCustomer>[0]);
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success(isEdit ? "Customer updated successfully" : "Customer created successfully");
      if (onSuccess) {
        onSuccess(saved);
      } else {
        navigate(`/customers/${saved.id}`);
      }
    },
    onError: () => {
      toast.error("Failed to save customer");
    },
  });

  const onSubmit = (data: FormValues) => {
    mutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-lg">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1">
          <Label>Full Name *</Label>
          <Input {...register("full_name")} />
          {errors.full_name && <p className="text-xs text-destructive">{errors.full_name.message}</p>}
        </div>
        <div className="space-y-1">
          <Label>Phone *</Label>
          <Input {...register("phone")} type="tel" />
          {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
        </div>
        <div className="space-y-1">
          <Label>Alt Phone</Label>
          <Input {...register("alt_phone")} type="tel" />
        </div>
        <div className="col-span-2 space-y-1">
          <Label>Address</Label>
          <Input {...register("address")} />
        </div>
        <div className="space-y-1">
          <Label>City</Label>
          <Input {...register("city")} />
        </div>
        <div className="space-y-1">
          <Label>State</Label>
          <Input {...register("state")} />
        </div>
        <div className="space-y-1">
          <Label>Pincode</Label>
          <Input {...register("pincode")} />
        </div>
        <div className="space-y-1">
          <Label>ID Type *</Label>
          <Select value={idType} onValueChange={(v) => setValue("id_type", v as FormValues["id_type"])}>
            <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="aadhaar">Aadhaar</SelectItem>
              <SelectItem value="pan">PAN</SelectItem>
              <SelectItem value="passport">Passport</SelectItem>
              <SelectItem value="driving_licence">Driving Licence</SelectItem>
              <SelectItem value="voter_id">Voter ID</SelectItem>
            </SelectContent>
          </Select>
          {errors.id_type && <p className="text-xs text-destructive">{errors.id_type.message}</p>}
        </div>
        <div className="space-y-1">
          <Label>ID Number *</Label>
          <Input {...register("id_number")} />
          {errors.id_number && <p className="text-xs text-destructive">{errors.id_number.message}</p>}
        </div>
        {isEdit && (
          <div className="space-y-1">
            <Label>KYC Status</Label>
            {canEditKyc ? (
              <Select
                value={watch("kyc_status")}
                onValueChange={(v) => setValue("kyc_status", v as FormValues["kyc_status"])}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="uploaded">Uploaded</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm capitalize py-2">{customer?.kyc_status ?? "pending"}</p>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={isSubmitting || mutation.isPending}>
          {mutation.isPending ? "Saving…" : isEdit ? "Update Customer" : "Create Customer"}
        </Button>
        <Button type="button" variant="outline" onClick={() => navigate(-1)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
