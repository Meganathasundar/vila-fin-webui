import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { createPerson, updatePerson, listPersons } from "@/api/persons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PersonMatchDialog } from "@/components/shared/PersonMatchDialog";
import { usePermission } from "@/hooks/usePermission";
import type { Person } from "@/types/api";

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

interface PersonFormProps {
  person?: Person;
  onSuccess?: (person: Person) => void;
}

function dedupePersons(list: Person[]): Person[] {
  return Array.from(new Map(list.map((p) => [p.id, p])).values());
}

export function PersonForm({ person, onSuccess }: PersonFormProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canEditKyc = usePermission("edit_kyc_status");
  const isEdit = !!person;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: person
      ? {
          full_name: person.full_name,
          phone: person.phone,
          alt_phone: person.alt_phone,
          address: person.address,
          city: person.city,
          state: person.state,
          pincode: person.pincode,
          id_type: person.id_type,
          id_number: person.id_number,
          kyc_status: person.kyc_status,
        }
      : { kyc_status: "pending" },
  });

  // ── Duplicate lookup (create mode only) ──────────────────────────────────────
  const [phoneSearch, setPhoneSearch] = useState("");
  const [idSearch, setIdSearch] = useState({ id_type: "", id_number: "" });
  const [matchedPersons, setMatchedPersons] = useState<Person[]>([]);

  const { data: phoneData } = useQuery({
    queryKey: ["persons-lookup", "phone", phoneSearch],
    queryFn: () => listPersons({ phone: phoneSearch, limit: 5 }),
    enabled: !isEdit && phoneSearch.length >= 6,
    staleTime: 60_000,
  });

  const { data: idData } = useQuery({
    queryKey: ["persons-lookup", "id", idSearch.id_type, idSearch.id_number],
    queryFn: () => listPersons({ id_type: idSearch.id_type, id_number: idSearch.id_number, limit: 5 }),
    enabled: !isEdit && !!(idSearch.id_type && idSearch.id_number.length >= 3),
    staleTime: 60_000,
  });

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
    register("phone").onBlur(e);
    const val = e.target.value.trim();
    if (!isEdit && val.length >= 6) setPhoneSearch(val);
  };

  const handleIdTypeChange = (v: string) => {
    setValue("id_type", v as FormValues["id_type"]);
    if (!isEdit) {
      const id_number = watch("id_number") ?? "";
      if (id_number.length >= 3) setIdSearch({ id_type: v, id_number });
    }
  };

  const handleIdNumberBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    register("id_number").onBlur(e);
    if (!isEdit) {
      const id_number = e.target.value.trim();
      const id_type = watch("id_type") ?? "";
      if (id_type && id_number.length >= 3) setIdSearch({ id_type, id_number });
    }
  };

  // Navigate to existing person instead of creating a duplicate
  const handleExistingSelected = (p: Person) => {
    clearSearch();
    navigate(`/persons/${p.id}`);
  };

  // ── Save mutation ────────────────────────────────────────────────────────────

  const idType = watch("id_type");

  const mutation = useMutation({
    mutationFn: (data: FormValues) => {
      if (isEdit && person.id) {
        return updatePerson(person.id, { ...data, kyc_status: data.kyc_status ?? "pending" } as Parameters<typeof updatePerson>[1]);
      }
      return createPerson(data as Parameters<typeof createPerson>[0]);
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["persons"] });
      toast.success(isEdit ? "Person updated successfully" : "Person created successfully");
      if (onSuccess) {
        onSuccess(saved);
      } else {
        navigate(`/persons/${saved.id}`);
      }
    },
    onError: (err: { response?: { status?: number } }) => {
      if (err?.response?.status === 409) {
        toast.error("Phone number or ID document already registered for another person.");
      } else {
        toast.error("Failed to save person.");
      }
    },
  });

  return (
    <>
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4 max-w-lg">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1">
            <Label>Full Name *</Label>
            <Input {...register("full_name")} />
            {errors.full_name && <p className="text-xs text-destructive">{errors.full_name.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Phone *</Label>
            <Input {...register("phone")} type="tel" onBlur={handlePhoneBlur} />
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
            <Select value={idType} onValueChange={handleIdTypeChange}>
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
            <Input {...register("id_number")} onBlur={handleIdNumberBlur} />
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
                <p className="text-sm capitalize py-2">{person?.kyc_status ?? "pending"}</p>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={isSubmitting || mutation.isPending}>
            {mutation.isPending ? "Saving…" : isEdit ? "Update Person" : "Create Person"}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
        </div>
      </form>

      <PersonMatchDialog
        open={matchedPersons.length > 0}
        persons={matchedPersons}
        onSelect={handleExistingSelected}
        onDismiss={clearSearch}
      />
    </>
  );
}

// Backward-compat alias
export { PersonForm as CustomerForm };
