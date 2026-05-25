import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Plus, ArrowDown, ArrowUp } from "lucide-react";
import { getVehicle } from "@/api/vehicles";
import { listCostsIncurred } from "@/api/costsIncurred";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { DateDisplay } from "@/components/shared/DateDisplay";
import { LookupDisplay } from "@/components/shared/LookupDisplay";
import { PageHeader } from "@/components/shared/PageHeader";
import { VehicleForm } from "./VehicleForm";
import { usePermission } from "@/hooks/usePermission";
import type { CostIncurred } from "@/types/api";

export default function VehicleDetail() {
  const { id } = useParams<{ id: string }>();
  const [editing, setEditing] = useState(false);
  const [costsSort, setCostsSort] = useState<"asc" | "desc">("desc");
  const canEdit = usePermission("edit_vehicle");

  const { data: vehicle, isLoading } = useQuery({
    queryKey: ["vehicles", id],
    queryFn: () => getVehicle(id!),
    enabled: !!id,
  });

  // Fetch all costs to compute cumulative total (limit 200 covers most vehicles)
  const { data: costsData } = useQuery({
    queryKey: ["costs-incurred", { vehicleId: id }],
    queryFn: () => listCostsIncurred({ vehicle_id: id!, limit: 200, offset: 0 }),
    enabled: !!id,
  });

  const rawCosts = costsData?.data ?? [];
  const costs = [...rawCosts].sort((a, b) => {
    const diff = a.service_date.localeCompare(b.service_date);
    return costsSort === "desc" ? -diff : diff;
  });
  const totalCost = rawCosts.reduce((sum, c) => sum + parseFloat(c.cost || "0"), 0);

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

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title={`${vehicle.make} ${vehicle.model} (${vehicle.registration_no})`}
        actions={
          canEdit && !editing ? (
            <Button size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4 mr-1" />Edit
            </Button>
          ) : undefined
        }
      />

      <div className="flex gap-3 flex-wrap">
        <StatusBadge status={vehicle.current_status ?? "available"} />
        <StatusBadge status={vehicle.vehicle_source ?? "lender_stock"} />
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
              {[
                ["Registration No", vehicle.registration_no],
                ["Make", vehicle.make],
                ["Model", vehicle.model],
                ["Year", String(vehicle.year)],
                ["Color", vehicle.color ?? "—"],
                ["Fuel Type", vehicle.fuel_type ?? "—"],
                ["Vehicle Type", vehicle.vehicle_type ?? "—"],
                ["Chassis No", vehicle.chassis_no ?? "—"],
                ["Engine No", vehicle.engine_no ?? "—"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium capitalize">{value}</dd>
                </div>
              ))}
              {vehicle.final_price && (
                <div>
                  <dt className="text-muted-foreground">Final Price</dt>
                  <dd className="font-medium"><CurrencyDisplay value={vehicle.final_price} /></dd>
                </div>
              )}
              {vehicle.purchase_date && (
                <div>
                  <dt className="text-muted-foreground">Purchase Date</dt>
                  <dd className="font-medium"><DateDisplay value={vehicle.purchase_date} /></dd>
                </div>
              )}
              <div>
                <dt className="text-muted-foreground">Vehicle Cost</dt>
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
    </div>
  );
}
