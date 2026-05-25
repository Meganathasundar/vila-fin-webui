import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, ChevronDown, ChevronRight, Database } from "lucide-react";
import { toast } from "sonner";
import { getAllLookups, createLookupList, createLookupValue, updateLookupValue } from "@/api/lookups";
import { triggerLookupRefresh } from "@/utils/lookupSync";
import { useLookups } from "@/context/LookupContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermission } from "@/hooks/usePermission";

// ── Helpers ────────────────────────────────────────────────────────────────────

function codeToTitle(code: string): string {
  return code.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Form schemas ───────────────────────────────────────────────────────────────

const addValueSchema = z.object({
  code: z
    .string()
    .min(1, "Required")
    .regex(/^[a-z0-9_]+$/, "Lowercase letters, numbers and underscores only"),
  label: z.string().min(1, "Required"),
  sort_order: z.preprocess(
    (v) => (v === "" || v == null ? 0 : Number(v)),
    z.number().int().nonnegative()
  ),
});

const editValueSchema = z.object({
  label: z.string().min(1, "Required"),
  sort_order: z.preprocess(
    (v) => (v === "" || v == null ? 0 : Number(v)),
    z.number().int().nonnegative()
  ),
  is_active: z.boolean(),
});

const newListSchema = z.object({
  code: z
    .string()
    .min(1, "Required")
    .regex(/^[a-z0-9_]+$/, "Lowercase letters, numbers and underscores only"),
  name: z.string().min(1, "Required"),
  description: z.string().optional(),
});

type AddValueForm = z.infer<typeof addValueSchema>;
type EditValueForm = z.infer<typeof editValueSchema>;
type NewListForm = z.infer<typeof newListSchema>;

// ── Dialog: Add value ──────────────────────────────────────────────────────────

function AddValueDialog({
  listCode,
  onClose,
}: {
  listCode: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm<AddValueForm>({
    resolver: zodResolver(addValueSchema),
    defaultValues: { sort_order: 0 },
  });

  const mutation = useMutation({
    mutationFn: (data: AddValueForm) =>
      createLookupValue(listCode, {
        code: data.code,
        label: data.label,
        sort_order: data.sort_order,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-lookups"] });
      queryClient.invalidateQueries({ queryKey: ["lookup-detail", listCode] });
      triggerLookupRefresh();
      toast.success("Value added");
      onClose();
    },
    onError: (err: { response?: { status?: number } }) => {
      if (err?.response?.status === 409) toast.error("That code already exists in this list.");
      else toast.error("Failed to add value.");
    },
  });

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Code *</Label>
          <Input {...register("code")} placeholder="my_value" />
          {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
          <p className="text-xs text-muted-foreground">Unique, immutable after creation</p>
        </div>
        <div className="space-y-1">
          <Label>Label *</Label>
          <Input {...register("label")} placeholder="Display name" />
          {errors.label && <p className="text-xs text-destructive">{errors.label.message}</p>}
        </div>
        <div className="space-y-1">
          <Label>Sort Order</Label>
          <Input {...register("sort_order")} type="number" defaultValue={0} />
          {errors.sort_order && <p className="text-xs text-destructive">{errors.sort_order.message}</p>}
        </div>
      </div>
      <DialogFooter className="pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Adding…" : "Add Value"}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ── Dialog: Edit value ─────────────────────────────────────────────────────────

function EditValueDialog({
  listCode,
  valueCode,
  onClose,
}: {
  listCode: string;
  valueCode: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { getLookupValues } = useLookups();

  // Read from localStorage immediately — instant pre-fill, no loading
  const cached = getLookupValues(listCode).find((v) => v.code === valueCode);

  const { register, handleSubmit, formState: { errors } } = useForm<EditValueForm>({
    resolver: zodResolver(editValueSchema),
    // Bulk response only contains active values, so is_active defaults true
    values: cached
      ? {
          label: cached.label ?? "",
          sort_order: cached.sort_order ?? 0,
          is_active: cached.is_active !== false,
        }
      : undefined,
  });

  const mutation = useMutation({
    mutationFn: (data: EditValueForm) =>
      // Path now uses value code (not UUID)
      updateLookupValue(listCode, valueCode, {
        code: valueCode,
        label: data.label,
        sort_order: data.sort_order,
        is_active: data.is_active,
        meta: (cached?.meta as Record<string, string> | null) ?? null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-lookups"] });
      queryClient.invalidateQueries({ queryKey: ["lookup-detail", listCode] });
      triggerLookupRefresh();
      toast.success("Value updated");
      onClose();
    },
    onError: () => toast.error("Failed to update value."),
  });

  if (!cached) {
    return <p className="text-sm text-destructive py-2">Value not found in cache. Refresh the page and try again.</p>;
  }

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-3">
      <div className="space-y-1">
        <Label>Code</Label>
        <Input value={valueCode} disabled className="bg-muted font-mono text-sm" />
        <p className="text-xs text-muted-foreground">Immutable</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1 col-span-2">
          <Label>Label *</Label>
          <Input {...register("label")} />
          {errors.label && <p className="text-xs text-destructive">{errors.label.message}</p>}
        </div>
        <div className="space-y-1">
          <Label>Sort Order</Label>
          <Input {...register("sort_order")} type="number" />
          {errors.sort_order && <p className="text-xs text-destructive">{errors.sort_order.message}</p>}
        </div>
        <div className="space-y-1 flex flex-col justify-end">
          <label className="flex items-center gap-2 text-sm cursor-pointer pb-2">
            <input type="checkbox" {...register("is_active")} className="accent-primary" />
            Active (visible in dropdowns)
          </label>
        </div>
      </div>
      <DialogFooter className="pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save Changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ── Dialog: New lookup list ────────────────────────────────────────────────────

function NewListDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm<NewListForm>({
    resolver: zodResolver(newListSchema),
  });

  const mutation = useMutation({
    mutationFn: (data: NewListForm) =>
      createLookupList({
        code: data.code,
        name: data.name,
        description: data.description || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-lookups"] });
      triggerLookupRefresh();
      toast.success("Lookup list created");
      onClose();
    },
    onError: (err: { response?: { status?: number } }) => {
      if (err?.response?.status === 409) toast.error("A list with that code already exists.");
      else toast.error("Failed to create list.");
    },
  });

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Code *</Label>
          <Input {...register("code")} placeholder="vehicle_color" />
          {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
          <p className="text-xs text-muted-foreground">Unique identifier, immutable</p>
        </div>
        <div className="space-y-1">
          <Label>Name *</Label>
          <Input {...register("name")} placeholder="Vehicle Colors" />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-1 col-span-2">
          <Label>Description</Label>
          <Input {...register("description")} placeholder="Optional description" />
        </div>
      </div>
      <DialogFooter className="pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Creating…" : "Create List"}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ── Lookup list card ──────────────────────────────────────────────────────────

interface ListCardProps {
  code: string;
  values: { code: string; label: string; sort_order?: number }[];
  canManage: boolean;
  onAddValue: (listCode: string) => void;
  onEditValue: (listCode: string, valueCode: string) => void;
}

function ListCard({ code, values, canManage, onAddValue, onEditValue }: ListCardProps) {
  const [expanded, setExpanded] = useState(true);
  const ChevronIcon = expanded ? ChevronDown : ChevronRight;

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between gap-3">
          <button
            className="flex items-center gap-2 text-left hover:text-foreground transition-colors"
            onClick={() => setExpanded((e) => !e)}
          >
            <ChevronIcon className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="font-semibold text-sm">{codeToTitle(code)}</span>
            <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {code}
            </span>
            <Badge variant="outline" className="text-xs font-normal ml-1">
              {values.length} {values.length === 1 ? "value" : "values"}
            </Badge>
          </button>
          {canManage && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1 shrink-0"
              onClick={() => onAddValue(code)}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Value
            </Button>
          )}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 pb-3 px-4">
          {values.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-2">No values in this list.</p>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs w-8">#</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">Code</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">Label</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs w-20 text-center">Order</th>
                    {canManage && <th className="px-3 py-2 w-10" />}
                  </tr>
                </thead>
                <tbody>
                  {values.map((v, i) => (
                    <tr key={v.code} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2 text-xs text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2">
                        <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{v.code}</span>
                      </td>
                      <td className="px-3 py-2 text-sm">{v.label}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground text-center">{v.sort_order ?? 0}</td>
                      {canManage && (
                        <td className="px-3 py-2 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => onEditValue(code, v.code)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

type DialogState =
  | { type: "add"; listCode: string }
  | { type: "edit"; listCode: string; valueCode: string }
  | { type: "new-list" }
  | null;

export default function LookupManager() {
  const canManage = usePermission("edit_vehicle"); // admin + manager
  const [dialog, setDialog] = useState<DialogState>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["all-lookups"],
    queryFn: getAllLookups,
    staleTime: 30_000,
  });

  const lookups = data?.data?.lookups ?? {};
  const listCodes = Object.keys(lookups).sort();

  const closeDialog = () => setDialog(null);

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Lookups"
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setDialog({ type: "new-list" })}>
              <Plus className="h-4 w-4 mr-1" />
              New List
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : listCodes.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Database className="mx-auto mb-4 h-12 w-12 opacity-25" />
          <p className="font-medium">No lookup lists yet</p>
          {canManage && (
            <p className="text-sm mt-1">
              Create a list to start organising dynamic reference data.
            </p>
          )}
          {canManage && (
            <Button
              size="sm"
              variant="outline"
              className="mt-4"
              onClick={() => setDialog({ type: "new-list" })}
            >
              <Plus className="h-4 w-4 mr-1" />
              Create First List
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {listCodes.map((code) => (
            <ListCard
              key={code}
              code={code}
              values={lookups[code] ?? []}
              canManage={canManage}
              onAddValue={(c) => setDialog({ type: "add", listCode: c })}
              onEditValue={(c, v) => setDialog({ type: "edit", listCode: c, valueCode: v })}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <Dialog open={dialog !== null} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog?.type === "add" && `Add Value — ${codeToTitle(dialog.listCode)}`}
              {dialog?.type === "edit" && `Edit Value — ${dialog.valueCode}`}
              {dialog?.type === "new-list" && "Create Lookup List"}
            </DialogTitle>
          </DialogHeader>

          {dialog?.type === "add" && (
            <AddValueDialog listCode={dialog.listCode} onClose={closeDialog} />
          )}
          {dialog?.type === "edit" && (
            <EditValueDialog
              key={`${dialog.listCode}/${dialog.valueCode}`}
              listCode={dialog.listCode}
              valueCode={dialog.valueCode}
              onClose={closeDialog}
            />
          )}
          {dialog?.type === "new-list" && (
            <NewListDialog onClose={closeDialog} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
