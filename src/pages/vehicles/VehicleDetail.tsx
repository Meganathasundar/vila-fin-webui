import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, ArrowDown, ArrowUp, ArrowRight, BadgeDollarSign, Trash2 } from "lucide-react";
import { getVehicle, updateVehicle, deleteVehicle, getVehiclePurchase, createVehiclePurchase, updateVehiclePurchase } from "@/api/vehicles";
import { listLoans } from "@/api/loans";
import { listCostsIncurred } from "@/api/costsIncurred";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { DateDisplay } from "@/components/shared/DateDisplay";
import { LookupDisplay } from "@/components/shared/LookupDisplay";
import { LookupSelectField } from "@/components/shared/LookupSelectField";
import { PageHeader } from "@/components/shared/PageHeader";
import { VehicleForm } from "./VehicleForm";
import { usePermission } from "@/hooks/usePermission";
import type { CostIncurred, Loan, VehiclePurchaseCreate } from "@/types/api";

export default function VehicleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [costsSort, setCostsSort] = useState<"asc" | "desc">("desc");
  const canEdit = usePermission("edit_vehicle");
  const canDelete = usePermission("delete_record");

  // ── Delete dialog state ──────────────────────────────────────────────────────
  const [deleteOpen, setDeleteOpen] = useState(false);

  // ── Sell dialog state ────────────────────────────────────────────────────────
  const [sellOpen, setSellOpen] = useState(false);
  const [finalPrice, setFinalPrice] = useState("");

  // ── Revert-to-available dialog state ────────────────────────────────────────
  const [revertOpen, setRevertOpen] = useState(false);

  // ── Purchase edit dialog state ───────────────────────────────────────────────
  const [purchaseEditOpen, setPurchaseEditOpen] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState<VehiclePurchaseCreate>({});

  const { data: vehicle, isLoading } = useQuery({
    queryKey: ["vehicles", id],
    queryFn: () => getVehicle(id!),
    enabled: !!id,
  });

  const { data: purchase } = useQuery({
    queryKey: ["vehicle-purchase", id],
    queryFn: () => getVehiclePurchase(id!),
    enabled: !!id,
    retry: (failCount, err: { response?: { status?: number } }) =>
      err?.response?.status !== 404 && failCount < 3,
  });

  const { data: costsData } = useQuery({
    queryKey: ["costs-incurred", { vehicleId: id }],
    queryFn: () => listCostsIncurred({ vehicle_id: id!, limit: 200, offset: 0 }),
    enabled: !!id,
  });

  const { data: loansData } = useQuery({
    queryKey: ["loans", { vehicleId: id }],
    queryFn: () => listLoans({ vehicle_id: id!, limit: 100, offset: 0 }),
    enabled: !!id,
    select: (data) => ({
      ...data,
      data: (data.data ?? []).filter((l) => l.vehicle_id === id),
    }),
  });

  const rawCosts = costsData?.data ?? [];
  const costs = [...rawCosts].sort((a, b) => {
    const diff = a.service_date.localeCompare(b.service_date);
    return costsSort === "desc" ? -diff : diff;
  });
  const totalCost = rawCosts.reduce((sum, c) => sum + parseFloat(c.cost || "0"), 0);

  // ── Sell mutation ────────────────────────────────────────────────────────────

  const sellMutation = useMutation({
    mutationFn: async () => {
      if (!vehicle || !id) throw new Error("No vehicle");
      await updateVehicle(id, {
        ...vehicle,
        current_status: "sold",
      } as Parameters<typeof updateVehicle>[1]);

      // Update final_price on purchase record if provided
      if (finalPrice.trim()) {
        const fp = String(Number(finalPrice).toFixed(2));
        if (purchase) {
          await updateVehiclePurchase(id, { ...purchase, final_price: fp });
        } else {
          await createVehiclePurchase(id, { final_price: fp });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles", id] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["vehicle-purchase", id] });
      toast.success("Vehicle marked as sold");
      setSellOpen(false);
    },
    onError: (err: { response?: { data?: { error?: { code?: string; message?: string } } } }) => {
      const apiErr = err?.response?.data?.error;
      toast.error(apiErr?.message || apiErr?.code || "Failed to mark vehicle as sold.");
    },
  });

  // ── Revert mutation ──────────────────────────────────────────────────────────

  const revertMutation = useMutation({
    mutationFn: () => {
      if (!vehicle || !id) throw new Error("No vehicle");
      return updateVehicle(id, {
        ...vehicle,
        current_status: "available",
      } as Parameters<typeof updateVehicle>[1]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles", id] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast.success("Vehicle marked as available");
      setRevertOpen(false);
    },
    onError: (err: { response?: { data?: { error?: { code?: string; message?: string } } } }) => {
      const apiErr = err?.response?.data?.error;
      toast.error(apiErr?.message || apiErr?.code || "Failed to update vehicle status.");
    },
  });

  // ── Delete mutation ──────────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!id) throw new Error("No vehicle");
      return deleteVehicle(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast.success("Vehicle deleted");
      navigate("/vehicles");
    },
    onError: (err: { response?: { data?: { error?: { code?: string; message?: string } } } }) => {
      const apiErr = err?.response?.data?.error;
      toast.error(apiErr?.message || apiErr?.code || "Failed to delete vehicle.");
      setDeleteOpen(false);
    },
  });

  // ── Purchase save mutation ────────────────────────────────────────────────────

  const purchaseMutation = useMutation({
    mutationFn: (data: VehiclePurchaseCreate) => {
      if (!id) throw new Error("No vehicle");
      return purchase
        ? updateVehiclePurchase(id, data)
        : createVehiclePurchase(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicle-purchase", id] });
      toast.success("Purchase details saved");
      setPurchaseEditOpen(false);
    },
    onError: () => {
      toast.error("Failed to save purchase details.");
    },
  });

  const openSellDialog = () => {
    setFinalPrice(purchase?.final_price ?? purchase?.asking_price ?? "");
    setSellOpen(true);
  };

  const openPurchaseEdit = () => {
    setPurchaseForm({
      vehicle_cost: purchase?.vehicle_cost ?? null,
      purchase_date: purchase?.purchase_date ?? null,
      consultancy: purchase?.consultancy ?? null,
      asking_price: purchase?.asking_price ?? null,
      final_price: purchase?.final_price ?? null,
      sale_date: purchase?.sale_date ?? null,
    });
    setPurchaseEditOpen(true);
  };

  // ── Loading / not found ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!vehicle) {
    return <p className="text-muted-foreground">Vehicle not found.</p>;
  }

  const isAvailable = vehicle.current_status === "available";
  const isSold = vehicle.current_status === "sold";

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title={`${vehicle.make} ${vehicle.model} (${vehicle.registration_no})`}
        actions={
          !editing ? (
            <div className="flex gap-2">
              {canEdit && isAvailable && (
                <Button size="sm" variant="outline" onClick={openSellDialog}>
                  <BadgeDollarSign className="h-4 w-4 mr-1" />Mark as Sold
                </Button>
              )}
              {canEdit && isSold && (
                <Button size="sm" variant="outline" onClick={() => setRevertOpen(true)}>
                  Mark as Available
                </Button>
              )}
              {canEdit && (
                <Button size="sm" onClick={() => setEditing(true)}>
                  <Pencil className="h-4 w-4 mr-1" />Edit
                </Button>
              )}
              {canDelete && (
                <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="h-4 w-4 mr-1" />Delete
                </Button>
              )}
            </div>
          ) : undefined
        }
      />

      <div className="flex gap-3 flex-wrap">
        <StatusBadge status={vehicle.current_status ?? "available"} />
      </div>

      {editing ? (
        <Card>
          <CardHeader><CardTitle>Edit Vehicle</CardTitle></CardHeader>
          <CardContent>
            <VehicleForm
              vehicle={vehicle}
              onSuccess={() => setEditing(false)}
              onCancel={() => setEditing(false)}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Vehicle Info</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {([
                ["Registration No", vehicle.registration_no],
                ["Make", vehicle.make],
                ["Model", vehicle.model],
                ["Year", String(vehicle.year)],
                ["Color", vehicle.color ?? "—"],
                ["Fuel Type", vehicle.fuel_type ?? "—"],
                ["Vehicle Type", vehicle.vehicle_type ? vehicle.vehicle_type.replace(/_/g, " ") : "—"],
                ["Chassis No", vehicle.chassis_no ?? "—"],
                ["Engine No", vehicle.engine_no ?? "—"],
              ] as [string, string][]).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium capitalize">{value}</dd>
                </div>
              ))}

              <div>
                <dt className="text-muted-foreground">Total Cost Incurred</dt>
                <dd className="font-semibold text-base">
                  {totalCost > 0
                    ? <CurrencyDisplay value={totalCost.toFixed(2)} />
                    : <span className="text-muted-foreground font-normal">—</span>}
                </dd>
              </div>

              <div>
                <dt className="text-muted-foreground">Record Created</dt>
                <dd><DateDisplay value={vehicle.created_at} /></dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}

      {/* Purchase Details */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Purchase Details</CardTitle>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={openPurchaseEdit}>
              <Pencil className="h-4 w-4 mr-1" />{purchase ? "Edit" : "Add"}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {!purchase ? (
            <p className="text-sm text-muted-foreground">No purchase details recorded yet.</p>
          ) : (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Purchase Date</dt>
                <dd className="font-medium">
                  {purchase.purchase_date ? <DateDisplay value={purchase.purchase_date} /> : <span className="text-muted-foreground">—</span>}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Consultancy</dt>
                <dd className="font-medium">
                  {purchase.consultancy
                    ? <LookupDisplay listCode="vehicle_consultancy" id={purchase.consultancy} />
                    : <span className="text-muted-foreground">—</span>}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Vehicle Cost</dt>
                <dd className="font-medium">
                  {purchase.vehicle_cost ? <CurrencyDisplay value={purchase.vehicle_cost} /> : <span className="text-muted-foreground">—</span>}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Asking Price</dt>
                <dd className="font-medium">
                  {purchase.asking_price ? <CurrencyDisplay value={purchase.asking_price} /> : <span className="text-muted-foreground">—</span>}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Final Price</dt>
                <dd className="font-medium">
                  {purchase.final_price ? <CurrencyDisplay value={purchase.final_price} /> : <span className="text-muted-foreground">—</span>}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Sale Date</dt>
                <dd className="font-medium">
                  {purchase.sale_date ? <DateDisplay value={purchase.sale_date} /> : <span className="text-muted-foreground">—</span>}
                </dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>

      {/* Loans */}
      <Card>
        <CardHeader>
          <CardTitle>Loans</CardTitle>
        </CardHeader>
        <CardContent>
          {(loansData?.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No loans linked to this vehicle.</p>
          ) : (
            <div className="divide-y text-sm">
              {(loansData?.data ?? []).map((loan: Loan) => (
                <div key={loan.id} className="py-2.5 grid grid-cols-[1fr_1fr_1fr_1fr_2rem] gap-3 items-center">
                  <div>
                    <span className="font-mono text-xs text-muted-foreground">{loan.loan_number}</span>
                  </div>
                  <div><StatusBadge status={loan.status} /></div>
                  <div className="font-medium"><CurrencyDisplay value={loan.principal_amount} /></div>
                  <div className="text-muted-foreground">
                    {loan.first_due_date
                      ? <DateDisplay value={loan.first_due_date} />
                      : <span className="italic">No due date</span>}
                  </div>
                  <Link to={`/loans/${loan.id}`}>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Costs Incurred */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Costs Incurred</CardTitle>
            {totalCost > 0 && (
              <p className="text-sm text-muted-foreground mt-0.5">
                Total: <span className="font-semibold text-foreground"><CurrencyDisplay value={totalCost.toFixed(2)} /></span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="gap-1 text-muted-foreground"
              onClick={() => setCostsSort((s) => (s === "desc" ? "asc" : "desc"))}
            >
              {costsSort === "desc" ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}
              {costsSort === "desc" ? "Newest first" : "Oldest first"}
            </Button>
            <Link to={`/costs-incurred/new?vehicle_id=${vehicle.id}`}>
              <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" />Add Cost</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {costs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No costs recorded for this vehicle.</p>
          ) : (
            <div className="divide-y text-sm">
              {costs.map((exp: CostIncurred, idx: number) => (
                <div key={exp.id} className="py-2.5 grid grid-cols-[2rem_1fr_1fr_1fr_1fr_1fr_2rem] gap-2 items-center">
                  <span className="text-xs text-muted-foreground font-mono">{idx + 1}.</span>
                  <div><StatusBadge status={exp.cost_type} listName="cost_type" /></div>
                  <div className="text-muted-foreground truncate">{exp.description ?? "—"}</div>
                  <div className="font-medium"><CurrencyDisplay value={exp.cost} /></div>
                  <div className="text-muted-foreground text-sm">
                    <LookupDisplay listCode="garage" id={exp.garage} />
                  </div>
                  <div className="text-muted-foreground"><DateDisplay value={exp.service_date} /></div>
                  <Link to={`/costs-incurred/${exp.id}/edit`}>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              ))}
              {(costsData?.meta?.total ?? 0) > 200 && (
                <div className="pt-2">
                  <Link to={`/costs-incurred?vehicle_id=${vehicle.id}`} className="text-xs text-primary hover:underline">
                    View all {costsData?.meta?.total} costs →
                  </Link>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Purchase Edit Dialog ────────────────────────────────────────────────── */}
      <Dialog open={purchaseEditOpen} onOpenChange={(o) => !o && setPurchaseEditOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{purchase ? "Edit Purchase Details" : "Add Purchase Details"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Purchase Date</Label>
              <Input
                type="date"
                value={purchaseForm.purchase_date ?? ""}
                onChange={(e) => setPurchaseForm((p) => ({ ...p, purchase_date: e.target.value || null }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Consultancy Agency</Label>
              <LookupSelectField
                listCode="vehicle_consultancy"
                value={purchaseForm.consultancy}
                onChange={(v) => setPurchaseForm((p) => ({ ...p, consultancy: v }))}
                placeholder="Select consultancy…"
                allowNone
              />
            </div>
            <div className="space-y-1">
              <Label>Vehicle Cost (₹)</Label>
              <Input
                type="number"
                step="0.01"
                value={purchaseForm.vehicle_cost ?? ""}
                onChange={(e) => setPurchaseForm((p) => ({ ...p, vehicle_cost: e.target.value || null }))}
                placeholder="e.g. 350000.00"
              />
            </div>
            <div className="space-y-1">
              <Label>Asking Price (₹)</Label>
              <Input
                type="number"
                step="0.01"
                value={purchaseForm.asking_price ?? ""}
                onChange={(e) => setPurchaseForm((p) => ({ ...p, asking_price: e.target.value || null }))}
                placeholder="e.g. 380000.00"
              />
            </div>
            <div className="space-y-1">
              <Label>Final Price (₹)</Label>
              <Input
                type="number"
                step="0.01"
                value={purchaseForm.final_price ?? ""}
                onChange={(e) => setPurchaseForm((p) => ({ ...p, final_price: e.target.value || null }))}
                placeholder="e.g. 370000.00"
              />
            </div>
            <div className="space-y-1">
              <Label>Sale Date</Label>
              <Input
                type="date"
                value={purchaseForm.sale_date ?? ""}
                onChange={(e) => setPurchaseForm((p) => ({ ...p, sale_date: e.target.value || null }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPurchaseEditOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                const toStr = (v: string | null | undefined) =>
                  v && String(v).trim() ? String(Number(v).toFixed(2)) : null;
                purchaseMutation.mutate({
                  vehicle_cost: toStr(purchaseForm.vehicle_cost),
                  purchase_date: purchaseForm.purchase_date || null,
                  consultancy: purchaseForm.consultancy || null,
                  asking_price: toStr(purchaseForm.asking_price),
                  final_price: toStr(purchaseForm.final_price),
                  sale_date: purchaseForm.sale_date || null,
                });
              }}
              disabled={purchaseMutation.isPending}
            >
              {purchaseMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Revert to Available dialog ──────────────────────────────────────────── */}
      <Dialog open={revertOpen} onOpenChange={(o) => !o && setRevertOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Vehicle as Available</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            This will change <span className="font-medium text-foreground">{vehicle.registration_no}</span> status
            from <strong>Sold</strong> back to <strong>Available</strong> and return it to inventory.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevertOpen(false)}>Cancel</Button>
            <Button onClick={() => revertMutation.mutate()} disabled={revertMutation.isPending}>
              {revertMutation.isPending ? "Saving…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete dialog ──────────────────────────────────────────────────────── */}
      <Dialog open={deleteOpen} onOpenChange={(o) => !o && setDeleteOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Vehicle</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to permanently delete{" "}
            <span className="font-medium text-foreground">{vehicle.registration_no}</span>?
            This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Mark as Sold dialog ────────────────────────────────────────────────── */}
      <Dialog open={sellOpen} onOpenChange={(o) => !o && setSellOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Vehicle as Sold</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              This will set <span className="font-medium text-foreground">{vehicle.registration_no}</span> status to{" "}
              <strong>Sold</strong> and remove it from the available inventory.
              {!isSold && " This action can be reversed by editing the vehicle status."}
            </p>

            <div className="space-y-1">
              <Label>Final Sale Price (₹)</Label>
              <Input
                type="number"
                step="0.01"
                value={finalPrice}
                onChange={(e) => setFinalPrice(e.target.value)}
                placeholder="e.g. 380000.00"
              />
              <p className="text-xs text-muted-foreground">
                Optional — leave blank to keep the existing value
                {purchase?.final_price && <span> ({<CurrencyDisplay value={purchase.final_price} />})</span>}.
              </p>
            </div>

            {purchase?.asking_price && (
              <div className="rounded-md bg-muted/50 border px-3 py-2 text-sm flex justify-between">
                <span className="text-muted-foreground">Asking price</span>
                <span className="font-medium"><CurrencyDisplay value={purchase.asking_price} /></span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSellOpen(false)}>Cancel</Button>
            <Button
              onClick={() => sellMutation.mutate()}
              disabled={sellMutation.isPending}
            >
              {sellMutation.isPending ? "Saving…" : "Confirm Sale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
