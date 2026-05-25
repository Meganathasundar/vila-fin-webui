import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Building2 } from "lucide-react";
import { toast } from "sonner";
import { getLookupList, createLookupList, createLookupValue, updateLookupValue } from "@/api/lookups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import { usePermission } from "@/hooks/usePermission";
import type { LookupValueSummary, GarageMeta } from "@/types/api";

const LOOKUP_CODE = "garage";

// ── Form schema ────────────────────────────────────────────────────────────

const garageSchema = z.object({
  code: z.string()
    .min(1, "Required")
    .regex(/^[a-z0-9_]+$/, "Only lowercase letters, numbers and underscores"),
  label: z.string().min(1, "Required"),
  address: z.string().optional(),
  city: z.string().optional(),
  phone: z.string().optional(),
  is_active: z.boolean().default(true),
});

type GarageFormValues = z.infer<typeof garageSchema>;

// ── Sub-components ─────────────────────────────────────────────────────────

function GarageForm({
  initial,
  isEdit,
  onSubmit,
  onCancel,
  isPending,
}: {
  initial?: GarageFormValues;
  isEdit: boolean;
  onSubmit: (v: GarageFormValues) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<GarageFormValues>({
    resolver: zodResolver(garageSchema),
    defaultValues: initial ?? { is_active: true },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Code *</Label>
          <Input {...register("code")} disabled={isEdit} className={isEdit ? "bg-muted" : ""} placeholder="sri_murugan_motors" />
          {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
          {!isEdit && <p className="text-xs text-muted-foreground">Unique ID, can't be changed later</p>}
        </div>
        <div className="space-y-1">
          <Label>Name *</Label>
          <Input {...register("label")} placeholder="Sri Murugan Motors" />
          {errors.label && <p className="text-xs text-destructive">{errors.label.message}</p>}
        </div>
        <div className="space-y-1 col-span-2">
          <Label>Address</Label>
          <Input {...register("address")} placeholder="12 Main Street" />
        </div>
        <div className="space-y-1">
          <Label>City</Label>
          <Input {...register("city")} placeholder="Chennai" />
        </div>
        <div className="space-y-1">
          <Label>Phone</Label>
          <Input {...register("phone")} placeholder="9876543210" />
        </div>
        {isEdit && (
          <div className="space-y-1 col-span-2">
            <Label>Status</Label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" {...register("is_active")} className="accent-primary" />
              Active (visible in dropdowns)
            </label>
          </div>
        )}
      </div>
      <DialogFooter className="pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : isEdit ? "Update Garage" : "Add Garage"}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function GarageManager() {
  const queryClient = useQueryClient();
  const canManage = usePermission("edit_vehicle"); // admin + manager
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LookupValueSummary | null>(null);

  const { data: lookupDetail, isLoading } = useQuery({
    queryKey: ["lookups", LOOKUP_CODE],
    queryFn: () => getLookupList(LOOKUP_CODE),
    // If the list doesn't exist yet (404), return empty gracefully
    retry: (failureCount, err: { response?: { status?: number } }) =>
      err?.response?.status === 404 ? false : failureCount < 2,
  });

  const garages: LookupValueSummary[] = lookupDetail?.data ?? [];

  // Ensure the lookup list exists (create on first use)
  const ensureList = async () => {
    if (!lookupDetail?.meta?.list && garages.length === 0) {
      await createLookupList({ code: LOOKUP_CODE, name: "Garages" });
      await queryClient.invalidateQueries({ queryKey: ["lookups", LOOKUP_CODE] });
    }
  };

  const addMutation = useMutation({
    mutationFn: async (values: GarageFormValues) => {
      await ensureList();
      return createLookupValue(LOOKUP_CODE, {
        code: values.code,
        label: values.label,
        meta: buildMeta(values),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lookups"] });
      toast.success("Garage added");
      setDialogOpen(false);
    },
    onError: () => toast.error("Failed to add garage."),
  });

  const editMutation = useMutation({
    mutationFn: (values: GarageFormValues) =>
      // Path now uses value code (not UUID)
      updateLookupValue(LOOKUP_CODE, editing!.code, {
        code: editing!.code,
        label: values.label,
        meta: buildMeta(values),
        is_active: values.is_active,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lookups"] });
      toast.success("Garage updated");
      setDialogOpen(false);
      setEditing(null);
    },
    onError: () => toast.error("Failed to update garage."),
  });

  function buildMeta(v: GarageFormValues): Record<string, string> {
    const meta: Record<string, string> = {};
    if (v.address?.trim()) meta.address = v.address.trim();
    if (v.city?.trim()) meta.city = v.city.trim();
    if (v.phone?.trim()) meta.phone = v.phone.trim();
    return Object.keys(meta).length ? meta : {};
  }

  function openAdd() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(g: LookupValueSummary) {
    setEditing(g);
    setDialogOpen(true);
  }

  const garageMeta = (g: LookupValueSummary): GarageMeta =>
    (g.meta ?? {}) as GarageMeta;

  const editInitial = editing
    ? {
        code: editing.code ?? "",
        label: editing.label ?? "",
        address: garageMeta(editing).address ?? "",
        city: garageMeta(editing).city ?? "",
        phone: garageMeta(editing).phone ?? "",
        is_active: editing.is_active !== false,
      }
    : undefined;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Garages"
        actions={
          canManage ? (
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-1" />Add Garage
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Garage List</CardTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            Garages available for selection when logging costs incurred.
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : garages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="mx-auto mb-3 h-10 w-10 opacity-30" />
              <p className="text-sm">No garages added yet.</p>
              {canManage && (
                <Button size="sm" variant="outline" className="mt-3" onClick={openAdd}>
                  <Plus className="h-4 w-4 mr-1" />Add First Garage
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {garages.map((g) => {
                const meta = garageMeta(g);
                return (
                  <div key={g.code} className="py-3 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{g.label}</span>
                        {g.is_active === false && (
                          <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Inactive</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 space-x-3">
                        {meta.address && <span>{meta.address}</span>}
                        {meta.city && <span>{meta.city}</span>}
                        {meta.phone && <span>📞 {meta.phone}</span>}
                        {!meta.address && !meta.city && !meta.phone && (
                          <span className="italic">No contact details</span>
                        )}
                      </div>
                    </div>
                    {canManage && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 shrink-0"
                        onClick={() => openEdit(g)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Garage" : "Add Garage"}</DialogTitle>
          </DialogHeader>
          <GarageForm
            key={editing?.code ?? "new"}
            initial={editInitial}
            isEdit={!!editing}
            onSubmit={(v) => editing ? editMutation.mutate(v) : addMutation.mutate(v)}
            onCancel={() => { setDialogOpen(false); setEditing(null); }}
            isPending={addMutation.isPending || editMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
